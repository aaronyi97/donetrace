#!/usr/bin/env node
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { installAdapters } from "./adapters.js";
import { createWorkspace } from "./workspace.js";
import { validateWorkspace } from "./validate.js";
import { resolveLocale, t } from "./i18n.js";
import {
  scanLocalStructure,
  buildBootstrapModel,
  renderBootstrapReport,
  renderConsentPreview
} from "./bootstrap.js";
import { scanDialogueAndLogs } from "./dialogue.js";
import {
  collectRedactedSnippets,
  buildModelPrompt,
  buildSendPreview,
  assertPayloadRedacted,
  runExternalModelPass,
  DEFAULT_MODEL_CMD
} from "./sendmodel.js";
import {
  readLedger,
  appendLedger,
  writeLedger,
  nextId,
  appendWithNextId,
  rewriteLedgerUnderLock,
  receiptStatusFor,
  ownedEvidenceIds,
  ownedRerunEvidenceIds,
  ownedCrossFamilyGuardEvidenceIds,
  guardLevelVerdictError,
  ownerAcceptanceError,
  doneRequiresEvidence,
  specialEvidenceStructureError,
  rerunRunReconcileError,
  computeGuardLevel,
  familyHonestyMarker,
  guardLevelRank,
  computeCapability,
  TOOL_SIGNALS,
  TOOL_FAMILY,
  CAPABILITY_TIERS,
  hasOwnedRunEvidence,
  learningRecordError,
  latestConfirmedProfileLearning,
  latestConfirmedHarvestLearning,
  summarizeTasks,
  buildHandoffModel,
  countSeedRows,
  isSeedRow,
  guardLevelExplanation,
  taskHasAcceptedReceipt,
  outputSha256,
  outputByteLength,
  isRecognizedEvidenceKind,
  EVIDENCE_KIND_RERUN,
  EVIDENCE_KIND_CROSS_FAMILY_GUARD,
  RECEIPT_VERDICTS,
  GUARD_LEVELS,
  REVIEW_MODES,
  TASK_STATUSES,
  LEARNING_TYPES,
  LEARNING_STATUSES
} from "./ledger.js";

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    // Value-taking flags. The first group are the pre-existing install flags;
    // the run-layer group (--task .. --command) feed the P1 task/evidence/run/
    // receipt commands. Every value flag must be listed here or parseArgs throws
    // "Unknown option"; only the "--key value" form is supported (no --key=value).
    if (
      arg === "--target" ||
      arg === "--workspace" ||
      arg === "--tool" ||
      arg === "--task" ||
      arg === "--title" ||
      arg === "--status" ||
      arg === "--kind" ||
      arg === "--summary" ||
      arg === "--detail" ||
      arg === "--exit" ||
      arg === "--verdict" ||
      arg === "--evidence" ||
      arg === "--id" ||
      arg === "--guard-level" ||
      arg === "--claimed-level" ||
      arg === "--review-mode" ||
      arg === "--rerun" ||
      arg === "--run" ||
      arg === "--command" ||
      arg === "--cwd" ||
      arg === "--output" ||
      arg === "--reviewer" ||
      arg === "--family" ||
      arg === "--ref" ||
      arg === "--runner" ||
      arg === "--type" ||
      arg === "--content" ||
      arg === "--tools" ||
      arg === "--families" ||
      arg === "--project" ||
      // --dialogue <path[,path]> / --logs <path[,path]> are bootstrap's OPT-IN local
      // connectors: comma-separated paths to chat/log exports the user EXPLICITLY hands
      // over for the deterministic dialogue scan. Value-taking; the value is parsed
      // (split on commas) where bootstrap consumes it. Recognized globally so a typo
      // still fails loudly via "Unknown option"; commands that do not use them ignore them.
      arg === "--dialogue" ||
      arg === "--logs" ||
      // --model <cmd> overrides the external-model command bootstrap --send-to-model
      // shells out to (default: claude over stdin). Value-taking; the prompt is always
      // delivered on STDIN to whatever this names, never interpolated into the command
      // line, so the value is a plain command token list (e.g. "claude -p" / "llm").
      // Recognized globally so a typo fails loudly via "Unknown option"; only bootstrap
      // --send-to-model consumes it.
      arg === "--model" ||
      // --lang <en|zh> is the global i18n override (highest-precedence language
      // source; see resolveLocale). Value-taking like the rest; an unsupported value
      // is simply ignored by resolveLocale (falls through to env/OS/default), so a
      // typo never hard-fails a command — it just is not applied.
      arg === "--lang"
    ) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Option ${arg} requires a value.`);
      }
      // Normalize a couple of dashed flags to camelCase arg keys; the rest map
      // 1:1 from --foo to args.foo. A1: --guard-level and --claimed-level both
      // feed args.claimedLevel — the level the AUTHOR claims, which the CLI then
      // RECOMPUTES (it never directly becomes the stored guardLevel). --review-mode
      // becomes args.reviewMode (the load-bearing input to the level computation).
      let key;
      if (arg === "--guard-level" || arg === "--claimed-level") key = "claimedLevel";
      else if (arg === "--review-mode") key = "reviewMode";
      else key = arg.slice(2);
      args[key] = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      // A help token ANYWHERE means "show help": set a flag instead of pushing it into
      // args._. Before, only a bare leading `--help` printed help; `demo --help` fell
      // through and RAN demo (writing a throwaway workspace — a help flag with a side
      // effect), and `init --help` errored on a missing --target. main() short-circuits
      // on this flag so every `<command> --help` shows help with zero side effects.
      args.help = true;
    } else if (arg === "--version" || arg === "-v") {
      args.version = true;
    } else if (arg === "--force" || arg === "--json" || arg === "--dry-run") {
      args[arg.slice(2)] = true;
    } else if (arg === "--yes" || arg === "--report-only") {
      // bootstrap flags. --yes confirms the local-scan consent gate (the CLI is
      // non-interactive, so consent is an explicit opt-in flag, not a y/n prompt).
      // --report-only pins bootstrap to its v1 read-only mode (no write-back);
      // mapped to camelCase args.reportOnly. Both are recognized globally so a typo
      // still fails loudly via the "Unknown option" branch below; commands that do
      // not use them simply ignore them.
      if (arg === "--yes") args.yes = true;
      else args.reportOnly = true;
    } else if (arg === "--send-to-model" || arg === "--dry-run-send") {
      // bootstrap's OPT-IN external-model connector — the ONLY path that can send the
      // user's data off this machine. OFF by default: without --send-to-model the report
      // is byte-identical to the pure-local one. --send-to-model enters the consent +
      // redaction + send path; --dry-run-send builds and prints the EXACT redacted
      // payload WITHOUT sending (so the user can audit what would go out). Both are
      // camelCase-mapped (args.sendToModel / args.dryRunSend) and recognized globally so
      // a typo still fails loudly via the "Unknown option" branch below.
      if (arg === "--send-to-model") args.sendToModel = true;
      else args.dryRunSend = true;
    } else if (
      arg === "--subagents" ||
      arg === "--can-switch-model" ||
      arg === "--can-rerun" ||
      arg === "--no-new-conversation"
    ) {
      // Boolean self-report flags for `capability detect` (A2). They let a user
      // OVERRIDE / augment the project-signal probe, since the CLI is
      // non-interactive and cannot ask. camelCase-mapped so the command reads them
      // cleanly: --can-switch-model -> canSwitchModel, --no-new-conversation ->
      // noNewConversation (the one negation; a new conversation is assumed possible
      // by default, so this flag models the strict "one locked conversation" case).
      if (arg === "--subagents") args.subagents = true;
      else if (arg === "--can-switch-model") args.canSwitchModel = true;
      else if (arg === "--can-rerun") args.canRerun = true;
      else if (arg === "--no-new-conversation") args.noNewConversation = true;
    } else if (arg === "--enable-hooks") {
      // Opt-in flag for the adapters install hook layer (OFF by default). Mapped
      // to camelCase args.enableHooks so the rest of the CLI reads it cleanly.
      args.enableHooks = true;
    } else if (arg === "--clean-env") {
      // Opt-in flag for `run exec` (OFF by default, so the default env behavior is
      // unchanged and backward compatible). When set, the spawned command runs with
      // a MINIMAL environment (PATH/HOME + a small necessary set) instead of the
      // caller's full process.env, so a command an AI suggested cannot read your
      // API keys/tokens out of the inherited environment. Mapped to camelCase
      // args.cleanEnv so the rest of the CLI reads it cleanly.
      args.cleanEnv = true;
    } else if (arg === "--owner" || arg === "--owner-accepted") {
      // --owner / --owner-accepted both mark an owner acceptance (the human
      // signing off on a pass_with_risk). The flag is a boolean (presence = an
      // acceptance happened), but it OPTIONALLY takes the actor's name as its
      // next token (`--owner alice`) so the acceptance can be attributed in the
      // audit trail. Backward compatible: a bare `--owner` (end of argv, or
      // immediately followed by another --flag) keeps the old no-name behavior.
      args.ownerAccepted = true;
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args.ownerName = next;
        index += 1;
      }
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      args._.push(arg);
    }
  }
  return args;
}

// The locale resolved ONCE at the top of main() (flag > AI_COLLAB_LANG > OS locale >
// 'en'), held module-level so every user-visible string — including errors thrown
// deep inside a command and caught back in main() — renders in the same language
// without threading `locale` through every signature. Defaults to 'en' so any code
// path that runs before main() resolves it (or in a test importing a helper) still
// gets the canonical English. resolveLocale itself stays pure (env is passed in).
let CURRENT_LOCALE = "en";

// Bind t() to the current run's locale. ALL user-facing CLI text goes through tr()
// (or t(..., CURRENT_LOCALE) for the bilingual render helpers). English is the
// canonical fallback baked into the catalog, so an un-translated key degrades to
// English, never to an empty line.
function tr(key, params = {}) {
  return t(key, params, CURRENT_LOCALE);
}

function emit(args, text, payload) {
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(text);
}

// The no-argument first screen. Deliberately NOT the same as --help: running the
// bare command (a brand-new user's very first contact) used to dump the entire
// 100+ line reference — including the L0-L4 guard-level theory — which buries the
// one thing a newcomer needs (how to start). This prints a short quickstart: a
// one-line positioning sentence, the three commands that actually get you moving
// (init / guide / demo), and a pointer to the full reference + the new-user fast
// path. The full command list and the L0-L4 levels live in `--help` (printHelp),
// which a user reaches only by explicitly asking for everything.
function printQuickstart() {
  console.log(`AI Collaboration Open System — make AI productive on real work through a profile -> context -> acceptance -> guard -> handoff -> harvest loop (local-first; no network).

Not published to npm yet, so run from a clone with: node bin/ai-collab.js <command>

Start with one of these three:
  node bin/ai-collab.js init --target <dir>   Create your workspace (then run one real task through the loop).
  node bin/ai-collab.js guide                 Read the guided first run, step by step.
  node bin/ai-collab.js demo                   Watch the flow on a prepared example (writes to a temp dir).

New here? Run: node bin/ai-collab.js guide
Full command list: node bin/ai-collab.js --help
`);
}

// `welcome` HARD-PRINTS the fixed onboarding intro (welcome.intro) verbatim. The
// flow: the AI finishes installing the pack, runs this command, and shows the user
// its output as-is — so the full "what this collaboration pack adds" intro is
// GUARANTEED to appear complete and accurate, instead of being re-summarized (and
// possibly trimmed/garbled) by the model. The text itself lives in the i18n catalog
// (en canonical + the Owner-locked zh 4th draft), so `--lang zh` prints Chinese via
// the same locale machinery init/bootstrap use; this handler only selects + prints
// it. --json wraps the same text so an integrating tool can capture it.
function welcome(args) {
  emit(args, tr("welcome.intro"), {
    command: "welcome",
    locale: CURRENT_LOCALE,
    text: tr("welcome.intro"),
    network: "not used"
  });
}

function printHelp() {
  console.log(tr("help.main"));
}

// The full L0-L4 guard-level reference, split out of printHelp() so the main --help
// first screen is not a term wall. Reached on demand via `--help levels` / `help levels`.
// Plain-language summary first, then the precise ladder + family-honesty caveats.
function printLevelsHelp() {
  console.log(tr("help.levels"));
}

function guide(args) {
  emit(args, `Start here (recommended first run: your own real task):

The source is on GitHub (CI green); not published to npm yet, so run from a clone with node bin/ai-collab.js.
After publish, the same commands work as the global ai-collab command.

1. Run: node bin/ai-collab.js init --target ./my-ai-workspace
   (after publish: ai-collab init --target ./my-ai-workspace)
2. Open: ./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md
3. Follow its steps on one real (lightly redacted) task of your own:
   define done -> do only that slice -> independent re-check -> handoff -> harvest.
4. Watch an independent re-check reject a thin "done" on work you actually care about.
5. Install the adapter guidance for your AI tool so the same rules drive every session.

Prefer to watch the flow on a prepared example before using your own task?
  Open ./my-ai-workspace/.aict/walkthroughs/10-minute.md (the demo preview) first, then come back to your task.

Track the task lifecycle with the run-layer commands (all take --workspace <dir>):
  task create -> evidence add -> run start/finish -> task update --status <state> -> receipt create.
  A task can only become "done" once it has evidence; with none, use blocked/partial/unverified.
  A receipt states a verdict AND a guard level (L0-L4) for the evidence the guard saw: L0 summary-only can
  only be insufficient_evidence, L1/L2 cannot pass, a clean pass needs the cross-family L3 Evidence Pack, and
  an L4 pass must show the reviewer's own rerun RECONCILED to a recorded run exec (--rerun citing a rerun row whose
  --run points at a finished runs.jsonl run exec with matching exitCode + command + outputSha256). A pass_with_risk receipt is
  created pending and needs an explicit owner sign-off (receipt accept --id <id> --owner) before it is accepted.

Close the loop so it compounds (learning ledger):
  learning add --type harvest --content "..."  captures one reusable lesson; --type profile proposes one
  standing preference. Both land "proposed" until you keep them: learning confirm (as-is), learning edit
  (reword), or learning drop (discard). Only confirmed/edited rows graduate into your profile — at most one
  harvest + one profile per task. Next time, "status" echoes back the one preference you last confirmed.

Workspace map: ./my-ai-workspace/.aict/START_HERE.md
Free/open: complete generic workspace.
Paid help, if offered by a maintainer, is only for calibration and saving time.
Network: not used.
`, {
    command: "guide",
    published: false,
    steps: [
      "node bin/ai-collab.js init --target ./my-ai-workspace",
      "open ./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md",
      "run the 10-minute loop on your own real (lightly redacted) task",
      "watch an independent re-check reject a thin \"done\" on your own task",
      "install adapter guidance so the same rules drive every session"
    ],
    demoPreview: "open ./my-ai-workspace/.aict/walkthroughs/10-minute.md to watch the flow on a prepared example first",
    afterPublish: "ai-collab init --target ./my-ai-workspace",
    network: "not used"
  });
}

function demo(args) {
  // demo needs a writable temp dir to scaffold a throwaway workspace. In a
  // read-only / locked-down environment mkdtemp fails (EPERM/EACCES). Catch it
  // HERE and print a human pointer + exit cleanly, instead of letting the raw
  // "EPERM: operation not permitted, mkdtemp ..." errno bubble up as a stack-y
  // message. The actionable path is `init --target <writable dir>` (or the
  // already-committed walkthrough), which both work without a temp dir.
  let target;
  try {
    target = mkdtempSync(path.join(tmpdir(), "aicos-demo-"));
  } catch (error) {
    const readOnly = error && (error.code === "EPERM" || error.code === "EACCES" || error.code === "EROFS");
    const reason = readOnly
      ? "this looks like a read-only environment (could not create a temp directory)"
      : `could not create a temp directory (${error && error.code ? error.code : error && error.message ? error.message : "unknown error"})`;
    const message = `Demo needs to write a throwaway workspace to a temp directory, but ${reason}.
Instead, scaffold a real workspace in a writable dir:
  node bin/ai-collab.js init --target <writable-dir>
Or read the committed walkthrough directly: .aict/walkthroughs/10-minute.md
Network: not used.`;
    if (args.json) {
      console.error(JSON.stringify({
        command: "demo",
        ok: false,
        reason: "temp-dir-unwritable",
        readOnly: Boolean(readOnly),
        errorCode: error && error.code ? error.code : null,
        hint: "node bin/ai-collab.js init --target <writable-dir>",
        walkthrough: ".aict/walkthroughs/10-minute.md",
        network: "not used"
      }, null, 2));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
    return;
  }
  const result = createWorkspace(target, { force: true });
  emit(args, `Demo workspace created.

Note: demo writes a throwaway workspace to a new temp directory to show the layout without touching your project. In a read-only environment this write can fail (EPERM/EACCES); if so, run "node bin/ai-collab.js init --target <writable-dir>" instead.
Workspace (temporary): ${result.workspaceRoot}
Watch the prepared demo (a worked example, not your task): ${path.join(result.workspaceRoot, "walkthroughs", "10-minute.md")}
It drives the flagship example: ${path.join(result.workspaceRoot, "examples", "ai-coding-long-task", "CASE.md")}
Your real first run goes through your own task: ${path.join(result.workspaceRoot, "walkthroughs", "10-minute-your-task.md")}
Workspace map: ${path.join(result.workspaceRoot, "START_HERE.md")}
Network: not used.
`, {
    command: "demo",
    workspaceRoot: result.workspaceRoot,
    temporary: true,
    note: "demo creates a throwaway temp workspace; in a read-only environment this write can fail (use init --target <writable-dir> instead)",
    demoPreview: path.join(result.workspaceRoot, "walkthroughs", "10-minute.md"),
    firstRun: path.join(result.workspaceRoot, "walkthroughs", "10-minute-your-task.md"),
    startHere: path.join(result.workspaceRoot, "START_HERE.md"),
    flagshipCase: path.join(result.workspaceRoot, "examples", "ai-coding-long-task", "CASE.md"),
    network: "not used"
  });
}

const DEFAULT_DRY_RUN_TARGET = "./my-ai-workspace";

function init(args) {
  const dryRun = Boolean(args["dry-run"]);

  // A real (writing) init must always be given an explicit target so it never
  // silently scaffolds into the current directory. A --dry-run preview writes
  // nothing, so when no --target is given we preview against the default
  // example path instead of erroring out, and tell the user to pass --target
  // when they actually want to write.
  const usedDefaultTarget = dryRun && !args.target;
  if (!args.target && !dryRun) {
    throw new Error(tr("error.missingTarget"));
  }

  const target = path.resolve(args.target ?? DEFAULT_DRY_RUN_TARGET);
  const result = createWorkspace(target, {
    force: Boolean(args.force),
    dryRun,
    // init writes a workspace the user KEEPS, so it also drops a .gitignore that
    // keeps the runtime ledgers (their private task data) out of a routine
    // `git add .`. demo (a throwaway temp preview) and the template generator do not.
    gitignore: true
  });

  if (result.dryRun) {
    const dryBody = tr("init.dryRun.body", {
      workspaceRoot: result.workspaceRoot,
      files: result.files,
      existing: result.existingWorkspace ? tr("init.dryRun.existing.yes") : tr("init.dryRun.existing.no"),
      defaultTargetLine: usedDefaultTarget
        ? tr("init.dryRun.defaultTargetLine", { target: DEFAULT_DRY_RUN_TARGET })
        : "",
      network: tr("common.networkNotUsed")
    });
    emit(args, `${tr("init.dryRun.title")}\n\n${dryBody}\n`, {
      command: "init",
      dryRun: true,
      written: false,
      targetRoot: result.targetRoot,
      workspaceRoot: result.workspaceRoot,
      filesPlanned: result.files,
      existingWorkspace: result.existingWorkspace,
      usedDefaultTarget,
      network: "not used"
    });
    return;
  }

  const createdBody = tr("init.created.body", {
    workspaceRoot: result.workspaceRoot,
    startHere: path.join(result.workspaceRoot, "START_HERE.md"),
    files: result.files,
    backupLine: result.backupPath ? tr("init.backupLine", { backupPath: result.backupPath }) : "",
    network: tr("common.networkNotUsed"),
    walkthroughYourTask: path.join(result.workspaceRoot, "walkthroughs", "10-minute-your-task.md"),
    walkthrough: path.join(result.workspaceRoot, "walkthroughs", "10-minute.md")
  });
  emit(args, `${tr("init.created.title")}\n\n${createdBody}\n`, {
    command: "init",
    dryRun: false,
    written: true,
    targetRoot: result.targetRoot,
    workspaceRoot: result.workspaceRoot,
    startHere: path.join(result.workspaceRoot, "START_HERE.md"),
    filesWritten: result.files,
    backupPath: result.backupPath,
    why: "docs/WHY_THIS_EXISTS.md",
    // First-experience tie-in: point a brand-new user at the value report built
    // from their own work (report-only, local). Surfaced in --json too so an
    // integrating tool can chain it.
    nextValueReport: "node bin/ai-collab.js bootstrap --yes",
    network: "not used"
  });
}

// Resolve the workspace `check` should validate. Same marker as findWorkspace
// (WORKSPACE_MANIFEST.json, which only ever exists inside a real .aict), so that
// `check <project-root>` descends into <root>/.aict instead of being fooled by the
// project root's own START_HERE.md doc. Differs from findWorkspace only in the
// fallback: it returns the input path (not null) so `check` can still validate an
// arbitrary directory and surface its contract errors.
function resolveWorkspace(workspaceArg) {
  const input = path.resolve(workspaceArg);
  if (existsSync(path.join(input, "WORKSPACE_MANIFEST.json"))) return input;
  if (existsSync(path.join(input, ".aict", "WORKSPACE_MANIFEST.json"))) return path.join(input, ".aict");
  return input;
}

function check(args) {
  if (!args.workspace) {
    throw new Error("Missing --workspace. Run: node bin/ai-collab.js check --workspace <dir>");
  }

  const workspace = resolveWorkspace(args.workspace);
  const result = validateWorkspace(workspace);
  if (!result.ok) {
    if (args.json) {
      console.error(JSON.stringify({ command: "check", ok: false, workspace, errors: result.errors }, null, 2));
    } else {
      console.error(`Contract check failed:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
    }
    process.exitCode = 1;
    return;
  }
  emit(args, `Contract check passed.
Workspace: ${workspace}
Checks: ${result.checks}
`, {
    command: "check",
    ok: true,
    workspace,
    checks: result.checks
  });
}

function formatAdapterPlan(plan) {
  if (!plan || plan.length === 0) return "(none)";
  return plan
    .map((entry) => {
      const verb = entry.action === "backup-replace" ? "backup+replace" : "create";
      return `  - ${verb}: ${entry.path} (${entry.tool})`;
    })
    .join("\n");
}

// Human-readable summary of the opt-in hook layer. When hooks were not requested
// or do not apply, this is a single explanatory line (so the default install
// output gains nothing scary). When requested, it lists exactly which local files
// would be created/merged and the one-line uninstall path — meeting the
// "list-before-install + uninstallable + local-only" contract promise.
function formatHookSection(hooks) {
  if (!hooks || !hooks.enabled) {
    return "Hooks: not enabled (opt in with --enable-hooks; never installs a global hook).";
  }
  if (!hooks.applicable) {
    return `Hooks: requested but skipped — ${hooks.reason}.`;
  }
  const verb = (action) => {
    if (action === "backup-replace") return "backup+replace";
    if (action === "merge") return "merge into";
    if (action === "already-present") return "already present, leave";
    if (action === "skip-unparseable") return "unparseable, leave untouched";
    return "create";
  };
  const lines = hooks.plan.map((item) => `  - ${verb(item.action)}: ${item.relativePath}`);
  return [
    "Hooks: project-local Claude Code Stop hook (local-only; no global hook):",
    ...lines,
    "  Reminds you to capture evidence + run `node bin/ai-collab.js receipt create` when you claim a task is done.",
    "  Uninstall: remove the \"ai-collab-receipt-reminder\" entry from the local settings.json above."
  ].join("\n");
}

// Shared message when --tool auto finds no AI tool in the target: never write
// all six silently; tell the user to pick a tool or pass --tool all.
function autoFoundNothingMessage(targetRoot) {
  return `No AI tool detected in ${targetRoot}, so nothing was written.
Pass --tool to choose explicitly, e.g.:
  --tool cursor       install only Cursor rules
  --tool claude,codex install for several tools (comma-separated)
  --tool all          install for all supported tools (cursor, codex, claude, copilot, cline, windsurf)
Detection looks for: .cursor/ or .cursorrules (cursor), .claude/ or CLAUDE.md (claude), AGENTS.md (codex), .github/copilot-instructions.md (copilot), .clinerules (cline), .windsurf/ (windsurf).`;
}

function adapters(args) {
  const subcommand = args._[1];
  if (subcommand !== "install") {
    throw new Error("Unknown adapters command. Run: node bin/ai-collab.js adapters install --target <dir>");
  }
  if (!args.target) {
    throw new Error("Missing --target. Run: node bin/ai-collab.js adapters install --target <dir>");
  }

  const result = installAdapters(args.target, {
    force: Boolean(args.force),
    dryRun: Boolean(args["dry-run"]),
    tool: args.tool,
    enableHooks: Boolean(args.enableHooks)
  });

  // --tool auto matched no tool: report and stop, in both dry-run and real runs.
  if (result.autoFoundNothing) {
    emit(args, `${result.dryRun ? "Dry run. " : ""}${autoFoundNothingMessage(result.targetRoot)}
`, {
      command: "adapters install",
      dryRun: result.dryRun,
      written: false,
      targetRoot: result.targetRoot,
      toolMode: result.toolMode,
      detected: result.detected,
      autoFoundNothing: true,
      filesPlanned: 0,
      plan: [],
      hooks: result.hooks
    });
    return;
  }

  if (result.dryRun) {
    emit(args, `Dry run. No adapter files written.

Target: ${result.targetRoot}
Tool selection: ${result.toolMode}${result.detected ? ` (detected: ${result.detected.join(", ") || "none"})` : ""}
Files planned: ${result.files}
${formatAdapterPlan(result.plan)}
${formatHookSection(result.hooks)}
`, {
      command: "adapters install",
      dryRun: true,
      written: false,
      targetRoot: result.targetRoot,
      toolMode: result.toolMode,
      detected: result.detected,
      filesPlanned: result.files,
      plan: result.plan,
      hooks: result.hooks
    });
    return;
  }

  emit(args, `Adapter guidance installed.

Target: ${result.targetRoot}
Tool selection: ${result.toolMode}${result.detected ? ` (detected: ${result.detected.join(", ") || "none"})` : ""}
Files written: ${result.files}
${formatAdapterPlan(result.plan)}
${formatHookSection(result.hooks)}
Backups: ${result.backups.length}
`, {
    command: "adapters install",
    dryRun: false,
    written: true,
    targetRoot: result.targetRoot,
    toolMode: result.toolMode,
    detected: result.detected,
    filesWritten: result.files,
    plan: result.plan,
    backups: result.backups,
    hooks: result.hooks
  });
}

// --- Run-layer commands (P1) ----------------------------------------------
//
// These five command groups (task / evidence / run / receipt / status) drive the
// JSONL ledgers under <workspace>/state/. They all resolve the same state dir,
// reuse the shared ledger.js read/append helpers (so the on-disk shape can never
// drift from what validate.js reads), and emit via the existing text/--json
// helper. learning-ledger has a generated skeleton + validation but no write
// command yet (its writer is P4).

// Find an EXISTING generated workspace for the run-layer state commands. Unlike
// resolveWorkspace (which falls back to the input path so `check` can validate an
// arbitrary directory and report its contract errors), this returns null when no
// real workspace is present. The marker is WORKSPACE_MANIFEST.json — the machine
// file workspace.js writes into every generated .aict and ONLY there. We must NOT
// key off START_HERE.md: that doc also ships at the PROJECT ROOT (the repo's own
// "start here" guide), so a bare-START_HERE.md probe matches the root and silently
// resolves stateDir to <root>/state instead of the real <root>/.aict/state —
// reading an empty/stray ledger. WORKSPACE_MANIFEST.json never lands at the root,
// so it pins detection to the actual workspace.
function findWorkspace(workspaceArg) {
  const input = path.resolve(workspaceArg);
  if (existsSync(path.join(input, "WORKSPACE_MANIFEST.json"))) return input;
  if (existsSync(path.join(input, ".aict", "WORKSPACE_MANIFEST.json"))) return path.join(input, ".aict");
  return null;
}

// Resolve the state dir the run-layer ledgers live in (always <workspace>/state).
// This REQUIRES a real workspace (one created by init): when none is found we refuse
// with actionable init guidance and write nothing. The old behavior silently
// defaulted to <cwd>/state, scaffolding a stray ./state ledger dir into whatever
// directory the command ran in — including a user's own git repo, where a routine
// `git add .` would then commit their private task data. Refusing is the safe default.
function resolveStateDir(workspaceArg) {
  const root = findWorkspace(workspaceArg ?? ".");
  if (!root) {
    const where = workspaceArg !== undefined
      ? `"${path.resolve(workspaceArg)}"`
      : tr("error.noWorkspace.currentDir");
    throw new Error(tr("error.noWorkspace", { where }));
  }
  return path.join(root, "state");
}

// Generate a real (non-synthetic) timestamp at runtime. The committed templates
// use a fixed synthetic value instead (see workspace.js) so the contract diff
// stays deterministic; only live command runs stamp real time.
function now() {
  return new Date().toISOString();
}

function requireOption(args, name) {
  const value = args[name];
  if (value === undefined || value === "") {
    throw new Error(tr("error.missingOption", { name }));
  }
  return value;
}

// B6a-1: a CONSERVATIVE, NARROW detector of known-destructive command shapes for
// `run exec`. The goal is a high-signal guard that very rarely false-positives on
// ordinary commands: each pattern is anchored to a recognizably dangerous form
// (whole-word / boundary matched), not a loose substring. Returns the list of human
// labels for every pattern the command matches (empty list = not flagged, so the
// default behavior is completely unchanged). Detection only — the caller decides
// whether to prompt, refuse, or run. Conservative by design: a destructive command
// written in an exotic way may slip through (we accept misses to avoid false alarms).
//
// TWO false-positive guards (B6a-1 hardening) applied BEFORE the patterns run, so a
// dangerous WORD that is not actually a command-to-run does not trip the guard:
//   1. QUOTED LITERALS are neutralized. `echo 'rm -rf is dangerous'` mentions rm -rf
//      inside a string — it deletes nothing. stripQuotedLiterals blanks single- and
//      double-quoted spans so a danger token quoted as data is not seen.
//   2. COMMAND POSITION is required for command-name dangers. `grep sudo file.txt` has
//      `sudo` as a SEARCH ARGUMENT, not the command being run. A command-name danger
//      (rm / sudo / dd / mkfs / chmod / curl|wget-pipe) only counts when the word sits
//      at a COMMAND position: the start of the string or right after a shell separator
//      (`;`, `|`, `&`, newline, or `(`) — never merely after another word. Redirect and
//      fork-bomb shapes are operator-based, so they are inherently positional already.
// These narrow the guard further; truly destructive commands (a real `rm -rf /`,
// `curl ... | bash`, `> /dev/sda`) still trip it.

// Blank out single- and double-quoted spans, preserving length (quoted content -> spaces)
// so a danger token that appears only as quoted DATA is not matched, while separators and
// command words OUTSIDE quotes keep their positions. Unbalanced quotes: we blank to end of
// string (a dangling quote is treated as opening a literal, the safe-for-FP direction).
function stripQuotedLiterals(command) {
  let out = "";
  let quote = null; // current open quote char, or null
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) { quote = null; out += " "; } // closing quote -> space
      else out += ch === "\n" ? "\n" : " ";           // quoted content -> space (keep \n)
    } else if (ch === "'" || ch === '"') {
      quote = ch; out += " ";                          // opening quote -> space
    } else {
      out += ch;
    }
  }
  return out;
}

// A command-name danger must sit at a COMMAND position: start-of-string, or just after a
// shell command separator (`;` `|` `&` newline `(`), with optional whitespace. Crucially
// this does NOT include "after a bare space following a word" — so `grep sudo` (sudo as an
// argument) is NOT a match, while `sudo ...`, `foo; sudo ...`, `a && sudo`, `a | sudo` are.
// `body` is the regex source for what follows the command word (flags/args/etc.).
const CMD_POS = "(?:^|[\\n;|&(])\\s*";
function atCommandPosition(word, bodyAfter = "") {
  return new RegExp(`${CMD_POS}${word}${bodyAfter}`);
}

const DANGEROUS_COMMAND_PATTERNS = [
  // rm -rf / rm -fr (recursive + force). `rm` must be the COMMAND (command position),
  // then the combined flag in either order, bundled (`-rf`/`-fr`) or split, or long forms.
  { label: "rm -rf (recursive force delete)", test: (c) =>
    atCommandPosition("rm\\b", "[^\\n|;&]*(?:-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\\b").test(c) ||
    (atCommandPosition("rm\\b").test(c) && /(?:^|\s)-(?:-recursive|r)\b/.test(c) && /(?:^|\s)-(?:-force|f)\b/.test(c)) },
  // sudo (privilege escalation) — only as the command word, not as an argument to another.
  { label: "sudo (privilege escalation)", test: (c) => atCommandPosition("sudo\\s").test(c) },
  // classic bash fork bomb :(){ ... } — an operator shape, inherently positional.
  { label: "fork bomb", test: (c) => /:\(\)\s*\{/.test(c) },
  // piping a network download straight into a shell: curl|sh, wget|bash, etc. curl/wget
  // must be the command of its segment; the pipe-into-a-shell is the destructive part.
  { label: "curl/wget piped into a shell", test: (c) =>
    atCommandPosition("(?:curl|wget)\\b", "[^\\n]*\\|\\s*(?:sudo\\s+)?(?:sh|bash|zsh|dash|ksh|fish)\\b").test(c) },
  // raw disk writer — `dd` as the command word.
  { label: "dd (raw disk write)", test: (c) => atCommandPosition("dd\\s").test(c) },
  // filesystem maker (mkfs, mkfs.ext4, …) — as the command word.
  { label: "mkfs (format filesystem)", test: (c) => atCommandPosition("mkfs(?:\\.\\w+)?\\b").test(c) },
  // redirecting into a device node (> /dev/sda, >/dev/null is excluded as harmless). The
  // `>` operator is inherently a command-position construct (and quotes were stripped).
  { label: "redirect into a /dev/ device", test: (c) =>
    />\s*\/dev\/(?!null\b|zero\b|stdout\b|stderr\b|tty\b|stdin\b|fd\b|random\b|urandom\b)\S+/.test(c) },
  // world-writable recursive chmod — `chmod` as the command word.
  { label: "chmod -R 777 (world-writable recursive)", test: (c) =>
    atCommandPosition("chmod\\b", "[^\\n|;&]*-[a-z]*R[a-z]*\\s+[0-7]*7{3}\\b").test(c) ||
    atCommandPosition("chmod\\b", "[^\\n|;&]*\\s7{3}\\b[^\\n|;&]*-[a-z]*R").test(c) },
  // redirecting a write into a SYSTEM path (clobbers /etc, /usr, /bin, …). Append (>>)
  // is included; reads (<) are not. We exclude the device-node case (handled above).
  { label: "redirect (>) into a system path", test: (c) =>
    /(?<!\d)>>?\s*\/(?:etc|usr|bin|sbin|boot|lib|lib64|sys|proc|var\/(?:lib|spool|log)|System|Library)\b/.test(c) }
];

// Return the labels of every dangerous pattern the command matches (empty = safe to
// run with no extra ceremony). The command is first run through stripQuotedLiterals so a
// danger token quoted as DATA (e.g. echo 'rm -rf ...') is not seen; the command-position
// anchoring (above) handles a danger token used as an ARGUMENT (e.g. grep sudo file).
// Pure; exported-shape kept simple for testing via the CLI.
function detectDangerousCommand(command) {
  if (typeof command !== "string" || command.length === 0) return [];
  const scanned = stripQuotedLiterals(command);
  const hits = [];
  for (const { label, test } of DANGEROUS_COMMAND_PATTERNS) {
    let matched = false;
    try {
      matched = test(scanned);
    } catch {
      matched = false; // a pattern must never crash the guard
    }
    if (matched) hits.push(label);
  }
  return hits;
}

// Ask the user (on an interactive TTY) whether to run a flagged command. Resolves
// true only on an explicit y / yes (case-insensitive); ANY other input — including a
// bare Enter — resolves false (default-deny). Uses node:readline against stdin/stdout.
async function confirmDangerous(command, matchedLabels) {
  const { createInterface } = await import("node:readline");
  process.stdout.write(`${tr("danger.header")}\n`);
  process.stdout.write(`${tr("danger.matched", { patterns: matchedLabels.join(", ") })}\n`);
  process.stdout.write(`${tr("danger.command", { command })}\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolve) => {
      rl.question(tr("danger.prompt"), (reply) => resolve(reply));
    });
    return /^\s*y(es)?\s*$/i.test(answer);
  } finally {
    rl.close();
  }
}

function taskCommand(args) {
  const action = args._[1];
  if (action === "create") return taskCreate(args);
  if (action === "update") return taskUpdate(args);
  throw new Error("Unknown task command. Run: node bin/ai-collab.js task create --title \"...\" | node bin/ai-collab.js task update --task <id> --status <status>");
}

function taskCreate(args) {
  const title = requireOption(args, "title");
  const stateDir = resolveStateDir(args.workspace);
  // B6a-2: allocate the id + append UNDER the ledger lock so two concurrent
  // `task create`s can never mint the same id (the read->nextId->append happens
  // atomically; the ledger is re-read inside the lock).
  const record = appendWithNextId(stateDir, "tasks", "t", (id) => ({
    id, title, status: "open", createdAt: now()
  }));
  emit(args, `Task created.
  id: ${record.id}
  title: ${record.title}
  status: ${record.status}
Ledger: ${path.join(stateDir, "tasks.jsonl")}
`, { command: "task create", ok: true, task: record, stateDir });
}

// task update: change a task's status. Mirrors run finish's read-all -> patch the
// matching row -> rewrite pattern so the ledger stays deterministic and ordered.
// The write-time checks use the SAME shared rules (ledger.js) the validator uses,
// so the CLI can never write a state the validator would reject: the status must
// be a legal task status, and marking a task "done" requires at least one piece
// of evidence (otherwise it is the thin "done" the system exists to catch).
function taskUpdate(args) {
  const taskId = requireOption(args, "task");
  const status = requireOption(args, "status");
  if (!TASK_STATUSES.includes(status)) {
    throw new Error(tr("error.taskStatusInvalid", { allowed: TASK_STATUSES.join(", "), got: status }));
  }
  const stateDir = resolveStateDir(args.workspace);

  const tasks = readLedger(stateDir, "tasks");
  const target = tasks.find((task) => task.id === taskId);
  if (!target) {
    throw new Error(tr("error.taskNotFound.update", { id: taskId }));
  }

  // A task may move to "done" only with evidence pointing at it. Same rule as
  // validator check 5, applied here so a thin "done" is refused at write time.
  let doneWarning = null;
  if (doneRequiresEvidence(status)) {
    const evidence = readLedger(stateDir, "evidence");
    const hasEvidence = evidence.some((item) => item.taskId === taskId);
    if (!hasEvidence) {
      throw new Error(tr("error.doneNoEvidence", { id: taskId }));
    }
    const receipts = readLedger(stateDir, "receipts");
    if (!taskHasAcceptedReceipt(taskId, receipts)) {
      doneWarning = tr("warn.doneNoReceipt", { id: taskId });
      console.warn(doneWarning);
    }
  }

  target.status = status;
  target.updatedAt = now();
  writeLedger(stateDir, "tasks", tasks);
  emit(args, `Task updated.
  id: ${target.id}
  status: ${target.status}
Ledger: ${path.join(stateDir, "tasks.jsonl")}
`, { command: "task update", ok: true, task: target, stateDir, warning: doneWarning });
}

function evidenceCommand(args) {
  const action = args._[1];
  if (action !== "add") {
    throw new Error("Unknown evidence command. Run: node bin/ai-collab.js evidence add --task <id> --kind <k> --summary \"...\"");
  }
  const taskId = requireOption(args, "task");
  const kind = requireOption(args, "kind");
  const summary = requireOption(args, "summary");
  const stateDir = resolveStateDir(args.workspace);

  const tasks = readLedger(stateDir, "tasks");
  if (!tasks.some((task) => task.id === taskId)) {
    throw new Error(tr("error.taskNotFound.evidence", { id: taskId }));
  }
  const evidence = readLedger(stateDir, "evidence");
  // A provisional id (re-stamped authoritatively inside the lock at append time, B6a-2)
  // so the read->nextId->append is atomic against concurrent evidence adds.
  const record = { id: nextId(evidence, "e"), taskId, kind, summary };
  // Structured fields for the two load-bearing kinds (P2 structure gate). They
  // are attached only when given so a generic kind row stays exactly as before
  // (backward compatible). For kind:"rerun" the gate below requires command +
  // exitCode; for kind:"cross_family_guard" at least one attribution field.
  if (kind === EVIDENCE_KIND_RERUN) {
    if (args.command !== undefined && args.command !== "") record.command = args.command;
    if (args.exit !== undefined && args.exit !== "") {
      const exitCode = Number(args.exit);
      if (!Number.isInteger(exitCode)) {
        throw new Error(`--exit must be an integer exit code, got "${args.exit}".`);
      }
      record.exitCode = exitCode;
    }
    // A1: the raw OUTPUT is required for a rerun (an L4 also needs a reconciled
    // run; see --run below). Attached when given; the structure gate refuses a
    // rerun without output.
    if (args.output !== undefined && args.output !== "") record.output = args.output;
    // A1 L4 reconciliation: --run links this rerun to a recorded run in runs.jsonl.
    // OPTIONAL for a generic rerun row (one without it is still valid, it just
    // cannot reach L4), but REQUIRED for the rerun to back an L4 pass. When given,
    // it is validated below against the runs ledger (exists, same task, finished,
    // executed:true, matching exitCode + command + output hash) so a rerun can never reference a run it does not
    // reconcile with — the write-time twin of the validator's reconciliation check.
    if (args.run !== undefined && args.run !== "") record.runId = args.run;
    if (args.runner !== undefined && args.runner !== "") record.runner = args.runner;
  }
  if (kind === EVIDENCE_KIND_CROSS_FAMILY_GUARD) {
    if (args.reviewer !== undefined && args.reviewer !== "") record.reviewer = args.reviewer;
    if (args.family !== undefined && args.family !== "") record.family = args.family;
    if (args.ref !== undefined && args.ref !== "") record.ref = args.ref;
  }
  if (args.detail !== undefined && args.detail !== "") record.detail = args.detail;
  record.createdAt = now();
  // Reject an empty-shell special kind at WRITE time, using the SAME shared
  // predicate the validator applies, so the CLI can never emit a load-bearing
  // evidence row the validator would reject (e.g. a cross_family_guard with no
  // reviewer/family/ref, or a rerun with no command/exitCode). Generic kinds
  // return null here and are unaffected.
  const structureError = specialEvidenceStructureError(record);
  if (structureError) {
    throw new Error(`Cannot add evidence: ${structureError}.`);
  }
  // A1 L4 reconciliation (write-time): if a rerun row names a runId, that run must
  // exist in runs.jsonl, belong to the same task, be finished, be recorded by run
  // exec, and agree on exitCode + command + output hash — the SAME
  // rerunRunReconcileError the validator applies, so
  // a rerun that does not reconcile is refused at add-time rather than silently
  // stored as an L4-incapable row whose runId looks valid. A rerun with NO runId is
  // allowed through here (it is a valid generic rerun; it just cannot reach L4) — we
  // only reconcile a runId that was actually supplied.
  if (record.kind === EVIDENCE_KIND_RERUN && record.runId !== undefined) {
    const runs = readLedger(stateDir, "runs");
    const reconcileError = rerunRunReconcileError(record, runs);
    if (reconcileError) {
      throw new Error(`Cannot add evidence: ${reconcileError}.`);
    }
  }
  // P2 soft kind-check (advisory, NOT a gate): evidence kind is free-form by
  // design, so an unrecognized kind is still RECORDED — but a typo like
  // "--kind reun" (meant "rerun") would otherwise become a silent generic row the
  // author thinks is a rerun. Warn on stderr (so --json stdout stays clean) when
  // the kind is not one the tool gives meaning to, naming that it was recorded as
  // a generic row that does NOT raise the guard level. The row is appended either
  // way; this never errors or blocks. (Empty-shell special kinds were already
  // rejected above, so a known load-bearing kind that reaches here is well-formed.)
  if (!isRecognizedEvidenceKind(record.kind)) {
    console.warn(
      `Warning: '${record.kind}' is not a recognized kind; recorded as a generic evidence row that won't raise the guard level.`
    );
  }
  // B6a-2: re-stamp the authoritative id and append UNDER the lock so a concurrent
  // evidence add cannot mint the same id.
  appendWithNextId(stateDir, "evidence", "e", (id) => { record.id = id; return record; });
  emit(args, `Evidence added.
  id: ${record.id}
  task: ${record.taskId}
  kind: ${record.kind}
  summary: ${record.summary}
Ledger: ${path.join(stateDir, "evidence.jsonl")}
`, { command: "evidence add", ok: true, evidence: record, stateDir });
}

// The minimal environment `run exec --clean-env` spawns a command with. By default
// run exec inherits the caller's FULL process.env (which can hold API keys, tokens,
// cloud credentials), so a command an AI suggested could read those secrets. With
// --clean-env we hand the child only the small set a normal local command needs to
// resolve binaries and a home dir — PATH and HOME above all — and DROP everything
// else, so no inherited secret reaches the subprocess. We pass through only NAMED,
// non-secret operational vars (never a wildcard), each carried only when actually
// set in the parent:
//   PATH        - find the command + its tools (without it almost nothing runs)
//   HOME        - the user's home dir (tools resolve config/cache relative to it)
//   SHELL, LANG, LC_ALL, TERM, TMPDIR, TZ - locale/term/temp basics for normal CLIs
//   PATHEXT, SystemRoot, ComSpec, USERPROFILE - the Windows equivalents of PATH/HOME
// Intentionally EXCLUDED: anything not on this list — that is where keys/tokens live
// (e.g. *_API_KEY, *_TOKEN, AWS_*, OPENAI_API_KEY, GITHUB_TOKEN). The result is a
// brand-new object, so a parent variable that is NOT named here simply does not exist
// for the child.
const CLEAN_ENV_PASSTHROUGH = [
  "PATH",
  "HOME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "TERM",
  "TMPDIR",
  "TZ",
  // Windows equivalents, carried so --clean-env works cross-platform.
  "PATHEXT",
  "SystemRoot",
  "ComSpec",
  "USERPROFILE"
];

function buildCleanEnv(sourceEnv = process.env) {
  const clean = {};
  for (const key of CLEAN_ENV_PASSTHROUGH) {
    if (typeof sourceEnv[key] === "string") clean[key] = sourceEnv[key];
  }
  return clean;
}

async function runCommand(args) {
  const action = args._[1];
  const stateDir = resolveStateDir(args.workspace);

  if (action === "start") {
    const taskId = requireOption(args, "task");
    const tasks = readLedger(stateDir, "tasks");
    if (!tasks.some((task) => task.id === taskId)) {
      throw new Error(tr("error.taskNotFound.runStart", { id: taskId }));
    }
    const runs = readLedger(stateDir, "runs");
    // Provisional id; re-stamped authoritatively inside the lock at append (B6a-2).
    const record = { id: nextId(runs, "r"), taskId, startedAt: now(), status: "running" };
    if (args.command !== undefined && args.command !== "") record.command = args.command;
    // B6a-2: allocate id + append UNDER the lock (atomic vs concurrent run starts/execs).
    appendWithNextId(stateDir, "runs", "r", (id) => { record.id = id; return record; });
    emit(args, `Run started.
  id: ${record.id}
  task: ${record.taskId}
  status: ${record.status}${record.command ? `\n  command: ${record.command}` : ""}
Ledger: ${path.join(stateDir, "runs.jsonl")}
`, { command: "run start", ok: true, run: record, stateDir });
    return;
  }

  if (action === "finish") {
    const taskId = requireOption(args, "task");
    const exitRaw = requireOption(args, "exit");
    const exitCode = Number(exitRaw);
    if (!Number.isInteger(exitCode)) {
      throw new Error(`--exit must be an integer exit code, got "${exitRaw}".`);
    }
    // Finish the most recent still-running run for this task. Read-all -> patch
    // the matching line -> rewrite keeps the ledger deterministic and ordered.
    // B6a-2: the whole read-all -> patch -> rewrite runs UNDER the ledger lock so a
    // concurrent run start/exec append cannot be clobbered by the rewrite (the read
    // and the write are serialized against other writers). The ledger is re-read
    // INSIDE the lock, so we patch the freshest rows.
    let target = null;
    rewriteLedgerUnderLock(stateDir, "runs", (runs) => {
      for (let i = runs.length - 1; i >= 0; i -= 1) {
        if (runs[i].taskId === taskId && runs[i].status === "running") {
          target = runs[i];
          break;
        }
      }
      if (!target) {
        throw new Error(`No running run found for task ${taskId}. Start one first: node bin/ai-collab.js run start --task ${taskId}.`);
      }
      target.finishedAt = now();
      target.exitCode = exitCode;
      target.status = "finished";
      return runs;
    });
    emit(args, `Run finished.
  id: ${target.id}
  task: ${target.taskId}
  exitCode: ${target.exitCode}
  status: ${target.status}
Ledger: ${path.join(stateDir, "runs.jsonl")}
`, { command: "run finish", ok: true, run: target, stateDir });
    return;
  }

  if (action === "exec") {
    // run exec ACTUALLY runs the command locally and records the REAL exit code —
    // unlike run start/finish, which RECORD a command + an exit code you report. This
    // is the honest, higher-authenticity path: the recorded run reflects a process
    // that genuinely ran on this machine (marked executed:true), so a rerun reconciled
    // to it is anchored to a real local execution rather than a typed number. Local
    // only — it spawns YOUR command in YOUR shell; it never goes online.
    const taskId = requireOption(args, "task");
    const command = requireOption(args, "command");
    const tasks = readLedger(stateDir, "tasks");
    if (!tasks.some((task) => task.id === taskId)) {
      throw new Error(tr("error.taskNotFound.runExec", { id: taskId }));
    }
    // B6a-1: conservative dangerous-command guard. Only a NARROW set of known
    // destructive shapes (rm -rf, sudo, fork bomb, curl|sh, dd, mkfs, > /dev/,
    // chmod -R 777, redirect into a system path) trips this; anything else runs
    // exactly as before (no behavior change). --yes/--force is an explicit opt-out
    // (run it anyway, skip confirmation). On a real TTY we ask y/N (default N). With
    // NO interactive terminal (a script / an AI calling the CLI) we REFUSE rather than
    // silently run a destructive command — the caller must pass --yes to proceed.
    // A refusal executes nothing and records nothing. `dangerousConfirmed` is stamped
    // on the run only when the guard actually fired and the user/flag confirmed it, so
    // the ledger shows a flagged command was knowingly approved.
    const dangerLabels = detectDangerousCommand(command);
    const preApproved = args.yes === true || args.force === true;
    let dangerousConfirmed = false;
    if (dangerLabels.length > 0 && !preApproved) {
      if (process.stdin.isTTY) {
        const ok = await confirmDangerous(command, dangerLabels);
        if (!ok) {
          // Default-deny: print the refusal to stderr (so --json stdout stays clean)
          // and exit non-zero. Nothing ran, nothing was recorded.
          console.error(tr("danger.declined"));
          process.exitCode = 1;
          return;
        }
        dangerousConfirmed = true;
      } else {
        // Non-interactive: refuse and tell the caller how to override. Exit non-zero;
        // nothing ran, nothing recorded.
        console.error(tr("danger.refusedNonTty", { patterns: dangerLabels.join(", ") }));
        process.exitCode = 1;
        return;
      }
    } else if (dangerLabels.length > 0 && preApproved) {
      // Flagged but explicitly pre-approved via --yes/--force: run it, and record that
      // it was a knowingly-confirmed dangerous command.
      dangerousConfirmed = true;
    }
    // B3-1: run the command in the WORKSPACE'S project root by default, not in the
    // caller's process.cwd(). stateDir is <root>/.aict/state, so the project root is
    // dirname(dirname(stateDir)) — the directory that holds the .aict the run is
    // recorded under. Running in process.cwd() let a command execute in an unrelated
    // directory (whatever you happened to be in) while being filed as evidence for
    // THIS workspace — silent evidence pollution (the rerun anchors to a run that did
    // not run where the task lives). --cwd <dir> overrides it explicitly. The resolved
    // cwd must exist and be a directory, and is RECORDED on the run + PRINTED, so the
    // evidence says exactly where it ran.
    const workspaceRoot = path.dirname(path.dirname(stateDir));
    const cwd = path.resolve(args.cwd ?? workspaceRoot);
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
      throw new Error(`--cwd "${cwd}" is not an existing directory. Point run exec at a real working directory (defaults to the workspace root). Nothing recorded.`);
    }
    // --clean-env (opt-in): run with a MINIMAL env (PATH/HOME + a small named set)
    // instead of inheriting the caller's full process.env, so a command an AI
    // suggested cannot read inherited API keys/tokens. DEFAULT is unchanged: the
    // full process.env is inherited (backward compatible). Whether the run was
    // sandboxed this way is recorded on the run + printed, so the evidence says how
    // it ran.
    const cleanEnv = args.cleanEnv === true;
    const childEnv = cleanEnv ? buildCleanEnv(process.env) : process.env;
    const startedAt = now();
    const result = spawnSync(command, {
      shell: true,
      cwd,
      encoding: "utf8",
      timeout: 10 * 60 * 1000, // 10 min cap so a hung command cannot wedge the CLI
      maxBuffer: 10 * 1024 * 1024,
      env: childEnv
    });
    const finishedAt = now();
    // Only a command that ran to completion has a numeric exit status. (Under shell:true
    // a missing command is the SHELL exiting 127 — a real, recorded exit.) status is null
    // only when the SHELL itself could not run it: failed to spawn, timed out, was killed
    // by a signal, or its output exceeded the buffer cap. In those cases record NOTHING and
    // surface a clear reason, so the ledger never gets a half-real run.
    if (result.status === null) {
      const why = result.error && result.error.code === "ETIMEDOUT"
        ? "timed out after 10 minutes"
        : result.error
          ? result.error.message
          : "did not return an exit code (killed, or output exceeded the 10 MB capture cap)";
      throw new Error(`Command did not complete (${why}): ${command}. Nothing recorded.`);
    }
    const exitCode = result.status;
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const rawOutput = `${stdout}${stderr}`.trim();
    const output = rawOutput.length > 4000 ? `${rawOutput.slice(0, 4000)}\n…[truncated]` : rawOutput;
    const runs = readLedger(stateDir, "runs");
    const record = {
      // Provisional id; re-stamped authoritatively inside the lock at append (B6a-2).
      id: nextId(runs, "r"),
      taskId,
      command,
      cwd,
      startedAt,
      finishedAt,
      exitCode,
      status: "finished",
      executed: true,
      // Records whether this run was sandboxed with --clean-env (minimal env, no
      // inherited secrets). Always present so the ledger says how every executed run
      // got its environment — false is the default full-env inherit.
      cleanEnv,
      // B6a-1: stamped true ONLY when the dangerous-command guard fired and the run
      // was knowingly approved (a y on the TTY prompt, or an explicit --yes/--force).
      // Omitted entirely on an ordinary run, so non-flagged runs are unchanged.
      ...(dangerousConfirmed ? { dangerousConfirmed: true } : {}),
      outputSha256: outputSha256(rawOutput),
      outputBytes: outputByteLength(rawOutput),
      stdoutBytes: outputByteLength(stdout.trim()),
      stderrBytes: outputByteLength(stderr.trim())
    };
    // B6a-2: re-stamp id + append UNDER the lock (atomic vs concurrent run execs/starts).
    appendWithNextId(stateDir, "runs", "r", (id) => { record.id = id; return record; });
    emit(args, `Run executed (real local run; the tool ran this command and captured the real exit code).
  id: ${record.id}
  task: ${record.taskId}
  command: ${record.command}
  cwd: ${record.cwd}
  exitCode: ${record.exitCode}
  status: ${record.status}
  executed: true
  cleanEnv: ${record.cleanEnv}${cleanEnv ? " (minimal env: PATH/HOME + basics only; inherited secrets withheld)" : " (inherited the full environment)"}${dangerousConfirmed ? "\n  dangerousConfirmed: true (matched a known destructive pattern; run was explicitly approved)" : ""}
Ledger: ${path.join(stateDir, "runs.jsonl")}
`, { command: "run exec", ok: true, run: record, output, stateDir });
    return;
  }

  throw new Error("Unknown run command. Run: node bin/ai-collab.js run start --task <id> | node bin/ai-collab.js run finish --task <id> --exit <code> | node bin/ai-collab.js run exec --task <id> --command \"...\"");
}

function receiptCommand(args) {
  const action = args._[1];
  if (action === "create") return receiptCreate(args);
  if (action === "accept") return receiptAccept(args);
  throw new Error("Unknown receipt command. Run: node bin/ai-collab.js receipt create --task <id> --verdict <v> --guard-level <L0-L4> [--evidence <id,id>] [--rerun <id,id>] | node bin/ai-collab.js receipt accept --id <id> --owner");
}

// Parse a comma-separated id list flag into a clean array (trimmed, no blanks).
function parseIdList(value) {
  return value ? value.split(",").map((id) => id.trim()).filter((id) => id.length > 0) : [];
}

function receiptCreate(args) {
  const taskId = requireOption(args, "task");
  const verdict = requireOption(args, "verdict");
  if (!RECEIPT_VERDICTS.includes(verdict)) {
    throw new Error(`--verdict must be one of: ${RECEIPT_VERDICTS.join(", ")} (got "${verdict}").`);
  }
  // A1: the author records the REVIEW METHOD (--review-mode) and MAY state a
  // claimed level (--claimed-level / legacy --guard-level), but neither becomes
  // the stored guard level directly. The CLI RECOMPUTES the real level from the
  // method + the evidence (see below). --review-mode is optional (inferred from
  // evidence when omitted, for backward compatibility); a claimed level, when
  // given, is only used to WARN if it overstated the truth.
  const reviewMode = args.reviewMode;
  if (reviewMode !== undefined && !REVIEW_MODES.includes(reviewMode)) {
    throw new Error(`--review-mode must be one of: ${REVIEW_MODES.join(", ")} (got "${reviewMode}").`);
  }
  const claimedLevel = args.claimedLevel; // legacy --guard-level maps here too.
  if (claimedLevel !== undefined && !GUARD_LEVELS.includes(claimedLevel)) {
    throw new Error(`--claimed-level (a.k.a. --guard-level) must be one of: ${GUARD_LEVELS.join(", ")} (got "${claimedLevel}").`);
  }
  const stateDir = resolveStateDir(args.workspace);

  const tasks = readLedger(stateDir, "tasks");
  if (!tasks.some((task) => task.id === taskId)) {
    throw new Error(tr("error.taskNotFound.receipt", { id: taskId }));
  }
  const evidenceIds = parseIdList(args.evidence);
  const rerunEvidenceIds = parseIdList(args.rerun);
  const evidence = readLedger(stateDir, "evidence");
  const known = new Set(evidence.map((item) => item.id));
  // Every cited id (plain evidence + rerun evidence) must exist and belong to
  // this task. Reusing the SAME ownedEvidenceIds filter the validator applies
  // keeps write-time and read-time on one definition; rerun ids are validated on
  // the same footing so an L4 claim cannot borrow another task's run.
  for (const [label, ids] of [["evidence", evidenceIds], ["rerun evidence", rerunEvidenceIds]]) {
    if (ids.length === 0) continue;
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length > 0) {
      throw new Error(`Receipt cites unknown ${label} id(s): ${missing.join(", ")}.`);
    }
    const owned = new Set(ownedEvidenceIds(ids, taskId, evidence));
    const foreign = ids.filter((id) => !owned.has(id));
    if (foreign.length > 0) {
      throw new Error(`Receipt for task ${taskId} cites ${label} from another task: ${foreign.join(", ")}. A receipt may only cite evidence belonging to its own task.`);
    }
  }

  // A1 CORE: COMPUTE the real guard level from the review method + the evidence.
  // The level is NOT taken from --claimed-level; it is derived so an AI cannot
  // self-assert a high level. The evidence-strength flags are computed from rows
  // that actually BELONG to this task and carry the load-bearing kind (and, for
  // rerun, the required OUTPUT), so identity claims never raise the level — only
  // real evidence does. See computeGuardLevel for the min(method-ceiling, evidence)
  // rule that is the anti-silent-green mechanism. A1 L4 reconciliation: ownedRerun
  // is now gated on the runs ledger too — a cited rerun only counts toward L4 if it
  // references a recorded run exec that reconciles (same task, finished,
  // executed:true, exitCode + command + output hash agree), so a self-authored rerun with a fabricated output cannot reach
  // L4 here.
  const runs = readLedger(stateDir, "runs");
  const ownedRerun = ownedRerunEvidenceIds(rerunEvidenceIds, taskId, evidence, runs);
  const ownedCrossFamily = ownedCrossFamilyGuardEvidenceIds(evidenceIds, taskId, evidence);
  const computed = computeGuardLevel({
    reviewMode,
    hasCrossFamilyGuardEvidence: ownedCrossFamily.length > 0,
    hasRerunOutputEvidence: ownedRerun.length > 0,
    hasAuthorRunEvidence: hasOwnedRunEvidence(evidenceIds, taskId, evidence),
    hasAnyEvidence: ownedEvidenceIds(evidenceIds, taskId, evidence).length > 0
  });
  const guardLevel = computed.level; // the COMPUTED level, never the claimed one.

  // If the author claimed a HIGHER level than the evidence + method support, do
  // not silently accept it: keep the computed (lower) level and warn. A claim that
  // matches or undersells the computed level is fine (we never bump it up to a
  // claim, only down to the evidence). This is "AI cannot self-declare the level".
  let claimDowngradeNote = null;
  if (claimedLevel !== undefined && guardLevelRank(claimedLevel) > guardLevelRank(guardLevel)) {
    claimDowngradeNote = `claimed ${claimedLevel} but evidence supports ${guardLevel} — recorded as ${guardLevel} (${computed.reason})`;
  }

  // P2 core (now applied to the COMPUTED level): enforce the verdict x guardLevel
  // consistency rule at WRITE time with the SAME shared predicate the validator
  // uses, so the CLI can never emit a row the validator would reject (an L0/L1/L2/
  // L2.5 "pass", an L3 "pass" with no cross_family_guard row, or an L4 "pass" with
  // no rerun output). Because guardLevel is the computed value, a "pass" verdict
  // that the evidence cannot back is refused here.
  const consistencyError = guardLevelVerdictError(
    guardLevel,
    verdict,
    ownedRerun.length > 0,
    ownedCrossFamily.length > 0,
    rerunEvidenceIds.length > 0
  );
  if (consistencyError) {
    throw new Error(`Inconsistent receipt: ${consistencyError}.`);
  }

  const receipts = readLedger(stateDir, "receipts");
  // Map verdict + evidence -> receipt status via the SHARED rule so the writer can
  // never emit a row the validator rejects. receiptStatusFor and receipt accept both
  // key on owned regular evidence (ownedEvidenceIds), so they never disagree on what
  // "has backing" means. Under the L4 rule (computeGuardLevel) a clean pass needs L3+,
  // which requires a cited cross_family_guard evidence row — so a pass always has
  // same-task evidenceIds and auto-accepts; it can never land in a contradictory
  // pass+pending. A "pass_with_risk" is written "pending" and needs `receipt accept
  // --owner` (P2 gate); reject/insufficient -> rejected.
  const status = receiptStatusFor(verdict, ownedEvidenceIds(evidenceIds, taskId, evidence), false);
  // Record shape: the COMPUTED guardLevel + the resolved reviewMode are stored so
  // the row carries HOW it was reviewed and the level that method+evidence earned
  // (not what was claimed). familyUnverified is stored only when TRUE — it marks a
  // self-declared cross-family level the tool could not verify, so a reader never
  // mistakes an L3 for an independently-checked pass. Field order matches the seed
  // generator so the on-disk shape is identical.
  // Provisional id; re-stamped authoritatively inside the lock at append (B6a-2).
  const record = { id: nextId(receipts, "c"), taskId, verdict, guardLevel, reviewMode: computed.reviewMode, evidenceIds };
  if (rerunEvidenceIds.length > 0) record.rerunEvidenceIds = rerunEvidenceIds;
  if (computed.familyUnverified) record.familyUnverified = true;
  record.status = status;
  record.createdAt = now();
  // B6a-2: re-stamp id + append UNDER the lock (atomic vs concurrent receipt creates).
  appendWithNextId(stateDir, "receipts", "c", (id) => { record.id = id; return record; });
  const honesty = familyHonestyMarker(computed.familyUnverified);
  // "Why this level" (P-getitback): one plain sentence explaining what evidence
  // backed the COMPUTED level and the concrete next step to the level above, so a
  // user who followed the docs but landed at (say) L1 is not left wondering why it
  // was not the L2 the docs mentioned. Derived from the SAME owned-evidence flags
  // the level was computed from (never asserts a level higher than guardLevel), so
  // it cannot mislead the user into overstating the receipt. ownedRerun is the
  // RECONCILED rerun set (the L4-grade one); the bare --rerun count is surfaced as
  // "cited a rerun" only when it is reconciled, matching what actually counts.
  const levelWhy = guardLevelExplanation({
    level: guardLevel,
    hasCrossFamilyGuardEvidence: ownedCrossFamily.length > 0,
    hasReconciledRerunEvidence: ownedRerun.length > 0,
    hasRerunOutputEvidence: ownedRerun.length > 0,
    hasAuthorRunEvidence: hasOwnedRunEvidence(evidenceIds, taskId, evidence),
    hasAnyEvidence: ownedEvidenceIds(evidenceIds, taskId, evidence).length > 0
  });
  record.levelExplanation = levelWhy; // surfaced in --json so a tool can show it too
  const l4ExecutionNote = guardLevel === "L4" && ownedRerun.length > 0
    ? "L4 local execution evidence: the cited rerun reconciles to a recorded run exec output (command, exit code, and output hash match)"
    : null;
  emit(args, `Receipt created.
  id: ${record.id}
  task: ${record.taskId}
  verdict: ${record.verdict}
  guardLevel: ${record.guardLevel} (computed)${honesty ? ` [${honesty}]` : ""}
  why: ${levelWhy}
  reviewMode: ${record.reviewMode}
  status: ${record.status}
  evidence: ${evidenceIds.length > 0 ? evidenceIds.join(", ") : "(none)"}${rerunEvidenceIds.length > 0 ? `\n  rerun: ${rerunEvidenceIds.join(", ")}` : ""}${claimDowngradeNote ? `\n  note: ${claimDowngradeNote}` : ""}${honesty ? `\n  note: the cross-family family is ${honesty}; local rerun evidence verifies execution/output only, not model-family identity` : ""}${l4ExecutionNote ? `\n  note: ${l4ExecutionNote}` : ""}${status === "pending" && verdict === "pass_with_risk" ? "\n  (pass_with_risk: pending owner acceptance — run: node bin/ai-collab.js receipt accept --id " + record.id + " --owner)" : ""}
Ledger: ${path.join(stateDir, "receipts.jsonl")}
`, { command: "receipt create", ok: true, receipt: record, stateDir });
}

// P2 owner-acceptance gate: a pass_with_risk receipt is created "pending" and
// only an explicit owner sign-off moves it to "accepted". This is the human
// accepting the named residual risk on the record. The accept is refused unless
// the verdict is pass_with_risk, the receipt is currently pending, and it has
// same-task evidence — so an owner cannot accept a risk receipt that has no
// evidence of its own (which the validator would then reject anyway).
//
// IMPORTANT (this is a LOCAL collaboration audit record, not cryptographic
// proof): the owner acceptance is a human sign-off captured locally — actor name
// + timestamp on the record. It is NOT a signature and makes NO anti-forgery
// claim; a single-user local-first tool trusts the local actor. What it DOES
// guarantee is consistency: an accepted risk receipt must carry the marker and
// have own-task evidence, and its (verdict, level, evidence) must be internally
// consistent (F2) — so the status can never claim more than the rule grants.
function receiptAccept(args) {
  const id = requireOption(args, "id");
  if (args.ownerAccepted !== true) {
    throw new Error("receipt accept requires --owner (the human accepting the named residual risk on the record).");
  }
  const stateDir = resolveStateDir(args.workspace);
  const receipts = readLedger(stateDir, "receipts");
  const target = receipts.find((receipt) => receipt.id === id);
  if (!target) {
    throw new Error(`Receipt ${id} not found.`);
  }
  if (target.verdict !== "pass_with_risk") {
    throw new Error(`Receipt ${id} has verdict "${target.verdict}"; only pass_with_risk receipts need an owner acceptance.`);
  }
  if (target.status === "accepted") {
    throw new Error(`Receipt ${id} is already accepted.`);
  }
  if (target.status !== "pending") {
    throw new Error(`Receipt ${id} has status "${target.status}"; only a pending receipt can be owner-accepted.`);
  }
  const evidence = readLedger(stateDir, "evidence");
  const owned = ownedEvidenceIds(Array.isArray(target.evidenceIds) ? target.evidenceIds : [], target.taskId, evidence);
  if (owned.length === 0) {
    throw new Error(`Receipt ${id} cites no evidence belonging to task ${target.taskId}; cannot accept a risk receipt with no own-task evidence.`);
  }
  // F2: RE-RUN the verdict x guardLevel consistency gate before accepting, using
  // the SAME shared predicate as create/validate. The accept path used to trust
  // the stored row, so a hand-written pending row that is itself inconsistent
  // (e.g. pass_with_risk at guardLevel L0, which L0 can never carry) could be
  // promoted to "accepted" and only the validator would object after the fact.
  // Refusing here makes accept-time and create-time agree: you cannot launder an
  // inconsistent receipt into accepted via the owner gate.
  const targetRerunIds = Array.isArray(target.rerunEvidenceIds) ? target.rerunEvidenceIds : [];
  const runs = readLedger(stateDir, "runs");
  const ownedRerun = ownedRerunEvidenceIds(targetRerunIds, target.taskId, evidence, runs);
  const ownedCrossFamily = ownedCrossFamilyGuardEvidenceIds(Array.isArray(target.evidenceIds) ? target.evidenceIds : [], target.taskId, evidence);
  const consistencyError = guardLevelVerdictError(target.guardLevel, target.verdict, ownedRerun.length > 0, ownedCrossFamily.length > 0, targetRerunIds.length > 0);
  if (consistencyError) {
    throw new Error(`Cannot accept inconsistent receipt ${id}: ${consistencyError}.`);
  }
  // Recompute status through the SHARED rule with ownerAccepted=true so the
  // accepted state always matches receiptStatusFor (no hand-set "accepted").
  target.ownerAccepted = true;
  // F4: record WHO accepted (actor name from --owner <name>, defaulting to a
  // generic "owner" when no name was given) and WHEN, as a local audit trail.
  // This is a human sign-off record, not a cryptographic signature.
  target.acceptedBy = typeof args.ownerName === "string" && args.ownerName.length > 0 ? args.ownerName : "owner";
  target.acceptedAt = now();
  target.status = receiptStatusFor(target.verdict, owned, true);
  // F2 belt-and-braces: the recomputed status must be "accepted" here (owned
  // evidence + ownerAccepted=true on a pass_with_risk). If the shared rule ever
  // returned anything else, refuse rather than write a contradicting row.
  if (target.status !== "accepted") {
    throw new Error(`Cannot accept receipt ${id}: the consistency rule computes status "${target.status}", not "accepted".`);
  }
  writeLedger(stateDir, "receipts", receipts);
  emit(args, `Receipt accepted by owner (local sign-off recorded — not a cryptographic signature).
  id: ${target.id}
  task: ${target.taskId}
  verdict: ${target.verdict}
  guardLevel: ${target.guardLevel}
  status: ${target.status}
  ownerAccepted: true
  acceptedBy: ${target.acceptedBy}
Ledger: ${path.join(stateDir, "receipts.jsonl")}
`, { command: "receipt accept", ok: true, receipt: target, stateDir });
}

// --- Learning ledger (P4) --------------------------------------------------
//
// The learning ledger turns "what we learned this task" into something the next
// task can feel. A learning row is one captured lesson (type "harvest") or one
// suggested standing preference (type "profile"), proposed by the AI and then
// kept or discarded by the human through the SAME proposed/confirmed/edited/
// dropped discipline the profile-candidate buffer and the harvest mechanism use —
// nothing graduates on the AI's say-so alone. Only confirmed/edited rows count as
// kept; the status command echoes back the latest kept profile preference so the
// tool feels like it is learning how you work, without making you maintain a
// system. All shape rules live in ledger.js (learningRecordError) so the writer
// here can never emit a row the validator would reject.
//
// Discipline (deliberately a CONVENTION, not a hard limiter): each task close-out
// should propose AT MOST one harvest lesson and one profile candidate (see the
// walkthrough Step 4 and the harvest mechanism). The point of P4 is that the user
// feels understood, not buried — so the cap is documented and the recall shows
// ONE preference, but `learning add` does not silently refuse a third row: a hard
// limit here would fight legitimate manual use and a corrupt-state edge (e.g.
// re-adding after a drop). Keeping it advisory matches how the rest of the loop
// trusts the human to dispose.
function learningCommand(args) {
  const action = args._[1];
  if (action === "add") return learningAdd(args);
  if (action === "confirm") return learningSetStatus(args, "confirmed");
  if (action === "edit") return learningEdit(args);
  if (action === "drop") return learningSetStatus(args, "dropped");
  throw new Error(
    "Unknown learning command. Run: node bin/ai-collab.js learning add --type <harvest|profile> --content \"...\" [--task <id>] | node bin/ai-collab.js learning confirm --id <id> | node bin/ai-collab.js learning edit --id <id> --content \"...\" | node bin/ai-collab.js learning drop --id <id>"
  );
}

function learningAdd(args) {
  const type = requireOption(args, "type");
  const content = requireOption(args, "content");
  if (!LEARNING_TYPES.includes(type)) {
    throw new Error(`--type must be one of: ${LEARNING_TYPES.join(", ")} (got "${type}").`);
  }
  const stateDir = resolveStateDir(args.workspace);

  // --task is OPTIONAL (a lesson need not belong to one task), but when given it
  // must point at a real task — a learning row bound to a non-existent task is a
  // dangling reference, the same standard evidence/run/receipt rows hold to.
  let taskId;
  if (args.task !== undefined && args.task !== "") {
    const tasks = readLedger(stateDir, "tasks");
    if (!tasks.some((task) => task.id === args.task)) {
      throw new Error(tr("error.taskNotFound.learning", { id: args.task }));
    }
    taskId = args.task;
  }

  const learning = readLedger(stateDir, "learning");
  // Field order mirrors the generated seed (id, taskId?, type, content, status,
  // createdAt) so a hand read of the ledger stays predictable. New rows are always
  // "proposed": a freshly captured lesson/preference is an un-reviewed guess until
  // the human confirms/edits/drops it.
  // Provisional id; re-stamped authoritatively inside the lock at append (B6a-2).
  const record = { id: nextId(learning, "l") };
  if (taskId !== undefined) record.taskId = taskId;
  record.type = type;
  record.content = content;
  record.status = "proposed";
  record.createdAt = now();

  // Reject a malformed row at WRITE time using the SAME shared predicate the
  // validator applies (so the CLI can never emit a row the validator rejects).
  const shapeError = learningRecordError(record);
  if (shapeError) {
    throw new Error(`Cannot add learning row: ${shapeError}.`);
  }

  // B6a-2: re-stamp id + append UNDER the lock (atomic vs concurrent learning adds).
  appendWithNextId(stateDir, "learning", "l", (id) => { record.id = id; return record; });
  emit(args, `Learning candidate added (proposed).
  id: ${record.id}
  type: ${record.type}${record.taskId ? `\n  task: ${record.taskId}` : ""}
  content: ${record.content}
  status: ${record.status}
Review it to keep it: node bin/ai-collab.js learning confirm --id ${record.id} (keep) | learning edit --id ${record.id} --content "..." (reword) | learning drop --id ${record.id} (discard).
Only confirmed/edited candidates graduate into your long-term profile.
Ledger: ${path.join(stateDir, "learning-ledger.jsonl")}
`, { command: "learning add", ok: true, learning: record, stateDir });
}

// Shared state-flip for confirm/drop: read all -> patch the matching row's status
// -> rewrite, the same deterministic, order-preserving pattern run finish and
// task update use. Only the four legal states are reachable (confirm -> confirmed,
// drop -> dropped; edit has its own entry because it also rewrites content).
function learningSetStatus(args, status) {
  const id = requireOption(args, "id");
  const stateDir = resolveStateDir(args.workspace);
  const learning = readLedger(stateDir, "learning");
  const target = learning.find((row) => row.id === id);
  if (!target) {
    throw new Error(`Learning row ${id} not found. Add one first: node bin/ai-collab.js learning add --type <harvest|profile> --content "...".`);
  }
  target.status = status;
  target.updatedAt = now();
  // Re-validate the patched row through the shared predicate before writing, so a
  // status flip can never leave the ledger in a shape the validator would reject.
  const shapeError = learningRecordError(target);
  if (shapeError) {
    throw new Error(`Cannot update learning row: ${shapeError}.`);
  }
  writeLedger(stateDir, "learning", learning);
  const kept = status === "confirmed";
  emit(args, `Learning candidate ${kept ? "confirmed (kept)" : "dropped (discarded)"}.
  id: ${target.id}
  type: ${target.type}
  status: ${target.status}${kept && target.type === "profile" ? "\n  (this preference will now be echoed back next time via `node bin/ai-collab.js status`)" : ""}
Ledger: ${path.join(stateDir, "learning-ledger.jsonl")}
`, { command: `learning ${kept ? "confirm" : "drop"}`, ok: true, learning: target, stateDir });
}

// edit = reword the candidate AND keep it: the edited line is what graduates, so
// the row moves to status "edited" with its new content. Same read-all -> patch ->
// rewrite pattern; content is required (an edit with no new wording is a no-op the
// user almost certainly did not mean).
function learningEdit(args) {
  const id = requireOption(args, "id");
  const content = requireOption(args, "content");
  const stateDir = resolveStateDir(args.workspace);
  const learning = readLedger(stateDir, "learning");
  const target = learning.find((row) => row.id === id);
  if (!target) {
    throw new Error(`Learning row ${id} not found. Add one first: node bin/ai-collab.js learning add --type <harvest|profile> --content "...".`);
  }
  target.content = content;
  target.status = "edited";
  target.updatedAt = now();
  const shapeError = learningRecordError(target);
  if (shapeError) {
    throw new Error(`Cannot edit learning row: ${shapeError}.`);
  }
  writeLedger(stateDir, "learning", learning);
  emit(args, `Learning candidate edited (kept, reworded).
  id: ${target.id}
  type: ${target.type}
  content: ${target.content}
  status: ${target.status}${target.type === "profile" ? "\n  (this preference will now be echoed back next time via `node bin/ai-collab.js status`)" : ""}
Ledger: ${path.join(stateDir, "learning-ledger.jsonl")}
`, { command: "learning edit", ok: true, learning: target, stateDir });
}

function countBy(records, key) {
  const counts = {};
  for (const record of records) {
    const value = record[key];
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function formatCounts(counts) {
  const keys = Object.keys(counts).sort();
  if (keys.length === 0) return "(none)";
  return keys.map((key) => `${key}=${counts[key]}`).join(", ");
}

// --- A2 capability detect -------------------------------------------------
//
// "capability detect" answers a different question from the run loop: not "what did
// this task earn?" (that is the receipt's guard level, A1) but "given the TOOLS you
// have, what is the highest guard level you could EVER reach?" — your CEILING. It
// combines a PROJECT-SIGNAL PROBE (look for tool marker files in the project) with
// GUIDED SELF-REPORT (flags), because the CLI is non-interactive and cannot see
// which AI you actually installed. Signals are surfaced as "inferred — confirm",
// never asserted (a marker like AGENTS.md is read by many tools and pins no family).

// Split a comma/space-separated list flag (e.g. --tools "claude,codex") into a
// clean lowercased array. Returns [] for an absent/empty flag.
function splitListArg(value) {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

// Probe a project directory for tool-marker files (.claude/, .codex/, AGENTS.md, …)
// and return the signals found. Each hit echoes the TOOL_SIGNALS row plus whether
// the marker exists. This only says a tool MIGHT be configured here; it never
// proves which model family (design rule 4) — low-confidence markers are flagged so
// the caller can print "inferred — please confirm". Pure read-only existence checks.
function probeProjectSignals(projectDir) {
  const root = path.resolve(projectDir ?? ".");
  const found = [];
  for (const signal of TOOL_SIGNALS) {
    if (existsSync(path.join(root, signal.marker))) {
      found.push({ ...signal, present: true });
    }
  }
  return { root, found };
}

function capabilityCommand(args) {
  const action = args._[1];
  // "capability" and "capability detect" both run the detector; any other
  // subcommand is a usage error.
  if (action !== undefined && action !== "detect") {
    throw new Error("Unknown capability command. Run: node bin/ai-collab.js capability detect [--project <dir>] [--tools <list>] [--families <list>] [--subagents] [--can-switch-model] [--can-rerun] [--no-new-conversation] [--json]");
  }

  // 1) Probe the project for tool-marker files (default: current dir, or --project).
  const { root, found } = probeProjectSignals(args.project);

  // 2) Self-report flags OVERRIDE / augment the probe. --tools / --families let the
  //    user state their real setup (the honest answer to "the CLI can't see what you
  //    installed"); the booleans describe what the setup can DO.
  const declaredTools = splitListArg(args.tools);
  const declaredFamilies = splitListArg(args.families);

  // Tools = declared tools if given, else the confident signal hits (a generic
  // marker like AGENTS.md, which pins no tool, is NOT counted as a tool).
  const signalTools = found.filter((signal) => signal.tool).map((signal) => signal.tool);
  const tools = declaredTools.length > 0 ? declaredTools : [...new Set(signalTools)];

  // Families: prefer an explicit --families; else derive from the confident signals'
  // families (NOT from generic markers — those carry family null). This is the
  // load-bearing input: only NAMED, distinct families clear the cross-family gate.
  const signalFamilies = found
    .filter((signal) => signal.confident && signal.family)
    .map((signal) => signal.family);
  // When the user named tools but not families, derive families from those tools so
  // a "--tools claude,codex" alone still resolves two families.
  const derivedFromTools = tools.map((tool) => TOOL_FAMILY[tool] ?? "unknown");
  const families =
    declaredFamilies.length > 0
      ? declaredFamilies
      : signalFamilies.length > 0
        ? [...new Set(signalFamilies)]
        : derivedFromTools;

  // Booleans. canOpenNewConversation defaults TRUE (almost every chat tool can open
  // a fresh chat); --no-new-conversation models the strict "one locked conversation"
  // tier. The others default FALSE and are opt-in via flags.
  const setup = {
    families,
    tools,
    canSwitchModelFamily: args.canSwitchModel === true,
    hasSubAgents: args.subagents === true,
    canOpenNewConversation: args.noNewConversation !== true,
    canRerun: args.canRerun === true
  };

  const cap = computeCapability(setup);

  // Whether ANY part of the answer rests on an inference the user has not confirmed:
  // a low-confidence marker was used, OR families were derived from tools/signals
  // rather than stated explicitly. Drives the "inferred — please confirm" note.
  const usedSignalsForFamilies = declaredFamilies.length === 0;
  const lowConfidenceHits = found.filter((signal) => !signal.confident);
  const inferred = (found.length > 0 || tools.length > 0) && (usedSignalsForFamilies || lowConfidenceHits.length > 0);

  // Human text. Lead with the ceiling and the tier, then the upgrade path, then the
  // hard line between CEILING (this) and ACHIEVED (the receipt's guard level), then
  // the honesty note. Kept to a single readable screen, like `status`.
  const signalLines = found.length > 0
    ? found.map((signal) => {
        const what = signal.tool ? `${signal.marker} -> ${signal.tool} (${signal.family ?? "family unknown"})` : `${signal.marker} -> some agent tool (family unknown)`;
        return `  - ${what}${signal.confident ? "" : "  [low-confidence: many tools use this — confirm]"}`;
      }).join("\n")
    : "  (no tool-marker files found in the project)";

  const familiesLine = cap.families.length > 0 ? cap.families.join(", ") : "(none named yet)";
  const recLine = cap.recommendation
    ? `Path up (to ${cap.recommendation.nextCeiling}): ${cap.recommendation.action}`
    : `You are already at the strongest local ceiling (L4). Per task, you still have to EARN it with the evidence.`;
  const inferredNote = inferred
    ? `\nNote: parts of this are INFERRED from project signals and may be wrong — confirm your real setup with --tools / --families (a marker file does not prove which model family you run).`
    : "";

  emit(args, `Capability: how high your setup can EVER score
Project scanned: ${root}

Tool signals (inference, not proof):
${signalLines}

Distinct model families you can bring: ${cap.distinctFamilies} [${familiesLine}]
Your capability CEILING: ${cap.ceiling}  (${cap.tier.label})
  ${cap.tier.experience}
  Why: ${cap.reason}

${recLine}

Ceiling vs achieved — keep them apart:
  - This CEILING (${cap.ceiling}) is the most your TOOLS could ever support.
  - What a task actually EARNS is its receipt's guard level (node bin/ai-collab.js receipt create),
    computed from the evidence you cite THAT task. Same setup, no real evidence -> a
    lower achieved level. The ceiling is the roof; each task still has to reach it.

Note: the families/tools shown above are SELF-REPORTED setup describing your CEILING
(how high you could ever score) — not evidence any task achieved it. Declaring a second
family does not make a task cross-family-passed; only a real cross-family guard with
rerun evidence earns L3/L4.${inferredNote}
`, {
    command: "capability detect",
    ok: true,
    project: root,
    signals: found.map((signal) => ({ marker: signal.marker, tool: signal.tool, family: signal.family, confident: signal.confident })),
    tools,
    families: cap.families,
    distinctFamilies: cap.distinctFamilies,
    ceiling: cap.ceiling,
    tier: { id: cap.tier.id, label: cap.tier.label, experience: cap.tier.experience },
    reason: cap.reason,
    recommendation: cap.recommendation,
    inferred,
    // Make the ceiling-vs-achieved distinction explicit in the machine payload too,
    // so an integrating tool cannot mistake the ceiling for a per-task verdict.
    note: "ceiling is the maximum the tools support; a task's achieved guard level comes from `receipt create` and the evidence cited that task"
  });
}

// Render ONE per-task achievement block for the human `status` view (the
// "what did I earn on this task" line). Joins the task to its strongest receipt
// (verdict + computed guardLevel + who accepted it) and its evidence/run counts,
// so a user who ran a chain sees the concrete thing they earned instead of a bare
// counter. A seed example row is clearly flagged so a brand-new workspace's
// numbers are not mistaken for the user's own progress. The guardLevel/family
// warning shown here is recomputed in summarizeTasks via ledger.js, so `status`
// cannot be fooled by hand-edited stored receipt fields.
// One plain-language phrase per guard level, so a newcomer reading "L1" / "L3"
// on a status line knows what it MEANS without first reading the L0-L4 ladder.
// Keyed by the bare level token (the stored guardLevel may carry a "(computed)"
// suffix in some surfaces, so callers normalize before lookup). Kept to a short
// clause that reads naturally appended after the level. The wording mirrors the
// real semantics in `--help levels` (single-tool tops out at L2; a plain pass
// needs cross-family L3; L4 adds a reconciled rerun) so the two never drift.
// The bare level token -> its i18n message key. L2.5's dot is not key-safe, so it
// maps to level.L2_5. The plain-language phrasing itself now lives in the catalog
// (en canonical + zh faithful), so the honesty gloss reads in the active language.
const GUARD_LEVEL_MESSAGE_KEY = {
  L0: "level.L0",
  L1: "level.L1",
  L2: "level.L2",
  "L2.5": "level.L2_5",
  L3: "level.L3",
  L4: "level.L4"
};

// Normalize a guardLevel value to its bare token (strip any " (computed)" suffix
// or surrounding whitespace) and return the plain-language phrase in the active
// locale, or "" if the level is unknown (never throw on an unexpected value — the
// gloss is additive).
function guardLevelPlainLanguage(guardLevel) {
  if (!guardLevel) return "";
  const token = String(guardLevel).replace(/\s*\(computed\)\s*$/i, "").trim();
  const key = GUARD_LEVEL_MESSAGE_KEY[token];
  return key ? tr(key) : "";
}

// Translate the honesty-bearing task status DISPLAY label at render time. The ledger
// model emits the canonical English ("done — author-marked, unverified") as a stable
// data field; here we localize only that one annotated label, leaving plain statuses
// (open / done / blocked / …) untouched. Faithful — never softened to "verified".
function localizeStatusDisplay(statusDisplay) {
  if (statusDisplay === "done — author-marked, unverified") {
    return tr("status.display.authorMarkedDone");
  }
  return statusDisplay;
}

function formatTaskSummaryLine(entry) {
  const titleText = entry.title && entry.title.length > 0 ? entry.title : tr("common.untitled");
  const seedTag = entry.isSeed ? tr("status.taskLine.seedTag") : "";
  const statusText = localizeStatusDisplay(entry.statusDisplay || entry.status);
  const head = tr("status.taskLine.head", { id: entry.id, title: titleText, status: statusText, seedTag });

  let receiptLine;
  if (entry.receipt) {
    const r = entry.receipt;
    const acceptedBy = r.status === "accepted" && r.acceptedBy ? tr("status.taskLine.receipt.acceptedBy", { who: r.acceptedBy }) : "";
    // The self-declared cross-family caveat — rendered in the active language,
    // faithfully (never softened into "verified").
    const unverified = r.familyUnverified ? tr("status.taskLine.receipt.unverified") : "";
    // Append a plain-language gloss of the level so "L2" etc. is self-explaining.
    const plain = guardLevelPlainLanguage(r.guardLevel);
    const plainNote = plain ? tr("status.taskLine.receipt.plainNote", { level: r.guardLevel, plain }) : "";
    receiptLine = tr("status.taskLine.receipt", {
      id: r.id, verdict: r.verdict, level: r.guardLevel, status: r.status, acceptedBy, unverified, plainNote
    });
  } else {
    receiptLine = tr("status.taskLine.receipt.none");
  }
  const countsLine = tr("status.taskLine.counts", { evidence: entry.evidenceCount, runs: entry.runCount });
  return `${head}\n${receiptLine}\n${countsLine}`;
}

// --- Handoff draft (resume across tools without re-explaining) --------------
//
// `handoff create` reads the ledger and writes a DRAFT handoff note into the
// workspace's handoff layer (.aict/handoff/) so the next session/tool can resume
// without replaying the conversation. It is the runtime tie-in for the handoff
// layer's existing format (README/TEMPLATE/EXAMPLE under .aict/handoff/): the
// SAME done / pending / blocked / unverified separation, auto-filled from the
// rows the run loop already recorded. buildHandoffModel (ledger.js) does the
// honest classification (DONE only for an ACCEPTED receipt; pass_with_risk /
// pending / unverified-family receipts land in Unverified); this layer only
// renders that model and writes the file. It NEVER marks unverified work "done".

// The banner every draft leads with, so a reader can never mistake an
// auto-generated starting point for a finished, trustworthy handoff.
const HANDOFF_DRAFT_BANNER =
  "> **This is an auto-generated draft from the ledger — review and complete it before handing off.**";

// Render one task entry's evidence/run/receipt references as indented bullet
// lines under a section. Kept compact: a draft is a starting point a human
// finishes, not an exhaustive dump.
function renderHandoffEntry(entry, { showReceipts }) {
  const lines = [];
  const titleText = entry.title && entry.title.length > 0 ? entry.title : "(untitled)";
  const statusText = entry.taskStatusDisplay || entry.taskStatus;
  lines.push(`- **${entry.id} — ${titleText}** _(task status: ${statusText})_`);

  if (showReceipts && entry.receipts.length > 0) {
    for (const r of entry.receipts) {
      const acceptedBy = r.status === "accepted" && r.acceptedBy ? ` · accepted by ${r.acceptedBy}` : "";
      const unverified = r.familyUnverified ? " · self-declared cross-family (unverified)" : "";
      lines.push(
        `  - receipt ${r.id}: ${r.verdict} · ${r.guardLevel} · ${r.status}${acceptedBy}${unverified}`
      );
    }
  }

  if (entry.evidence.length > 0) {
    const ev = entry.evidence
      .map((e) => `${e.id} (${e.kind})${e.summary ? `: ${e.summary}` : ""}`)
      .join("; ");
    lines.push(`  - evidence: ${ev}`);
  }

  if (entry.runs.length > 0) {
    const latest = entry.runs[0]; // already sorted most-recent-first by buildHandoffModel
    const cmd = latest.command ? `\`${latest.command}\`` : "(no command recorded)";
    const exit = latest.exitCode === null ? `status ${latest.status}` : `exit ${latest.exitCode}`;
    const more = entry.runs.length > 1 ? ` (+${entry.runs.length - 1} earlier run${entry.runs.length - 1 === 1 ? "" : "s"})` : "";
    lines.push(`  - last run ${latest.id}: ${cmd} → ${exit}${more}`);
  }

  if (entry.riskNotes.length > 0) {
    for (const note of entry.riskNotes) {
      lines.push(`  - ⚠️ ${note}`);
    }
  }

  return lines.join("\n");
}

// Render the full Markdown draft from a handoff model. Follows the handoff
// layer's section vocabulary (Done / Pending / Blocked / Unverified) so the
// draft slots into the existing TEMPLATE shape the docs teach.
function renderHandoffDraft(model, { stateDir, focusTitle }) {
  const section = (heading, entries, opts) => {
    if (entries.length === 0) {
      return `## ${heading}\n\n_None._\n`;
    }
    return `## ${heading}\n\n${entries.map((e) => renderHandoffEntry(e, opts)).join("\n")}\n`;
  };

  const titleLine = model.focusTaskId
    ? `# Handoff draft — ${model.focusTaskId}${focusTitle ? `: ${focusTitle}` : ""}`
    : "# Handoff draft";

  const c = model.counts;
  const overall =
    `Overall: ${c.done} done · ${c.unverified} unverified · ${c.pending} pending · ${c.blocked} blocked ` +
    `(across ${c.tasksConsidered} task${c.tasksConsidered === 1 ? "" : "s"}).`;

  const learningsBlock =
    model.learnings.length > 0
      ? `## Confirmed learnings to carry forward\n\n${model.learnings
          .map((l) => `- (${l.type}) ${l.content}`)
          .join("\n")}\n`
      : "## Confirmed learnings to carry forward\n\n_None kept yet._\n";

  return [
    titleLine,
    "",
    HANDOFF_DRAFT_BANNER,
    "",
    overall,
    "",
    "## Current status",
    "",
    "Auto-derived from the ledger. Only the **Done** items carry an accepted receipt;",
    "everything under **Unverified** was reviewed but not accepted (or is self-declared",
    "/ pending) and must be re-checked before you rely on it.",
    "",
    // Done leads, then the honest "not trustworthy yet" sections, then learnings.
    section("Done (has an accepted receipt)", model.done, { showReceipts: true }),
    section("Pending / in progress (no receipt yet)", model.pending, { showReceipts: true }),
    section("Blocked", model.blocked, { showReceipts: true }),
    section("Unverified (reviewed but not accepted — re-check before trusting)", model.unverified, { showReceipts: true }),
    learningsBlock,
    "## Next action",
    "",
    "_Fill in the exact next step for the receiver (the draft cannot know your intent)._",
    "",
    "---",
    "",
    `_Source: ${stateDir} · generated by \`ai-collab handoff create\`. Review every section before handing off._`,
    ""
  ].join("\n");
}

// A filesystem-safe timestamp for the draft filename (ISO with colons/dots
// swapped for dashes, e.g. 2026-06-22T10-15-30-123Z). Deterministic format; the
// caller passes the wall-clock value so this stays pure.
function handoffStamp(isoString) {
  return isoString.replace(/[:.]/g, "-");
}

// List the handoff DRAFT files this command has written into a workspace (the
// generated `handoff-*.md`, NOT the shipped layer docs README/TEMPLATE/etc.), so
// `status` can show a user that drafts exist. Returns names sorted newest-first by
// the timestamp embedded in the filename (lexical sort works on the ISO stamp).
// Pure read; returns [] when the dir is absent or unreadable.
function listHandoffDrafts(workspaceRoot) {
  const dir = path.join(workspaceRoot, "handoff");
  if (!existsSync(dir)) return [];
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => /^handoff-.*\.md$/.test(name))
    .sort((a, b) => b.localeCompare(a));
}

function handoffCommand(args) {
  const action = args._[1];
  if (action !== "create") {
    throw new Error(
      "Unknown handoff command. Run: node bin/ai-collab.js handoff create [--task <id>] [--workspace <dir>] [--json]"
    );
  }

  const stateDir = resolveStateDir(args.workspace);
  // The handoff layer dir lives next to state/ inside the workspace root
  // (<root>/handoff), the SAME .aict/handoff the docs teach. resolveStateDir
  // returns <root>/state, so the handoff dir is its sibling.
  const workspaceRoot = path.dirname(stateDir);
  const handoffDir = path.join(workspaceRoot, "handoff");

  const tasks = readLedger(stateDir, "tasks");
  const evidence = readLedger(stateDir, "evidence");
  const runs = readLedger(stateDir, "runs");
  const receipts = readLedger(stateDir, "receipts");
  const learning = readLedger(stateDir, "learning");

  const taskId = args.task !== undefined && args.task !== "" ? args.task : undefined;
  if (taskId !== undefined && !tasks.some((task) => task.id === taskId)) {
    throw new Error(
      tr("error.taskNotFound.handoff", { id: taskId })
    );
  }

  const model = buildHandoffModel(
    { tasks, evidence, runs, receipts, learning },
    { taskId }
  );

  // The focused task's title (for the draft heading), if a single task was named.
  const focusTitle = taskId
    ? (tasks.find((task) => task.id === taskId)?.title ?? "")
    : "";

  const markdown = renderHandoffDraft(model, { stateDir, focusTitle });

  // Filename: handoff-<taskid|all>-<timestamp>.md, mirroring the run-layer's
  // "draft you then complete" convention. The timestamp keeps successive drafts
  // from overwriting each other (a user can regenerate without losing the last).
  const stamp = handoffStamp(now());
  const fileName = `handoff-${taskId ?? "all"}-${stamp}.md`;
  const filePath = path.join(handoffDir, fileName);

  mkdirSync(handoffDir, { recursive: true });
  writeFileSync(filePath, markdown, "utf8");

  const c = model.counts;
  emit(
    args,
    `Handoff draft written.
  file: ${filePath}
  scope: ${taskId ? `task ${taskId}` : "whole workspace"}
  summary: ${c.done} done · ${c.unverified} unverified · ${c.pending} pending · ${c.blocked} blocked
This is a DRAFT auto-filled from the ledger — open it, review every section (especially Unverified), and complete the Next action before handing off.
Next: review ${filePath}, then share it (or paste it into the next tool with the handoff PROMPT in ${path.join(handoffDir, "PROMPT.md")}).
`,
    {
      command: "handoff create",
      ok: true,
      stateDir,
      file: filePath,
      taskId: taskId ?? null,
      draft: true,
      counts: c,
      model
    }
  );
}

// --- bootstrap (first-experience value report) ------------------------------
//
// bootstrap is the first-experience entry point: it reads the user's OWN recent
// work (repo structure, read-only git, the .aict ledger, AI instruction files) and
// prints a plain "AI collaboration baseline" — five cards (PROFILE CLUES /
// VERIFY / RESUME / ROLES / HARVEST). The honest core (which "done"s cannot be
// trusted, what the bucketing
// is) lives in bootstrap.js + ledger.js; this command only gathers the inputs
// (resolve the workspace, capture git output, read the ledgers) and prints.
//
// v1 is REPORT-ONLY: it writes NOTHING (no profile, no long-term state). --yes
// confirms the local-scan consent gate; without it bootstrap prints the scan scope
// and stops (the CLI is non-interactive, so consent is an explicit re-run).

// Capture read-only git signals for the repo the user is in. Best-effort: git may
// be absent or this may not be a repo — in either case we return { available:false }
// and the report degrades gracefully (no git section), never throwing. These are
// the ONLY git calls bootstrap makes, and both are pure read-only (log / diff
// --stat); bootstrap never writes to the repo.
// Split a --dialogue / --logs value into a list of paths. The flag accepts a single
// path or a comma-separated list ("a.txt,b.json"); each entry is trimmed and empties
// are dropped. Returns [] for an absent/blank flag, so the connector stays OFF unless
// the user actually named a file. Pure string parsing — the actual reading is fail-soft
// inside dialogue.js (a bad path is skipped with a note, never fatal).
function splitPathList(value) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// --- bootstrap --send-to-model: the consent + send presentation -------------
//
// These helpers render the EXTERNAL-model path's user-facing surface. They never send
// anything themselves (sendmodel.js does the assemble/assert/call); they only show the
// preview, ask for confirmation, and render returned candidates with the honesty caveats.

// Render the "what will be sent" preview (red line #2): the sources, the snippet count,
// the all-redacted promise, and the target model — printed BEFORE any send/confirm so the
// user sees the exact scope. Localized; the same data also goes out under --json.
function renderSendPreview(preview, locale = "en") {
  const lines = [
    t("send.preview.head", {}, locale),
    t("send.preview.model", { model: preview.model }, locale),
    t("send.preview.count", { count: preview.snippetCount, plural: preview.snippetCount === 1 ? "" : "s" }, locale),
    t("send.preview.redacted", {}, locale)
  ];
  if (preview.sources.length > 0) {
    lines.push(t("send.preview.sources", { files: preview.sources.join(", ") }, locale));
  }
  lines.push(t("send.preview.promise", {}, locale));
  return lines.join("\n");
}

// Ask the user (on an interactive TTY) to confirm the send. Resolves true ONLY on an
// explicit y / yes (case-insensitive); ANY other input — including a bare Enter — is
// false (default-DENY). Mirrors confirmDangerous so the two consent prompts behave
// identically. Used only when stdin is a TTY; the non-TTY path requires --yes instead.
async function confirmSend(locale = "en") {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolve) => {
      rl.question(t("send.confirm.prompt", {}, locale), (reply) => resolve(reply));
    });
    return /^\s*y(es)?\s*$/i.test(answer);
  } finally {
    rl.close();
  }
}

// Render the LLM candidate block (red line #5 presentation): a clearly-separated section
// that labels every model-sourced candidate "AI suggestion · low confidence · unverified ·
// confirm each yourself", never shown as done. Each candidate prints its kind, summary,
// and basis. Returns [] when there are none (so a degraded/empty pass adds no section).
function renderModelCandidates(candidates, locale = "en") {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const out = [t("send.candidates.head", { count: candidates.length, plural: candidates.length === 1 ? "" : "s" }, locale)];
  out.push(t("send.candidates.caveat", {}, locale));
  for (const c of candidates) {
    const kindLabel = t(`send.candidates.kind.${c.kind}`, {}, locale);
    out.push(t("send.candidates.item", { kind: kindLabel, summary: c.summary }, locale));
    if (c.basis && c.basis.length > 0) {
      out.push(t("send.candidates.basis", { basis: c.basis }, locale));
    }
  }
  return out;
}

function captureGitSignals(repoRoot) {
  const opts = { cwd: repoRoot, encoding: "utf8", timeout: 15000, maxBuffer: 8 * 1024 * 1024 };
  const isRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], opts);
  if (isRepo.status !== 0 || String(isRepo.stdout).trim() !== "true") {
    return { available: false, logText: "", diffStatText: "" };
  }
  // --name-only over the last 20 commits feeds the "repeatedly re-touched files"
  // signal; --stat shows uncommitted work in flight. Both read-only.
  const log = spawnSync("git", ["log", "--name-only", "-n", "20"], opts);
  const diff = spawnSync("git", ["diff", "--stat"], opts);
  return {
    available: true,
    logText: log.status === 0 ? String(log.stdout) : "",
    diffStatText: diff.status === 0 ? String(diff.stdout) : ""
  };
}

async function bootstrapCommand(args) {
  // bootstrap operates an EXISTING workspace (it reports on your recorded work), so
  // it requires one the same way the run-layer commands do — refuse with init
  // guidance rather than scaffold a stray ./state.
  const stateDir = resolveStateDir(args.workspace);
  const workspaceRoot = path.dirname(stateDir); // <root>/.aict
  // The repo/project root the user is actually working in. When --workspace points
  // at an <x>/.aict, the project root is its parent; otherwise default to the cwd
  // (a user who runs bootstrap from their project). This is what we scan for repo
  // structure + git, NOT the workspace dir.
  const repoRoot = path.resolve(args.workspace ? path.dirname(workspaceRoot) : ".");

  // OPT-IN local connectors: the user's EXPLICIT chat/log export paths (comma-split).
  // Empty unless --dialogue / --logs was given, so the high-privacy source is OFF by
  // default and the default scan is unchanged. These feed the deterministic dialogue
  // scan (dialogue.js) — read locally, never sent anywhere.
  const dialoguePaths = splitPathList(args.dialogue);
  const logPaths = splitPathList(args.logs);
  const dialogueScopeForConsent = [...dialoguePaths, ...logPaths];

  // Consent gate (red line: show the scope before reading). The scan is local +
  // read-only, but we still print exactly what it reads and require --yes to
  // proceed, so bootstrap never quietly rifles through a repo. --yes opts in. When the
  // user named dialogue/log files, the consent scope NAMES them too (so the extra
  // high-privacy read is shown explicitly before it happens).
  if (args.yes !== true) {
    if (args.json) {
      console.log(JSON.stringify({
        command: "bootstrap",
        ok: false,
        consentRequired: true,
        reportOnly: true,
        willScan: {
          repoStructure: repoRoot,
          gitHistory: "git log / git diff --stat (read-only)",
          ledger: path.join(workspaceRoot, "state"),
          aiInstructionFiles: ["CLAUDE.md", "AGENTS.md", ".cursorrules", "…"],
          // Only present when the user opted in by naming files; the connector is OFF
          // (high-privacy source not read) otherwise.
          ...(dialogueScopeForConsent.length > 0
            ? { dialogueExports: dialogueScopeForConsent }
            : {})
        },
        network: "not used",
        hint: "re-run with --yes to confirm"
      }, null, 2));
    } else {
      console.log(renderConsentPreview(repoRoot, CURRENT_LOCALE, dialogueScopeForConsent));
    }
    return;
  }

  // Gather inputs. The ledgers are read via the SAME readLedger the rest of the CLI
  // uses (so bootstrap sees exactly what status/handoff see). Git is captured
  // read-only; the scan parses it.
  const git = captureGitSignals(repoRoot);
  const scan = scanLocalStructure({ workspaceRoot, repoRoot, git });

  const tasks = readLedger(stateDir, "tasks");
  const evidence = readLedger(stateDir, "evidence");
  const runs = readLedger(stateDir, "runs");
  const receipts = readLedger(stateDir, "receipts");
  const learning = readLedger(stateDir, "learning");

  // How many handoff drafts already exist (RESUME uses this to decide "missing
  // handoff"). Reuses the same lister status uses, so the two agree.
  const handoffDraftCount = listHandoffDrafts(workspaceRoot).length;

  // OPT-IN dialogue scan (deterministic, local, zero-network). Only runs when the user
  // named a file; otherwise `dialogue` is null and the model is byte-identical to the
  // no-flag report. We pass the SAME honest per-task view (summarizeTasks) the cards
  // use, so a chat "done" is cross-referenced against the recomputed ledger truth (an
  // accepted clean receipt / an executed run), never a raw status flag.
  const dialogue = (dialoguePaths.length > 0 || logPaths.length > 0)
    ? scanDialogueAndLogs({
        dialoguePaths,
        logPaths,
        perTask: summarizeTasks(tasks, receipts, evidence, runs)
      })
    : null;

  const model = buildBootstrapModel({
    ledgers: { tasks, evidence, runs, receipts, learning },
    scan,
    handoffDraftCount,
    dialogue
  });

  // The LOCAL report is ALWAYS produced first and is the source of truth. The
  // external-model pass below only ENRICHES it (or degrades to it) — it never replaces
  // or rewrites the honest local cards.
  const localReportText = renderBootstrapReport(model, CURRENT_LOCALE);

  // === EXTERNAL-MODEL HALF (semantic scan v1) ================================
  // RED LINE #1 — DEFAULT NEVER SENDS. This whole block is entered ONLY when the user
  // explicitly passed --send-to-model or --dry-run-send. With neither flag, `sendModel`
  // stays null, NOTHING is sent or even assembled, and the report + --json payload are
  // byte-identical to the pure-local behavior (network: "not used" stays literally true).
  let sendModel = null; // the result surfaced to the user (or null when not requested)
  const sendRequested = args.sendToModel === true || args.dryRunSend === true;
  if (sendRequested) {
    // The model command: the user's --model override, else the default (claude over stdin).
    const modelCmd = (typeof args.model === "string" && args.model.trim().length > 0)
      ? args.model.trim()
      : DEFAULT_MODEL_CMD;

    // The ONLY thing that can be sent is the REDACTED snippets the local dialogue scan
    // surfaced. No dialogue/log export => nothing to send: we say so and degrade to local
    // (sending an empty/ledger-only payload would be both useless and a needless exposure).
    const snippets = collectRedactedSnippets(dialogue);

    if (snippets.length === 0) {
      // Nothing redacted to send. Not an error — just no external input. Degrade to local.
      sendModel = {
        requested: true,
        sent: false,
        degraded: true,
        reason: "no_redacted_snippets",
        model: modelCmd,
        candidates: []
      };
    } else if (args.dryRunSend === true) {
      // --dry-run-send (red line #3 audit): build the EXACT payload that WOULD be sent,
      // ASSERT it is redaction-clean, and PRINT it — but send nothing, call no model.
      const payload = buildModelPrompt(snippets);
      assertPayloadRedacted(payload); // throws (caught in main) if anything leaks — never ship
      sendModel = {
        requested: true,
        sent: false,
        dryRun: true,
        degraded: false,
        reason: null,
        model: modelCmd,
        candidates: [],
        payload
      };
    } else {
      // A real send was requested. RED LINE #2 — CONSENT + PREVIEW BEFORE SEND.
      const preview = buildSendPreview({ dialogue, snippets, modelCmd });

      // Show EXACTLY what will be sent (sources, count, all-redacted promise, model),
      // then require confirmation: an interactive TTY answers y/N (default-deny); a
      // non-interactive caller MUST have passed --yes, else we refuse and send nothing.
      let confirmed = false;
      if (process.stdin.isTTY && args.yes !== true) {
        // Interactive: print the preview, then ask. (When --yes was already given the
        // user pre-confirmed; we still print the preview below for transparency.)
        if (!args.json) console.log(renderSendPreview(preview, CURRENT_LOCALE));
        confirmed = await confirmSend(CURRENT_LOCALE);
      } else if (args.yes === true) {
        // Pre-confirmed via --yes (the non-TTY consent path, and an explicit opt-in on a
        // TTY). Still print the preview so the scope is shown before the send happens.
        if (!args.json) console.log(renderSendPreview(preview, CURRENT_LOCALE));
        confirmed = true;
      } else {
        // Non-interactive AND no --yes: refuse. Print the preview + the refusal so the
        // user sees what WOULD have been sent and how to consent. NOTHING is sent.
        if (!args.json) {
          console.log(renderSendPreview(preview, CURRENT_LOCALE));
          console.log(t("send.refusedNonTty", {}, CURRENT_LOCALE));
        }
        sendModel = {
          requested: true,
          sent: false,
          degraded: true,
          reason: "consent_required_non_tty",
          model: modelCmd,
          candidates: []
        };
      }

      if (sendModel === null && !confirmed) {
        // Asked on a TTY and the user declined (or bare Enter). Default-deny: send nothing.
        if (!args.json) console.log(t("send.declined", {}, CURRENT_LOCALE));
        sendModel = {
          requested: true,
          sent: false,
          degraded: true,
          reason: "declined",
          model: modelCmd,
          candidates: []
        };
      } else if (sendModel === null && confirmed) {
        // CONFIRMED. Now run the external pass: assemble (redacted) -> ASSERT clean ->
        // call the (injectable) model -> parse. A test injects args._invokeModel so the
        // real model is NEVER spawned; production passes nothing (defaultInvoke shells out
        // to `claude` over stdin). Any failure degrades to local; nothing is fabricated.
        const pass = runExternalModelPass({
          snippets,
          modelCmd,
          ...(typeof args._invokeModel === "function" ? { invoke: args._invokeModel } : {})
        });
        sendModel = {
          requested: true,
          sent: pass.sent === true,
          degraded: pass.degraded === true,
          reason: pass.reason,
          model: modelCmd,
          // Each candidate is already low / proposed / source:"model" / displayedAsDone:false
          // from sendmodel.js — bootstrap does NOT write any of them anywhere (report-only).
          candidates: Array.isArray(pass.candidates) ? pass.candidates : [],
          dropped: pass.dropped ?? 0
        };
      }
    }
  }

  // Compose the final text: the honest local report, then (only if requested) the
  // external-model section — candidates under the low-confidence/unverified caveat, OR a
  // plain "degraded to local" line, OR the dry-run payload. The local report is never
  // altered; the model section is strictly additive.
  let outText = localReportText;
  if (sendModel) {
    const extra = [""];
    if (sendModel.dryRun) {
      extra.push(t("send.dryRun.head", {}, CURRENT_LOCALE));
      extra.push(t("send.dryRun.note", {}, CURRENT_LOCALE));
      extra.push("");
      extra.push(sendModel.payload);
    } else if (sendModel.candidates.length > 0) {
      for (const line of renderModelCandidates(sendModel.candidates, CURRENT_LOCALE)) extra.push(line);
    } else {
      // Degraded / nothing returned: say so plainly (with the reason) and that the local
      // result above stands. Never silent, never a fake candidate. The reason is either a
      // known machine code (its own localized line) OR a free-form error string from the
      // model call (ENOENT / timeout / bad-shape) — those use the generic line with the
      // raw reason interpolated, so we never render a fallback key name at the user.
      const KNOWN_DEGRADE = new Set(["no_redacted_snippets", "consent_required_non_tty", "declined"]);
      if (KNOWN_DEGRADE.has(sendModel.reason)) {
        extra.push(t(`send.degraded.${sendModel.reason}`, { model: sendModel.model }, CURRENT_LOCALE));
      } else {
        extra.push(t("send.degraded.generic", { model: sendModel.model, reason: sendModel.reason ?? "unknown" }, CURRENT_LOCALE));
      }
    }
    outText = `${localReportText}\n${extra.join("\n")}`;
  }

  emit(args, outText, {
    command: "bootstrap",
    ok: true,
    reportOnly: true,
    // The honest top-line: whether the user has any data of their own (seeds
    // excluded). A --json consumer can branch on this instead of re-deriving it.
    hasOwnData: model.hasOwnData,
    seedOnly: model.seedOnly,
    // Whether a local dialogue/log export was actually read, plus the transparency
    // record (which files, how many flagged snippets, what was skipped). null when no
    // connector was used, so the default --json payload is unchanged.
    dialogueUsed: model.dialogueUsed,
    dialogue: model.dialogue,
    workspaceRoot,
    repoRoot,
    counts: model.counts,
    scan: model.scan,
    cards: model.cards,
    // The external-model pass record. null unless --send-to-model / --dry-run-send was
    // given (so the default --json payload is unchanged). When present it states whether
    // anything was sent, whether it degraded + why, the model command, and the LOW-trust
    // proposed candidates (source:"model") — which are NEVER written to a ledger/profile.
    sendToModel: sendModel
      ? {
          requested: true,
          sent: sendModel.sent === true,
          degraded: sendModel.degraded === true,
          dryRun: sendModel.dryRun === true,
          reason: sendModel.reason ?? null,
          model: sendModel.model,
          candidates: sendModel.candidates,
          // Carried so a --json/dry-run consumer can audit the exact redacted payload.
          ...(sendModel.dryRun ? { payload: sendModel.payload } : {})
        }
      : null,
    // network is HONEST about the one possible egress: it says "external model contacted"
    // ONLY when a send actually succeeded (a model answered usefully — degraded:false). A
    // requested-but-degraded send (declined / no snippets / unreachable / bad output) did
    // NOT usefully contact a model, so it stays "not used" rather than overclaiming. With
    // no send requested at all it is plainly "not used".
    network: sendModel && sendModel.sent === true && sendModel.degraded !== true
      ? "external model contacted (redacted payload)"
      : "not used"
  });
}

// Derive ONE actionable "next step" from the current ledger state, so a newcomer
// reading status knows not just where they are but what to do next. Pure read over
// already-loaded rows; returns { code, text, command }:
//   - code:    a locale-STABLE machine enum (one per branch below). --json consumers
//              branch on this instead of string-matching the localized text. The set
//              is closed and stable: run_bootstrap | add_evidence | create_receipt |
//              accept_receipt | create_handoff | confirm_learning | none.
//   - text:    the localized, human-readable line (varies by --lang).
//   - command: a real copy-pasteable CLI line (locale-stable English), or null for
//              the all-clear / nothing-actionable case.
// Ordered most-actionable-first: an empty/seed-only workspace is nudged to put real
// work in; an open task missing evidence/receipt is walked up the loop; a pending
// pass_with_risk is nudged to acceptance or a stronger review; once work is real and
// settled, a missing handoff draft or a keepable lesson is surfaced. Every suggested
// command points at an EXISTING audited command — it never invents a flag.
function deriveStatusNextStep({ perTask, learning, handoffDrafts, workspaceArg }) {
  // The --workspace suffix a copy-pasted command needs to target THIS workspace
  // (omitted when the user ran status against the default ./.aict).
  const wsSuffix = workspaceArg ? ` --workspace ${workspaceArg}` : "";
  const ownTasks = perTask.filter((t) => !t.isSeed);

  // (1) No real task yet (brand-new or example-only workspace): get your own work in.
  if (ownTasks.length === 0) {
    return {
      code: "run_bootstrap",
      text: tr("status.next.noOwnWork.text"),
      command: `node bin/ai-collab.js bootstrap --yes${wsSuffix}    # or: node bin/ai-collab.js task create --title "..."${wsSuffix}`
    };
  }

  // Among your own tasks, walk the loop up from the least-finished state.
  // (2) An open task with NO evidence at all -> record what you ran.
  const noEvidence = ownTasks.find(
    (t) => t.status !== "done" && t.evidenceCount === 0
  );
  if (noEvidence) {
    return {
      code: "add_evidence",
      text: tr("status.next.noEvidence.text", { id: noEvidence.id }),
      command: `node bin/ai-collab.js run exec --task ${noEvidence.id} --command "..."${wsSuffix}`
    };
  }

  // (3) An open task WITH evidence but NO receipt -> create the receipt.
  const noReceipt = ownTasks.find(
    (t) => t.status !== "done" && t.evidenceCount > 0 && !t.receipt
  );
  if (noReceipt) {
    return {
      code: "create_receipt",
      text: tr("status.next.noReceipt.text", { id: noReceipt.id }),
      command: `node bin/ai-collab.js receipt create --task ${noReceipt.id} --verdict pass_with_risk --review-mode self --evidence <id>${wsSuffix}`
    };
  }

  // (4) A pending pass_with_risk receipt -> accept it (owner sign-off) or raise it.
  const pending = ownTasks.find(
    (t) => t.receipt && t.receipt.status === "pending"
  );
  if (pending) {
    return {
      code: "accept_receipt",
      text: tr("status.next.pending.text", { receiptId: pending.receipt.id, taskId: pending.id }),
      command: `node bin/ai-collab.js receipt accept --id ${pending.receipt.id} --owner you${wsSuffix}`
    };
  }

  // (5) Real, settled work but NO handoff draft yet -> make one so the next
  // session/tool can resume without re-explaining.
  if (handoffDrafts.length === 0) {
    return {
      code: "create_handoff",
      text: tr("status.next.missingHandoff.text"),
      command: `node bin/ai-collab.js handoff create${wsSuffix}`
    };
  }

  // (6) A proposed lesson of your own waiting to be kept -> confirm it so it
  // graduates into your profile. Skip the shipped example seed (l0).
  const keepableLearning = Array.isArray(learning)
    ? learning.find(
        (row) => row && row.status === "proposed" && !isSeedRow(row, "learning")
      )
    : null;
  if (keepableLearning) {
    return {
      code: "confirm_learning",
      text: tr("status.next.keepLesson.text", { id: keepableLearning.id }),
      command: `node bin/ai-collab.js learning confirm --id ${keepableLearning.id}${wsSuffix}`
    };
  }

  // (7) Nothing outstanding: the loop is closed for now.
  return {
    code: "none",
    text: tr("status.next.allClear.text"),
    command: null
  };
}

function statusCommand(args) {
  const stateDir = resolveStateDir(args.workspace);
  const tasks = readLedger(stateDir, "tasks");
  const evidence = readLedger(stateDir, "evidence");
  const runs = readLedger(stateDir, "runs");
  const receipts = readLedger(stateDir, "receipts");
  const learning = readLedger(stateDir, "learning");

  const taskStatus = countBy(tasks, "status");
  const runStatus = countBy(runs, "status");
  const receiptStatus = countBy(receipts, "status");

  // Per-task achievement summary: join each task to its receipts/evidence/runs so
  // status shows WHAT was earned on WHICH task, not just totals (the getitback
  // goal — a user who ran one chain should see the receipt they earned). Pure
  // aggregation over already-validated rows; it computes no guard levels itself.
  const perTask = summarizeTasks(tasks, receipts, evidence, runs);

  // Seed-honesty notes on the TOP counters. A brand-new workspace ships one
  // example task/receipt/run plus two evidence rows; without these notes the
  // counters read like real progress (esp. "Receipts: 1 [accepted=1]", which
  // looks like an already-verified result). Each note names how many of that
  // counter's rows are the shipped seed, symmetric to the Tasks note, so the
  // total stays honest (real counts unchanged — we only annotate). countSeedRows
  // reuses isSeedRow, so "what is a seed" stays defined in exactly one place.
  const seedTaskCount = countSeedRows(tasks, "tasks");
  const seedReceiptCount = countSeedRows(receipts, "receipts");
  const seedEvidenceCount = countSeedRows(evidence, "evidence");
  const seedRunCount = countSeedRows(runs, "runs");
  const seedCountNote = (count) =>
    count > 0
      ? tr("status.seedNote.generic", { count, plural: count === 1 ? "" : "s" })
      : "";
  // The Tasks note keeps the extra call-to-action (the task is the row the user
  // deletes to clear the whole seed set); the other counters share the plain note.
  const seedNote =
    seedTaskCount > 0
      ? tr("status.seedNote.tasks", { count: seedTaskCount, plural: seedTaskCount === 1 ? "" : "s" })
      : "";
  const seedReceiptNote = seedCountNote(seedReceiptCount);
  const seedEvidenceNote = seedCountNote(seedEvidenceCount);
  const seedRunNote = seedCountNote(seedRunCount);
  const taskSummaryBlock =
    perTask.length > 0
      ? `\n${tr("status.yourTasks")}\n${perTask.map(formatTaskSummaryLine).join("\n")}\n`
      : "";

  // Handoff drafts already generated for this workspace (handoff create output),
  // so status nudges a user toward an existing resume note instead of starting
  // from zero. One line naming the most recent draft + the total count; omitted
  // entirely when none exist (no noise on a workspace that never ran the command).
  const handoffDrafts = listHandoffDrafts(path.dirname(stateDir));
  const handoffLine =
    handoffDrafts.length > 0
      ? `\n${tr("status.handoffLine", { count: handoffDrafts.length, latest: handoffDrafts[0] })}\n`
      : "";

  // "Most recent activity" = the highest createdAt/startedAt across the ledgers,
  // shown as a single line so status is a quick human glance, not a dashboard.
  const stamps = [
    ...tasks.map((t) => t.createdAt),
    ...evidence.map((e) => e.createdAt),
    ...runs.map((r) => r.finishedAt ?? r.startedAt),
    ...receipts.map((c) => c.createdAt)
  ].filter(Boolean).sort();
  const latest = stamps.length > 0 ? stamps[stamps.length - 1] : tr("status.noActivity");

  // P4 recall: echo back the ONE standing preference the user most recently kept
  // (a confirmed/edited profile-type learning row), so the tool feels like it is
  // carrying forward how you work. Deliberately one line, not a dump — if nothing
  // has been confirmed yet, the line is omitted entirely (no noise on an empty or
  // brand-new workspace). The seed ships a single "proposed" row, which does NOT
  // qualify, so a fresh workspace shows no carry-forward line until the user
  // actually confirms a preference.
  const carriedPreference = latestConfirmedProfileLearning(learning);
  const carryLine = carriedPreference
    ? `\n${tr("status.carryLine", { content: carriedPreference.content })}\n`
    : "";

  // P4 recall (harvest twin): the SAME echo for the most recently kept HARVEST
  // lesson. Before this, a confirmed harvest row had nowhere to surface (only
  // profile rows were recalled), so a lesson the user kept silently disappeared.
  // Symmetric to the preference line — one line, omitted when none is kept, and a
  // proposed seed harvest row (l0) never qualifies. The two recalls are separate
  // lines so a harvest lesson never poses as a standing preference (and vice versa).
  const carriedHarvestLesson = latestConfirmedHarvestLearning(learning);
  const harvestLine = carriedHarvestLesson
    ? `\n${tr("status.harvestLine", { content: carriedHarvestLesson.content })}\n`
    : "";

  // One plain-language "what to do next" line, derived from the current state, so a
  // newcomer who runs status knows their next move (not just the counters). The
  // suggested command is always an existing audited CLI line; it is printed on its
  // own line so it is copy-pasteable, and carried in --json as { text, command }.
  const nextStep = deriveStatusNextStep({
    perTask,
    learning,
    handoffDrafts,
    workspaceArg: args.workspace
  });
  const nextStepBlock = nextStep.command
    ? `\n${tr("status.nextStep.withCommand", { text: nextStep.text, command: nextStep.command })}\n`
    : `\n${tr("status.nextStep.textOnly", { text: nextStep.text })}\n`;

  emit(args, `${tr("status.title")}
${tr("status.state", { stateDir })}

${tr("status.tasks", { count: tasks.length, breakdown: formatCounts(taskStatus), seedNote })}
${tr("status.evidence", { count: evidence.length, seedNote: seedEvidenceNote })}
${tr("status.runs", { count: runs.length, breakdown: formatCounts(runStatus), seedNote: seedRunNote })}
${tr("status.receipts", { count: receipts.length, breakdown: formatCounts(receiptStatus), seedNote: seedReceiptNote })}
${tr("status.learning", { count: learning.length })}
${taskSummaryBlock}${carryLine}${harvestLine}${handoffLine}
${tr("status.mostRecentActivity", { latest })}
${nextStepBlock}`, {
    command: "status",
    ok: true,
    stateDir,
    // Handoff draft files already generated for this workspace (newest-first), so
    // a --json integration sees the same resume notes the text line surfaces.
    handoffDrafts,
    counts: {
      tasks: tasks.length,
      evidence: evidence.length,
      runs: runs.length,
      receipts: receipts.length,
      learning: learning.length
    },
    taskStatus,
    runStatus,
    receiptStatus,
    // Structured per-task achievement data so a tool integrating via --json gets
    // the same join (title + strongest receipt + evidence/run counts + seed flag).
    perTask,
    // How many of each ledger's rows are the shipped example seed (so an
    // integration can subtract them from "real" progress the same way the human
    // notes on the top counters do). seedTaskCount kept for back-compat; the
    // receipts/evidence/runs counts are symmetric additions so --json carries the
    // same seed honesty the text counters now show.
    seedTaskCount,
    seedReceiptCount,
    seedEvidenceCount,
    seedRunCount,
    // The kept preference echoed back this run (null when none confirmed yet), so
    // a tool integrating via --json can surface the same single carry-forward.
    carriedPreference: carriedPreference
      ? { id: carriedPreference.id, content: carriedPreference.content, status: carriedPreference.status }
      : null,
    // The kept harvest lesson echoed back this run (null when none), symmetric to
    // carriedPreference so both recalls are available to an integrating tool.
    carriedHarvestLesson: carriedHarvestLesson
      ? { id: carriedHarvestLesson.id, content: carriedHarvestLesson.content, status: carriedHarvestLesson.status }
      : null,
    // The single derived "what to do next", so a --json consumer gets the same
    // guidance the text surface prints on its Next step line:
    //   - code:    a locale-STABLE machine enum (identical under --lang en / zh);
    //              branch on this, not the localized text.
    //   - text:    the localized human line (varies by language).
    //   - command: the copy-pasteable CLI line (locale-stable), null when nothing
    //              is outstanding.
    nextStep: { code: nextStep.code, text: nextStep.text, command: nextStep.command },
    mostRecentActivity: latest
  });
}

function printVersion() {
  let version = "unknown";
  try {
    version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    /* fall through to "unknown" — version is informational, never load-bearing */
  }
  console.log(version);
}

// Every top-level command word the CLI dispatches. Used both to validate an
// unknown command and to suggest the closest match on a typo.
const TOP_LEVEL_COMMANDS = [
  "init", "welcome", "guide", "demo", "check", "adapters", "task", "evidence",
  "run", "receipt", "learning", "status", "capability", "handoff", "bootstrap", "help", "version"
];

// Classic Levenshtein edit distance — small, dependency-free, only ever run on two
// short command words, so the simple O(m*n) table is fine. Used to turn a typo into
// a "Did you mean 'x'?" hint instead of dumping the whole reference.
function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dist[i][0] = i;
  for (let j = 0; j < cols; j += 1) dist[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,      // deletion
        dist[i][j - 1] + 1,      // insertion
        dist[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dist[a.length][b.length];
}

// Suggest the closest known command for a typo. A prefix match wins outright (e.g.
// "stat" -> "status"); otherwise the nearest by edit distance, but only when it is
// close enough to be a plausible typo (<= 3 edits AND under half the word length),
// so a wild word like "bogus" suggests nothing rather than a misleading guess.
function closestCommand(input) {
  const prefix = TOP_LEVEL_COMMANDS.find((cmd) => cmd.startsWith(input) || input.startsWith(cmd));
  if (prefix) return prefix;
  let best = null;
  let bestDistance = Infinity;
  for (const cmd of TOP_LEVEL_COMMANDS) {
    const distance = editDistance(input, cmd);
    if (distance < bestDistance) {
      best = cmd;
      bestDistance = distance;
    }
  }
  if (best && bestDistance <= 3 && bestDistance < Math.max(input.length, best.length) / 2 + 1) {
    return best;
  }
  return null;
}

async function main() {
  // Resolve the run's locale FIRST, before parseArgs can throw, so even a
  // parseArgs / dispatch error renders in the user's language. We read --lang
  // straight from raw argv (the token after a bare "--lang"), then let resolveLocale
  // apply the full precedence ladder: flag > AI_COLLAB_LANG > OS locale > 'en'.
  const rawArgv = process.argv.slice(2);
  const langIdx = rawArgv.indexOf("--lang");
  const langFlag = langIdx >= 0 ? rawArgv[langIdx + 1] : undefined;
  CURRENT_LOCALE = resolveLocale({ langFlag, env: process.env });
  try {
    const args = parseArgs(rawArgv);
    // A --version/-v or --help/-h token ANYWHERE short-circuits before dispatch: so
    // `<command> --help` always shows help with no command side effects (previously
    // `demo --help` ran the demo and wrote a throwaway workspace), and --version works
    // regardless of position.
    if (args.version) { printVersion(); return; }
    // `--help levels` (the guard-level word riding alongside the --help flag) prints ONLY
    // the L0-L4 reference, which printHelp() now sinks out of its first screen. Any other
    // `--help` (bare, or `<command> --help`) prints the main reference.
    if (args.help) {
      if (args._[0] === "levels") printLevelsHelp();
      else printHelp();
      return;
    }

    // No command at all (bare `node bin/ai-collab.js`) is a NEW user's first
    // contact: show the short quickstart, NOT the full --help reference (which
    // includes the L0-L4 theory and buries how to start). The explicit `help`
    // command and the --help flag still print the full reference below.
    const command = args._[0];
    if (command === undefined) { printQuickstart(); return; }

    if (command === "init") init(args);
    else if (command === "welcome") welcome(args);
    else if (command === "guide") guide(args);
    else if (command === "demo") demo(args);
    else if (command === "check") check(args);
    else if (command === "adapters") adapters(args);
    else if (command === "task") taskCommand(args);
    else if (command === "evidence") evidenceCommand(args);
    else if (command === "run") await runCommand(args);
    else if (command === "receipt") receiptCommand(args);
    else if (command === "learning") learningCommand(args);
    else if (command === "status") statusCommand(args);
    else if (command === "capability") capabilityCommand(args);
    else if (command === "handoff") handoffCommand(args);
    else if (command === "bootstrap") await bootstrapCommand(args);
    // `version` (bare subcommand) is an alias for --version, so a user who types
    // the word instead of the flag gets the version, not "Unknown command".
    else if (command === "version") printVersion();
    else if (command === "help" || command === "--help" || command === "-h") {
      // `help levels` is the bare-subcommand twin of `--help levels`: print only the
      // L0-L4 ladder. Plain `help` prints the full reference.
      if (args._[1] === "levels") printLevelsHelp();
      else printHelp();
    }
    else {
      // A typo no longer dumps the whole 100+ line reference. Give 1-2 lines: the
      // unknown word, the closest known command if there is a plausible one, and
      // where to get the full list.
      const suggestion = closestCommand(command);
      console.error(`Unknown command: ${command}`);
      if (suggestion) console.error(`Did you mean '${suggestion}'?`);
      console.error("Run 'node bin/ai-collab.js --help' for all commands.");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();

