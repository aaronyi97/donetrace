// === bootstrap (first-experience value report) ==============================
//
// `bootstrap` is the first-experience entry point. The problem it solves: a new
// user who just ran `init` sees a 200-file framework and does NOT know what it is
// for — the value is never proven on their OWN work. bootstrap reads what the
// user actually has locally (their repo, their git activity, their .aict ledger,
// their AI instruction files) and turns it into ONE plain "AI collaboration
// baseline report": five cards — PROFILE CLUES (setup signals to confirm),
// VERIFY (which "done"s cannot be trusted yet), RESUME (where you are / what is
// missing), ROLES (high-risk keywords mapped to helper roles), HARVEST (what
// you can carry forward).
//
// HONESTY IS THE WHOLE POINT (four red lines, enforced structurally here):
//   1. Deterministic only. This module reads files + runs read-only git; it calls
//      NO external model, makes NO guess, and sends NOTHING anywhere.
//   2. A completion claim is NEVER shown as verified/done unless the ledger's OWN
//      honest functions say it is. Every guard level / family marker is RE-COMPUTED
//      by the shared ledger.js functions (computeReceiptGuardLevel /
//      buildHandoffModel / summarizeTasks) — this file rewrites NONE of that logic,
//      so bootstrap can never look cleaner than `status` / `check` / `handoff`.
//   3. HARVEST candidates are PROPOSED. bootstrap (report-only) writes NOTHING to
//      a profile or any long-term state; it only lists structural facts.
//   4. The shipped synthetic seed is never counted as the user's own work
//      (isSeedRow excludes it), so an empty workspace honestly says "no data yet"
//      instead of borrowing the example's numbers.
//
// This is the report-only version: scan + five cards + a consent preview + init
// tie-in. It now ALSO does the LOCAL HALF of semantic scanning (dialogue.js): when —
// and ONLY when — the user EXPLICITLY hands over a local chat/log export
// (`--dialogue` / `--logs`), bootstrap reads it and extracts DETERMINISTIC signals
// (a word-table completion claim cross-referenced against the ledger; a repeated
// correction) to enrich the five cards. That local half stays inside red line #1:
// no model call, no guess, no network — a "done" found in a chat becomes a VERIFY
// CANDIDATE labelled "claimed in dialogue · not verified", never a "done". The
// EXTERNAL-model half (`--send-to-model`), a save/write-back flow, and a GUI are
// still deliberately out of scope (a later sub-batch). See the TODO markers below.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  summarizeTasks,
  buildHandoffModel,
  isSeedRow,
  familyHonestyMarker
} from "./ledger.js";
import { detectTools } from "./adapters.js";
import { t } from "./i18n.js";

// --- A. Local structure scan (read-only, zero network) ----------------------

// Read a JSON file, returning null on any problem (missing / unparseable). Never
// throws — a scan must degrade gracefully, not abort the whole report.
function readJsonSafe(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// True when a path exists and is a directory (used to confirm a .git or .aict).
function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Find the nearest ancestor directory (including `start`) that contains a `.git`,
// i.e. the git working-tree root. Returns null when none is found (not a repo).
// Pure filesystem walk — no git invocation, so it works even where git is absent.
function findGitRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

// The recognized AI instruction-file markers, surfaced in the scan so the report
// can say "your repo already talks to <tools>". REUSES the adapters detect logic
// (detectTools) so bootstrap and `adapters install` agree on what counts as an AI
// instruction file — single source, no second list to drift.
function scanAiInstructionFiles(root) {
  const detected = detectTools(root); // e.g. ["claude", "codex"]
  // A few well-known top-level instruction files, reported individually so the
  // user sees the concrete filename. detectTools already drives the load-bearing
  // "which tools" answer; this is only for a friendly per-file presence list.
  const KNOWN_FILES = ["CLAUDE.md", "AGENTS.md", "README.md", ".cursorrules", ".clinerules"];
  const files = KNOWN_FILES.filter((name) => existsSync(path.join(root, name)));
  return { detectedTools: detected, instructionFiles: files };
}

// Read package.json scripts + a best-effort "test entry" (the npm `test` script,
// when present). Returns { present, scripts: string[], testScript: string|null }.
function scanPackageJson(root) {
  const pkgPath = path.join(root, "package.json");
  if (!existsSync(pkgPath)) return { present: false, scripts: [], testScript: null };
  const pkg = readJsonSafe(pkgPath);
  if (!pkg || typeof pkg !== "object") return { present: false, scripts: [], testScript: null };
  const scriptsObj = pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
  const scripts = Object.keys(scriptsObj);
  const testScript = typeof scriptsObj.test === "string" ? scriptsObj.test : null;
  return { present: true, scripts, testScript };
}

// List up to `limit` of the most-recently-modified files in the repo root (one
// level only — a shallow, fast, deterministic-ish signal of "what you touched
// last"), skipping noise dirs. mtime is a heuristic, surfaced as such. Read-only.
function scanRecentlyModified(root, limit = 8) {
  const SKIP = new Set([".git", "node_modules", ".aict"]);
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const rows = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".cursorrules" && entry.name !== ".clinerules") {
      // skip dotfiles/dirs by default (they are rarely the "what I am working on"
      // signal), except the two instruction dotfiles we already care about.
      if (SKIP.has(entry.name)) continue;
    }
    if (SKIP.has(entry.name)) continue;
    if (!entry.isFile()) continue;
    const full = path.join(root, entry.name);
    try {
      const st = statSync(full);
      rows.push({ name: entry.name, mtimeMs: st.mtimeMs });
    } catch {
      /* unreadable: skip */
    }
  }
  rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return rows.slice(0, limit).map((r) => r.name);
}

// Parse the porcelain-ish output of `git log --name-only -n N` (passed in by the
// CLI, which owns the spawn) into a count of how many of the last N commits each
// file appeared in. A file touched in MANY recent commits is a candidate "kept
// re-fixing the same thing" signal — a possible "said done but still patching it"
// tell, which is exactly the kind of un-trustworthy completion bootstrap exists to
// surface. Pure string parsing here; the git call is the CLI's job (so this stays
// testable without a real repo).
//
// `logText` is the raw stdout. Lines that look like a path (no leading "commit ",
// not blank, not an author/date header) are counted. We deliberately count
// DISTINCT commits per file, not raw line repeats.
export function parseRepeatedlyTouchedFiles(logText, { minCommits = 3, limit = 5 } = {}) {
  if (typeof logText !== "string" || logText.trim().length === 0) return [];
  // Split into per-commit blocks on the "commit <sha>" boundary that
  // `git log --name-only` prints. The first block may be empty.
  const blocks = logText.split(/^commit [0-9a-f]+/m);
  const counts = new Map();
  for (const block of blocks) {
    const filesInCommit = new Set();
    for (const rawLine of block.split("\n")) {
      const line = rawLine.trim();
      if (line.length === 0) continue;
      // Skip the standard headers git emits inside a commit block.
      if (/^Author:/.test(line) || /^Date:/.test(line) || /^Merge:/.test(line)) continue;
      // A commit message body is indented by 4 spaces in `git log`; a changed path
      // is NOT indented (name-only prints bare paths). Use the RAW line's leading
      // whitespace to tell them apart, and require a path-ish shape.
      if (/^\s/.test(rawLine)) continue; // indented => message text, not a path
      if (!/[\w./-]/.test(line)) continue;
      if (line.includes(" ") && !line.includes("/") && !line.includes(".")) continue;
      filesInCommit.add(line);
    }
    for (const file of filesInCommit) {
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= minCommits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([file, commits]) => ({ file, commits }));
}

// Assemble the full structural scan from the pieces the CLI gathers. `git` carries
// the read-only git output the CLI already captured (log/diff text + whether git
// ran), so this module never spawns a process itself.
//
//   workspaceRoot: the .aict workspace dir (…/.aict)
//   repoRoot:      the project root the user is in (holds package.json, the repo)
//   git:           { available, logText, diffStatText } captured by the CLI
//
// Returns a plain, serializable scan object (no I/O beyond reads done here).
export function scanLocalStructure({ workspaceRoot, repoRoot, git = {} }) {
  const root = path.resolve(repoRoot);
  const gitRoot = findGitRoot(root);
  const pkg = scanPackageJson(root);
  const ai = scanAiInstructionFiles(root);
  const recentlyModified = scanRecentlyModified(root);
  const repeatedlyTouched = parseRepeatedlyTouchedFiles(typeof git.logText === "string" ? git.logText : "");
  const diffStat = typeof git.diffStatText === "string" ? git.diffStatText.trim() : "";

  return {
    repoRoot: root,
    workspaceRoot: workspaceRoot ? path.resolve(workspaceRoot) : null,
    git: {
      available: git.available === true,
      isRepo: gitRoot !== null,
      root: gitRoot,
      // The presence of an uncommitted diff is a "work in flight" signal for RESUME.
      hasUncommittedChanges: diffStat.length > 0,
      diffStat,
      repeatedlyTouched
    },
    packageJson: pkg,
    ai,
    recentlyModified
  };
}

// --- B. The trust-bearing cards (the core value), built from the HONEST ledger functions ---
//
// Everything trust-bearing below is DERIVED by the shared ledger.js functions, not
// recomputed here: buildHandoffModel does the done/unverified bucketing with the
// recomputed guard level + familyUnverified marker; summarizeTasks gives the
// per-task "author-marked, unverified" flag. The actual per-receipt level math
// (computeReceiptGuardLevel) runs INSIDE those ledger functions — bootstrap calls
// them and reads their output; it never calls the level computer itself. bootstrap
// only SELECTS and LABELS — it owns no level math.

// A short, stable reason code + plain sentence for each kind of un-trustworthy
// completion claim VERIFY surfaces. The phrasing avoids jargon on the first read.
const VERIFY_REASON = {
  pending_receipt: "a review exists but is still pending — not accepted",
  pass_with_risk_unaccepted: "passed only with a noted risk that no one has signed off on yet",
  self_declared_cross_family: "self-declared cross-family review — the tool cannot verify the other model actually checked it",
  author_marked_done: "marked done by the author with no accepted review behind it"
};

// Build the VERIFY card: the completion claims that CANNOT be trusted as done yet.
// Sources (all recomputed honestly by buildHandoffModel / summarizeTasks):
//   - every task in the handoff model's `unverified` bucket (pending pass, a
//     pass_with_risk still pending, OR an accepted-but-self-declared-cross-family
//     receipt — buildHandoffModel routes all of these here using the RE-COMPUTED
//     level, never a stored flag);
//   - any task flagged authorMarkedDoneUnverified (status done, no done-eligible
//     accepted receipt — the note-only "done");
//   - a self-declared cross-family marker is called out explicitly even when the
//     receipt was locally accepted, so it is shown "unverified", never "done".
// Each item carries the task id/title, the offending receipt (with its RE-COMPUTED
// level + verdict + status), a reason code, and an explicit `displayedAsDone:false`
// so a consumer can assert bootstrap never renders these as completed.
function buildVerifyCard(handoff, perTask, dialogue = null) {
  const items = [];
  const seen = new Set(); // de-dupe (taskId, receiptId, reason)

  const pushItem = (task, receiptView, reasonCode) => {
    const key = `${task.id}|${receiptView ? receiptView.id : "-"}|${reasonCode}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      // `source: "ledger"` marks the trust-bearing items that come from the user's
      // OWN recorded work (the receipts/runs the tool itself wrote). Dialogue-sourced
      // items below carry `source: "dialogue"` so a renderer/consumer can keep the two
      // visually + structurally SEPARATE (red line: a chat claim is never mixed into
      // the ledger facts as if it were verified).
      source: "ledger",
      taskId: task.id,
      title: task.title,
      taskStatus: task.taskStatus ?? task.status,
      // The receipt is described by its RE-COMPUTED level (buildHandoffModel /
      // summarizeTasks already recompute it); we copy those fields, never a stored
      // guardLevel. receiptView may be null for a note-only done with no receipt.
      receipt: receiptView
        ? {
            id: receiptView.id,
            verdict: receiptView.verdict,
            guardLevel: receiptView.guardLevel, // RE-COMPUTED upstream
            status: receiptView.status,
            familyUnverified: receiptView.familyUnverified === true
          }
        : null,
      reason: reasonCode,
      reasonText: VERIFY_REASON[reasonCode] ?? reasonCode,
      // The load-bearing honesty assertion: bootstrap NEVER displays a VERIFY item
      // as done/verified. Carried explicitly so a test (and a renderer) can rely on it.
      displayedAsDone: false,
      // The self-declared-cross-family marker text, when applicable, surfaced
      // verbatim from the shared helper so the wording matches the rest of the tool.
      familyMarker: receiptView && receiptView.familyUnverified === true
        ? familyHonestyMarker(true)
        : null
    });
  };

  // 1) Everything the handoff model already bucketed as Unverified. Each such task
  //    has >=1 receipt that is NOT done-eligible. We classify the strongest reason
  //    per receipt from the RE-COMPUTED view buildHandoffModel handed us.
  for (const entry of handoff.unverified) {
    const receipts = entry.receipts ?? [];
    if (receipts.length === 0) {
      // Reviewed-but-not-accepted with no receipt view should not happen (the
      // bucket implies a receipt), but guard anyway: mark the task itself.
      pushItem(entry, null, "author_marked_done");
      continue;
    }
    for (const r of receipts) {
      if (r.familyUnverified === true) {
        pushItem(entry, r, "self_declared_cross_family");
      } else if (r.verdict === "pass_with_risk" && r.status !== "accepted") {
        pushItem(entry, r, "pass_with_risk_unaccepted");
      } else if (r.status === "pending") {
        pushItem(entry, r, "pending_receipt");
      } else if (r.status === "rejected") {
        // a rejected receipt is also "not done"; surface it as pending-style review
        pushItem(entry, r, "pending_receipt");
      }
    }
  }

  // 2) A task in ANY bucket whose only/loudest problem is an accepted-but-self-
  //    declared-cross-family receipt: buildHandoffModel routes a task whose ONLY
  //    acceptances are familyUnverified into `unverified` (handled above), but a
  //    task that is Done on a clean receipt AND also carries a separate self-declared
  //    cross-family receipt keeps a riskNote — surface that receipt too, so a
  //    cross-family claim is never silently trusted. We scan done/blocked entries.
  for (const entry of [...handoff.done, ...handoff.blocked, ...handoff.pending]) {
    for (const r of entry.receipts ?? []) {
      if (r.familyUnverified === true) {
        pushItem(entry, r, "self_declared_cross_family");
      }
    }
  }

  // 3) Note-only / author-marked done with no done-eligible accepted receipt — the
  //    thin "done". summarizeTasks recomputed authorMarkedDoneUnverified for us.
  for (const t of perTask) {
    if (t.isSeed) continue; // never the shipped example
    if (t.authorMarkedDoneUnverified) {
      // Use the strongest receipt view if there is one; else flag the bare task.
      const rv = t.receipt
        ? {
            id: t.receipt.id,
            verdict: t.receipt.verdict,
            guardLevel: t.receipt.guardLevel, // RE-COMPUTED in summarizeTasks
            status: t.receipt.status,
            familyUnverified: t.receipt.familyUnverified === true
          }
        : null;
      pushItem(
        { id: t.id, title: t.title, taskStatus: t.statusDisplay ?? t.status },
        rv,
        "author_marked_done"
      );
    }
  }

  // 4) DIALOGUE-SOURCED completion claims (red line #2 + #4-visual-separation). Each
  //    is a deterministic word-table match from a LOCAL export the user handed over,
  //    cross-referenced against the ledger and found UNBACKED (no accepted clean
  //    receipt, no executed run). It is surfaced as a VERIFY FINDING with the exact
  //    wording "claimed in dialogue · not verified" and displayedAsDone:false — it is
  //    NEVER a task status, NEVER rendered as done, and is tagged source:"dialogue" so
  //    it is shown SEPARATE from the ledger facts above. Snippets are pre-redacted by
  //    dialogue.js (redactSnippet) before they ever reach here.
  if (dialogue && Array.isArray(dialogue.suspectedFalseCompletions)) {
    for (const claim of dialogue.suspectedFalseCompletions) {
      items.push({
        source: "dialogue",
        // The stable, non-softenable label for a chat-sourced, unbacked completion
        // claim. Carried verbatim so a test/renderer can assert it is never "done".
        label: "claimed in dialogue · not verified",
        sourcePath: claim.source,
        line: claim.line,
        subject: claim.subject,
        snippet: claim.snippet, // already redacted + clamped by dialogue.js
        confidence: claim.confidence ?? "low",
        // The load-bearing honesty assertions, identical to the ledger items'.
        displayedAsDone: false,
        backed: false
      });
    }
  }

  return items;
}

// Build the RESUME card: where the user is and what is missing to pick back up.
//   - activeTasks: open/partial tasks (NOT seed) — work in progress.
//   - missingHandoff: true when there is in-progress/unverified work but NO handoff
//     draft has been generated (the next session would start from zero).
//   - gitDrift: the repeatedly-touched files (a "still churning the same files"
//     signal) + whether there are uncommitted changes.
function buildResumeCard(handoff, perTask, scan, handoffDraftCount) {
  const activeTasks = perTask
    .filter((t) => !t.isSeed && (t.status === "open" || t.status === "partial"))
    .map((t) => ({ id: t.id, title: t.title, status: t.status }));

  const hasInFlightWork =
    activeTasks.length > 0 ||
    handoff.unverified.length > 0 ||
    handoff.pending.length > 0 ||
    scan.git.hasUncommittedChanges;

  return {
    activeTasks,
    inProgressCount: handoff.counts.pending + handoff.counts.unverified,
    missingHandoff: hasInFlightWork && handoffDraftCount === 0,
    handoffDraftCount,
    gitDrift: {
      repeatedlyTouched: scan.git.repeatedlyTouched,
      hasUncommittedChanges: scan.git.hasUncommittedChanges
    }
  };
}

// Build the HARVEST card: what is safe to carry forward — DETERMINISTIC facts only.
//   - confirmedLearnings: the confirmed/edited learning rows buildHandoffModel
//     already collected (proposed/dropped excluded). These are facts the user
//     themselves kept, so they are reported as-is.
//   - candidates: STRUCTURAL, proposed-only observations (v1 lists NO LLM guess) —
//     e.g. "N confirmed learnings ready to carry forward". Each is marked
//     proposed:true; bootstrap (report-only) writes none of them anywhere.
function buildHarvestCard(handoff, learning = [], dialogue = null) {
  const confirmedLearnings = (handoff.learnings ?? []).map((l) => ({
    id: l.id,
    type: l.type,
    content: l.content,
    status: l.status
  }));

  // Proposed (not-yet-kept) lessons of the user's OWN — the rows a "learning confirm
  // <id>" next step can actually act on. The shipped example seed (l0) is excluded so
  // the suggestion never pushes the user to confirm the demo lesson. Carried on the
  // card model (not the rendered body) so the Next step can name a real id.
  const proposedLearnings = (Array.isArray(learning) ? learning : [])
    .filter((l) => l && l.status === "proposed" && !isSeedRow(l, "learning"))
    .map((l) => ({ id: l.id, type: l.type, content: l.content, status: l.status }));

  const candidates = [];
  if (confirmedLearnings.length > 0) {
    candidates.push({
      kind: "confirmed_learnings_ready",
      proposed: true,
      // `count` is carried so the renderer can build the localized detail; `detail`
      // stays canonical English in the model (a stable --json data contract).
      count: confirmedLearnings.length,
      detail: `${confirmedLearnings.length} confirmed learning${confirmedLearnings.length === 1 ? "" : "s"} you can carry into your next task`
    });
  }
  const doneCount = handoff.counts.done;
  if (doneCount > 0) {
    candidates.push({
      kind: "verified_done_tasks",
      proposed: true,
      count: doneCount,
      detail: `${doneCount} task${doneCount === 1 ? "" : "s"} reached a verified (accepted) result — a pattern worth reusing`
    });
  }

  // DIALOGUE-SOURCED profile candidates (red line #3 + #4-visual-separation). A
  // correction the user repeated >= 2 times in their LOCAL export is a deterministic
  // signal of a standing preference the AI keeps missing — a HARVEST *profile*
  // candidate. It is PROPOSED only (proposed:true): this module writes NOTHING to a
  // profile or ledger; confirming it is the user's explicit `learning confirm` step
  // later. Tagged source:"dialogue" + type:"profile" so it is shown SEPARATE from the
  // user's own confirmed learnings, and labelled as coming from the chat, unverified.
  const dialogueCandidates = [];
  if (dialogue && Array.isArray(dialogue.repeatedCorrections)) {
    for (const corr of dialogue.repeatedCorrections) {
      dialogueCandidates.push({
        kind: "repeated_correction_profile",
        source: "dialogue",
        type: "profile",
        proposed: true,
        count: corr.count,
        normalized: corr.normalized,
        snippet: corr.snippet, // already redacted + clamped by dialogue.js
        confidence: corr.confidence ?? "low",
        detail: `a correction you repeated ${corr.count}× in your chat — a standing preference worth recording`
      });
    }
  }

  return { confirmedLearnings, proposedLearnings, candidates, dialogueCandidates };
}

// --- B2. Profile-clues card (DETERMINISTIC signals only, NO semantic verdict) --
//
// The fourth card. Its ONLY job is to list CONCRETE, machine-observable facts the
// user can recognise — never a personality read. bootstrap is a report-only engine
// with no model and no right to GUESS a work style: it may say "you have Claude +
// Cursor configured here" (a fact the user can confirm by looking) but NOT "you
// prefer X" (a semantic judgment). The footer makes the contract explicit: these
// are CLUES the user's OWN ai will turn into a profile in first-run, not a
// conclusion bootstrap reached. Pure read over the scan; writes nothing, calls
// nothing.
//
// Signals (all from the existing scan, all deterministic):
//   - detectedTools: the AI tools whose instruction files are present (reused from
//     scanAiInstructionFiles -> detectTools). >= 2 is flagged as a cross-tool
//     signal — a FACT (two tools are configured), not a claim about how they work.
//   - fileTypes: the extension distribution of the recently-modified files (a count
//     per extension). "you touched .ts and .sql files lately" is observable; what
//     it MEANS is for the user's ai, not bootstrap.
//   - hasTestScript: whether package.json has a `test` script. We label it the
//     plain fact "has a test script" — a signal the user can verify, never
//     "you value testing" stated as settled truth.
// Each datum carries the raw fact so a --json consumer (and a test) can assert the
// card contains evidence, not interpretation.
export function buildProfileCard(scan) {
  const ai = scan && scan.ai ? scan.ai : { detectedTools: [], instructionFiles: [] };
  const detectedTools = Array.isArray(ai.detectedTools) ? ai.detectedTools : [];

  // Extension distribution of the recently-modified files. A file with no extension
  // (e.g. "Makefile") is bucketed under "(no ext)" so the count stays honest. The
  // list is sorted by count desc, then name, for a stable display + --json contract.
  const recent = Array.isArray(scan && scan.recentlyModified) ? scan.recentlyModified : [];
  const extCounts = new Map();
  for (const name of recent) {
    if (typeof name !== "string" || name.length === 0) continue;
    const ext = path.extname(name); // ".ts", "", ".sql", …
    const key = ext.length > 0 ? ext : "(no ext)";
    extCounts.set(key, (extCounts.get(key) ?? 0) + 1);
  }
  const fileTypes = [...extCounts.entries()]
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count || a.ext.localeCompare(b.ext));

  const hasTestScript =
    Boolean(scan && scan.packageJson && scan.packageJson.present) &&
    typeof scan.packageJson.testScript === "string" &&
    scan.packageJson.testScript.length > 0;

  return {
    // The detected tools, and whether there is more than one (a cross-tool FACT).
    detectedTools,
    multiTool: detectedTools.length >= 2,
    fileTypes,
    hasTestScript,
    // The load-bearing honesty assertion, mirrored on every card item a consumer
    // might mistake for a verdict: this card draws NO semantic conclusion. Carried
    // so a test can assert bootstrap never crosses the report-only line here.
    semanticConclusion: false
  };
}

// --- B3. Roles-suggestion card (DETERMINISTIC keyword match -> existing roles) --
//
// The fifth card. It scans the user's task titles + recently-touched file PATHS for
// a fixed list of high-risk keywords and, when one matches, suggests an EXISTING
// open-source role package to bring in. The honesty contract is the same as the
// profile card: it states a FACT ("the title 'payment callback' contains the word
// 'payment'") and a deterministic mapping to a role — it does NOT decide the work
// IS risky, only that a known high-risk WORD appears. The user's ai makes the call;
// the card's wording says these are clues to confirm. Pure read; no write, no model.
//
// The keyword table is grouped by RISK THEME; each theme maps to one or more role
// suggestions. The roles named here are all packages that already ship in the
// open-source workspace (.aict/skills/ + .aict/mechanisms/): red-team, dual-guard,
// scout-review-controller — verified present, never invented.
const ROLE_RISK_GROUPS = [
  {
    theme: "auth", // authentication / credentials
    keywords: ["auth", "login", "password", "credential", "token", "secret"],
    roles: ["red-team", "dual-guard"]
  },
  {
    theme: "money", // payments / billing
    keywords: ["payment", "pay", "billing", "invoice"],
    roles: ["red-team", "dual-guard"]
  },
  {
    theme: "security", // explicit security / crypto
    keywords: ["security", "crypto"],
    roles: ["scout-review-controller", "red-team"]
  },
  {
    theme: "deploy", // deployment / data layer
    keywords: ["deploy", "release", "migration", "database", "schema"],
    roles: ["scout-review-controller", "red-team"]
  }
];

// Find the FIRST keyword (lowercase substring) from `keywords` that appears in
// `haystack` (already lowercased). Returns the matched keyword or null. Substring
// match is deliberate so "authentication"/"reauth" trip "auth"; it is a CLUE the
// user's ai confirms, so a slightly broad match is acceptable (and honest about
// being a word-match, never a verdict).
function firstKeywordHit(haystack, keywords) {
  for (const kw of keywords) {
    if (haystack.includes(kw)) return kw;
  }
  return null;
}

// Build the roles card. `tasks` and `scan` come from the same inputs the other
// cards use. Seed tasks are excluded (isSeedRow) so the shipped example never
// manufactures a role suggestion. Returns:
//   - hits: up to TOP 3 high-risk items, each { subject, keyword, theme, roles,
//     source } — `subject` is the task title or file path that matched, so the card
//     can show the exact evidence ("task 'X' matched keyword 'Y' -> suggest Z").
//   - roles: the de-duplicated union of suggested role ids across the hits (for the
//     Next-step + a --json consumer), each tagged with the plain-language simile key.
//   - hasHighRisk: whether anything matched at all (drives the honest no-match line).
// The card NEVER says the work is risky; it says a high-risk WORD appears and maps
// it to a role to consider — a deterministic fact + a fixed mapping, no judgment.
export function buildRolesCard(tasks, scan) {
  const taskList = Array.isArray(tasks) ? tasks : [];
  const recent = Array.isArray(scan && scan.recentlyModified) ? scan.recentlyModified : [];

  // The candidate surfaces to scan: every NON-seed task title (source "task") and
  // every recently-modified file path (source "file"). Each carries the raw subject
  // so the matched evidence is shown verbatim, never paraphrased into a conclusion.
  const subjects = [];
  for (const task of taskList) {
    if (!task || typeof task !== "object") continue;
    if (isSeedRow(task, "tasks")) continue; // never the shipped example
    const title = typeof task.title === "string" ? task.title : "";
    if (title.length === 0) continue;
    subjects.push({ source: "task", subject: title });
  }
  for (const name of recent) {
    if (typeof name === "string" && name.length > 0) {
      subjects.push({ source: "file", subject: name });
    }
  }

  // Match each subject against every risk group; collect the hits. We keep the FIRST
  // group that matches a given subject (a subject rarely belongs to two themes, and
  // showing one clear reason per subject is less noisy than every partial match).
  const hits = [];
  for (const { subject, source } of subjects) {
    const haystack = subject.toLowerCase();
    for (const group of ROLE_RISK_GROUPS) {
      const keyword = firstKeywordHit(haystack, group.keywords);
      if (keyword) {
        hits.push({ subject, source, keyword, theme: group.theme, roles: group.roles });
        break; // one theme per subject
      }
    }
  }

  // Cap at TOP 3 high-risk items so the card does not carpet-bomb the user (the brief:
  // "no repeated bombardment; at most top 3"). Order is scan order (tasks first, then
  // files), which is stable and deterministic.
  const topHits = hits.slice(0, 3);

  // The de-duplicated union of suggested roles across the shown hits, each with the
  // plain-language simile key the renderer/Next-step uses. Stable order = first seen.
  const roleOrder = [];
  for (const hit of topHits) {
    for (const role of hit.roles) {
      if (!roleOrder.includes(role)) roleOrder.push(role);
    }
  }
  const roles = roleOrder.map((id) => ({ id }));

  return {
    hasHighRisk: topHits.length > 0,
    hits: topHits,
    roles,
    // The same report-only honesty flag the profile card carries: a keyword match is
    // a fact + a fixed mapping, NOT a decision that the work is risky.
    semanticConclusion: false
  };
}

// Top-level: turn the scan + the raw ledgers into the full bootstrap model. The
// ledgers are passed in already-parsed (the CLI reads them via readLedger). We run
// buildHandoffModel + summarizeTasks ONCE and hand their honest output to the card
// builders. `hasOwnData` is the seed-honesty gate: TRUE only when there is at least
// one NON-seed row across the trust-bearing ledgers, so an empty/seed-only
// workspace is reported as "no data yet" instead of borrowing the example.
export function buildBootstrapModel({ ledgers, scan, handoffDraftCount = 0, dialogue = null }) {
  const tasks = Array.isArray(ledgers.tasks) ? ledgers.tasks : [];
  const evidence = Array.isArray(ledgers.evidence) ? ledgers.evidence : [];
  const runs = Array.isArray(ledgers.runs) ? ledgers.runs : [];
  const receipts = Array.isArray(ledgers.receipts) ? ledgers.receipts : [];
  const learning = Array.isArray(ledgers.learning) ? ledgers.learning : [];

  // The HONEST core: bucketing with re-computed levels (buildHandoffModel skips the
  // seed task by default) + per-task achievement (summarizeTasks flags seeds).
  const handoff = buildHandoffModel({ tasks, evidence, runs, receipts, learning });
  const perTask = summarizeTasks(tasks, receipts, evidence, runs);

  // Seed-honesty: count NON-seed rows. A brand-new workspace ships exactly one seed
  // set (t0/e0/e1/r0/c0/l0); if every row is a seed, the user has no data of their
  // own. We check each ledger with the shared isSeedRow so "what is a seed" stays
  // defined in one place.
  const nonSeed = (rows, key) => rows.filter((row) => !isSeedRow(row, key));
  const ownTasks = nonSeed(tasks, "tasks");
  const ownEvidence = nonSeed(evidence, "evidence");
  const ownRuns = nonSeed(runs, "runs");
  const ownReceipts = nonSeed(receipts, "receipts");
  const ownLearning = nonSeed(learning, "learning");
  const hasOwnData =
    ownTasks.length > 0 ||
    ownEvidence.length > 0 ||
    ownRuns.length > 0 ||
    ownReceipts.length > 0 ||
    ownLearning.length > 0;

  const verify = buildVerifyCard(handoff, perTask, dialogue);
  const resume = buildResumeCard(handoff, perTask, scan, handoffDraftCount);
  const harvest = buildHarvestCard(handoff, learning, dialogue);
  // The two new DETERMINISTIC cards (red line: facts + recognisable evidence, never
  // a semantic verdict). profile reads the scan only; roles reads the user's task
  // titles (seeds excluded) + recently-touched file paths against a fixed high-risk
  // keyword table. Neither writes or calls a model — pure reads, like the cards above.
  const profile = buildProfileCard(scan);
  const roles = buildRolesCard(tasks, scan);

  // The dialogue scan is the user's OWN data (a chat THEY exported), so even a
  // seed-only ledger gains a real baseline once a dialogue file is read — `dialogueUsed`
  // lets the renderer show the cards (not the "no data yet" short-circuit) when there
  // are dialogue findings, while the seed-honesty `hasOwnData` (ledger-only) is
  // unchanged. Carried on the model so a --json consumer can branch on it too.
  const dialogueUsed = dialogue && dialogue.used === true;

  return {
    reportOnly: true, // report-only; this model never drives a write.
    hasOwnData,
    seedOnly: !hasOwnData,
    dialogueUsed: dialogueUsed === true,
    // The transparency record (red line #5): which local files were read, how many
    // flagged snippets, and the explicit "all local, nothing sent" promise. null when
    // no dialogue/log file was provided (so the default report is byte-identical).
    dialogue: dialogue
      ? {
          used: dialogue.used === true,
          sources: dialogue.sources ?? [],
          skipped: dialogue.skipped ?? [],
          snippetCount: dialogue.snippetCount ?? 0
        }
      : null,
    counts: {
      ownTasks: ownTasks.length,
      ownEvidence: ownEvidence.length,
      ownRuns: ownRuns.length,
      ownReceipts: ownReceipts.length,
      ownLearning: ownLearning.length,
      handoff: handoff.counts
    },
    scan,
    // Card order in the model mirrors the render order: profile (a warm, factual
    // opener) -> verify -> resume -> roles -> harvest. A --json consumer reads them
    // by name, so the object-key order is for readability only.
    cards: { profile, verify, resume, roles, harvest }
  };
}

// --- D. Render (plain language first; terms go in details) ------------------
//
// The first screen avoids jargon (no L0-L4 / "receipt" / "harvest" theory up top).
// Each card leads with a plain sentence; the term (guard level, etc.) rides along
// only as a parenthetical detail. All numbers come from the real scan/model — there
// is NO hard-coded demo copy.

function renderVerifyCard(verify, locale = "en") {
  const lines = [];
  lines.push(t("bootstrap.verify.title", {}, locale));
  // Split the ledger-sourced (trust-bearing) items from the dialogue-sourced
  // candidates so the two are NEVER mixed: ledger facts first, then a clearly
  // separated "from your chat" block (red line #4 — visual separation).
  const ledgerItems = verify.filter((v) => v.source !== "dialogue");
  const dialogueItems = verify.filter((v) => v.source === "dialogue");

  if (ledgerItems.length === 0 && dialogueItems.length === 0) {
    lines.push(t("bootstrap.verify.allClear1", {}, locale));
    lines.push(t("bootstrap.verify.allClear2", {}, locale));
    return lines.join("\n");
  }
  if (ledgerItems.length > 0) {
    lines.push(t("bootstrap.verify.count", { count: ledgerItems.length, plural: ledgerItems.length === 1 ? "" : "s" }, locale));
    for (const item of ledgerItems) {
      const title = item.title && item.title.length > 0 ? item.title : t("common.untitled", {}, locale);
      // Reason is rendered from the STABLE reason CODE (item.reason), localized here;
      // the model's reasonText stays canonical English (a data contract), the display
      // is translated — including the honesty wording, faithfully, never softened.
      const reasonText = t(`bootstrap.verify.reason.${item.reason}`, {}, locale);
      lines.push(t("bootstrap.verify.item", { taskId: item.taskId, title, reason: reasonText }, locale));
      if (item.receipt) {
        // Term detail (kept on its own indented line): the receipt + its RE-COMPUTED level.
        // The self-declared-cross-family marker is rendered in the active locale (the
        // honesty caveat must read in the user's language, faithfully translated).
        const marker = item.familyMarker
          ? ` [${t("marker.selfDeclaredCrossFamily", {}, locale)}]`
          : "";
        lines.push(
          t("bootstrap.verify.detail", {
            id: item.receipt.id,
            verdict: item.receipt.verdict,
            level: item.receipt.guardLevel,
            status: item.receipt.status,
            marker
          }, locale)
        );
      }
    }
  }
  // The dialogue-sourced block: a separate header that names where it came from and
  // that it is unverified, then each claim with the "claimed in dialogue · not
  // verified" wording (localized but never softened) + its redacted snippet.
  if (dialogueItems.length > 0) {
    lines.push(t("bootstrap.verify.dialogueHead", { count: dialogueItems.length, plural: dialogueItems.length === 1 ? "" : "s" }, locale));
    for (const item of dialogueItems) {
      lines.push(t("bootstrap.verify.dialogueItem", {
        path: item.sourcePath,
        line: item.line,
        snippet: item.snippet
      }, locale));
    }
  }
  return lines.join("\n");
}

function renderResumeCard(resume, locale = "en") {
  const lines = [];
  lines.push(t("bootstrap.resume.title", {}, locale));
  if (resume.activeTasks.length === 0) {
    lines.push(t("bootstrap.resume.noActive", {}, locale));
  } else {
    lines.push(t("bootstrap.resume.count", { count: resume.activeTasks.length, plural: resume.activeTasks.length === 1 ? "" : "s" }, locale));
    for (const task of resume.activeTasks) {
      const title = task.title && task.title.length > 0 ? task.title : t("common.untitled", {}, locale);
      lines.push(t("bootstrap.resume.item", { id: task.id, title, status: task.status }, locale));
    }
  }
  if (resume.missingHandoff) {
    lines.push(t("bootstrap.resume.missingHandoff", {}, locale));
  }
  if (resume.gitDrift.repeatedlyTouched.length > 0) {
    const names = resume.gitDrift.repeatedlyTouched.map((r) => `${r.file} (×${r.commits})`).join(", ");
    lines.push(t("bootstrap.resume.reTouch", { names }, locale));
    lines.push(t("bootstrap.resume.reTouchNote", {}, locale));
  }
  if (resume.gitDrift.hasUncommittedChanges) {
    lines.push(t("bootstrap.resume.uncommitted", {}, locale));
  }
  return lines.join("\n");
}

function renderHarvestCard(harvest, locale = "en") {
  const lines = [];
  lines.push(t("bootstrap.harvest.title", {}, locale));
  const dialogueCandidates = harvest.dialogueCandidates ?? [];
  if (
    harvest.confirmedLearnings.length === 0 &&
    harvest.candidates.length === 0 &&
    dialogueCandidates.length === 0
  ) {
    lines.push(t("bootstrap.harvest.none1", {}, locale));
    lines.push(t("bootstrap.harvest.none2", {}, locale));
    return lines.join("\n");
  }
  for (const c of harvest.candidates) {
    // Render the localized detail from the stable `kind` + `count`; fall back to the
    // model's English `detail` if a kind has no message key (never an empty line).
    const key = `bootstrap.harvest.detail.${c.kind}`;
    const localizedDetail = t(key, { count: c.count, plural: c.count === 1 ? "" : "s" }, locale);
    const detail = localizedDetail === key ? c.detail : localizedDetail;
    lines.push(t("bootstrap.harvest.candidate", { detail }, locale));
  }
  if (harvest.confirmedLearnings.length > 0) {
    lines.push(t("bootstrap.harvest.confirmedHead", {}, locale));
    for (const l of harvest.confirmedLearnings) {
      lines.push(t("bootstrap.harvest.confirmedItem", { type: l.type, content: l.content }, locale));
    }
  }
  // The dialogue-sourced profile candidates: a SEPARATE block, labelled as coming
  // from the chat and PROPOSED (nothing saved). Kept apart from the user's own
  // confirmed learnings above so a chat-derived guess is never shown as a kept fact.
  if (dialogueCandidates.length > 0) {
    lines.push(t("bootstrap.harvest.dialogueHead", {}, locale));
    for (const c of dialogueCandidates) {
      lines.push(t("bootstrap.harvest.dialogueItem", {
        count: c.count,
        snippet: c.snippet
      }, locale));
    }
  }
  return lines.join("\n");
}

// Render the PROFILE-CLUES card. Leads the report with recognisable facts (a warm,
// factual opener), then a FIXED footer that states the honesty contract out loud:
// these are clues, not a conclusion, and the user's own ai will confirm the real
// work-style profile. Every line is a fact from the scan; none is a judgment.
function renderProfileCard(profile, locale = "en") {
  const lines = [];
  lines.push(t("bootstrap.profile.title", {}, locale));

  const tools = Array.isArray(profile.detectedTools) ? profile.detectedTools : [];
  if (tools.length > 0) {
    lines.push(t("bootstrap.profile.tools", { tools: tools.join(", ") }, locale));
    // More than one tool is a cross-tool FACT (two tools configured), surfaced as a
    // collaboration SIGNAL — never "you like working across tools" as a verdict.
    if (profile.multiTool) {
      lines.push(t("bootstrap.profile.multiTool", {}, locale));
    }
  } else {
    lines.push(t("bootstrap.profile.noTools", {}, locale));
  }

  const fileTypes = Array.isArray(profile.fileTypes) ? profile.fileTypes : [];
  if (fileTypes.length > 0) {
    const names = fileTypes.map((f) => `${f.ext} (×${f.count})`).join(", ");
    lines.push(t("bootstrap.profile.fileTypes", { names }, locale));
  }

  if (profile.hasTestScript) {
    lines.push(t("bootstrap.profile.testScript", {}, locale));
  }

  // The fixed footer — the load-bearing honesty line. Always present, never softened:
  // "these are clues, not a conclusion; your ai will confirm the full profile."
  lines.push(t("bootstrap.profile.footer", {}, locale));
  return lines.join("\n");
}

// Render the ROLES-SUGGESTION card. Each hit shows the exact matched evidence (the
// task title or file path + the keyword) and the suggested role(s) with a plain-
// language simile, so the user sees WHY a role is suggested — a fact + a fixed
// mapping, never "this work is dangerous" as a verdict. No hit -> an honest "no
// high-risk keywords matched — a keyword scan only, not a low-risk verdict" line.
function renderRolesCard(roles, locale = "en") {
  const lines = [];
  lines.push(t("bootstrap.roles.title", {}, locale));

  if (!roles.hasHighRisk) {
    // Honest no-match: do not manufacture a suggestion. Say plainly that nothing
    // high-risk was scanned and a single tool is enough until the user needs more.
    lines.push(t("bootstrap.roles.none", {}, locale));
    return lines.join("\n");
  }

  lines.push(t("bootstrap.roles.intro", { count: roles.hits.length, plural: roles.hits.length === 1 ? "" : "s" }, locale));
  for (const hit of roles.hits) {
    // The role names + their plain-language similes, joined. The simile lives in
    // i18n (e.g. "red-team = someone whose whole job is to poke holes"), so the
    // role label is never a bare term wall on the user's first read.
    const roleText = hit.roles
      .map((id) => t(`bootstrap.roles.role.${id}`, {}, locale))
      .join(t("bootstrap.roles.roleJoin", {}, locale));
    // The matched SUBJECT is shown verbatim (the task title or file path), then the
    // keyword, then the suggestion — the full evidence chain, localized but faithful.
    lines.push(t("bootstrap.roles.item", {
      subject: hit.subject,
      keyword: hit.keyword,
      roles: roleText
    }, locale));
  }
  return lines.join("\n");
}

// The whole report as plain text. Leads with the honest framing, then the three
// Build the transparency block (red line #5) for a report that read a local dialogue
// or log export: which files were read (path + line count), how many snippets were
// flagged, the explicit "all local, nothing sent" promise, and a note for any file
// that was skipped (missing / unreadable / unsupported). Returns [] when no dialogue
// file was provided, so the default report stays byte-identical. Every snippet shown
// downstream is already redacted; this header only names files + counts.
function dialogueTransparencyLines(model, locale = "en") {
  const d = model.dialogue;
  if (!d || d.used !== true) {
    // Even with no readable source, if the user NAMED files that were all skipped, be
    // transparent about that (so a typo'd path is visible, not silently ignored).
    if (d && Array.isArray(d.skipped) && d.skipped.length > 0) {
      const out = [t("bootstrap.dialogue.skippedHead", {}, locale)];
      for (const s of d.skipped) {
        out.push(t(`bootstrap.dialogue.skipped.${s.reason}`, { path: s.path }, locale));
      }
      return out;
    }
    return [];
  }
  const out = [];
  const fileList = d.sources.map((s) => `${s.path} (${s.lines})`).join(", ");
  out.push(t("bootstrap.dialogue.head", {
    count: d.sources.length,
    plural: d.sources.length === 1 ? "" : "s",
    files: fileList,
    snippets: d.snippetCount
  }, locale));
  out.push(t("bootstrap.dialogue.localPromise", {}, locale));
  if (Array.isArray(d.skipped) && d.skipped.length > 0) {
    for (const s of d.skipped) {
      out.push(t(`bootstrap.dialogue.skipped.${s.reason}`, { path: s.path }, locale));
    }
  }
  return out;
}

// cards, then a single concrete next step. Used for the non-JSON output.
export function renderBootstrapReport(model, locale = "en") {
  const lines = [];
  lines.push(t("bootstrap.report.title", {}, locale));
  lines.push(t("bootstrap.report.scanned", { repoRoot: model.scan.repoRoot }, locale));
  lines.push(t("bootstrap.report.readonly", {}, locale));
  // Transparency (red line #5): when a local dialogue/log export was read, state at
  // the TOP exactly which files, how many flagged snippets, and that it stayed local.
  for (const line of dialogueTransparencyLines(model, locale)) lines.push(line);
  lines.push("");

  if (!model.hasOwnData && !model.dialogueUsed) {
    // Seed-honesty: no data of the user's own AND no dialogue handed over. Do NOT
    // dress up the shipped example. (If a dialogue WAS read, it is the user's own data,
    // so we fall through and render the cards with the dialogue findings.)
    lines.push(t("bootstrap.empty.line1", {}, locale));
    lines.push(t("bootstrap.empty.line2", {}, locale));
    lines.push(t("bootstrap.empty.step1", {}, locale));
    lines.push(t("bootstrap.empty.step2", {}, locale));
    lines.push("");
    lines.push(t("bootstrap.empty.note", {}, locale));
    return lines.join("\n");
  }

  // Card order (per the product brief): profile leads with recognisable facts so the
  // first screen earns goodwill, then VERIFY (the most urgent honesty signal), RESUME,
  // the roles suggestion (high-risk -> bring help), and HARVEST. The two new cards are
  // DETERMINISTIC fact lists; VERIFY + roles remain the load-bearing content.
  lines.push(renderProfileCard(model.cards.profile, locale));
  lines.push("");
  lines.push(renderVerifyCard(model.cards.verify, locale));
  lines.push("");
  lines.push(renderResumeCard(model.cards.resume, locale));
  lines.push("");
  lines.push(renderRolesCard(model.cards.roles, locale));
  lines.push("");
  lines.push(renderHarvestCard(model.cards.harvest, locale));
  lines.push("");
  // One concrete next step, chosen from the real model — and it points at an
  // EXISTING audited command with the real id filled in, so the user can act
  // without translating the advice into a command (and without inventing a flag).
  for (const line of bootstrapNextStepLines(model, locale)) lines.push(line);
  return lines.join("\n");
}

// Build the "Next:" block for the bootstrap report. Returns 1-2 lines: a plain
// sentence plus, when applicable, a real copy-pasteable command with the actual id
// filled in. Ordered VERIFY (most urgent) -> RESUME -> HARVEST -> all-clear. Every
// command is one the CLI already ships and audits (receipt accept / receipt create /
// run exec / handoff create / learning confirm) — bootstrap stays report-only and
// never invents a write path (no --save-safe; the only sanctioned write is the
// existing learning add/confirm + receipt flow the user runs themselves).
export function bootstrapNextStepLines(model, locale = "en") {
  // The PRIMARY next step keeps its original priority ladder VERIFY -> RESUME ->
  // HARVEST -> all-clear (VERIFY is the most urgent honesty signal, so it stays the
  // headline action). The roles HINT is APPENDED after it (not in place of it) when
  // high-risk roles were suggested, so the user is told to bring help without burying
  // the verify action. A roles hint is advisory — it points at an EXISTING role
  // package to read, never a write path.
  const primary = bootstrapPrimaryNextStep(model, locale);

  // Append the high-risk roles hint, if any. The roles card already de-duped + capped
  // the suggestions; we surface their plain-language names so the user knows who to
  // bring — the spec's "if high-risk roles were suggested, fold them into Next".
  const roles = model.cards.roles;
  if (roles && roles.hasHighRisk && Array.isArray(roles.roles) && roles.roles.length > 0) {
    const roleText = roles.roles
      .map((r) => t(`bootstrap.roles.role.${r.id}`, {}, locale))
      .join(t("bootstrap.roles.roleJoin", {}, locale));
    return [...primary, t("bootstrap.next.roles.text", { roles: roleText }, locale)];
  }
  return primary;
}

// The primary next-step lines (the original VERIFY -> RESUME -> HARVEST -> all-clear
// ladder). Split out so bootstrapNextStepLines can append the roles hint after it
// without duplicating the ladder. Returns 1-2 lines: a plain sentence + an optional
// real copy-pasteable command. Every command is one the CLI already ships and audits.
function bootstrapPrimaryNextStep(model, locale = "en") {
  // (1) VERIFY (ledger): something is claimed done but cannot be trusted. Point at the
  //     real command that closes the specific gap, with the offending id filled in. We
  //     deliberately pick the first LEDGER item (not a dialogue one) for the receipt-
  //     based commands, since only a ledger item carries a taskId/receipt to act on.
  const verifyItem = model.cards.verify.find((v) => v.source !== "dialogue");
  if (verifyItem) {
    // A receipt that is merely PENDING (a pass_with_risk awaiting sign-off) closes
    // with an owner acceptance — the lightest real action, so suggest it directly.
    if (verifyItem.receipt && verifyItem.receipt.status === "pending") {
      return [
        t("bootstrap.next.pending.text", { receiptId: verifyItem.receipt.id, taskId: verifyItem.taskId }, locale),
        t("bootstrap.next.pending.cmd", { receiptId: verifyItem.receipt.id }, locale)
      ];
    }
    // A self-declared cross-family pass is accepted but UNVERIFIED: the honest way to
    // strengthen it is a reviewer rerun reconciled to a recorded run exec (the L4 path).
    if (verifyItem.reason === "self_declared_cross_family") {
      return [
        t("bootstrap.next.selfCross.text", { receiptId: verifyItem.receipt ? verifyItem.receipt.id : "(none)", taskId: verifyItem.taskId }, locale),
        t("bootstrap.next.selfCross.cmd", { taskId: verifyItem.taskId }, locale)
      ];
    }
    // Author-marked done with no accepted review behind it: file a real receipt
    // (after the evidence exists) so the "done" is backed by the guard.
    return [
      t("bootstrap.next.authorDone.text", { taskId: verifyItem.taskId }, locale),
      t("bootstrap.next.authorDone.cmd", { taskId: verifyItem.taskId }, locale)
    ];
  }

  // (1b) VERIFY (dialogue): no ledger item, but the chat export claims a "done" the
  //      ledger does not back. The honest next step is to turn that claim into a real,
  //      tracked task + recorded run (so the "done" stops being just words). Points at
  //      `task create`, an existing audited command — never invents a write path.
  const dialogueVerify = model.cards.verify.find((v) => v.source === "dialogue");
  if (dialogueVerify) {
    return [
      t("bootstrap.next.dialogueClaim.text", {}, locale),
      t("bootstrap.next.dialogueClaim.cmd", {}, locale)
    ];
  }

  // (2) RESUME: work is in flight but there is no handoff draft to resume from.
  if (model.cards.resume.missingHandoff) {
    return [
      t("bootstrap.next.missingHandoff.text", {}, locale),
      t("bootstrap.next.missingHandoff.cmd", {}, locale)
    ];
  }

  // (3) HARVEST: a proposed lesson of your own is waiting to be kept — confirming it
  //     graduates it into your profile (the real, audited write path).
  const proposed = model.cards.harvest.proposedLearnings && model.cards.harvest.proposedLearnings[0];
  if (proposed) {
    return [
      t("bootstrap.next.keepLesson.text", { id: proposed.id }, locale),
      t("bootstrap.next.keepLesson.cmd", { id: proposed.id }, locale)
    ];
  }

  // (4) Nothing outstanding.
  return [
    t("bootstrap.next.allClear.text", {}, locale)
  ];
}

// --- D. Consent preview (printed before the scan unless --yes) --------------
//
// bootstrap reads local files + runs read-only git. Before doing so it prints
// EXACTLY what it will read and confirms it stays local, then (without --yes) stops
// and asks the user to re-run with --yes. The CLI is non-interactive, so "consent"
// is an explicit re-run, not a y/n prompt — but the scope is shown first either way.
export function renderConsentPreview(repoRoot, locale = "en", dialogueSources = []) {
  const lines = [
    t("bootstrap.consent.head", {}, locale),
    t("bootstrap.consent.repo", { repoRoot }, locale),
    t("bootstrap.consent.git", {}, locale),
    t("bootstrap.consent.ledger", {}, locale),
    t("bootstrap.consent.ai", {}, locale)
  ];
  // The dialogue/log connectors are a HIGH-PRIVACY source that is OFF unless the user
  // EXPLICITLY named a file. Only when they did do we list those files in the consent
  // scope (so the preview names exactly what extra will be read); otherwise the scope
  // is identical to before — the connector defaults to "not read".
  if (Array.isArray(dialogueSources) && dialogueSources.length > 0) {
    lines.push(t("bootstrap.consent.dialogue", { files: dialogueSources.join(", ") }, locale));
  }
  lines.push("");
  lines.push(t("bootstrap.consent.promise", {}, locale));
  lines.push(t("bootstrap.consent.rerun", {}, locale));
  lines.push(t("bootstrap.consent.cmd", {}, locale));
  return lines.join("\n");
}

// TODO (next sub-batch / Owner's call — deliberately NOT here):
//   - the EXTERNAL-model half of the semantic scan (`--send-to-model`): send the
//     redacted snippets to a model for a richer read. Kept out HERE: this batch is the
//     LOCAL half only — red line #1 is deterministic + no-network, so the model pass is
//     a separate, explicitly-consented step. redactSnippet (dialogue.js) is already
//     shared so that path reuses the exact same redaction before anything is sent.
//   - a save / write-back flow (--save-safe) that promotes a HARVEST candidate into
//     the profile. This batch is report-only and writes NOTHING; the proposed/confirmed
//     buffer (learning add/confirm) is the only sanctioned write path today.
//   - a GUI / richer rendering.
//
// DONE in this batch (the local half of semantic scanning, see dialogue.js):
//   - opt-in local connectors `--dialogue` / `--logs` (read only files the user names).
//   - deterministic completion-claim extraction cross-referenced against the ledger,
//     surfaced as VERIFY findings "claimed in dialogue · not verified" (never done).
//   - repeated-correction -> HARVEST *profile* candidate (proposed; nothing written).
//   - per-snippet redaction (redactSnippet) before anything is shown or recorded.
