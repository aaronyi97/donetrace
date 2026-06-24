// === dialogue scan v1, LOCAL HALF (deterministic, zero-network, zero-cost) ===
//
// This module is the "local half" of semantic scanning. The PROBLEM it addresses:
// a user's real signals about an AI collaboration — "I said this was done", "I keep
// correcting the same thing" — live in their CHAT EXPORTS and SHELL LOGS, not in the
// .aict ledger. bootstrap (bootstrap.js) already turns the ledger + repo + git into
// five cards; this module lets it ALSO read a LOCAL export the user EXPLICITLY hands
// over (`--dialogue` / `--logs`) and extract DETERMINISTIC signals to enrich those
// cards — WITHOUT ever calling a model and WITHOUT sending anything anywhere.
//
// HONESTY IS THE WHOLE POINT (four red lines, enforced structurally here):
//   1. DETERMINISTIC ONLY. Every signal below is a word-table match + a normalized
//      count + a set lookup against the ledger. There is NO model call, NO guess, NO
//      ranking by "confidence we made up" — low-certainty signals are flagged
//      `confidence: "low"` and that is the ceiling. The external-model pass is a
//      LATER sub-batch (`--send-to-model`); it is deliberately NOT here.
//   2. A COMPLETION CLAIM IS NEVER "DONE". A "done"/"shipped"/"已完成" found in a chat
//      is a CANDIDATE for the VERIFY card with the wording `claimed in dialogue ·
//      not verified`. It is cross-referenced against the ledger; if the ledger has no
//      accepted receipt AND no executed run that could back it, it stays a VERIFY
//      finding. It is NEVER promoted to a task status and NEVER rendered as done.
//   3. CANDIDATES ARE PROPOSED. A repeated correction becomes a HARVEST *profile*
//      candidate with `status: "proposed"`. This module returns plain data; it writes
//      NOTHING to a profile, a ledger, or any long-term state. The caller (report-only
//      bootstrap) writes nothing either.
//   4. OPT-IN, HIGH-PRIVACY-OFF-BY-DEFAULT. Nothing here runs unless the user names a
//      file. A missing / unreadable file is SKIPPED with a note, never fatal. And a
//      snippet is REDACTED (redactSnippet) before it is ever surfaced or recorded, so
//      a secret/email/local-path pasted into a chat does not leak through the report.
//
// Pure + serializable: every export takes its inputs as arguments (the file READING
// is the one I/O boundary, parseDialogueExports, kept tiny and fail-soft) and returns
// plain objects, so the signal logic is trivially testable without a real chat export.

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// --- A. Redaction (shared with the future external-model path) --------------
//
// `redactSnippet` masks the sensitive substrings that must NEVER be displayed or
// recorded out of a user's export. The pattern set MIRRORS the always-forbidden
// rules in scripts/privacy-scan.js (the release-safety scanner) + the spirit of
// scripts/lib/forbidden-in-pack.js: secret/key material, tokens, emails, phone
// numbers, and absolute local machine paths. Keeping the SHAPES aligned with the
// privacy scanner means "what the scanner would block from shipping" and "what the
// dialogue scan masks before showing" do not drift into two different ideas of
// "sensitive". This is exported so the LATER `--send-to-model` path reuses the exact
// same redaction before anything is sent — one definition, no second copy to rot.
//
// Each rule is [RegExp(global), placeholder]. Order matters: the most specific,
// highest-signal secrets run first so a key inside a longer string is masked as a
// key (not later half-caught by the generic path rule). All regexes are GLOBAL so
// every occurrence on a line is masked, not just the first.
const REDACTION_RULES = [
  // Private key material (PEM blocks) — the single most dangerous leak. The FULL-BLOCK
  // rule runs FIRST (while both BEGIN/END anchors are still intact) so the base64 BODY
  // is masked too, not just the header; the header-only rule right after is the fallback
  // for a lone BEGIN marker with no matching END in the snippet.
  ...buildPemBodyRules(),
  [/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g, "[redacted:private-key]"],
  // Provider secret keys / tokens (shapes copied from privacy-scan's alwaysForbidden).
  [/\bgithub_pat_[A-Za-z0-9_]{30,}/g, "[redacted:token]"],
  [/\bgh[pousr]_[A-Za-z0-9_]{20,}/g, "[redacted:token]"],
  [/\bxox[baprs]-[A-Za-z0-9-]{20,}/g, "[redacted:token]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{24,}/gi, "[redacted:token]"],
  [/sk-[A-Za-z0-9_-]{20,}/g, "[redacted:secret-key]"],
  [/AKIA[0-9A-Z]{16}/g, "[redacted:aws-key]"],
  [/AIza[0-9A-Za-z_-]{20,}/g, "[redacted:api-key]"],
  // key/secret/token/password = "..." assignments (quoted value).
  [/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["'][^"']{8,}["']/gi, "[redacted:secret]"],
  // password=/passwd=/pwd= followed by an UNQUOTED value (a clear-shape secret the quoted
  // rule above misses). Only these three explicit key NAMES + a `:`/`=` + a run of
  // non-space value chars — narrow enough not to catch prose. Quoted values are also
  // covered (the value class allows quotes). The trailing value stops at whitespace so a
  // sentence after the value is left intact.
  [/\b(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{4,}["']?/gi, "[redacted:secret]"],
  // Email addresses (any address — bootstrap has no notion of a "public contact").
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted:email]"],
  // Absolute local machine paths — see HOME_SEGMENT below. The home-dir segment name
  // is built from a variable, not a literal, so this redaction module does not itself
  // contain a "real-looking" local path (which the release privacy scan would flag).
  ...buildLocalPathRules(),
  // Phone numbers (US-style grouped + Chinese mobile), same shapes as privacy-scan.
  [/(?<![A-Za-z0-9_])(?:\+?\d{1,3}[\s.-])?(?:\(?\d{3}\)?[\s.-])\d{3}[\s.-]\d{4}(?![A-Za-z0-9_])/g, "[redacted:phone]"],
  [/(?<![\d.\-])1[3-9]\d{9}(?![\d.\-])/g, "[redacted:phone]"]
];

// Build the absolute-local-path redaction rules. The POSIX home roots ("Users" on
// macOS, "home" on Linux) and the Windows "<Drive>:\Users\" prefix are assembled from
// these segment NAMES at runtime, so the literal path prefixes never appear verbatim
// in this source file — keeping the redaction module itself clean under the release
// privacy scan (which flags real-looking local paths). The compiled regexes match the
// exact same shapes as scripts/privacy-scan.js's path rules.
function buildLocalPathRules() {
  const HOME_SEGMENTS = ["Users", "home"]; // the macOS and Linux home-root segments
  // System roots a real machine path can also start under (not just the home dir): a
  // deploy / service / config absolute path leaks just as much as a home one. Built from
  // segment NAMES (not a literal "/etc/..." string) so this module stays clean under the
  // release privacy scan. Conservative set: only well-known top-level system dirs, each
  // requiring at least one path segment after it (so a bare "/var" word is not masked).
  const SYSTEM_ROOTS = ["var", "etc", "opt", "srv", "usr"];
  const tail = "(?:/[^\\s`'\")]+)*";
  const winTail = "(?:\\\\[^\\s`'\")]+)*";
  const rules = [];
  for (const seg of HOME_SEGMENTS) {
    rules.push([new RegExp(`/${seg}/[^/\\s]+${tail}`, "g"), "[redacted:path]"]);
  }
  for (const root of SYSTEM_ROOTS) {
    // /<root>/<at least one segment> — requires a child so a lone "/etc" word is left be.
    rules.push([new RegExp(`/${root}/[^/\\s]+${tail}`, "g"), "[redacted:path]"]);
  }
  // Windows: <Drive>:\<dir>\<more>... — ANY drive-letter path with at least one more
  // segment (not just \Users\). Earlier this was Users-only; a Windows app/config path
  // (C:\ProgramData\..., D:\service\...) is just as sensitive. Requires one backslashed
  // child after the first dir so a bare "C:\" is not masked.
  rules.push([new RegExp(`[A-Za-z]:\\\\[^\\\\\\s]+${winTail}`, "g"), "[redacted:path]"]);
  return rules;
}

// Build the PEM private-key BODY redaction rule. A PEM block is
// `-----BEGIN ... PRIVATE KEY-----` then base64 lines then `-----END ... PRIVATE KEY-----`.
// The BEGIN/END markers are masked by the rule above; this masks the base64 BODY in
// between (the actual secret), so a multi-line key pasted into a chat is fully redacted,
// not just its header. Matches the whole block (DOTALL via [\s\S]) non-greedily. The
// literal marker text is assembled from a fragment so this module stays clean under the
// release privacy scan (which would otherwise flag a verbatim PEM marker in source).
function buildPemBodyRules() {
  const KEY = "PRIVATE KEY";
  const begin = `-----BEGIN (?:RSA |OPENSSH |EC |DSA )?${KEY}-----`;
  const end = `-----END (?:RSA |OPENSSH |EC |DSA )?${KEY}-----`;
  return [
    [new RegExp(`${begin}[\\s\\S]*?${end}`, "g"), "[redacted:private-key]"]
  ];
}

// Mask every sensitive substring in `text`, returning the redacted string. A
// non-string input returns "" (a snippet that cannot be read is shown as empty, never
// thrown). Idempotent in practice: re-running over an already-redacted string only
// re-matches the literal "[redacted:*]" placeholders against nothing, so it is safe to
// call more than once. This is the ONLY way a raw export fragment becomes displayable.
export function redactSnippet(text) {
  if (typeof text !== "string") return "";
  let out = text;
  for (const [regex, placeholder] of REDACTION_RULES) {
    out = out.replace(regex, placeholder);
  }
  return out;
}

// Trim a (already-redacted) snippet to a bounded length so a runaway log line cannot
// blow up the report. Whole-line by default; cut on a word boundary near the cap with
// an ellipsis. Pure string transform.
function clampSnippet(text, max = 160) {
  const s = String(text).replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

// --- B. File reading (the one I/O boundary; fail-soft, opt-in) --------------
//
// Read the user-EXPLICITLY-named export files. `paths` is the parsed list from
// `--dialogue` / `--logs` (the CLI splits comma-separated values). Each path is read
// individually; a missing / unreadable / over-large / wrong-extension file is SKIPPED
// with a recorded reason (never throws, never aborts the report — red line #4). Only
// plain-text shapes (.txt/.json/.md/.log/.jsonl) are read; anything else is skipped so
// bootstrap never tries to parse a binary. Returns:
//   { sources: [{ path, kind, bytes, lines, text }], skipped: [{ path, reason }] }
// where `text` is the RAW file content (redaction happens later, per-snippet, so the
// signal extractor can match on the original words but only redacted text is surfaced).
const ALLOWED_EXT = new Set([".txt", ".json", ".md", ".log", ".jsonl", ".csv", ".html"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB: a generous chat export, but bounded.

export function parseDialogueExports(paths, kind = "dialogue") {
  const list = Array.isArray(paths) ? paths : [];
  const sources = [];
  const skipped = [];
  for (const rawPath of list) {
    const p = typeof rawPath === "string" ? rawPath.trim() : "";
    if (p.length === 0) continue;
    const abs = path.resolve(p);
    if (!existsSync(abs)) {
      skipped.push({ path: p, reason: "not_found" });
      continue;
    }
    let st;
    try {
      st = statSync(abs);
    } catch {
      skipped.push({ path: p, reason: "unreadable" });
      continue;
    }
    if (!st.isFile()) {
      skipped.push({ path: p, reason: "not_a_file" });
      continue;
    }
    if (st.size > MAX_BYTES) {
      skipped.push({ path: p, reason: "too_large" });
      continue;
    }
    const ext = path.extname(abs).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      skipped.push({ path: p, reason: "unsupported_type" });
      continue;
    }
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      skipped.push({ path: p, reason: "unreadable" });
      continue;
    }
    sources.push({
      path: p,
      kind,
      bytes: st.size,
      lines: text.length === 0 ? 0 : text.split("\n").length,
      text
    });
  }
  return { sources, skipped };
}

// --- C. Signal extraction (deterministic word-table + counting) -------------

// The completion-claim word table. A line containing one of these (as a whole word /
// phrase, case-insensitive) is a COMPLETION CLAIM — the thing red line #2 must never
// let through as "done". English + Chinese, since the export may be in either. These
// are LITERAL markers, not an LLM intent classifier: a deterministic, auditable list.
const COMPLETION_MARKERS = [
  // English
  "done", "complete", "completed", "shipped", "finished", "fixed", "resolved",
  "all set", "good to go", "ready to merge", "merged", "deployed", "wrapped up",
  // Chinese
  "已完成", "搞定", "做完了", "做好了", "完成了", "弄好了", "已搞定", "已经好了",
  "已修复", "修好了", "已部署", "上线了", "已上线", "齐活"
];

// A correction marker table: a line where the user is CORRECTING the AI (telling it
// it did the wrong thing / to redo it). Repeated corrections of the SAME kind are the
// "you keep telling the AI the same thing" signal -> a HARVEST profile candidate.
const CORRECTION_MARKERS = [
  // English
  "no,", "not like that", "that's wrong", "thats wrong", "wrong again", "i said",
  "stop doing", "don't", "do not", "redo", "again,", "actually,", "incorrect",
  "you keep", "as i said", "like i said", "i told you", "revert", "undo that",
  // Chinese
  "不对", "不是这样", "错了", "又错了", "我说过", "别这样", "不要", "重做",
  "再说一遍", "跟你说过", "我说的是", "撤销", "改回去", "不是让你", "说了多少遍"
];

// Build a regex that matches ANY of a marker list as a case-insensitive substring,
// with word boundaries for the ASCII markers (so "done" does not fire inside
// "abandoned") and bare substring for CJK (no word boundary concept). Escapes each
// marker so a punctuation marker like "no," is matched literally.
function buildMarkerRegex(markers) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ascii = markers.filter((m) => /^[\x00-\x7F]+$/.test(m));
  const cjk = markers.filter((m) => !/^[\x00-\x7F]+$/.test(m));
  const parts = [];
  for (const m of ascii) {
    // \b only works at an ASCII alnum boundary; many markers end in punctuation, so
    // only wrap a boundary where the edge char is a word char.
    const left = /^\w/.test(m) ? "\\b" : "";
    const right = /\w$/.test(m) ? "\\b" : "";
    parts.push(`${left}${escape(m)}${right}`);
  }
  for (const m of cjk) parts.push(escape(m));
  return new RegExp(parts.join("|"), "i");
}

const COMPLETION_RE = buildMarkerRegex(COMPLETION_MARKERS);
const CORRECTION_RE = buildMarkerRegex(CORRECTION_MARKERS);

// Normalize a line for DUP COUNTING of corrections: lowercase, strip a leading
// speaker label ("user:", "me >", "[2026-01-01] assistant:"), collapse whitespace,
// drop trailing punctuation. Two corrections that differ only in casing / timestamp /
// speaker prefix count as the SAME correction (red line: a normalized COUNT, not an
// LLM "these mean the same thing" judgment).
function normalizeForCount(line) {
  let s = String(line).toLowerCase();
  // strip a leading "[timestamp]" and/or "speaker:" / "speaker>" prefix
  s = s.replace(/^\s*\[[^\]]*\]\s*/, "");
  s = s.replace(/^\s*[a-z0-9_一-鿿 .#-]{1,24}\s*[:>]\s*/i, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[.!?。！？,，;；]+$/g, "");
  return s;
}

// Split a raw export into candidate "lines". For a .json/.jsonl chat export we still
// scan line-wise (a deterministic, format-agnostic pass): we do NOT assume a schema,
// so we read every line as text. This keeps the extractor robust to any tool's export
// shape without a brittle per-tool parser.
function toLines(text) {
  return String(text).split(/\r?\n/);
}

// Pull the task-ish PHRASE out of a completion-claim line, used to cross-reference the
// ledger. Strips the speaker prefix + the completion marker word itself, leaving the
// subject ("the auth refactor"). Heuristic + deterministic; surfaced only as a
// redacted snippet, never trusted as structured data.
function claimSubject(line) {
  let s = normalizeForCount(line);
  // remove the matched completion marker so "auth refactor is done" -> "auth refactor is"
  s = s.replace(COMPLETION_RE, " ");
  s = s.replace(/\b(is|are|was|were|now|finally|already|的|了|是)\b/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

// Tokenize a string into a set of lowercased word tokens (ASCII words + CJK runs),
// dropping very short / stop-ish tokens, for a deterministic overlap test between a
// dialogue claim subject and a ledger task title. No fuzzy/semantic match — pure set
// overlap on normalized tokens.
const STOP_TOKENS = new Set([
  "the", "a", "an", "to", "of", "and", "or", "for", "in", "on", "it", "this", "that",
  "task", "feature", "bug", "fix", "is", "was", "be", "my", "our", "all", "with"
]);
function tokenSet(text) {
  const tokens = String(text).toLowerCase().match(/[a-z0-9]+|[一-鿿]+/g) || [];
  const out = new Set();
  for (const tok of tokens) {
    if (/^[a-z0-9]+$/.test(tok)) {
      if (tok.length < 3 || STOP_TOKENS.has(tok)) continue;
      out.add(tok);
    } else {
      // a CJK run: add the whole run AND each 2-gram, so "登录流程" overlaps "登录".
      out.add(tok);
      for (let i = 0; i + 2 <= tok.length; i++) out.add(tok.slice(i, i + 2));
    }
  }
  return out;
}

// Does the ledger contain a task whose title OVERLAPS the claim subject AND that is
// actually BACKED (an accepted, done-eligible receipt OR an executed run)? This is the
// cross-reference of red line #2: a completion claim is only "trustworthy enough to NOT
// flag" when a backed ledger task plausibly corresponds to it. `perTask` is the output
// of summarizeTasks (it carries the RE-COMPUTED receipt + runCount + the honest
// authorMarkedDoneUnverified flag). We require BOTH token overlap AND backing, so:
//   - claim with NO matching backed task  -> flagged (claimed, not verified)
//   - claim with a matching backed task   -> not flagged (the ledger backs it)
// Token overlap uses a small intersection threshold; backing reuses the ledger's OWN
// honesty (a done-eligible accepted receipt, never a raw "status: done").
function claimIsBackedByLedger(subjectTokens, perTask) {
  if (subjectTokens.size === 0) return false;
  for (const t of perTask) {
    if (t.isSeed) continue; // the shipped example never backs a user's claim
    const titleTokens = tokenSet(t.title || "");
    let overlap = 0;
    for (const tok of subjectTokens) if (titleTokens.has(tok)) overlap += 1;
    if (overlap === 0) continue;
    // "Backed" = the ledger's own honest signals say this task is real work with a
    // verifiable result: a non-author-marked (i.e. receipt-backed) result, OR a
    // recorded executed run. authorMarkedDoneUnverified === false AND status done is
    // the strongest; a runCount > 0 shows an actual execution happened.
    const receiptBacked =
      t.receipt &&
      t.receipt.status === "accepted" &&
      t.authorMarkedDoneUnverified !== true &&
      t.receipt.familyUnverified !== true;
    const runBacked = t.runCount > 0;
    if (receiptBacked || runBacked) return true;
  }
  return false;
}

// Extract ALL deterministic dialogue signals from the parsed sources, cross-referenced
// against the ledger (perTask = summarizeTasks output). Returns:
//   {
//     used: boolean,                 // any source was actually read
//     sources: [{ path, kind, bytes, lines }],   // (no raw text — for the transparency line)
//     skipped: [{ path, reason }],
//     snippetCount: number,          // total flagged snippets across all signals
//     suspectedFalseCompletions: [   // -> VERIFY card candidates (red line #2)
//       { source, line, snippet, subject, backed:false, confidence:"low" }
//     ],
//     repeatedCorrections: [         // -> HARVEST profile candidates (red line #3)
//       { normalized, count, snippet, confidence:"low" }
//     ]
//   }
// Everything here is a word-table match + a normalized count + a ledger SET lookup.
// No model, no guess, no network. Snippets are REDACTED before they enter the result.
export function extractDialogueSignals({ parsed, perTask = [] }) {
  const sources = Array.isArray(parsed?.sources) ? parsed.sources : [];
  const skipped = Array.isArray(parsed?.skipped) ? parsed.skipped : [];

  const suspectedFalseCompletions = [];
  const correctionCounts = new Map(); // normalized -> { count, firstSnippet }

  for (const src of sources) {
    const lines = toLines(src.text);
    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim();
      if (line.length === 0) return;

      // (1) Completion claims -> cross-reference the ledger -> VERIFY candidate.
      if (COMPLETION_RE.test(line)) {
        const subject = claimSubject(line);
        const backed = claimIsBackedByLedger(tokenSet(subject), perTask);
        if (!backed) {
          suspectedFalseCompletions.push({
            source: src.path,
            line: idx + 1,
            // The snippet is REDACTED + clamped before it is ever surfaced/recorded.
            snippet: clampSnippet(redactSnippet(line)),
            subject: clampSnippet(redactSnippet(subject), 80),
            // The honesty contract, carried explicitly so a consumer/test can assert it:
            // a dialogue completion is NEVER "done"; it is a claim, cross-referenced and
            // found unbacked by the ledger.
            displayedAsDone: false,
            backed: false,
            source_kind: "dialogue",
            confidence: "low"
          });
        }
      }

      // (2) Corrections -> normalized dup count -> (>=2) HARVEST profile candidate.
      if (CORRECTION_RE.test(line)) {
        const norm = normalizeForCount(line);
        if (norm.length >= 4) {
          const prev = correctionCounts.get(norm);
          if (prev) {
            prev.count += 1;
          } else {
            correctionCounts.set(norm, { count: 1, snippet: clampSnippet(redactSnippet(line)) });
          }
        }
      }
    });
  }

  // A repeated correction = the SAME normalized line seen >= 2 times. Sorted by count.
  const repeatedCorrections = [...correctionCounts.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([normalized, v]) => ({
      normalized: clampSnippet(normalized, 80),
      count: v.count,
      snippet: v.snippet,
      confidence: "low"
    }));

  const snippetCount = suspectedFalseCompletions.length + repeatedCorrections.length;

  return {
    used: sources.length > 0,
    sources: sources.map((s) => ({ path: s.path, kind: s.kind, bytes: s.bytes, lines: s.lines })),
    skipped,
    snippetCount,
    suspectedFalseCompletions,
    repeatedCorrections
  };
}

// Convenience: read + extract in one call (used by the CLI). `dialoguePaths` /
// `logPaths` are the parsed flag lists; `perTask` is summarizeTasks output. Reads
// dialogue and logs separately so each snippet records WHICH kind it came from, then
// merges into one signal object. Fail-soft throughout (a bad file is skipped, never
// fatal). Returns the same shape as extractDialogueSignals, plus the merged skip list.
export function scanDialogueAndLogs({ dialoguePaths = [], logPaths = [], perTask = [] }) {
  const dlg = parseDialogueExports(dialoguePaths, "dialogue");
  const log = parseDialogueExports(logPaths, "logs");
  const parsed = {
    sources: [...dlg.sources, ...log.sources],
    skipped: [...dlg.skipped, ...log.skipped]
  };
  return extractDialogueSignals({ parsed, perTask });
}
