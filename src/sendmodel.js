// === semantic scan v1, EXTERNAL-MODEL HALF (opt-in, consent-gated, redacted) ==
//
// This module is the "external-model half" of semantic scanning — the ONLY feature
// in the whole system that can send a user's data to a model OUTSIDE this machine.
// Everything else (bootstrap, the dialogue LOCAL half) is deterministic + zero-network.
// Because this is the single privacy boundary, HONESTY IS HELD BY DESIGN here, not by
// good intentions: the default is "never send", and the path that DOES send is forced
// through consent + redaction + a low-confidence/proposed/never-written presentation.
//
// HONESTY / PRIVACY RED LINES (each one is enforced by code in this file + its tests):
//   1. DEFAULT NEVER SENDS. This module does nothing unless the CLI was given an
//      EXPLICIT `--send-to-model`. With no flag, bootstrap's behavior is byte-identical
//      to the pure-local report; none of this code runs. (Enforced in cli.js: the send
//      path is entered only on args.sendToModel === true.)
//   2. CONSENT + PREVIEW BEFORE SEND. The user is shown EXACTLY what will be sent —
//      which sources, how many snippets, that every snippet is redacted, which model —
//      and must confirm (interactive y/N, or `--yes` when non-interactive). Without
//      confirmation NOTHING is sent. (buildSendPreview + the cli.js gate.)
//   3. REDACTED PAYLOAD, ASSERTED (for the shapes we recognize). The prompt actually sent
//      is built ONLY from snippets that already passed dialogue.js's redactSnippet, and
//      then the WHOLE prompt is re-scanned and ASSERTED to carry no RECOGNIZED-SHAPE
//      secret: no home-dir or /var //etc //opt //srv //usr or Windows-drive absolute path,
//      and no recognized-shape secret (private keys incl. the multi-line body, provider
//      api keys/tokens, the api-key/token/secret/password assignment forms, emails). This
//      is a SHAPE allowlist, not a guarantee of total cleanliness — a secret with NO
//      recognizable shape (e.g. a bare opaque value with no key= prefix) is not detectable
//      and is NOT claimed clean. See redactSnippet / buildLeakDetectors for the exact
//      covered shapes; the two are kept in sync. assertPayloadRedacted THROWS if a
//      recognized shape slips through, so such a leak aborts the send instead of shipping.
//      `--dry-run-send` prints this exact payload, unsent.
//   4. OPTIONAL MODEL CALL, GRACEFUL DEGRADE. The call is shelled out to the user's
//      local `claude` (the prompt goes over STDIN, never argv — no injection / length
//      blow-up), overridable via `--model <cmd>`. The invocation is an INJECTABLE
//      function (runModel(payload, { invoke })) so tests stub it and NEVER spawn a real
//      model. If `claude` is missing / errors / times out, we report a clear error and
//      DEGRADE to the local result — never crash, never fabricate.
//   5. LLM OUTPUT IS THE LEAST-TRUSTED INPUT. The model must return JSON only. We parse
//      it; a parse failure / unexpected shape is DISCARDED with a warning and we degrade
//      to local — an unparsed blob is NEVER shown as a result. A parsed candidate is
//      stamped confidence:"low" (LLM is the lowest tier), proposed:true, source:"model",
//      and bootstrap (report-only) writes it NOWHERE (no profile, no ledger). It is
//      NEVER rendered as done/verified.
//
// Pure + serializable + injectable: every export takes its inputs as arguments and the
// one side-effecting boundary (the model spawn) is a default `invoke` that callers (and
// tests) replace. So the whole contract is testable without ever calling an external model.

import { spawnSync } from "node:child_process";
import { redactSnippet } from "./dialogue.js";

// The recognized LLM candidate kinds. The model is asked to classify each finding into
// exactly one of these — the SAME four shapes the local half already produces, so an
// LLM finding can never introduce a new, unaudited card type. Anything outside this set
// is dropped on parse (red line #5).
export const MODEL_CANDIDATE_KINDS = Object.freeze([
  "false_completion", // a "done" the chat asserts that nothing backs (-> VERIFY)
  "profile_candidate", // a standing preference / correction (-> HARVEST profile)
  "context_gap", // something the AI keeps missing for lack of context (-> RESUME-ish)
  "harvest_candidate" // a reusable lesson worth carrying forward (-> HARVEST)
]);

// The default external model command. The prompt is delivered on STDIN to `claude -p`
// (headless / "print" mode): keeping the payload OFF argv avoids both shell-injection
// surface and OS arg-length limits on a large redacted transcript. `--model <cmd>`
// overrides this whole token list. Kept as an array (argv form) so the default never
// goes through a shell.
export const DEFAULT_MODEL_CMD = "claude -p";

// --- A. Payload assembly (redacted snippets only) ---------------------------

// Collect the already-redacted snippets the local dialogue scan surfaced, tagged with
// where each came from, so the model gets the SAME masked text the user already saw —
// never raw export lines. `dialogue` is the scanDialogueAndLogs() result (or null). We
// pull from BOTH signal lists (suspected completions + repeated corrections); each
// snippet was redacted by dialogue.js (redactSnippet) at extraction time. We DO NOT go
// back to the raw files here — the redacted snippet is the only thing that travels.
export function collectRedactedSnippets(dialogue) {
  const out = [];
  if (!dialogue || typeof dialogue !== "object") return out;
  if (Array.isArray(dialogue.suspectedFalseCompletions)) {
    for (const c of dialogue.suspectedFalseCompletions) {
      if (!c || typeof c.snippet !== "string" || c.snippet.length === 0) continue;
      out.push({
        kind: "completion_claim",
        source: c.source ?? null,
        line: c.line ?? null,
        // Defense in depth: redact AGAIN. The snippet is already redacted by
        // dialogue.js, but re-running redactSnippet is idempotent and guarantees that
        // even a future change upstream cannot let a raw fragment through here.
        text: redactSnippet(c.snippet)
      });
    }
  }
  if (Array.isArray(dialogue.repeatedCorrections)) {
    for (const corr of dialogue.repeatedCorrections) {
      if (!corr || typeof corr.snippet !== "string" || corr.snippet.length === 0) continue;
      out.push({
        kind: "repeated_correction",
        count: corr.count ?? null,
        text: redactSnippet(corr.snippet)
      });
    }
  }
  return out;
}

// The HONEST instruction block handed to the model. It does two jobs: (1) constrain the
// model to OUTPUT JSON ONLY in the candidate schema, and (2) bind it to the four red
// lines so the model cannot "help" by inventing a verified completion. The four lines
// are stated as hard rules the model must obey, mirroring the system's own honesty
// contract. Kept canonical English (this text goes to the model, not the user) — the
// user-facing strings are localized separately.
const HONESTY_DIRECTIVE = [
  "You are reviewing REDACTED fragments from a developer's AI-collaboration chat/logs.",
  "Your job: surface CANDIDATE signals only. You must obey these rules without exception:",
  "1. NEVER claim anything is completed or verified. A chat saying \"done\" is NOT done; treat every completion mention as an unverified CLAIM, never a fact.",
  "2. EVERYTHING you output is a PROPOSED candidate for a human to review — not a conclusion, not an action taken.",
  "3. \"Said done in chat\" does not equal real completion; only a recorded, independently re-checked result would, and you cannot see or assert that.",
  "4. You are a single model; your view is NOT an independent cross-family verification. Do not imply your read confirms anything.",
  "",
  "Output STRICT JSON ONLY (no prose, no markdown fences) of the form:",
  "{ \"candidates\": [ { \"kind\": <one of: false_completion | profile_candidate | context_gap | harvest_candidate>,",
  "  \"summary\": <short string>, \"confidence\": <\"low\"|\"medium\"|\"high\">, \"basis\": <short string: what in the fragments suggests this>,",
  "  \"sourceRefs\": [<short strings referencing the fragment(s)>] } ] }",
  "If you find nothing, output { \"candidates\": [] }. Do not output anything except this JSON object."
].join("\n");

// Build the EXACT prompt string that will be sent to the model (or printed by
// --dry-run-send). It is the honesty directive + the redacted snippets, serialized
// deterministically. The snippets are embedded as a JSON array of {kind,text,…} so the
// model sees structure but only ever the REDACTED text. The returned string is what
// assertPayloadRedacted re-checks and what travels on stdin — there is no second, raw
// version anywhere. `meta` (sources/snippetCount) is carried for the preview only and is
// NOT part of the prompt payload.
//
// CRITICAL: the `source` field is the on-disk path of the export the snippet came from
// (an absolute path under the user's home directory in the common case). That path is
// itself a sensitive ABSOLUTE LOCAL PATH — the SAME class redactSnippet masks and
// assertPayloadRedacted refuses to send. So we run the source path through redactSnippet
// too before embedding it. Without this, any user whose export lives under their home dir
// (the common case) would have EVERY real send aborted by assertPayloadRedacted (the raw
// home path trips the path detector), and the bare path would also be exfiltrated in the
// payload. Redacting it keeps the leak gate from firing on a legitimate send AND stops the
// path itself from travelling. (No literal home-dir prefix is written here; the release
// privacy scan flags real-looking local paths even inside comments.)
export function buildModelPrompt(snippets) {
  const safe = Array.isArray(snippets) ? snippets : [];
  const body = {
    instructions: HONESTY_DIRECTIVE,
    fragments: safe.map((s) => ({
      kind: s.kind,
      // Redact the source path (absolute local path = sensitive); fall back to nothing.
      ...(s.source ? { source: redactSnippet(String(s.source)) } : {}),
      ...(typeof s.line === "number" ? { line: s.line } : {}),
      ...(typeof s.count === "number" ? { count: s.count } : {}),
      text: s.text
    }))
  };
  // A human-readable directive header followed by the machine block keeps the model on
  // task while staying a single, fully-redacted string.
  return `${HONESTY_DIRECTIVE}\n\n--- REDACTED FRAGMENTS (JSON) ---\n${JSON.stringify(body.fragments, null, 2)}\n--- END FRAGMENTS ---\n`;
}

// --- B. Redaction assertion (the hard privacy gate) -------------------------
//
// The last line of defense before ANYTHING leaves the machine. Even though every
// snippet is already redacted, we re-scan the WHOLE assembled prompt for the sensitive
// SHAPES (the same classes dialogue.js masks: private keys, provider tokens, secret
// assignments, emails, absolute local paths) and THROW if any survive. This converts a
// hypothetical leak from "silently sent" into "send aborted, loudly". Used both before a
// real send AND inside --dry-run-send (so the audited payload is proven clean too).

// The detection shapes. These intentionally MIRROR dialogue.js's REDACTION_RULES /
// scripts/privacy-scan's alwaysForbidden so "what we mask" and "what we refuse to send"
// are the same idea — every shape dialogue.js's redactSnippet masks is also one this gate
// refuses to send (private keys incl. the multi-line body, provider tokens, the
// api-key/token/secret/password quoted assignment, password=/passwd=/pwd= unquoted values,
// emails, home-dir absolute paths, the /var //etc //opt //srv //usr system paths, and
// Windows drive paths). We detect the PLACEHOLDER-SAFE way: a redacted prompt contains
// "[redacted:*]" tokens (those are fine); we look for UNMASKED sensitive shapes. The
// home + system path segment names + the PEM marker are assembled from fragments (not
// literals) so this source file itself stays clean under the release privacy scan.
function buildLeakDetectors() {
  const HOME_SEGMENTS = ["Users", "home"];
  // System roots that also make an absolute local path (kept IN SYNC with dialogue.js's
  // buildLocalPathRules SYSTEM_ROOTS — what we mask there, we must refuse to send here).
  const SYSTEM_ROOTS = ["var", "etc", "opt", "srv", "usr"];
  const tail = "(?:/[^\\s`'\")]+)*";
  const winTail = "(?:\\\\[^\\s`'\")]+)*";
  const KEY = "PRIVATE KEY";
  const detectors = [
    // PEM private key: FULL block (header + base64 body) AND a lone header — mirrors the
    // dialogue.js full-block + header-fallback rules. A surviving key body must abort too.
    [new RegExp(`-----BEGIN (?:RSA |OPENSSH |EC |DSA )?${KEY}-----[\\s\\S]*?-----END (?:RSA |OPENSSH |EC |DSA )?${KEY}-----`, "g"), "private-key"],
    [new RegExp(`-----BEGIN (?:RSA |OPENSSH |EC |DSA )?${KEY}-----`, "g"), "private-key"],
    [/\bgithub_pat_[A-Za-z0-9_]{30,}/g, "token"],
    [/\bgh[pousr]_[A-Za-z0-9_]{20,}/g, "token"],
    [/\bxox[baprs]-[A-Za-z0-9-]{20,}/g, "token"],
    [/\bBearer\s+[A-Za-z0-9._~+/=-]{24,}/gi, "token"],
    [/sk-[A-Za-z0-9_-]{20,}/g, "secret-key"],
    [/AKIA[0-9A-Z]{16}/g, "aws-key"],
    [/AIza[0-9A-Za-z_-]{20,}/g, "api-key"],
    [/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["'][^"']{8,}["']/gi, "secret"],
    // password=/passwd=/pwd= with an unquoted value (mirrors the dialogue.js rule of the
    // same shape) — a clear-shape secret the quoted-only rule above misses.
    [/\b(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{4,}["']?/gi, "secret"],
    [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "email"]
  ];
  for (const seg of HOME_SEGMENTS) {
    detectors.push([new RegExp(`/${seg}/[^/\\s]+${tail}`, "g"), "path"]);
  }
  for (const root of SYSTEM_ROOTS) {
    detectors.push([new RegExp(`/${root}/[^/\\s]+${tail}`, "g"), "path"]);
  }
  // Windows: ANY drive-letter path with at least one child segment (mirrors dialogue.js).
  detectors.push([new RegExp(`[A-Za-z]:\\\\[^\\\\\\s]+${winTail}`, "g"), "path"]);
  return detectors;
}
const LEAK_DETECTORS = buildLeakDetectors();

// Scan `payload` for any unmasked sensitive class; return the list of class names found
// (empty = clean). The "[redacted:*]" placeholders themselves never match these shapes,
// so an already-redacted snippet reads clean. Pure.
export function findSensitiveLeaks(payload) {
  if (typeof payload !== "string" || payload.length === 0) return [];
  const found = new Set();
  for (const [regex, label] of LEAK_DETECTORS) {
    regex.lastIndex = 0;
    if (regex.test(payload)) found.add(label);
  }
  return [...found];
}

// THROW if the payload still contains any sensitive class — the hard gate that makes
// "redacted before send" an invariant, not a hope. Callers run this immediately before
// handing the payload to the model (and --dry-run-send runs it before printing), so an
// un-redacted payload aborts the send with a clear, do-not-ship message.
export function assertPayloadRedacted(payload) {
  const leaks = findSensitiveLeaks(payload);
  if (leaks.length > 0) {
    throw new Error(
      `Refusing to send: the payload still contains unredacted sensitive data (${leaks.join(", ")}). Nothing was sent.`
    );
  }
  return true;
}

// --- C. The model invocation (injectable; default = local claude over stdin) -

// The DEFAULT invoker: spawn the model command, hand the prompt on STDIN (not argv), and
// return { ok, stdout, stderr, code, error }. NEVER throws — any spawn failure (binary
// missing / non-zero exit / timeout) is reported as ok:false so the caller degrades to
// local. The command is parsed into argv and run WITHOUT a shell (shell:false), so even a
// user-supplied `--model` cannot inject shell metacharacters, and the redacted prompt on
// stdin is never interpolated into a command line. `cmd` is the resolved command (default
// DEFAULT_MODEL_CMD or the user's --model value).
function defaultInvoke(cmd, payload, { timeoutMs = 60000 } = {}) {
  const tokens = String(cmd).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { ok: false, error: "empty model command", stdout: "", stderr: "", code: null };
  }
  const [bin, ...rest] = tokens;
  let res;
  try {
    res = spawnSync(bin, rest, {
      input: payload, // <-- the prompt travels on STDIN, never on argv
      encoding: "utf8",
      timeout: timeoutMs,
      shell: false, // no shell: the user's --model tokens cannot inject shell syntax
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error), stdout: "", stderr: "", code: null };
  }
  // spawnSync reports a missing binary / timeout via res.error (e.g. ENOENT / ETIMEDOUT).
  if (res.error) {
    const code = res.error.code || (res.signal ? `signal:${res.signal}` : "spawn-error");
    return { ok: false, error: `${code}: ${res.error.message || "model invocation failed"}`, stdout: res.stdout || "", stderr: res.stderr || "", code: res.status ?? null };
  }
  if (res.status !== 0) {
    return { ok: false, error: `model exited with code ${res.status}`, stdout: res.stdout || "", stderr: res.stderr || "", code: res.status };
  }
  return { ok: true, stdout: res.stdout || "", stderr: res.stderr || "", code: 0, error: null };
}

// Run the model with the given (already-assembled, already-asserted) payload. `invoke`
// is the injection point: tests pass a stub that returns a fixed { ok, stdout } and the
// real model is NEVER spawned. Production passes nothing, so defaultInvoke shells out to
// the resolved command. This function itself does not assert redaction (the caller does,
// right before calling) — its sole job is "call the invoker, normalize the result".
export function runModel(payload, { invoke = defaultInvoke, cmd = DEFAULT_MODEL_CMD, timeoutMs = 60000 } = {}) {
  if (typeof payload !== "string" || payload.length === 0) {
    return { ok: false, error: "empty payload", stdout: "", stderr: "", code: null };
  }
  try {
    const result = invoke(cmd, payload, { timeoutMs });
    // Normalize: an invoke that forgets a field still yields a well-formed result.
    return {
      ok: result && result.ok === true,
      stdout: result && typeof result.stdout === "string" ? result.stdout : "",
      stderr: result && typeof result.stderr === "string" ? result.stderr : "",
      code: result ? result.code ?? null : null,
      error: result && result.ok === true ? null : (result && result.error) || "model invocation failed"
    };
  } catch (error) {
    // An injected invoke that THROWS must still degrade gracefully (never crash bootstrap).
    return { ok: false, error: error && error.message ? error.message : String(error), stdout: "", stderr: "", code: null };
  }
}

// --- D. Response parsing (robust; unparsed => discarded) --------------------

// Extract the first balanced top-level JSON object from a model's stdout. Models often
// wrap JSON in prose or ```json fences despite instructions; we tolerate that by finding
// the first '{' and scanning to its matching '}' (string-aware, so a brace inside a
// string literal does not fool it). Returns the substring or null. Pure.
function extractJsonObject(text) {
  if (typeof text !== "string") return null;
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // unbalanced => treat as unparseable
}

// Parse the model stdout into a list of NORMALIZED, LOW-TRUST candidates. The contract
// (red line #5): a parse failure OR an unexpected shape returns { ok:false, candidates:[],
// reason } — the caller then warns + degrades to local; an unparsed blob is NEVER turned
// into a candidate. On success, EVERY candidate is forcibly stamped:
//   confidence: "low"   (LLM is the least-trusted source — we OVERRIDE whatever the model
//                        said its confidence was; it does not get to self-promote)
//   proposed:   true    (nothing is a conclusion)
//   source:     "model" (so a renderer/test can keep it visually + structurally apart)
//   displayedAsDone: false  (the load-bearing honesty assertion, carried explicitly)
// A candidate whose `kind` is not in MODEL_CANDIDATE_KINDS is DROPPED (an unaudited card
// type never enters). The result also reports how many raw candidates were dropped.
export function parseModelResponse(stdout) {
  const fail = (reason) => ({ ok: false, candidates: [], dropped: 0, reason });
  if (typeof stdout !== "string" || stdout.trim().length === 0) {
    return fail("empty model output");
  }
  const jsonText = extractJsonObject(stdout);
  if (!jsonText) return fail("no JSON object found in model output");
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return fail("model output was not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.candidates)) {
    return fail("model JSON did not contain a candidates array");
  }
  const candidates = [];
  let dropped = 0;
  for (const raw of parsed.candidates) {
    if (!raw || typeof raw !== "object") { dropped += 1; continue; }
    if (!MODEL_CANDIDATE_KINDS.includes(raw.kind)) { dropped += 1; continue; }
    const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
    if (summary.length === 0) { dropped += 1; continue; }
    candidates.push({
      kind: raw.kind,
      summary,
      basis: typeof raw.basis === "string" ? raw.basis.trim() : "",
      sourceRefs: Array.isArray(raw.sourceRefs)
        ? raw.sourceRefs.filter((r) => typeof r === "string").slice(0, 10)
        : [],
      // FORCED honesty stamps — the model does not get to set these.
      confidence: "low", // LLM source is the lowest tier, ALWAYS — never the model's claim
      proposed: true, // never a conclusion
      source: "model", // kept apart from ledger + local-dialogue findings
      displayedAsDone: false // never rendered as done/verified
    });
  }
  return { ok: true, candidates, dropped, reason: null };
}

// --- E. The orchestrated send (consent already given upstream) --------------

// Build the preview the consent gate shows: WHAT will be sent, before sending. It names
// the sources, the snippet count, the explicit "every snippet is redacted" promise, and
// the model command. The CLI prints this (localized) and then asks to confirm. Returns a
// plain object so the CLI can render text OR --json. No side effects.
export function buildSendPreview({ dialogue, snippets, modelCmd }) {
  const sources = dialogue && Array.isArray(dialogue.sources) ? dialogue.sources.map((s) => s.path) : [];
  return {
    sources,
    snippetCount: Array.isArray(snippets) ? snippets.length : 0,
    allRedacted: true, // every snippet passed redactSnippet (asserted again before send)
    model: modelCmd || DEFAULT_MODEL_CMD
  };
}

// The full external pass, AFTER consent has been confirmed by the CLI. Steps, in order,
// each upholding a red line:
//   1. Assemble the prompt from REDACTED snippets only (collectRedactedSnippets feeds it).
//   2. assertPayloadRedacted(payload) — THROW (caught here -> degrade) if anything leaks.
//   3. runModel(payload, { invoke, cmd }) — the injectable call; tests stub `invoke`.
//   4. On call failure -> { ok:false, degraded:true, reason } (caller shows error + local).
//   5. parseModelResponse(stdout) — unparsed/odd shape -> degrade; never a junk candidate.
//   6. Return the LOW-confidence / proposed / source:"model" candidates (or degrade).
// This function NEVER writes anything and NEVER throws to the caller (a thrown redaction
// assertion is caught and turned into a graceful degrade with the reason surfaced).
export function runExternalModelPass({
  snippets,
  modelCmd = DEFAULT_MODEL_CMD,
  invoke = defaultInvoke,
  timeoutMs = 60000
} = {}) {
  const payload = buildModelPrompt(snippets);
  // Hard privacy gate. A leak aborts the SEND (we never reach runModel) and degrades.
  try {
    assertPayloadRedacted(payload);
  } catch (error) {
    return { ok: false, degraded: true, sent: false, reason: error.message, candidates: [], payload };
  }
  const call = runModel(payload, { invoke, cmd: modelCmd, timeoutMs });
  if (!call.ok) {
    // Graceful degrade: the model was unreachable / errored / timed out. The caller
    // keeps the local result and shows this reason; nothing is fabricated.
    return { ok: false, degraded: true, sent: true, reason: call.error || "model call failed", candidates: [], payload };
  }
  const parsed = parseModelResponse(call.stdout);
  if (!parsed.ok) {
    // The model answered but not in the contract shape -> discard, degrade, warn.
    return { ok: false, degraded: true, sent: true, reason: parsed.reason || "unparseable model output", candidates: [], payload };
  }
  return {
    ok: true,
    degraded: false,
    sent: true,
    reason: null,
    candidates: parsed.candidates, // each: low / proposed / source:"model" / displayedAsDone:false
    dropped: parsed.dropped,
    payload
  };
}
