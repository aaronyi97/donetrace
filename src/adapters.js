import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderSharedCoreContract } from "./render.js";
import { readLedger, confirmedProfileLearnings } from "./ledger.js";

const sixLayerProtocol = [
  "Profile: capture stable collaboration preferences before long or recurring work.",
  "Context: package the current task boundary, facts, assumptions, risks, and open questions.",
  "Acceptance: define observable pass criteria before asking an AI tool to execute.",
  "Guard: review artifacts against requirements, evidence, privacy, and scope before trust.",
  "Handoff: leave the next session a concise state card with done, pending, blocked, and unverified work.",
  "Harvest: extract reusable lessons, prompt fragments, and future rule candidates after a loop."
];

// Single source of truth: the contract body embedded in every entrypoint is the
// exact text rendered into .aict/adapters/SHARED_CORE_CONTRACT.md by render.js.
// We inline it (instead of pointing at a file that `adapters install` does not
// create) so the rules — coaching layer, completion-claim guard routing
// (single-tool-guard / dual-guard / full fusion), restraint tiers, the first-run
// promise, and the six-layer core loop — are live the moment the tool reads its
// always-on instructions, with or without a generated workspace. Reusing
// renderSharedCoreContract() keeps this from drifting into a second copy.
function sharedCoreContractBody() {
  return renderSharedCoreContract()
    .replace(/^# Shared Core Contract\n+/, "")
    .trimEnd();
}

// --- Confirmed-preference injection (the "white-filled profile" fix) ---------
//
// Filling a profile preference and confirming it used to only echo back in the
// tool's OWN `status` line — the rule files a real tool reads (CLAUDE.md,
// .cursorrules, AGENTS.md, ...) never carried it, so the AI actually doing the
// work could not see it. That made a confirmed preference feel adopted while
// being invisible to the assistant. This block closes that gap: at
// `adapters install` time we read the user's KEPT profile preferences straight
// from the learning ledger (the machine source of truth) and inline them into
// every generated rule file, so the assistant reads them as part of its
// always-on instructions.
//
// Honesty rules (the whole point of the proposed/confirmed buffer):
//   - ONLY confirmed/edited rows are injected. A `proposed` row is an unreviewed
//     guess; injecting it would pass an unconfirmed guess off as a standing rule.
//     confirmedProfileLearnings() enforces this (it filters on the same
//     isGraduatedLearningStatus the status recall uses).
//   - When there are NONE, we do NOT fake one: the block says "No confirmed
//     preferences yet" and points at how to add one, instead of a placeholder
//     pseudo-preference.
//   - The injected text is the ledger content VERBATIM (only outer whitespace is
//     trimmed) — never paraphrased into a stronger or different instruction.
//   - We read the ledger, never CANDIDATES.md, which self-declares it can drift
//     from the ledger; the ledger is the source of truth.

// Resolve the workspace state dir for an adapters-install target. The target a
// user passes is normally their project root, whose workspace lives at
// `<target>/.aict` (with state under `.aict/state`); a user may also point
// `--target` straight at the `.aict` workspace dir itself. We mirror the CLI's
// own workspace detection (WORKSPACE_MANIFEST.json is the marker every generated
// `.aict` carries, and ONLY there) so this never drifts from where the run-layer
// commands read/write the ledger. We deliberately do NOT key off START_HERE.md:
// that doc also ships at the project root, so a bare-START_HERE.md probe matches
// the root and resolves state to <root>/state instead of <root>/.aict/state.
// Returns null when no real workspace is present — then there simply is no
// confirmed preference to inject (a fresh project that never ran `init`), and we
// say so rather than inventing one.
function resolveWorkspaceStateDir(targetRoot) {
  const root = path.resolve(targetRoot);
  if (existsSync(path.join(root, "WORKSPACE_MANIFEST.json"))) {
    return path.join(root, "state");
  }
  if (existsSync(path.join(root, ".aict", "WORKSPACE_MANIFEST.json"))) {
    return path.join(root, ".aict", "state");
  }
  return null;
}

// Read the user's KEPT profile preferences (confirmed/edited profile-type
// learning rows) for an adapters-install target, as the array of their `content`
// strings (trimmed, in ledger order). Safe-by-default: a target with no
// workspace, or a workspace whose learning ledger is missing/empty, yields []
// (no confirmed preferences — we will not fake any). A CORRUPT ledger is treated
// the same way (empty) instead of crashing the whole install: injecting the
// preference block is a courtesy on top of writing the rule files, and a broken
// ledger is surfaced by `validate`/`status`, not by refusing to lay down adapter
// guidance. Reuses readLedger + confirmedProfileLearnings so the read shape and
// the "what counts as kept" rule stay single-sourced with the rest of the CLI.
function readConfirmedPreferences(targetRoot) {
  const stateDir = resolveWorkspaceStateDir(targetRoot);
  if (!stateDir) return [];
  let records;
  try {
    records = readLedger(stateDir, "learning");
  } catch {
    return []; // corrupt ledger: don't block the install; don't invent preferences
  }
  return confirmedProfileLearnings(records).map((row) => String(row.content).trim());
}

// Render the "Your confirmed preferences" section injected into every rule file.
// `preferences` is the array of confirmed/edited preference strings from
// readConfirmedPreferences(). With one or more, each is a verbatim bullet so the
// assistant reads exactly what the user kept. With NONE, the section honestly
// says so and shows how to add one — it never emits a placeholder preference, so
// a fresh workspace's rule files carry no fake standing rule.
function renderConfirmedPreferencesSection(preferences) {
  const heading = "## Your confirmed preferences";
  if (!Array.isArray(preferences) || preferences.length === 0) {
    return `${heading}

No confirmed preferences yet. These are the standing collaboration preferences the user has reviewed and kept; once any exist they are listed here for you to follow. To add one: \`ai-collab learning add --type profile --content "..."\` then \`ai-collab learning confirm --id <id>\` (only confirmed/edited preferences appear here — an unreviewed guess never does).`;
  }
  const bullets = preferences.map((line) => `- ${line}`).join("\n");
  return `${heading}

These are standing collaboration preferences the user has reviewed and confirmed. Treat them as always-on instructions for how to work with this user, alongside the shared core contract below:

${bullets}`;
}

// Each entrypoint carries a short tool `key` (the value `--tool` selects on) plus
// the relative file it writes and a `detect` list: marker files/dirs whose
// presence in the target means that tool is already in use here. `--tool auto`
// installs only the entrypoints whose detect markers are found, so a fresh
// install does not silently scatter six instruction files into a project that
// only uses one tool. `--tool all` keeps the original behavior (write all six).
//
// Detection-marker rule: a `detect` marker must be SPECIFIC to its tool, never a
// generic dir most repos already have. The cautionary case is Copilot: its
// marker is `.github/copilot-instructions.md` (the tool's own file), NOT the bare
// `.github/` dir — nearly every GitHub repo has `.github/` for workflows/issue
// templates, so detecting on the directory would auto-"find" Copilot everywhere
// and pollute unrelated repos. The bias is intentional: prefer "this tool's
// user was not auto-detected, so tell them to pass --tool" over "a plain repo
// got a wall of files it never asked for."
const adapterEntrypoints = [
  {
    key: "codex",
    relativePath: "AGENTS.md",
    tool: "Codex / AGENTS.md",
    // AGENTS.md is now a vendor-neutral agent-instruction standard (Codex is its
    // origin/primary consumer, but Cursor, Copilot, Jules, etc. also read it).
    // It is still a precise "an AI agent is configured here" signal — unlike a
    // bare framework dir, a repo only has AGENTS.md if someone added agent
    // instructions — so it is a safe auto marker; we just install the Codex
    // entrypoint (which writes AGENTS.md) for it. Users wanting a different tool
    // can always pass --tool explicitly.
    detect: ["AGENTS.md"]
  },
  {
    key: "claude",
    relativePath: "CLAUDE.md",
    tool: "Claude Code / CLAUDE.md",
    detect: ["CLAUDE.md", ".claude"]
  },
  {
    key: "cursor",
    relativePath: ".cursor/rules/ai-collab.mdc",
    tool: "Cursor rules",
    detect: [".cursor", ".cursorrules"]
  },
  {
    key: "copilot",
    relativePath: ".github/copilot-instructions.md",
    tool: "GitHub Copilot instructions",
    // Detect Copilot by its OWN instruction file, never by the bare `.github/`
    // directory: almost every GitHub repo has `.github/` (workflows, issue
    // templates, CODEOWNERS), so detecting on the directory would make the
    // default `--tool auto` "find" Copilot in nearly every repo and write
    // `.github/copilot-instructions.md` into projects that do not use Copilot.
    detect: [".github/copilot-instructions.md"]
  },
  {
    key: "cline",
    relativePath: ".clinerules",
    tool: "Cline rules",
    detect: [".clinerules"]
  },
  {
    key: "windsurf",
    relativePath: ".windsurf/rules/ai-collab.md",
    tool: "Windsurf rules",
    detect: [".windsurf"]
  }
];

export const adapterToolKeys = adapterEntrypoints.map((entry) => entry.key);

// Parse the --tool value into a concrete set of tool keys (or the symbolic
// "all" / "auto" selectors). Accepts a comma-separated list, validates every
// token, and throws on an unknown tool so a typo fails loudly instead of
// silently installing nothing.
export function parseToolSelection(rawValue) {
  const value = (rawValue ?? "auto").trim();
  if (value === "") return { mode: "auto", keys: [] };
  const tokens = value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return { mode: "auto", keys: [] };

  if (tokens.includes("all")) return { mode: "all", keys: [...adapterToolKeys] };
  if (tokens.includes("auto")) {
    if (tokens.length > 1) {
      throw new Error(`--tool auto cannot be combined with other tools (got: ${value}).`);
    }
    return { mode: "auto", keys: [] };
  }

  const known = new Set(adapterToolKeys);
  const selected = [];
  for (let token of tokens) {
    // Friendly alias: users intuitively type "claude-code" / "claudecode", but the
    // canonical tool key is "claude". Normalize before the validity check so the
    // natural spelling does not hit "Unknown --tool".
    if (token === "claude-code" || token === "claudecode") token = "claude";
    if (!known.has(token)) {
      throw new Error(`Unknown --tool "${token}". Valid: ${adapterToolKeys.join(", ")}, all, auto.`);
    }
    if (!selected.includes(token)) selected.push(token);
  }
  return { mode: "explicit", keys: selected };
}

// Auto-detection: a tool is "present" when any of its marker files/dirs exists
// in the target. Returns the matched tool keys (in canonical order).
export function detectTools(targetRoot) {
  const root = path.resolve(targetRoot);
  return adapterEntrypoints
    .filter((entry) => entry.detect.some((marker) => existsSync(path.join(root, marker))))
    .map((entry) => entry.key);
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function writeText(file, content) {
  ensureDir(path.dirname(file));
  writeFileSync(file, `${content.trimEnd()}\n`, "utf8");
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
}

function backupPathFor(file) {
  const base = `${file}.aict-backup-${formatTimestamp()}`;
  if (!existsSync(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not choose a backup path for ${file}.`);
}

function renderAdapterEntrypoint(entry, preferences = []) {
  return `# DoneTrace Adapter Guidance

This file is adapter guidance for ${entry.tool}. It is not a deep integration, background agent, telemetry hook, or hosted memory service.

This file is self-contained: the full shared core contract is embedded below, so the rules are live as soon as the tool reads its always-on instructions — you do not need to open any other file first. If you also ran \`ai-collab init --target <dir>\`, the deeper layer templates and examples live in that local \`.aict/\` workspace (\`.aict/profile\`, \`.aict/context\`, \`.aict/acceptance\`, \`.aict/guard\`, \`.aict/handoff\`, \`.aict/harvest\`, and \`.aict/mechanisms\`); this contract is the same one written to \`.aict/adapters/SHARED_CORE_CONTRACT.md\`.

${renderConfirmedPreferencesSection(preferences)}

## Six-layer core protocol

${sixLayerProtocol.map((line) => `- ${line}`).join("\n")}

## Adaptation tiers (least to most invasive)

- Rules (this file): the default, always-safe tier. Just guidance the tool reads; no automation.
- Skills (optional): reusable ability cards under \`.aict/skills/\` you load into a tool on demand after running \`init\`.
- Hooks (opt-in, off by default): \`adapters install --enable-hooks\` can add two project-local Claude Code hooks — a Stop hook that reminds you to capture a receipt when you claim a task is done, and a one-time SessionStart hook that, on your first session here, asks the assistant to begin the first-run onboarding on its own. They are never global hooks, the install lists every file first, and they are removable.

## Minimal operating rule

1. Follow the shared core contract embedded below as the single rule source for every tool — do not maintain a separate, drifting rule set.
2. Keep private material local. Do not upload files or infer hidden memory.
3. Label facts, assumptions, decisions, open questions, and unverified claims.
4. Before claiming completion, cite the acceptance card or say what remains unverified.

---

${sharedCoreContractBody()}

---

## Honesty boundary

This adapter guidance only gives the tool a shared workflow. It does not synchronize memory across tools, automate every AI client, or guarantee better output without user review.
`;
}

// --- Optional hook layer (the "spearhead" demo; OFF by default) -------------
//
// This is the third, most invasive adaptation tier, layered ABOVE the always-safe
// rules entrypoints and the opt-in skills. It is gated behind an explicit
// --enable-hooks: the SECURITY / PRODUCT_CONTRACT promise is "no hooks without
// consent and never a global hook", so installAdapters() never touches this tier
// unless the caller turns it on. When on, it merges ONE Claude Code project-LOCAL
// Stop hook into the target's own .claude/settings.json (never the user's
// home/global config) that reminds the assistant to capture evidence + run
// `ai-collab receipt create` when it claims a task is done — the run-layer's
// completion checkpoint, surfaced at the exact moment a completion claim happens.
//
// Design: the reminder is INLINED into the settings command (a single self-
// contained `printf ... 1>&2; exit 0`) rather than shelling out to a separate
// script in the standard hooks directory. That keeps the install to one file, and
// — deliberately — avoids ever writing the standard `<claude-dir>/hooks` path
// literal, which the project's own privacy scanner flags as a leaked personal
// hook config. So a user who installs this hook and then runs the privacy scan on
// their own project still passes; the generated settings reference only the local
// dir name, not the hooks subpath.
const CLAUDE_LOCAL_DIR = ".claude";
// A stable marker tagged onto the Stop hook entry so it can be found and removed
// again (the "uninstallable" guarantee) without disturbing any other hooks the
// project already configured.
const HOOK_MARKER = "ai-collab-receipt-reminder";

function hookSettingsRelPosix() {
  return [CLAUDE_LOCAL_DIR, "settings.json"].join("/");
}

// The inlined Stop-hook command. It is intentionally tiny and side-effect-free:
// it only prints guidance to stderr (which Claude Code surfaces from a Stop hook)
// and exits 0, so enabling it can never block the assistant from stopping or
// mutate any file. No absolute paths, tokens, script files, or private material —
// it is fully generic and self-contained.
function hookCommandString() {
  const lines = [
    "[ai-collab] Claimed a task is done? Capture evidence + a receipt:",
    "  ai-collab evidence add --task <id> --kind output --summary <text>",
    "  ai-collab receipt create --task <id> --verdict <pass|reject|insufficient_evidence|pass_with_risk> --guard-level <L0-L4>"
  ];
  return `printf '%s\\n' ${lines.map((line) => `'${line}'`).join(" ")} 1>&2; exit 0`;
}

function hookEntry() {
  return {
    // Tag the matcher with our marker so the entry is identifiable + removable.
    matcher: HOOK_MARKER,
    hooks: [
      {
        type: "command",
        command: hookCommandString(),
        timeout: 5000,
        statusMessage: "ai-collab: remind to capture evidence + receipt"
      }
    ]
  };
}

// True if a parsed settings object already has our marked Stop hook, so a repeat
// --enable-hooks is idempotent (we do not append a duplicate entry).
function hasOurStopHook(settings) {
  const stop = settings?.hooks?.Stop;
  if (!Array.isArray(stop)) return false;
  return stop.some((entry) => entry && entry.matcher === HOOK_MARKER);
}

// Merge our Stop hook into an existing settings object WITHOUT dropping anything
// the project already configured: other events, other Stop entries, and all other
// keys are preserved; we only append our marked entry to hooks.Stop.
function mergeStopHook(settings) {
  const next = settings && typeof settings === "object" ? { ...settings } : {};
  const hooks = next.hooks && typeof next.hooks === "object" ? { ...next.hooks } : {};
  const stop = Array.isArray(hooks.Stop) ? [...hooks.Stop] : [];
  stop.push(hookEntry());
  hooks.Stop = stop;
  next.hooks = hooks;
  return next;
}

// --- SessionStart onboarding hook -----------------------------------------
//
// The SECOND opt-in hook --enable-hooks installs (alongside the Stop receipt
// reminder above). Where the Stop hook reacts to a completion claim, this one
// fires ONCE on the FIRST new Claude Code session after the tool was set up here
// and proactively pushes the assistant to begin the CLAUDE.md "First-run
// onboarding" walkthrough — so the user gets the guided welcome without having to
// paste the trigger line by hand. After that first session it stays silent.
//
// Mechanics that matter (confirmed against Claude Code's official hook docs):
//  - matcher is the event SOURCE value "startup" (NOT a custom marker): it makes
//    the hook fire only on a brand-new session, never on resume / clear / compact.
//    Because the matcher slot is occupied by "startup", this entry CANNOT be
//    identified by its matcher the way the Stop hook is; instead we tag the
//    command string with a unique literal (SESSION_START_MARK below) and find it
//    there for idempotency.
//  - the directive is emitted on STDOUT (not stderr): SessionStart is one of the
//    few events whose stdout is injected into the model's context. Stop uses
//    stderr precisely because there the goal is the opposite (surface to a human,
//    not feed the model).
//  - we emit PLAIN stdout text, not a JSON envelope, to avoid the double-escaping
//    trap of JSON-inside-settings.json.
//  - the one-time guard is a marker FILE under the project's own .claude dir. Its
//    path is built from $CLAUDE_PROJECT_DIR (Claude Code guarantees this is the
//    project root regardless of the hook's cwd) — never a relative path, which
//    would resolve against an unpredictable cwd.
//  - the directive text is English-only on purpose: the privacy scanner reads
//    settings.json and the source, and stray Chinese there would (correctly) fail
//    the unmarked-Chinese heuristic.
//  - exit 0 is kept so the printed stdout is actually processed (only exit 0
//    output is consumed); the well under the 10000-char stdout cap.
//
// Like the Stop hook this is still ONE project-LOCAL entry merged into the
// target's own .claude/settings.json — never a global/home hook, never a separate
// script file under the (privacy-forbidden) standard <claude-dir>/hooks subpath.

// Unique literal embedded in the SessionStart command so the entry is findable
// for idempotency even though its matcher slot must be the fixed "startup" source.
const SESSION_START_MARK = "[ai-collab first-run]";
// The one-time marker file (relative to the project root) the hook touches after
// it first fires. Lives directly under .claude — NOT under the standard hooks
// subdir (the <claude-dir>/hooks path literal the privacy scanner forbids).
const SESSION_START_DONE_REL = ".ai-collab-firstrun-done";

// The inlined SessionStart command. On the first session it prints the onboarding
// directive to stdout (injected into context) and drops the marker file; on every
// later session the marker exists so it prints nothing. Self-contained, English-
// only, $CLAUDE_PROJECT_DIR-anchored, side-effect-limited to touching the marker.
function sessionStartCommandString() {
  const directive =
    "[ai-collab first-run] First session since ai-collab was set up here. " +
    "Proactively begin the four-step onboarding from CLAUDE.md (the \"First-run onboarding\" section) now " +
    "— welcome, then offer to scan, then a grounded profile, then harvest — " +
    "in plain language, one step at a time, stopping where the script says. " +
    "Do not wait for the user to ask.";
  return (
    `MARK="$CLAUDE_PROJECT_DIR/.claude/${SESSION_START_DONE_REL}"; ` +
    "if [ ! -f \"$MARK\" ]; then " +
    `printf '%s\\n' '${directive}'; ` +
    "mkdir -p \"$CLAUDE_PROJECT_DIR/.claude\" 2>/dev/null; " +
    "touch \"$MARK\" 2>/dev/null || true; " +
    "fi; exit 0"
  );
}

function sessionStartEntry() {
  return {
    // MUST be the event source value "startup" — fires only on a new session, not
    // resume/clear/compact. (Our identity tag lives in the command string, not
    // here, because this slot is reserved for the source value.)
    matcher: "startup",
    hooks: [
      {
        type: "command",
        command: sessionStartCommandString(),
        timeout: 5000,
        statusMessage: "ai-collab: first-run onboarding (one-time)"
      }
    ]
  };
}

// True if a parsed settings object already carries our SessionStart hook. We key
// off the unique marker literal inside the command (NOT the matcher, which is the
// fixed "startup" source), so a repeat --enable-hooks does not append a duplicate.
function hasOurSessionStartHook(settings) {
  const sessionStart = settings?.hooks?.SessionStart;
  if (!Array.isArray(sessionStart)) return false;
  return sessionStart.some(
    (entry) =>
      entry &&
      Array.isArray(entry.hooks) &&
      entry.hooks.some((h) => h && typeof h.command === "string" && h.command.includes(SESSION_START_MARK))
  );
}

// Merge our SessionStart hook into an existing settings object WITHOUT dropping
// anything already configured: other events (including our own Stop hook), other
// SessionStart entries, and all other keys are preserved; we only append our entry
// to hooks.SessionStart.
function mergeSessionStartHook(settings) {
  const next = settings && typeof settings === "object" ? { ...settings } : {};
  const hooks = next.hooks && typeof next.hooks === "object" ? { ...next.hooks } : {};
  const sessionStart = Array.isArray(hooks.SessionStart) ? [...hooks.SessionStart] : [];
  sessionStart.push(sessionStartEntry());
  hooks.SessionStart = sessionStart;
  next.hooks = hooks;
  return next;
}

// Apply BOTH opt-in hooks (Stop receipt reminder + SessionStart onboarding) to a
// settings object, each appended idempotently. Used so a single create/merge
// writes the full opt-in hook layer in one pass without clobbering existing config.
function mergeOurHooks(settings) {
  let next = settings && typeof settings === "object" ? settings : {};
  if (!hasOurStopHook(next)) next = mergeStopHook(next);
  if (!hasOurSessionStartHook(next)) next = mergeSessionStartHook(next);
  return next;
}

// Plan the hook-layer writes for the target. Hooks are Claude-Code-specific, so
// they only apply when the claude entrypoint is in the selected set. Returns a
// list of planned file actions (create / merge / backup-replace / skip) plus a
// reason when nothing is planned, so the CLI can explain exactly what (if
// anything) --enable-hooks will do — including in --dry-run.
export function plannedHookActions(targetRoot, selectedKeys) {
  const root = path.resolve(targetRoot);
  const keys = new Set(selectedKeys ?? []);
  if (!keys.has("claude")) {
    return { applicable: false, reason: "hooks are Claude Code only; select --tool claude (or a set including it) to enable them", actions: [] };
  }

  const actions = [];
  const settingsFull = path.join(root, CLAUDE_LOCAL_DIR, "settings.json");
  let settingsAction = "create";
  if (existsSync(settingsFull)) {
    let parsed = null;
    try {
      parsed = JSON.parse(readFileSync(settingsFull, "utf8"));
    } catch {
      parsed = undefined; // unparseable -> we will not clobber it; surface as a skip
    }
    if (parsed === undefined) {
      settingsAction = "skip-unparseable";
    } else if (hasOurStopHook(parsed) && hasOurSessionStartHook(parsed)) {
      // Both opt-in hooks already present -> nothing to add (idempotent).
      settingsAction = "already-present";
    } else {
      // At least one of our two hooks is missing -> merge (mergeOurHooks only
      // appends the one(s) not yet there, so an existing file with just one of
      // them gets topped up without duplicating the other).
      settingsAction = "merge";
    }
  }
  actions.push({
    kind: "hook-settings",
    relativePath: hookSettingsRelPosix(),
    path: settingsFull,
    action: settingsAction
  });

  return { applicable: true, reason: null, actions };
}

// Execute the planned hook writes. Mirrors installAdapters' safety posture:
// existing files are backed up before replacement, an unparseable settings.json
// is left untouched (reported, not clobbered), and a settings.json that already
// carries our marked entry is left as-is (idempotent).
function applyHookActions(targetRoot, plan, { dryRun }) {
  const root = path.resolve(targetRoot);
  const written = [];
  const backups = [];

  if (dryRun || !plan.applicable) {
    return { written, backups };
  }

  for (const item of plan.actions) {
    if (item.kind === "hook-settings") {
      if (item.action === "skip-unparseable" || item.action === "already-present") {
        continue; // never clobber an unparseable file; never duplicate our entry
      }
      if (item.action === "create") {
        ensureDir(path.dirname(item.path));
        // Write BOTH opt-in hooks (Stop receipt reminder + SessionStart onboarding).
        writeFileSync(item.path, `${JSON.stringify(mergeOurHooks({}), null, 2)}\n`, "utf8");
        written.push(item.relativePath);
      } else if (item.action === "merge") {
        const existing = JSON.parse(readFileSync(item.path, "utf8"));
        const backup = backupPathFor(item.path);
        renameSync(item.path, backup);
        backups.push(backup);
        // mergeOurHooks appends only the hook(s) not already present, so existing
        // config (and either of our hooks already there) is preserved, not duped.
        writeFileSync(item.path, `${JSON.stringify(mergeOurHooks(existing), null, 2)}\n`, "utf8");
        written.push(item.relativePath);
      }
    }
  }

  return { written, backups };
}

// Resolve which entrypoints to install. `selectedKeys` is the concrete tool-key
// list (already expanded from --tool by parseToolSelection / detectTools).
// Each returned entry tags its `action`: "create" (no existing file) or
// "backup-replace" (a file already exists and would be backed up first), so the
// CLI can list exactly which paths are created vs replaced — including in
// --dry-run, where nothing is actually written.
export function plannedAdapterEntrypoints(target, selectedKeys) {
  const targetRoot = path.resolve(target);
  const keys = selectedKeys ?? adapterToolKeys;
  const keySet = new Set(keys);
  // Read the user's confirmed/edited profile preferences ONCE (not per file) so
  // every rule file we generate carries the same kept-preference block. When the
  // target has no workspace / no kept preference, this is [] and the block
  // honestly says "No confirmed preferences yet" (see renderConfirmedPreferencesSection).
  const preferences = readConfirmedPreferences(targetRoot);
  return adapterEntrypoints
    .filter((entry) => keySet.has(entry.key))
    .map((entry) => {
      const fullPath = path.join(targetRoot, entry.relativePath);
      return {
        key: entry.key,
        tool: entry.tool,
        relativePath: entry.relativePath,
        path: fullPath,
        action: existsSync(fullPath) ? "backup-replace" : "create",
        content: renderAdapterEntrypoint(entry, preferences)
      };
    });
}

// Decide the effective tool key set from the --tool option. `auto` (the default)
// resolves to the detected tools; when nothing is detected it returns an empty
// set plus `autoFoundNothing: true` so the caller can prompt the user to pass an
// explicit --tool instead of silently scattering all six files.
export function resolveToolSelection(targetRoot, toolOption) {
  const selection = parseToolSelection(toolOption);
  if (selection.mode === "auto") {
    const detected = detectTools(targetRoot);
    return { mode: "auto", keys: detected, detected, autoFoundNothing: detected.length === 0 };
  }
  return { mode: selection.mode, keys: selection.keys, detected: null, autoFoundNothing: false };
}

export function installAdapters(target, options = {}) {
  const targetRoot = path.resolve(target);
  const resolution = resolveToolSelection(targetRoot, options.tool);
  const entries = plannedAdapterEntrypoints(targetRoot, resolution.keys);

  // Opt-in hook layer (OFF unless --enable-hooks). Plan it here so the same plan
  // is reported in dry-run and executed in a real run; nothing is planned when
  // the flag is off, so the rules/skills tiers are entirely unaffected.
  const hookPlan = options.enableHooks
    ? plannedHookActions(targetRoot, resolution.keys)
    : { applicable: false, reason: "hooks not requested (pass --enable-hooks to opt in)", actions: [] };

  // Auto mode with no tool detected: do not write anything. Tell the caller to
  // pick a tool explicitly (or `--tool all`). This is surfaced (not thrown) so
  // both dry-run and real install report it cleanly.
  if (resolution.autoFoundNothing) {
    return {
      targetRoot,
      files: 0,
      dryRun: Boolean(options.dryRun),
      written: false,
      backups: [],
      toolMode: resolution.mode,
      detected: resolution.detected,
      autoFoundNothing: true,
      plan: [],
      hooks: { enabled: Boolean(options.enableHooks), applicable: false, reason: hookPlan.reason, plan: [], written: [] }
    };
  }

  const plan = entries.map((entry) => ({
    tool: entry.tool,
    relativePath: entry.relativePath,
    path: entry.path,
    action: entry.action
  }));

  if (options.dryRun) {
    return {
      targetRoot,
      files: entries.length,
      dryRun: true,
      written: false,
      backups: [],
      toolMode: resolution.mode,
      detected: resolution.detected,
      autoFoundNothing: false,
      plan,
      hooks: {
        enabled: Boolean(options.enableHooks),
        applicable: hookPlan.applicable,
        reason: hookPlan.reason,
        plan: hookPlan.actions.map((item) => ({ relativePath: item.relativePath, action: item.action })),
        written: []
      }
    };
  }

  const collisions = entries.filter((entry) => existsSync(entry.path));
  if (collisions.length > 0 && !options.force) {
    throw new Error(
      `Adapter file already exists: ${collisions[0].relativePath}. Pass --force to back up and replace adapter guidance.`
    );
  }

  const backups = [];
  for (const entry of entries) {
    if (existsSync(entry.path)) {
      const backup = backupPathFor(entry.path);
      renameSync(entry.path, backup);
      backups.push(backup);
    }
    writeText(entry.path, entry.content);
  }

  const hookResult = applyHookActions(targetRoot, hookPlan, { dryRun: false });
  backups.push(...hookResult.backups);

  return {
    targetRoot,
    files: entries.length,
    dryRun: false,
    written: true,
    backups,
    toolMode: resolution.mode,
    detected: resolution.detected,
    autoFoundNothing: false,
    plan,
    hooks: {
      enabled: Boolean(options.enableHooks),
      applicable: hookPlan.applicable,
      reason: hookPlan.reason,
      plan: hookPlan.actions.map((item) => ({ relativePath: item.relativePath, action: item.action })),
      written: hookResult.written
    }
  };
}
