import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, appendFileSync, cpSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkspace, receiptsLedger, countFiles } from "../src/workspace.js";
import {
  validateWorkspace,
  buildLedgerContext,
  checkRerunRunReconcile,
  checkAcceptedReceiptHasEvidence,
  checkReceiptComputedLevel,
  checkFamilyUnverifiedMarker,
  checkReceiptStatusReverse,
  checkVerdictGuardLevelConsistency,
  checkReceiptCrossTaskEvidence,
  checkDoneRequiresEvidence
} from "../src/validate.js";
import { receiptStatusFor, ownedEvidenceIds, computeCapability, distinctNamedFamilies, buildHandoffModel, confirmedProfileLearnings, computeReceiptGuardLevel } from "../src/ledger.js";
import { buildBootstrapModel, parseRepeatedlyTouchedFiles, scanLocalStructure, buildProfileCard, buildRolesCard, renderBootstrapReport } from "../src/bootstrap.js";
import { redactSnippet, parseDialogueExports, extractDialogueSignals, scanDialogueAndLogs } from "../src/dialogue.js";
import {
  collectRedactedSnippets,
  buildModelPrompt,
  assertPayloadRedacted,
  findSensitiveLeaks,
  runModel,
  runExternalModelPass,
  parseModelResponse,
  buildSendPreview,
  MODEL_CANDIDATE_KINDS,
  DEFAULT_MODEL_CMD
} from "../src/sendmodel.js";
import { FORBIDDEN_IN_PACK, findForbiddenPackFiles } from "../scripts/lib/forbidden-in-pack.js";
import { skillDefinitions, promptDefinitions, mechanismDefinitions, requiredMechanismIds } from "../src/catalog.js";
import { renderSharedCoreContract } from "../src/render.js";
import { resolveLocale, t, MESSAGES } from "../src/i18n.js";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const nodeBin = process.execPath;

// i18n: the CLI now resolves its output language from --lang / AI_COLLAB_LANG / the
// OS locale. The existing assertions are written against the ENGLISH (canonical)
// output, so we pin every CLI invocation to English by forcing AI_COLLAB_LANG=en in
// the child env. This makes the suite locale-INDEPENDENT (a dev/CI box with a zh
// LANG would otherwise flip the output to Chinese and red the English assertions) —
// it is honest adaptation, not a weakening. A caller's own env is merged first, then
// the language is forced last so it always wins. The bilingual behavior itself is
// covered by the dedicated --lang tests (which set the language explicitly).
function withEnglishEnv(options = {}) {
  const callerEnv = options.env || process.env;
  return { ...options, env: { ...callerEnv, AI_COLLAB_LANG: "en" } };
}

function run(args, options = {}) {
  return execFileSync(nodeBin, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...withEnglishEnv(options)
  });
}

function runCli(args, options = {}) {
  return run(["bin/ai-collab.js", ...args], options);
}

function runResult(args, options = {}) {
  return spawnSync(nodeBin, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...withEnglishEnv(options)
  });
}

function read(...parts) {
  return readFileSync(path.join(...parts), "utf8");
}

// Platform-agnostic path canonicalization for path comparisons. realpathSync resolves
// whatever the host actually does — the macOS /var -> /private/var symlink, a Windows
// short/long or drive-letter casing difference, a Linux bind/symlink — WITHOUT assuming
// any specific prefix (e.g. it does NOT special-case "/private"). If the path does not
// exist yet (so realpath would throw), it falls back to the absolute-resolved form, so
// the helper is safe to use on both sides of a comparison on any OS.
function canonical(p) {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function commandThatPrints(output, exit = 0) {
  const script = `process.stdout.write(${JSON.stringify(output)}); process.exit(${Number(exit)});`;
  return `${JSON.stringify(nodeBin)} -e ${JSON.stringify(script)}`;
}

function phrase(...parts) {
  return parts.join(" ");
}

function listMarkdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name);
}

test("CLI initializes a complete local-first collaboration workspace", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-init-"));

  const output = runCli(["init", "--target", target, "--force"]);
  assert.match(output, /START_HERE\.md/);
  assert.match(output, /Network: not used/);

  const workspace = path.join(target, ".aict");
  const requiredDirs = [
    "profile",
    "context",
    "acceptance",
    "guard",
    "handoff",
    "harvest",
    "prompts",
    "skills",
    "adapters",
    "examples",
    "privacy"
  ];

  assert.ok(existsSync(path.join(workspace, "START_HERE.md")));
  for (const dir of requiredDirs) {
    assert.ok(existsSync(path.join(workspace, dir)), `missing ${dir}`);
  }

  const startHere = read(workspace, "START_HERE.md");
  assert.match(startHere, /10-minute path/i);
  assert.match(startHere, /30-minute path/i);
  assert.match(startHere, /60-minute path/i);
  assert.doesNotMatch(startHere.slice(0, 1200), /doctor/i);
});

test("bin CLI supports first-run UX without unsafe fallbacks", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-cli-"));
  const dryRunTarget = path.join(target, "dry-run-target");

  const dryRunOutput = runCli(["init", "--target", dryRunTarget, "--dry-run"]);
  assert.match(dryRunOutput, /Dry run/i);
  assert.match(dryRunOutput, /Files planned/i);
  assert.equal(existsSync(path.join(dryRunTarget, ".aict")), false);

  const dryRunJson = runCli(["init", "--target", dryRunTarget, "--dry-run", "--json"]);
  const parsed = JSON.parse(dryRunJson);
  assert.equal(parsed.command, "init");
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.written, false);

  const missingTarget = runResult(["bin/ai-collab.js", "init"]);
  assert.notEqual(missingTarget.status, 0);
  assert.match(missingTarget.stderr, /Missing --target/i);
  // P1: now that the package is published to npm, the error points at the global
  // `ai-collab` command (the standard install path). The `ai-collab ` prefix is the
  // load-bearing part of this assertion.
  assert.match(missingTarget.stderr, /ai-collab init --target <dir>/i);

  // --dry-run writes nothing, so a target-less preview must succeed (not error)
  // and must still write no files; only a real (writing) init demands --target.
  // Assert the dry run does not CHANGE whether repoRoot/my-ai-workspace exists,
  // instead of asserting it is absent outright. A user who already followed the
  // README's `init --target ./my-ai-workspace` legitimately has that directory, and
  // a dry run must neither create nor delete it. Snapshotting before/after keeps the
  // original "no unsafe fallback write" guarantee without assuming a pristine repo
  // root (which the documented first-run command would otherwise make false).
  const defaultTargetDir = path.join(repoRoot, "my-ai-workspace");
  const defaultTargetExistedBefore = existsSync(defaultTargetDir);
  const dryRunNoTarget = runResult(["bin/ai-collab.js", "init", "--dry-run"]);
  assert.equal(dryRunNoTarget.status, 0);
  assert.match(dryRunNoTarget.stdout, /Dry run/i);
  assert.match(dryRunNoTarget.stdout, /Files planned/i);
  assert.equal(existsSync(defaultTargetDir), defaultTargetExistedBefore);
  const dryRunNoTargetJson = JSON.parse(
    runResult(["bin/ai-collab.js", "init", "--dry-run", "--json"]).stdout
  );
  assert.equal(dryRunNoTargetJson.dryRun, true);
  assert.equal(dryRunNoTargetJson.written, false);
  assert.equal(dryRunNoTargetJson.usedDefaultTarget, true);

  const missingTargetValue = runResult(["bin/ai-collab.js", "init", "--target"]);
  assert.notEqual(missingTargetValue.status, 0);
  assert.match(missingTargetValue.stderr, /Option --target requires a value/i);

  const missingWorkspace = runResult(["bin/ai-collab.js", "check"]);
  assert.notEqual(missingWorkspace.status, 0);
  assert.match(missingWorkspace.stderr, /Missing --workspace/i);
  // P1: same as init — point at the global `ai-collab` command (published).
  assert.match(missingWorkspace.stderr, /ai-collab check --workspace <dir>/i);

  runCli(["init", "--target", target, "--force"]);
  const checkOutput = runCli(["check", "--workspace", target]);
  assert.match(checkOutput, /Contract check passed/);

  const help = runCli(["help"]);
  const flagHelp = runCli(["--help"]);
  const guide = runCli(["guide"]);
  const readme = read(repoRoot, "README.md");
  assert.doesNotMatch(`${help}\n${flagHelp}\n${guide}\n${readme}`, /node src\/cli\.js/);
  assert.match(help, /ai-collab init --target <dir>/);
  assert.match(flagHelp, /ai-collab init --target <dir>/);

  // An UNKNOWN option must still fail loudly (the "no unsafe fallbacks" contract:
  // a typo'd flag is rejected, never silently swallowed). --yes used to be the
  // canary here, but it is now a real global flag (bootstrap's consent opt-in), so
  // the canary moved to a flag that is genuinely unknown.
  const bogusFlag = runResult(["bin/ai-collab.js", "init", "--target", dryRunTarget, "--dry-run", "--no-such-flag"]);
  assert.notEqual(bogusFlag.status, 0);
  assert.match(bogusFlag.stderr, /Unknown option: --no-such-flag/i);

  // --yes is now a RECOGNIZED global flag (used by bootstrap's consent gate). On a
  // command that does not use it (init) it is simply ignored — it must NOT turn a
  // --dry-run into a real write, and must NOT error. This documents the new flag
  // honestly: init keeps writing nothing under --dry-run regardless of --yes.
  const initYes = runResult(["bin/ai-collab.js", "init", "--target", dryRunTarget, "--dry-run", "--yes"]);
  assert.equal(initYes.status, 0, "init --dry-run --yes must succeed (--yes is a recognized flag, ignored by init)");
  assert.match(initYes.stdout, /Dry run/i);
  assert.equal(existsSync(path.join(dryRunTarget, ".aict")), false, "--yes must not make a --dry-run init write files");
});

test(".gitignore ignores the README's generated workspace but never the committed .aict fixture", (t) => {
  // The root .gitignore must EXPRESS two rules, regardless of environment: (a) the
  // README's generated workspace dir (my-ai-workspace*) is ignored; (b) the committed
  // .aict fixture and its files are NOT. We verify both layers:
  //   1. Textual (no git needed): the .gitignore actually carries the patterns.
  //   2. Behavioral (git only): `git check-ignore` agrees — but ONLY when we are inside
  //      a real git worktree. A downloaded source tarball / unzipped snapshot has no
  //      .git, so `git check-ignore` returns 128 ("not a git repository"), not 1/0 — it
  //      cannot answer the question at all. B3-4: detect that and SKIP the behavioral
  //      layer with an explicit reason, instead of failing an audit on a machine where
  //      the check is simply not applicable. The textual layer below still runs there.

  // Layer 1 (always): the .gitignore text carries the rules. This is the real contract
  // and it does not need git, so source-tarball auditors still get a meaningful check.
  const gitignore = read(repoRoot, ".gitignore");
  assert.match(gitignore, /(^|\n)\s*\/?my-ai-workspace/, ".gitignore must ignore the README's generated workspace (my-ai-workspace*)");
  // And no line may bare-ignore the committed .aict fixture (that would silently break
  // the contract-parity tests). The *.backup patterns are fine; a literal .aict is not.
  const gitignoreRules = gitignore
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  const bareIgnoresAict = gitignoreRules.some((rule) =>
    [".aict", ".aict/", "/.aict", "/.aict/", "**/.aict", "**/.aict/"].includes(rule)
  );
  assert.equal(bareIgnoresAict, false, ".gitignore must NOT bare-ignore the committed .aict fixture");

  // Layer 2 (git worktree only): behavioral confirmation via git itself.
  const inWorktree = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (inWorktree.status !== 0 || inWorktree.stdout.trim() !== "true") {
    // Not a git worktree (e.g. an unzipped source snapshot). git check-ignore returns
    // 128 here and cannot answer; skipping with a stated reason keeps `npm run check`
    // honest-green for tarball auditors. The textual layer above already ran.
    t.skip("not inside a git worktree (e.g. an unpacked source tarball): git check-ignore returns 128, so the behavioral .gitignore check is not applicable here — the textual .gitignore assertions above still ran");
    return;
  }

  // `git check-ignore <path>` exits 0 (and echoes the path) when ignored, 1 when not.
  const checkIgnore = (target) =>
    spawnSync("git", ["check-ignore", target], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

  // The contract-parity fixture committed at the repo root must NEVER be ignored —
  // ignoring it would silently break the parity tests that diff against committed .aict.
  const aict = checkIgnore(".aict");
  assert.equal(aict.status, 1, ".aict must NOT be ignored (committed contract fixture)");
  assert.equal(aict.stdout.trim(), "");
  // And neither may any individual committed file inside it.
  const aictFile = checkIgnore(".aict/START_HERE.md");
  assert.equal(aictFile.status, 1, "a committed .aict file must NOT be ignored");

  // The directory the README hands a first-time user (`init --target ./my-ai-workspace`)
  // must be ignored, so a fresh clone stays clean after the very first command.
  const workspace = checkIgnore("my-ai-workspace");
  assert.equal(workspace.status, 0, "my-ai-workspace must be ignored");
  assert.match(workspace.stdout, /my-ai-workspace/);
  // Its generated contents (a nested .aict/) must be ignored too.
  const workspaceInner = checkIgnore("my-ai-workspace/.aict/START_HERE.md");
  assert.equal(workspaceInner.status, 0, "generated workspace contents must be ignored");
  // And a common variant name a user might pick.
  const variant = checkIgnore("my-ai-workspace-2");
  assert.equal(variant.status, 0, "a my-ai-workspace* variant must be ignored");
});

test("run exec carries an explicit shell-safety note in help and README", () => {
  // External review: `run exec` runs an arbitrary shell command, and a user may paste
  // one an AI suggested without reading it. We add a doc/help warning (NOT a forced
  // interactive prompt, which would break scripting/CI) — assert it is actually present.
  const safety = "Safety: 'run exec' runs a real shell command locally — read the command first, especially if an AI suggested it.";

  const flagHelp = runCli(["--help"]);
  const help = runCli(["help"]);
  assert.ok(flagHelp.includes(safety), "--help must include the run exec safety note");
  assert.ok(help.includes(safety), "help must include the run exec safety note");

  // The README uses Markdown emphasis, so match the prose rather than the exact quotes.
  const readme = read(repoRoot, "README.md");
  assert.match(
    readme,
    /`run exec` runs a real shell command locally — read the command first, especially if an AI suggested it\./,
    "README run-layer section must include the run exec safety note"
  );
});

// B5-1: the README run-layer showcase must not contradict itself. The example cites
// `--kind output` evidence, and the prose right after says "a single tool tops out at
// L2". Run the EXACT example sequence and assert the receipt actually computes L2, so
// the live output == the prose == the --help ladder (no L1/L2 three-way mismatch).
test("B5-1: the README run-layer example actually computes the L2 the prose claims", () => {
  // The README's run-layer block (with the example's own --kind output evidence).
  const readme = read(repoRoot, "README.md");
  assert.match(readme, /evidence add\s+--task t1 --kind output/, "README example must cite --kind output evidence (so it can reach L2)");
  assert.match(readme, /single tool tops out at L2/, "README prose must keep the single-tool L2 ceiling");

  // Reproduce the exact example sequence and read the computed level off the receipt.
  const ws = freshRunWorkspace("b51-readme-example");
  runCli(["task", "create", "--title", "Fix the flaky reorder test", "--workspace", ws]);
  runCli(["run", "start", "--task", "t1", "--command", "npm test", "--workspace", ws]);
  runCli(["run", "finish", "--task", "t1", "--exit", "0", "--workspace", ws]);
  // The seed ships e0+e1, so the first user-added evidence is e2 (matches the README's --evidence e2).
  const ev = JSON.parse(runCli(["evidence", "add", "--task", "t1", "--kind", "output", "--summary", "npm test -> exit 0, suite green", "--workspace", ws, "--json"])).evidence;
  assert.equal(ev.id, "e2", "the example's evidence id (e2) must match what the README cites");
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", "t1", "--verdict", "pass_with_risk", "--review-mode", "self", "--evidence", "e2", "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L2", "the README example must actually compute L2 (matching the prose, not L1)");
  assert.equal(receipt.verdict, "pass_with_risk", "the example verdict is pass_with_risk (the L2 ceiling)");
});

test("init --dry-run plans exactly the file count a real init writes", () => {
  // Honest preview: "Files planned" must equal the later "Files written" — no off-by-one.
  // The user-facing init also drops a workspace .gitignore (not in workspaceFileEntries),
  // so the dry-run plan must count it too; otherwise the preview under-reports by 1.
  const target = mkdtempSync(path.join(tmpdir(), "aicos-drycount-"));

  const planned = JSON.parse(
    runCli(["init", "--target", path.join(target, "ws"), "--dry-run", "--json"])
  );
  assert.equal(planned.dryRun, true);
  assert.equal(planned.written, false);

  const written = JSON.parse(
    runCli(["init", "--target", path.join(target, "ws"), "--json"])
  );
  assert.equal(written.written, true);

  assert.equal(
    planned.filesPlanned,
    written.filesWritten,
    `dry-run planned (${planned.filesPlanned}) must equal real written (${written.filesWritten})`
  );

  // Belt-and-suspenders: the on-disk file count must also match the reported number,
  // and the .gitignore (the file that used to be missing from the plan) must exist.
  const writtenRoot = path.join(target, "ws", ".aict");
  assert.ok(existsSync(path.join(writtenRoot, ".gitignore")), "init must write the workspace .gitignore");
  const onDisk = countFiles(writtenRoot);
  assert.equal(onDisk, written.filesWritten, "reported filesWritten must match files actually on disk");
});

test("--force backs up existing user-owned .aict content before replacement", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-force-"));

  runCli(["init", "--target", target]);
  writeFileSync(path.join(target, ".aict", "user-owned-note.md"), "do not delete me\n", "utf8");
  const output = runCli(["init", "--target", target, "--force"]);

  assert.match(output, /Backup:/);
  assert.ok(existsSync(path.join(target, ".aict", "START_HERE.md")));

  const backupDirs = readdirSync(target)
    .filter((entry) => entry.startsWith(".aict.backup-"))
    .map((entry) => path.join(target, entry));
  assert.equal(backupDirs.length, 1);
  assert.equal(read(backupDirs[0], "user-owned-note.md"), "do not delete me\n");
});

test("adapter installer creates guidance entrypoints for common AI tools", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-adapters-"));

  // --tool all: this test asserts the full six-tool surface (the default --tool
  // auto would detect no tool in this empty temp dir and intentionally write
  // nothing; see the dedicated auto-detection tests below).
  const output = runCli(["adapters", "install", "--target", target, "--tool", "all"]);
  assert.match(output, /Adapter guidance installed/i);

  const expected = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules/ai-collab.mdc",
    ".github/copilot-instructions.md",
    ".clinerules",
    ".windsurf/rules/ai-collab.md"
  ];

  for (const relative of expected) {
    const content = read(target, relative);
    assert.match(content, /adapter guidance/i, `${relative} missing honesty label`);
    for (const layer of ["Profile", "Context", "Acceptance", "Guard", "Handoff", "Harvest"]) {
      assert.match(content, new RegExp(layer, "i"), `${relative} missing ${layer}`);
    }
  }
});

// Regression lock for the P0 dead-link fix: `adapters install` entrypoints must
// INLINE the full shared core contract (coaching layer + completion-claim guard
// routing: single-tool-guard / dual-guard / full fusion), be self-contained, and
// must NOT point at a `.aict` file that `adapters install` never creates ("...
// when/if it exists"). The previous installer only emitted the generic six-layer
// words, so the contract claimed those mechanisms while the entrypoint silently
// shipped none of them. If a future edit to src/adapters.js drops the inlined
// renderSharedCoreContract() body or reintroduces the dead-link wording, this
// test goes red immediately.
test("adapter installer inlines the full core contract (no dead link to an uncreated .aict file)", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-adapters-inline-"));

  runCli(["adapters", "install", "--target", target, "--tool", "all"]);

  const entrypoints = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules/ai-collab.mdc",
    ".github/copilot-instructions.md",
    ".clinerules",
    ".windsurf/rules/ai-collab.md"
  ];

  for (const relative of entrypoints) {
    const content = read(target, relative);

    // The coaching layer is inlined.
    assert.match(content, /coaching/i, `${relative} missing inlined coaching layer`);

    // The completion-node guard routing is inlined: both branches must be present.
    assert.match(content, /single-tool-guard/i, `${relative} missing inlined single-tool-guard branch`);
    assert.match(content, /dual-guard/i, `${relative} missing inlined dual-guard branch`);

    // The completion-claim node itself is described (the trigger for the routing above).
    assert.match(content, /completion[\s-]claim/i, `${relative} missing the completion-claim branch`);

    // Self-contained: the entrypoint must declare it embeds the contract, not
    // defer to a separate file that must be opened first.
    assert.match(content, /self-contained/i, `${relative} must state it is self-contained`);
    assert.match(content, /embedded below/i, `${relative} must embed the contract inline`);

    // Dead-link guard: the old weak "... when/if it exists" pointer wording is gone.
    // It pointed readers at .aict/adapters/SHARED_CORE_CONTRACT.md, a file that
    // `adapters install` never creates, so the rules silently did nothing.
    assert.doesNotMatch(content, /if it exists/i, `${relative} reintroduced the dead-link "if it exists" wording`);
    assert.doesNotMatch(content, /when it exists/i, `${relative} reintroduced the dead-link "when it exists" wording`);
  }
});

// First-run script: the contract must carry the FULL four-step onboarding script
// (install -> scan -> profile+pain-points -> harvest), not the old short promise.
// Each step has a load-bearing anchor the script depends on:
//   Step 0 must show `ai-collab welcome` output VERBATIM (the CLI hard-prints the
//   canonical intro so it is never re-summarized into something garbled);
//   Step 2 opens with a GROUNDED profile read that cites real scan evidence and
//   then WAITs for confirm/correct;
//   Step 3 raises grounded pain points ONE AT A TIME (never a wall-of-text list);
//   Step 4 HARVESTs what THIS conversation produced;
//   and a PLAIN-LANGUAGE hard rule runs throughout (translate task titles to
//   everyday words). If a future edit collapses this back to a single paragraph,
//   the missing anchors fail here. The contract body is the live render output, so
//   this also guards the .aict copy and every adapters-install entrypoint at once.
test("first-run promise is the full four-step onboarding script (welcome-verbatim / grounded profile / one-at-a-time / harvest / plain-language)", () => {
  const contract = renderSharedCoreContract();

  // The four steps are all present, in order.
  const iStep0 = contract.indexOf("Step 0");
  const iStep1 = contract.indexOf("Step 1");
  const iStep2 = contract.indexOf("Step 2");
  const iStep3 = contract.indexOf("Step 3");
  const iStep4 = contract.indexOf("Step 4");
  for (const [label, idx] of [["Step 0", iStep0], ["Step 1", iStep1], ["Step 2", iStep2], ["Step 3", iStep3], ["Step 4", iStep4]]) {
    assert.ok(idx > 0, `first-run script is missing ${label}`);
  }
  assert.ok(
    iStep0 < iStep1 && iStep1 < iStep2 && iStep2 < iStep3 && iStep3 < iStep4,
    "the four steps must appear in order 0 -> 1 -> 2 -> 3 -> 4"
  );

  // Step 0: show `welcome` output VERBATIM, do not re-summarize.
  assert.match(contract, /ai-collab welcome/, "Step 0 must run `ai-collab welcome`");
  assert.match(contract, /VERBATIM/, "Step 0 must show the welcome output VERBATIM");
  assert.match(contract, /do not re-summarize|do NOT re-summarize/i, "Step 0 must forbid re-summarizing the canonical intro");

  // Step 2: a GROUNDED profile read tied to real scan evidence, then WAIT to confirm.
  assert.match(contract, /GROUNDED read/i, "Step 2 must open with a grounded profile read");
  assert.match(contract, /cite real scan evidence/i, "Step 2 must require citing real scan evidence");
  assert.match(contract, /did I get this right/i, "Step 2 must ask the user to confirm the read");
  assert.match(contract, /\bWAIT\b/, "Step 2 must WAIT for confirm/correct before continuing");
  // It must explicitly reject an ungrounded personality guess (the trust-killer).
  assert.match(contract, /fortune-telling/i, "Step 2 must reject ungrounded personality guesses as fortune-telling");

  // Step 3: grounded pain points, ONE AT A TIME, never invented.
  assert.match(contract, /ONE AT A TIME/, "Step 3 must surface pain points one at a time");
  assert.match(contract, /NEVER invent/i, "Step 3 must never invent a pain point");
  assert.match(contract, /want me to expand[^.]*move to the next/i, "Step 3 must end each point with expand-or-next");

  // Step 4: harvest THIS conversation (profile + the point they cared about), with a save action.
  assert.match(contract, /#### Step 4 — Harvest/, "Step 4 must be the harvest step");
  assert.match(contract, /THIS conversation/, "Step 4 must recap what THIS conversation produced");
  assert.match(contract, /take effect/i, "Step 4 must land on a concrete save-now action");

  // Plain-language hard rule throughout (translate task titles before speaking).
  assert.match(contract, /PLAIN LANGUAGE/, "the script must carry a plain-language hard rule");
  assert.match(contract, /login stuff/, "the plain-language rule must gloss a technical term (auth -> login stuff)");
});

// Keyword-triggered modes: a user can pull a working mode by name. All five modes
// must be wired with their trigger words and behavior. These keywords are what the
// user actually types, so they ship in both Chinese and English; the behavior line
// is the canonical English. blind-spot-scan is referenced WITHOUT a hard dependency
// on a package existing (batch 3 adds it), so the reference must be phrased
// conditionally — never as a dead link to a file that is not there yet.
test("coaching layer ships the keyword-triggered modes table (collision / blind-spot / red-team / dual-guard / root-cause)", () => {
  const contract = renderSharedCoreContract();

  assert.match(contract, /Keyword-triggered modes/, "the coaching layer must have a keyword-triggered modes section");

  // Each mode: a representative trigger keyword AND its mode label.
  for (const [keyword, mode] of [
    ["碰撞模式", "COLLISION"],
    ["扫描盲区", "BLIND-SPOT SCAN"],
    ["红队", "RED TEAM"],
    ["双守卫", "DUAL GUARD"],
    ["根因", "ROOT CAUSE"]
  ]) {
    assert.ok(contract.includes(keyword), `keyword table missing trigger word "${keyword}"`);
    assert.ok(contract.includes(mode), `keyword table missing mode "${mode}"`);
  }

  // English triggers are present too (the table is bilingual).
  for (const enTrigger of ["think with me", "blind spots", "red team", "dual guard", "root cause"]) {
    assert.ok(contract.includes(enTrigger), `keyword table missing English trigger "${enTrigger}"`);
  }

  // blind-spot-scan is referenced softly: the line must NOT assert the mechanism
  // file exists unconditionally (it does not ship until a later batch).
  const blindLine = contract
    .split("\n")
    .find((line) => line.includes("BLIND-SPOT SCAN"));
  assert.ok(blindLine, "the blind-spot line must exist");
  assert.match(
    blindLine,
    /if a `?mechanisms\/blind-spot-scan`? .*is present|otherwise run/i,
    "the blind-spot-scan reference must be conditional, not a hard dependency on an unshipped file"
  );
});

// blind-spot-scan ships as a real mechanism package (the batch the keyword-table
// comment above anticipated). It must be a first-class catalog mechanism, generate
// its full 5-file package, and the mechanism count must read 16 everywhere a count
// is surfaced (the catalog list, the generated mechanisms index, and the manifest).
// This is the contract that keeps the now-present blind-spot-scan from silently
// regressing back into the "referenced but unshipped" state the conditional line
// was a placeholder for.
test("blind-spot-scan ships as a complete mechanism package and the mechanism count is 16", () => {
  // (a) It is a first-class catalog mechanism, so requiredMechanismIds carries it.
  assert.ok(
    requiredMechanismIds.includes("blind-spot-scan"),
    "blind-spot-scan must be a catalog mechanism (present in requiredMechanismIds)"
  );

  // (b) The catalog now defines exactly 16 mechanisms, and every count surface agrees.
  assert.equal(mechanismDefinitions.length, 16, "the catalog must define exactly 16 mechanisms");

  // (c) A fresh workspace ships the full blind-spot-scan package: all five files,
  // each carrying the public-OS framing and no placeholder text.
  const target = mkdtempSync(path.join(tmpdir(), "aicos-blind-spot-scan-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");
  const requiredFiles = ["README.md", "PROMPT.md", "TEMPLATE.md", "EXAMPLE.synthetic.md", "FAILURE_MODES.md"];
  for (const file of requiredFiles) {
    const content = read(workspace, "mechanisms", "blind-spot-scan", file);
    assert.match(content, /DoneTrace|local-first|public-safe/i, `blind-spot-scan/${file} missing public OS framing`);
    assert.doesNotMatch(content, /TBD|TODO|placeholder/i, `blind-spot-scan/${file} contains placeholder text`);
  }

  // (d) Its README must carry the outside-view substance: the borrowed-viewpoint menu,
  // the single counter-question, and the explicit "must not flatter" honesty rule —
  // so the package cannot be gutted into a generic critique mechanism.
  const readme = read(workspace, "mechanisms", "blind-spot-scan", "README.md");
  assert.match(readme, /Blind-Spot Scan/, "blind-spot-scan README must carry its title");
  assert.match(readme, /customer|competitor|expert|opponent/i, "blind-spot-scan README must name the outside viewpoints it borrows");
  assert.match(readme, /counter-question/i, "blind-spot-scan README must keep the one-counter-question output");
  assert.match(readme, /flatter|costume|genuinely challenge/i, "blind-spot-scan README must keep the no-fake-outside-view honesty rule");

  // (e) The generated mechanisms index header and the manifest both report 16.
  const mechanismsIndex = read(workspace, "mechanisms", "README.md");
  assert.match(mechanismsIndex, /## The 16 mechanisms/, "the generated mechanisms index must read '## The 16 mechanisms'");
  assert.match(mechanismsIndex, /blind-spot-scan\//, "the generated mechanisms index must list blind-spot-scan");

  const manifest = JSON.parse(read(workspace, "WORKSPACE_MANIFEST.json"));
  assert.equal(manifest.mechanisms.length, 16, "the workspace manifest must declare 16 mechanisms");
  assert.ok(manifest.mechanisms.includes("blind-spot-scan"), "the workspace manifest must list blind-spot-scan");
});

// The four-step script and the keyword table are not just in render output — they
// must reach the rule files a real tool reads. adapters install inlines the live
// contract, so the entrypoints carry the same anchors. This locks the wiring end to
// end: change render.js, and CLAUDE.md / AGENTS.md / ... carry the new script.
test("adapters install entrypoints carry the four-step script and keyword modes (end-to-end wiring)", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-firstrun-entrypoints-"));
  runCli(["adapters", "install", "--target", target, "--tool", "all"]);

  for (const relative of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/ai-collab.mdc", ".clinerules"]) {
    const content = read(target, relative);
    assert.match(content, /Step 0/, `${relative} missing the four-step first-run script (Step 0)`);
    assert.match(content, /VERBATIM/, `${relative} missing the welcome-verbatim instruction`);
    assert.match(content, /ONE AT A TIME/, `${relative} missing the one-at-a-time pain-point rule`);
    assert.match(content, /PLAIN LANGUAGE/, `${relative} missing the plain-language hard rule`);
    assert.match(content, /Keyword-triggered modes/, `${relative} missing the keyword-triggered modes table`);
    assert.match(content, /COLLISION/, `${relative} missing the collision keyword mode`);
  }
});

// Freshness lock: the committed .aict/adapters/SHARED_CORE_CONTRACT.md is a GENERATED
// file. It must match a fresh render exactly, so an edit to render.js that is not
// re-generated into .aict is caught here (the same guard the generated START_HERE.md
// already has). Without this, the published pack could ship a stale contract while
// the live render and the entrypoints carry the new script.
test("committed .aict/adapters/SHARED_CORE_CONTRACT.md matches a fresh render (no stale generated copy)", () => {
  const committed = read(repoRoot, ".aict", "adapters", "SHARED_CORE_CONTRACT.md");
  assert.equal(
    committed,
    renderSharedCoreContract(),
    "committed .aict/adapters/SHARED_CORE_CONTRACT.md is stale — re-run `init --force` and copy it back"
  );
});

// Feature B (unit): confirmedProfileLearnings is the single selector deciding WHICH
// preferences reach the rule files. It must keep ONLY confirmed/edited profile rows
// (in ledger order) and exclude proposed, dropped, and harvest rows — the same
// "what counts as kept" rule the status recall uses. Locking it here means the
// honesty guarantee does not depend solely on the slower CLI round-trip test.
test("confirmedProfileLearnings keeps only confirmed/edited profile rows (proposed/dropped/harvest excluded)", () => {
  const rows = [
    { id: "l0", type: "harvest", content: "a kept harvest lesson", status: "confirmed", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "l1", type: "profile", content: "kept as written", status: "confirmed", createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "l2", type: "profile", content: "still just a guess", status: "proposed", createdAt: "2026-01-03T00:00:00.000Z" },
    { id: "l3", type: "profile", content: "kept after editing", status: "edited", createdAt: "2026-01-04T00:00:00.000Z" },
    { id: "l4", type: "profile", content: "reviewed and rejected", status: "dropped", createdAt: "2026-01-05T00:00:00.000Z" }
  ];
  const kept = confirmedProfileLearnings(rows);
  assert.deepEqual(kept.map((r) => r.id), ["l1", "l3"], "only confirmed/edited PROFILE rows graduate, in order");
  assert.equal(confirmedProfileLearnings([]).length, 0, "no rows -> empty list");
  assert.equal(confirmedProfileLearnings(undefined).length, 0, "nullish input -> empty list (no crash)");
});

// Feature B: a CONFIRMED profile preference must reach the rule files a real tool
// reads. Filling + confirming a preference used to only echo in the tool's own
// `status` line; the generated CLAUDE.md / .cursorrules / AGENTS.md never carried
// it, so the assistant doing the work could not see it (a white-filled profile).
// adapters install now reads the kept profile preferences straight from the
// learning ledger (the machine source of truth, NOT the drift-prone CANDIDATES.md)
// and inlines them into every entrypoint. Honesty is the whole point, so this test
// also locks the three failure modes: a PROPOSED row must NOT be injected (an
// unreviewed guess passed off as a standing rule), the text must be VERBATIM (not
// paraphrased into a stronger instruction), and the value graduated is the EDITED
// wording, not the original. The preference strings are obvious placeholders, never
// real private data, so the privacy scan over adapters-install output stays clean.
test("adapters install injects confirmed/edited profile preferences into every rule file, and never a proposed one", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-pref-inject-"));
  const ws = path.join(target, ".aict");
  runCli(["init", "--target", target, "--force"]);

  // One confirmed-as-written preference.
  const added = JSON.parse(
    runCli(["learning", "add", "--type", "profile", "--content", "prefer deterministic waits over sleep() in tests", "--json", "--workspace", ws])
  );
  runCli(["learning", "confirm", "--id", added.learning.id, "--workspace", ws]);

  // One preference kept only after an edit — the EDITED wording must graduate.
  const edited = JSON.parse(
    runCli(["learning", "add", "--type", "profile", "--content", "keep summaries short", "--json", "--workspace", ws])
  );
  runCli(["learning", "edit", "--id", edited.learning.id, "--content", "keep summaries to at most three bullets", "--workspace", ws]);

  // One PROPOSED preference (never reviewed) — must NOT be injected.
  runCli(["learning", "add", "--type", "profile", "--content", "PROPOSED-LEAK-CANARY never confirmed", "--workspace", ws]);

  // One DROPPED preference — reviewed and rejected, must NOT be injected.
  const dropped = JSON.parse(
    runCli(["learning", "add", "--type", "profile", "--content", "DROPPED-LEAK-CANARY rejected preference", "--json", "--workspace", ws])
  );
  runCli(["learning", "drop", "--id", dropped.learning.id, "--workspace", ws]);

  runCli(["adapters", "install", "--target", target, "--tool", "all", "--force"]);

  const entrypoints = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules/ai-collab.mdc",
    ".github/copilot-instructions.md",
    ".clinerules",
    ".windsurf/rules/ai-collab.md"
  ];

  for (const relative of entrypoints) {
    const content = read(target, relative);
    // The kept-preferences section exists and is the affirmative variant.
    assert.match(content, /## Your confirmed preferences/, `${relative} missing confirmed-preferences section`);
    assert.match(content, /reviewed and confirmed/i, `${relative} should affirm there are confirmed preferences`);

    // Both kept preferences appear, VERBATIM. The edited row uses the reworded text.
    assert.match(content, /- prefer deterministic waits over sleep\(\) in tests/, `${relative} missing the confirmed preference`);
    assert.match(content, /- keep summaries to at most three bullets/, `${relative} missing the EDITED preference wording`);

    // The pre-edit wording did NOT graduate (only the edited line does).
    assert.doesNotMatch(content, /keep summaries short/, `${relative} leaked the pre-edit wording instead of the edited one`);

    // Honesty locks: a proposed and a dropped preference are NEVER injected.
    assert.doesNotMatch(content, /PROPOSED-LEAK-CANARY/, `${relative} leaked a PROPOSED preference (unconfirmed guess passed off as a rule)`);
    assert.doesNotMatch(content, /DROPPED-LEAK-CANARY/, `${relative} leaked a DROPPED (reviewed-and-rejected) preference`);
  }
});

// Feature B honesty floor: with NO confirmed preference, the rule files must NOT
// fake one. The section says "No confirmed preferences yet" and shows how to add
// one — it never emits a placeholder pseudo-preference. A fresh workspace ships
// only a single PROPOSED harvest seed (l0), which does not qualify, so this is the
// realistic empty case; it is also why the existing privacy/contract surfaces
// (which install into a bare temp dir with no workspace) keep passing unchanged.
test("adapters install does not fake a preference when none is confirmed (honest empty state)", () => {
  // (1) A real but empty workspace: init ships only the proposed harvest seed.
  const withWs = mkdtempSync(path.join(tmpdir(), "aicos-pref-empty-ws-"));
  runCli(["init", "--target", withWs, "--force"]);
  runCli(["adapters", "install", "--target", withWs, "--tool", "claude", "--force"]);

  // (2) No workspace at all (the surface the privacy/contract scans exercise).
  const noWs = mkdtempSync(path.join(tmpdir(), "aicos-pref-no-ws-"));
  runCli(["adapters", "install", "--target", noWs, "--tool", "all", "--force"]);

  const cases = [
    read(withWs, "CLAUDE.md"),
    read(noWs, "CLAUDE.md"),
    read(noWs, "AGENTS.md")
  ];

  for (const content of cases) {
    assert.match(content, /## Your confirmed preferences/, "missing confirmed-preferences section");
    assert.match(content, /No confirmed preferences yet/, "empty state must say so honestly");
    // No bullet list of preferences, and no claim that confirmed preferences exist.
    assert.doesNotMatch(content, /reviewed and confirmed/i, "empty state must not claim confirmed preferences exist");
    // The proposed harvest seed (l0) must never surface as a 'confirmed preference'.
    assert.doesNotMatch(content, /synthetic\) example learning seed/, "a proposed seed row leaked into the preferences block");
  }
});

test("adapter --force backs up existing user-owned instruction files", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-adapter-force-"));

  runCli(["adapters", "install", "--target", target, "--tool", "all"]);
  writeFileSync(path.join(target, "AGENTS.md"), "user owned instruction\n", "utf8");
  const output = runCli(["adapters", "install", "--target", target, "--force", "--tool", "all"]);

  assert.match(output, /Backups: [1-9]/);
    assert.match(read(target, "AGENTS.md"), /DoneTrace Adapter Guidance/);

  const backups = readdirSync(target)
    .filter((entry) => entry.startsWith("AGENTS.md.aict-backup-"))
    .map((entry) => path.join(target, entry));
  assert.equal(backups.length, 1);
  assert.equal(read(backups[0]), "user owned instruction\n");
});

// P0-1: selective install via --tool. The installer no longer scatters all six
// instruction files by default; it installs only the selected (or detected)
// tools, and its dry-run lists the concrete file paths it would create/replace.
test("adapters install --tool <name> installs only the selected tool", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-tool-one-"));

  const output = runCli(["adapters", "install", "--target", target, "--tool", "cursor"]);
  assert.match(output, /Adapter guidance installed/i);
  assert.match(output, /Files written: 1/);
  // Only the cursor entrypoint exists; the other five do not.
  assert.ok(existsSync(path.join(target, ".cursor", "rules", "ai-collab.mdc")), "cursor file should exist");
  for (const other of ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md", ".clinerules", ".windsurf/rules/ai-collab.md"]) {
    assert.equal(existsSync(path.join(target, other)), false, `${other} must NOT be written for --tool cursor`);
  }

  // Comma-separated multi-select writes exactly the named tools.
  const multiTarget = mkdtempSync(path.join(tmpdir(), "aicos-tool-multi-"));
  const multi = runCli(["adapters", "install", "--target", multiTarget, "--tool", "claude,codex"]);
  assert.match(multi, /Files written: 2/);
  assert.ok(existsSync(path.join(multiTarget, "CLAUDE.md")));
  assert.ok(existsSync(path.join(multiTarget, "AGENTS.md")));
  assert.equal(existsSync(path.join(multiTarget, ".clinerules")), false);
});

test("adapters install --tool all writes all six entrypoints (back-compat)", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-tool-all-"));
  const output = runCli(["adapters", "install", "--target", target, "--tool", "all"]);
  assert.match(output, /Files written: 6/);
  for (const relative of [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules/ai-collab.mdc",
    ".github/copilot-instructions.md",
    ".clinerules",
    ".windsurf/rules/ai-collab.md"
  ]) {
    assert.ok(existsSync(path.join(target, relative)), `--tool all must write ${relative}`);
  }
});

test("adapters install --tool auto installs only detected tools, and writes nothing when none are detected", () => {
  // No tool markers in the target -> auto must NOT silently write all six; it
  // reports and writes nothing.
  const empty = mkdtempSync(path.join(tmpdir(), "aicos-tool-auto-empty-"));
  const emptyResult = runResult(["bin/ai-collab.js", "adapters", "install", "--target", empty]);
  assert.equal(emptyResult.status, 0, "auto with nothing detected should exit 0, not crash");
  assert.match(emptyResult.stdout, /No AI tool detected/i);
  assert.match(emptyResult.stdout, /--tool/);
  // Nothing was written.
  assert.equal(readdirSync(empty).length, 0, "auto with no detected tool must write no files");

  // A .cursor/ marker present -> auto installs cursor only.
  const detected = mkdtempSync(path.join(tmpdir(), "aicos-tool-auto-detect-"));
  mkdirSync(path.join(detected, ".cursor"), { recursive: true });
  const detectOutput = runCli(["adapters", "install", "--target", detected]);
  assert.match(detectOutput, /detected: cursor/);
  assert.ok(existsSync(path.join(detected, ".cursor", "rules", "ai-collab.mdc")), "auto should install detected cursor");
  assert.equal(existsSync(path.join(detected, "CLAUDE.md")), false, "auto must not install undetected tools");
});

// Regression lock for the over-broad Copilot detection: a plain `.github/` dir
// (workflows / issue templates, which almost every GitHub repo has) must NOT make
// `--tool auto` "detect" Copilot and write `.github/copilot-instructions.md`.
// Copilot is detected only by its OWN file. If src/adapters.js ever reverts the
// copilot `detect` marker back to the bare `.github` dir, this test goes red.
test("adapters install --tool auto does NOT detect copilot from a plain .github/ directory", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-tool-github-only-"));
  // A normal repo: .github/ exists with workflows, but no copilot-instructions.md.
  mkdirSync(path.join(target, ".github", "workflows"), { recursive: true });
  writeFileSync(path.join(target, ".github", "workflows", "ci.yml"), "name: ci\n", "utf8");

  const result = runResult(["bin/ai-collab.js", "adapters", "install", "--target", target]);
  assert.equal(result.status, 0, "auto on a plain .github repo should exit 0, not crash");
  // Nothing is detected, so nothing is written and the user is told to pick a tool.
  assert.match(result.stdout, /No AI tool detected/i);
  assert.equal(
    existsSync(path.join(target, ".github", "copilot-instructions.md")),
    false,
    "a plain .github/ must NOT trigger writing copilot-instructions.md"
  );

  // ...but the actual Copilot marker file DOES make auto detect copilot.
  const withCopilot = mkdtempSync(path.join(tmpdir(), "aicos-tool-github-copilot-"));
  mkdirSync(path.join(withCopilot, ".github"), { recursive: true });
  writeFileSync(path.join(withCopilot, ".github", "copilot-instructions.md"), "existing copilot rules\n", "utf8");
  const detectOutput = runCli(["adapters", "install", "--target", withCopilot, "--force"]);
  assert.match(detectOutput, /detected: copilot/);
  assert.match(
    read(withCopilot, ".github", "copilot-instructions.md"),
    /DoneTrace Adapter Guidance/,
    "the real copilot marker must let auto install copilot guidance"
  );
});

// Multi-tool coexistence: when several tool markers are present, --tool auto must
// install exactly the detected set and nothing else (no scatter, no misses).
test("adapters install --tool auto installs only the detected tools when several markers coexist", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-tool-multi-detect-"));
  // Present: claude (.claude/), windsurf (.windsurf/), copilot (its own file),
  // plus a plain .github/ that must NOT add anything beyond copilot.
  mkdirSync(path.join(target, ".claude"), { recursive: true });
  mkdirSync(path.join(target, ".windsurf"), { recursive: true });
  mkdirSync(path.join(target, ".github", "workflows"), { recursive: true });
  writeFileSync(path.join(target, ".github", "workflows", "ci.yml"), "name: ci\n", "utf8");
  writeFileSync(path.join(target, ".github", "copilot-instructions.md"), "existing copilot rules\n", "utf8");

  const result = runCli(["adapters", "install", "--target", target, "--force", "--json"]);
  const parsed = JSON.parse(result);
  assert.equal(parsed.toolMode, "auto");
  assert.deepEqual(
    [...parsed.detected].sort(),
    ["claude", "copilot", "windsurf"],
    "auto must detect exactly the three tools whose markers are present"
  );
  // Exactly the detected three entrypoints were written.
  assert.ok(existsSync(path.join(target, "CLAUDE.md")), "claude detected -> CLAUDE.md written");
  assert.ok(existsSync(path.join(target, ".windsurf", "rules", "ai-collab.md")), "windsurf detected -> windsurf file written");
  assert.ok(existsSync(path.join(target, ".github", "copilot-instructions.md")), "copilot detected -> copilot file written");
  // Undetected tools were NOT written.
  assert.equal(existsSync(path.join(target, "AGENTS.md")), false, "codex not detected -> AGENTS.md must NOT be written");
  assert.equal(existsSync(path.join(target, ".cursor", "rules", "ai-collab.mdc")), false, "cursor not detected -> cursor file must NOT be written");
  assert.equal(existsSync(path.join(target, ".clinerules")), false, "cline not detected -> .clinerules must NOT be written");
});

// An existing target file (without --force) must fail with a clear, actionable
// --force prompt rather than silently overwriting or crashing.
test("adapters install errors with a clear --force hint when a target file already exists", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-tool-force-hint-"));
  // Pre-existing user-owned CLAUDE.md; install claude without --force.
  writeFileSync(path.join(target, "CLAUDE.md"), "user owned\n", "utf8");

  const result = runResult(["bin/ai-collab.js", "adapters", "install", "--target", target, "--tool", "claude"]);
  assert.notEqual(result.status, 0, "an existing target file without --force must fail");
  assert.match(result.stderr, /already exists/i);
  assert.match(result.stderr, /--force/);
  // The user's file is untouched (not overwritten, no backup made) on the failed run.
  assert.equal(read(target, "CLAUDE.md"), "user owned\n", "failed run must not modify the existing file");
  assert.equal(
    readdirSync(target).filter((entry) => entry.startsWith("CLAUDE.md.aict-backup-")).length,
    0,
    "failed run must not create a backup"
  );
});

test("adapters install --dry-run lists concrete create/replace file paths", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-tool-dryrun-"));
  // First a real install of cursor so a later dry-run can show backup+replace.
  runCli(["adapters", "install", "--target", target, "--tool", "cursor"]);

  const dry = runCli(["adapters", "install", "--target", target, "--tool", "cursor,claude", "--dry-run"]);
  assert.match(dry, /Dry run\. No adapter files written\./);
  // Cursor file already exists -> listed as backup+replace; claude is new -> create.
  assert.match(dry, /backup\+replace:.*ai-collab\.mdc/);
  assert.match(dry, /create:.*CLAUDE\.md/);
  // Dry-run must not write the new file.
  assert.equal(existsSync(path.join(target, "CLAUDE.md")), false, "dry-run must not write files");

  const dryJson = JSON.parse(
    runCli(["adapters", "install", "--target", target, "--tool", "cursor,claude", "--dry-run", "--json"])
  );
  assert.equal(dryJson.dryRun, true);
  assert.equal(dryJson.filesPlanned, 2);
  assert.ok(Array.isArray(dryJson.plan) && dryJson.plan.length === 2, "json plan should list both files");
  const actions = Object.fromEntries(dryJson.plan.map((entry) => [entry.relativePath, entry.action]));
  assert.equal(actions[".cursor/rules/ai-collab.mdc"], "backup-replace");
  assert.equal(actions["CLAUDE.md"], "create");
});

test("adapters install rejects an unknown --tool value", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-tool-bad-"));
  const result = runResult(["bin/ai-collab.js", "adapters", "install", "--target", target, "--tool", "nano"]);
  assert.notEqual(result.status, 0, "unknown tool must fail");
  assert.match(result.stderr, /Unknown --tool "nano"/i);
});

// P0-5: the profile candidate buffer. A proposed preference must pass through
// profile/CANDIDATES.md (proposed/confirmed/edited/dropped) before it can
// graduate into the long-term profile, and the validator must enforce it.
test("init generates the profile CANDIDATES buffer with a four-state machine", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-candidates-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");

  const candidatesPath = path.join(workspace, "profile", "CANDIDATES.md");
  assert.ok(existsSync(candidatesPath), "profile/CANDIDATES.md must be generated");
  const content = read(candidatesPath);
  for (const phrase of ["State machine", "proposed", "confirmed", "edited", "dropped"]) {
    assert.match(content, new RegExp(phrase, "i"), `CANDIDATES.md missing state ${phrase}`);
  }
  // Only confirmed/edited graduate; the buffer must say so.
  assert.match(content, /only.*confirmed.*and.*edited.*graduate/i, "CANDIDATES.md must state only confirmed/edited graduate");

  // A clean workspace passes; deleting the buffer must fail validation.
  assert.equal(validateWorkspace(workspace).ok, true, "clean workspace with CANDIDATES.md should pass");
  rmSync(candidatesPath);
  const broken = validateWorkspace(workspace);
  assert.equal(broken.ok, false, "missing CANDIDATES.md must fail validation");
  assert.ok(
    broken.errors.some((error) => /CANDIDATES\.md/.test(error)),
    `expected a CANDIDATES.md error, got:\n${broken.errors.join("\n")}`
  );
});

test("the your-task walkthrough buffers profile candidates instead of dropping them into the profile", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-yourtask-buffer-"));
  runCli(["init", "--target", target, "--force"]);
  const yourTask = read(target, ".aict", "walkthroughs", "10-minute-your-task.md");

  // The candidate flow routes through CANDIDATES.md and the state machine...
  assert.match(yourTask, /CANDIDATES\.md/, "your-task walkthrough must route candidates to CANDIDATES.md");
  assert.match(yourTask, /proposed/i);
  assert.match(yourTask, /confirmed/i);
  assert.match(yourTask, /dropped/i);
  // ...and must NOT tell the user to drop a candidate straight into the profile dir.
  assert.doesNotMatch(yourTask, /drop it into `\.\.\/profile\/`/i, "candidates must not be dropped straight into ../profile/");
});

// P0-3: the real first-run walkthrough (10-minute-your-task.md) is locked as a
// required, content-checked walkthrough. A clean workspace passes; deleting it,
// or gutting its hardened evidence/candidate anchors, fails validation.
test("validator requires the your-task walkthrough with its evidence + candidate anchors", () => {
  const workspace = freshWorkspace("yourtask-validator");
  assert.equal(validateWorkspace(workspace).ok, true, "clean workspace must pass");

  const yourTaskPath = path.join(workspace, "walkthroughs", "10-minute-your-task.md");

  // (a) Delete it -> validation fails with a pointable missing-file error.
  const saved = readFileSync(yourTaskPath, "utf8");
  rmSync(yourTaskPath);
  const missing = validateWorkspace(workspace);
  assert.equal(missing.ok, false, "missing your-task walkthrough must fail");
  assert.ok(
    missing.errors.some((error) => /10-minute-your-task\.md/.test(error)),
    `expected a your-task missing error, got:\n${missing.errors.join("\n")}`
  );

  // (b) Gut the evidence chain (remove the Evidence Pack + INSUFFICIENT_EVIDENCE
  // anchors) while keeping Goal/Expected -> the deeper anchor check still fails.
  const gutted = saved
    .replace(/Evidence Pack/g, "report")
    .replace(/INSUFFICIENT_EVIDENCE/g, "reject");
  writeFileSync(yourTaskPath, gutted, "utf8");
  const thin = validateWorkspace(workspace);
  assert.equal(thin.ok, false, "your-task walkthrough without the evidence anchors must fail");
  assert.ok(
    thin.errors.some((error) => /10-minute-your-task\.md missing Evidence Pack/i.test(error)) ||
      thin.errors.some((error) => /10-minute-your-task\.md missing INSUFFICIENT_EVIDENCE/i.test(error)),
    `expected an evidence-anchor error, got:\n${thin.errors.join("\n")}`
  );
});

test("each collaboration layer includes the full required teaching surface", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-layers-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");

  for (const layer of ["profile", "context", "acceptance", "guard", "handoff", "harvest"]) {
    const layerDir = path.join(workspace, layer);
    const files = listMarkdownFiles(layerDir);
    // The profile layer additionally carries CANDIDATES.md, the proposed-preference
    // buffer (P0-5): candidates land there as `proposed` and only graduate into the
    // profile after the user confirms/edits them. Every other layer keeps the 5-file
    // teaching surface exactly.
    const expectedFiles = new Set(["README.md", "PROMPT.md", "TEMPLATE.md", "EXAMPLE.synthetic.md", "FAILURE_MODES.md"]);
    if (layer === "profile") expectedFiles.add("CANDIDATES.md");
    assert.deepEqual(
      new Set(files),
      expectedFiles,
      `${layer} file surface changed`
    );

    const combined = files.map((file) => read(layerDir, file)).join("\n");
    for (const phrase of [
      "Purpose",
      "When to use",
      "Input shape",
      "Output shape",
      "Copy-paste prompt",
      "Blank template",
      "Filled synthetic example",
      "Common failure modes",
      "Claude Code",
      "Codex",
      "Cursor",
      "Windsurf",
      "Copilot",
      "Cline"
    ]) {
      assert.match(combined, new RegExp(phrase, "i"), `${layer} missing ${phrase}`);
    }
  }
});

test("prompt library, skills, adapters, and synthetic cases meet contract", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-assets-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");

  const promptFiles = [
    "profile-creation.md",
    "profile-refinement.md",
    "project-context-packaging.md",
    "acceptance-definition.md",
    "guard-review.md",
    "red-team-challenge.md",
    "handoff-generation.md",
    "harvest-extraction.md",
    "mode-switching.md",
    "workflow-reset.md",
    "rule-update-proposal.md"
  ];
  for (const file of promptFiles) {
    const content = read(workspace, "prompts", file);
    assert.match(content, /Copy-paste prompt/i);
    assert.doesNotMatch(content, /TBD|TODO|placeholder/i);
  }

  for (const skill of ["profile", "context", "acceptance", "guard", "evidence-pack", "single-tool-guard", "handoff", "harvest", "red-team", "mode-switch"]) {
    const content = read(workspace, "skills", skill, "SKILL.md");
    assert.match(content, /^---\nname:/);
    assert.match(content, /## When to use/i);
    assert.match(content, /## Output/i);
  }

  for (const adapter of ["claude-code", "codex", "cursor", "windsurf", "copilot", "cline"]) {
    const content = read(workspace, "adapters", adapter, "ADAPTER.md");
    assert.match(content, /SHARED_CORE_CONTRACT\.md/);
    assert.match(content, /profile/i);
    assert.match(content, /context/i);
    assert.match(content, /acceptance/i);
    assert.match(content, /guard/i);
    assert.match(content, /handoff/i);
    assert.match(content, /harvest/i);
  }

  const cases = readdirSync(path.join(workspace, "examples"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.equal(cases.length, 5);

  for (const caseName of cases) {
    const content = read(workspace, "examples", caseName, "CASE.md");
    for (const phrase of [
      "Messy starting point",
      "Workspace setup",
      "Profile/context",
      "Acceptance",
      "Execution prompt",
      "Guard review",
      "Handoff",
      "Harvest",
      "What changes compared with a single raw AI chat"
    ]) {
      assert.match(content, new RegExp(phrase, "i"), `${caseName} missing ${phrase}`);
    }
  }
});

test("synthetic case artifacts are rich enough to run and review", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-rich-cases-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");
  const caseNames = readdirSync(path.join(workspace, "examples"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const caseName of caseNames) {
    for (const artifact of [
      "context-package.md",
      "acceptance-card.md",
      "execution-prompt.md",
      "guard-review.md",
      "handoff-note.md",
      "harvest-seed.md"
    ]) {
      const content = read(workspace, "examples", caseName, "artifacts", artifact);
      const nonEmptyLines = content.split("\n").filter((line) => line.trim().length > 0);
      assert.ok(nonEmptyLines.length >= 14, `${caseName}/${artifact} is too thin`);
      for (const phrase of ["Source case", "How to use", "Synthetic content", "Review note"]) {
        assert.match(content, new RegExp(phrase, "i"), `${caseName}/${artifact} missing ${phrase}`);
      }
      assert.doesNotMatch(content, /TBD|TODO|placeholder/i);
    }
  }
});

test("public edition includes the open-system book and public mapping", () => {
  const openSystemDir = path.join(repoRoot, "docs", "open-system");
  const requiredDocs = [
    "00-start-here.md",
    "01-ai-collaboration-os.md",
    "02-six-layer-architecture.md",
    "03-role-system.md",
    "04-core-mechanisms.md",
    "05-failure-patterns.md",
    "06-how-to-adapt-to-your-workflow.md"
  ];

  for (const file of requiredDocs) {
    const content = read(openSystemDir, file);
    assert.match(content, /DoneTrace|AI Collaboration Open System|AI collaboration OS|AI 协作/i, `${file} missing system framing`);
    assert.match(content, /local-first|本地优先/i, `${file} missing local-first framing`);
    assert.doesNotMatch(content, /TBD|TODO|placeholder/i, `${file} contains placeholder text`);
  }

  const startHere = read(openSystemDir, "00-start-here.md");
  for (const phrase of ["10 minutes", "demo", "not a prompt pack", "single-agent", "START_HERE.md"]) {
    assert.match(startHere, new RegExp(phrase, "i"), `00-start-here missing ${phrase}`);
  }

  const mapping = read(repoRoot, "docs", "PUBLIC_MAPPING.md");
  for (const phrase of [
    "Public asset",
    "Public-safe equivalent",
    "Cannot be published",
    "Rewritten",
    "Non-public automation",
    "Synthetic cases"
  ]) {
    assert.match(mapping, new RegExp(phrase, "i"), `PUBLIC_MAPPING missing ${phrase}`);
  }
});

test("init creates the full public OS workspace shape", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-public-shape-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");

  const requiredDirs = [
    "profile",
    "context",
    "acceptance",
    "guard",
    "handoff",
    "harvest",
    "roles",
    "modes",
    "mechanisms",
    "examples",
    "cookbook",
    "state"
  ];

  for (const dir of requiredDirs) {
    assert.ok(existsSync(path.join(workspace, dir)), `missing ${dir}`);
  }

  const manifest = JSON.parse(read(workspace, "WORKSPACE_MANIFEST.json"));
  for (const dir of requiredDirs) {
    assert.ok(manifest.workspaceDirs.includes(dir), `manifest missing ${dir}`);
  }
});

test("mechanism packages are complete runnable copy-paste units", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-mechanisms-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");
  const mechanisms = [
    "dual-guard",
    "scout-review-controller",
    "one-click-dispatch",
    "task-splitting",
    "half-product-review",
    "handoff-abc",
    "harvest-and-erc",
    "do-not-handle-yet",
    "plain-language-first-screen"
  ];
  const requiredFiles = ["README.md", "PROMPT.md", "TEMPLATE.md", "EXAMPLE.synthetic.md", "FAILURE_MODES.md"];

  for (const mechanism of mechanisms) {
    for (const file of requiredFiles) {
      const content = read(workspace, "mechanisms", mechanism, file);
      assert.match(content, /Purpose|Copy-paste prompt|Template|Synthetic example|Failure modes/i, `${mechanism}/${file} too thin`);
      assert.match(content, /DoneTrace|local-first|public-safe/i, `${mechanism}/${file} missing public OS framing`);
      assert.doesNotMatch(content, /TBD|TODO|placeholder/i, `${mechanism}/${file} contains placeholder text`);
    }
  }
});

test("synthetic labs expose the full before-after experiment loop", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-labs-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");
  const caseNames = readdirSync(path.join(workspace, "examples"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  assert.ok(caseNames.length >= 5);
  for (const caseName of caseNames) {
    const content = read(workspace, "examples", caseName, "CASE.md");
    for (const phrase of [
      "Confusing raw input",
      "Likely single-agent failure",
      "AI Collaboration OS process",
      "Context package",
      "Acceptance card",
      "Guard review",
      "Handoff note",
      "Harvest seed",
      "Before/after comparison"
    ]) {
      assert.match(content, new RegExp(phrase, "i"), `${caseName} missing ${phrase}`);
    }
  }
});

test("privacy scanner blocks generic identity, account, hook, and routing leaks", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "aicos-privacy-extra-"));
  writeFileSync(
    path.join(fixture, "leaks.md"),
    [
      // The standard Claude Code hooks directory every user has is kept as a
      // GENERIC marker (so a user does not paste their own hook contents). The
      // path token is fragmented so this scanned test file holds no literal.
      `Hook path: ${".claude"}/hooks/post-tool-use.py`,
      `Env file: ${"."}${"env"}`,
      `Phone: ${"+1"} ${"415"} ${"555"} ${"0199"}`,
      `Account clue: ${"account"}_${"id"} = ${"acct"}_${"live"}_private_user`,
      `Customer leak: ${phrase("real", "customer")} Acme Private Bank`,
      `Project leak: ${phrase("real", "project")} Secret Migration`,
      `Chat leak: ${phrase("real", "conversation")} transcript pasted here`,
      `Hook leak: ${phrase("private", "hook")} post-write-check`,
      `Route leak: ${phrase("private", "route")} guardian-relay-internal`,
      `Threshold: ${"internal"} ${"threshold"} = 0.82`,
      `Weight: ${"scoring"} ${"weight"} = 7`,
      `Session leak: ${"internal"} ${"session"} ${"id"} = ${"sess"}_abcdef1234567890`
    ].join("\n"),
    "utf8"
  );

  const result = runResult(["scripts/privacy-scan.js", "--workspace", fixture]);
  assert.notEqual(result.status, 0);
  for (const label of [
    "Claude hooks dir",
    "environment file",
    "phone number",
    "account identifier",
    phrase("real", "customer"),
    phrase("real", "project"),
    phrase("real", "conversation"),
    phrase("private", "hook"),
    phrase("private", "route"),
    phrase("internal", "threshold"),
    phrase("internal", "weight"),
    phrase("internal", "session", "id")
  ]) {
    assert.match(result.stderr, new RegExp(label, "i"), `missing ${label}`);
  }
});

test("maintainer-private dir names are NOT hard-coded; they are user-configurable", () => {
  // The public package must not bake in the maintainer's own private dir names.
  // A fixture mentioning such a name must therefore PASS by default (nothing
  // generic matches it) — proving the name is not shipped inside the scanner...
  const govName = `${"~/.ai"}-gov`;
  const knowledgeName = `${"Knowledge"}OS`;
  const fixture = mkdtempSync(path.join(tmpdir(), "aicos-privacy-nohardcode-"));
  const localPath = path.join(repoRoot, "privacy-scan.local.json");
  const existingLocalOverride = existsSync(localPath) ? readFileSync(localPath, "utf8") : null;
  writeFileSync(
    path.join(fixture, "doc.md"),
    ["# Doc", `Mentions ${govName} and ${knowledgeName} in prose.`].join("\n"),
    "utf8"
  );

  try {
    // Isolate this check from a real maintainer override that may exist during a
    // release run. The default scanner behavior is the public package behavior.
    rmSync(localPath, { force: true });

    const base = runResult(["scripts/privacy-scan.js", "--workspace", fixture]);
    assert.equal(base.status, 0, `private dir names must not be hard-coded into the scanner: ${base.stderr}`);

    // ...and a user who DOES want those names blocked adds them to the gitignored
    // privacy-scan.local.json override, after which the same content FAILS. The
    // scanner loads the override from the repo root, so write a temp one there and
    // always restore any real local override afterward.
    writeFileSync(
      localPath,
      JSON.stringify({ paths: [govName, knowledgeName] }),
      "utf8"
    );
    const withOverride = runResult(["scripts/privacy-scan.js", "--workspace", fixture]);
    assert.notEqual(withOverride.status, 0, "configured local private names must be blocked");
    assert.match(withOverride.stderr, /denylisted path/i, "override path should be reported as denylisted");

    const repoWithOverride = runResult(["scripts/privacy-scan.js", "--no-extras"]);
    assert.equal(
      repoWithOverride.status,
      0,
      `the local override is scanner policy input, not scanned content: ${repoWithOverride.stderr}`
    );
  } finally {
    if (existingLocalOverride === null) {
      rmSync(localPath, { force: true });
    } else {
      writeFileSync(localPath, existingLocalOverride, "utf8");
    }
  }
  assert.equal(existsSync(localPath), existingLocalOverride !== null, "local override presence must be restored");
  if (existingLocalOverride !== null) {
    assert.equal(readFileSync(localPath, "utf8"), existingLocalOverride, "real local override content must be restored");
  }
});

function tokensForSimilarity(content) {
  return new Set(
    content
      .toLowerCase()
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3)
      .filter((token) => !["profile", "context", "acceptance", "guard", "handoff", "harvest", "output", "input", "material"].includes(token))
  );
}

function jaccard(left, right) {
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function assertDistinctPackages(files, label, maxSimilarity) {
  const items = files.map((file) => {
    const content = read(file);
    return {
      file,
      content,
      tokens: tokensForSimilarity(content),
      words: content.split(/\s+/).filter(Boolean).length
    };
  });
  const wordCounts = items.map((item) => item.words);
  assert.ok(Math.max(...wordCounts) - Math.min(...wordCounts) >= 45, `${label} have suspiciously similar lengths`);

  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const score = jaccard(items[leftIndex].tokens, items[rightIndex].tokens);
      assert.ok(
        score < maxSimilarity,
        `${label} too similar: ${path.basename(items[leftIndex].file)} vs ${path.basename(items[rightIndex].file)} (${score.toFixed(2)})`
      );
    }
  }
}

test("prompts and skills are distinct ability packages, not cloned templates", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-distinct-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");

  const promptFiles = readdirSync(path.join(workspace, "prompts"))
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => path.join(workspace, "prompts", entry));
  assert.equal(promptFiles.length, 11);
  assertDistinctPackages(promptFiles, "prompts", 0.52);

  const skillFiles = readdirSync(path.join(workspace, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(workspace, "skills", entry.name, "SKILL.md"));
  assert.equal(skillFiles.length, 10);
  assertDistinctPackages(skillFiles, "skills", 0.5);
});

test("flagship case shows raw input, baseline AI, six-layer run, artifacts, comparison, and next step", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-flagship-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");
  const flagship = read(workspace, "examples", "ai-coding-long-task", "CASE.md");

  for (const phrase of ["raw-input", "baseline-output", "system-run", "artifacts", "comparison", "next-step"]) {
    assert.match(flagship, new RegExp(`## ${phrase}`, "i"), `flagship missing ${phrase}`);
  }
  for (const layer of ["profile", "context", "acceptance", "guard", "handoff", "harvest"]) {
    assert.match(flagship, new RegExp(`${layer} artifact`, "i"), `flagship missing ${layer} artifact`);
  }
  assert.equal((flagship.match(/A raw chat produces a plausible refactor plan/g) ?? []).length, 1);
  assert.match(flagship, /copy and run/i);
  assert.match(flagship, /raw chat/i);
});

test("flagship first AI output, guard review, and revised output form a checkable causal chain", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-flagship-chain-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");
  const caseDir = path.join(workspace, "examples", "ai-coding-long-task");
  const artifactsDir = path.join(caseDir, "artifacts");

  const firstAi = read(artifactsDir, "first-ai-output.md");
  const guard = read(artifactsDir, "guard-review.md");
  const revised = read(artifactsDir, "revised-output.md");
  const flagship = read(caseDir, "CASE.md");

  // The two new flagship artifacts must actually be produced by the generator.
  assert.ok(existsSync(path.join(artifactsDir, "first-ai-output.md")), "missing first-ai-output.md");
  assert.ok(existsSync(path.join(artifactsDir, "revised-output.md")), "missing revised-output.md");

  // (1) first-ai-output.md: at least one code fence + a completion claim + a named defect point.
  const firstAiFences = (firstAi.match(/^```/gm) ?? []).length;
  assert.ok(firstAiFences >= 2, `first-ai-output.md needs at least one closed code fence (found ${firstAiFences} fence markers)`);
  assert.match(firstAi, /completion claim/i, "first-ai-output.md missing completion claim");
  assert.match(
    firstAi,
    /onKeyDown[^.]*stub|stub[^.]*log|no keyboard test/i,
    "first-ai-output.md missing an explicit defect point (onKeyDown stub / no keyboard test)"
  );

  // (2) guard-review.md: cites first-ai-output.md and uses a line-number reference format.
  assert.match(guard, /first-ai-output\.md/i, "guard-review.md must reference first-ai-output.md");
  const lineRefs = guard.match(/\blines?\s+\d+(?:\s*-\s*\d+)?/gi) ?? [];
  assert.ok(lineRefs.length >= 1, `guard-review.md must use a line reference like "lines 27-30" (found ${lineRefs.length})`);
  assert.match(guard, /\blines?\s+27\s*-\s*30\b/i, "guard-review.md must cite the onKeyDown stub at lines 27-30");

  // (3) revised-output.md: an arrow-key/keyboard reorder implementation + a matching keyboard test.
  assert.match(
    revised,
    /onKeyDown|Arrow(?:Up|Down)|keyDown|keyboard/i,
    "revised-output.md missing keyboard reorder implementation"
  );
  assert.match(revised, /Arrow(?:Up|Down)/, "revised-output.md must wire arrow keys for reorder");
  assert.match(revised, /moveTask/, "revised-output.md must call moveTask from the keyboard handler");
  assert.match(
    revised,
    /test\([^)]*keyboard|keyDown|arrow keys reorder/i,
    "revised-output.md missing a keyboard reorder test"
  );

  // (4) flagship CASE.md: no level-2 heading ("## ") may repeat (guards against duplicated stacked sections).
  const headingCounts = new Map();
  for (const match of flagship.matchAll(/^## (.+?)\s*$/gm)) {
    const heading = match[1].trim().toLowerCase();
    headingCounts.set(heading, (headingCounts.get(heading) ?? 0) + 1);
  }
  for (const [heading, count] of headingCounts) {
    assert.ok(count < 2, `flagship CASE.md duplicates level-2 heading "## ${heading}" (${count} times)`);
  }
  assert.ok(headingCounts.size >= 6, "flagship CASE.md should expose multiple distinct level-2 sections");

  // (5) Handoff must stay consistent with the revised/accepted output across EVERY surface that
  // represents the post-revised / handoff / overview state, not just the artifact-level handoff.
  // Once revised-output.md says the keyboard reorder is fixed and the guard accepted it, every
  // such surface must NOT still describe the keyboard work as missing/pending/next-to-do:
  //   - the standalone handoff-note.md artifact
  //   - the flagship CASE.md "## Handoff note" section
  //   - the README first-screen "Handoff:" preview line
  //   - the generated .aict/START_HERE.md "Handoff:" preview line
  // Otherwise a reader who walks the 10-minute loop (or just skims the README / START_HERE entry
  // preview) reaches a handoff that contradicts the accepted result. This is the surface set that
  // historically drifted: the artifact handoff said "accepted" while the entry previews still said
  // "keyboard test pending".
  const handoffNote = read(artifactsDir, "handoff-note.md");

  // Precondition guard: this assertion is only meaningful while revised claims the keyboard is fixed + accepted.
  assert.match(revised, /accepted/i, "revised-output.md must record the guard re-review as accepted");
  assert.match(revised, /keyboard|Arrow(?:Up|Down)/i, "revised-output.md must record the keyboard reorder as fixed");

  // Extract only the flagship "## Handoff note" section so the pre-fix guard-review narrative
  // (which legitimately says the keyboard test was missing) does not trip this check.
  const handoffSectionMatch = flagship.match(/^## Handoff note\s*\n([\s\S]*?)(?=^## )/m);
  assert.ok(handoffSectionMatch, "flagship CASE.md must contain a '## Handoff note' section");
  const handoffSection = handoffSectionMatch[1];

  // Extract ONLY the single-line "Handoff:" preview from README and the generated START_HERE.
  // These files legitimately carry pre-fix lines ("Acceptance: ... keyboard reorder both need tests",
  // "Guard: reject completion until keyboard movement has evidence"), so we scope the stale-state
  // check to the final-state handoff preview line and never to the whole file. The "Handoff:" line
  // is the one that represents the concluding/handoff state of the loop.
  const readmeText = read(repoRoot, "README.md");
  const readmeHandoffMatch = readmeText.match(/^Handoff:.*$/m);
  assert.ok(readmeHandoffMatch, "README.md must contain a first-screen 'Handoff:' preview line");
  const readmeHandoffLine = readmeHandoffMatch[0];

  const startHereText = read(workspace, "START_HERE.md");
  const startHereHandoffMatch = startHereText.match(/^Handoff:.*$/m);
  assert.ok(startHereHandoffMatch, "generated START_HERE.md must contain a 'Handoff:' preview line");
  const startHereHandoffLine = startHereHandoffMatch[0];

  // The README and START_HERE previews are meant to stay byte-for-byte identical (one is a hand-kept
  // copy of the renderStartHere() source). Pin that so they cannot silently diverge again.
  assert.equal(
    readmeHandoffLine,
    startHereHandoffLine,
    "README first-screen 'Handoff:' preview must match the generated START_HERE 'Handoff:' preview"
  );

  const stalePatterns = [
    /keyboard test (?:is )?missing/i,
    /Pending:[^.\n]*keyboard[^.\n]*test/i,
    /add (?:a |the )?keyboard test/i,
    /keyboard (?:reorder )?test (?:is )?pending/i,
    // Broader catch for the entry-preview regression class: a final-state line that still ties
    // "keyboard" to "pending" / "missing" in the same sentence (the accepted wording does not).
    /keyboard[^.\n]*\bpending\b/i,
    /keyboard[^.\n]*\bmissing\b/i,
    /\bpending\b[^.\n]*keyboard/i,
    /\bmissing\b[^.\n]*keyboard/i
  ];
  for (const surface of [
    ["handoff-note.md", handoffNote],
    ["flagship CASE.md handoff section", handoffSection],
    ["README first-screen Handoff preview line", readmeHandoffLine],
    ["generated START_HERE.md Handoff preview line", startHereHandoffLine]
  ]) {
    const [label, text] = surface;
    for (const pattern of stalePatterns) {
      assert.ok(
        !pattern.test(text),
        `${label} still describes the keyboard work as unfinished (${pattern}) after revised-output.md accepted the fix`
      );
    }
    // The handoff should now reflect the accepted state and point the next session at the visual polish.
    assert.match(text, /accepted/i, `${label} must record the guard's accepted fix`);
    assert.match(text, /visual polish/i, `${label} must carry visual polish as the remaining unverified work`);
  }
});

test("contract validator checks the repo and generated workspace", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-validator-"));
  runCli(["init", "--target", target, "--force"]);

  const output = run(["scripts/validate-contract.js", "--workspace", path.join(target, ".aict")]);
  assert.match(output, /Contract check passed/);
});

test("public package avoids private leakage and diagnosis-first framing", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-privacy-"));
  runCli(["init", "--target", target, "--force"]);

  const output = run(["scripts/privacy-scan.js", "--workspace", path.join(target, ".aict")]);
  assert.match(output, /Privacy scan passed/);

  const readme = read(repoRoot, "README.md");
  const firstScreen = readme.slice(0, 1800);
  assert.match(firstScreen, /open-source personal AI collaboration workspace/i);
  assert.match(firstScreen, /START_HERE\.md/);
  assert.doesNotMatch(firstScreen, /doctor/i);
  assert.doesNotMatch(firstScreen, /diagnos/i);
});

// Single-tool is positioned as the FIRST-CLASS front door, not a degraded fallback,
// AND the three owner-pinned Chinese sentences ship verbatim on both the README and
// the generated START_HERE surface. The honesty boundary (single tool tops out at L2,
// a plain pass needs a different model family) must ride alongside the reframe so the
// "first-class" framing never drifts into claiming a single tool can plain-pass.
//
// These three sentences are CONTRACT TEXT: they must appear byte-for-byte. If a future
// edit paraphrases any of them, or reverts single-tool to "degraded fallback" framing,
// this test goes red.
//
// 中文 (sanctioned bilingual block — these are the owner-pinned contract sentences this
// test pins verbatim, not pasted private material; the privacy scanner exempts the lines
// in this block):
const OWNER_SINGLE_TOOL_SENTENCES = [
  // (1) one AI is enough to start — turn "done" into evidence-backed/re-checkable/handoffable/harvestable
  "一个AI也能开始：先把\"做完了\"变成有证据、可复核、可交接、可沉淀的结果。",
  // (2) a second model family is the UPGRADE, not the entry bar
  "有第二个模型族时，可以升级成跨族双守卫。",
  // (3) the honesty floor — never disguise a single-tool self-review as a cross-family pass
  "我们不会把单工具自审伪装成跨族通过。"
];

test("single-tool is the first-class front door and the three owner sentences ship verbatim (README + generated START_HERE)", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-firstclass-"));
  runCli(["init", "--target", target, "--force"]);

  const readme = read(repoRoot, "README.md");
  const committedStartHere = read(repoRoot, ".aict", "START_HERE.md");
  const generatedStartHere = read(target, ".aict", "START_HERE.md");

  // The committed START_HERE must match a fresh generation (it is a generated file).
  assert.equal(committedStartHere, generatedStartHere, "committed .aict/START_HERE.md must match renderStartHere() output");

  // (a) Every owner sentence is present VERBATIM on both surfaces.
  for (const sentence of OWNER_SINGLE_TOOL_SENTENCES) {
    assert.ok(readme.includes(sentence), `README.md is missing the verbatim owner sentence: ${sentence}`);
    assert.ok(generatedStartHere.includes(sentence), `generated START_HERE.md is missing the verbatim owner sentence: ${sentence}`);
  }

  // (b) Single-tool is framed as a first-class start, not a downgrade, on both surfaces.
  for (const [label, text] of [["README.md", readme], ["generated START_HERE.md", generatedStartHere]]) {
    assert.match(text, /front door, not a downgrade/i, `${label} must frame single-tool as the front door, not a downgrade`);
    assert.match(text, /ceiling, not the entry bar/i, `${label} must frame the cross-family dual-guard as the ceiling, not the entry bar`);
  }

  // (c) The honesty boundary rides alongside the reframe: a single tool tops out at L2 and a
  // plain pass requires a different model family. The first-class framing must NOT erase this.
  for (const [label, text] of [["README.md", readme], ["generated START_HERE.md", generatedStartHere]]) {
    assert.match(text, /single tool tops out at L2|tops out at L2 \(pass-with-risk\)/i, `${label} must keep the single-tool L2 ceiling on the record`);
    assert.match(text, /plain pass requires L3\+ with a different model family/i, `${label} must keep "a plain pass requires L3+ with a different model family"`);
  }

  // (d) The mechanism one-liner in the generated mechanisms index is reframed away from
  // "degraded" while keeping the L2-cap honesty.
  const mechanismsIndex = read(target, ".aict", "mechanisms", "README.md");
  const singleToolLine = mechanismsIndex.split("\n").find((line) => line.includes("single-tool-guard/"));
  assert.ok(singleToolLine, "mechanisms index must list single-tool-guard");
  assert.doesNotMatch(singleToolLine, /degraded/i, "single-tool-guard one-liner must not call it a 'degraded' guard");
  assert.match(singleToolLine, /default starting guard/i, "single-tool-guard one-liner must frame it as the default starting guard");
  assert.match(singleToolLine, /L2/, "single-tool-guard one-liner must keep the L2 cap honesty");
});

// The anti-fake-green core in the guard-review prompt is LOAD-BEARING honesty and must
// not be softened by any positioning reframe: a single tool tops out at pass_with_risk
// (the L2 ceiling), and a plain pass requires L3+ (the cross-family pack). This test
// pins that wording so a future "make single-tool sound better" edit cannot quietly
// relax the ceiling.
test("anti-fake-green core: single-tool L2 ceiling + plain-pass-needs-L3+ wording is intact", () => {
  const guardReview = read(repoRoot, ".aict", "prompts", "guard-review.md");
  assert.match(guardReview, /L2 \(single tool\) tops out at pass_with_risk/, "the L2 single-tool ceiling wording must be intact");
  assert.match(guardReview, /a plain pass needs L3\+ \(the cross-family pack\)/, "the plain-pass-needs-L3+ wording must be intact");
  assert.match(guardReview, /L2: you have the author's commands or tests but you are a single tool/, "the L2 definition (single tool) must be intact");
});

test("privacy scanner catches common token, email, and local path leaks", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "aicos-privacy-fixture-"));
  mkdirSync(path.join(fixture, ".cursor", "rules"), { recursive: true });
  writeFileSync(
    path.join(fixture, "leaks.md"),
    [
      `GitHub classic: ${"ghp_"}1234567890abcdef1234567890abcdef1234`,
      `GitHub fine-grained: ${"github_pat_"}11AAAAAAA0abcdefghijk_abcdefghijk1234567890abcdefghijk1234567890`,
      `Slack bot: ${"xoxb-"}123456789012-123456789012-abcdefghijklmnopqrstuvwx`,
      `Bearer: Authorization: ${"Bearer "}abcdefghijklmnopqrstuvwxyz1234567890`,
      `Camel key: ${"api"}Key = "abcdefghijklmnopqrstuvwxyz123456"`,
      `Email: private.person${"@"}company.internal`,
      `Path: ${"/Users"}/privateperson/SecretProject/file.md`
    ].join("\n"),
    "utf8"
  );
  writeFileSync(
    path.join(fixture, ".cursor", "rules", "leak.mdc"),
    `Linux path: ${"/home"}/alex/PrivateProject/file.md\n`,
    "utf8"
  );
  writeFileSync(
    path.join(fixture, ".clinerules"),
    `Windows path: ${"C:"}${"\\"}Users${"\\"}Alex${"\\"}PrivateProject${"\\"}file.md\n`,
    "utf8"
  );
  // Home-directory path VARIANTS (env-var home + tilde home subtree). Each is a real
  // leaked local path and must trip the generic "local machine path" rule. The
  // literals are fragmented so this scanned test file holds no whole path token.
  writeFileSync(
    path.join(fixture, "variants.md"),
    [
      `Posix env home: ${"$"}HOME/${"Documents"}/private-notes.md`,
      `Braced env home: ${"$"}{HOME}/${"Desktop"}/RealClient/contract.md`,
      `Windows env home: ${"%USERPROFILE%"}${"\\"}Documents${"\\"}private.md`,
      `Tilde home subtree: ${"~"}/${"Projects"}/SecretMigration/file.js`
    ].join("\n"),
    "utf8"
  );

  const result = runResult(["scripts/privacy-scan.js", "--workspace", fixture]);
  assert.notEqual(result.status, 0);
  for (const label of ["GitHub token", "Slack token", "Bearer token", "apiKey", "email address", "local machine path"]) {
    assert.match(result.stderr, new RegExp(label, "i"), `missing ${label}`);
  }
  assert.match(result.stderr, /\.cursor\/rules\/leak\.mdc/);
  assert.match(result.stderr, /\.clinerules/);
  // The new home-path variants are reported as "local machine path" on variants.md.
  assert.match(result.stderr, /variants\.md.*local machine path/);
});

// Drift guard for the documentation SUMMARY surfaces.
//
// The mechanism/role packs under .aict/ were deepened (P1) after the doc summaries were
// first written. A summary that concatenates a one-line description of each mechanism/role
// is exactly the kind of surface that silently goes stale when the underlying pack is
// reframed — the pack now says "binding gate vs reference" or "three handoff modes" while a
// forgotten doc bullet still says "two review passes" or "candidate interpretations".
//
// The earlier handoff guard (see "flagship first AI output ... causal chain") locked four
// post-revision STATE surfaces against keyboard/visual-polish drift. This guard extends that
// idea from "the flagship's state" to "the documentation's framing of the mechanisms and
// roles": it asserts the key summary surfaces do not carry the known stale framing left over
// from before the deepening, and — so the guard also catches a summary being gutted back to
// the old wording — that each surface still carries the CURRENT framing anchors.
//
// Scope is deliberately narrow: only the specific summary blocks are extracted and checked,
// never whole files, so legitimate narrative (e.g. the singular "first verifiable slice" in
// task-splitting, or role "escalates to" lines) is not tripped.
test("documentation summary surfaces do not carry stale pre-deepening mechanism/role framing", () => {
  const openSystemDir = path.join(repoRoot, "docs", "open-system");

  // Known stale framing words, each tied to the mechanism whose pack was reframed away from it:
  //   "two review passes"               -> dual-guard (now cross-family binding + same-family reference)
  //   "verifiable slices" / "broad goals become" -> task-splitting (now five-question self-check)
  //   "candidate interpretation(s)" / "confirmed state, candidate" -> handoff A/B/C
  //                                        (A/B/C are now three handoff MODES, not facts/interpretations/actions)
  //   "without exposing source history" -> harvest/ERC (now scan->card->redact->confirm->file + double lock)
  //   "degraded" (re: single-tool)      -> single-tool-guard (now the FIRST-CLASS "default starting
  //                                        guard", not a degraded fallback; dual-guard is the ceiling).
  //                                        Scope note: this list is applied ONLY to the summary blocks
  //                                        extracted below (the "## Mechanisms" summary, the role
  //                                        summaries, and the handoff-A/B/C bullet/README) via
  //                                        assertNoStale — never to whole files — so the legitimate
  //                                        CORRUPTION-sense "degraded workspace/ledger" wording in
  //                                        src/validate.js is out of scope and is not tripped.
  const staleFraming = [
    /two review passes/i,
    /verifiable slices/i,
    /broad goals become/i,
    /candidate interpretations?/i,
    /confirmed state,\s*candidate/i,
    /without exposing source history/i,
    // The handoff A/B/C content-layer framing ("A = facts, B = interpretations, C = actions")
    // that the mode-based reframe replaced.
    /facts,?\s*(candidate\s*)?interpretations?,?\s*and\s*(next[- ]?action|actions)/i,
    // Single-tool reframed from "degraded fallback" to the first-class "default starting guard".
    /degraded/i
  ];

  function sectionBetween(text, startHeadingRe, file) {
    const lines = text.split("\n");
    const startIndex = lines.findIndex((line) => startHeadingRe.test(line));
    assert.ok(startIndex !== -1, `${file}: could not find section heading ${startHeadingRe}`);
    const rest = lines.slice(startIndex + 1);
    const endOffset = rest.findIndex((line) => /^##\s/.test(line));
    const body = (endOffset === -1 ? rest : rest.slice(0, endOffset)).join("\n");
    return body;
  }

  function assertNoStale(label, text) {
    for (const pattern of staleFraming) {
      assert.ok(
        !pattern.test(text),
        `${label} carries stale pre-deepening framing (${pattern}); sync it to the deepened pack`
      );
    }
  }

  // --- Surface 1: core-mechanisms doc, the "## Mechanisms" bullet summary. ---
  const coreMechanisms = read(openSystemDir, "04-core-mechanisms.md");
  const mechanismSummary = sectionBetween(coreMechanisms, /^##\s+Mechanisms\s*$/, "04-core-mechanisms.md");
  assertNoStale("core-mechanisms '## Mechanisms' summary", mechanismSummary);
  // Positive anchors: the deepened framing must actually be present, so a regression that
  // reverts the summary to the old one-liners (which lack these phrases) also fails.
  for (const anchor of [
    /binding gate/i, // dual-guard
    /five-question/i, // task-splitting
    /three handoff modes/i, // handoff A/B/C
    /double lock/i // harvest/ERC
  ]) {
    assert.match(mechanismSummary, anchor, `core-mechanisms '## Mechanisms' summary lost the current framing anchor ${anchor}`);
  }

  // --- Surface 2: role-system doc, the role summary block (intro + the five role summaries). ---
  // The roles were deepened into responsibility matrices; the summary must keep the matrix
  // framing and must not have picked up any handoff content-layer stale framing.
  const roleSystem = read(openSystemDir, "03-role-system.md");
  assertNoStale("role-system summaries", roleSystem);
  // Positive anchors: each role summary is a six-field matrix, so the matrix field markers
  // must be present (guards against a revert to a two-line "does / does not").
  for (const anchor of [/\*\*Can:\*\*/, /\*\*Cannot:\*\*/, /\*\*Escalates to:\*\*/, /\*\*Overreach:\*\*/]) {
    const occurrences = (roleSystem.match(new RegExp(anchor.source, "g")) ?? []).length;
    assert.ok(occurrences >= 5, `role-system summaries lost matrix field ${anchor} on some role (found ${occurrences}, expected >=5)`);
  }

  // --- Surface 3: the handoff state surface. ---
  // Both the core-mechanisms "Handoff A/B/C" bullet and the handoff-abc pack README must use
  // the mode framing and the load-bearing state fields, never the old facts/interpretations/
  // actions content-layer framing.
  const handoffBulletMatch = coreMechanisms.match(/^- Handoff A\/B\/C:.*$/m);
  assert.ok(handoffBulletMatch, "core-mechanisms must contain a 'Handoff A/B/C' summary bullet");
  const handoffBullet = handoffBulletMatch[0];
  assertNoStale("core-mechanisms Handoff A/B/C bullet", handoffBullet);
  assert.match(handoffBullet, /three handoff modes/i, "Handoff A/B/C bullet must use the three-handoff-modes framing");

  const handoffReadme = read(repoRoot, ".aict", "mechanisms", "handoff-abc", "README.md");
  assertNoStale("handoff-abc README", handoffReadme);
  assert.match(handoffReadme, /three handoff modes for three situations/i, "handoff-abc README must keep the mode framing");
  // The load-bearing state fields the deepened handoff carries (replacing the old A/B/C content layers).
  for (const field of [/current state/i, /baseline/i, /next concrete action/i]) {
    assert.match(handoffReadme, field, `handoff-abc README lost the load-bearing field ${field}`);
  }

  // --- Surface 4: the PUBLIC_MAPPING ledger handoff row (reconciled this pass). ---
  // The ledger's Asset class 4 row used to describe A/B/C as "three escalating states";
  // it was reconciled to the mode framing, so guard it against reverting.
  const mapping = read(repoRoot, "docs", "PUBLIC_MAPPING.md");
  const handoffLedgerRow = sectionBetween(mapping, /^###\s+Asset class 4\b.*Handoff/i, "PUBLIC_MAPPING.md");
  assert.doesNotMatch(
    handoffLedgerRow,
    /three escalating handoff states|A\/B\/C states/i,
    "PUBLIC_MAPPING Asset class 4 reverted to the old 'escalating states' framing; it should describe three handoff modes"
  );
});

// --- Deep workspace validation (P2) ---------------------------------------
//
// The CLI `check --workspace` validator was upgraded from "file exists +
// keyword present" to structural depth checks. A workspace that keeps every
// required heading but has been hollowed out (an artifact gutted to its
// scaffold, a flagship code block deleted, a manifest that lists a file which
// no longer exists, the same CASE.md copied across two cases) used to PASS the
// old keyword validator. These tests prove the deepened validator now FAILS
// such a degraded workspace, and — critically — that a clean generated
// workspace still PASSES (no false positives).
//
// Each degradation starts from a real generated workspace and breaks exactly
// one thing, then asserts validateWorkspace reports a pointable error for it.

function freshWorkspace(label) {
  const target = mkdtempSync(path.join(tmpdir(), `aicos-deep-${label}-`));
  const { workspaceRoot } = createWorkspace(target, { force: true });
  return workspaceRoot;
}

test("deep validation: a clean generated workspace passes with no errors", () => {
  const workspace = freshWorkspace("clean");
  const result = validateWorkspace(workspace);
  assert.deepEqual(result.errors, [], `clean workspace should have no errors, got:\n${result.errors.join("\n")}`);
  assert.equal(result.ok, true);
  // The deep layer actually ran (not a no-op that always passes).
  assert.ok(result.deepChecks >= 20, `expected the deep-check layer to run, deepChecks=${result.deepChecks}`);
});

test("deep validation: a case artifact hollowed to boilerplate is rejected", () => {
  const workspace = freshWorkspace("boiler");
  // Sanity: it passes before we break it.
  assert.equal(validateWorkspace(workspace).ok, true);

  // Gut an ordinary case artifact down to its scaffold: every required heading
  // ("Source case", "How to use", "Synthetic content", "Review note") stays, so
  // the OLD keyword validator would have accepted it; only the substance is gone.
  const artifact = path.join(workspace, "examples", "content-production-harvest", "artifacts", "context-package.md");
  writeFileSync(
    artifact,
    [
      "# Context package - Content production and harvest",
      "",
      "## Source case",
      "",
      "## How to use",
      "",
      "## Synthetic content",
      "",
      "## Review note",
      "",
      "## Next step",
      "",
      "## Why this exists",
      "",
      "This artifact makes the case runnable and reviewable.",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = validateWorkspace(workspace);
  assert.equal(result.ok, false, "hollowed artifact should fail deep validation");
  assert.ok(
    result.errors.some((error) => /content-production-harvest\/artifacts\/context-package\.md is boilerplate-only/.test(error)),
    `expected a boilerplate-only error, got:\n${result.errors.join("\n")}`
  );
});

test("deep validation: a manifest that lists a missing file is rejected", () => {
  const workspace = freshWorkspace("manifest");
  const manifestPath = path.join(workspace, "WORKSPACE_MANIFEST.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.prompts.push("ghost-prompt.md");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const result = validateWorkspace(workspace);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => /manifest lists prompt "ghost-prompt\.md" but prompts\/ghost-prompt\.md is missing/.test(error)),
    `expected a manifest-vs-disk error, got:\n${result.errors.join("\n")}`
  );
});

test("deep validation: an undeclared directory under .aict is rejected", () => {
  const workspace = freshWorkspace("dirdrift");
  mkdirSync(path.join(workspace, "rogue-dir"), { recursive: true });
  writeFileSync(path.join(workspace, "rogue-dir", "note.md"), "stray\n", "utf8");

  const result = validateWorkspace(workspace);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => /directory "rogue-dir" exists under \.aict\/ but is not declared in manifest\.workspaceDirs/.test(error)),
    `expected a declared-vs-actual dir error, got:\n${result.errors.join("\n")}`
  );
});

test("deep validation: a gutted flagship code artifact and broken causal chain are rejected", () => {
  // (a) first-ai-output.md stripped of its code fence (claim prose kept).
  const workspaceA = freshWorkspace("flagcode");
  const firstAiPath = path.join(workspaceA, "examples", "ai-coding-long-task", "artifacts", "first-ai-output.md");
  writeFileSync(firstAiPath, readFileSync(firstAiPath, "utf8").replace(/```[\s\S]*?```/g, "(code removed)"), "utf8");
  const resultA = validateWorkspace(workspaceA);
  assert.equal(resultA.ok, false);
  assert.ok(
    resultA.errors.some((error) => /flagship first-ai-output\.md has no fenced code block/.test(error)),
    `expected a no-code-fence error, got:\n${resultA.errors.join("\n")}`
  );

  // (b) guard-review.md stripped of its line-number citations (the causal link
  // into first-ai-output.md). It still names the file, so only the deep check
  // (which requires a real line reference) catches the broken chain.
  const workspaceB = freshWorkspace("flagchain");
  const guardPath = path.join(workspaceB, "examples", "ai-coding-long-task", "artifacts", "guard-review.md");
  writeFileSync(guardPath, readFileSync(guardPath, "utf8").replace(/lines?\s+\d+(\s*-\s*\d+)?/gi, "the handler"), "utf8");
  const resultB = validateWorkspace(workspaceB);
  assert.equal(resultB.ok, false);
  assert.ok(
    resultB.errors.some((error) => /flagship guard-review\.md cites no line numbers/.test(error)),
    `expected a broken-causal-chain error, got:\n${resultB.errors.join("\n")}`
  );
});

test("deep validation: the same CASE.md copied across two cases is rejected as duplicate boilerplate", () => {
  const workspace = freshWorkspace("dupcase");
  const src = path.join(workspace, "examples", "research-knowledge-synthesis", "CASE.md");
  const dst = path.join(workspace, "examples", "multi-tool-collaboration", "CASE.md");
  cpSync(src, dst);

  const result = validateWorkspace(workspace);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => /are identical boilerplate copies/.test(error)),
    `expected a duplicate-boilerplate error, got:\n${result.errors.join("\n")}`
  );
});

test("deep validation: a deepened mechanism stripped of its 9-element structure is rejected", () => {
  const workspace = freshWorkspace("mechschema");
  // dual-guard is a deepened mechanism; remove its "## Pass bar" structure anchor.
  const readmePath = path.join(workspace, "mechanisms", "dual-guard", "README.md");
  writeFileSync(readmePath, readFileSync(readmePath, "utf8").replace(/## Pass bar[^\n]*/, "## (section removed)"), "utf8");

  const result = validateWorkspace(workspace);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => /mechanisms\/dual-guard\/README\.md lost deepened structure anchor "## Pass bar"/.test(error)),
    `expected a mechanism-schema error, got:\n${result.errors.join("\n")}`
  );
});

test("deep validation: a cookbook recipe gutted of its copy-paste block is rejected", () => {
  const workspace = freshWorkspace("cookbook");
  const recipePath = path.join(workspace, "cookbook", "run-a-first-loop.md");
  // Remove the fenced copy-paste block but keep all 8 prose elements/headings.
  writeFileSync(recipePath, readFileSync(recipePath, "utf8").replace(/```[\s\S]*?```/g, "(steps omitted)"), "utf8");

  const result = validateWorkspace(workspace);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => /cookbook\/run-a-first-loop\.md has no copy-paste fenced block/.test(error)),
    `expected a cookbook copy-paste error, got:\n${result.errors.join("\n")}`
  );
});

test("deep validation: the CLI check command FAILS end-to-end on a degraded workspace", () => {
  // End-to-end proof through the actual `ai-collab check --workspace` entrypoint
  // (not just the validateWorkspace unit), so the CLI surface is covered too.
  const target = mkdtempSync(path.join(tmpdir(), "aicos-deep-cli-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");

  // Clean workspace: check passes.
  assert.match(runCli(["check", "--workspace", workspace]), /Contract check passed/);

  // Delete a flagship causal-chain artifact, then check must exit non-zero with a clear reason.
  rmSync(path.join(workspace, "examples", "ai-coding-long-task", "artifacts", "revised-output.md"));
  const broken = runResult(["bin/ai-collab.js", "check", "--workspace", workspace]);
  assert.notEqual(broken.status, 0, "degraded workspace must make `check` exit non-zero");
  assert.match(broken.stderr, /Contract check failed/);
  assert.match(broken.stderr, /revised-output\.md is missing/);
});

// --- Hardened privacy gate (P2): Chinese leak detection + extra ID shapes ------
//
// The planted secrets below are assembled at runtime from fragments so the literals
// never appear whole in this (scanned) test file. Chinese is built from code points
// (cjk()) for the same reason: the scanner reads tests/contract.test.js too, so raw
// CJK literals here would (correctly) trip it.
const cjk = (...codes) => String.fromCharCode(...codes);

test("privacy scanner catches Chinese mobile numbers and UUID-style session ids", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "aicos-privacy-id-"));
  writeFileSync(
    path.join(fixture, "leaks.md"),
    [
      `China mobile: ${"139"}${"12345678"}`,
      `Session: ${"3f9a1b2c"}-4d5e-6f70-8192-a3b4c5d6e7f8`
    ].join("\n"),
    "utf8"
  );
  const result = runResult(["scripts/privacy-scan.js", "--workspace", fixture]);
  assert.notEqual(result.status, 0, "planted ids must fail the scan");
  for (const label of ["Chinese mobile number", "UUID-style session id"]) {
    assert.match(result.stderr, new RegExp(label, "i"), `missing ${label}`);
  }
});

test("privacy scanner catches a denylisted Chinese private term and stray Chinese text", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "aicos-privacy-zh-"));
  // Built from code points so this scanned test file holds no raw CJK.
  const realCustomer = cjk(30495, 23454, 23458, 25143); // denylisted Chinese term #1
  const customerRoster = cjk(23458, 25143, 21517, 21333); // denylisted Chinese term #2
  const strayPrivate = cjk(36825, 26159) + realCustomer + cjk(36164, 26009, 65292, 19981, 24212, 20844, 24320, 12290); // unmarked Chinese paragraph
  writeFileSync(
    path.join(fixture, "pasted.md"),
    ["# Notes", strayPrivate, `${customerRoster}: Acme Bank`].join("\n"),
    "utf8"
  );
  const result = runResult(["scripts/privacy-scan.js", "--workspace", fixture]);
  assert.notEqual(result.status, 0, "planted Chinese private material must fail the scan");
  assert.match(result.stderr, /denylisted Chinese private term/i);
  assert.match(result.stderr, /unsanctioned Chinese text/i);
});

test("privacy scanner does not false-positive on the sanctioned bilingual surface", () => {
  // The repo intentionally ships a Chinese onboarding surface. Content under a
  // Chinese section marker, numbered steps in that block, and zh: localized strings
  // must all pass. Strings are built from code points (no raw CJK in this file).
  const fixture = mkdtempSync(path.join(tmpdir(), "aicos-privacy-bilingual-"));
  const heading = cjk(35, 35, 32, 20013, 25991, 32, 54, 48, 32, 20998, 38047, 25645, 24314); // ## <zh> 60 <zh>
  const step = cjk(49, 46, 32, 20808, 20889, 19968, 20010, 36731, 37327, 32, 112, 114, 111, 102, 105, 108, 101, 46); // 1. <zh> profile.
  const localised = "  zh: \"" + cjk(26412, 22320, 20248, 20808) + "\""; // zh: "<zh>"
  writeFileSync(
    path.join(fixture, "doc.md"),
    ["# Doc", "English line.", heading, step, localised].join("\n"),
    "utf8"
  );
  const result = runResult(["scripts/privacy-scan.js", "--workspace", fixture]);
  assert.equal(result.status, 0, `sanctioned bilingual content must pass: ${result.stderr}`);
  assert.match(result.stdout, /Privacy scan passed/);
});

test("privacy scanner flags a private file sneaking into the npm pack list", () => {
  // Unit-check the forbidden-in-pack rule the scanner applies to `npm pack` output,
  // without depending on a writable npm cache here. Tokens are fragmented so this
  // scanned test file does not itself contain the literal forbidden paths.
  // Only GENERIC, anyone-applies markers are baked into the shared rule (an env
  // file, a claude config dir, a backup, key material). A maintainer's own private
  // dir name is NOT hard-coded; it is supplied via `extraPrivateDirs`. Tokens are
  // fragmented so this scanned test file does not itself contain the literals.
  const dot = ".";
  const forbidden = [
    [new RegExp(`(^|/)\\${dot}env(\\${dot}|$)`, "i"), "env file"],
    [new RegExp(`(^|/)\\${dot}claude(/|$)`, "i"), "claude config dir"],
    [new RegExp(`\\${dot}aict-backup-`, "i"), "adapter backup"],
    [new RegExp(`\\${dot}(pem|key|p12|pfx)$`, "i"), "key material"]
  ];
  const planted = [
    `${dot}env`,
    `${dot}claude/settings.json`,
    `CLAUDE.md${dot}aict-backup-20260101-000000`,
    `secrets/id_rsa${dot}pem`
  ];
  for (const file of planted) {
    assert.ok(forbidden.some(([re]) => re.test(file)), `pack rule should flag ${file}`);
  }
  // A normal shipped file must NOT match.
  assert.ok(!forbidden.some(([re]) => re.test("README.md")), "README must be allowed");
  assert.ok(!forbidden.some(([re]) => re.test(".aict/START_HERE.md")), "workspace file must be allowed");
});

// B4 #3: package.json publish-readiness metadata. RELEASE_CHECKLIST + README both
// say this package is published to npm as a PUBLIC, Apache-2.0 package via
// `npm publish`. The release-safety fields a public publish relies on must all be
// present and well-formed, and — because the publish is explicitly public — the
// intent must be pinned with publishConfig.access:"public" so a future scoped
// rename (or a registry that defaults to restricted) cannot silently publish it
// private. This guards against a field being dropped in a future edit.
test("B4 #3: package.json carries complete publish-ready metadata (repository/bugs/homepage/license/files/engines + explicit public publishConfig)", () => {
  const pkg = JSON.parse(read(repoRoot, "package.json"));

  // repository: an object with a git url pointing at the project repo.
  assert.equal(typeof pkg.repository, "object", "repository must be an object");
  assert.equal(pkg.repository.type, "git", "repository.type must be git");
  assert.match(pkg.repository.url, /github\.com\/.+\/donetrace/i, "repository.url must point at the project repo");

  // bugs + homepage: present and project-scoped.
  assert.ok(pkg.bugs && /github\.com\/.+\/issues/i.test(pkg.bugs.url), "bugs.url must be the issues tracker");
  assert.match(pkg.homepage, /github\.com\/.+\/donetrace/i, "homepage must point at the project");

  // license: the Apache-2.0 the LICENSE file + checklist declare.
  assert.equal(pkg.license, "Apache-2.0", "license must be Apache-2.0 (matches the LICENSE file and RELEASE_CHECKLIST)");

  // files: a non-empty allowlist (the package ships an explicit file set, not the
  // whole working tree). Sanity-check the load-bearing dirs are included.
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0, "files must be a non-empty publish allowlist");
  for (const required of ["src", "bin"]) {
    assert.ok(pkg.files.includes(required), `files must include the ${required} dir`);
  }

  // engines.node: a declared minimum runtime.
  assert.ok(pkg.engines && typeof pkg.engines.node === "string" && pkg.engines.node.length > 0, "engines.node must declare a minimum Node version");

  // publishConfig.access:"public" — the only field that was missing. A public,
  // Apache-2.0 package must declare its public access explicitly.
  assert.ok(pkg.publishConfig && typeof pkg.publishConfig === "object", "publishConfig must be present for a public npm publish");
  assert.equal(pkg.publishConfig.access, "public", "publishConfig.access must be 'public' (RELEASE_CHECKLIST/README declare a public publish)");

  // It must NOT be marked private — that would block the documented `npm publish`.
  assert.notEqual(pkg.private, true, "package must not be marked private (the docs describe a public publish)");
});

test("validate-contract degrades gracefully when the temp workspace is not writable", () => {
  // In a read-only sandbox mkdtemp fails; the script must not crash with a raw
  // stack trace — it should validate the committed .aict in place and tell the
  // caller how to get the full check back, exiting 0.
  const result = runResult(["scripts/validate-contract.js"], {
    env: { ...process.env, TMPDIR: "/nonexistent-readonly-aicos/" }
  });
  assert.equal(result.status, 0, `should fall back, not crash: ${result.stderr}`);
  assert.match(result.stderr, /cannot create a temp workspace/i);
  assert.match(result.stderr, /--workspace/);
  assert.match(result.stdout, /Contract check passed/);
});

test("pack-check accepts an explicit --cache for read-only sandboxes", () => {
  const cache = mkdtempSync(path.join(tmpdir(), "aicos-packcache-"));
  const result = runResult(["scripts/pack-check.js", "--cache", cache]);
  assert.equal(result.status, 0, `pack-check --cache should pass: ${result.stderr}`);
  assert.match(result.stdout, /Pack check passed/);
  assert.match(result.stdout, new RegExp(`Cache: ${cache.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

test("privacy scan --strict --no-extras is rejected (strict must not skip scan surfaces)", () => {
  // --strict means "scan everything"; --no-extras means "skip the side-effecting
  // surfaces". Asking for both is contradictory and previously slipped through as
  // exit 0. It must now fail with a clear reason.
  const result = runResult(["scripts/privacy-scan.js", "--strict", "--no-extras"]);
  assert.notEqual(result.status, 0, "--strict --no-extras must not exit 0");
  assert.match(result.stderr, /strict/i);
  assert.match(result.stderr, /contradictory/i);
  // Order of flags should not matter.
  const reversed = runResult(["scripts/privacy-scan.js", "--no-extras", "--strict"]);
  assert.notEqual(reversed.status, 0, "flag order must not let strict skip surfaces");
});

test("forbidden-in-pack rules are a single shared source used by both gates (no drift)", () => {
  // The rule list is enforced by scripts/privacy-scan.js and scripts/pack-check.js.
  // It must live in one shared module so the two copies can never diverge — a
  // divergence would mean one gate blocks a private file while the other ships it.
  // 1) Both gates import the shared module rather than re-inlining a list.
  const scanSrc = read(repoRoot, "scripts", "privacy-scan.js");
  const packSrc = read(repoRoot, "scripts", "pack-check.js");
  assert.match(scanSrc, /from ["']\.\/lib\/forbidden-in-pack\.js["']/, "privacy-scan must import the shared rules");
  assert.match(packSrc, /from ["']\.\/lib\/forbidden-in-pack\.js["']/, "pack-check must import the shared rules");
  // Neither script keeps its own re-declared `forbiddenInPack` array anymore.
  assert.ok(!/const\s+forbiddenInPack\s*=/.test(scanSrc), "privacy-scan must not re-inline a forbidden list");
  assert.ok(!/const\s+forbiddenInPack\s*=/.test(packSrc), "pack-check must not re-inline a forbidden list");

  // 2) The shared list still covers the critical GENERIC private-file shapes,
  //    including .git/ and node_modules/ (so the dedup did not drop coverage). The
  //    shared module intentionally does NOT bake in any maintainer-private dir
  //    name (that would ship it in the public package); those are supplied per
  //    call via `extraPrivateDirs`.
  const dot = ".";
  const mustFlag = [
    `${dot}env`,
    `${dot}claude/settings.json`,
    `CLAUDE.md${dot}aict-backup-20260101-000000`,
    `state${dot}aict.backup-20260101`,
    `secrets/id_rsa${dot}pem`,
    `credentials/token`,
    `node_modules/foo/index.js`,
    `${dot}git/config`
  ];
  for (const file of mustFlag) {
    assert.equal(findForbiddenPackFiles([file]).length >= 1, true, `shared rule should flag ${file}`);
  }
  // Normal shipped files must NOT match.
  for (const ok of ["README.md", ".aict/START_HERE.md", "src/cli.js", "scripts/lib/forbidden-in-pack.js"]) {
    assert.equal(findForbiddenPackFiles([ok]).length, 0, `shared rule must allow ${ok}`);
  }
  // A caller-supplied private dir name is blocked via extraPrivateDirs WITHOUT the
  // name living in the shared shipped module. (Name fragmented via `dot` so this
  // scanned test file holds no literal private dir name.)
  const privateDir = `${dot}my-private-gov`;
  const privateFile = `${privateDir}/NOTES.md`;
  assert.equal(
    findForbiddenPackFiles([privateFile], [privateDir]).length >= 1,
    true,
    "configured private dir must be blocked via extraPrivateDirs"
  );
  // ...but the same path is NOT flagged when no extra dirs are configured (proving
  // the name is not baked into the shared list).
  assert.equal(
    findForbiddenPackFiles([privateFile]).length,
    0,
    "private dir name must not be hard-coded in the shared list"
  );
  // The shared module source must not contain a maintainer-private dir literal.
  const sharedSrc = read(repoRoot, "scripts", "lib", "forbidden-in-pack.js");
  assert.ok(!new RegExp(`${dot}ai-gov`).test(sharedSrc), "shared pack rules must not hard-code a private gov dir name");
  // Sanity: the list is non-trivial.
  assert.ok(FORBIDDEN_IN_PACK.length >= 7, "expected the full forbidden-in-pack rule set");
});

// ===========================================================================
// P1 run layer: the five JSONL ledgers, their CLI commands, the six integrity
// checks, and the privacy-scan jsonl coverage fix.
// ===========================================================================

// A fresh generated workspace whose .aict path we drive the run-layer commands
// against (commands resolve --workspace to the .aict root automatically).
function freshRunWorkspace(label) {
  const target = mkdtempSync(path.join(tmpdir(), `aicos-run-${label}-`));
  runCli(["init", "--target", target, "--force"]);
  return path.join(target, ".aict");
}

function ledger(ws, name) {
  return path.join(ws, "state", name);
}

function ledgerRows(ws, name) {
  const file = ledger(ws, name);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

test("init generates all five run-layer ledgers as valid seed JSONL", () => {
  const ws = freshRunWorkspace("gen");
  // P2 evidence-gate: the seed receipt c0 is an L3 pass, which must now CITE a
  // cross_family_guard evidence row, so evidence.jsonl ships TWO seed rows (e0
  // note + e1 cross_family_guard). The other four ledgers ship one row each.
  const expectedRows = {
    "tasks.jsonl": 1,
    "evidence.jsonl": 2,
    "runs.jsonl": 1,
    "receipts.jsonl": 1,
    "learning-ledger.jsonl": 1
  };
  for (const [name, count] of Object.entries(expectedRows)) {
    assert.ok(existsSync(ledger(ws, name)), `missing ${name}`);
    const rows = ledgerRows(ws, name);
    assert.equal(rows.length, count, `${name} should ship exactly ${count} synthetic seed row(s)`);
  }
  // The cross_family_guard seed row exists and is bound to t0 (so the L3 seed
  // receipt's binding-pass claim is actually backed, not self-asserted).
  const evidenceRows = ledgerRows(ws, "evidence.jsonl");
  assert.ok(
    evidenceRows.some((row) => row.kind === "cross_family_guard" && row.taskId === "t0"),
    "the evidence seed must include a cross_family_guard row bound to t0"
  );
  // Seed rows are mutually consistent (everything points at task t0) and the
  // generated workspace passes validation with zero errors.
  const result = validateWorkspace(ws);
  assert.deepEqual(result.errors, [], `clean run workspace should validate, got:\n${result.errors.join("\n")}`);
  assert.equal(result.ok, true);
});

test("run-layer ledgers are deterministic (committed .aict byte-matches the generator)", () => {
  // The contract validator diffs committed .aict against a fresh generation. If
  // a ledger generator were non-deterministic this would fail, so assert two
  // independent generations produce byte-identical ledgers.
  const a = freshRunWorkspace("det-a");
  const b = freshRunWorkspace("det-b");
  for (const name of ["tasks.jsonl", "evidence.jsonl", "runs.jsonl", "receipts.jsonl", "learning-ledger.jsonl"]) {
    assert.equal(readFileSync(ledger(a, name), "utf8"), readFileSync(ledger(b, name), "utf8"), `${name} not deterministic`);
  }
});

// V3 (release-audit regression): `init` writes a .aict/.gitignore so a user's real
// runtime ledgers (their private task data) are not committed by a routine `git add .`
// inside their own repo, while the templates and hand-written state/*.md notes stay
// versionable.
test("V3: init writes a .aict/.gitignore that ignores the runtime ledgers, not the templates", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-v3-gitignore-"));
  runCli(["init", "--target", target, "--force"]);
  const gi = path.join(target, ".aict", ".gitignore");
  assert.equal(existsSync(gi), true, "init must write .aict/.gitignore");
  const body = readFileSync(gi, "utf8");
  for (const led of ["tasks", "evidence", "runs", "receipts", "learning-ledger"]) {
    assert.match(body, new RegExp(`state/${led}\\.jsonl`), `the .gitignore must ignore the runtime ledger state/${led}.jsonl`);
  }
  // Behavior, not just text: in a real git repo, git must actually ignore the five
  // ledgers and must NOT ignore the templates or the hand-written .md notes.
  if (spawnSync("git", ["--version"]).status === 0) {
    const repo = mkdtempSync(path.join(tmpdir(), "aicos-v3-gitrepo-"));
    spawnSync("git", ["init", "-q"], { cwd: repo });
    runCli(["init", "--target", repo, "--force"]);
    const ignored = (p) => spawnSync("git", ["check-ignore", "-q", p], { cwd: repo }).status === 0;
    for (const led of ["tasks", "evidence", "runs", "receipts", "learning-ledger"]) {
      assert.equal(ignored(`.aict/state/${led}.jsonl`), true, `git must ignore .aict/state/${led}.jsonl`);
    }
    assert.equal(ignored(".aict/START_HERE.md"), false, "git must NOT ignore the template START_HERE.md");
    assert.equal(ignored(".aict/state/CURRENT_STATE.md"), false, "git must NOT ignore the hand-written state notes");
  }
});

// V3 (negative twin): the template generator (createWorkspace WITHOUT the gitignore
// opt-in — exactly what the contract validator and `demo` use) must emit NO .gitignore.
// A nested .gitignore in the committed/shipped .aict would be honored by npm pack and
// strip the required seed ledgers out of the tarball.
test("V3: the template generator emits no .gitignore (keeps seed ledgers in the tarball)", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-v3-template-"));
  createWorkspace(target, { force: true });
  assert.equal(existsSync(path.join(target, ".aict", ".gitignore")), false, "template generation must NOT include a .gitignore");
});

// V4 (release-audit regression): the README's advertised counts must match the actual
// generated library, so a count can never silently drift again — it shipped saying "8
// distinct skills" while 10 ship. Locks the README to the source of truth in catalog.js.
test("V4: README skill / prompt / mechanism counts match the generated library", () => {
  const readme = read(repoRoot, "README.md");
  assert.match(readme, new RegExp(`${skillDefinitions.length} distinct skills`), `README must say "${skillDefinitions.length} distinct skills" (the real count)`);
  assert.match(readme, new RegExp(`${promptDefinitions.length} distinct prompts`), `README must say "${promptDefinitions.length} distinct prompts"`);
  assert.match(readme, new RegExp(`${mechanismDefinitions.length} mechanism`), `README must say "${mechanismDefinitions.length} mechanism..."`);
  const target = mkdtempSync(path.join(tmpdir(), "aicos-v4-counts-"));
  createWorkspace(target, { force: true });
  const skillDirs = readdirSync(path.join(target, ".aict", "skills"), { withFileTypes: true }).filter((e) => e.isDirectory());
  assert.equal(skillDirs.length, skillDefinitions.length, "generated skills dir count must equal skillDefinitions.length (README count stays true)");
});

// V8/V9 (release-audit regression): --version prints the package version (exit 0), and a
// help token on ANY subcommand shows help with ZERO side effects — in particular
// `demo --help` must NOT run the demo and write a throwaway workspace (it did before).
test("V8/V9: --version works and `demo --help` shows help with no side effect", () => {
  const bin = path.join(repoRoot, "bin", "ai-collab.js");
  const v = runResult([bin, "--version"]);
  assert.equal(v.status, 0, "--version must exit 0");
  assert.match(v.stdout.trim(), /^\d+\.\d+\.\d+/, "--version must print a semver");

  const dir = mkdtempSync(path.join(tmpdir(), "aicos-v8-demohelp-"));
  const tmp = mkdtempSync(path.join(tmpdir(), "aicos-v8-tmp-"));
  const res = runResult([bin, "demo", "--help"], { cwd: dir, env: { ...process.env, TMPDIR: tmp } });
  assert.equal(res.status, 0, "demo --help must exit 0");
  assert.match(res.stdout, /Usage/i, "demo --help must print the usage/help text");
  assert.doesNotMatch(res.stdout, /Demo workspace created/i, "demo --help must NOT run the demo");
  assert.deepEqual(readdirSync(dir), [], "demo --help must not write into the cwd");
  assert.deepEqual(readdirSync(tmp), [], "demo --help must not write a throwaway workspace into TMPDIR");
});

// =====================================================================
// First-5-min CLI UX (optimize/first-5min-value): the bare command is a
// quickstart, not the full reference; errors point at the real runnable
// entry; typos get a one-line suggestion; `version` aliases --version; demo
// fails friendly in a read-only sandbox. The tests below lock each of these.
// =====================================================================

// P0: running the bare command (a new user's first contact) prints a SHORT
// quickstart — a one-line positioning sentence + the three starter commands
// (init / guide / demo) + a pointer to --help — and must NOT dump the full
// reference or the L0-L4 guard-level theory. It is explicitly NOT byte-identical
// to --help (the old behavior made the two the same 100+ line wall).
test("first-screen: bare command prints a concise quickstart (3 commands, no L0-L4), distinct from --help", () => {
  const bin = path.join(repoRoot, "bin", "ai-collab.js");
  const bare = runResult([bin]);
  assert.equal(bare.status, 0, "the bare command must exit 0 (it is the quickstart, not an error)");
  const screen = bare.stdout;

  // It is short: a quickstart, not the reference wall.
  const lineCount = screen.split("\n").filter((line) => line.trim().length > 0).length;
  assert.ok(lineCount <= 16, `the quickstart must be concise (<=16 non-blank lines), got ${lineCount}`);

  // The three starter commands are each present, on the global `ai-collab` entry.
  assert.match(screen, /ai-collab init --target/i, "quickstart must show the init command");
  assert.match(screen, /ai-collab guide/i, "quickstart must show the guide command");
  assert.match(screen, /ai-collab demo/i, "quickstart must show the demo command");
  // It points the user at the full reference and the new-user fast path.
  assert.match(screen, /--help/, "quickstart must point at --help for the full list");
  assert.match(screen, /guide/i, "quickstart must nudge a new user toward guide");

  // The L0-L4 guard-level theory does NOT appear on the first screen.
  assert.doesNotMatch(screen, /L0|L1|L2|L3|L4/, "the quickstart must NOT contain the L0-L4 guard-level theory");
  assert.doesNotMatch(screen, /guard level/i, "the quickstart must NOT explain guard levels");

  // Quickstart != --help: the full reference (which DOES carry L0-L4) is longer and different.
  const full = runResult([bin, "--help"]);
  assert.equal(full.status, 0);
  assert.notEqual(screen.trim(), full.stdout.trim(), "the bare quickstart must NOT be byte-identical to --help");
  assert.match(full.stdout, /L0|L4/, "--help (the full reference) still documents the guard levels");
  assert.ok(
    full.stdout.split("\n").length > screen.split("\n").length,
    "--help must be the longer full reference; the quickstart is the short screen"
  );

  // The explicit `help` subcommand also stays the full reference (back-compat with
  // the existing help tests), so only the BARE no-arg case changed.
  const helpSub = runResult([bin, "help"]);
  assert.match(helpSub.stdout, /L0|L4/, "the explicit `help` subcommand stays the full reference");
});

// P1: now that the package is published to npm, error/prompt text points at the
// global `ai-collab` command (the standard install path). Spot-check several
// distinct error paths; the `ai-collab ` prefix is the load-bearing assertion, and
// the guidance must NOT regress to the source-only `node bin/ai-collab.js` form.
test("first-screen: error guidance uses the published global `ai-collab` command", () => {
  const bin = path.join(repoRoot, "bin", "ai-collab.js");

  // init with no --target.
  const initErr = runResult([bin, "init"]);
  assert.notEqual(initErr.status, 0);
  assert.match(initErr.stderr, /\bai-collab init --target/i);
  // It must NOT regress to the source-only `node bin/ai-collab.js init` form.
  assert.doesNotMatch(initErr.stderr, /node bin\/ai-collab\.js init/i, "must not point at the source-only `node bin/ai-collab.js init`");

  // A run-layer command with no workspace (the case README emphasizes most).
  const noWs = mkdtempSync(path.join(tmpdir(), "aicos-firstscreen-nows-"));
  const wsErr = runResult([bin, "task", "create", "--title", "x"], { cwd: noWs });
  assert.notEqual(wsErr.status, 0);
  assert.match(wsErr.stderr, /\bai-collab init --target/i, "the no-workspace refusal must point at `ai-collab init`");
  assert.doesNotMatch(wsErr.stderr, /node bin\/ai-collab\.js init/i, "must not point at the source-only `node bin/ai-collab.js init`");

  // An unknown subcommand inside a group also uses the global entry.
  const subErr = runResult([bin, "task", "bogus"]);
  assert.notEqual(subErr.status, 0);
  assert.match(subErr.stderr, /\bai-collab task create/i, "the unknown-subcommand usage must use `ai-collab task create`");
});

// P2: an unknown TOP-LEVEL command no longer dumps the 100+ line reference; it
// gives 1-2 lines — the unknown word, a "Did you mean 'x'?" when there is a
// plausible match, and where to find all commands. A wild word suggests nothing.
test("first-screen: an unknown command gives a short did-you-mean, not the full help wall", () => {
  const bin = path.join(repoRoot, "bin", "ai-collab.js");

  // A near-miss typo -> suggestion.
  const typo = runResult([bin, "inti"]);
  assert.notEqual(typo.status, 0, "an unknown command must exit non-zero");
  assert.match(typo.stderr, /Unknown command: inti/, "must name the unknown command");
  assert.match(typo.stderr, /Did you mean 'init'\?/, "must suggest the closest command");
  assert.match(typo.stderr, /ai-collab --help/, "must point at the full command list");
  // Short, not the reference wall, and crucially NOT the L0-L4 theory.
  const typoLines = typo.stderr.split("\n").filter((line) => line.trim().length > 0).length;
  assert.ok(typoLines <= 3, `the typo response must be 1-3 lines, got ${typoLines}`);
  assert.doesNotMatch(typo.stderr, /L0|L4|guard level/i, "the typo response must not dump the guard-level reference");
  // It also must not print the full Usage block.
  assert.doesNotMatch(typo.stderr, /^Usage:/im, "the typo response must not print the full usage reference");

  // A prefix typo resolves by prefix (stat -> status).
  const prefix = runResult([bin, "stat"]);
  assert.match(prefix.stderr, /Did you mean 'status'\?/, "a prefix typo must resolve to the matching command");

  // A wild, unrelated word suggests nothing (no misleading guess).
  const wild = runResult([bin, "zzzzzz"]);
  assert.notEqual(wild.status, 0);
  assert.match(wild.stderr, /Unknown command: zzzzzz/);
  assert.doesNotMatch(wild.stderr, /Did you mean/, "a wild word must not produce a misleading suggestion");
});

// P2: `version` as a bare subcommand is an alias for --version — it prints the
// version (exit 0), not "Unknown command".
test("first-screen: `version` subcommand aliases --version", () => {
  const bin = path.join(repoRoot, "bin", "ai-collab.js");
  const sub = runResult([bin, "version"]);
  assert.equal(sub.status, 0, "the `version` subcommand must exit 0");
  assert.match(sub.stdout.trim(), /^\d+\.\d+\.\d+/, "the `version` subcommand must print a semver");
  assert.doesNotMatch(sub.stderr, /Unknown command/i, "`version` must not be treated as an unknown command");
  // It matches the --version flag output (same source of truth).
  const flag = runResult([bin, "--version"]);
  assert.equal(sub.stdout.trim(), flag.stdout.trim(), "`version` and --version must print the same value");
});

// P2: demo in a read-only environment fails FRIENDLY — it catches the temp-dir
// write failure, prints a human pointer to `init --target <writable-dir>` (and
// the committed walkthrough), and exits cleanly, instead of throwing the raw
// "EPERM ... mkdtemp" errno with a stack. Simulated by pointing TMPDIR at an
// unwritable/nonexistent path (the same trick the pack-check sandbox test uses).
test("first-screen: demo fails friendly in a read-only sandbox (no raw mkdtemp stack)", () => {
  const bin = path.join(repoRoot, "bin", "ai-collab.js");
  const dir = mkdtempSync(path.join(tmpdir(), "aicos-demo-ro-cwd-"));
  const res = runResult([bin, "demo"], {
    cwd: dir,
    env: { ...process.env, TMPDIR: "/nonexistent-readonly-aicos-demo/" }
  });
  assert.notEqual(res.status, 0, "demo in a read-only sandbox must exit non-zero");
  // Friendly, actionable message — points at the real writable path + walkthrough.
  assert.match(res.stderr, /\bai-collab init --target/i, "demo fallback must point at init --target <writable-dir>");
  assert.match(res.stderr, /walkthrough/i, "demo fallback must point at the committed walkthrough");
  assert.match(res.stderr, /temp directory/i, "demo fallback must explain it could not create a temp directory");
  // NOT a raw thrown errno/stack: no "mkdtemp" errno text, no V8 stack frames.
  assert.doesNotMatch(res.stderr, /mkdtemp/i, "demo fallback must not leak the raw mkdtemp errno");
  assert.doesNotMatch(res.stderr, /\n\s+at\s+/i, "demo fallback must not print a stack trace");
  // It did not write the success line, and nothing was written into the cwd.
  assert.doesNotMatch(res.stdout, /Demo workspace created/i, "the demo must not claim success when it could not write");
  assert.deepEqual(readdirSync(dir), [], "the failed demo must not write into the cwd");

  // --json surfaces a structured failure (ok:false + the actionable hint).
  const jsonRes = runResult([bin, "demo", "--json"], {
    cwd: dir,
    env: { ...process.env, TMPDIR: "/nonexistent-readonly-aicos-demo/" }
  });
  assert.notEqual(jsonRes.status, 0);
  const payload = JSON.parse(jsonRes.stderr);
  assert.equal(payload.ok, false, "demo --json must report ok:false on a temp-dir failure");
  assert.match(payload.hint, /\bai-collab init --target/i, "demo --json must carry the actionable init hint");
});

test("task create appends an open task to tasks.jsonl", () => {
  const ws = freshRunWorkspace("taskcreate");
  const out = runCli(["task", "create", "--title", "Fix the login bug", "--workspace", ws, "--json"]);
  const payload = JSON.parse(out);
  assert.equal(payload.ok, true);
  assert.equal(payload.task.status, "open");
  assert.equal(payload.task.title, "Fix the login bug");
  const rows = ledgerRows(ws, "tasks.jsonl");
  assert.equal(rows.length, 2, "seed row + the new task");
  assert.equal(rows[1].title, "Fix the login bug");
  assert.equal(rows[1].status, "open");
});

// V2 (release-audit regression): a run-layer state command run where NO workspace
// exists must REFUSE with init guidance and write nothing — never silently scaffold a
// stray ./state ledger dir into the current directory (a user's own git repo would
// then commit it on a routine `git add .`). Before the fix, resolveStateDir defaulted
// to <cwd>/state and created it on first write.
test("V2: a run-layer command with no workspace refuses and writes no ./state", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "aicos-v2-noworkspace-"));
  const bin = path.join(repoRoot, "bin", "ai-collab.js");
  const res = runResult([bin, "task", "create", "--title", "probe"], { cwd: dir });
  assert.notEqual(res.status, 0, "task create with no workspace must refuse (non-zero exit)");
  assert.match(res.stderr, /No \.aict workspace found/i, "the refusal must name the missing workspace");
  assert.match(res.stderr, /init --target/i, "the refusal must give actionable init guidance");
  assert.equal(existsSync(path.join(dir, "state")), false, "it must NOT create a stray ./state ledger dir");
  assert.deepEqual(readdirSync(dir), [], "the non-workspace directory must be left untouched");
});

test("evidence add binds to an existing task and rejects an unknown task", () => {
  const ws = freshRunWorkspace("evadd");
  const task = JSON.parse(runCli(["task", "create", "--title", "Task A", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "command", "--summary", "tests pass", "--workspace", ws, "--json"])).evidence;
  assert.equal(ev.taskId, task.id);
  assert.equal(ev.kind, "command");
  // Unknown task is rejected, non-zero exit, and nothing is appended.
  const before = ledgerRows(ws, "evidence.jsonl").length;
  const bad = runResult(["bin/ai-collab.js", "evidence", "add", "--task", "nope", "--kind", "note", "--summary", "x", "--workspace", ws]);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /not found/i);
  assert.equal(ledgerRows(ws, "evidence.jsonl").length, before, "rejected evidence must not be appended");
});

test("run start then run finish updates the same run row in place", () => {
  const ws = freshRunWorkspace("runlife");
  const task = JSON.parse(runCli(["task", "create", "--title", "Task R", "--workspace", ws, "--json"])).task;
  const started = JSON.parse(runCli(["run", "start", "--task", task.id, "--command", "npm test", "--workspace", ws, "--json"])).run;
  assert.equal(started.status, "running");
  const rowsAfterStart = ledgerRows(ws, "runs.jsonl");
  const finished = JSON.parse(runCli(["run", "finish", "--task", task.id, "--exit", "0", "--workspace", ws, "--json"])).run;
  assert.equal(finished.status, "finished");
  assert.equal(finished.exitCode, 0);
  assert.equal(finished.id, started.id, "finish must patch the SAME run, not append a new one");
  const rowsAfterFinish = ledgerRows(ws, "runs.jsonl");
  assert.equal(rowsAfterFinish.length, rowsAfterStart.length, "finish must not add a row");
  const patched = rowsAfterFinish.find((r) => r.id === started.id);
  assert.equal(patched.status, "finished");
  assert.equal(patched.exitCode, 0);
});

// run exec ACTUALLY runs the command locally and records the REAL exit code
// (executed:true) and output fingerprint, unlike run start/finish which record a
// reported exit. This is the higher-authenticity path — the recorded run reflects a
// process that genuinely ran here and the rerun must match the captured output.
test("run exec executes the command locally and records the real exit code (executed:true)", () => {
  const ws = freshRunWorkspace("run-exec");
  const task = JSON.parse(runCli(["task", "create", "--title", "Exec", "--workspace", ws, "--json"])).task;
  // A non-zero exit is captured for REAL (not typed): `exit 3` actually exits 3.
  const failed = JSON.parse(runCli(["run", "exec", "--task", task.id, "--command", "exit 3", "--workspace", ws, "--json"])).run;
  assert.equal(failed.status, "finished");
  assert.equal(failed.exitCode, 3, "the REAL exit code of `exit 3` is captured, not a reported one");
  assert.equal(failed.executed, true, "the run is marked executed:true");
  // A zero exit + captured stdout.
  const ok = JSON.parse(runCli(["run", "exec", "--task", task.id, "--command", "printf hello-exec", "--workspace", ws, "--json"]));
  assert.equal(ok.run.exitCode, 0);
  assert.equal(ok.run.executed, true);
  assert.equal(ok.run.outputSha256, sha256Text("hello-exec"), "the executed run stores a sha256 of the captured output");
  assert.equal(ok.run.outputBytes, Buffer.byteLength("hello-exec", "utf8"), "the executed run stores the captured output byte count");
  assert.equal(ok.run.stdoutBytes, Buffer.byteLength("hello-exec", "utf8"), "stdout byte count is stored for auditability");
  assert.equal(ok.run.stderrBytes, 0, "stderr byte count is stored for auditability");
  assert.match(ok.output, /hello-exec/, "stdout is captured into the emitted output");
  // The really-executed run reconciles with a rerun that agrees on command + exit +
  // output hash, so (alongside a cross-family review) it anchors an honest L4 to a
  // real local execution and the captured output.
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "a different family pressed on it", "--reviewer", "gpt-guard", "--family", "openai", "--workspace", ws, "--json"])).evidence;
  const rerun = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "re-ran", "--command", "printf hello-exec", "--exit", "0", "--output", "hello-exec", "--run", ok.run.id, "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--evidence", xguard.id, "--rerun", rerun.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L4", "a rerun reconciled to a REALLY-executed run + a cross-family review reaches L4");
  assert.equal(validateWorkspace(ws).ok, true, "the workspace validates");
});

// B3-1 (evidence-location honesty): run exec must run the command in the WORKSPACE's
// project root, not in the caller's shell directory. Running it in process.cwd() let a
// command execute in an unrelated directory while being filed as evidence for THIS
// workspace — the rerun would anchor to a run that never ran where the task lives. The
// directory it ran in must also be RECORDED on the run and printed, so the evidence is
// auditable. --cwd overrides the default explicitly; a non-existent --cwd is refused
// and records nothing.
test("B3-1: run exec runs in the workspace project root (not the caller dir), records + prints the cwd, and honors --cwd", () => {
  const ws = freshRunWorkspace("run-exec-cwd");
  const projectRoot = path.dirname(ws); // the dir that HOLDS .aict — where the run should execute
  const task = JSON.parse(runCli(["task", "create", "--title", "Cwd", "--workspace", ws, "--json"])).task;
  // Run the CLI from a DIFFERENT directory than the workspace root, so "ran in
  // process.cwd()" and "ran in the workspace root" give different answers. Because we
  // override cwd, the bin path must be ABSOLUTE (a relative bin/… would resolve against
  // callerDir, not the repo).
  const bin = path.join(repoRoot, "bin", "ai-collab.js");
  const callerDir = mkdtempSync(path.join(tmpdir(), "aicos-run-exec-caller-"));
  const pwdCmd = `${JSON.stringify(nodeBin)} -e "process.stdout.write(process.cwd())"`;

  // Default: cwd is the workspace project root, NOT the caller dir.
  const def = JSON.parse(runResult([
    bin, "run", "exec", "--task", task.id, "--command", pwdCmd, "--workspace", ws, "--json"
  ], { cwd: callerDir }).stdout);
  // Canonicalize BOTH sides before comparing, so the test is platform-agnostic (it
  // resolves whatever the host symlinks — macOS /var -> /private/var, Windows casing,
  // a Linux symlink — with no hard-coded prefix assumption), not macOS-only.
  const realRoot = canonical(projectRoot);
  assert.equal(canonical(def.output), realRoot, "the command must run in the workspace project root, not the caller's cwd");
  assert.notEqual(canonical(def.output), canonical(callerDir), "it must NOT run in the caller's process.cwd()");
  assert.equal(canonical(def.run.cwd), realRoot, "the run record must store the directory the command ran in");

  // The text (non-JSON) output must PRINT the cwd, so the evidence is visible without parsing JSON.
  const text = runResult([
    bin, "run", "exec", "--task", task.id, "--command", pwdCmd, "--workspace", ws
  ], { cwd: callerDir }).stdout;
  assert.match(text, /\n\s*cwd:\s*\S/, "run exec text output must print a cwd: line");

  // --cwd overrides the default and is recorded.
  const overrideDir = mkdtempSync(path.join(tmpdir(), "aicos-run-exec-override-"));
  const over = JSON.parse(runResult([
    bin, "run", "exec", "--task", task.id, "--command", pwdCmd, "--workspace", ws, "--cwd", overrideDir, "--json"
  ], { cwd: callerDir }).stdout);
  assert.equal(canonical(over.output), canonical(overrideDir), "--cwd must override where the command runs");
  assert.equal(canonical(over.run.cwd), canonical(overrideDir), "the run record must store the overridden cwd");

  // A non-existent --cwd is refused and records nothing.
  const rowsBefore = ledgerRows(ws, "runs.jsonl").length;
  const bad = runResult([
    bin, "run", "exec", "--task", task.id, "--command", pwdCmd, "--workspace", ws, "--cwd", path.join(overrideDir, "nope-zzz")
  ], { cwd: callerDir });
  assert.notEqual(bad.status, 0, "a non-existent --cwd must fail");
  assert.match(bad.stderr, /not an existing directory/i, "the refusal must name the bad --cwd");
  assert.equal(ledgerRows(ws, "runs.jsonl").length, rowsBefore, "a refused run must not append a row");
});

// B4 #4 (secret-leak hardening): `run exec` inherits the caller's FULL process.env
// by default, so a command an AI suggested can read inherited API keys/tokens. The
// opt-in --clean-env runs the command with a MINIMAL env (PATH/HOME + locale/temp
// basics) instead, withholding inherited secrets. DEFAULT behavior is unchanged
// (full inherit) for backward compatibility. The run record + the printed output
// mark whether the run was clean-env, so the evidence says how it ran.
test("B4 #4: run exec --clean-env withholds inherited secrets (PATH/HOME survive); default still inherits, and the run records cleanEnv", () => {
  const ws = freshRunWorkspace("run-exec-clean-env");
  const task = JSON.parse(runCli(["task", "create", "--title", "Env probe", "--workspace", ws, "--json"])).task;
  const bin = path.join(repoRoot, "bin", "ai-collab.js");

  // Inject a CUSTOM sensitive variable into the CLI's environment. The probe command
  // prints whether the child can see that variable, plus whether PATH/HOME survived.
  const env = { ...process.env, FAKE_SECRET_TOKEN: "sk-supersecret-12345" };
  const probe =
    "echo SECRET=[${FAKE_SECRET_TOKEN:-<empty>}] HOME=[${HOME:+set}] PATH=[${PATH:+set}]";

  // DEFAULT (no flag): the child INHERITS the full env, so it SEES the secret. This is
  // the backward-compatible behavior (and exactly the #4 leak the flag mitigates).
  const def = JSON.parse(runResult([
    bin, "run", "exec", "--task", task.id, "--command", probe, "--workspace", ws, "--json"
  ], { env }).stdout);
  assert.match(def.output, /SECRET=\[sk-supersecret-12345\]/, "default run exec inherits the full env (the child sees the secret) — backward compatible");
  assert.equal(def.run.cleanEnv, false, "a default run records cleanEnv:false");

  // --clean-env: the child must NOT see the secret, but PATH/HOME must survive so a
  // normal command still works.
  const clean = JSON.parse(runResult([
    bin, "run", "exec", "--task", task.id, "--command", probe, "--workspace", ws, "--clean-env", "--json"
  ], { env }).stdout);
  assert.match(clean.output, /SECRET=\[<empty>\]/, "--clean-env must withhold the inherited secret from the child");
  assert.doesNotMatch(clean.output, /sk-supersecret-12345/, "the secret value must not reach the child under --clean-env");
  assert.match(clean.output, /HOME=\[set\]/, "--clean-env must still pass HOME (a normal command needs it)");
  assert.match(clean.output, /PATH=\[set\]/, "--clean-env must still pass PATH (without it almost nothing runs)");
  assert.equal(clean.run.cleanEnv, true, "a --clean-env run records cleanEnv:true");

  // The text (non-JSON) output must PRINT the cleanEnv flag, so the evidence is
  // visible without parsing JSON.
  const text = runResult([
    bin, "run", "exec", "--task", task.id, "--command", probe, "--workspace", ws, "--clean-env"
  ], { env }).stdout;
  assert.match(text, /\n\s*cleanEnv:\s*true/, "run exec text output must print cleanEnv: true under --clean-env");

  // The recorded run row on disk also carries cleanEnv, so a reader/validator can see
  // how each executed run got its environment.
  const rows = ledgerRows(ws, "runs.jsonl").filter((r) => r.executed);
  assert.ok(rows.some((r) => r.cleanEnv === true), "an executed --clean-env run is persisted with cleanEnv:true");
  assert.ok(rows.some((r) => r.cleanEnv === false), "an executed default run is persisted with cleanEnv:false");
});

// B6a-1 (dangerous-command guard): `run exec` runs an arbitrary shell command. A
// CONSERVATIVE, NARROW guard trips only on well-known destructive shapes (rm -rf,
// sudo, curl|sh, dd, mkfs, > /dev/, chmod -R 777, redirect into a system path). On a
// non-interactive caller (a script / an AI — which is how the CLI is normally driven,
// and how these tests run, with stdin not a TTY) a flagged command is REFUSED unless
// --yes/--force is passed; the refusal executes nothing and records nothing. An
// ordinary command is completely unaffected (backward compatible). A knowingly-approved
// dangerous run is stamped dangerousConfirmed:true.
test("B6a-1: a dangerous command is refused without --yes on a non-TTY caller, and records nothing", () => {
  const ws = freshRunWorkspace("danger-refuse");
  const task = JSON.parse(runCli(["task", "create", "--title", "Danger", "--workspace", ws, "--json"])).task;
  const bin = path.join(repoRoot, "bin", "ai-collab.js");

  const rowsBefore = ledgerRows(ws, "runs.jsonl").length;
  // A recursive force delete is the canonical destructive shape. Pointed at a path that
  // does NOT exist, so even if the guard somehow failed open the command is a no-op —
  // the assertion is about the REFUSAL, never about deleting anything.
  const safeTargetThatDoesNotExist = path.join(tmpdir(), "aicos-danger-nonexistent-zzz");
  const refused = runResult([
    bin, "run", "exec", "--task", task.id, "--command", `rm -rf ${safeTargetThatDoesNotExist}`, "--workspace", ws
  ]); // stdio.stdin is "ignore" -> not a TTY -> the non-interactive refusal path
  assert.notEqual(refused.status, 0, "a flagged command with no --yes must exit non-zero on a non-TTY caller");
  assert.match(refused.stderr, /Refused/i, "the refusal must say it was refused");
  assert.match(refused.stderr, /destructive pattern/i, "the refusal must name that a destructive pattern matched");
  assert.match(refused.stderr, /--yes|--force/i, "the refusal must tell the caller how to override");
  assert.match(refused.stderr, /[Nn]othing recorded/, "the refusal must state nothing was recorded");
  assert.equal(ledgerRows(ws, "runs.jsonl").length, rowsBefore, "a refused dangerous run must NOT append a row");
});

test("B6a-1: --yes (and --force) lets a flagged command run and records dangerousConfirmed:true", () => {
  const ws = freshRunWorkspace("danger-yes");
  const task = JSON.parse(runCli(["task", "create", "--title", "Danger yes", "--workspace", ws, "--json"])).task;
  const bin = path.join(repoRoot, "bin", "ai-collab.js");

  // Dangerous SHAPE (rm -rf) but a harmless target (a path that does not exist): the
  // command is real and exits 0, but deletes nothing. We assert it RAN (was recorded)
  // and that the guard stamped dangerousConfirmed:true.
  const safeTarget = path.join(tmpdir(), "aicos-danger-yes-nonexistent-zzz");
  const yes = JSON.parse(runResult([
    bin, "run", "exec", "--task", task.id, "--command", `rm -rf ${safeTarget}`, "--workspace", ws, "--yes", "--json"
  ]).stdout);
  assert.equal(yes.run.executed, true, "with --yes the flagged command actually runs");
  assert.equal(yes.run.dangerousConfirmed, true, "an approved dangerous run records dangerousConfirmed:true");
  assert.equal(yes.run.exitCode, 0, "rm -rf on a non-existent path exits 0");

  // --force is an equivalent opt-out.
  const forced = JSON.parse(runResult([
    bin, "run", "exec", "--task", task.id, "--command", `rm -rf ${safeTarget}`, "--workspace", ws, "--force", "--json"
  ]).stdout);
  assert.equal(forced.run.dangerousConfirmed, true, "--force also approves a flagged run (dangerousConfirmed:true)");

  // The persisted rows carry the flag, so a reader/validator sees it was confirmed.
  const rows = ledgerRows(ws, "runs.jsonl").filter((r) => r.executed);
  assert.ok(rows.some((r) => r.dangerousConfirmed === true), "an approved dangerous run is persisted with dangerousConfirmed:true");
  // The text output also surfaces it (visible without parsing JSON).
  const text = runResult([
    bin, "run", "exec", "--task", task.id, "--command", `rm -rf ${safeTarget}`, "--workspace", ws, "--yes"
  ]).stdout;
  assert.match(text, /dangerousConfirmed:\s*true/, "run exec text output prints dangerousConfirmed: true for an approved dangerous run");
  assert.equal(validateWorkspace(ws).ok, true, "the workspace still validates after approved dangerous runs");
});

test("B6a-1: an ordinary command is completely unaffected by the guard (no prompt, no dangerousConfirmed)", () => {
  const ws = freshRunWorkspace("danger-safe");
  const task = JSON.parse(runCli(["task", "create", "--title", "Safe", "--workspace", ws, "--json"])).task;
  const bin = path.join(repoRoot, "bin", "ai-collab.js");

  // `echo hi` matches NO dangerous pattern, so it runs exactly as before with no extra
  // ceremony and no dangerousConfirmed field — proving the guard is backward compatible.
  const ok = JSON.parse(runResult([
    bin, "run", "exec", "--task", task.id, "--command", "echo hi", "--workspace", ws, "--json"
  ]).stdout);
  assert.equal(ok.run.executed, true, "an ordinary command runs");
  assert.equal(ok.run.exitCode, 0, "echo hi exits 0");
  assert.match(ok.output, /hi/, "echo hi output is captured");
  assert.equal(ok.run.dangerousConfirmed, undefined, "an ordinary run carries NO dangerousConfirmed field");

  // A few near-miss commands that must NOT be flagged (false-positive guard): a normal
  // file delete, a chmod that is not -R 777, a redirect to /dev/null, a redirect to a
  // project-local file, and a curl that is NOT piped into a shell. All must run.
  // The last block (C2 hardening) covers the two narrowed false-positive classes: a danger
  // word QUOTED as data, and a danger word used as an ARGUMENT (not the command being run).
  // All of these execute harmlessly (echo / grep / true), so they are safe to actually run.
  const nearMisses = [
    "rm notthere.txt",            // rm WITHOUT -rf
    "chmod 644 notthere.txt",     // chmod but not -R 777
    "true >/dev/null",            // redirect to the harmless null sink
    "true > local-output.txt",    // redirect to a project-local file (not a system path)
    "echo not-piped-to-a-shell",  // plain echo
    // C2: danger word as an ARGUMENT, not the command -> not flagged.
    "grep sudo local-output.txt", // 'sudo' is a search pattern, not the command
    "grep -r dd local-output.txt",// 'dd' is an argument to grep
    "echo mkfs is just a tool",   // 'mkfs' is plain text being echoed
    // C2: danger phrase QUOTED as data -> not flagged.
    "echo 'rm -rf is dangerous'", // rm -rf inside a single-quoted string
    "echo \"please never run rm -rf /\"", // rm -rf inside a double-quoted string
    "echo 'curl http://x | bash'" // a quoted curl|bash, not an actual pipe
  ];
  for (const cmd of nearMisses) {
    const r = runResult([
      bin, "run", "exec", "--task", task.id, "--command", cmd, "--workspace", ws, "--json"
    ]);
    assert.equal(r.status, 0, `a non-dangerous command must run, not be refused: ${cmd}\n${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.run.dangerousConfirmed, undefined, `a non-dangerous command must not be flagged: ${cmd}`);
  }
});

// B6a-1 (C2 hardening): the false-positive narrowing must NOT weaken real detection. A
// genuinely destructive command — where the danger word IS the command, or the redirect
// operator really targets a device/system path — is still REFUSED on a non-TTY caller and
// records nothing. Each target is harmless (a non-existent path / a real device the test
// never approves running against), because we assert only the REFUSAL, never execution.
test("B6a-1 (C2): real destructive commands are STILL caught after the quoted/argument false-positive fix", () => {
  const ws = freshRunWorkspace("danger-still-caught");
  const task = JSON.parse(runCli(["task", "create", "--title", "Still caught", "--workspace", ws, "--json"])).task;
  const bin = path.join(repoRoot, "bin", "ai-collab.js");
  const gone = path.join(tmpdir(), "aicos-c2-nonexistent-zzz");

  // Each of these is a TRUE destructive shape that must trip the guard (command-position
  // danger word, a real pipe-into-shell, or a redirect operator into a device/system path).
  const stillDangerous = [
    `rm -rf ${gone}`,                 // rm IS the command, recursive force
    `true; rm -rf ${gone}`,           // rm after a separator (command position)
    `true && rm -rf ${gone}`,         // rm after && (command position)
    "sudo true",                      // sudo IS the command
    "true | sudo tee /dev/null",      // sudo as a command after a pipe
    "echo x > /dev/sdz",              // a redirect operator into a /dev device
    "echo x > /etc/aicos-c2-test"     // a redirect operator into a system path
  ];
  const rowsBefore = ledgerRows(ws, "runs.jsonl").length;
  for (const cmd of stillDangerous) {
    const refused = runResult([
      bin, "run", "exec", "--task", task.id, "--command", cmd, "--workspace", ws
    ]); // non-TTY -> a flagged command is refused
    assert.notEqual(refused.status, 0, `a real destructive command must be refused on a non-TTY caller: ${cmd}`);
    assert.match(refused.stderr, /destructive pattern/i, `the refusal must name a destructive pattern: ${cmd}`);
  }
  assert.equal(ledgerRows(ws, "runs.jsonl").length, rowsBefore, "no refused destructive run appended a row");

  // And the override still works on a real danger (proving we refused on policy, not by error):
  // rm -rf on a NON-EXISTENT path with --yes runs (exit 0, deletes nothing) and is stamped.
  const ok = JSON.parse(runResult([
    bin, "run", "exec", "--task", task.id, "--command", `rm -rf ${gone}`, "--workspace", ws, "--yes", "--json"
  ]).stdout);
  assert.equal(ok.run.dangerousConfirmed, true, "--yes still approves a real flagged command (dangerousConfirmed:true)");
});

// B6a-2 (ledger concurrency lock): the id-allocation path is read-modify-write
// (readLedger -> nextId(max+1) -> appendLedger). Two processes that interleave between
// the read and the append both mint the same id — a duplicate that later trips `check`.
// The fix serializes read->compute->append with an on-disk O_EXCL lock. This test
// drives the race for real: it spawns N `task create`s with child_process.spawn (TRULY
// parallel — all launched before any is awaited, not run one-after-another), then
// asserts every process succeeded, every id is UNIQUE, the ids form the contiguous
// t1..tN block (no gaps, no collisions), and the workspace still validates.
test("B6a-2: concurrent `task create`s never produce a duplicate id (O_EXCL ledger lock)", async () => {
  const ws = freshRunWorkspace("concurrent-create");
  const bin = path.join(repoRoot, "bin", "ai-collab.js");
  const N = 15;

  // Launch all N children FIRST (no await inside the loop), so they genuinely contend
  // for the ledger at the same time rather than running serially. Each resolves to its
  // parsed JSON result (or rejects with stderr) once it exits.
  const spawnCreate = (i) => new Promise((resolve, reject) => {
    const child = spawn(nodeBin, [bin, "task", "create", "--title", `concurrent-${i}`, "--workspace", ws, "--json"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, AI_COLLAB_LANG: "en" }
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`task create #${i} exited ${code}: ${err}`));
      try { resolve(JSON.parse(out).task); }
      catch (e) { reject(new Error(`task create #${i} produced unparseable output: ${out}\n${err}`)); }
    });
  });

  const created = await Promise.all(Array.from({ length: N }, (_, i) => spawnCreate(i)));

  // Every child succeeded and returned a task.
  assert.equal(created.length, N, "every concurrent task create must succeed");

  // No duplicate ids ACROSS THE RETURNED RESULTS (what each process believed it got).
  const returnedIds = created.map((t) => t.id);
  assert.equal(new Set(returnedIds).size, N, `every returned id must be unique (got ${returnedIds.sort().join(",")})`);

  // No duplicate ids ON DISK either, and the user rows are exactly the contiguous block
  // t1..tN appended after the t0 seed (no gap, no collision, no lost write).
  const taskRows = ledgerRows(ws, "tasks.jsonl");
  const userRows = taskRows.filter((r) => r.id !== "t0"); // drop the synthetic seed
  const onDiskIds = userRows.map((r) => r.id);
  assert.equal(new Set(onDiskIds).size, onDiskIds.length, `on-disk task ids must have no duplicates (got ${onDiskIds.sort().join(",")})`);
  assert.equal(onDiskIds.length, N, `exactly ${N} user task rows must be persisted (no lost append)`);
  const expectedBlock = Array.from({ length: N }, (_, i) => `t${i + 1}`).sort();
  assert.deepEqual(onDiskIds.slice().sort(), expectedBlock, `the ids must be the contiguous block t1..t${N} with no gaps`);

  // The lock file must not be left behind after all writers finish.
  assert.equal(existsSync(path.join(ws, "state", ".ledger.lock")), false, "the ledger lock file must be released (deleted) after writers finish");

  // And the workspace validates (check passes) with the concurrently-written ledger.
  assert.equal(validateWorkspace(ws).ok, true, "the workspace must validate after concurrent task creates");
});

test("Facet A honesty: a self-reported run start/finish cannot back L4 (executed:true is required)", () => {
  const ws = freshRunWorkspace("facet-a-self-reported-run");
  const task = JSON.parse(runCli(["task", "create", "--title", "Self-reported run", "--workspace", ws, "--json"])).task;
  JSON.parse(runCli(["run", "start", "--task", task.id, "--command", "printf self-report", "--workspace", ws, "--json"]));
  const run = JSON.parse(runCli(["run", "finish", "--task", task.id, "--exit", "0", "--workspace", ws, "--json"])).run;
  assert.equal(run.executed, undefined, "precondition: run start/finish is self-reported and has no executed:true flag");

  // This used to be the dishonest L4 path: a self-reported run plus a matching
  // rerun row was treated like real execution. The fix rejects the runId at
  // evidence-add time, so the row cannot masquerade as L4 evidence.
  const bad = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "claims same output", "--command", "printf self-report", "--exit", "0", "--output", "self-report", "--run", run.id, "--workspace", ws]);
  assert.notEqual(bad.status, 0, "a rerun cannot cite a self-reported run as L4 evidence");
  assert.match(bad.stderr, /executed:true|run exec|self-reported/i, "the refusal must explain that only run exec can back L4");
  assert.equal(ledgerRows(ws, "evidence.jsonl").length, 2, "the invalid rerun must not be appended");

  // A generic no-runId rerun may still be recorded, but with a cross-family guard
  // it caps at L3. The old expectation (L4) was the bug: it let a typed run finish
  // look like local execution.
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "gpt guard", "--reviewer", "gpt-guard", "--family", "openai", "--workspace", ws, "--json"])).evidence;
  const genericRerun = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "generic rerun row", "--command", "printf self-report", "--exit", "0", "--output", "self-report", "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--claimed-level", "L4", "--evidence", xguard.id, "--rerun", genericRerun.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L3", "self-reported / unreconciled rerun evidence caps at L3, not L4");
  assert.equal(receipt.familyUnverified, true, "the capped cross-family result remains marked unverified");
});

test("Facet B honesty: a rerun output must match the recorded run exec output hash", () => {
  const ws = freshRunWorkspace("facet-b-output-mismatch");
  const task = JSON.parse(runCli(["task", "create", "--title", "Output mismatch", "--workspace", ws, "--json"])).task;
  const executed = JSON.parse(runCli(["run", "exec", "--task", task.id, "--command", "echo real-output", "--workspace", ws, "--json"]));
  assert.equal(executed.output, "real-output", "precondition: run exec captured the real output");
  assert.equal(executed.run.outputSha256, sha256Text("real-output"), "precondition: run exec stores the output hash");

  const bad = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "fabricated output", "--command", "echo real-output", "--exit", "0", "--output", "FAKE OUTPUT", "--run", executed.run.id, "--workspace", ws]);
  assert.notEqual(bad.status, 0, "a rerun whose output disagrees with the linked run exec output must be refused");
  assert.match(bad.stderr, /output.*does not match|outputSha256|re-run via .*run exec/i, "the refusal must name the output mismatch and recovery path");
  assert.equal(ledgerRows(ws, "evidence.jsonl").length, 2, "the mismatched rerun must not be appended");

  const good = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "matching output", "--command", "echo real-output", "--exit", "0", "--output", "real-output", "--run", executed.run.id, "--workspace", ws, "--json"])).evidence;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "gpt guard", "--reviewer", "gpt-guard", "--family", "openai", "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--evidence", xguard.id, "--rerun", good.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L4", "the same run reaches L4 only when the rerun output matches the stored run output hash");
  assert.equal(validateWorkspace(ws).ok, true, "the matching-output L4 validates");
});

test("Facet A read-side honesty: a hand-planted L4 citing a self-reported run is flagged", () => {
  const ws = freshRunWorkspace("facet-a-self-reported-run-validator");
  const task = JSON.parse(runCli(["task", "create", "--title", "Planted self-reported L4", "--workspace", ws, "--json"])).task;
  JSON.parse(runCli(["run", "start", "--task", task.id, "--command", "printf self-report", "--workspace", ws, "--json"]));
  const run = JSON.parse(runCli(["run", "finish", "--task", task.id, "--exit", "0", "--workspace", ws, "--json"])).run;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "gpt guard", "--reviewer", "gpt-guard", "--family", "openai", "--workspace", ws, "--json"])).evidence;
  writeFileSync(
    ledger(ws, "evidence.jsonl"),
    readFileSync(ledger(ws, "evidence.jsonl"), "utf8") +
      JSON.stringify({ id: "e9", taskId: task.id, kind: "rerun", summary: "planted self-reported rerun", command: "printf self-report", exitCode: 0, output: "self-report", runId: run.id, createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    readFileSync(ledger(ws, "receipts.jsonl"), "utf8") +
      JSON.stringify({ id: "c9", taskId: task.id, verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: [xguard.id], rerunEvidenceIds: ["e9"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false, "a hand-planted L4 backed by a self-reported run must fail validation");
  assert.ok(
    result.errors.some((e) => /evidence e9: .*executed:true|evidence e9: .*run exec|evidence e9: .*self-reported/i.test(e)),
    `expected the read-side executed:true error, got:\n${result.errors.join("\n")}`
  );
  assert.ok(
    result.errors.some((e) => /receipt c9.*only support "L3"|receipt c9: guard level L4 .*not a recorded, reconciled run/i.test(e)),
    `expected the receipt L4 over-claim to be blocked, got:\n${result.errors.join("\n")}`
  );
});

test("Facet B read/write honesty: hand-planted output mismatches are re-checked at receipt create and validate time", () => {
  const ws = freshRunWorkspace("facet-b-output-mismatch-recheck");
  const task = JSON.parse(runCli(["task", "create", "--title", "Planted output mismatch", "--workspace", ws, "--json"])).task;
  const executed = JSON.parse(runCli(["run", "exec", "--task", task.id, "--command", "echo real-output", "--workspace", ws, "--json"]));
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "gpt guard", "--reviewer", "gpt-guard", "--family", "openai", "--workspace", ws, "--json"])).evidence;
  writeFileSync(
    ledger(ws, "evidence.jsonl"),
    readFileSync(ledger(ws, "evidence.jsonl"), "utf8") +
      JSON.stringify({ id: "e9", taskId: task.id, kind: "rerun", summary: "planted fake output", command: "echo real-output", exitCode: 0, output: "FAKE OUTPUT", runId: executed.run.id, createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );

  const recomputed = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--claimed-level", "L4", "--evidence", xguard.id, "--rerun", "e9", "--workspace", ws, "--json"])).receipt;
  assert.equal(recomputed.guardLevel, "L3", "receipt create re-checks the planted rerun and refuses to store L4 on output mismatch");
  assert.equal(recomputed.familyUnverified, true, "the downgraded cross-family result is marked unverified");

  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    readFileSync(ledger(ws, "receipts.jsonl"), "utf8") +
      JSON.stringify({ id: "c9", taskId: task.id, verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: [xguard.id], rerunEvidenceIds: ["e9"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false, "a hand-planted L4 with fake rerun output must fail validation");
  assert.ok(
    result.errors.some((e) => /evidence e9: .*output.*does not match|evidence e9: .*outputSha256/i.test(e)),
    `expected the read-side output mismatch error, got:\n${result.errors.join("\n")}`
  );
});

test("Facet B backward compatibility: legacy executed runs without outputSha256 fail closed for L4", () => {
  const ws = freshRunWorkspace("facet-b-legacy-no-hash");
  const task = JSON.parse(runCli(["task", "create", "--title", "Legacy run", "--workspace", ws, "--json"])).task;
  const executed = JSON.parse(runCli(["run", "exec", "--task", task.id, "--command", "printf legacy-output", "--workspace", ws, "--json"]));
  const runs = ledgerRows(ws, "runs.jsonl").map((row) => {
    if (row.id !== executed.run.id) return row;
    const { outputSha256, outputBytes, stdoutBytes, stderrBytes, ...legacy } = row;
    return legacy;
  });
  writeFileSync(ledger(ws, "runs.jsonl"), `${runs.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

  const bad = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "legacy run rerun", "--command", "printf legacy-output", "--exit", "0", "--output", "legacy-output", "--run", executed.run.id, "--workspace", ws]);
  assert.notEqual(bad.status, 0, "a legacy run without outputSha256 cannot satisfy L4 output-match");
  assert.match(bad.stderr, /outputSha256|re-run via .*run exec/i, "the error must tell the user to re-run via run exec to reach L4");
});

test("receipt create records a verdict and maps pass -> accepted", () => {
  const ws = freshRunWorkspace("receipt");
  const task = JSON.parse(runCli(["task", "create", "--title", "Task C", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "log", "--workspace", ws, "--json"])).evidence;
  // A clean "pass" needs guard level >= L3 AND, at L3, an actual cross_family_guard
  // evidence row it can cite (the P2 evidence-gate: the cross-family pack must be
  // referenced, not just declared).
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "GPT-family guard pressed on it", "--reviewer", "gpt-guard", "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--guard-level", "L3", "--evidence", `${ev.id},${xguard.id}`, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.verdict, "pass");
  assert.equal(receipt.guardLevel, "L3");
  assert.equal(receipt.status, "accepted");
  assert.deepEqual(receipt.evidenceIds, [ev.id, xguard.id]);
  // An invalid verdict is rejected.
  const bad = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "maybe", "--guard-level", "L3", "--workspace", ws]);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /verdict must be one of/i);
});

test("status summarizes all five ledgers as plain text and as --json", () => {
  const ws = freshRunWorkspace("status");
  const task = JSON.parse(runCli(["task", "create", "--title", "Task S", "--workspace", ws, "--json"])).task;
  runCli(["evidence", "add", "--task", task.id, "--kind", "note", "--summary", "n", "--workspace", ws]);
  // Plain text summary. The evidence seed now ships TWO rows (e0 note + e1
  // cross_family_guard, for the P2 L3-pass gate), so seed 2 + the one added = 3.
  const text = runCli(["status", "--workspace", ws]);
  assert.match(text, /Workspace status/);
  assert.match(text, /Tasks: 2/); // seed t0 + Task S
  assert.match(text, /open=2/);
  assert.match(text, /Evidence: 3/);
  assert.match(text, /Learning candidates: 1/);
  // JSON summary.
  const payload = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  assert.equal(payload.command, "status");
  assert.equal(payload.counts.tasks, 2);
  assert.equal(payload.counts.evidence, 3);
  assert.equal(payload.taskStatus.open, 2);
});

// === getitback (stage 3): status shows WHAT you earned, not just counters =====

test("getitback: status shows a per-task achievement summary (title + verdict + level + who accepted) in text and --json", () => {
  const ws = freshRunWorkspace("getitback-pertask");
  const task = JSON.parse(runCli(["task", "create", "--title", "Fix the flaky reorder test", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "ran the suite", "--workspace", ws, "--json"])).evidence;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "GPT reviewed", "--reviewer", "gpt-5", "--family", "openai", "--workspace", ws, "--json"])).evidence;
  // A clean cross-family pass -> L3 accepted. A receipt accept is not needed for a
  // plain "pass" (it auto-accepts); the per-task line should show the L3 receipt.
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--evidence", `${ev.id},${xguard.id}`, "--review-mode", "cross_family", "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L3");

  const text = runCli(["status", "--workspace", ws]);
  // The per-task block exists and joins title -> receipt verdict/level/status.
  assert.match(text, /Your tasks:/, "status prints a per-task achievement section");
  assert.match(text, /Fix the flaky reorder test/, "the task title is shown");
  assert.match(
    text,
    new RegExp(`receipt ${receipt.id}: pass · L3 · accepted`),
    "the per-task line shows the receipt verdict + computed level + status"
  );
  assert.match(text, /evidence: 2 · runs: 0/, "the per-task line shows the evidence/run counts joined to the task");

  // --json carries the same structured per-task data.
  const payload = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  const entry = payload.perTask.find((row) => row.id === task.id);
  assert.ok(entry, "perTask includes the real task");
  assert.equal(entry.title, "Fix the flaky reorder test");
  assert.equal(entry.isSeed, false, "a real user task is not flagged as an example seed");
  assert.equal(entry.evidenceCount, 2);
  assert.equal(entry.runCount, 0);
  assert.equal(entry.receipt.verdict, "pass");
  assert.equal(entry.receipt.guardLevel, "L3");
  assert.equal(entry.receipt.status, "accepted");
});

test("C2 status honesty: status recomputes receipt level and family warning from evidence, not stored fields", () => {
  const ws = freshRunWorkspace("c2-status-recompute");
  const task = JSON.parse(runCli(["task", "create", "--title", "Forged stored L4", "--workspace", ws, "--json"])).task;
  const xguard = JSON.parse(runCli([
    "evidence", "add", "--task", task.id, "--kind", "cross_family_guard",
    "--summary", "only enough for L3", "--reviewer", "local-claim", "--family", "openai",
    "--workspace", ws, "--json"
  ])).evidence;

  // Hand-edit attack: stored fields claim clean L4/accepted, but the receipt cites
  // no reconciled rerun, so the evidence only computes L3 + familyUnverified.
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    readFileSync(ledger(ws, "receipts.jsonl"), "utf8") +
      JSON.stringify({ id: "c9", taskId: task.id, verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: [xguard.id], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );

  const check = runResult(["bin/ai-collab.js", "check", "--workspace", ws]);
  assert.notEqual(check.status, 0, "check must flag the hand-planted over-claim");
  assert.match(check.stdout + check.stderr, /receipt c9 claims guard level "L4".*only support "L3"/i, "check must recompute the true L3");

  const handoff = runJson(["handoff", "create", "--workspace", ws, "--json"]);
  assert.deepEqual(handoff.model.done.map((entry) => entry.id), [], "handoff must not treat the forged receipt as Done");
  assert.deepEqual(handoff.model.unverified.map((entry) => entry.id), [task.id], "handoff routes the forged receipt to Unverified");

  const text = runCli(["status", "--workspace", ws]);
  assert.match(
    text,
    /receipt c9: pass · L3 · accepted \(self-declared cross-family, unverified\)/,
    "status text must show the recomputed L3 warning, not the stored clean L4"
  );
  assert.doesNotMatch(text, /receipt c9: pass · L4 · accepted(?!.*self-declared)/, "status text must not show the forged receipt as clean L4");

  const payload = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  const entry = payload.perTask.find((row) => row.id === task.id);
  assert.equal(entry.receipt.guardLevel, "L3", "--json status must expose the recomputed level");
  assert.equal(entry.receipt.familyUnverified, true, "--json status must expose the recomputed family warning");
});

test("getitback: a pass_with_risk receipt accepted by an owner shows 'accepted by <name>' on its per-task line", () => {
  const ws = freshRunWorkspace("getitback-acceptedby");
  const task = JSON.parse(runCli(["task", "create", "--title", "Risk task", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "note", "--summary", "a note", "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--evidence", ev.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.status, "pending");
  runCli(["receipt", "accept", "--id", receipt.id, "--owner", "alice", "--workspace", ws]);

  const text = runCli(["status", "--workspace", ws]);
  assert.match(
    text,
    new RegExp(`receipt ${receipt.id}: pass_with_risk · L1 · accepted by alice`),
    "the per-task line names the owner who accepted the risk receipt"
  );
  const payload = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  const entry = payload.perTask.find((row) => row.id === task.id);
  assert.equal(entry.receipt.acceptedBy, "alice");
});

test("getitback: status labels the synthetic example seed so a fresh workspace's numbers are not mistaken for real progress", () => {
  const ws = freshRunWorkspace("getitback-seed");
  // A brand-new workspace contains only the shipped synthetic seed (task t0 etc.).
  const text = runCli(["status", "--workspace", ws]);
  assert.match(text, /Tasks: 1 {2}\[open=1] {2}\(includes 1 example seed — delete it and add your own\)/, "the Tasks counter flags the example seed");
  assert.match(text, /\[example seed]/, "the seed task's per-task line is tagged as an example");
  // The TOP Receipts/Evidence/Runs counters must ALSO flag their seed rows, so a
  // brand-new workspace's "Receipts: 1 [accepted=1]" (the most progress-looking
  // line) is not read as a real, already-accepted result. Symmetric to the Tasks
  // note; the seed ships receipts 1 / evidence 2 / runs 1.
  assert.match(
    text,
    /Receipts: 1 {2}\[accepted=1] {2}\(includes 1 example seed\)/,
    "the Receipts counter flags the accepted example seed so it is not mistaken for real progress"
  );
  assert.match(
    text,
    /Evidence: 2 {2}\(includes 2 example seeds\)/,
    "the Evidence counter flags its two example seed rows"
  );
  assert.match(
    text,
    /Runs: 1 {2}\[finished=1] {2}\(includes 1 example seed\)/,
    "the Runs counter flags its example seed row"
  );
  // The seed task is the t0 row, and it must be flagged isSeed in --json.
  const payload = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  assert.equal(payload.seedTaskCount, 1);
  // --json carries the same per-ledger seed counts, symmetric to seedTaskCount, so
  // an integration can subtract the seed from each counter the way the text notes do.
  assert.equal(payload.seedReceiptCount, 1, "--json reports the one seed receipt");
  assert.equal(payload.seedEvidenceCount, 2, "--json reports the two seed evidence rows");
  assert.equal(payload.seedRunCount, 1, "--json reports the one seed run");
  // Honesty check: the seed notes are annotations, not subtractions — the real
  // totals are unchanged (the seed rows are still counted, just labeled).
  assert.equal(payload.counts.receipts, 1, "the receipt total still counts the seed row (annotated, not removed)");
  assert.equal(payload.counts.evidence, 2, "the evidence total still counts the seed rows");
  assert.equal(payload.counts.runs, 1, "the run total still counts the seed row");
  const seedEntry = payload.perTask.find((row) => row.id === "t0");
  assert.equal(seedEntry.isSeed, true, "the t0 seed row is flagged isSeed");

  // A real user task is NOT flagged a seed, and the note still counts only the seed.
  const task = JSON.parse(runCli(["task", "create", "--title", "Real work", "--workspace", ws, "--json"])).task;
  // Add a real evidence row too, to prove the per-ledger seed count excludes the
  // user's own work (the Evidence total grows, but seedEvidenceCount stays put).
  runCli(["evidence", "add", "--task", task.id, "--kind", "note", "--summary", "real note", "--workspace", ws]);
  const text2 = runCli(["status", "--workspace", ws]);
  assert.match(text2, /includes 1 example seed/, "still exactly one example seed after adding a real task");
  // The Evidence counter now shows 3 total but still flags only the 2 seed rows.
  assert.match(text2, /Evidence: 3 {2}\(includes 2 example seeds\)/, "a real evidence row raises the total but not the seed note");
  const payload2 = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  assert.equal(payload2.seedTaskCount, 1, "the real task does not inflate the seed count");
  assert.equal(payload2.counts.evidence, 3, "the real evidence row is counted in the total");
  assert.equal(payload2.seedEvidenceCount, 2, "the real evidence row does not inflate the seed evidence count");
  assert.equal(payload2.perTask.find((row) => row.id === task.id).isSeed, false);
});

test("getitback: status echoes the most recently kept HARVEST lesson on its own line (symmetric to the profile preference recall)", () => {
  const ws = freshRunWorkspace("getitback-harvest");
  // Baseline: the seed ships ONE proposed harvest row (l0), which does NOT qualify.
  assert.doesNotMatch(runCli(["status", "--workspace", ws]), /Most recent harvest lesson you kept/, "a proposed-only harvest ledger shows no harvest recall line");
  assert.equal(JSON.parse(runCli(["status", "--workspace", ws, "--json"])).carriedHarvestLesson, null);

  // Add + confirm a harvest lesson -> it surfaces on the harvest line.
  const lesson = JSON.parse(runCli(["learning", "add", "--type", "harvest", "--content", "Reorder needs a stable sort key", "--workspace", ws, "--json"])).learning;
  assert.equal(JSON.parse(runCli(["status", "--workspace", ws, "--json"])).carriedHarvestLesson, null, "a proposed harvest lesson does not surface yet");
  runCli(["learning", "confirm", "--id", lesson.id, "--workspace", ws]);

  const text = runCli(["status", "--workspace", ws]);
  assert.match(text, /Most recent harvest lesson you kept: Reorder needs a stable sort key/, "a confirmed harvest lesson is echoed on its own line");
  // It must NOT pose as a profile preference (the two recalls are separate lines).
  assert.doesNotMatch(text, /Carrying forward the preference you confirmed: Reorder needs a stable sort key/, "a harvest lesson is not echoed as a preference");
  const payload = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  assert.equal(payload.carriedHarvestLesson.content, "Reorder needs a stable sort key");
  assert.equal(payload.carriedHarvestLesson.status, "confirmed");

  // Dropping it removes it from the recall again.
  runCli(["learning", "drop", "--id", lesson.id, "--workspace", ws]);
  assert.doesNotMatch(runCli(["status", "--workspace", ws]), /Most recent harvest lesson you kept/, "a dropped harvest lesson is no longer echoed");
});

test("getitback: receipt create explains WHY the level is what it is, derived from the cited evidence, and never claims a higher level", () => {
  const ws = freshRunWorkspace("getitback-whylevel");
  // L1 path: only a note. The explanation must name the note and point UP to L2.
  const t1 = JSON.parse(runCli(["task", "create", "--title", "L1 work", "--workspace", ws, "--json"])).task;
  const n1 = JSON.parse(runCli(["evidence", "add", "--task", t1.id, "--kind", "note", "--summary", "root-caused it", "--workspace", ws, "--json"])).evidence;
  const r1 = runCli(["receipt", "create", "--task", t1.id, "--verdict", "pass_with_risk", "--evidence", n1.id, "--workspace", ws]);
  assert.match(r1, /guardLevel: L1 \(computed\)/);
  assert.match(r1, /why: L1: cited a note \(no run\/rerun evidence\) — cite .* to reach L2/, "the L1 explanation names the note and the next step to L2");
  // Honesty: the explanation never asserts a level above the computed one.
  assert.doesNotMatch(r1, /why:[^\n]*\b(L2|L3|L4)\b[^\n]*\bcomputed\b/);
  const r1json = JSON.parse(runCli(["receipt", "create", "--task", t1.id, "--verdict", "pass_with_risk", "--evidence", n1.id, "--workspace", ws, "--json"]));
  assert.match(r1json.receipt.levelExplanation, /^L1: cited a note/, "the explanation is in the --json payload too");

  // L2 path: run/output evidence. The explanation must say so and point to L3.
  const t2 = JSON.parse(runCli(["task", "create", "--title", "L2 work", "--workspace", ws, "--json"])).task;
  const o2 = JSON.parse(runCli(["evidence", "add", "--task", t2.id, "--kind", "output", "--summary", "ran the suite", "--workspace", ws, "--json"])).evidence;
  const r2 = runCli(["receipt", "create", "--task", t2.id, "--verdict", "pass_with_risk", "--evidence", o2.id, "--workspace", ws]);
  assert.match(r2, /why: L2: cited run\/output evidence — add a cross-family review .* to reach L3/, "the L2 explanation reflects the run/output evidence, not a hardcoded L1 string");

  // L3 path: a cited cross_family_guard. The explanation points to L4 (never above).
  const t3 = JSON.parse(runCli(["task", "create", "--title", "L3 work", "--workspace", ws, "--json"])).task;
  const o3 = JSON.parse(runCli(["evidence", "add", "--task", t3.id, "--kind", "output", "--summary", "ran it", "--workspace", ws, "--json"])).evidence;
  const x3 = JSON.parse(runCli(["evidence", "add", "--task", t3.id, "--kind", "cross_family_guard", "--summary", "GPT reviewed", "--reviewer", "gpt-5", "--workspace", ws, "--json"])).evidence;
  const r3 = runCli(["receipt", "create", "--task", t3.id, "--verdict", "pass", "--evidence", `${o3.id},${x3.id}`, "--review-mode", "cross_family", "--workspace", ws]);
  assert.match(r3, /guardLevel: L3 \(computed\)/);
  assert.match(r3, /why: L3: cited a cross-family review — add a rerun reconciled to a recorded run .* to reach L4/, "the L3 explanation reflects the cross-family review and points to L4");
});

test("getitback: evidence add warns on an unrecognized --kind (likely typo) but still records it as a generic row", () => {
  const ws = freshRunWorkspace("getitback-kindwarn");
  const task = JSON.parse(runCli(["task", "create", "--title", "Kind task", "--workspace", ws, "--json"])).task;
  // A typo'd kind ("reun" for "rerun"): the row is RECORDED (exit 0) but a stderr
  // warning fires naming that it won't raise the guard level.
  const typo = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "reun", "--summary", "meant rerun", "--workspace", ws]);
  assert.equal(typo.status, 0, "an unknown kind is not an error — the row is still recorded");
  assert.match(typo.stderr, /Warning: 'reun' is not a recognized kind; recorded as a generic evidence row that won't raise the guard level\./, "a typo'd kind triggers a stderr warning");
  assert.match(typo.stdout, /Evidence added\./, "the evidence row is still written");
  // The row is on disk (recorded, not dropped).
  const rows = ledgerRows(ws, "evidence.jsonl");
  assert.ok(rows.some((row) => row.kind === "reun" && row.taskId === task.id), "the typo'd kind row is persisted as a generic row");

  // A RECOGNIZED kind does NOT warn (no false positives on the documented kinds).
  for (const goodKind of ["note", "diff", "file", "output", "command", "test"]) {
    const ok = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", goodKind, "--summary", `a ${goodKind}`, "--workspace", ws]);
    assert.equal(ok.status, 0);
    assert.doesNotMatch(ok.stderr, /is not a recognized kind/, `a documented kind (${goodKind}) does not trigger the warning`);
  }
  // --json stdout stays clean even when the warning fires (warning is on stderr).
  const typoJson = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "boguskind", "--summary", "x", "--workspace", ws, "--json"]);
  assert.equal(typoJson.status, 0);
  assert.match(typoJson.stderr, /is not a recognized kind/);
  const parsed = JSON.parse(typoJson.stdout); // must parse: warning did not pollute stdout
  assert.equal(parsed.command, "evidence add");
  assert.equal(parsed.evidence.kind, "boguskind");
});

test("CLI rejects an unknown sub-action and an unknown value flag", () => {
  const ws = freshRunWorkspace("badargs");
  const badAction = runResult(["bin/ai-collab.js", "task", "destroy", "--workspace", ws]);
  assert.notEqual(badAction.status, 0);
  assert.match(badAction.stderr, /Unknown task command/i);
  // A value flag with no value is rejected by parseArgs.
  const noValue = runResult(["bin/ai-collab.js", "task", "create", "--title"]);
  assert.notEqual(noValue.status, 0);
  assert.match(noValue.stderr, /requires a value/i);
});

// --- The six ledger integrity checks, one negative test each ----------------

test("ledger check 1: a corrupt JSONL line is rejected with file + line number", () => {
  const ws = freshRunWorkspace("badjson");
  assert.equal(validateWorkspace(ws).ok, true);
  // Append a non-JSON line to tasks.jsonl.
  writeFileSync(ledger(ws, "tasks.jsonl"), readFileSync(ledger(ws, "tasks.jsonl"), "utf8") + "this is not json\n", "utf8");
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /tasks\.jsonl:2 is not valid JSON/.test(e)),
    `expected a bad-JSONL error with line number, got:\n${result.errors.join("\n")}`
  );
});

test("ledger check 2: orphan evidence (taskId not in tasks) is rejected", () => {
  const ws = freshRunWorkspace("orphan");
  writeFileSync(
    ledger(ws, "evidence.jsonl"),
    JSON.stringify({ id: "e9", taskId: "ghost", kind: "note", summary: "x", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /evidence e9 references unknown task "ghost" \(orphan\)/.test(e)),
    `expected an orphan-evidence error, got:\n${result.errors.join("\n")}`
  );
});

test("ledger check 3: an illegal task status is rejected", () => {
  const ws = freshRunWorkspace("badstatus");
  writeFileSync(
    ledger(ws, "tasks.jsonl"),
    JSON.stringify({ id: "t9", title: "x", status: "almost_done", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /task t9 has illegal status "almost_done"/.test(e)),
    `expected an illegal-status error, got:\n${result.errors.join("\n")}`
  );
});

test("ledger check 4: a receipt referencing unknown evidence is rejected", () => {
  const ws = freshRunWorkspace("brokenref");
  // Keep tasks/evidence valid (task t0 + evidence e0 from the seed); add a
  // receipt that cites a non-existent evidence id.
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    JSON.stringify({ id: "c9", taskId: "t0", verdict: "pass", evidenceIds: ["e0", "missing99"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /receipt c9 references unknown evidence "missing99" \(broken reference\)/.test(e)),
    `expected a broken-reference error, got:\n${result.errors.join("\n")}`
  );
});

test("ledger check 5: a done task with no evidence is rejected", () => {
  const ws = freshRunWorkspace("doneobligation");
  // A done task with no evidence row pointing at it. Replace evidence with an
  // empty file so the seed e0->t0 link cannot satisfy this new task.
  writeFileSync(
    ledger(ws, "tasks.jsonl"),
    JSON.stringify({ id: "t9", title: "claimed done", status: "done", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  writeFileSync(ledger(ws, "evidence.jsonl"), "", "utf8");
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /task t9 is "done" but has no evidence/.test(e)),
    `expected a done-needs-evidence error, got:\n${result.errors.join("\n")}`
  );
});

test("ledger check 6: an accepted receipt that cites no evidence is rejected", () => {
  const ws = freshRunWorkspace("emptyaccept");
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    JSON.stringify({ id: "c9", taskId: "t0", verdict: "pass", evidenceIds: [], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /receipt c9 is "accepted" but cites no evidence/.test(e)),
    `expected an accepted-needs-evidence error, got:\n${result.errors.join("\n")}`
  );
});

test("privacy scanner now scans .jsonl ledgers (the P1 security fix)", () => {
  // Before the fix, SCANNED_EXT omitted jsonl, so a real secret pasted into a
  // ledger would ship while the scan stayed green. Plant a SYNTHETIC fake AWS
  // key (AKIA + 16 chars) in a .jsonl file and assert the scanner catches it.
  const fixture = mkdtempSync(path.join(tmpdir(), "aicos-jsonl-privacy-"));
  const fakeAwsKey = `${"AKIA"}EXAMPLEFAKEKEY00`; // 16 uppercase/digit chars; synthetic, not a real key
  writeFileSync(
    path.join(fixture, "tasks.jsonl"),
    JSON.stringify({ id: "t1", title: `leak ${fakeAwsKey}`, status: "open", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = runResult(["scripts/privacy-scan.js", "--workspace", fixture]);
  assert.notEqual(result.status, 0, "scanner must fail on a jsonl with a planted secret");
  assert.match(result.stderr, /AWS access key/i);
  assert.match(result.stderr, /tasks\.jsonl/, "the error must point at the jsonl file");
});

test("ledger.js is the single shared module used by both CLI writer and validator", () => {
  // Guards against the writer and reader drifting onto different on-disk shapes:
  // both must import ledger.js rather than re-implementing parse/append.
  const cliSrc = read(repoRoot, "src", "cli.js");
  const validateSrc = read(repoRoot, "src", "validate.js");
  assert.match(cliSrc, /from ["']\.\/ledger\.js["']/, "cli must import ledger.js");
  assert.match(validateSrc, /from ["']\.\/ledger\.js["']/, "validate must import ledger.js");
});

// ===========================================================================
// P1 run-layer hardening (REJECT follow-up): the CLI must never write a row its
// own validator rejects, the parser must reject non-object records pointably,
// ids must be unique, nextId must not gap, and the task lifecycle must have a
// status-change command that enforces "done needs evidence".
// ===========================================================================

// M1: receipt create with an accepting verdict but NO evidence must never be
// written "accepted" (an accepted receipt with no evidence is exactly what
// validator check 6 rejects). After the P2 evidence-gate the two accepting
// verdicts diverge at no-evidence:
//   - a plain "pass" with no evidence is REFUSED outright (a pass needs L3+ and,
//     at L3, a cross_family_guard row it can cite — with no evidence there is
//     nothing to cite, so the consistency gate refuses it before any status).
//   - a "pass_with_risk" with no evidence is still WRITTEN "pending" (a risk
//     receipt can exist before evidence; it just cannot be owner-accepted later
//     without same-task evidence). Either way it is never "accepted".
test("receipt create: a no-evidence pass is refused, a no-evidence pass_with_risk is refused (A1: no evidence -> computed L0) — never accepted", () => {
  const ws = freshRunWorkspace("receipt-pending");
  const task = JSON.parse(runCli(["task", "create", "--title", "Task NoEv", "--workspace", ws, "--json"])).task;

  // A1: the level is COMPUTED from evidence, so no evidence at all -> computed L0,
  // no matter what review mode or claimed level is asserted. Plain pass with no
  // evidence: refused (L0 can only be insufficient_evidence).
  const refusedPass = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family", "--claimed-level", "L3", "--workspace", ws]);
  assert.notEqual(refusedPass.status, 0, "a plain pass with no evidence must be refused");
  assert.match(refusedPass.stderr, /insufficient_evidence|summary only|L0/i, "the refusal must explain that no evidence computes to L0");

  // pass_with_risk with no evidence: ALSO refused under A1 — computed L0 cannot
  // carry even a warned pass. (Pre-A1 this was written "pending"; A1 deliberately
  // tightens it: you cannot file a risk-pass on literally no evidence.)
  const refusedRisk = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--review-mode", "cross_family", "--claimed-level", "L3", "--workspace", ws]);
  assert.notEqual(refusedRisk.status, 0, "pass_with_risk with no evidence must be refused (computed L0)");
  assert.match(refusedRisk.stderr, /insufficient_evidence|summary only|L0/i, "the refusal must explain the computed L0 ceiling");

  // A pass_with_risk WITH some (author run) evidence computes L2 and is written
  // pending (not auto-accepted) — the honest "warned, awaiting owner" state.
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  const riskReceipt = JSON.parse(
    runCli(["receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--review-mode", "self", "--evidence", ev.id, "--workspace", ws, "--json"])
  ).receipt;
  assert.equal(riskReceipt.verdict, "pass_with_risk");
  assert.equal(riskReceipt.guardLevel, "L2", "self review + author run evidence computes L2");
  assert.notEqual(riskReceipt.status, "accepted", "pass_with_risk must NOT be auto-accepted");
  assert.equal(riskReceipt.status, "pending", "pass_with_risk with evidence is pending");

  // The resulting workspace must still validate: the CLI cannot have produced an
  // accepted+empty-evidence row, so there is no unsupported acceptance to flag.
  const result = validateWorkspace(ws);
  assert.equal(result.ok, true, `workspace must stay valid, got:\n${result.errors.join("\n")}`);
  // And no accepted receipt anywhere cites zero evidence.
  for (const receipt of ledgerRows(ws, "receipts.jsonl")) {
    if (receipt.status === "accepted") {
      assert.ok(
        Array.isArray(receipt.evidenceIds) && receipt.evidenceIds.length > 0,
        `accepted receipt ${receipt.id} must cite evidence`
      );
    }
  }
});

// P2 owner gate (was "pass_with_risk WITH evidence is still accepted"): under P2
// a pass_with_risk receipt is NO LONGER auto-accepted even with evidence — it is
// created "pending" and an explicit owner sign-off (receipt accept --owner) is
// what moves it to "accepted". This test pins both halves: pending on create,
// accepted only after the owner accepts. (A plain "pass" with evidence still
// auto-accepts; that is covered by the pass -> accepted test above.)
test("receipt create: pass_with_risk WITH evidence is pending until the owner accepts it", () => {
  const ws = freshRunWorkspace("receipt-accept");
  const task = JSON.parse(runCli(["task", "create", "--title", "Task Ev", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(
    runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "log", "--workspace", ws, "--json"])
  ).evidence;
  // L2 is the highest level a single tool can give a pass_with_risk; with
  // evidence it is still created pending (the P2 owner gate), not accepted.
  const receipt = JSON.parse(
    runCli(["receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--guard-level", "L2", "--evidence", ev.id, "--workspace", ws, "--json"])
  ).receipt;
  assert.equal(receipt.status, "pending", "pass_with_risk with evidence must be pending, not auto-accepted");
  assert.notEqual(receipt.ownerAccepted, true, "no owner acceptance yet");
  assert.deepEqual(receipt.evidenceIds, [ev.id]);

  // Owner accepts -> status becomes accepted and the owner marker is recorded.
  const accepted = JSON.parse(
    runCli(["receipt", "accept", "--id", receipt.id, "--owner", "--workspace", ws, "--json"])
  ).receipt;
  assert.equal(accepted.status, "accepted", "after owner acceptance the risk receipt is accepted");
  assert.equal(accepted.ownerAccepted, true, "the owner acceptance marker must be set");
  // The workspace still validates (an accepted pass_with_risk WITH the owner mark
  // is supported; the same row WITHOUT the mark would fail check 9).
  assert.equal(validateWorkspace(ws).ok, true, `workspace must stay valid, got:\n${validateWorkspace(ws).errors.join("\n")}`);
});

// M2: a non-object JSON record (null / array / scalar) on a ledger line must be
// rejected with a pointable "record must be an object" error, not crash the
// validator with a TypeError on a later record.id access.
test("ledger: a non-object record (null / array / scalar) is rejected with a pointable error, not a crash", () => {
  for (const [label, literal] of [["null", "null"], ["array", "[1,2,3]"], ["scalar", "42"]]) {
    const ws = freshRunWorkspace(`nonobject-${label}`);
    // Line 1 is the synthetic seed; append the bad record as line 2.
    writeFileSync(
      ledger(ws, "tasks.jsonl"),
      readFileSync(ledger(ws, "tasks.jsonl"), "utf8") + literal + "\n",
      "utf8"
    );
    let result;
    assert.doesNotThrow(() => {
      result = validateWorkspace(ws);
    }, `validator must not throw on a ${label} record`);
    assert.equal(result.ok, false, `${label} record must fail validation`);
    assert.ok(
      result.errors.some((e) => /tasks\.jsonl:2 record must be an object/.test(e)),
      `expected a pointable "record must be an object" error for ${label}, got:\n${result.errors.join("\n")}`
    );
  }
});

// M2 (CLI side): a CLI command that reads a ledger with a non-object record must
// fail with the pointable corrupt-ledger message, not a raw TypeError.
test("CLI: a non-object record makes a read-side command fail pointably, not crash", () => {
  const ws = freshRunWorkspace("nonobject-cli");
  writeFileSync(
    ledger(ws, "tasks.jsonl"),
    readFileSync(ledger(ws, "tasks.jsonl"), "utf8") + "null\n",
    "utf8"
  );
  const result = runResult(["bin/ai-collab.js", "status", "--workspace", ws]);
  assert.notEqual(result.status, 0, "a corrupt non-object record must make the command fail");
  assert.match(result.stderr, /tasks\.jsonl:2: record must be an object/i);
  assert.doesNotMatch(result.stderr, /TypeError/, "must be a pointable ledger error, not a raw TypeError");
});

// m3: duplicate ids within one ledger must be rejected (the cross-ref Sets would
// otherwise silently fold them), and a missing/blank id must be reported too.
test("ledger: duplicate id within one ledger is rejected", () => {
  const ws = freshRunWorkspace("dupid");
  // Seed task is t0; append a second record that re-uses t0.
  writeFileSync(
    ledger(ws, "tasks.jsonl"),
    readFileSync(ledger(ws, "tasks.jsonl"), "utf8") +
      JSON.stringify({ id: "t0", title: "dup", status: "open", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /tasks\.jsonl has duplicate id "t0"/.test(e)),
    `expected a duplicate-id error, got:\n${result.errors.join("\n")}`
  );
});

test("ledger: a record with a missing / non-string id is rejected", () => {
  const ws = freshRunWorkspace("blankid");
  writeFileSync(
    ledger(ws, "evidence.jsonl"),
    JSON.stringify({ id: "", taskId: "t0", kind: "note", summary: "x", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /evidence\.jsonl has a record with a missing or non-string id/.test(e)),
    `expected a missing-id error, got:\n${result.errors.join("\n")}`
  );
});

// m4: the first user-created task after the t0 seed must be t1 (not t2). nextId
// anchors on max(existing numeric suffix)+1 instead of rows.length+1.
test("nextId: the first user task after the t0 seed is t1, not t2", () => {
  const ws = freshRunWorkspace("nextid");
  const first = JSON.parse(runCli(["task", "create", "--title", "First", "--workspace", ws, "--json"])).task;
  assert.equal(first.id, "t1", "first user task after seed t0 must be t1");
  const second = JSON.parse(runCli(["task", "create", "--title", "Second", "--workspace", ws, "--json"])).task;
  assert.equal(second.id, "t2", "second user task must be t2");
});

// Design completion: `task update --status` changes a task's status, refuses an
// illegal status, and (matching validator check 5) refuses "done" without
// evidence while allowing blocked/partial/unverified with none.
test("task update: changes status, enforces done-needs-evidence, rejects illegal status", () => {
  const ws = freshRunWorkspace("taskupdate");
  const task = JSON.parse(runCli(["task", "create", "--title", "Lifecycle", "--workspace", ws, "--json"])).task;

  // open -> done WITHOUT evidence is rejected (thin done), nothing changes.
  const noEvidence = runResult(["bin/ai-collab.js", "task", "update", "--task", task.id, "--status", "done", "--workspace", ws]);
  assert.notEqual(noEvidence.status, 0, "marking done with no evidence must fail");
  assert.match(noEvidence.stderr, /no evidence/i);
  assert.match(noEvidence.stderr, /blocked\/partial\/unverified/i, "the error must suggest the evidence-free statuses");
  const stillOpen = ledgerRows(ws, "tasks.jsonl").find((t) => t.id === task.id);
  assert.equal(stillOpen.status, "open", "a rejected update must not change the row");

  // open -> blocked / partial / unverified is allowed with no evidence.
  for (const status of ["blocked", "partial", "unverified"]) {
    const out = JSON.parse(
      runCli(["task", "update", "--task", task.id, "--status", status, "--workspace", ws, "--json"])
    );
    assert.equal(out.task.status, status, `update to ${status} must succeed without evidence`);
  }

  // Add evidence, then open -> done is allowed.
  runCli(["evidence", "add", "--task", task.id, "--kind", "command", "--summary", "tests pass", "--workspace", ws]);
  const done = JSON.parse(
    runCli(["task", "update", "--task", task.id, "--status", "done", "--workspace", ws, "--json"])
  );
  assert.equal(done.task.status, "done", "done must succeed once evidence exists");
  // The change is persisted (read-all -> patch -> rewrite, same row, no new row).
  const rows = ledgerRows(ws, "tasks.jsonl");
  assert.equal(rows.filter((t) => t.id === task.id).length, 1, "update must patch the row, not append a new one");
  assert.equal(rows.find((t) => t.id === task.id).status, "done");

  // An illegal status value is rejected.
  const illegal = runResult(["bin/ai-collab.js", "task", "update", "--task", task.id, "--status", "almost", "--workspace", ws]);
  assert.notEqual(illegal.status, 0, "an illegal status must be rejected");
  assert.match(illegal.stderr, /status must be one of/i);

  // Updating a non-existent task is rejected.
  const ghost = runResult(["bin/ai-collab.js", "task", "update", "--task", "nope", "--status", "open", "--workspace", ws]);
  assert.notEqual(ghost.status, 0, "updating an unknown task must fail");
  assert.match(ghost.stderr, /not found/i);

  // The workspace still validates after a full lifecycle.
  const result = validateWorkspace(ws);
  assert.equal(result.ok, true, `workspace must stay valid after lifecycle, got:\n${result.errors.join("\n")}`);
});

test("C3: author-marked done without a done-eligible receipt is warned and displayed as unverified, not plain done", () => {
  const ws = freshRunWorkspace("c3-author-marked-done");
  const task = JSON.parse(runCli(["task", "create", "--title", "Author marked only", "--workspace", ws, "--json"])).task;
  runCli(["evidence", "add", "--task", task.id, "--kind", "note", "--summary", "one note only", "--workspace", ws]);

  const update = runResult(["bin/ai-collab.js", "task", "update", "--task", task.id, "--status", "done", "--workspace", ws]);
  assert.equal(update.status, 0, "marking done with evidence but no receipt remains allowed");
  assert.match(
    update.stderr,
    /marked done without an accepted receipt; this shows as author-marked, unverified/i,
    "task update must warn that this is author-marked/unverified until receipt-backed"
  );

  const statusText = runCli(["status", "--workspace", ws]);
  assert.match(statusText, new RegExp(`${task.id}  Author marked only  \\[done — author-marked, unverified\\]`), "status must label the author-marked done state");
  assert.doesNotMatch(statusText, new RegExp(`${task.id}  Author marked only  \\[done\\](?! — author-marked)`), "status must not show a bare verified-looking [done]");
  assert.match(statusText, /receipt: \(none yet\)/, "the missing receipt remains visible");

  const statusJson = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  const statusEntry = statusJson.perTask.find((row) => row.id === task.id);
  assert.equal(statusEntry.status, "done", "the author's stored status is preserved");
  assert.equal(statusEntry.statusDisplay, "done — author-marked, unverified", "--json exposes the honest display status");
  assert.equal(statusEntry.authorMarkedDoneUnverified, true, "--json flags that the done status is not receipt-backed");

  const handoff = runJson(["handoff", "create", "--workspace", ws, "--json"]);
  assert.deepEqual(handoff.model.done.map((entry) => entry.id), [], "author-marked done must not enter Done");
  assert.deepEqual(handoff.model.pending.map((entry) => entry.id), [task.id], "with no receipt, the task remains Pending");
  const entry = handoff.model.pending[0];
  assert.equal(entry.taskStatus, "done", "handoff preserves the stored author status");
  assert.equal(entry.taskStatusDisplay, "done — author-marked, unverified", "handoff exposes the honest display status");
  assert.equal(entry.authorMarkedDoneUnverified, true, "handoff flags author-marked/unverified done");
  assert.ok(
    entry.riskNotes.some((note) => /author-marked, unverified/i.test(note) && /accepted receipt/i.test(note)),
    `handoff must carry the author-marked warning, got:\n${entry.riskNotes.join("\n")}`
  );

  const draft = readFileSync(handoff.file, "utf8");
  assert.match(draft, new RegExp(`\\*\\*${task.id} — Author marked only\\*\\* _\\(task status: done — author-marked, unverified\\)_`), "handoff draft must show the unverified display status");
});

// Help / guide surface the new command so the lifecycle is discoverable.
test("help and guide document the task update command", () => {
  const help = runCli(["help"]);
  assert.match(help, /task update --task <id> --status/i, "help must list task update");
  const guide = runCli(["guide"]);
  assert.match(guide, /task update/i, "guide must mention task update");
});

// ===========================================================================
// Cross-task evidence back door (major follow-up): a receipt for task B must
// not be acceptable by citing task A's evidence. Otherwise a task with zero
// evidence of its own could be written "accepted" by borrowing another task's
// proof — exactly the "accepted needs (its own) evidence" rule, evaded. Both
// the CLI writer and the validator must refuse it, via the SAME shared filter.
// ===========================================================================

// Helper: create task A with its own evidence (a generic output row evA plus a
// cross_family_guard row xguardA so an L3 pass for A can be filed under the P2
// evidence-gate), plus an evidence-free task B. Returns
// { ws, taskA, evA, xguardA, taskB } for the cross-task tests below.
function twoTaskWorkspace(label) {
  const ws = freshRunWorkspace(label);
  const taskA = JSON.parse(runCli(["task", "create", "--title", "Task A", "--workspace", ws, "--json"])).task;
  const evA = JSON.parse(
    runCli(["evidence", "add", "--task", taskA.id, "--kind", "output", "--summary", "A's log", "--workspace", ws, "--json"])
  ).evidence;
  const xguardA = JSON.parse(
    runCli(["evidence", "add", "--task", taskA.id, "--kind", "cross_family_guard", "--summary", "A's cross-family guard review", "--reviewer", "gpt-guard", "--workspace", ws, "--json"])
  ).evidence;
  const taskB = JSON.parse(runCli(["task", "create", "--title", "Task B", "--workspace", ws, "--json"])).task;
  return { ws, taskA, evA, xguardA, taskB };
}

// A1 L4 reconciliation: drive the FULL real-execution flow so a rerun evidence
// row reaches L4. The reconciliation gate requires a rerun to reference a recorded
// run exec row in runs.jsonl that agrees on task/status/exitCode/command/output
// hash. The old start/finish version of this helper was the bug: it let a typed
// exit code look like real execution.
function reconciledRerun(ws, taskId, { command, exit = 0, output = "5 passed, 0 failed", summary = "reviewer re-ran the suite", runner } = {}) {
  const effectiveCommand = command ?? commandThatPrints(output, exit);
  const executed = JSON.parse(runCli(["run", "exec", "--task", taskId, "--command", effectiveCommand, "--workspace", ws, "--json"]));
  assert.equal(executed.run.exitCode, exit, "test helper precondition: run exec exit code must match the requested rerun exit");
  assert.equal(executed.output, output, "test helper precondition: run exec output must match the requested rerun output");
  const run = executed.run;
  const args = [
    "evidence", "add", "--task", taskId, "--kind", "rerun", "--summary", summary,
    "--command", effectiveCommand, "--exit", String(exit), "--output", output, "--run", run.id,
    ...(runner !== undefined ? ["--runner", runner] : []),
    "--workspace", ws, "--json"
  ];
  const rerun = JSON.parse(runCli(args)).evidence;
  return { run, rerun };
}

test("cross-task: receipt create for task B citing task A's evidence is rejected at write time", () => {
  const { ws, taskA, evA, xguardA, taskB } = twoTaskWorkspace("xtask-cli");
  const before = ledgerRows(ws, "receipts.jsonl").length;

  // task B receipt that borrows task A's evidence -> refused, non-zero exit.
  const bad = runResult([
    "bin/ai-collab.js", "receipt", "create",
    "--task", taskB.id, "--verdict", "pass", "--guard-level", "L3", "--evidence", evA.id, "--workspace", ws
  ]);
  assert.notEqual(bad.status, 0, "a cross-task receipt must be rejected");
  assert.match(bad.stderr, /another task/i, "the error must explain the evidence belongs to another task");
  assert.match(bad.stderr, new RegExp(evA.id), "the error must name the offending evidence id");

  // Nothing was appended; the workspace still validates.
  assert.equal(ledgerRows(ws, "receipts.jsonl").length, before, "a rejected receipt must not be written");
  assert.equal(validateWorkspace(ws).ok, true, "workspace must stay valid after the rejected write");

  // Sanity: the SAME evidence cited for its OWN task (A), together with A's own
  // cross_family_guard row (required for an L3 pass), is accepted.
  const ok = JSON.parse(
    runCli(["receipt", "create", "--task", taskA.id, "--verdict", "pass", "--guard-level", "L3", "--evidence", `${evA.id},${xguardA.id}`, "--workspace", ws, "--json"])
  ).receipt;
  assert.equal(ok.status, "accepted", "evidence cited for its own task must still produce an accepted receipt");
  assert.deepEqual(ok.evidenceIds, [evA.id, xguardA.id]);
});

test("cross-task: the validator flags a hand-planted receipt that cites another task's evidence", () => {
  const { ws, taskA, evA, taskB } = twoTaskWorkspace("xtask-validator");
  assert.equal(validateWorkspace(ws).ok, true, "precondition: clean two-task workspace validates");

  // Hand-write a receipts ledger the CLI would have refused: task B "accepted"
  // on the strength of task A's evidence. Append to the existing seed row.
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    readFileSync(ledger(ws, "receipts.jsonl"), "utf8") +
      JSON.stringify({ id: "c9", taskId: taskB.id, verdict: "pass", guardLevel: "L3", evidenceIds: [evA.id], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false, "a cross-task receipt must fail validation");
  // It is flagged BOTH as a cross-task citation and as an unsupported acceptance
  // (no same-task evidence), proving the back door is closed at both levels.
  assert.ok(
    result.errors.some((e) => new RegExp(`receipt c9 cites evidence "${evA.id}" that belongs to another task`).test(e)),
    `expected a cross-task evidence error, got:\n${result.errors.join("\n")}`
  );
  assert.ok(
    result.errors.some((e) => /receipt c9 is "accepted" but cites no evidence/.test(e)),
    `expected an unsupported-acceptance error (no same-task evidence), got:\n${result.errors.join("\n")}`
  );
  // The cross-task error must NOT mention task A (evA belongs to A, receipt is B).
  assert.ok(
    result.errors.some((e) => new RegExp(`not task "${taskB.id}"`).test(e)),
    `cross-task error must name the receipt's own task, got:\n${result.errors.join("\n")}`
  );
});

test("cross-task: a receipt referencing an unknown task is rejected (CLI + validator)", () => {
  const ws = freshRunWorkspace("xtask-unknown-task");

  // CLI: receipt create for a task that does not exist is refused up front (this
  // already failed via the task-existence guard; lock it so it stays refused).
  const bad = runResult([
    "bin/ai-collab.js", "receipt", "create",
    "--task", "ghost", "--verdict", "pass", "--guard-level", "L3", "--workspace", ws
  ]);
  assert.notEqual(bad.status, 0, "a receipt for an unknown task must be rejected");
  assert.match(bad.stderr, /not found/i, "the CLI must say the task was not found");

  // Validator: a hand-planted receipt with a dangling taskId is flagged.
  // (verdict insufficient_evidence + guardLevel L0 is internally consistent, so
  // the ONLY error this row should raise is the unknown-task reference.)
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    JSON.stringify({ id: "c9", taskId: "ghost", verdict: "insufficient_evidence", guardLevel: "L0", evidenceIds: [], status: "rejected", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false, "a receipt for an unknown task must fail validation");
  assert.ok(
    result.errors.some((e) => /receipt c9 references unknown task "ghost"/.test(e)),
    `expected an unknown-task error, got:\n${result.errors.join("\n")}`
  );
});

// Seed self-consistency: the committed receipts seed must agree with the runtime
// rule under the cross-task model. e0 belongs to t0 and the receipt is for t0, so
// receiptStatusFor("pass", owned=["e0"]) is "accepted" — the seed status must be
// "accepted", not a contradicting "pending". A regression that re-softens the
// seed (or breaks ownedEvidenceIds) trips this.
test("seed self-consistency: the committed receipt seed status matches receiptStatusFor under the cross-task rule", () => {
  const seed = JSON.parse(receiptsLedger());

  // The seed cites only its own task's evidence (e0 -> t0, receipt -> t0).
  const evidenceSeed = [{ id: "e0", taskId: "t0" }];
  const owned = ownedEvidenceIds(seed.evidenceIds, seed.taskId, evidenceSeed);
  assert.deepEqual(owned, ["e0"], "the seed must cite its own task's evidence");

  const computed = receiptStatusFor(seed.verdict, owned);
  assert.equal(
    seed.status,
    computed,
    `seed receipt status "${seed.status}" must equal receiptStatusFor("${seed.verdict}", ${JSON.stringify(owned)}) = "${computed}"`
  );
  assert.equal(seed.status, "accepted", "the self-consistent seed status is accepted");

  // And a freshly generated workspace (which ships this exact seed) validates.
  const ws = freshRunWorkspace("seed-consistency");
  assert.equal(validateWorkspace(ws).ok, true, "the generated workspace with the accepted seed must validate");
});

// ===========================================================================
// P2: Guard evidence-package + level (L0-L4) x verdict x owner-acceptance.
// A guard verdict must match the evidence strength the guard actually saw, and a
// pass_with_risk needs an explicit owner sign-off before it counts as accepted.
// The write layer (CLI) and the read layer (validator) must enforce the SAME
// rules via the shared ledger.js predicates, so neither side can drift.
// ===========================================================================

// Helper: hand-plant a single receipts ledger row on a clean one-task workspace
// (task t0 + evidence e0 from the seed) and return the validation result. Used by
// the validator-side negative tests so they exercise rows the CLI would refuse.
function plantReceipt(label, row) {
  const ws = freshRunWorkspace(label);
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    JSON.stringify(row) + "\n",
    "utf8"
  );
  return { ws, result: validateWorkspace(ws) };
}

// --- Required negative test 1: summary-only (L0) guard writing "pass" -------
// At write time the CLI must refuse it; at read time the validator must flag a
// hand-planted L0 "pass". L0 means the guard saw only a completion summary, so
// the only honest verdict is insufficient_evidence.
test("P2 negative: an L0 (summary-only) guard cannot return pass — CLI refuses, validator flags", () => {
  const ws = freshRunWorkspace("p2-l0-pass-cli");
  const task = JSON.parse(runCli(["task", "create", "--title", "Summary only", "--workspace", ws, "--json"])).task;
  // A1: L0 is the no-evidence floor. A "pass" with no evidence (a summary-only
  // look) computes L0 no matter what level is claimed, and L0 can only be
  // insufficient_evidence. (Claiming L0 explicitly via --claimed-level is also
  // refused the same way.)
  const bad = runResult([
    "bin/ai-collab.js", "receipt", "create",
    "--task", task.id, "--verdict", "pass", "--claimed-level", "L0", "--workspace", ws
  ]);
  assert.notEqual(bad.status, 0, "L0 + pass must be refused at write time");
  assert.match(bad.stderr, /L0 .*only return insufficient_evidence/i, "the error must explain the L0 ceiling");
  assert.equal(ledgerRows(ws, "receipts.jsonl").length, 1, "the refused receipt must not be written (only the seed remains)");

  // Validator: a hand-planted L0 "pass" (with its own-task evidence so check 6
  // is satisfied) is still flagged by the verdict x level consistency check.
  const planted = plantReceipt("p2-l0-pass-val", {
    id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L0", evidenceIds: ["e0"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "a hand-planted L0 pass must fail validation");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9: guard level L0 .*only return insufficient_evidence/i.test(e)),
    `expected an L0-consistency error, got:\n${planted.result.errors.join("\n")}`
  );
});

// --- Required negative test 2: single-tool guard faking dual (L3 with only
// single-tool / same-task evidence and no cross-family Evidence Pack). The
// honest single-tool ceiling is L2/pass_with_risk; claiming L2 + pass is the
// concrete "single-tool dressed up as a binding pass" the system must catch.
test("P2 negative: a single-tool guard cannot pass — L2 + pass is refused (CLI + validator)", () => {
  const ws = freshRunWorkspace("p2-l2-pass-cli");
  const task = JSON.parse(runCli(["task", "create", "--title", "Single tool", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "command", "--summary", "author ran tests", "--workspace", ws, "--json"])).evidence;
  // CLI: L2 (single-tool, author-supplied evidence) cannot clear the gate with pass.
  const bad = runResult([
    "bin/ai-collab.js", "receipt", "create",
    "--task", task.id, "--verdict", "pass", "--guard-level", "L2", "--evidence", ev.id, "--workspace", ws
  ]);
  assert.notEqual(bad.status, 0, "L2 + pass must be refused (single tool tops out at pass_with_risk)");
  assert.match(bad.stderr, /L2 .*cannot return "pass"|strongest a single tool/i, "the error must explain the single-tool ceiling");

  // The legitimate single-tool outcome (L2 + pass_with_risk) IS allowed — it is
  // created pending (the owner gate), proving the floor is real, not a blanket ban.
  const okRisk = JSON.parse(runCli([
    "receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--guard-level", "L2", "--evidence", ev.id, "--workspace", ws, "--json"
  ])).receipt;
  assert.equal(okRisk.status, "pending", "L2 + pass_with_risk is the allowed single-tool outcome, pending owner sign-off");

  // Validator: a hand-planted L2 "pass" (claiming the binding gate cleared on
  // single-tool evidence) is flagged.
  const planted = plantReceipt("p2-l2-pass-val", {
    id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L2", evidenceIds: ["e0"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "a hand-planted L2 pass must fail validation");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9: guard level L2 .*cannot return "pass"/i.test(e)),
    `expected an L2-consistency error, got:\n${planted.result.errors.join("\n")}`
  );
});

// --- Required negative test 3: pass_with_risk recorded "accepted" with NO owner
// acceptance marker. The CLI cannot produce this (create -> pending; accept sets
// the marker), so it is validator-side: a hand-planted accepted risk receipt
// with no ownerAccepted is an unsupported acceptance.
test("P2 negative: an accepted pass_with_risk with no owner acceptance is flagged", () => {
  // The row cites its own-task evidence (e0, a note -> computed L1) and a risk
  // verdict at L1 is internally consistent (the computed level matches the stored
  // level under A1's check 8c), so the ONLY thing wrong is the missing owner
  // marker. That isolates check 9.
  const planted = plantReceipt("p2-risk-no-owner", {
    id: "c9", taskId: "t0", verdict: "pass_with_risk", guardLevel: "L1", evidenceIds: ["e0"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "an accepted pass_with_risk with no owner marker must fail");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9 is an "accepted" pass_with_risk but has no owner acceptance marker/i.test(e)),
    `expected an owner-acceptance error, got:\n${planted.result.errors.join("\n")}`
  );

  // The SAME row WITH ownerAccepted: true is supported (proves the check targets
  // exactly the missing marker, not the verdict).
  const ok = plantReceipt("p2-risk-with-owner", {
    id: "c9", taskId: "t0", verdict: "pass_with_risk", guardLevel: "L1", evidenceIds: ["e0"], status: "accepted", ownerAccepted: true, acceptedAt: "2026-01-02T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(ok.result.ok, true, `an accepted pass_with_risk WITH the owner marker must validate, got:\n${ok.result.errors.join("\n")}`);
});

// --- Required negative test 4: an L4 "pass" claiming independent re-run but with
// NO rerun output. L4 is the strongest level precisely because the reviewer
// re-ran the key evidence; an L4 pass with no rerun output is an unbacked
// independence claim.
test("P2 negative: an L4 claim with no rerun output cannot reach L4 (CLI computes lower) and a hand-planted L4 is flagged (validator)", () => {
  const ws = freshRunWorkspace("p2-l4-norerun-cli");
  const task = JSON.parse(runCli(["task", "create", "--title", "L4 claim", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "cross-family review", "--reviewer", "gpt-guard", "--workspace", ws, "--json"])).evidence;
  // A1: claiming cross_family_rerun (the L4 method) WITHOUT a rerun-output row
  // cannot reach L4 — the evidence caps it at L3 (a cross_family_guard row is
  // present), marked self-declared/unverified. The level is computed DOWN, not
  // self-asserted up: the recorded level is L3, never L4.
  const capped = JSON.parse(runCli([
    "receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--claimed-level", "L4", "--evidence", `${ev.id},${xguard.id}`, "--workspace", ws, "--json"
  ])).receipt;
  assert.equal(capped.guardLevel, "L3", "claiming L4 with no rerun output computes down to L3 (capped by evidence)");
  assert.equal(capped.familyUnverified, true, "the capped L3 is marked self-declared cross-family / unverified");

  // CLI: the SAME work WITH a RECONCILED rerun (a recorded run it references and
  // agrees with) reaches L4 (done right — A1 L4 reconciliation).
  const { rerun: rerunEv } = reconciledRerun(ws, task.id, { summary: "reviewer re-ran tests, all pass", output: "Tests: 5 passed, 0 failed" });
  const okL4 = JSON.parse(runCli([
    "receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--evidence", `${ev.id},${xguard.id}`, "--rerun", rerunEv.id, "--workspace", ws, "--json"
  ])).receipt;
  assert.equal(okL4.guardLevel, "L4", "cross_family_rerun + a reconciled rerun computes L4");
  assert.equal(okL4.status, "accepted", "L4 + pass WITH rerun output is accepted locally");
  // Honesty fix C1: the old expectation was the bug. A reconciled rerun proves
  // local execution/output matching, but it cannot verify the typed-in model
  // family on the cross_family_guard row, so L4 is still family-unverified.
  assert.equal(okL4.familyUnverified, true, "L4 still marks the self-declared cross-family identity as unverified");
  assert.deepEqual(okL4.rerunEvidenceIds, [rerunEv.id], "the rerun evidence id is recorded");

  // Validator: a hand-planted L4 "pass" with no rerunEvidenceIds is flagged. Both
  // the verdict gate (check 8: L4 needs rerun output) AND the over-claim check
  // (8c: claims L4 but evidence supports less) catch it; we assert the rerun one.
  const planted = plantReceipt("p2-l4-norerun-val", {
    // cite the seed cross_family_guard (e1) so the cross-family gate passes and the
    // ONLY remaining L4 problem is the missing rerun — isolating the rerun wording.
    id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L4", evidenceIds: ["e0", "e1"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "a hand-planted L4 pass with no rerun output must fail");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9: guard level L4 .*cites no reconciled rerun/i.test(e)),
    `expected an L4-rerun error, got:\n${planted.result.errors.join("\n")}`
  );
});

// --- A1: the level is COMPUTED (optional flag), and bogus inputs are rejected --
test("A1: receipt create computes the level when none is claimed, and rejects a bogus claimed level / review mode", () => {
  const ws = freshRunWorkspace("p2-level-required");
  const task = JSON.parse(runCli(["task", "create", "--title", "Need level", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "log", "--workspace", ws, "--json"])).evidence;
  // A1: --claimed-level / --guard-level is now OPTIONAL — the CLI computes the
  // level from the review method + evidence. A receipt with no claimed level is
  // accepted (here a reject, which is level-agnostic), proving the level is no
  // longer a required self-assertion.
  const noLevel = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "reject", "--evidence", ev.id, "--workspace", ws]);
  assert.equal(noLevel.status, 0, `a receipt with no claimed level must be accepted (level is computed), stderr:\n${noLevel.stderr}`);
  // Bogus --claimed-level (legacy --guard-level maps here) is rejected.
  const bogus = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "reject", "--guard-level", "L9", "--evidence", ev.id, "--workspace", ws]);
  assert.notEqual(bogus.status, 0, "an out-of-range claimed level must be refused");
  assert.match(bogus.stderr, /claimed-level .*must be one of|guard-level/i, "the error must list the allowed levels");
  // Bogus --review-mode is rejected.
  const bogusMode = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "reject", "--review-mode", "binding", "--evidence", ev.id, "--workspace", ws]);
  assert.notEqual(bogusMode.status, 0, "an unknown review mode must be refused");
  assert.match(bogusMode.stderr, /review-mode must be one of/i, "the error must list the allowed review modes");
});

// --- The full consistency rule, demonstrated as one matrix (write-time) ------
// This is the "演示" the dispatch asks for, run for real against the CLI: A1 edition.
// The level is COMPUTED from (review mode + evidence), and the verdict is bounded
// by that computed level. Each case pins the review mode + cited evidence, the
// resulting COMPUTED level, and whether the verdict clears — so the matrix proves
// the level is derived (not claimed) AND the verdict ceiling holds.
test("A1 consistency matrix: the CLI computes the level from review mode + evidence and bounds the verdict", () => {
  const ws = freshRunWorkspace("p2-matrix");
  const task = JSON.parse(runCli(["task", "create", "--title", "Matrix", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "log", "--workspace", ws, "--json"])).evidence;
  // A1 L4 reconciliation: the rerun used in the L4 matrix case must reference a
  // recorded run that reconciles, so build it through the full recorded-run flow.
  const { rerun: rerunEv } = reconciledRerun(ws, task.id, { summary: "reviewer rerun", output: "5 passed" });
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "cross-family guard review", "--reviewer", "gpt-guard", "--workspace", ws, "--json"])).evidence;

  // [reviewMode, verdict, evidenceArgs, expectOk, expectedComputedLevel, expectedStatus]
  const cases = [
    // No review mode, no evidence -> computed L0 -> only insufficient_evidence.
    ["self", "insufficient_evidence", [], true, "L0", "rejected"],
    ["self", "pass", [], false, null, null],                                   // no evidence -> L0 -> cannot pass (headline #1)
    // self + author run evidence -> computed L2 -> cannot pass, can warn.
    ["self", "pass", ["--evidence", ev.id], false, null, null],                // L2 cannot pass (headline #2, single-tool)
    ["self", "pass_with_risk", ["--evidence", ev.id], true, "L2", "pending"],
    // same_family_subagent + a cross_family_guard row the AI self-filled -> STILL
    // computed L2 (the method caps it; the self-filled cross-family row cannot
    // raise it). This is the anti-silent-green headline: a same-family sub-agent
    // cannot reach L3 no matter what evidence it attaches.
    ["same_family_subagent", "pass", ["--evidence", `${ev.id},${xguard.id}`], false, null, null],
    ["same_family_subagent", "pass_with_risk", ["--evidence", `${ev.id},${xguard.id}`], true, "L2", "pending"],
    // same_tool_other_model + a guard-review row -> computed L2.5 (weak L3): still
    // cannot plain-pass (one tool has not cleared the cross-family gate).
    ["same_tool_other_model", "pass", ["--evidence", `${ev.id},${xguard.id}`], false, null, null],
    ["same_tool_other_model", "pass_with_risk", ["--evidence", `${ev.id},${xguard.id}`], true, "L2.5", "pending"],
    // cross_family but NO cross_family_guard row cited -> evidence caps at L2 ->
    // cannot pass (claiming cross-family does not, by itself, make L3).
    ["cross_family", "pass", ["--evidence", ev.id], false, null, null],
    // cross_family + a cross_family_guard row -> computed L3 -> may pass (marked
    // unverified). The status is accepted (a plain pass auto-accepts with evidence).
    ["cross_family", "pass", ["--evidence", `${ev.id},${xguard.id}`], true, "L3", "accepted"],
    // cross_family_rerun but no rerun output -> evidence caps at L3 (cross-family
    // row present), NOT L4 -> the pass is an L3 pass.
    ["cross_family_rerun", "pass", ["--evidence", `${ev.id},${xguard.id}`], true, "L3", "accepted"],
    // cross_family_rerun + a rerun-output row -> computed L4 (the hard pass).
    ["cross_family_rerun", "pass", ["--evidence", `${ev.id},${xguard.id}`, "--rerun", rerunEv.id], true, "L4", "accepted"],
    // reject is level-agnostic above L0 (here with author run evidence -> L2). Note
    // a reject with NO evidence computes L0, which can ONLY be insufficient_evidence
    // — you cannot reject what you saw no evidence about; that bound is its own case.
    ["cross_family", "reject", ["--evidence", ev.id], true, null, "rejected"],
    ["self", "reject", [], false, null, null] // no evidence -> L0 -> reject is not allowed (only insufficient_evidence)
  ];

  for (const [mode, verdict, extra, expectOk, expectedLevel, expectedStatus] of cases) {
    const args = ["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", verdict, "--review-mode", mode, ...extra, "--workspace", ws, "--json"];
    const res = runResult(args);
    if (expectOk) {
      assert.equal(res.status, 0, `(${mode}, ${verdict}) should be accepted by the writer, stderr:\n${res.stderr}`);
      const receipt = JSON.parse(res.stdout).receipt;
      if (expectedLevel !== null) {
        assert.equal(receipt.guardLevel, expectedLevel, `(${mode}, ${verdict}) expected computed level ${expectedLevel}, got ${receipt.guardLevel}`);
      }
      assert.equal(receipt.status, expectedStatus, `(${mode}, ${verdict}) expected status ${expectedStatus}, got ${receipt.status}`);
    } else {
      assert.notEqual(res.status, 0, `(${mode}, ${verdict}) should be REFUSED by the writer`);
    }
  }
  // After the whole matrix, the workspace still validates (the writer never
  // persisted an inconsistent row).
  assert.equal(validateWorkspace(ws).ok, true, `workspace must stay valid after the matrix, got:\n${validateWorkspace(ws).errors.join("\n")}`);
});

// ===========================================================================
// A1: the honest-level engine. The guard level is COMPUTED from review mode +
// evidence, never self-asserted; the family is self-declared and marked unverified;
// only an independent rerun OUTPUT (L4) is hard evidence. These tests are the
// anti-"silent green" core: an AI cannot write itself a passing cross-family level.
// ===========================================================================

// THE COMMAND-LINE HEADLINE: an AI opens its OWN same-family sub-agent, fills in a
// cross_family_guard evidence row itself, and claims L3. The CLI must compute L2
// (the same-family method caps it) and REFUSE the plain pass — the self-filled
// cross-family row cannot buy independence it does not have. Both write + read.
test("A1 anti-silent-green: self-reported L3 backed by a same-family sub-agent computes L2 and is refused a plain pass", () => {
  const ws = freshRunWorkspace("a1-same-family-l2");
  const task = JSON.parse(runCli(["task", "create", "--title", "Same-family review", "--workspace", ws, "--json"])).task;
  // The AI self-fills a cross_family_guard row (the family/reviewer are just typed in).
  const selfFilled = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "my own sub-agent looked", "--family", "gpt-totally-real", "--reviewer", "my-subagent", "--workspace", ws, "--json"])).evidence;
  // It declares the HONEST method (same_family_subagent) and CLAIMS L3.
  const bad = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "same_family_subagent", "--claimed-level", "L3", "--evidence", selfFilled.id, "--workspace", ws]);
  assert.notEqual(bad.status, 0, "a same-family review claiming L3 must be refused a plain pass");
  assert.match(bad.stderr, /L2 .*cannot return "pass"|same-family/i, "the refusal must explain the same-family L2 ceiling");

  // The strongest a same-family sub-agent may give is pass_with_risk at COMPUTED L2,
  // and it is recorded as L2 (NOT the claimed L3) with reviewMode same_family_subagent.
  const ok = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--review-mode", "same_family_subagent", "--claimed-level", "L3", "--evidence", selfFilled.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(ok.guardLevel, "L2", "the computed level is L2, never the self-claimed L3");
  assert.equal(ok.reviewMode, "same_family_subagent", "the (advisory) review method is recorded");
  assert.notEqual(ok.familyUnverified, true, "an L2 same-family level is not a cross-family claim, so no unverified marker");
  assert.equal(ok.status, "pending", "pass_with_risk awaits owner sign-off");

  // Validator: a hand-planted L3 pass on a row whose reviewMode is same_family_subagent
  // is flagged by the over-claim check (the method only supports L2).
  const planted = plantReceipt("a1-same-family-l3-val", {
    id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L3", reviewMode: "same_family_subagent", evidenceIds: ["e1"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "a hand-planted L3 with a same-family review method must fail");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9 claims guard level "L3" but the review method \+ evidence only support "L2"/i.test(e)),
    `expected the over-claim error, got:\n${planted.result.errors.join("\n")}`
  );
});

// FAMILY HONESTY: a cross_family pass with no rerun output is L3 but marked
// "self-declared cross-family, unverified" — and the marker is enforced, so a
// hand-edit that strips it (to make L3 read like a hard pass) is flagged.
test("A1 family honesty: a cross_family L3 pass is marked unverified, and the marker cannot be stripped", () => {
  const ws = freshRunWorkspace("a1-family-honesty");
  const task = JSON.parse(runCli(["task", "create", "--title", "Cross-family claim", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "claims a gpt guard pressed on it", "--family", "gpt", "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family", "--evidence", `${ev.id},${xguard.id}`, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L3", "cross_family + a cross_family_guard row computes L3");
  assert.equal(receipt.familyUnverified, true, "the L3 is marked self-declared cross-family / unverified");
  // The human-readable output names the unverified caveat.
  const text = runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family", "--evidence", `${ev.id},${xguard.id}`, "--workspace", ws]);
  assert.match(text, /self-declared cross-family, unverified/i, "the receipt output must surface the unverified caveat");

  // Validator: stripping the familyUnverified marker off a computed-L3 cross-family
  // row is flagged (the marker is required, not optional decoration).
  const stripped = plantReceipt("a1-strip-marker", {
    id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: ["e0", "e1"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(stripped.result.ok, false, "an L3 cross-family row missing the unverified marker must fail");
  assert.ok(
    stripped.result.errors.some((e) => /receipt c9 .*missing the familyUnverified: true marker/i.test(e)),
    `expected the missing-marker error, got:\n${stripped.result.errors.join("\n")}`
  );
});

// HARD EVIDENCE WINS: a reconciled rerun OUTPUT reaches L4, but C1 keeps the
// cross-family identity warning because the family value is still typed locally.
// Also: a rerun row with no output is refused.
test("A1 hard evidence: cross_family + rerun output reaches L4 while family identity stays unverified; a rerun without output is refused", () => {
  const ws = freshRunWorkspace("a1-l4-hard");
  const task = JSON.parse(runCli(["task", "create", "--title", "Hard L4", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "gpt guard", "--family", "gpt", "--workspace", ws, "--json"])).evidence;
  // A rerun WITHOUT --output is refused at evidence-add (the output is the hard proof).
  const noOut = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "I ran it", "--command", "npm test", "--exit", "0", "--workspace", ws]);
  assert.notEqual(noOut.status, 0, "a rerun with no output must be refused");
  assert.match(noOut.stderr, /must record the raw output/i, "the refusal must name the missing output");
  // With a RECONCILED rerun (a recorded run it references + agrees with) and the
  // cross_family_rerun method, the level is L4 (A1 L4 reconciliation).
  const { rerun } = reconciledRerun(ws, task.id, { summary: "reviewer re-ran it" });
  const l4 = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--evidence", `${ev.id},${xguard.id}`, "--rerun", rerun.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(l4.guardLevel, "L4", "cross_family_rerun + a reconciled rerun computes L4");
  // Honesty fix C1: old behavior treated L4 rerun evidence as if it verified
  // model-family identity. It does not; it only verifies local execution/output
  // reconciliation.
  assert.equal(l4.familyUnverified, true, "L4 still carries the self-declared cross-family warning");
  assert.equal(l4.status, "accepted", "the L4 pass is accepted locally");
  assert.equal(validateWorkspace(ws).ok, true, "the workspace validates after an L4 pass that keeps the family warning");

  // Validator: a hand-planted L4 with reviewMode cross_family_rerun but no rerun
  // output is flagged by the over-claim check (evidence supports only L3).
  const planted = plantReceipt("a1-l4-noout-val", {
    id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: ["e1"], familyUnverified: true, status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "a hand-planted L4 with no rerun output must fail");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9 claims guard level "L4" but the review method \+ evidence only support "L3"/i.test(e)),
    `expected the L4 over-claim error, got:\n${planted.result.errors.join("\n")}`
  );
});

// ANTI-DRIFT: the level computation lives once in ledger.js and both layers use it.
test("A1: computeGuardLevel + REVIEW_MODES live in ledger.js and are used by both CLI and validator", () => {
  const cliSrc = read(repoRoot, "src", "cli.js");
  const validateSrc = read(repoRoot, "src", "validate.js");
  const ledgerSrc = read(repoRoot, "src", "ledger.js");
  assert.match(ledgerSrc, /export function computeGuardLevel/, "the level computation must be defined in ledger.js");
  assert.match(ledgerSrc, /export const REVIEW_MODES/, "the review-mode enum must be defined in ledger.js");
  assert.match(ledgerSrc, /export function familyHonestyMarker/, "the family-honesty marker must be defined in ledger.js");
  // The shared re-computation wrapper (single source the validator AND the handoff
  // Done gate both use to derive a stored receipt's real level + family-verification
  // from its own evidence) also lives in ledger.js.
  assert.match(ledgerSrc, /export function computeReceiptGuardLevel/, "the shared receipt re-computation helper must be defined in ledger.js");
  // The CLI WRITER computes the level (does not take it from the claim).
  assert.match(cliSrc, /computeGuardLevel/, "the CLI writer must compute the level via the shared rule");
  // The VALIDATOR re-computes the level to catch a hand-planted over-claim — now via
  // the shared computeReceiptGuardLevel wrapper (which calls computeGuardLevel under
  // the hood), so the validator and the handoff drafter cannot drift on what counts.
  assert.match(validateSrc, /computeReceiptGuardLevel|computeGuardLevel/, "the validator must re-compute the level via the shared rule");
  // The handoff drafter routes its Done gate through the SAME shared helper (not a
  // stored field) — this is the deeper-leak fix: family-verification is derived, so a
  // missing/false familyUnverified marker can no longer push unverified work into Done.
  assert.match(ledgerSrc, /computeReceiptGuardLevel\(receipt, evidence, runs\)/, "buildHandoffModel must derive family-verification via the shared helper, not read the stored flag");
});

// --- owner acceptance command edge cases ------------------------------------
test("P2: receipt accept refuses non-risk verdicts, missing --owner, and unknown ids", () => {
  const ws = freshRunWorkspace("p2-accept-edges");
  const task = JSON.parse(runCli(["task", "create", "--title", "Accept edges", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "log", "--workspace", ws, "--json"])).evidence;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "cross-family guard review", "--reviewer", "gpt-guard", "--workspace", ws, "--json"])).evidence;
  // A plain pass (auto-accepted, not a risk receipt) cannot be owner-accepted.
  // (An L3 pass must cite a cross_family_guard row under the P2 evidence-gate.)
  const passReceipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--guard-level", "L3", "--evidence", `${ev.id},${xguard.id}`, "--workspace", ws, "--json"])).receipt;
  const wrongVerdict = runResult(["bin/ai-collab.js", "receipt", "accept", "--id", passReceipt.id, "--owner", "--workspace", ws]);
  assert.notEqual(wrongVerdict.status, 0, "only pass_with_risk receipts need an owner acceptance");
  assert.match(wrongVerdict.stderr, /only pass_with_risk/i);

  // A risk receipt requires the --owner flag (accept without it is refused).
  const riskReceipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--guard-level", "L2", "--evidence", ev.id, "--workspace", ws, "--json"])).receipt;
  const noOwner = runResult(["bin/ai-collab.js", "receipt", "accept", "--id", riskReceipt.id, "--workspace", ws]);
  assert.notEqual(noOwner.status, 0, "accept without --owner must be refused");
  assert.match(noOwner.stderr, /requires --owner/i);

  // Unknown id is refused.
  const ghost = runResult(["bin/ai-collab.js", "receipt", "accept", "--id", "c999", "--owner", "--workspace", ws]);
  assert.notEqual(ghost.status, 0, "accepting an unknown receipt must fail");
  assert.match(ghost.stderr, /not found/i);
});

// ===========================================================================
// P2 evidence-gate (REJECT follow-up): "format gate" -> "evidence gate". Make
// guardLevel and owner sign-off REAL, not forgeable strings:
//   F1 the validator reverse-computes status from the rule (a verdict/status
//      contradiction or a status the rule would not assign is flagged).
//   F2 receipt accept re-runs the consistency gate (a self-written inconsistent
//      pending receipt cannot be laundered into accepted).
//   F3 an L3 pass must cite a cross_family_guard evidence row; an L4 pass's
//      --rerun must point at an actual rerun-kind row (a note cannot fake it).
//   F4 owner acceptance records the actor + timestamp as a local audit trail.
// ===========================================================================

// F1: a hand-written receipt whose status contradicts its verdict (verdict
// "reject" but status "accepted") must be flagged by the validator's reverse
// status check — even though it cites real same-task evidence (so the older
// "accepted needs evidence" check 6 would NOT catch it).
test("F1: verdict x status contradiction (reject + accepted) is flagged by the validator", () => {
  const planted = plantReceipt("f1-reject-accepted", {
    id: "c9", taskId: "t0", verdict: "reject", guardLevel: "L0", evidenceIds: ["e0"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "a reject receipt written 'accepted' must fail validation");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9 has status "accepted" but verdict "reject".*computes to "rejected"/.test(e)),
    `expected a status-vs-rule contradiction error, got:\n${planted.result.errors.join("\n")}`
  );
});

// F1: an illegal status string (not accepted/rejected/pending) is flagged by the
// status enum check before the reverse-compute.
test("F1: an illegal receipt status value is flagged by the validator", () => {
  const planted = plantReceipt("f1-bad-status", {
    id: "c9", taskId: "t0", verdict: "reject", guardLevel: "L0", evidenceIds: [], status: "approved", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "an illegal status must fail validation");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9 has missing\/illegal status "approved"/.test(e)),
    `expected an illegal-status error, got:\n${planted.result.errors.join("\n")}`
  );
});

// F1 reverse-compute: a pass_with_risk written "accepted" WITHOUT the owner
// marker is caught by the reverse status check (the rule computes "pending" with
// ownerAccepted=false), independently of the owner-acceptance check 9.
test("F1: pass_with_risk + accepted but no ownerAccepted contradicts the computed status", () => {
  const planted = plantReceipt("f1-pwr-accepted-noowner", {
    id: "c9", taskId: "t0", verdict: "pass_with_risk", guardLevel: "L2", evidenceIds: ["e0"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "an accepted pass_with_risk with no owner marker must fail");
  // Both the reverse-compute (F1) and the owner-acceptance check (9) fire; assert
  // the F1 reverse-compute message is present.
  assert.ok(
    planted.result.errors.some((e) => /receipt c9 has status "accepted" but verdict "pass_with_risk".*ownerAccepted=false computes to "pending"/.test(e)),
    `expected an F1 reverse-status error, got:\n${planted.result.errors.join("\n")}`
  );
});

// F2: receipt accept re-runs the consistency gate. A self-written PENDING receipt
// that is internally inconsistent (pass_with_risk at guardLevel L0 — L0 can never
// carry pass_with_risk) must be REFUSED at accept time, not laundered into
// accepted. (The CLI create path would refuse it; this proves the accept path
// independently refuses a hand-planted pending row too.)
test("F2: accept refuses an inconsistent pending receipt (L0 + pass_with_risk) instead of laundering it", () => {
  const ws = freshRunWorkspace("f2-accept-inconsistent");
  // Hand-plant a pending pass_with_risk at L0 with own-task evidence. (L0 +
  // pass_with_risk is inconsistent: L0 can only ever be insufficient_evidence.)
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    JSON.stringify({ id: "c9", taskId: "t0", verdict: "pass_with_risk", guardLevel: "L0", evidenceIds: ["e0"], status: "pending", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const res = runResult(["bin/ai-collab.js", "receipt", "accept", "--id", "c9", "--owner", "--workspace", ws]);
  assert.notEqual(res.status, 0, "accepting an inconsistent pending receipt must be refused");
  assert.match(res.stderr, /Cannot accept inconsistent receipt c9.*L0/i, "the refusal must name the L0 inconsistency");
  // The row must NOT have been promoted to accepted on disk.
  const row = ledgerRows(ws, "receipts.jsonl").find((r) => r.id === "c9");
  assert.equal(row.status, "pending", "the receipt must stay pending, not be laundered to accepted");
  assert.notEqual(row.ownerAccepted, true, "no owner marker may be written on a refused accept");
});

// F3: an L3 pass that cites only a non-cross-family evidence row is REFUSED at
// write time (the cross-family Evidence Pack must be cited, not declared).
test("F3: an L3 pass with no cross_family_guard evidence is refused (CLI computes below L3) and flagged (validator)", () => {
  const ws = freshRunWorkspace("f3-l3-no-xfamily-cli");
  const task = JSON.parse(runCli(["task", "create", "--title", "L3 no xfam", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  // A1: claiming cross_family WITHOUT a cross_family_guard row cannot reach L3 —
  // the evidence caps it at L2 (author run evidence only), so the plain pass is
  // refused. (Declaring cross-family does not, by itself, build the L3 pack.)
  const bad = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family", "--claimed-level", "L3", "--evidence", ev.id, "--workspace", ws]);
  assert.notEqual(bad.status, 0, "an L3 claim with only a non-cross-family row must be refused");
  assert.match(bad.stderr, /cannot return "pass"|pass_with_risk|requires guard level/i, "the refusal must explain the level is below the cross-family gate");

  // Validator: a hand-planted L3 pass citing only a note row (e0) is flagged. Both
  // the verdict gate (check 8: an L3 pass needs a cross_family_guard row) AND the
  // over-claim check (8c: claims L3 but a note supports only L1) catch it; we
  // assert the cross-family gate wording still fires.
  const planted = plantReceipt("f3-l3-no-xfamily-val", {
    id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L3", evidenceIds: ["e0"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "a hand-planted L3 pass with no cross-family evidence must fail");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9: guard level L3 .*no cross_family_guard evidence/i.test(e)),
    `expected an L3 cross-family error, got:\n${planted.result.errors.join("\n")}`
  );
});

// F3 positive: an L3 pass that DOES cite a real cross_family_guard evidence row
// is accepted (proves the gate is a floor, not a blanket ban).
test("F3: an L3 pass that cites a real cross_family_guard evidence row is accepted", () => {
  const ws = freshRunWorkspace("f3-l3-with-xfamily");
  const task = JSON.parse(runCli(["task", "create", "--title", "L3 with xfam", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "GPT-family guard pressed on it", "--reviewer", "gpt-guard", "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--guard-level", "L3", "--evidence", `${ev.id},${xguard.id}`, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.status, "accepted", "an L3 pass citing a cross_family_guard row clears the gate");
  assert.equal(validateWorkspace(ws).ok, true, "the workspace must validate after a legitimate L3 pass");
});

// F3: an L4 pass whose --rerun points at a NON-rerun (note) row is refused — a
// plain note cannot masquerade as the reviewer's independent re-run.
test("F3: a note cited as --rerun cannot reach L4 (the kind is what counts), a real rerun-output row can", () => {
  const ws = freshRunWorkspace("f3-l4-rerun-is-note");
  const task = JSON.parse(runCli(["task", "create", "--title", "L4 fake rerun", "--workspace", ws, "--json"])).task;
  // A plain note row used as the rerun citation must NOT satisfy L4. With only the
  // note (no valid rerun output, no cross-family row), the computed level is L1 and
  // the plain pass is refused — a note saying "I re-ran it" is not a rerun.
  const note = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "note", "--summary", "I totally re-ran it, trust me", "--workspace", ws, "--json"])).evidence;
  const bad = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--claimed-level", "L4", "--evidence", note.id, "--rerun", note.id, "--workspace", ws]);
  assert.notEqual(bad.status, 0, "an L4 pass whose rerun citation is a note must be refused");
  assert.match(bad.stderr, /cannot return "pass"|requires guard level|pass_with_risk/i, "the refusal must explain the computed level is below a pass");

  // The SAME work with an actual kind:rerun row (command + exit + OUTPUT) that is
  // RECONCILED against a recorded run, plus a cross_family_guard row, reaches L4
  // (the kind + the reconciled run is what counts — A1 L4 reconciliation).
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "GPT-family guard pressed on it", "--reviewer", "gpt-guard", "--workspace", ws, "--json"])).evidence;
  const { rerun } = reconciledRerun(ws, task.id, { summary: "reviewer re-ran tests, all pass" });
  const okL4 = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--evidence", `${note.id},${xguard.id}`, "--rerun", rerun.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(okL4.guardLevel, "L4", "a reconciled rerun row + cross-family row computes L4");
  assert.equal(okL4.status, "accepted", "an L4 pass with a reconciled rerun row is accepted");
  assert.deepEqual(okL4.rerunEvidenceIds, [rerun.id]);
});

// ===========================================================================
// G1/G2/G3 (P2 收尾 — label gate -> structure gate). The two load-bearing kinds
// must carry their structured fields (not just the right label); rerunEvidenceIds
// gets a global reference-integrity check; the L4 error wording distinguishes
// "no rerun cited" from "cited but not a valid rerun". These are STRUCTURE checks
// only — no content-authenticity / provenance verification (local-first).
// ===========================================================================

// G1: an empty-shell cross_family_guard (no reviewer/family/ref) is refused at
// evidence-add time (CLI), and a hand-planted shell is flagged by the validator.
test("G1: an empty-shell cross_family_guard evidence row is refused (CLI) and flagged (validator)", () => {
  const ws = freshRunWorkspace("g1-xfam-shell-cli");
  const task = JSON.parse(runCli(["task", "create", "--title", "Shell xfam", "--workspace", ws, "--json"])).task;
  // CLI: --kind cross_family_guard with only --summary (no attribution) is refused.
  const bad = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "trust me a guard looked", "--workspace", ws]);
  assert.notEqual(bad.status, 0, "an empty-shell cross_family_guard must be refused at write time");
  assert.match(bad.stderr, /reviewer.*family.*ref|name who\/which family/i, "the refusal must name the missing attribution fields");
  assert.equal(ledgerRows(ws, "evidence.jsonl").length, 2, "the refused row must not be appended (only the two seed rows remain)");

  // Validator: a hand-planted shell cross_family_guard row (bound to t0) is flagged
  // even though no receipt cites it.
  const ws2 = freshRunWorkspace("g1-xfam-shell-val");
  writeFileSync(
    ledger(ws2, "evidence.jsonl"),
    readFileSync(ledger(ws2, "evidence.jsonl"), "utf8") +
      JSON.stringify({ id: "e9", taskId: "t0", kind: "cross_family_guard", summary: "shell, no attribution", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws2);
  assert.equal(result.ok, false, "a hand-planted shell cross_family_guard must fail validation");
  assert.ok(
    result.errors.some((e) => /evidence e9: cross_family_guard evidence must name who\/which family/i.test(e)),
    `expected a cross_family_guard structure error, got:\n${result.errors.join("\n")}`
  );
});

// G1: an empty-shell rerun (no command / no exitCode) is refused at evidence-add
// time (CLI), and a hand-planted shell is flagged by the validator.
test("G1: an empty-shell rerun evidence row is refused (CLI) and flagged (validator)", () => {
  const ws = freshRunWorkspace("g1-rerun-shell-cli");
  const task = JSON.parse(runCli(["task", "create", "--title", "Shell rerun", "--workspace", ws, "--json"])).task;
  // CLI: --kind rerun with no --command is refused.
  const noCmd = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "I re-ran it honest", "--workspace", ws]);
  assert.notEqual(noCmd.status, 0, "a rerun with no command must be refused");
  assert.match(noCmd.stderr, /command that was re-run|--command/i, "the refusal must name the missing command");
  // CLI: --kind rerun WITH --command but no --exit is still refused (exitCode required).
  const noExit = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "ran it", "--command", "npm test", "--workspace", ws]);
  assert.notEqual(noExit.status, 0, "a rerun with no exit code must be refused");
  assert.match(noExit.stderr, /integer exitCode|--exit/i, "the refusal must name the missing exit code");
  assert.equal(ledgerRows(ws, "evidence.jsonl").length, 2, "neither refused row was appended (only the two seed rows remain)");

  // Validator: a hand-planted shell rerun row (kind rerun, no command/exitCode) is flagged.
  const ws2 = freshRunWorkspace("g1-rerun-shell-val");
  writeFileSync(
    ledger(ws2, "evidence.jsonl"),
    readFileSync(ledger(ws2, "evidence.jsonl"), "utf8") +
      JSON.stringify({ id: "e9", taskId: "t0", kind: "rerun", summary: "shell rerun, no command", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws2);
  assert.equal(result.ok, false, "a hand-planted shell rerun must fail validation");
  assert.ok(
    result.errors.some((e) => /evidence e9: rerun evidence must record the command/i.test(e)),
    `expected a rerun structure error, got:\n${result.errors.join("\n")}`
  );
});

// G1: an L3 pass that cites a STRUCTURALLY-INCOMPLETE cross_family_guard row does
// not clear the gate — the row is a shell, so it does not count as cross-family
// evidence. (Validator-side: a CLI evidence add could not create the shell, so we
// hand-plant the shell evidence + the receipt that leans on it.)
test("G1: an L3 pass citing a shell cross_family_guard row is rejected (does not clear the gate)", () => {
  const ws = freshRunWorkspace("g1-l3-shell-xfam");
  // Hand-plant a shell cross_family_guard (e9) on t0 + an L3 pass receipt citing it.
  writeFileSync(
    ledger(ws, "evidence.jsonl"),
    readFileSync(ledger(ws, "evidence.jsonl"), "utf8") +
      JSON.stringify({ id: "e9", taskId: "t0", kind: "cross_family_guard", summary: "shell", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    JSON.stringify({ id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L3", evidenceIds: ["e9"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false, "an L3 pass propped up by a shell cross_family_guard must fail");
  // It is flagged BOTH for the bad evidence row AND for the L3 pass having no
  // VALID cross-family evidence (the shell does not count).
  assert.ok(
    result.errors.some((e) => /evidence e9: cross_family_guard evidence must name/i.test(e)),
    `expected the shell evidence to be flagged, got:\n${result.errors.join("\n")}`
  );
  assert.ok(
    result.errors.some((e) => /receipt c9: guard level L3 .*no cross_family_guard evidence/i.test(e)),
    `expected the L3 pass to be rejected (shell does not count), got:\n${result.errors.join("\n")}`
  );
});

// G1 positive: an L3 pass that cites a STRUCTURALLY-COMPLETE cross_family_guard
// row (carries a reviewer) is accepted end-to-end (CLI), and the workspace
// validates — proving the structure gate is a floor, not a blanket ban.
test("G1 positive: a structurally-complete cross_family_guard clears an L3 pass (CLI + validator)", () => {
  const ws = freshRunWorkspace("g1-l3-complete-xfam");
  const task = JSON.parse(runCli(["task", "create", "--title", "Complete xfam", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  // A cross_family_guard WITH a reviewer + family is structurally complete.
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "GPT-family guard pressed on it", "--reviewer", "gpt-5-guard", "--family", "openai", "--ref", "review-thread-12", "--workspace", ws, "--json"])).evidence;
  assert.equal(xguard.reviewer, "gpt-5-guard", "the reviewer field is recorded on the evidence row");
  assert.equal(xguard.family, "openai", "the family field is recorded");
  assert.equal(xguard.ref, "review-thread-12", "the ref field is recorded");
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--guard-level", "L3", "--evidence", `${ev.id},${xguard.id}`, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.status, "accepted", "an L3 pass citing a complete cross_family_guard row clears the gate");
  assert.equal(validateWorkspace(ws).ok, true, "the workspace must validate after a legitimate structured L3 pass");
});

// G1 positive: a structurally-complete rerun (command + integer exitCode + OUTPUT)
// under a cross_family_rerun review mode clears an L4 pass end-to-end (CLI), and
// the workspace validates.
test("G1 positive: a structurally-complete rerun (command + exitCode + output) clears an L4 pass (CLI + validator)", () => {
  const ws = freshRunWorkspace("g1-l4-complete-rerun");
  const task = JSON.parse(runCli(["task", "create", "--title", "Complete rerun", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  // A1 L4 reconciliation: a complete rerun must ALSO reference a recorded run that
  // reconciles (same task, finished, matching exitCode + command). reconciledRerun
  // drives run start/finish then adds the rerun row with --run, so it reconciles.
  const { run, rerun } = reconciledRerun(ws, task.id, { output: "Tests: 5 passed, 0 failed", runner: "ci" });
  assert.equal(rerun.command, run.command, "the command field is recorded on the rerun row and matches the executed run");
  assert.equal(rerun.exitCode, 0, "the exitCode is recorded as an integer");
  assert.equal(rerun.output, "Tests: 5 passed, 0 failed", "the required output field is recorded");
  assert.equal(rerun.runner, "ci", "the optional runner field is recorded");
  assert.equal(rerun.runId, run.id, "the rerun row references the recorded run via runId");
  // A1 (Design Y): L4 requires BOTH a cited cross_family_guard row (the independent
  // cross-family review) AND a reconciled rerun. The review mode names the method, but
  // the cross-family part must be CITED as evidence, not merely declared — a reconciled
  // rerun on its own is single-tool run evidence and only reaches L2.
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "GPT-family guard pressed on it", "--reviewer", "gpt-5-guard", "--family", "openai", "--ref", "review-thread-7", "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--evidence", `${ev.id},${xguard.id}`, "--rerun", rerun.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L4", "cross_family_rerun + a cited cross_family_guard + a reconciled rerun computes L4");
  assert.equal(receipt.status, "accepted", "an L4 pass citing a reconciled rerun row clears the gate");
  assert.deepEqual(receipt.rerunEvidenceIds, [rerun.id]);
  assert.equal(validateWorkspace(ws).ok, true, "the workspace must validate after a legitimate reconciled L4 pass");
});

// G1: an L4 pass whose --rerun cites a STRUCTURALLY-INCOMPLETE rerun row (a rerun
// missing its command/exitCode) does not clear the gate. Hand-planted because the
// CLI could not create the shell rerun in the first place.
test("G1: an L4 pass citing a shell rerun row is rejected (does not clear the gate)", () => {
  const ws = freshRunWorkspace("g1-l4-shell-rerun");
  writeFileSync(
    ledger(ws, "evidence.jsonl"),
    readFileSync(ledger(ws, "evidence.jsonl"), "utf8") +
      // A structurally-VALID cross_family_guard (e8) so the L4 pass clears the
      // cross-family gate (Design Y: L4 needs a cross_family_guard too) and the ONLY
      // remaining problem is the shell rerun (e9) — isolating that assertion.
      JSON.stringify({ id: "e8", taskId: "t0", kind: "cross_family_guard", summary: "real guard", reviewer: "gpt-guard", family: "openai", ref: "thread-1", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n" +
      JSON.stringify({ id: "e9", taskId: "t0", kind: "rerun", summary: "shell rerun", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    JSON.stringify({ id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L4", evidenceIds: ["e0", "e8"], rerunEvidenceIds: ["e9"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false, "an L4 pass propped up by a shell rerun must fail");
  assert.ok(
    result.errors.some((e) => /evidence e9: rerun evidence must record the command/i.test(e)),
    `expected the shell rerun to be flagged, got:\n${result.errors.join("\n")}`
  );
  // The L4 pass is rejected because the cited rerun is not valid, AND the wording
  // is the G3 "cited but not a recorded/reconciled run" branch (not "cited nothing").
  assert.ok(
    result.errors.some((e) => /receipt c9: guard level L4 .*cited rerun evidence is not a recorded, reconciled run/i.test(e)),
    `expected the G3 "cited but not valid" wording, got:\n${result.errors.join("\n")}`
  );
});

// G2: the validator flags a hand-planted receipt whose rerunEvidenceIds points at
// an UNKNOWN id — even though the receipt is not an L4 pass (the global reference
// check covers ALL receipts, not just L4 pass judgments).
test("G2: a receipt with an unknown rerunEvidenceIds id is flagged by the validator (any receipt)", () => {
  // verdict "reject" so this is NOT an L4-pass row — proving the new check is a
  // general reference-integrity check, not just part of the L4-pass gate.
  const planted = plantReceipt("g2-rerun-unknown", {
    id: "c9", taskId: "t0", verdict: "reject", guardLevel: "L2", evidenceIds: [], rerunEvidenceIds: ["ghost99"], status: "rejected", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(planted.result.ok, false, "an unknown rerun reference must fail validation");
  assert.ok(
    planted.result.errors.some((e) => /receipt c9 references unknown rerun evidence "ghost99" \(broken reference\)/.test(e)),
    `expected an unknown-rerun broken-reference error, got:\n${planted.result.errors.join("\n")}`
  );
});

// G2: the validator flags a hand-planted receipt whose rerunEvidenceIds points at
// a FOREIGN task's evidence (a real evidence row, but owned by another task).
test("G2: a receipt with a foreign-task rerunEvidenceIds id is flagged by the validator", () => {
  const { ws, taskA, evA, taskB } = twoTaskWorkspace("g2-rerun-foreign");
  assert.equal(validateWorkspace(ws).ok, true, "precondition: clean two-task workspace validates");
  // Receipt for task B citing task A's evidence id in rerunEvidenceIds. verdict
  // "reject" again so the failure is purely the cross-task rerun reference.
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    readFileSync(ledger(ws, "receipts.jsonl"), "utf8") +
      JSON.stringify({ id: "c9", taskId: taskB.id, verdict: "reject", guardLevel: "L2", evidenceIds: [], rerunEvidenceIds: [evA.id], status: "rejected", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false, "a cross-task rerun reference must fail validation");
  assert.ok(
    result.errors.some((e) => new RegExp(`receipt c9 cites rerun evidence "${evA.id}" that belongs to another task \\(not task "${taskB.id}"\\)`).test(e)),
    `expected a cross-task rerun error, got:\n${result.errors.join("\n")}`
  );
});

// G3: the L4 error wording distinguishes "cited no rerun at all" from "cited a
// rerun id that is not a valid rerun row". Both are L4-pass failures, but the
// message must point the user at the right fix.
test("G3: the L4 failure message distinguishes 'no rerun cited' from 'cited but not valid'", () => {
  // A1 note: the CLI computes the level (so it can no longer be coerced to L4 with
  // an invalid rerun — it would compute DOWN). The two L4-wording branches of
  // guardLevelVerdictError now fire on the VALIDATOR side, against hand-planted
  // rows that explicitly claim guardLevel L4. (A hand-planted L4 also trips the
  // over-claim check 8c, but G3 asserts the specific rerun wording is present and
  // the OTHER rerun branch's wording is absent.)

  // Case A: hand-planted L4 pass, NO rerunEvidenceIds -> "cites no reconciled rerun".
  const noRerun = plantReceipt("g3-l4-no-rerun", {
    // cite the seed cross_family_guard (e1) so the cross-family gate passes and the
    // remaining L4 problem is purely "no rerun cited".
    id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L4", evidenceIds: ["e0", "e1"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(noRerun.result.ok, false);
  assert.ok(
    noRerun.result.errors.some((e) => /receipt c9: guard level L4 .*cites no reconciled rerun/i.test(e)),
    `no-rerun case must say nothing was cited, got:\n${noRerun.result.errors.join("\n")}`
  );
  assert.ok(
    !noRerun.result.errors.some((e) => /guard level L4 .*not a recorded, reconciled run/i.test(e)),
    "the no-rerun case must NOT use the 'cited but not valid' wording"
  );

  // Case B: hand-planted L4 pass, rerunEvidenceIds points at the seed NOTE e0
  // (cited, but not a valid rerun row) -> "cited rerun evidence is not a recorded,
  // reconciled run" (the rerun branch fires; e0 is not even a rerun kind).
  const wrongKind = plantReceipt("g3-l4-wrong-kind", {
    // cross_family_guard (e1) cited so the gate passes; the rerun points at the seed
    // NOTE e0 (cited but not a valid rerun) -> the "cited but not valid" branch.
    id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L4", evidenceIds: ["e0", "e1"], rerunEvidenceIds: ["e0"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(wrongKind.result.ok, false);
  assert.ok(
    wrongKind.result.errors.some((e) => /receipt c9: guard level L4 .*cited rerun evidence is not a recorded, reconciled run/i.test(e)),
    `wrong-kind case must say the cited rerun is not valid, got:\n${wrongKind.result.errors.join("\n")}`
  );
  assert.ok(
    !wrongKind.result.errors.some((e) => /guard level L4 .*cites no reconciled rerun/i.test(e)),
    "the wrong-kind case must NOT use the 'no rerun cited' wording"
  );
});

// ===========================================================================
// H1 (A1 L4 RECONCILIATION — the blocker this fix closes). L4 must be backed by a
// rerun that REFERENCES a real recorded run in runs.jsonl AND reconciles with it
// (same task, finished, matching exitCode + command). A self-authored rerun output
// with no recorded, reconciled run can no longer reach L4 — it tops out at L3. This
// raises the forgery cost from "type one output string" to "drive a full run flow
// whose recorded exitCode/command agree". (Still LOCAL trust: a single user can run
// start/finish with any exit, so L4 is "backed by a recorded, reconciled local run",
// not cryptographic proof — see the honest L4 marker wording.)
// ===========================================================================

// H1: the headline. A rerun referencing a real FINISHED run whose command + exitCode
// agree reaches L4 (CLI write + validator read both accept it). Per C1, this
// verifies local execution/output matching, not cross-family identity.
test("H1: a rerun referencing a reconciled finished run reaches L4 (CLI + validator)", () => {
  const ws = freshRunWorkspace("h1-reconciled-l4");
  const task = JSON.parse(runCli(["task", "create", "--title", "Reconciled L4", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "gpt guard pressed", "--reviewer", "gpt-guard", "--workspace", ws, "--json"])).evidence;
  // Drive a real run (start -> finish exit 0) then a rerun that references it.
  const { run, rerun } = reconciledRerun(ws, task.id, { output: "5 passed, 0 failed" });
  assert.equal(rerun.runId, run.id, "the rerun evidence records the runId it reconciles against");
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--evidence", `${ev.id},${xguard.id}`, "--rerun", rerun.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L4", "a reconciled rerun (run finished, exitCode + command agree) reaches L4");
  assert.equal(receipt.status, "accepted", "the reconciled L4 pass is accepted locally");
  assert.equal(receipt.familyUnverified, true, "the cross-family family remains self-declared/unverified at L4");
  assert.equal(validateWorkspace(ws).ok, true, "the workspace validates after a reconciled L4 pass");
});

// V1 (release-audit, Design Y — the external-audit P0): a rerun-only path cannot
// manufacture an L4 pass. A reconciled rerun cited with --rerun and NO cross_family_guard
// --evidence is the author re-running their OWN command (single-tool run evidence). It
// computes L2, so a plain `pass` is refused — there is no "type a command + exit + a
// matching rerun and get an accepted L4" path. L4 honestly requires a cited cross-family
// review too. (`run start/finish` RECORD a user-reported command + exit; they do not
// execute it, so a rerun alone is never independent verification.)
test("V1: a rerun-only path (no cross_family_guard) cannot reach an L4 pass — computes L2, pass refused", () => {
  const ws = freshRunWorkspace("v1-rerun-only-not-l4");
  const task = JSON.parse(runCli(["task", "create", "--title", "Rerun only", "--workspace", ws, "--json"])).task;
  const { rerun } = reconciledRerun(ws, task.id, { output: "5 passed" });
  const bad = runResult(["bin/ai-collab.js", "receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--rerun", rerun.id, "--workspace", ws]);
  assert.notEqual(bad.status, 0, "a rerun-only pass (no cross_family_guard) must be refused");
  assert.match(bad.stderr, /L2 .*cannot return "pass"|cross_family_guard|cross-family/i, "the refusal must explain a rerun alone is not a cross-family pass");
  // The same rerun-only receipt, taken as pass_with_risk, computes L2 — NOT L4.
  const risk = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--review-mode", "cross_family_rerun", "--rerun", rerun.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(risk.guardLevel, "L2", "a reconciled rerun with no cross-family review computes L2, not L4");
  assert.equal(validateWorkspace(ws).ok, true, "the L2 pass_with_risk validates");
});

// V1 (Design Y, positive): the honest L4 — a cited cross_family_guard review AND a
// reconciled rerun — reaches L4 and auto-accepts locally. C1 keeps the family
// warning because the guard row's model family is still self-declared.
test("V1: an L4 pass with BOTH a cross_family_guard review and a reconciled rerun is accepted", () => {
  const ws = freshRunWorkspace("v1-honest-l4");
  const task = JSON.parse(runCli(["task", "create", "--title", "Honest L4", "--workspace", ws, "--json"])).task;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "a different family pressed on it", "--reviewer", "gpt-guard", "--family", "openai", "--workspace", ws, "--json"])).evidence;
  const { rerun } = reconciledRerun(ws, task.id, { output: "5 passed" });
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--evidence", xguard.id, "--rerun", rerun.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L4", "cross_family_guard + a reconciled rerun computes L4");
  assert.equal(receipt.status, "accepted", "an L4 pass with cross-family + reconciled rerun auto-accepts locally");
  assert.equal(receipt.familyUnverified, true, "a backed L4 still marks the cross-family identity as self-declared/unverified");
  assert.equal(validateWorkspace(ws).ok, true, "the honest L4 pass validates");
});

test("C1: L4 proves reconciled execution, but a fake typed cross-family is still unverified and not Done", () => {
  const ws = freshRunWorkspace("c1-l4-fake-family");
  const task = JSON.parse(runCli(["task", "create", "--title", "C1 fake family", "--workspace", ws, "--json"])).task;
  // The family field is typed locally; this row can claim "openai" even if no
  // OpenAI-family reviewer actually ran. C1 keeps that warning at every level.
  const xguard = JSON.parse(runCli([
    "evidence", "add", "--task", task.id, "--kind", "cross_family_guard",
    "--summary", "typed fake family", "--reviewer", "local-claim", "--family", "openai",
    "--workspace", ws, "--json"
  ])).evidence;
  const { rerun } = reconciledRerun(ws, task.id, { output: "C1_OK" });

  const receiptText = runCli([
    "receipt", "create", "--task", task.id, "--verdict", "pass",
    "--review-mode", "cross_family_rerun", "--evidence", xguard.id, "--rerun", rerun.id,
    "--workspace", ws
  ]);
  assert.match(receiptText, /guardLevel: L4 \(computed\) \[self-declared cross-family, unverified\]/i, "L4 output must keep the family warning");
  assert.match(receiptText, /reconcil(?:es|ed) .*recorded run exec output/i, "L4 output must separately name the local rerun/reconciliation evidence");

  const receipt = ledgerRows(ws, "receipts.jsonl").find((row) => row.taskId === task.id);
  assert.equal(receipt.guardLevel, "L4", "honest L4 still computes as L4");
  assert.equal(receipt.familyUnverified, true, "the fake typed family remains unverified at L4");

  const statusText = runCli(["status", "--workspace", ws]);
  assert.match(statusText, new RegExp(`receipt ${receipt.id}: pass · L4 · accepted.*self-declared cross-family, unverified`), "status must not show the L4 receipt as clean");

  const handoff = runJson(["handoff", "create", "--workspace", ws, "--json"]);
  assert.deepEqual(handoff.model.done.map((entry) => entry.id), [], "the L4 family-unverified task must not enter Done");
  assert.deepEqual(handoff.model.unverified.map((entry) => entry.id), [task.id], "the L4 family-unverified task must route to Unverified");
  const entry = handoff.model.unverified[0];
  assert.ok(
    entry.riskNotes.some((note) => /self-declared\s*\/\s*unverified/i.test(note)),
    `handoff must carry the family warning, got:\n${entry.riskNotes.join("\n")}`
  );
  assert.ok(
    entry.riskNotes.some((note) => /reconciled rerun|recorded run exec output/i.test(note)),
    `handoff must carry the separate L4 rerun/reconciliation note, got:\n${entry.riskNotes.join("\n")}`
  );
});

// V1 (negative twin): a hand-planted L4 pass backed by a rerun but NO cross_family_guard
// must be FLAGGED — both because L4 over-claims the computed level (it is really L2) and
// because an L4 pass with no cross-family review is refused. So a top-level "accepted"
// pass cannot rest on a self-reported rerun alone and slip past a green check.
test("V1: a hand-planted L4 pass with a rerun but no cross_family_guard is flagged", () => {
  const ws = freshRunWorkspace("v1-planted-no-xfamily");
  const task = JSON.parse(runCli(["task", "create", "--title", "Planted L4", "--workspace", ws, "--json"])).task;
  const { rerun } = reconciledRerun(ws, task.id, { output: "ok" });
  writeFileSync(
    ledger(ws, "receipts.jsonl"),
    readFileSync(ledger(ws, "receipts.jsonl"), "utf8") +
      JSON.stringify({ id: "c1", taskId: task.id, verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: [], rerunEvidenceIds: [rerun.id], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws);
  assert.equal(result.ok, false, "an L4 pass with a rerun but no cross-family review must not validate");
  // Lock the READ-SIDE L4 cross-family rule SPECIFICALLY (guardLevelVerdictError's
  // L3||L4 branch): the error must name the missing cross_family_guard, not merely the
  // over-claim. Asserting this exact wording means deleting "|| guardLevel === 'L4'"
  // from the read check turns this test red (otherwise check 8c's over-claim message
  // would mask the gap and leave the branch untested).
  assert.ok(
    result.errors.some((e) => /receipt c1: guard level L4 .*cites no cross_family_guard evidence/i.test(e)),
    `expected the read-side L4 cross-family error for c1, got:\n${result.errors.join("\n")}`
  );
  // It is also caught by the over-claim check (computed L2 < stored L4) — both nets hold.
  assert.ok(
    result.errors.some((e) => /receipt c1 claims guard level "L4" but .*only support "L2"/i.test(e)),
    `expected the over-claim error too, got:\n${result.errors.join("\n")}`
  );
});

// H1 (red-team P1-B): runs.jsonl records exit 1, but the rerun self-reports exit 0.
// The reconciliation gate REFUSES it (write-time at evidence add), so the fabricated
// "verified" L4 can never be created. This is the exact hole the dispatch names.
test("H1 red-team P1-B: run finished exit 1 but rerun claims exit 0 is refused (cannot reach L4)", () => {
  const ws = freshRunWorkspace("h1-redteam-p1b");
  const task = JSON.parse(runCli(["task", "create", "--title", "Exit conflict", "--workspace", ws, "--json"])).task;
  // Record a real run that FAILED (exit 1).
  const command = commandThatPrints("failed", 1);
  const run = JSON.parse(runCli(["run", "exec", "--task", task.id, "--command", command, "--workspace", ws, "--json"])).run;
  assert.equal(run.exitCode, 1, "precondition: the recorded run exec finished exit 1");
  // A rerun that references that run but self-reports exit 0 is REFUSED at add time.
  const bad = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "totally passed, trust me", "--command", command, "--exit", "0", "--output", "failed", "--run", run.id, "--workspace", ws]);
  assert.notEqual(bad.status, 0, "a rerun whose exitCode contradicts the recorded run must be refused");
  assert.match(bad.stderr, /claims exitCode 0 but the recorded run .*finished with exitCode 1/i, "the refusal must name the exitCode conflict");
  assert.equal(ledgerRows(ws, "evidence.jsonl").length, 2, "the contradictory rerun must not be appended (only the two seed rows remain)");

  // Validator catches it too if hand-planted: a rerun row with runId + exit 0 over a
  // recorded run that finished exit 1 is flagged read-time (reconciliation check 2c).
  const ws2 = freshRunWorkspace("h1-redteam-p1b-val");
  // Patch the seed run into a legacy-shaped executed run so this test isolates the
  // exitCode mismatch branch rather than the executed:true branch.
  const runs2 = ledgerRows(ws2, "runs.jsonl").map((row) =>
    row.id === "r0"
      ? { ...row, executed: true, outputSha256: sha256Text("synthetic-seed"), outputBytes: Buffer.byteLength("synthetic-seed", "utf8"), stdoutBytes: Buffer.byteLength("synthetic-seed", "utf8"), stderrBytes: 0 }
      : row
  );
  writeFileSync(ledger(ws2, "runs.jsonl"), `${runs2.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  // r0 seed finished exit 0; plant a rerun claiming exit 1 against it -> mismatch.
  writeFileSync(
    ledger(ws2, "evidence.jsonl"),
    readFileSync(ledger(ws2, "evidence.jsonl"), "utf8") +
      JSON.stringify({ id: "e9", taskId: "t0", kind: "rerun", summary: "planted mismatch", command: "echo synthetic-seed", exitCode: 1, output: "synthetic-seed", runId: "r0", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws2);
  assert.equal(result.ok, false, "a hand-planted exitCode-mismatched rerun must fail validation");
  assert.ok(
    result.errors.some((e) => /evidence e9: rerun evidence claims exitCode 1 but the recorded run "r0" finished with exitCode 0/i.test(e)),
    `expected the reconcile exitCode error, got:\n${result.errors.join("\n")}`
  );
});

// H1: a rerun referencing a NON-EXISTENT runId cannot reach L4 (refused at add time;
// hand-planted is flagged by the validator).
test("H1: a rerun referencing a non-existent runId is refused (CLI) and flagged (validator)", () => {
  const ws = freshRunWorkspace("h1-ghost-run-cli");
  const task = JSON.parse(runCli(["task", "create", "--title", "Ghost run", "--workspace", ws, "--json"])).task;
  const bad = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "ran it", "--command", "npm test", "--exit", "0", "--output", "ok", "--run", "rGHOST", "--workspace", ws]);
  assert.notEqual(bad.status, 0, "a rerun referencing a non-existent run must be refused");
  assert.match(bad.stderr, /references run "rGHOST" but no such run exists/i, "the refusal must name the missing run");

  // Validator: hand-plant a rerun with a ghost runId.
  const ws2 = freshRunWorkspace("h1-ghost-run-val");
  writeFileSync(
    ledger(ws2, "evidence.jsonl"),
    readFileSync(ledger(ws2, "evidence.jsonl"), "utf8") +
      JSON.stringify({ id: "e9", taskId: "t0", kind: "rerun", summary: "ghost", command: "echo x", exitCode: 0, output: "ok", runId: "rGHOST", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws2);
  assert.equal(result.ok, false, "a hand-planted ghost-run rerun must fail validation");
  assert.ok(
    result.errors.some((e) => /evidence e9: rerun evidence references run "rGHOST" but no such run exists/i.test(e)),
    `expected the missing-run error, got:\n${result.errors.join("\n")}`
  );
});

// H1: a rerun referencing a run that belongs to ANOTHER task, or a run that is NOT
// finished, cannot reach L4 (both refused at add time).
test("H1: a rerun referencing another task's run, or an unfinished run, is refused", () => {
  const { ws, taskA, taskB } = twoTaskWorkspace("h1-foreign-and-unfinished");
  // Record a finished run on task A.
  JSON.parse(runCli(["run", "start", "--task", taskA.id, "--command", "npm test", "--workspace", ws, "--json"]));
  const runA = JSON.parse(runCli(["run", "finish", "--task", taskA.id, "--exit", "0", "--workspace", ws, "--json"])).run;
  // A rerun on task B that references task A's run is refused (cross-task run).
  const foreign = runResult(["bin/ai-collab.js", "evidence", "add", "--task", taskB.id, "--kind", "rerun", "--summary", "borrowed run", "--command", "npm test", "--exit", "0", "--output", "ok", "--run", runA.id, "--workspace", ws]);
  assert.notEqual(foreign.status, 0, "a rerun referencing another task's run must be refused");
  assert.match(foreign.stderr, /belongs to another task/i, "the refusal must name the cross-task run");

  // Start (but do NOT finish) a run on task B; a rerun referencing the still-running
  // run is refused (an unfinished run has no settled exitCode to reconcile against).
  const runningB = JSON.parse(runCli(["run", "start", "--task", taskB.id, "--command", "npm test", "--workspace", ws, "--json"])).run;
  const unfinished = runResult(["bin/ai-collab.js", "evidence", "add", "--task", taskB.id, "--kind", "rerun", "--summary", "still running", "--command", "npm test", "--exit", "0", "--output", "ok", "--run", runningB.id, "--workspace", ws]);
  assert.notEqual(unfinished.status, 0, "a rerun referencing an unfinished run must be refused");
  assert.match(unfinished.stderr, /is not finished/i, "the refusal must name the unfinished run");
});

// H1: a rerun whose COMMAND disagrees with the recorded run is refused (so a rerun
// cannot point at an unrelated recorded run to manufacture an L4).
test("H1: a rerun whose command does not match the recorded run is refused", () => {
  const ws = freshRunWorkspace("h1-command-mismatch");
  const task = JSON.parse(runCli(["task", "create", "--title", "Command mismatch", "--workspace", ws, "--json"])).task;
  const run = JSON.parse(runCli(["run", "exec", "--task", task.id, "--command", "printf ok", "--workspace", ws, "--json"])).run;
  const bad = runResult(["bin/ai-collab.js", "evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "different command", "--command", "pytest", "--exit", "0", "--output", "ok", "--run", run.id, "--workspace", ws]);
  assert.notEqual(bad.status, 0, "a rerun whose command differs from the recorded run must be refused");
  assert.match(bad.stderr, /command .*does not match the recorded run/i, "the refusal must name the command mismatch");
});

// H1: a self-authored rerun with NO runId (a fabricated output, no recorded run)
// tops out at L3 — it can no longer reach L4. This is the core downgrade: typing an
// output string is no longer enough. Both the CLI (computes L3) and the validator
// (flags a hand-planted L4 over-claim) enforce it.
test("H1: a self-authored rerun with no runId tops out at L3 (CLI computes down; validator flags a planted L4)", () => {
  const ws = freshRunWorkspace("h1-no-runid-l3");
  const task = JSON.parse(runCli(["task", "create", "--title", "No runId", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "author log", "--workspace", ws, "--json"])).evidence;
  const xguard = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "cross_family_guard", "--summary", "gpt guard", "--reviewer", "gpt-guard", "--workspace", ws, "--json"])).evidence;
  // A structurally-complete rerun WITHOUT --run (a self-authored output, no run).
  // It is a VALID generic rerun row (add succeeds), but it does not reconcile.
  const selfRerun = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "rerun", "--summary", "I re-ran it, here is the output", "--command", "npm test", "--exit", "0", "--output", "5 passed, 0 failed", "--workspace", ws, "--json"])).evidence;
  assert.equal(selfRerun.kind, "rerun", "the self-authored rerun row is still created (it is a valid generic rerun)");
  assert.equal(selfRerun.runId, undefined, "but it carries no runId, so it cannot back L4");
  // cross_family_rerun + the cross-family row + the unreconciled rerun -> evidence
  // caps at L3 (the cross-family row), NOT L4. The recorded level is L3, marked
  // self-declared/unverified.
  const computed = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass", "--review-mode", "cross_family_rerun", "--claimed-level", "L4", "--evidence", `${ev.id},${xguard.id}`, "--rerun", selfRerun.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(computed.guardLevel, "L3", "a self-authored rerun with no recorded, reconciled run tops out at L3, never L4");
  assert.equal(computed.familyUnverified, true, "the capped L3 is marked self-declared cross-family / unverified");

  // Validator: a hand-planted L4 pass citing that same unreconciled rerun is flagged.
  const ws2 = freshRunWorkspace("h1-no-runid-l3-val");
  // Plant a structurally-complete rerun (no runId) on t0 + an L4 receipt citing it.
  writeFileSync(
    ledger(ws2, "evidence.jsonl"),
    readFileSync(ledger(ws2, "evidence.jsonl"), "utf8") +
      JSON.stringify({ id: "e9", taskId: "t0", kind: "rerun", summary: "self-authored, no run", command: "npm test", exitCode: 0, output: "5 passed", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  writeFileSync(
    ledger(ws2, "receipts.jsonl"),
    JSON.stringify({ id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: ["e0", "e1"], rerunEvidenceIds: ["e9"], status: "accepted", createdAt: "2026-01-01T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const result = validateWorkspace(ws2);
  assert.equal(result.ok, false, "a hand-planted L4 citing an unreconciled rerun must fail");
  assert.ok(
    result.errors.some((e) => /receipt c9.*guard level "L4".*only support "L3"/i.test(e)) ||
      result.errors.some((e) => /receipt c9: guard level L4 .*cites no reconciled rerun/i.test(e)),
    `expected an L4 over-claim / no-reconciled-rerun error, got:\n${result.errors.join("\n")}`
  );
});

// H1 anti-drift: the reconciliation rule lives once in ledger.js and is shared by
// the CLI writer (evidence add + receipt create) and the validator.
test("H1: rerunRunReconcileError lives in ledger.js and is used by both CLI and validator", () => {
  const cliSrc = read(repoRoot, "src", "cli.js");
  const validateSrc = read(repoRoot, "src", "validate.js");
  const ledgerSrc = read(repoRoot, "src", "ledger.js");
  assert.match(ledgerSrc, /export function rerunRunReconcileError/, "the reconciliation rule must be defined in ledger.js");
  assert.match(cliSrc, /rerunRunReconcileError/, "the CLI writer must call the shared reconciliation rule");
  assert.match(validateSrc, /rerunRunReconcileError/, "the validator must call the shared reconciliation rule");
  // ownedRerunEvidenceIds (the L4 gate) must take the runs ledger so the gate is
  // reconciliation-aware on both sides.
  assert.match(ledgerSrc, /export function ownedRerunEvidenceIds\([^)]*runRecords/, "ownedRerunEvidenceIds must accept the runs ledger for reconciliation");
  // L4 is documented as a LOCAL-trust pass (backed by a recorded, reconciled run),
  // NOT cryptographic verification — the honest boundary must stay in the docs.
  assert.match(ledgerSrc, /recorded, reconciled local run|LOCAL trust|local-first/i, "ledger.js must keep the honest 'local trust, not cryptographic' L4 boundary");
});

// G1/structure: the structure rule lives in ledger.js and is shared by the CLI
// writer and the validator (anti-drift), same pattern as the other P2 gates.
test("G1: specialEvidenceStructureError lives in ledger.js and is used by both CLI and validator", () => {
  const cliSrc = read(repoRoot, "src", "cli.js");
  const validateSrc = read(repoRoot, "src", "validate.js");
  const ledgerSrc = read(repoRoot, "src", "ledger.js");
  assert.match(ledgerSrc, /export function specialEvidenceStructureError/, "the structure rule must be defined in ledger.js");
  assert.match(cliSrc, /specialEvidenceStructureError/, "the CLI writer must call the shared structure rule");
  assert.match(validateSrc, /specialEvidenceStructureError/, "the validator must call the shared structure rule");
  // And the deliberate non-goal is documented (no provenance/anti-forgery).
  assert.match(ledgerSrc, /cryptographic provenance/i, "ledger.js must mark cryptographic provenance as out of scope (future)");
});

// F4: owner acceptance records the actor name (from --owner <name>) and a
// timestamp as a local audit trail (a human sign-off record, NOT a signature).
test("F4: receipt accept --owner <name> records the actor and acceptedAt timestamp", () => {
  const ws = freshRunWorkspace("f4-owner-actor");
  const task = JSON.parse(runCli(["task", "create", "--title", "Owner actor", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "log", "--workspace", ws, "--json"])).evidence;
  const risk = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--guard-level", "L2", "--evidence", ev.id, "--workspace", ws, "--json"])).receipt;
  // Accept with a named actor.
  const accepted = JSON.parse(runCli(["receipt", "accept", "--id", risk.id, "--owner", "alice", "--workspace", ws, "--json"])).receipt;
  assert.equal(accepted.status, "accepted", "the risk receipt is accepted after owner sign-off");
  assert.equal(accepted.ownerAccepted, true, "the owner marker is set");
  assert.equal(accepted.acceptedBy, "alice", "the actor name is recorded for the audit trail");
  assert.match(accepted.acceptedAt, /^\d{4}-\d{2}-\d{2}T/, "an acceptedAt ISO timestamp is recorded");
  // The honest text output frames it as a local sign-off, not a signature. Run on
  // a FRESH receipt (the one above is already accepted) to capture the text form.
  const ws2 = freshRunWorkspace("f4-owner-text");
  const t2 = JSON.parse(runCli(["task", "create", "--title", "T", "--workspace", ws2, "--json"])).task;
  const e2 = JSON.parse(runCli(["evidence", "add", "--task", t2.id, "--kind", "output", "--summary", "log", "--workspace", ws2, "--json"])).evidence;
  const r2 = JSON.parse(runCli(["receipt", "create", "--task", t2.id, "--verdict", "pass_with_risk", "--guard-level", "L2", "--evidence", e2.id, "--workspace", ws2, "--json"])).receipt;
  const text2 = runCli(["receipt", "accept", "--id", r2.id, "--owner", "bob", "--workspace", ws2]);
  assert.match(text2, /local sign-off recorded.*not a cryptographic signature/i, "the copy must be honest about being a local sign-off, not a signature");
  assert.match(text2, /acceptedBy: bob/, "the text output shows the actor");
  // A bare --owner (no name) still works and records a generic actor.
  const ws3 = freshRunWorkspace("f4-owner-bare");
  const t3 = JSON.parse(runCli(["task", "create", "--title", "T", "--workspace", ws3, "--json"])).task;
  const e3 = JSON.parse(runCli(["evidence", "add", "--task", t3.id, "--kind", "output", "--summary", "log", "--workspace", ws3, "--json"])).evidence;
  const r3 = JSON.parse(runCli(["receipt", "create", "--task", t3.id, "--verdict", "pass_with_risk", "--guard-level", "L2", "--evidence", e3.id, "--workspace", ws3, "--json"])).receipt;
  const bare = JSON.parse(runCli(["receipt", "accept", "--id", r3.id, "--owner", "--workspace", ws3, "--json"])).receipt;
  assert.equal(bare.acceptedBy, "owner", "a bare --owner records a generic 'owner' actor (backward compatible)");
});

// F4: the honest framing is also present in the source/help, not just runtime —
// the tool does not pretend its local sign-off is anti-forgery.
test("F4: help/source frame owner acceptance as a local audit trail, not a signature", () => {
  const help = runCli(["help"]);
  assert.match(help, /not a cryptographic signature|audit trail/i, "help must frame owner acceptance honestly");
  const cliSrc = read(repoRoot, "src", "cli.js");
  assert.match(cliSrc, /not a cryptographic signature|NO anti-forgery/i, "the source must state it makes no anti-forgery claim");
});

// --- shared-logic anti-drift: the writer and validator use the SAME predicates
test("P2: the verdict x guardLevel rule lives in ledger.js and is used by both CLI and validator", () => {
  const cliSrc = read(repoRoot, "src", "cli.js");
  const validateSrc = read(repoRoot, "src", "validate.js");
  const ledgerSrc = read(repoRoot, "src", "ledger.js");
  // The rule is defined once in ledger.js.
  assert.match(ledgerSrc, /export function guardLevelVerdictError/, "the consistency rule must be defined in ledger.js");
  assert.match(ledgerSrc, /export function ownerAcceptanceError/, "the owner-acceptance rule must be defined in ledger.js");
  // P2 evidence-gate: the cross-family + rerun kind filters are defined once.
  assert.match(ledgerSrc, /export function ownedCrossFamilyGuardEvidenceIds/, "the cross-family evidence filter must be defined in ledger.js");
  assert.match(ledgerSrc, /export function ownedRerunEvidenceIds/, "the rerun evidence filter must be defined in ledger.js");
  // Both layers import and call them (not a re-implemented copy).
  assert.match(cliSrc, /guardLevelVerdictError/, "the CLI writer must call the shared consistency rule");
  assert.match(validateSrc, /guardLevelVerdictError/, "the validator must call the shared consistency rule");
  assert.match(validateSrc, /ownerAcceptanceError/, "the validator must call the shared owner-acceptance rule");
  // F3: both the writer and the validator key the L3 gate off the SAME cross-family
  // evidence filter, so write-time and read-time cannot drift on what counts.
  assert.match(cliSrc, /ownedCrossFamilyGuardEvidenceIds/, "the CLI writer must use the shared cross-family evidence filter");
  assert.match(validateSrc, /ownedCrossFamilyGuardEvidenceIds/, "the validator must use the shared cross-family evidence filter");
});

// --- help / guide surface the P2 surface ------------------------------------
test("P2: help and guide document guard levels and owner acceptance", () => {
  const help = runCli(["help"]);
  assert.match(help, /--guard-level/i, "help must list --guard-level on receipt create");
  assert.match(help, /receipt accept .*--owner/i, "help must list receipt accept --owner");
  assert.match(help, /L0|L4/, "help must explain the guard levels");
  const guide = runCli(["guide"]);
  assert.match(guide, /guard level|guard-level/i, "guide must mention guard levels");
  assert.match(guide, /owner/i, "guide must mention owner acceptance");
});

// B5-2: --help leads with a term-light "most common commands" header (init /
// bootstrap / status) so a non-technical reader's first screen is not a term wall,
// and the full L0-L4 ladder is SUNK behind `--help levels` / `help levels` instead
// of being dumped in the middle of the main reference. The main --help keeps a short
// plain-language pointer (and still satisfies the other help contracts).
test("B5-2: --help opens term-light (init/bootstrap/status) and sinks the L0-L4 ladder to `--help levels`", () => {
  const help = runCli(["--help"]);

  // (a) Term-light header up top: the three starter commands each with a one-liner,
  //     appearing before the dense Usage block.
  const headerCut = help.indexOf("Usage:");
  assert.ok(headerCut > 0, "--help must still have a Usage section");
  const header = help.slice(0, headerCut);
  assert.match(header, /New here\?/i, "the term-light header must lead the help screen");
  assert.match(header, /^\s*init\b/im, "the header must name init");
  assert.match(header, /^\s*bootstrap\b/im, "the header must name bootstrap");
  assert.match(header, /^\s*status\b/im, "the header must name status");

  // (b) The FULL ladder detail is NOT in the main --help (the L2.5 weak-L3 row and the
  //     "summary only -> insufficient_evidence only" line are part of the sunk reference).
  assert.doesNotMatch(help, /summary only\s*->\s*insufficient_evidence only/i, "the full ladder must be sunk out of the main --help");
  assert.doesNotMatch(help, /weak L3/i, "the L2.5 weak-L3 ladder detail must be sunk out of the main --help");
  // ...but the main --help still points the reader at where the ladder now lives.
  assert.match(help, /--help levels/, "the main --help must point at `--help levels`");

  // (c) `--help levels` AND `help levels` print the full ladder (plain summary + the
  //     L0..L4 rows + the family-honesty caveat).
  for (const invocation of [["--help", "levels"], ["help", "levels"]]) {
    const levels = runCli(invocation);
    assert.match(levels, /Guard levels \(L0-L4\)/, `${invocation.join(" ")} must print the guard-level reference`);
    assert.match(levels, /summary only\s*->\s*insufficient_evidence only/i, `${invocation.join(" ")} must include the L0 ladder row`);
    assert.match(levels, /L4\s+cross-family review AND a reviewer rerun/i, `${invocation.join(" ")} must include the L4 ladder row`);
    assert.match(levels, /SELF-DECLARED/, `${invocation.join(" ")} must keep the family-honesty caveat`);
    // It is the focused reference, not the whole command dump: the run-layer usage
    // lines do not belong on the levels page.
    assert.doesNotMatch(levels, /ai-collab init --target <dir>/, `${invocation.join(" ")} must be the focused levels page, not the full command list`);
  }
});

// B5-3: `status` ends with a single, state-derived "Next step" line whose suggested
// command is a REAL audited command, and each per-task receipt line carries a
// plain-language gloss of its guard level. Both appear in text and --json.
test("B5-3: status prints a state-aware Next step (real command) and a plain-language level gloss", () => {
  // (a) A brand-new / seed-only workspace -> Next step nudges bootstrap / task create.
  const fresh = freshRunWorkspace("b53-nextstep-fresh");
  const freshText = runCli(["status", "--workspace", fresh]);
  assert.match(freshText, /Next step:/, "status must print a Next step line");
  assert.match(freshText, /No work of your own yet/i, "a seed-only workspace's Next step says there is no own work yet");
  assert.match(freshText, /\bai-collab bootstrap --yes/, "the seed-only Next step suggests the real bootstrap command");
  // The shipped seed receipt (L3) line carries a plain-language gloss.
  assert.match(freshText, /\(L3: cross-family pass/i, "a per-task L3 line must carry the plain-language gloss");

  // --json carries the same structured nextStep.
  const freshJson = JSON.parse(runCli(["status", "--workspace", fresh, "--json"]));
  assert.ok(freshJson.nextStep && typeof freshJson.nextStep.text === "string", "status --json carries nextStep.text");
  assert.match(freshJson.nextStep.command, /bootstrap --yes/, "status --json nextStep.command is the real bootstrap command");

  // (b) An own task with output evidence + a pending pass_with_risk receipt -> Next
  //     step points at the real `receipt accept` with the actual receipt id, and the
  //     L2 line is glossed as a single-tool, accept-with-risk check.
  const ws = freshRunWorkspace("b53-nextstep-pending");
  const task = JSON.parse(runCli(["task", "create", "--title", "Wire export", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "ran build", "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--review-mode", "self", "--evidence", ev.id, "--workspace", ws, "--json"])).receipt;
  assert.equal(receipt.guardLevel, "L2", "precondition: a single-tool output-evidence receipt computes L2");

  const text = runCli(["status", "--workspace", ws]);
  assert.match(text, new RegExp(`Next step:.*receipt ${receipt.id}.*pending`, "i"), "the Next step names the pending receipt");
  assert.match(text, new RegExp(`ai-collab receipt accept --id ${receipt.id} --owner you`), "the Next step suggests the real receipt accept command with the actual id");
  assert.match(text, /\(L2: single-tool check/i, "the per-task L2 line carries the single-tool plain-language gloss");

  const json = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  assert.match(json.nextStep.command, new RegExp(`receipt accept --id ${receipt.id}`), "status --json nextStep.command is the real receipt accept command");
});

// B5-4: the bootstrap report's closing "Next:" points at EXISTING audited commands
// with the real id filled in (never an invented flag like --save-safe). A pending
// pass_with_risk -> receipt accept <id>; a proposed lesson -> learning confirm <id>.
test("B5-4: bootstrap Next points at real audited commands with the actual id", () => {
  // A VERIFY case: an own task with a pending pass_with_risk receipt.
  const ws = freshRunWorkspace("b54-next-verify");
  const task = JSON.parse(runCli(["task", "create", "--title", "Add export", "--workspace", ws, "--json"])).task;
  const ev = JSON.parse(runCli(["evidence", "add", "--task", task.id, "--kind", "output", "--summary", "ran build", "--workspace", ws, "--json"])).evidence;
  const receipt = JSON.parse(runCli(["receipt", "create", "--task", task.id, "--verdict", "pass_with_risk", "--review-mode", "self", "--evidence", ev.id, "--workspace", ws, "--json"])).receipt;

  const report = runCli(["bootstrap", "--yes", "--workspace", ws]);
  assert.match(report, /^Next:/m, "bootstrap report ends with a Next: line");
  assert.match(report, new RegExp(`ai-collab receipt accept --id ${receipt.id} --owner you`), "the bootstrap Next points at the real receipt accept command with the actual id");
  // It must NOT invent a write subcommand.
  assert.doesNotMatch(report, /--save-safe/, "bootstrap must not invent a --save-safe write path");

  // Accept the receipt, add a handoff draft, then propose a lesson -> Next becomes
  // the real `learning confirm <id>`.
  runCli(["receipt", "accept", "--id", receipt.id, "--owner", "you", "--workspace", ws]);
  runCli(["task", "update", "--task", task.id, "--status", "done", "--workspace", ws]);
  runCli(["handoff", "create", "--workspace", ws]);
  const lesson = JSON.parse(runCli(["learning", "add", "--type", "harvest", "--content", "acceptance before implementation", "--task", task.id, "--workspace", ws, "--json"])).learning;
  const report2 = runCli(["bootstrap", "--yes", "--workspace", ws]);
  assert.match(report2, new RegExp(`ai-collab learning confirm --id ${lesson.id}`), "with a proposed lesson, the bootstrap Next points at the real learning confirm command");
});

// B5-6: the concurrency limitation is documented honestly AND the documented backstop
// is real — `check` actually catches a duplicate ledger id (the thing that can happen
// under concurrent writes) and fails loudly with a pointable file + id.
test("B5-6: KNOWN_LIMITATIONS documents the duplicate-id concurrency limit and `check` really catches it", () => {
  // (a) The doc exists, ships (package.json files), and names the real limit + backstop.
  const limitations = read(repoRoot, "KNOWN_LIMITATIONS.md");
  assert.match(limitations, /duplicate id/i, "KNOWN_LIMITATIONS must describe the duplicate-id limit");
  assert.match(limitations, /concurrent/i, "KNOWN_LIMITATIONS must frame it as a concurrent-write limit");
  assert.match(limitations, /check/, "KNOWN_LIMITATIONS must name `check` as the backstop");
  const pkg = JSON.parse(read(repoRoot, "package.json"));
  assert.ok(pkg.files.includes("KNOWN_LIMITATIONS.md"), "KNOWN_LIMITATIONS.md must be in the published files list");

  // (b) The backstop is real: a workspace with a duplicated ledger id fails `check`
  //     with the exact pointable message the doc promises.
  const ws = freshRunWorkspace("b56-duplicate-id");
  runCli(["task", "create", "--title", "Task one", "--workspace", ws]);
  const tasksFile = ledger(ws, "tasks.jsonl");
  const rows = readFileSync(tasksFile, "utf8").trim().split("\n");
  const t1 = rows.map((line) => JSON.parse(line)).find((r) => r.id === "t1");
  // Simulate a concurrent-write collision: a second row reusing id t1.
  appendFileSync(tasksFile, `\n${JSON.stringify({ ...t1, title: "concurrent duplicate" })}\n`, "utf8");
  const checkResult = runResult(["bin/ai-collab.js", "check", "--workspace", ws]);
  assert.notEqual(checkResult.status, 0, "check must fail on a duplicate ledger id");
  assert.match(
    checkResult.stdout + checkResult.stderr,
    /ledger tasks\.jsonl has duplicate id "t1"/,
    "check must report the duplicate id with a pointable file + id"
  );
});

// =====================================================================
// P4: the learning ledger (make growth visible). A task captures at most one
// reusable lesson (harvest) and one standing preference (profile); each lands
// "proposed" and the human keeps it (confirm), rewords-and-keeps it (edit), or
// discards it (drop) — the same discipline the profile-candidate buffer uses.
// Only confirmed/edited rows graduate; status echoes back the ONE preference the
// user most recently confirmed, so the tool feels like it is learning how they
// work without making them maintain a system.
// =====================================================================

// Read the single learning ledger as parsed rows (small wrapper over ledgerRows).
function learningRows(ws) {
  return ledgerRows(ws, "learning-ledger.jsonl");
}

test("P4: learning add (harvest / profile) appends a proposed row to the learning ledger", () => {
  const ws = freshRunWorkspace("p4-add");
  // harvest type.
  const h = JSON.parse(runCli(["learning", "add", "--type", "harvest", "--content", "When the build flakes, clear the cache first", "--workspace", ws, "--json"])).learning;
  assert.equal(h.type, "harvest");
  assert.equal(h.status, "proposed", "a freshly captured lesson is an un-reviewed guess");
  assert.equal(h.content, "When the build flakes, clear the cache first");
  assert.ok(h.id.startsWith("l"), "learning ids use the l prefix");
  assert.equal(h.taskId, undefined, "a lesson need not belong to a task");
  // profile type.
  const p = JSON.parse(runCli(["learning", "add", "--type", "profile", "--content", "Prefer conclusion-first answers with evidence line numbers", "--workspace", ws, "--json"])).learning;
  assert.equal(p.type, "profile");
  assert.equal(p.status, "proposed");
  // Both landed on disk after the seed (l0), in order.
  const rows = learningRows(ws);
  assert.equal(rows.length, 3, "seed l0 + the two added rows");
  assert.deepEqual(rows.map((r) => r.id), ["l0", h.id, p.id]);
  // Field order on disk mirrors the seed shape so a hand read stays predictable.
  assert.deepEqual(Object.keys(rows[1]), ["id", "type", "content", "status", "createdAt"]);
});

test("P4: learning add --task binds to an existing task and rejects an unknown task", () => {
  const ws = freshRunWorkspace("p4-add-task");
  const task = JSON.parse(runCli(["task", "create", "--title", "Real task", "--workspace", ws, "--json"])).task;
  const bound = JSON.parse(runCli(["learning", "add", "--type", "harvest", "--content", "lesson from this task", "--task", task.id, "--workspace", ws, "--json"])).learning;
  assert.equal(bound.taskId, task.id, "a --task learning row records its binding");
  // taskId appears in the documented position (after id) when present.
  const rows = learningRows(ws);
  const onDisk = rows.find((r) => r.id === bound.id);
  assert.deepEqual(Object.keys(onDisk), ["id", "taskId", "type", "content", "status", "createdAt"]);
  // An unknown task is refused at write time and nothing is appended.
  const before = learningRows(ws).length;
  const bad = runResult(["bin/ai-collab.js", "learning", "add", "--type", "harvest", "--content", "x", "--task", "nope", "--workspace", ws]);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /not found/i);
  assert.equal(learningRows(ws).length, before, "a learning row bound to a non-existent task must not be appended");
});

test("P4: confirm / edit / drop move a candidate through its four states", () => {
  const ws = freshRunWorkspace("p4-states");
  const row = JSON.parse(runCli(["learning", "add", "--type", "profile", "--content", "original wording", "--workspace", ws, "--json"])).learning;
  assert.equal(row.status, "proposed");

  // confirm -> confirmed (kept as-is); patches the SAME row in place (no append).
  const before = learningRows(ws).length;
  const confirmed = JSON.parse(runCli(["learning", "confirm", "--id", row.id, "--workspace", ws, "--json"])).learning;
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.id, row.id, "confirm patches the same row, not a new one");
  assert.equal(learningRows(ws).length, before, "confirm must not add a row");

  // edit -> edited AND the new wording is what is stored (the edited line graduates).
  const edited = JSON.parse(runCli(["learning", "edit", "--id", row.id, "--content", "reworded wording", "--workspace", ws, "--json"])).learning;
  assert.equal(edited.status, "edited");
  assert.equal(edited.content, "reworded wording", "edit rewords the candidate");
  assert.equal(learningRows(ws).length, before, "edit must not add a row");

  // drop -> dropped (discarded, kept on the record).
  const dropped = JSON.parse(runCli(["learning", "drop", "--id", row.id, "--workspace", ws, "--json"])).learning;
  assert.equal(dropped.status, "dropped");
  assert.equal(learningRows(ws).length, before, "drop must not add a row");

  // The on-disk row reflects the final state, and the workspace still validates.
  const finalRow = learningRows(ws).find((r) => r.id === row.id);
  assert.equal(finalRow.status, "dropped");
  assert.equal(finalRow.content, "reworded wording");
  assert.deepEqual(validateWorkspace(ws).errors, [], "the ledger stays valid through every state flip");
});

test("P4: only confirmed/edited graduate — status echoes a kept preference, proposed/dropped do not", () => {
  const ws = freshRunWorkspace("p4-graduate");
  // Baseline: the seed ships ONE proposed row, which does NOT qualify, so a fresh
  // workspace shows no carry-forward line and a null carriedPreference.
  const baseText = runCli(["status", "--workspace", ws]);
  assert.doesNotMatch(baseText, /Carrying forward the preference/, "a proposed-only ledger shows no carry-forward line");
  const basePayload = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  assert.equal(basePayload.carriedPreference, null, "no confirmed preference yet -> null");

  // A merely proposed preference still does not surface.
  const prof = JSON.parse(runCli(["learning", "add", "--type", "profile", "--content", "Push back when I am wrong", "--workspace", ws, "--json"])).learning;
  assert.equal(JSON.parse(runCli(["status", "--workspace", ws, "--json"])).carriedPreference, null, "a proposed preference does not graduate");

  // Confirm it -> now status echoes exactly this one preference.
  runCli(["learning", "confirm", "--id", prof.id, "--workspace", ws]);
  const text = runCli(["status", "--workspace", ws]);
  assert.match(text, /Carrying forward the preference you confirmed: Push back when I am wrong/, "a confirmed profile preference is echoed back");
  const payload = JSON.parse(runCli(["status", "--workspace", ws, "--json"]));
  assert.equal(payload.carriedPreference.content, "Push back when I am wrong");
  assert.equal(payload.carriedPreference.status, "confirmed");

  // Dropping it removes it from the recall again (dropped never graduates).
  runCli(["learning", "drop", "--id", prof.id, "--workspace", ws]);
  assert.doesNotMatch(runCli(["status", "--workspace", ws]), /Carrying forward the preference/, "a dropped preference is no longer echoed");
  assert.equal(JSON.parse(runCli(["status", "--workspace", ws, "--json"])).carriedPreference, null);
});

test("P4: recall shows ONE preference (the most recently kept), not a dump; harvest rows never surface as a preference", () => {
  const ws = freshRunWorkspace("p4-recall-one");
  // Two confirmed profile preferences: the recall must show only the LATEST.
  const first = JSON.parse(runCli(["learning", "add", "--type", "profile", "--content", "first preference", "--workspace", ws, "--json"])).learning;
  const second = JSON.parse(runCli(["learning", "add", "--type", "profile", "--content", "second preference", "--workspace", ws, "--json"])).learning;
  runCli(["learning", "confirm", "--id", first.id, "--workspace", ws]);
  runCli(["learning", "confirm", "--id", second.id, "--workspace", ws]);
  // A confirmed HARVEST row is NOT a preference and must not hijack the recall.
  const harvest = JSON.parse(runCli(["learning", "add", "--type", "harvest", "--content", "a kept lesson, not a preference", "--workspace", ws, "--json"])).learning;
  runCli(["learning", "confirm", "--id", harvest.id, "--workspace", ws]);

  const text = runCli(["status", "--workspace", ws]);
  // Exactly one carry-forward line, and it is the latest profile preference.
  const matches = text.match(/Carrying forward the preference you confirmed:/g) ?? [];
  assert.equal(matches.length, 1, "the recall is a single line, not a dump of every preference");
  assert.match(text, /Carrying forward the preference you confirmed: second preference/);
  assert.doesNotMatch(text, /first preference/, "the recall shows only the most recent kept preference");
  // A harvest row must never pose as a PREFERENCE. status now ALSO echoes a kept
  // harvest lesson on its OWN line (a separate getitback recall), so the harvest
  // content can legitimately appear — but never on the preference carry-forward
  // line. Assert it is not attached to the "preference you confirmed" prefix
  // (rather than absent entirely), which is the real invariant this guards.
  assert.doesNotMatch(
    text,
    /Carrying forward the preference you confirmed:[^\n]*a kept lesson, not a preference/,
    "a harvest row is never echoed as a preference"
  );
  // The kept harvest lesson DOES surface, but on the dedicated harvest line.
  assert.match(
    text,
    /Most recent harvest lesson you kept: a kept lesson, not a preference/,
    "a confirmed harvest lesson is echoed on its own line"
  );
  // Dropping the latest falls back to the earlier confirmed preference.
  runCli(["learning", "drop", "--id", second.id, "--workspace", ws]);
  assert.match(runCli(["status", "--workspace", ws]), /Carrying forward the preference you confirmed: first preference/, "after dropping the latest, recall falls back to the earlier kept preference");
});

test("P4: learning add rejects an illegal type and a missing content (CLI refuses, nothing written)", () => {
  const ws = freshRunWorkspace("p4-reject");
  const before = learningRows(ws).length;
  // Illegal type.
  const badType = runResult(["bin/ai-collab.js", "learning", "add", "--type", "bogus", "--content", "x", "--workspace", ws]);
  assert.notEqual(badType.status, 0);
  assert.match(badType.stderr, /type must be one of: harvest, profile/i);
  // Missing content.
  const noContent = runResult(["bin/ai-collab.js", "learning", "add", "--type", "profile", "--workspace", ws]);
  assert.notEqual(noContent.status, 0);
  assert.match(noContent.stderr, /Missing --content/i);
  // Missing type.
  const noType = runResult(["bin/ai-collab.js", "learning", "add", "--content", "x", "--workspace", ws]);
  assert.notEqual(noType.status, 0);
  assert.match(noType.stderr, /Missing --type/i);
  // None of the refused adds were written.
  assert.equal(learningRows(ws).length, before, "refused learning adds must not append");
});

test("P4: confirm / edit / drop reject an unknown id, and edit requires new content", () => {
  const ws = freshRunWorkspace("p4-reject-flip");
  for (const action of ["confirm", "drop"]) {
    const bad = runResult(["bin/ai-collab.js", "learning", action, "--id", "zzz", "--workspace", ws]);
    assert.notEqual(bad.status, 0, `${action} unknown id must fail`);
    assert.match(bad.stderr, /not found/i);
  }
  const row = JSON.parse(runCli(["learning", "add", "--type", "profile", "--content", "p", "--workspace", ws, "--json"])).learning;
  const editNoContent = runResult(["bin/ai-collab.js", "learning", "edit", "--id", row.id, "--workspace", ws]);
  assert.notEqual(editNoContent.status, 0, "edit with no new wording must fail");
  assert.match(editNoContent.stderr, /Missing --content/i);
  // An unknown learning sub-action is rejected with the usage hint.
  const badAction = runResult(["bin/ai-collab.js", "learning", "frobnicate", "--workspace", ws]);
  assert.notEqual(badAction.status, 0);
  assert.match(badAction.stderr, /Unknown learning command/i);
});

test("P4: the validator flags a hand-edited learning row that drifts off the enum (shape + orphan)", () => {
  // Illegal status: validator catches it with a pointable error.
  const wsStatus = freshRunWorkspace("p4-val-status");
  writeFileSync(
    ledger(wsStatus, "learning-ledger.jsonl"),
    JSON.stringify({ id: "lX", type: "profile", content: "bad", status: "approved", createdAt: "2026-01-02T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  const statusResult = validateWorkspace(wsStatus);
  assert.equal(statusResult.ok, false);
  assert.ok(
    statusResult.errors.some((e) => /learning-ledger\.jsonl learning lX:.*status must be one of/i.test(e)),
    `validator must flag an illegal learning status, got:\n${statusResult.errors.join("\n")}`
  );

  // Illegal type.
  const wsType = freshRunWorkspace("p4-val-type");
  writeFileSync(
    ledger(wsType, "learning-ledger.jsonl"),
    JSON.stringify({ id: "lY", type: "musing", content: "bad", status: "proposed", createdAt: "2026-01-02T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  assert.ok(
    validateWorkspace(wsType).errors.some((e) => /learning-ledger\.jsonl learning lY:.*type must be one of/i.test(e)),
    "validator must flag an illegal learning type"
  );

  // Empty content.
  const wsContent = freshRunWorkspace("p4-val-content");
  writeFileSync(
    ledger(wsContent, "learning-ledger.jsonl"),
    JSON.stringify({ id: "lZ", type: "harvest", content: "   ", status: "proposed", createdAt: "2026-01-02T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  assert.ok(
    validateWorkspace(wsContent).errors.some((e) => /learning-ledger\.jsonl learning lZ:.*non-empty content/i.test(e)),
    "validator must flag empty learning content"
  );

  // Missing createdAt: createdAt is part of the row shape every writer stamps, so a
  // hand-edited row that drops it is malformed and must be flagged with a pointable error.
  const wsCreatedAt = freshRunWorkspace("p4-val-createdat");
  writeFileSync(
    ledger(wsCreatedAt, "learning-ledger.jsonl"),
    JSON.stringify({ id: "lC", type: "harvest", content: "lesson", status: "proposed" }) + "\n",
    "utf8"
  );
  assert.ok(
    validateWorkspace(wsCreatedAt).errors.some((e) => /learning-ledger\.jsonl learning lC:.*non-empty string createdAt/i.test(e)),
    "validator must flag a learning row missing createdAt"
  );

  // Orphan taskId (present but points at no task): flagged like an orphan evidence row.
  const wsOrphan = freshRunWorkspace("p4-val-orphan");
  writeFileSync(
    ledger(wsOrphan, "learning-ledger.jsonl"),
    JSON.stringify({ id: "lO", taskId: "tNope", type: "harvest", content: "lesson", status: "proposed", createdAt: "2026-01-02T00:00:00.000Z" }) + "\n",
    "utf8"
  );
  assert.ok(
    validateWorkspace(wsOrphan).errors.some((e) => /learning-ledger\.jsonl learning lO references unknown task "tNope" \(orphan\)/.test(e)),
    "validator must flag a learning row bound to a non-existent task"
  );
});

test("P4: the learning shape rule lives in ledger.js and is used by both the CLI writer and the validator", () => {
  const ledgerSrc = read(repoRoot, "src", "ledger.js");
  const cliSrc = read(repoRoot, "src", "cli.js");
  const validateSrc = read(repoRoot, "src", "validate.js");
  // The rule is defined once in the shared module...
  assert.match(ledgerSrc, /export function learningRecordError/, "the learning shape rule must be defined in ledger.js");
  assert.match(ledgerSrc, /export function latestConfirmedProfileLearning/, "the recall selector must be defined in ledger.js");
  // ...and both the writer and the reader call it (not a re-implemented copy).
  assert.match(cliSrc, /learningRecordError/, "the CLI writer must call the shared learning shape rule");
  assert.match(validateSrc, /learningRecordError/, "the validator must call the shared learning shape rule");
  assert.match(cliSrc, /latestConfirmedProfileLearning/, "the status command must use the shared recall selector");
});

test("P4: help and guide document the learning ledger commands and the keep/echo loop", () => {
  const help = runCli(["help"]);
  assert.match(help, /learning add --type <harvest\|profile>/i, "help must list learning add");
  assert.match(help, /learning confirm --id/i, "help must list learning confirm");
  assert.match(help, /learning edit --id/i, "help must list learning edit");
  assert.match(help, /learning drop --id/i, "help must list learning drop");
  assert.match(help, /confirmed\/edited[\s\S]*graduate/i, "help must state only confirmed/edited graduate");
  const guide = runCli(["guide"]);
  assert.match(guide, /learning add/i, "guide must mention the learning loop");
  assert.match(guide, /confirm|edit|drop/i, "guide must mention the keep/discard actions");
});

// --- P3: tool-native adaptation tiers (rules / skills / hooks) --------------
//
// These lock the third, opt-in hook tier's safety contract: it is OFF by default,
// it is Claude-Code-only, it merges (never clobbers) an existing settings.json, it
// is idempotent, and — critically — the generated settings never write the
// standard hooks-dir path literal that the project's own privacy scanner forbids,
// so a user who enables it and scans their own project still passes.

test("P3: adapters install does NOT touch hooks by default (opt-in tier stays off)", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-hooks-off-"));
  const output = runCli(["adapters", "install", "--target", target, "--tool", "claude"]);
  assert.match(output, /Hooks: not enabled/i, "default install must report hooks not enabled");
  // No .claude/settings.json may be created when hooks were not requested.
  assert.equal(existsSync(path.join(target, ".claude", "settings.json")), false, "default install must not write a settings.json");
});

test("P3: --enable-hooks only applies to the claude tool and skips others with a reason", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-hooks-nonclaude-"));
  const result = runResult(["bin/ai-collab.js", "adapters", "install", "--target", target, "--tool", "cursor", "--enable-hooks"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Hooks: requested but skipped/i, "non-claude install must skip hooks");
  assert.match(result.stdout, /Claude Code only/i, "skip reason must say Claude Code only");
  assert.equal(existsSync(path.join(target, ".claude", "settings.json")), false, "non-claude install must not write a settings.json");
});

test("P3: --enable-hooks writes a local Stop hook + a one-time SessionStart hook, no global hook, no hooks-dir literal", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-hooks-on-"));
  const output = runCli(["adapters", "install", "--target", target, "--tool", "claude", "--enable-hooks"]);
  assert.match(output, /project-local Claude Code hooks/i, "must announce project-local Claude Code hooks");
  assert.match(output, /Stop hook/i, "must announce the Stop hook");
  assert.match(output, /SessionStart hook/i, "must announce the SessionStart hook");
  assert.match(output, /no global hook/i, "must promise no global hook");
  assert.match(output, /Uninstall:/i, "must tell the user how to uninstall");

  const settingsPath = path.join(target, ".claude", "settings.json");
  assert.ok(existsSync(settingsPath), "settings.json must be created");
  const settings = JSON.parse(read(settingsPath));

  // Stop hook (receipt reminder) — unchanged behavior.
  const stop = settings.hooks.Stop;
  assert.ok(Array.isArray(stop) && stop.length === 1, "exactly one Stop entry");
  assert.equal(stop[0].matcher, "ai-collab-receipt-reminder", "Stop entry must carry the removable marker");
  const command = stop[0].hooks[0].command;
  assert.match(command, /ai-collab receipt create/, "the Stop hook must remind about receipt create");
  assert.match(command, /exit 0/, "the Stop hook must be non-blocking (exit 0)");

  // SessionStart hook (one-time onboarding) — new behavior.
  const sessionStart = settings.hooks.SessionStart;
  assert.ok(Array.isArray(sessionStart) && sessionStart.length === 1, "exactly one SessionStart entry");
  assert.equal(sessionStart[0].matcher, "startup", "SessionStart matcher must be the 'startup' source value (new sessions only, not resume/clear/compact)");
  const ssCommand = sessionStart[0].hooks[0].command;
  assert.match(ssCommand, /\[ai-collab first-run\]/, "SessionStart command must carry the [ai-collab first-run] identity/directive marker");
  assert.match(ssCommand, /\$CLAUDE_PROJECT_DIR/, "SessionStart command must anchor its marker path on $CLAUDE_PROJECT_DIR, not a relative path");
  assert.match(ssCommand, /\.ai-collab-firstrun-done/, "SessionStart command must use the one-time marker file");
  assert.match(ssCommand, /printf /, "SessionStart command must emit the directive on stdout via printf (stdout is injected into context)");
  assert.doesNotMatch(ssCommand, /1>&2|2>&1.*printf/, "SessionStart directive must go to stdout, not stderr");
  assert.match(ssCommand, /exit 0/, "the SessionStart hook must exit 0 so its stdout is processed");
  // Directive must be English-only (no stray Chinese) so the privacy scan passes.
  assert.doesNotMatch(ssCommand, /[一-鿿]/, "SessionStart directive must contain no Chinese (privacy scan reads settings.json)");

  // Privacy contract: the generated settings must NOT contain the standard
  // hooks-dir path literal the project's privacy scanner forbids in user files.
  const raw = read(settingsPath);
  assert.doesNotMatch(raw, /\.claude\/hooks/i, "generated settings must not write the forbidden hooks-dir path literal");
  // And the install must not have created a separate script under that dir.
  assert.equal(existsSync(path.join(target, ".claude", "hooks")), false, "no separate hooks-dir script should be written");
});

test("P3: --enable-hooks merges into an existing settings.json without clobbering, and is idempotent", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-hooks-merge-"));
  mkdirSync(path.join(target, ".claude"), { recursive: true });
  const settingsPath = path.join(target, ".claude", "settings.json");
  const seed = {
    model: "opus",
    hooks: { Stop: [{ matcher: "user-existing", hooks: [{ type: "command", command: "echo keep-me" }] }] }
  };
  writeFileSync(settingsPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");

  const first = runCli(["adapters", "install", "--target", target, "--tool", "claude", "--enable-hooks", "--force"]);
  assert.match(first, /merge into/i, "an existing settings.json must be merged, not created");
  const merged = JSON.parse(read(settingsPath));
  assert.equal(merged.model, "opus", "user's other keys must be preserved");
  const markers = merged.hooks.Stop.map((entry) => entry.matcher);
  assert.ok(markers.includes("user-existing"), "user's existing Stop hook must survive the merge");
  assert.ok(markers.includes("ai-collab-receipt-reminder"), "our marked Stop hook must be appended");
  // Our SessionStart hook must also be appended alongside (the seed had none).
  const ssMarkers = (merged.hooks.SessionStart || []).map((entry) => entry.matcher);
  assert.ok(ssMarkers.includes("startup"), "our SessionStart hook must be appended on merge");
  const ssOurs = (merged.hooks.SessionStart || []).filter((e) => (e.hooks || []).some((h) => (h.command || "").includes("[ai-collab first-run]")));
  assert.equal(ssOurs.length, 1, "exactly one of our SessionStart entries after a fresh merge");

  // Idempotent: a second --enable-hooks run does not duplicate EITHER entry.
  const second = runCli(["adapters", "install", "--target", target, "--tool", "claude", "--enable-hooks", "--force"]);
  assert.match(second, /already present/i, "a repeat run must report the hooks are already present");
  const after = JSON.parse(read(settingsPath));
  const ours = after.hooks.Stop.filter((entry) => entry.matcher === "ai-collab-receipt-reminder");
  assert.equal(ours.length, 1, "the marked Stop entry must appear exactly once after a repeat run");
  const ssAfter = (after.hooks.SessionStart || []).filter((e) => (e.hooks || []).some((h) => (h.command || "").includes("[ai-collab first-run]")));
  assert.equal(ssAfter.length, 1, "our SessionStart entry must appear exactly once after a repeat run");
  assert.ok((after.hooks.SessionStart || []).map((e) => e.matcher).includes("startup"), "SessionStart matcher stays 'startup' after repeat run");
});

test("P3: --enable-hooks tops up a SessionStart hook when only our Stop hook is already present (and does not duplicate Stop)", () => {
  // Mirrors a user who installed an EARLIER version that only wrote the Stop hook:
  // a fresh --enable-hooks must add the SessionStart hook without re-adding Stop.
  const target = mkdtempSync(path.join(tmpdir(), "aicos-hooks-topup-"));
  mkdirSync(path.join(target, ".claude"), { recursive: true });
  const settingsPath = path.join(target, ".claude", "settings.json");
  const seed = {
    hooks: {
      Stop: [{ matcher: "ai-collab-receipt-reminder", hooks: [{ type: "command", command: "printf x 1>&2; exit 0" }] }]
    }
  };
  writeFileSync(settingsPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");

  const out = runCli(["adapters", "install", "--target", target, "--tool", "claude", "--enable-hooks", "--force"]);
  assert.match(out, /merge into/i, "a settings.json missing one of our hooks must merge (not report already-present)");
  const after = JSON.parse(read(settingsPath));
  const stopOurs = after.hooks.Stop.filter((e) => e.matcher === "ai-collab-receipt-reminder");
  assert.equal(stopOurs.length, 1, "the existing Stop hook must NOT be duplicated");
  const ssOurs = (after.hooks.SessionStart || []).filter((e) => (e.hooks || []).some((h) => (h.command || "").includes("[ai-collab first-run]")));
  assert.equal(ssOurs.length, 1, "the missing SessionStart hook must be added exactly once");
});

test("P3: help frames the three adaptation tiers (rules default / skills optional / hooks opt-in)", () => {
  const help = runCli(["help"]);
  assert.match(help, /--enable-hooks/, "help must document the --enable-hooks flag");
  assert.match(help, /rules\s+\(default/i, "help must frame rules as the default tier");
  assert.match(help, /skills\s+\(optional/i, "help must frame skills as optional");
  assert.match(help, /hooks\s+\(opt-in/i, "help must frame hooks as opt-in");
  assert.match(help, /never a global hook|Never a global/i, "help must promise no global hook");
});

test("P3: evidence-pack and single-tool-guard skills are generated and distinct", () => {
  const target = mkdtempSync(path.join(tmpdir(), "aicos-p3-skills-"));
  runCli(["init", "--target", target, "--force"]);
  const workspace = path.join(target, ".aict");

  const evidencePack = read(workspace, "skills", "evidence-pack", "SKILL.md");
  assert.match(evidencePack, /name: evidence-pack/, "evidence-pack skill must declare its name");
  assert.match(evidencePack, /ai-collab evidence add/, "evidence-pack must teach the evidence add command");
  assert.match(evidencePack, /exit code/i, "evidence-pack must require the exit code");

  const singleTool = read(workspace, "skills", "single-tool-guard", "SKILL.md");
  assert.match(singleTool, /name: single-tool-guard/, "single-tool-guard skill must declare its name");
  assert.match(singleTool, /pass_with_risk/, "single-tool-guard must name the L2 ceiling verdict");
  assert.match(singleTool, /cross-family/i, "single-tool-guard must point at the cross-family upgrade");
});

// --- A2 capability detect -------------------------------------------------
//
// A2 adds a "capability detect" command: it tells a user the highest guard level
// their SETUP could ever reach (the ceiling), separate from what any one task
// EARNS (the receipt's guard level, A1). The load-bearing judge is the count of
// DISTINCT model families, not tool count.

// Make a temp project dir with the given tool-marker files/dirs created, so the
// signal probe has something to find. `markers` is a list of relative paths; a
// trailing "/" makes it a directory, otherwise an empty file.
function projectWith(markers) {
  const dir = mkdtempSync(path.join(tmpdir(), "aicos-cap-"));
  for (const marker of markers) {
    const full = path.join(dir, marker);
    if (marker.endsWith("/")) {
      mkdirSync(full, { recursive: true });
    } else {
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, "");
    }
  }
  return dir;
}

function capabilityJson(extraArgs, projectDir) {
  const dir = projectDir ?? mkdtempSync(path.join(tmpdir(), "aicos-cap-empty-"));
  const out = runCli(["capability", "detect", "--project", dir, "--json", ...extraArgs]);
  return JSON.parse(out);
}

test("A2: the capability ceiling rule lives in ledger.js as a pure function (computeCapability)", () => {
  // computeCapability is the SINGLE source the CLI calls. Assert the six-tier
  // mapping directly so the contract is pinned independent of CLI plumbing, the
  // same way the P2 verdict rule is asserted on guardLevelVerdictError.
  // 1) one locked conversation, nothing else -> L0
  assert.equal(computeCapability({ canOpenNewConversation: false }).ceiling, "L0");
  // 2) one tool, can open a new conversation -> L2 (the default floor for a real tool)
  assert.equal(computeCapability({}).ceiling, "L2");
  // 3) one tool with sub-agents -> L2
  assert.equal(computeCapability({ hasSubAgents: true, canOpenNewConversation: false }).ceiling, "L2");
  // 4) one tool that can switch model family -> L2.5 (weak L3)
  assert.equal(computeCapability({ canSwitchModelFamily: true, canOpenNewConversation: false }).ceiling, "L2.5");
  // 5) two distinct named families -> L3 (cross-family gate)
  assert.equal(computeCapability({ families: ["anthropic", "openai"] }).ceiling, "L3");
  // 6) cross-family AND a re-run -> L4
  assert.equal(computeCapability({ families: ["anthropic", "openai"], canRerun: true }).ceiling, "L4");
});

test("A2: the judge is DISTINCT MODEL FAMILIES, not tool count (two same-family tools stay L2)", () => {
  // Two tools, but BOTH anthropic -> still one family -> L2, NOT the L3 gate.
  const sameFamily = computeCapability({ tools: ["claude", "claude-code"] });
  assert.equal(sameFamily.distinctFamilies, 1, "two same-family tools is one family");
  assert.equal(sameFamily.ceiling, "L2", "same-family tools cannot clear the cross-family gate");
  // Two tools on DIFFERENT families -> two families -> L3.
  const crossFamily = computeCapability({ tools: ["claude", "codex"] });
  assert.equal(crossFamily.distinctFamilies, 2);
  assert.equal(crossFamily.ceiling, "L3");
  // distinctNamedFamilies ignores "unknown"/blank so an unknown tool cannot fake a
  // second family alongside a known one.
  assert.equal(distinctNamedFamilies(["anthropic", "unknown", ""]).size, 1);
  assert.equal(distinctNamedFamilies(["anthropic", "openai"]).size, 2);
});

test("A2: re-running alone (single family) does NOT reach L4 — independence needs cross-family", () => {
  // canRerun on a SINGLE family is not independence (you re-ran your own work), so
  // it must not lift the ceiling past L2; L4 requires re-run ON TOP OF cross-family.
  const single = computeCapability({ families: ["anthropic"], canRerun: true });
  assert.equal(single.ceiling, "L2", "a same-family self re-run is not cross-family independence");
  const cross = computeCapability({ families: ["anthropic", "openai"], canRerun: true });
  assert.equal(cross.ceiling, "L4", "re-run on top of cross-family reaches L4");
});

test("A2: capability detect probes tool markers and reports the ceiling + tier (cross-family -> L3)", () => {
  const dir = projectWith([".claude/", ".codex/"]);
  const payload = capabilityJson([], dir);
  assert.equal(payload.ok, true);
  assert.equal(payload.command, "capability detect");
  assert.equal(payload.ceiling, "L3", ".claude + .codex are two families -> L3");
  assert.equal(payload.distinctFamilies, 2);
  assert.deepEqual(payload.families, ["anthropic", "openai"]);
  // Both confident markers are reported as signals.
  const markers = payload.signals.map((s) => s.marker).sort();
  assert.deepEqual(markers, [".claude", ".codex"]);
  // The recommendation points at the NEXT ceiling (L4), not a repeat of L3.
  assert.equal(payload.recommendation.nextCeiling, "L4");
});

test("A2: AGENTS.md / CLAUDE.md are LOW-CONFIDENCE signals that never fake a second family", () => {
  // A project with ONLY anthropic markers (incl. the generic AGENTS.md + CLAUDE.md)
  // must stay one family / L2 — a generic marker is a hint, not a family verdict.
  const dir = projectWith([".claude/", "CLAUDE.md", "AGENTS.md"]);
  const payload = capabilityJson([], dir);
  assert.equal(payload.distinctFamilies, 1, "generic markers must not manufacture a second family");
  assert.equal(payload.ceiling, "L2");
  // AGENTS.md is surfaced but as family-unknown + low-confidence (confident:false).
  const agents = payload.signals.find((s) => s.marker === "AGENTS.md");
  assert.ok(agents, "AGENTS.md should be reported as a signal");
  assert.equal(agents.confident, false, "AGENTS.md must be low-confidence");
  assert.equal(agents.family, null, "AGENTS.md must not pin a family");
  // The human output must flag the inference so a user knows to confirm.
  const text = runCli(["capability", "detect", "--project", dir]);
  assert.match(text, /low-confidence/i, "low-confidence markers must be flagged in the text");
  assert.match(text, /INFERRED|confirm/i, "the output must tell the user to confirm the inferred setup");
});

test("A2: self-report flags OVERRIDE the probe (the CLI cannot see what you installed)", () => {
  // An EMPTY project (no markers) + explicit --families is the non-interactive
  // self-report path: the user states their real setup and the ceiling follows.
  const stated = capabilityJson(["--families", "anthropic,openai"]);
  assert.equal(stated.ceiling, "L3");
  assert.equal(stated.distinctFamilies, 2);
  assert.equal(stated.inferred, false, "an explicitly stated setup is not an inference");
  // --tools alone derives families from the tool map.
  const viaTools = capabilityJson(["--tools", "claude,codex"]);
  assert.equal(viaTools.ceiling, "L3");
  // --can-switch-model on a single tool is the weak-L3 (L2.5) tier.
  const switchable = capabilityJson(["--can-switch-model", "--no-new-conversation"]);
  assert.equal(switchable.ceiling, "L2.5");
  assert.equal(switchable.tier.id, "switch-model-family");
});

test("A2: capability detect keeps CEILING and ACHIEVED apart, and never writes a ledger", () => {
  const ws = freshRunWorkspace("cap-noledger");
  // Snapshot every state file before the command.
  const before = readdirSync(path.join(ws, "state")).map((f) => [f, readFileSync(path.join(ws, "state", f), "utf8")]);
  // Run capability detect against the workspace's project root (the dir above .aict).
  const projectRoot = path.dirname(ws);
  const text = runCli(["capability", "detect", "--project", projectRoot, "--tools", "claude,codex"]);
  // The output must explicitly distinguish the ceiling from what a task EARNS, and
  // point achieved-level questions at receipt create (the A1 layer).
  assert.match(text, /CEILING/i, "must label the result a ceiling");
  assert.match(text, /receipt create/i, "must point achieved level at receipt create");
  assert.match(text, /EARN|achieved/i, "must contrast ceiling with what a task earns");
  // P2 honesty: the families/tools shown are SELF-REPORTED setup (a ceiling), not proof a
  // task achieved cross-family; declaring a second family does not earn L3/L4 on its own.
  assert.match(text, /SELF-REPORTED/i, "must state the shown families/tools are self-reported setup");
  assert.match(text, /Declaring a second\s+family does not make a task cross-family-passed/i, "must say declaring a second family does not make a task cross-family-passed");
  assert.match(text, /only a real cross-family guard with\s+rerun evidence earns L3\/L4/i, "must say only a real cross-family guard with rerun evidence earns L3/L4");
  // No state file changed: capability detect is a pure advisory layer, not a writer.
  const after = readdirSync(path.join(ws, "state")).map((f) => [f, readFileSync(path.join(ws, "state", f), "utf8")]);
  assert.deepEqual(after, before, "capability detect must not modify any ledger/state file");
});

test("A2: capability detect is documented in help and rejects an unknown subcommand", () => {
  const help = runCli(["help"]);
  assert.match(help, /capability detect/, "help must list the capability detect command");
  assert.match(help, /distinct model families/i, "help must explain the family-count judge");
  assert.match(help, /ceiling/i, "help must frame capability as a ceiling");
  // An unknown subcommand is a usage error (non-zero exit), like the other groups.
  const bad = runResult(["bin/ai-collab.js", "capability", "bogus"]);
  assert.notEqual(bad.status, 0, "an unknown capability subcommand must fail");
  assert.match(bad.stderr, /Unknown capability command/i);
});

// --- handoff create (resume across tools without re-explaining) -------------
//
// handoff create reads the ledger and writes a DRAFT handoff note into the
// workspace's .aict/handoff/ layer. The load-bearing property these tests pin is
// HONESTY: only a task with an ACCEPTED receipt may appear under Done; a
// pass_with_risk (pending) receipt, or a pass with no own-task evidence (also
// pending), must NOT be reported as done — it belongs under Unverified. The
// command must also clearly mark itself a draft, surface evidence/run/receipt
// references, and never overstate completion.

// Build a fresh workspace and return its .aict dir (the --workspace argument the
// run-layer commands take). Mirrors the init pattern the other CLI tests use.
function initHandoffWorkspace(label) {
  const target = mkdtempSync(path.join(tmpdir(), `aicos-${label}-`));
  runCli(["init", "--target", target, "--force"]);
  return path.join(target, ".aict");
}

// Parse the --json payload of a CLI command (stdout is pure JSON under --json).
function runJson(args) {
  return JSON.parse(runCli(args));
}

// Drive task -> evidence -> receipt for one task and return the created ids, so a
// test can assemble a precise done/unverified scenario through the real writers
// (never hand-writing ledger rows, so the receipt status is the tool's own).
function makeTask(ws, title) {
  return runJson(["task", "create", "--title", title, "--workspace", ws, "--json"]).task.id;
}
function addEvidence(ws, taskId, kind, summary, extra = []) {
  return runJson([
    "evidence", "add", "--task", taskId, "--kind", kind, "--summary", summary, "--workspace", ws, "--json", ...extra
  ]).evidence.id;
}

test("handoff create writes a draft note into .aict/handoff with the draft banner and the four sections", () => {
  const ws = initHandoffWorkspace("handoff-basic");
  const t1 = makeTask(ws, "Build login form");
  addEvidence(ws, t1, "note", "scaffolded the form");

  const result = runJson(["handoff", "create", "--workspace", ws, "--json"]);
  assert.equal(result.command, "handoff create");
  assert.equal(result.ok, true);
  assert.equal(result.draft, true, "the command must mark its output a draft");

  // The file landed in the workspace's handoff layer, with the generated naming.
  const handoffDir = path.join(ws, "handoff");
  const drafts = readdirSync(handoffDir).filter((f) => /^handoff-.*\.md$/.test(f));
  assert.equal(drafts.length, 1, "exactly one draft file should be written");
  assert.equal(result.file, path.join(handoffDir, drafts[0]), "the reported file path must be the written file");

  const draft = readFileSync(result.file, "utf8");
  // The honesty banner must be present and unmistakable.
  assert.match(
    draft,
    /auto-generated draft from the ledger — review and complete it before handing off/i,
    "the draft must carry the 'auto-generated draft, review before handoff' banner"
  );
  // It must follow the handoff layer's done/pending/blocked/unverified vocabulary.
  assert.match(draft, /## Done/i, "draft must have a Done section");
  assert.match(draft, /## Pending/i, "draft must have a Pending section");
  assert.match(draft, /## Blocked/i, "draft must have a Blocked section");
  assert.match(draft, /## Unverified/i, "draft must have an Unverified section");
  assert.match(draft, /## Next action/i, "draft must leave a Next action for the receiver");
  // The task with only a note (no receipt) is Pending, not Done.
  const pendingIdx = draft.indexOf("## Pending");
  const blockedIdx = draft.indexOf("## Blocked");
  assert.ok(
    draft.slice(pendingIdx, blockedIdx).includes(t1),
    "a task with no receipt must appear under Pending"
  );
});

test("C1 handoff honesty: an accepted L4 cross-family receipt is Unverified, with family warning plus reconciled-rerun evidence cited", () => {
  const ws = initHandoffWorkspace("handoff-done");
  const t1 = makeTask(ws, "Ship the export endpoint");
  // C1: cross_family_rerun WITH a rerun reconciled to a recorded run reaches L4,
  // but the family on the cross_family_guard row is still typed locally. The old
  // test expected this to be Done; that was the bug because it laundered the
  // self-declared family identity. L4 should surface as local execution evidence
  // plus an unverified-family warning.
  const e1 = addEvidence(ws, t1, "cross_family_guard", "Codex reviewed the implementation", ["--family", "gpt"]);
  const { rerun } = reconciledRerun(ws, t1, { output: "Tests: 5 passed, 0 failed" });
  const receipt = runJson([
    "receipt", "create", "--task", t1, "--verdict", "pass", "--review-mode", "cross_family_rerun",
    "--evidence", e1, "--rerun", rerun.id, "--workspace", ws, "--json"
  ]).receipt;
  assert.equal(receipt.status, "accepted", "precondition: a cross_family_rerun pass with a reconciled rerun auto-accepts locally");
  assert.equal(receipt.guardLevel, "L4", "precondition: a reconciled rerun reaches L4");
  assert.equal(receipt.familyUnverified, true, "precondition: L4 still carries the self-declared cross-family warning");

  const result = runJson(["handoff", "create", "--workspace", ws, "--json"]);
  // The model keeps t1 out of Done and routes it to Unverified.
  const doneIds = result.model.done.map((e) => e.id);
  assert.deepEqual(doneIds, [], "an L4 cross-family receipt with self-declared family identity must not be Done");
  assert.deepEqual(result.model.unverified.map((e) => e.id), [t1], "the L4 cross-family receipt must be Unverified");
  assert.equal(result.counts.done, 0);

  const draft = readFileSync(result.file, "utf8");
  const doneIdx = draft.indexOf("## Done");
  const nextSectionIdx = draft.indexOf("## Pending", doneIdx);
  const doneBlock = draft.slice(doneIdx, nextSectionIdx);
  assert.ok(!doneBlock.includes(t1), "the Done section must not name the L4 family-unverified task");
  const unvIdx = draft.indexOf("## Unverified");
  const unvBlock = draft.slice(unvIdx);
  assert.ok(unvBlock.includes(t1), "the Unverified section names the accepted L4 task");
  assert.ok(unvBlock.includes(receipt.id), "the Unverified section cites the receipt id");
  assert.match(unvBlock, /self-declared\s*\/\s*unverified/i, "the Unverified section keeps the family warning");
  assert.match(unvBlock, /reconciled rerun|recorded run exec output/i, "the Unverified section separately names the L4 local execution evidence");
  assert.ok(unvBlock.includes(e1), "the Unverified section cites the evidence id");
  assert.ok(unvBlock.includes(rerun.command), "the Unverified section cites the recorded run command");
  assert.match(unvBlock, /exit 0/, "the Unverified section shows the run exit code");
});

// THE CROSS-FAMILY HONESTY TEST (CLI): a SELF-DECLARED / unverified cross-family
// receipt that auto-accepted locally (a plain `cross_family` pass with only a
// guard row -> computed L3, status accepted, familyUnverified: true) must NEVER
// read as Done. The tool cannot verify the family, so reporting it as done would
// let the receiver read a self-asserted cross-family review as an independently
// checked one. It belongs under Unverified, with an honest reason telling the
// receiver to re-check with a real different model family (or reach L4).
test("handoff create HONESTY: an accepted-but-family-unverified cross-family receipt is NOT in Done — it is Unverified with the self-declared-cross-family reason", () => {
  const ws = initHandoffWorkspace("handoff-honest-family");
  const t1 = makeTask(ws, "Ship the billing migration");
  // cross_family + a (self-filled) cross_family_guard row, plain pass -> the CLI
  // computes L3 and auto-accepts, but marks it familyUnverified (self-declared
  // cross-family, no reconciled rerun behind it).
  const e1 = addEvidence(ws, t1, "cross_family_guard", "claims a gpt guard pressed on it", ["--family", "gpt"]);
  const receipt = runJson([
    "receipt", "create", "--task", t1, "--verdict", "pass", "--review-mode", "cross_family",
    "--evidence", e1, "--workspace", ws, "--json"
  ]).receipt;
  assert.equal(receipt.status, "accepted", "precondition: a plain cross_family pass with a guard row auto-accepts");
  assert.equal(receipt.guardLevel, "L3", "precondition: it computes L3 (capped by evidence, no reconciled rerun)");
  assert.equal(receipt.familyUnverified, true, "precondition: the L3 cross-family claim is self-declared / unverified");

  const result = runJson(["handoff", "create", "--workspace", ws, "--json"]);

  // The core assertion: a self-declared/unverified cross-family acceptance is NOT done.
  const doneIds = result.model.done.map((e) => e.id);
  assert.ok(!doneIds.includes(t1), "an accepted-but-family-unverified task must NOT appear in Done");
  assert.equal(result.counts.done, 0, "no task is verified-done in this scenario");
  // It IS surfaced as unverified.
  const unverifiedIds = result.model.unverified.map((e) => e.id);
  assert.deepEqual(unverifiedIds, [t1], "the family-unverified task must be Unverified");
  // The entry carries the honest reason (the cross-family attribution is self-declared).
  const entry = result.model.unverified.find((e) => e.id === t1);
  assert.ok(
    entry.riskNotes.some((n) => /self-declared\s*\/\s*unverified/i.test(n) && /re-check with a real different model family/i.test(n)),
    `the family-unverified entry must carry the honest self-declared-cross-family reason, got:\n${entry.riskNotes.join("\n")}`
  );

  const draft = readFileSync(result.file, "utf8");
  // The literal task id must NOT appear inside the rendered Done section.
  const doneIdx = draft.indexOf("## Done");
  const afterDoneIdx = draft.indexOf("## Pending", doneIdx);
  const doneBlock = draft.slice(doneIdx, afterDoneIdx);
  assert.ok(!doneBlock.includes(t1), "the rendered Done section must not contain the family-unverified task");
  // The Unverified section must contain it AND the honest cross-family reason.
  const unvIdx = draft.indexOf("## Unverified");
  const unvBlock = draft.slice(unvIdx);
  assert.ok(unvBlock.includes(t1), "the rendered Unverified section must contain the task");
  assert.match(unvBlock, /self-declared\s*\/\s*unverified/i, "the Unverified section flags the cross-family claim is self-declared/unverified");
  assert.match(unvBlock, /re-check with a real different model family/i, "the Unverified section tells the receiver to re-check with a real different model family");
});

// THE HONESTY TEST: an unaccepted receipt must NEVER read as done.
test("handoff create HONESTY: a pass_with_risk (pending) receipt is NOT in Done — it is Unverified with a risk note", () => {
  const ws = initHandoffWorkspace("handoff-honest-risk");
  const t1 = makeTask(ws, "Wire the payment webhook");
  const e1 = addEvidence(ws, t1, "output", "ran the handler locally, got 200");
  // A single-tool self review tops out at pass_with_risk / L2 and is created
  // PENDING (it needs an explicit owner acceptance it never gets here).
  const receipt = runJson([
    "receipt", "create", "--task", t1, "--verdict", "pass_with_risk", "--review-mode", "self",
    "--evidence", e1, "--workspace", ws, "--json"
  ]).receipt;
  assert.equal(receipt.verdict, "pass_with_risk");
  assert.equal(receipt.status, "pending", "precondition: pass_with_risk is created pending, not accepted");

  const result = runJson(["handoff", "create", "--workspace", ws, "--json"]);

  // The core assertion: it is NOT done.
  const doneIds = result.model.done.map((e) => e.id);
  assert.ok(!doneIds.includes(t1), "a pass_with_risk task must NOT appear in Done");
  assert.equal(result.counts.done, 0, "no task is done in this scenario");
  // It IS surfaced as unverified.
  const unverifiedIds = result.model.unverified.map((e) => e.id);
  assert.deepEqual(unverifiedIds, [t1], "the pass_with_risk task must be Unverified");

  const draft = readFileSync(result.file, "utf8");
  // The literal task id must not appear anywhere inside the Done section.
  const doneIdx = draft.indexOf("## Done");
  const afterDoneIdx = draft.indexOf("## Pending", doneIdx);
  const doneBlock = draft.slice(doneIdx, afterDoneIdx);
  assert.ok(!doneBlock.includes(t1), "the rendered Done section must not contain the unverified task");
  // The Unverified section must contain it AND an explicit not-accepted warning.
  const unvIdx = draft.indexOf("## Unverified");
  const unvBlock = draft.slice(unvIdx);
  assert.ok(unvBlock.includes(t1), "the rendered Unverified section must contain the task");
  assert.match(unvBlock, /pass_with_risk/i, "the Unverified section names the risky verdict");
  assert.match(unvBlock, /not\s+owner-accepted|pending/i, "the Unverified section flags it is not accepted");
});

// SECOND HONESTY ANGLE (unit-level on the classifier): the buckets are keyed
// STRICTLY on receipt.status === "accepted". This pins the exact rule
// receiptStatusFor encodes — an accepting verdict ("pass") WITHOUT same-task
// evidence resolves to "pending", and a pending receipt must land in Unverified,
// never Done. We construct the ledger directly so the classifier's contract is
// tested in isolation (the CLI's write gate would refuse some of these rows
// before they could be written, which is correct, but it also means only a unit
// test can prove "if a pending receipt somehow exists, it is never called done").
test("buildHandoffModel HONESTY: only status='accepted' receipts go to Done; a pending pass goes to Unverified", () => {
  const tasks = [
    { id: "t1", title: "Accepted work", status: "open", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "t2", title: "Pending pass (no own evidence)", status: "open", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "t3", title: "Risk pending", status: "open", createdAt: "2026-02-01T00:00:00.000Z" }
  ];
  const evidence = [
    { id: "e1", taskId: "t1", kind: "output", summary: "ran it", createdAt: "2026-02-01T00:00:00.000Z" }
  ];
  const receipts = [
    // t1: a genuinely Done-eligible acceptance — an owner-accepted pass_with_risk at
    // L2 that never claims cross-family, so the family-verification gate leaves it
    // alone. (This test is about STATUS, accepted vs pending; using a non-cross-family
    // acceptance keeps that the only variable. An L3 cross_family acceptance is NOT
    // Done-eligible by itself — that self-declared/unverified case is its own test.)
    { id: "c1", taskId: "t1", verdict: "pass_with_risk", guardLevel: "L2", reviewMode: "self", evidenceIds: ["e1"], status: "accepted", ownerAccepted: true, acceptedBy: "alex", createdAt: "2026-02-02T00:00:00.000Z" },
    // t2: an accepting verdict (pass) that receiptStatusFor left PENDING because it
    // cites no same-task evidence. Must NOT be Done.
    { id: "c2", taskId: "t2", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: [], status: "pending", createdAt: "2026-02-02T00:00:00.000Z" },
    // t3: a pass_with_risk that is still pending owner acceptance. Must NOT be Done.
    { id: "c3", taskId: "t3", verdict: "pass_with_risk", guardLevel: "L2", reviewMode: "self", evidenceIds: [], status: "pending", createdAt: "2026-02-02T00:00:00.000Z" }
  ];

  const model = buildHandoffModel({ tasks, evidence, runs: [], receipts, learning: [] });

  assert.deepEqual(model.done.map((e) => e.id), ["t1"], "only the accepted task is Done");
  const unverifiedIds = model.unverified.map((e) => e.id).sort();
  assert.deepEqual(unverifiedIds, ["t2", "t3"], "both pending-receipt tasks are Unverified, not Done");
  // The pending 'pass' (t2) must carry a risk note flagging it is not accepted.
  const t2Entry = model.unverified.find((e) => e.id === "t2");
  assert.ok(
    t2Entry.riskNotes.some((n) => /pending|not\s+accepted/i.test(n)),
    "a pending pass must carry a 'not accepted / pending' risk note"
  );
});

// A pass_with_risk that an owner DID accept (status accepted) is legitimately
// Done — the model trusts the recorded acceptance, and surfaces it as accepted by
// that owner. This guards the other direction: the honesty rule must not be so
// blunt it hides genuinely accepted risk work.
test("buildHandoffModel: an owner-accepted pass_with_risk IS Done and shows who accepted it", () => {
  const tasks = [{ id: "t1", title: "Risk work, owner-accepted", status: "open", createdAt: "2026-02-01T00:00:00.000Z" }];
  const evidence = [{ id: "e1", taskId: "t1", kind: "output", summary: "ran it", createdAt: "2026-02-01T00:00:00.000Z" }];
  const receipts = [
    { id: "c1", taskId: "t1", verdict: "pass_with_risk", guardLevel: "L2", reviewMode: "self", evidenceIds: ["e1"], status: "accepted", ownerAccepted: true, acceptedBy: "alex", createdAt: "2026-02-02T00:00:00.000Z" }
  ];
  const model = buildHandoffModel({ tasks, evidence, runs: [], receipts, learning: [] });
  assert.deepEqual(model.done.map((e) => e.id), ["t1"], "an owner-accepted pass_with_risk is Done");
  assert.equal(model.done[0].receipts[0].acceptedBy, "alex", "the accepting owner is surfaced");
});

// CROSS-FAMILY HONESTY (unit-level on the classifier): an ACCEPTED receipt whose
// level rests on a SELF-DECLARED cross-family claim (familyUnverified === true)
// is NOT Done — the tool could not verify the family, so calling it done would
// let a reader read a self-asserted cross-family review as independently checked.
// It routes to Unverified with the honest "re-check with a real different model
// family" reason. This pins the exact familyUnverified !== true
// Done condition. (t1 below is also a stronger leak case than the CLI can write:
// it has BOTH the family-unverified acceptance AND a reconciled L4 path is covered
// separately — here every cross-family acceptance is family-unverified, so those
// tasks must drop out of Done.)
test("buildHandoffModel HONESTY: an accepted-but-family-unverified receipt is NEVER Done; it is Unverified with the self-declared-cross-family reason", () => {
  const tasks = [
    { id: "t1", title: "Self-declared cross-family, accepted", status: "open", createdAt: "2026-02-01T00:00:00.000Z" },
    // C1: a reconciled L4 is still family-unverified because model-family identity
    // is self-declared. It is NOT the Done control.
    { id: "t2", title: "Reconciled L4, family still self-declared", status: "open", createdAt: "2026-02-01T00:00:00.000Z" },
    // Control: owner-accepted pass_with_risk never claims cross-family, so it
    // remains Done-eligible.
    { id: "t3", title: "Owner-accepted non-cross-family risk", status: "open", createdAt: "2026-02-01T00:00:00.000Z" }
  ];
  const evidence = [
    { id: "e1", taskId: "t1", kind: "cross_family_guard", summary: "claims gpt reviewed", family: "gpt", reviewer: "gpt-guard", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "e2", taskId: "t2", kind: "cross_family_guard", summary: "gpt reviewed", family: "gpt", reviewer: "gpt-guard", createdAt: "2026-02-01T00:00:00.000Z" },
    // t2's L4 is GENUINE: a rerun evidence row reconciled to a recorded run (below).
    // (The old version of this test claimed L4 with no reconciled rerun — a stored
    // field the tool trusts only if you read it, which the leak did; now the handoff
    // gate RE-COMPUTES the level, so the control must be a real, backed L4.)
    { id: "r2", taskId: "t2", kind: "rerun", summary: "re-ran the suite", command: "npm test", exitCode: 0, output: "5 passed", runId: "run2", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "e3", taskId: "t3", kind: "output", summary: "ran it", createdAt: "2026-02-01T00:00:00.000Z" }
  ];
  const runs = [
    { id: "run2", taskId: "t2", command: "npm test", exitCode: 0, status: "finished", executed: true, outputSha256: sha256Text("5 passed"), outputBytes: Buffer.byteLength("5 passed", "utf8"), stdoutBytes: Buffer.byteLength("5 passed", "utf8"), stderrBytes: 0, startedAt: "2026-02-01T00:00:00.000Z", finishedAt: "2026-02-01T00:00:01.000Z" }
  ];
  const receipts = [
    // t1: accepted locally, but the cross-family attribution is self-declared
    // (familyUnverified: true). Must NOT be Done.
    { id: "c1", taskId: "t1", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: ["e1"], status: "accepted", familyUnverified: true, createdAt: "2026-02-02T00:00:00.000Z" },
    // t2: C1 says this reconciled L4 is still family-unverified.
    { id: "c2", taskId: "t2", verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: ["e2"], rerunEvidenceIds: ["r2"], status: "accepted", familyUnverified: true, createdAt: "2026-02-02T00:00:00.000Z" },
    // t3: the Done control that proves non-cross-family honest paths still work.
    { id: "c3", taskId: "t3", verdict: "pass_with_risk", guardLevel: "L2", reviewMode: "self", evidenceIds: ["e3"], status: "accepted", ownerAccepted: true, acceptedBy: "alex", createdAt: "2026-02-02T00:00:00.000Z" }
  ];

  const model = buildHandoffModel({ tasks, evidence, runs, receipts, learning: [] });

  // The cross-family acceptances are NOT Done; only the owner-accepted non-cross-family risk is.
  assert.deepEqual(model.done.map((e) => e.id), ["t3"], "only the owner-accepted non-cross-family risk is Done");
  assert.deepEqual(model.unverified.map((e) => e.id), ["t1", "t2"], "the family-unverified cross-family acceptances route to Unverified, not Done");
  assert.equal(model.counts.done, 1, "exactly one verified task is Done");

  // The Unverified entry carries the honest self-declared-cross-family reason.
  const t1Entry = model.unverified.find((e) => e.id === "t1");
  assert.ok(
    t1Entry.riskNotes.some(
      (n) => /self-declared\s*\/\s*unverified/i.test(n) && /re-check with a real different model family/i.test(n)
    ),
    `the family-unverified entry must carry the honest "re-check with a real different model family" reason, got:\n${t1Entry.riskNotes.join("\n")}`
  );
  // And the receipt is NOT silently dropped — it is still surfaced on the entry,
  // marked family-unverified, so the receiver sees what was claimed (and why it
  // is not trusted as done), not a hole.
  const t1Receipt = t1Entry.receipts.find((r) => r.id === "c1");
  assert.ok(t1Receipt, "the family-unverified receipt is still surfaced on the Unverified entry");
  assert.equal(t1Receipt.familyUnverified, true, "the surfaced receipt is marked family-unverified");
  const t2Entry = model.unverified.find((e) => e.id === "t2");
  assert.ok(
    t2Entry.riskNotes.some((n) => /reconciled rerun|recorded run exec output/i.test(n)),
    `the L4 entry must separately surface the local execution/reconciliation evidence, got:\n${t2Entry.riskNotes.join("\n")}`
  );
});

// CROSS-FAMILY HONESTY (the deeper leak a cross-family binding guard found): the
// Done gate must NOT trust the STORED `familyUnverified` field — it can be ABSENT
// (an old-schema ledger that predates the marker), explicitly FALSE (a hand-edit /
// hand-planted row), and either way an accepted L3 cross-family receipt would then
// sail into Done and let a reader read a self-asserted cross-family review as an
// independently verified completion. The fix DERIVES family-verification from the
// receipt's own evidence (computeReceiptGuardLevel — the same basis the validator
// uses), so the level rests on a cross-family CLAIM that did not reach L4 -> routed
// to Unverified NO MATTER what the stored marker says. This test plants exactly the
// rows the guard could bypass (missing marker AND marker:false) and pins that BOTH
// land in Unverified, with the honest reason. C1 adds a third Unverified control:
// a genuinely reconciled L4 still has self-declared family identity. The one
// Done-eligible control is an owner-accepted L2 pass_with_risk that never claims
// cross-family.
test("buildHandoffModel HONESTY: an accepted L3 cross-family receipt with the familyUnverified marker MISSING (or false) is still kept out of Done — the gate derives it from evidence, not the stored flag", () => {
  const tasks = [
    // t1: the exact bad row — accepted, L3, cross-family, marker ABSENT.
    { id: "t1", title: "Self-declared cross-family, marker missing", status: "open", createdAt: "2026-02-01T00:00:00.000Z" },
    // t2: same leak via a marker explicitly set false.
    { id: "t2", title: "Self-declared cross-family, marker:false", status: "open", createdAt: "2026-02-01T00:00:00.000Z" },
    // t3 control: an owner-accepted pass_with_risk (L2, never claims cross-family) -> Done.
    { id: "t3", title: "Owner-accepted risk (L2)", status: "open", createdAt: "2026-02-01T00:00:00.000Z" },
    // t4 C1 control: a GENUINELY reconciled L4 cross-family acceptance -> still Unverified.
    { id: "t4", title: "Reconciled L4, family still self-declared", status: "open", createdAt: "2026-02-01T00:00:00.000Z" }
  ];
  const evidence = [
    { id: "e1", taskId: "t1", kind: "cross_family_guard", summary: "claims gpt reviewed", family: "gpt", reviewer: "gpt-guard", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "e2", taskId: "t2", kind: "cross_family_guard", summary: "claims gpt reviewed", family: "gpt", reviewer: "gpt-guard", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "e3", taskId: "t3", kind: "output", summary: "ran it", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "e4", taskId: "t4", kind: "cross_family_guard", summary: "gpt reviewed", family: "gpt", reviewer: "gpt-guard", createdAt: "2026-02-01T00:00:00.000Z" },
    // t4's reconciled rerun (paired with run4 below) — what makes its L4 real.
    { id: "r4", taskId: "t4", kind: "rerun", summary: "re-ran the suite", command: "npm test", exitCode: 0, output: "5 passed", runId: "run4", createdAt: "2026-02-01T00:00:00.000Z" }
  ];
  const runs = [
    { id: "run4", taskId: "t4", command: "npm test", exitCode: 0, status: "finished", executed: true, outputSha256: sha256Text("5 passed"), outputBytes: Buffer.byteLength("5 passed", "utf8"), stdoutBytes: Buffer.byteLength("5 passed", "utf8"), stderrBytes: 0, startedAt: "2026-02-01T00:00:00.000Z", finishedAt: "2026-02-01T00:00:01.000Z" }
  ];
  const receipts = [
    // t1: accepted L3 cross-family, NO familyUnverified field at all (the codex bad row).
    { id: "c1", taskId: "t1", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: ["e1"], status: "accepted", createdAt: "2026-02-02T00:00:00.000Z" },
    // t2: same, but the stored marker is explicitly false (a stripped/forged caveat).
    { id: "c2", taskId: "t2", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: ["e2"], status: "accepted", familyUnverified: false, createdAt: "2026-02-02T00:00:00.000Z" },
    // t3 control: owner-accepted pass_with_risk, never claims cross-family -> Done.
    { id: "c3", taskId: "t3", verdict: "pass_with_risk", guardLevel: "L2", reviewMode: "self", evidenceIds: ["e3"], status: "accepted", ownerAccepted: true, acceptedBy: "alex", createdAt: "2026-02-02T00:00:00.000Z" },
    // t4: genuinely reconciled L4 -> still family-unverified after C1.
    { id: "c4", taskId: "t4", verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: ["e4"], rerunEvidenceIds: ["r4"], status: "accepted", familyUnverified: true, createdAt: "2026-02-02T00:00:00.000Z" }
  ];

  const model = buildHandoffModel({ tasks, evidence, runs, receipts, learning: [] });

  // CORE: the marker-missing and marker-false bad rows are kept OUT of Done.
  const doneIds = model.done.map((e) => e.id).sort();
  assert.deepEqual(doneIds, ["t3"], "only the owner-accepted non-cross-family risk is Done; every cross-family family claim is still unverified");
  const unverifiedIds = model.unverified.map((e) => e.id).sort();
  assert.deepEqual(unverifiedIds, ["t1", "t2", "t4"], "both stripped L3 rows and the reconciled L4 route to Unverified");

  // Each bad row carries the honest self-declared-cross-family reason — so a row whose
  // stored marker was missing/false is not dropped into Unverified silently.
  for (const id of ["t1", "t2"]) {
    const entry = model.unverified.find((e) => e.id === id);
    assert.ok(
      entry.riskNotes.some(
        (n) => /self-declared\s*\/\s*unverified/i.test(n) && /re-check with a real different model family/i.test(n)
      ),
      `${id}: the marker-missing/false cross-family entry must carry the honest "re-check ..." reason, got:\n${entry.riskNotes.join("\n")}`
    );
    // And it is still surfaced (marked family-unverified by the DERIVED value), not a hole.
    const r = entry.receipts.find((rr) => rr.id === (id === "t1" ? "c1" : "c2"));
    assert.ok(r, `${id}: the bad receipt is still surfaced on the Unverified entry`);
    assert.equal(r.familyUnverified, true, `${id}: the surfaced receipt is marked family-unverified even though its STORED flag was missing/false (the view derives it)`);
  }
  const t4Entry = model.unverified.find((e) => e.id === "t4");
  assert.ok(
    t4Entry.riskNotes.some((n) => /reconciled rerun|recorded run exec output/i.test(n)),
    `t4: the L4 entry must separately surface the local execution/reconciliation evidence, got:\n${t4Entry.riskNotes.join("\n")}`
  );
});

// B4 #1 (handoff DETAIL-LINE honesty): the bucketing and the familyUnverified mark
// already derive from evidence, but the per-receipt DETAIL line the draft prints was
// reading the STORED receipt.guardLevel. A hand-edited row that stores "L4" backed by
// only L3 evidence then sat (correctly) in Unverified yet PRINTED "L4" in the one place
// a reader reads — laundering a forged level into the handoff text. The fix makes the
// receipt view (and the risk notes, and the strongest-first sort) display the level
// RE-COMPUTED from the receipt's own evidence, fully consistent with the bucket/status.
// This unit pins the model: a forged-L4/really-L3 row's surfaced guardLevel is L3.
test("buildHandoffModel HONESTY: the receipt DETAIL view shows the RE-COMPUTED guard level, not a forged stored guardLevel", () => {
  const tasks = [
    // t1: stored guardLevel "L4" but the evidence is only an L3 cross-family guard
    // row (no reconciled rerun) — the exact "store L4, evidence L3" forgery.
    { id: "t1", title: "Forged stored L4, evidence only L3", status: "open", createdAt: "2026-02-01T00:00:00.000Z" },
    // t2 control: a GENUINELY reconciled L4 (guard row + rerun reconciled to a run).
    // Its stored L4 is real, so the view must keep showing L4.
    { id: "t2", title: "Genuine reconciled L4", status: "open", createdAt: "2026-02-01T00:00:00.000Z" }
  ];
  const evidence = [
    { id: "e1", taskId: "t1", kind: "cross_family_guard", summary: "claims gpt reviewed", family: "gpt", reviewer: "gpt-guard", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "e2", taskId: "t2", kind: "cross_family_guard", summary: "gpt reviewed", family: "gpt", reviewer: "gpt-guard", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "r2", taskId: "t2", kind: "rerun", summary: "re-ran the suite", command: "npm test", exitCode: 0, output: "5 passed", runId: "run2", createdAt: "2026-02-01T00:00:00.000Z" }
  ];
  const runs = [
    { id: "run2", taskId: "t2", command: "npm test", exitCode: 0, status: "finished", executed: true, outputSha256: sha256Text("5 passed"), outputBytes: Buffer.byteLength("5 passed", "utf8"), stdoutBytes: Buffer.byteLength("5 passed", "utf8"), stderrBytes: 0, startedAt: "2026-02-01T00:00:00.000Z", finishedAt: "2026-02-01T00:00:01.000Z" }
  ];
  const receipts = [
    // FORGED: stored guardLevel L4 (and a stripped familyUnverified), but cites only
    // the L3 guard row with no reconciled rerun -> computes L3.
    { id: "c1", taskId: "t1", verdict: "pass", guardLevel: "L4", reviewMode: "cross_family", evidenceIds: ["e1"], status: "accepted", createdAt: "2026-02-02T00:00:00.000Z" },
    // GENUINE L4: guard row + reconciled rerun -> computes L4.
    { id: "c2", taskId: "t2", verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: ["e2"], rerunEvidenceIds: ["r2"], status: "accepted", familyUnverified: true, createdAt: "2026-02-02T00:00:00.000Z" }
  ];

  const model = buildHandoffModel({ tasks, evidence, runs, receipts, learning: [] });

  // The forged row surfaces with its RE-COMPUTED level (L3), not the stored "L4".
  const t1Entry = model.unverified.find((e) => e.id === "t1");
  assert.ok(t1Entry, "the forged-L4 row routes to Unverified");
  const c1View = t1Entry.receipts.find((r) => r.id === "c1");
  assert.equal(c1View.guardLevel, "L3", "the detail view must show the COMPUTED L3, never the forged stored L4");
  assert.equal(c1View.familyUnverified, true, "and it is still marked self-declared cross-family unverified");
  // Its risk note must also speak of L3 (the honest level), never the forged L4.
  assert.ok(
    t1Entry.riskNotes.some((n) => /\bL3\b/.test(n) && /self-declared\s*\/\s*unverified/i.test(n)),
    `the forged row's risk note must cite the computed L3, got:\n${t1Entry.riskNotes.join("\n")}`
  );
  assert.ok(
    !t1Entry.riskNotes.some((n) => /\bL4\b/.test(n)),
    `no risk note for the forged-L4 row may print L4, got:\n${t1Entry.riskNotes.join("\n")}`
  );

  // Control: a genuinely reconciled L4 still shows L4 in its detail view (the fix
  // displays the truth, it does not blanket-downgrade).
  const t2Entry = model.unverified.find((e) => e.id === "t2");
  assert.ok(t2Entry, "the genuine L4 cross-family row is Unverified (family identity is self-declared)");
  const c2View = t2Entry.receipts.find((r) => r.id === "c2");
  assert.equal(c2View.guardLevel, "L4", "a genuinely reconciled L4 keeps showing L4 in the detail view");
});

// B4 #1 (CLI end-to-end): the SAME forgery driven through the real writers + a
// hand-edit of the stored row, then rendered by `handoff create`. The draft's
// detail TEXT line (the thing a reader actually reads) must print the computed L3,
// not the forged stored L4 — even though the receipt sits in Unverified either way.
test("handoff create HONESTY: a hand-edited stored-L4 receipt with only L3 evidence prints L3 in the draft detail line", () => {
  const ws = initHandoffWorkspace("handoff-forged-level-line");
  const t1 = makeTask(ws, "Forged stored L4 in the draft text");
  // A real cross_family pass with only a guard row -> the CLI computes/stores L3.
  const e1 = addEvidence(ws, t1, "cross_family_guard", "Codex reviewed", ["--family", "gpt"]);
  const receipt = runJson([
    "receipt", "create", "--task", t1, "--verdict", "pass", "--review-mode", "cross_family",
    "--evidence", e1, "--workspace", ws, "--json"
  ]).receipt;
  assert.equal(receipt.guardLevel, "L3", "precondition: a plain cross_family pass with only a guard row computes L3");

  // HAND-FORGE the stored row: write guardLevel "L4" and strip the honest marker.
  const receiptsFile = path.join(ws, "state", "receipts.jsonl");
  const rows = readFileSync(receiptsFile, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  const forged = rows.find((r) => r.id === receipt.id);
  forged.guardLevel = "L4";
  delete forged.familyUnverified;
  writeFileSync(receiptsFile, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

  const result = runJson(["handoff", "create", "--workspace", ws, "--json"]);
  // Still correctly routed to Unverified (the recompute path was never fooled there).
  assert.deepEqual(result.model.unverified.map((e) => e.id), [t1], "the forged-L4 row is Unverified");
  assert.deepEqual(result.model.done.map((e) => e.id), [], "and it is not Done");

  const draft = readFileSync(result.file, "utf8");
  const detailLines = draft.split("\n").filter((line) => line.includes(receipt.id));
  assert.ok(detailLines.length > 0, "the draft must mention the receipt at least once");
  for (const line of detailLines) {
    assert.match(line, /\bL3\b/, `the draft detail line must show the computed L3, got: ${line}`);
    assert.doesNotMatch(line, /\bL4\b/, `the draft detail line must NOT show the forged stored L4, got: ${line}`);
  }
});

// The shared re-computation helper itself (the single source the validator's check
// 8c/8d AND the handoff Done gate now both call): it must DERIVE family-verification
// from the receipt's own evidence and IGNORE the stored guardLevel / familyUnverified
// fields, so a row that lies in those fields cannot move the result. This pins the
// helper directly (not just through buildHandoffModel) so a future refactor that
// re-introduces field-trust is caught here too.
test("computeReceiptGuardLevel derives family-verification from evidence, ignoring the stored guardLevel/familyUnverified fields", () => {
  const evidence = [
    { id: "x1", taskId: "t1", kind: "cross_family_guard", summary: "claims gpt reviewed", family: "gpt", reviewer: "gpt-guard", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "x4", taskId: "t4", kind: "cross_family_guard", summary: "gpt reviewed", family: "gpt", reviewer: "gpt-guard", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "r4", taskId: "t4", kind: "rerun", summary: "re-ran", command: "npm test", exitCode: 0, output: "ok", runId: "run4", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "o3", taskId: "t3", kind: "output", summary: "ran it", createdAt: "2026-02-01T00:00:00.000Z" }
  ];
  const runs = [
    { id: "run4", taskId: "t4", command: "npm test", exitCode: 0, status: "finished", executed: true, outputSha256: sha256Text("ok"), outputBytes: Buffer.byteLength("ok", "utf8"), stdoutBytes: Buffer.byteLength("ok", "utf8"), stderrBytes: 0, startedAt: "2026-02-01T00:00:00.000Z", finishedAt: "2026-02-01T00:00:01.000Z" }
  ];

  // A cross-family receipt with only a guard row (no reconciled rerun) is L3 + unverified,
  // whether the stored marker is missing OR explicitly false — the helper derives true.
  const missing = computeReceiptGuardLevel({ id: "c1", taskId: "t1", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: ["x1"], status: "accepted" }, evidence, runs);
  assert.equal(missing.level, "L3", "cross_family + a guard row computes L3");
  assert.equal(missing.familyUnverified, true, "a cross-family L3 with no reconciled rerun is family-unverified (stored marker absent is irrelevant)");

  const falseFlag = computeReceiptGuardLevel({ id: "c2", taskId: "t1", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: ["x1"], status: "accepted", familyUnverified: false }, evidence, runs);
  assert.equal(falseFlag.familyUnverified, true, "a stored familyUnverified:false does NOT override the derived true");

  // A row that over-claims L4 in its stored field but cites no reconciled rerun computes
  // L3 + unverified — the stored guardLevel does not raise the truth.
  const overclaim = computeReceiptGuardLevel({ id: "c3", taskId: "t1", verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: ["x1"], status: "accepted" }, evidence, runs);
  assert.equal(overclaim.level, "L3", "a stored L4 with no reconciled rerun computes only L3 (level is derived, not read)");
  assert.equal(overclaim.familyUnverified, true, "the over-claimed-L4-but-really-L3 cross-family row is family-unverified");

  // A genuinely reconciled L4 still has self-declared family identity. The old
  // false expectation was the C1 bug: rerun reconciliation proves execution/output
  // matching, not the model family typed on the guard row.
  const realL4 = computeReceiptGuardLevel({ id: "c4", taskId: "t4", verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: ["x4"], rerunEvidenceIds: ["r4"], status: "accepted" }, evidence, runs);
  assert.equal(realL4.level, "L4", "cross_family_guard + a reconciled rerun computes L4");
  assert.equal(realL4.familyUnverified, true, "a backed L4 still marks the cross-family identity as self-declared/unverified");

  // A self-review (no cross-family claim) is never family-unverified, even at L2.
  const selfReview = computeReceiptGuardLevel({ id: "c5", taskId: "t3", verdict: "pass_with_risk", guardLevel: "L2", reviewMode: "self", evidenceIds: ["o3"], status: "accepted", ownerAccepted: true }, evidence, runs);
  assert.equal(selfReview.familyUnverified, false, "a self-review never claims cross-family, so it is not family-unverified");
});

test("handoff create --task focuses a single task and errors on an unknown id", () => {
  const ws = initHandoffWorkspace("handoff-focus");
  const t1 = makeTask(ws, "First task");
  addEvidence(ws, t1, "note", "n1");
  const t2 = makeTask(ws, "Second task");
  addEvidence(ws, t2, "note", "n2");

  const focused = runJson(["handoff", "create", "--task", t2, "--workspace", ws, "--json"]);
  assert.equal(focused.taskId, t2, "the focused draft records the task id");
  assert.equal(focused.counts.tasksConsidered, 1, "a focused draft considers exactly one task");
  // Only the focused task appears across the buckets.
  const allIds = [
    ...focused.model.done, ...focused.model.pending, ...focused.model.blocked, ...focused.model.unverified
  ].map((e) => e.id);
  assert.deepEqual(allIds, [t2], "only the focused task is in the model");
  // The filename encodes the task id.
  assert.match(path.basename(focused.file), new RegExp(`^handoff-${t2}-`), "the filename encodes the focused task id");

  const bad = runResult(["bin/ai-collab.js", "handoff", "create", "--task", "t999", "--workspace", ws]);
  assert.notEqual(bad.status, 0, "an unknown --task id must fail");
  assert.match(bad.stderr, /Task t999 not found/i);
});

test("handoff create surfaces in status and is documented in help; unknown subcommand fails", () => {
  const ws = initHandoffWorkspace("handoff-status");
  const t1 = makeTask(ws, "A task");
  addEvidence(ws, t1, "note", "n");
  // No drafts yet: status must not mention handoff drafts.
  const before = runCli(["status", "--workspace", ws]);
  assert.ok(!/Handoff drafts:/i.test(before), "status shows no handoff line before any draft exists");

  runCli(["handoff", "create", "--workspace", ws]);
  const after = runCli(["status", "--workspace", ws]);
  assert.match(after, /Handoff drafts:\s*1/i, "status surfaces the generated draft count");
  // --json carries the same draft list.
  const statusJson = runJson(["status", "--workspace", ws, "--json"]);
  assert.equal(statusJson.handoffDrafts.length, 1, "status --json lists the handoff drafts");

  // Help documents the command.
  const help = runCli(["help"]);
  assert.match(help, /handoff create/, "help must list handoff create");
  assert.match(help, /ACCEPTED receipt/i, "help must state only accepted receipts count as Done");

  // Unknown subcommand is a usage error, like the other groups.
  const bad = runResult(["bin/ai-collab.js", "handoff", "bogus", "--workspace", ws]);
  assert.notEqual(bad.status, 0, "an unknown handoff subcommand must fail");
  assert.match(bad.stderr, /Unknown handoff command/i);
});

// === bootstrap (first-experience value report) ==============================
//
// bootstrap reads the user's OWN recent work and prints an "AI collaboration
// baseline" — five cards (PROFILE CLUES / VERIFY / RESUME / ROLES / HARVEST). The
// whole point is HONESTY:
// a completion claim is never shown as verified/done unless the ledger's own honest
// functions say so; HARVEST candidates are proposed; the shipped seed is never
// counted as the user's result; and the report-only v1 writes NOTHING. These tests
// assemble a precise ledger through the REAL writers (never hand-written rows) so
// the receipt statuses are the tool's own, then assert the report stays honest.

// Build one workspace carrying a KNOWN mix of un-trustworthy and trustworthy state,
// using only the real CLI writers:
//   - t1: a pass_with_risk PENDING receipt (passed with a risk no one signed off).
//   - t2: a SELF-DECLARED cross-family receipt that auto-accepted locally
//         (computed L3, status accepted, familyUnverified: true) — accepted but NOT
//         independently verified, so it must read "unverified", never "done".
//   - t3: a NOTE-ONLY task marked done with no accepted receipt (the thin "done").
//   - t4: an OPEN task (in-progress, for RESUME).
//   - l1: a CONFIRMED harvest learning (for HARVEST).
// Returns the ids so each assertion can target a specific row.
function bootstrapScenarioWorkspace(label) {
  const ws = initHandoffWorkspace(label);

  // t1: pass_with_risk pending. Needs own-task run/output evidence so the verdict
  // is allowed; the receipt is created "pending" (no owner acceptance).
  const t1 = makeTask(ws, "Refactor auth flow");
  const e1 = addEvidence(ws, t1, "output", "ran the unit tests");
  const c1 = runJson([
    "receipt", "create", "--task", t1, "--verdict", "pass_with_risk", "--review-mode", "self",
    "--evidence", e1, "--workspace", ws, "--json"
  ]).receipt;
  assert.equal(c1.status, "pending", "precondition: a pass_with_risk receipt is created pending");

  // t2: self-declared cross-family pass -> computed L3, auto-accepted, familyUnverified.
  const t2 = makeTask(ws, "Add rate limiter");
  const x2 = addEvidence(ws, t2, "cross_family_guard", "a different family reviewed it", ["--reviewer", "gpt-guard", "--family", "openai"]);
  const c2 = runJson([
    "receipt", "create", "--task", t2, "--verdict", "pass", "--review-mode", "cross_family",
    "--evidence", x2, "--workspace", ws, "--json"
  ]).receipt;
  assert.equal(c2.status, "accepted", "precondition: a cross_family L3 pass auto-accepts locally");
  assert.equal(c2.familyUnverified, true, "precondition: the cross-family receipt is self-declared/unverified");

  // t3: note-only, marked done with no accepted receipt (thin done).
  const t3 = makeTask(ws, "Update docs");
  addEvidence(ws, t3, "note", "wrote a paragraph");
  const upd = runResult(["bin/ai-collab.js", "task", "update", "--task", t3, "--status", "done", "--workspace", ws]);
  assert.equal(upd.status, 0, "precondition: a note-backed task can be marked done (the writer allows it with a warning)");

  // t4: an open task (in progress).
  const t4 = makeTask(ws, "Wire CI cache");

  // l1: a confirmed harvest learning.
  const l1 = runJson(["learning", "add", "--type", "harvest", "--content", "define done before starting", "--workspace", ws, "--json"]).learning.id;
  runCli(["learning", "confirm", "--id", l1, "--workspace", ws]);

  return { ws, t1, c1, t2, c2, x2, t3, t4, l1 };
}

test("bootstrap: VERIFY lists every un-trustworthy completion and never shows one as done; self-declared cross-family carries the unverified marker", () => {
  const s = bootstrapScenarioWorkspace("bootstrap-verify");
  const out = runJson(["bootstrap", "--workspace", s.ws, "--yes", "--json"]);

  assert.equal(out.command, "bootstrap");
  assert.equal(out.ok, true);
  assert.equal(out.reportOnly, true, "v1 is report-only");
  assert.equal(out.hasOwnData, true, "the scenario has the user's own data");

  const verify = out.cards.verify;
  const byTask = new Map(verify.map((v) => [v.taskId, v]));

  // The pending pass_with_risk (t1) is listed and NOT shown as done.
  assert.ok(byTask.has(s.t1), "VERIFY must list the pending pass_with_risk task");
  assert.equal(byTask.get(s.t1).displayedAsDone, false, "t1 must NOT be shown as done");
  assert.equal(byTask.get(s.t1).receipt.verdict, "pass_with_risk");
  assert.equal(byTask.get(s.t1).receipt.status, "pending", "t1's receipt is shown as pending, not accepted/done");

  // The self-declared cross-family (t2) is listed, NOT done, and carries the marker.
  assert.ok(byTask.has(s.t2), "VERIFY must list the self-declared cross-family task");
  const v2 = byTask.get(s.t2);
  assert.equal(v2.displayedAsDone, false, "t2 must NOT be shown as done");
  assert.equal(v2.reason, "self_declared_cross_family", "t2's reason is the self-declared cross-family one");
  assert.equal(v2.receipt.familyUnverified, true, "t2 carries familyUnverified on the recomputed receipt");
  assert.match(v2.familyMarker, /self-declared cross-family, unverified/i, "t2 surfaces the self-declared cross-family marker text verbatim");
  // It is the RE-COMPUTED level (L3), not a fabricated higher one.
  assert.equal(v2.receipt.guardLevel, "L3", "t2 shows the recomputed L3, never an inflated level");

  // The note-only done (t3) is listed as author-marked, not done.
  assert.ok(byTask.has(s.t3), "VERIFY must list the note-only 'done' task");
  assert.equal(byTask.get(s.t3).displayedAsDone, false, "t3 must NOT be shown as done");
  assert.equal(byTask.get(s.t3).reason, "author_marked_done", "t3's reason is author-marked-done");

  // EVERY verify item is explicitly not-done (the load-bearing honesty invariant).
  for (const item of verify) {
    assert.equal(item.displayedAsDone, false, `VERIFY item ${item.taskId} must never be displayed as done`);
  }

  // The text report shows them as un-trustworthy and never under a "done/verified"
  // claim. The recomputed levels + the self-declared marker appear in the text too.
  const text = runCli(["bootstrap", "--workspace", s.ws, "--yes"]);
  assert.match(text, /VERIFY/, "the text report has a VERIFY card");
  assert.match(text, /self-declared cross-family, unverified/i, "the text surfaces the self-declared cross-family marker");
  assert.doesNotMatch(text, /\bverified done\b|\ballare done\b/i, "the report never claims these are verified-done");
});

test("bootstrap: HARVEST candidates are PROPOSED only and bootstrap writes NOTHING (report-only)", () => {
  const s = bootstrapScenarioWorkspace("bootstrap-harvest");

  // Snapshot every ledger BEFORE bootstrap so we can prove it wrote nothing.
  const before = {
    tasks: ledgerRows(s.ws, "tasks.jsonl"),
    evidence: ledgerRows(s.ws, "evidence.jsonl"),
    runs: ledgerRows(s.ws, "runs.jsonl"),
    receipts: ledgerRows(s.ws, "receipts.jsonl"),
    learning: ledgerRows(s.ws, "learning-ledger.jsonl")
  };

  const out = runJson(["bootstrap", "--workspace", s.ws, "--yes", "--json"]);
  const harvest = out.cards.harvest;

  // The confirmed learning is carried forward.
  assert.ok(
    harvest.confirmedLearnings.some((l) => l.id === s.l1 && (l.status === "confirmed" || l.status === "edited")),
    "HARVEST must carry the confirmed learning forward"
  );
  // Every candidate is explicitly PROPOSED (no auto-promotion).
  assert.ok(harvest.candidates.length > 0, "the scenario yields at least one harvest candidate");
  for (const c of harvest.candidates) {
    assert.equal(c.proposed, true, `harvest candidate ${c.kind} must be proposed, never auto-applied`);
  }
  // The text says nothing is saved automatically.
  const text = runCli(["bootstrap", "--workspace", s.ws, "--yes"]);
  assert.match(text, /nothing is saved automatically/i, "the HARVEST card must say nothing is saved automatically");

  // RED LINE: report-only bootstrap mutated NO ledger.
  const after = {
    tasks: ledgerRows(s.ws, "tasks.jsonl"),
    evidence: ledgerRows(s.ws, "evidence.jsonl"),
    runs: ledgerRows(s.ws, "runs.jsonl"),
    receipts: ledgerRows(s.ws, "receipts.jsonl"),
    learning: ledgerRows(s.ws, "learning-ledger.jsonl")
  };
  assert.deepEqual(after, before, "bootstrap (report-only) must not write to any ledger");
});

test("bootstrap: an empty / seed-only workspace honestly reports no data of your own (never counts the shipped seed)", () => {
  const ws = initHandoffWorkspace("bootstrap-empty");
  // A fresh init ships exactly the synthetic seed set and nothing else.
  const out = runJson(["bootstrap", "--workspace", ws, "--yes", "--json"]);

  assert.equal(out.hasOwnData, false, "a seed-only workspace has no data of the user's own");
  assert.equal(out.seedOnly, true, "a seed-only workspace is flagged seedOnly");
  // The seed rows are excluded from the user's own counts.
  assert.equal(out.counts.ownTasks, 0, "the seed task is not counted as the user's");
  assert.equal(out.counts.ownReceipts, 0, "the seed receipt is not counted as the user's");
  assert.equal(out.counts.ownLearning, 0, "the seed learning is not counted as the user's");
  // No un-trustworthy items invented from the seed.
  assert.equal(out.cards.verify.length, 0, "a seed-only workspace yields no VERIFY items (the seed is not the user's claim)");

  const text = runCli(["bootstrap", "--workspace", ws, "--yes"]);
  assert.match(text, /don.t have any of your own work recorded yet|no data of your own/i, "the text honestly says there is no data of the user's own");
  assert.match(text, /example seed is intentionally excluded|not your result/i, "the text states the seed is excluded, not counted as a result");
});

test("bootstrap: the consent gate prints the scan scope and refuses to scan without --yes (and promises local, no-network)", () => {
  const s = bootstrapScenarioWorkspace("bootstrap-consent");

  // Without --yes: print the scope, require an explicit opt-in, run no scan.
  const gated = runResult(["bin/ai-collab.js", "bootstrap", "--workspace", s.ws]);
  assert.equal(gated.status, 0, "the consent preview is not an error");
  assert.match(gated.stdout, /read-only/i, "the consent preview states the scan is read-only");
  assert.match(gated.stdout, /sends nothing anywhere|no.*network|not used/i, "the consent preview promises nothing leaves the machine");
  assert.match(gated.stdout, /--yes/, "the consent preview tells the user to re-run with --yes");
  // It must NOT have produced a report (no VERIFY card text) before consent.
  assert.doesNotMatch(gated.stdout, /VERIFY —/, "no baseline report is produced before --yes");

  // --json consent gate is machine-readable and flags consentRequired.
  const gatedJson = JSON.parse(runResult(["bin/ai-collab.js", "bootstrap", "--workspace", s.ws, "--json"]).stdout);
  assert.equal(gatedJson.ok, false, "the --json consent gate reports ok:false");
  assert.equal(gatedJson.consentRequired, true, "the --json consent gate flags consentRequired");

  // WITH --yes: the report is produced.
  const allowed = runCli(["bootstrap", "--workspace", s.ws, "--yes"]);
  assert.match(allowed, /Your AI collaboration baseline/i, "with --yes the baseline report is produced");
});

test("bootstrap: --json scan reflects the real local structure (reused adapters detect + read-only git signals)", () => {
  // Build a scenario workspace, then make its PROJECT ROOT a real git repo with an
  // AI instruction file and churn, so the scan exercises detectTools + git parsing.
  const s = bootstrapScenarioWorkspace("bootstrap-scan");
  const projectRoot = path.dirname(s.ws); // the dir that holds .aict
  writeFileSync(path.join(projectRoot, "AGENTS.md"), "agent rules\n");
  writeFileSync(path.join(projectRoot, "CLAUDE.md"), "claude rules\n");
  // a real git repo with one file re-touched across several commits + an uncommitted change
  const git = (...a) => spawnSync("git", a, { cwd: projectRoot, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "t@t.t");
  git("config", "user.name", "t");
  writeFileSync(path.join(projectRoot, "churn.txt"), "v0\n");
  git("add", "-A"); git("commit", "-qm", "init");
  for (const i of [1, 2, 3]) {
    writeFileSync(path.join(projectRoot, "churn.txt"), `v${i}\n`);
    git("add", "-A"); git("commit", "-qm", `fix churn ${i}`);
  }
  writeFileSync(path.join(projectRoot, "churn.txt"), "uncommitted\n");

  // bootstrap resolves the project root as the parent of the .aict workspace.
  const out = runJson(["bootstrap", "--workspace", s.ws, "--yes", "--json"]);

  // Reused adapters detect logic finds the instruction files -> tools.
  assert.ok(out.scan.ai.detectedTools.includes("claude"), "the scan detects claude via CLAUDE.md (reused adapters detect)");
  assert.ok(out.scan.ai.detectedTools.includes("codex"), "the scan detects codex via AGENTS.md (reused adapters detect)");
  // Read-only git signals: it is a repo, has the churn file in many commits, and is dirty.
  assert.equal(out.scan.git.isRepo, true, "the scan sees a git repo");
  assert.equal(out.scan.git.hasUncommittedChanges, true, "the scan sees the uncommitted change");
  assert.ok(
    out.scan.git.repeatedlyTouched.some((r) => r.file === "churn.txt" && r.commits >= 3),
    "the scan flags the repeatedly re-touched file (a 'said done, still patching' signal)"
  );
  // RESUME surfaces the same churn signal + the missing handoff.
  assert.ok(
    out.cards.resume.gitDrift.repeatedlyTouched.some((r) => r.file === "churn.txt"),
    "RESUME carries the repeatedly-touched signal"
  );
  assert.equal(out.cards.resume.missingHandoff, true, "RESUME flags a missing handoff while work is in flight");
});

test("bootstrap: its cards are DERIVED from the shared honest functions, not a private re-implementation", () => {
  // buildBootstrapModel must agree, row-for-row, with buildHandoffModel's honest
  // bucketing: the VERIFY card cannot mark anything done that buildHandoffModel did
  // not put in Done, and a self-declared cross-family receipt that buildHandoffModel
  // routes to Unverified must show up in VERIFY. We assert the model directly (unit
  // level), so a future refactor that re-implements the level logic would break here.
  const s = bootstrapScenarioWorkspace("bootstrap-derive");
  const ledgers = {
    tasks: ledgerRows(s.ws, "tasks.jsonl"),
    evidence: ledgerRows(s.ws, "evidence.jsonl"),
    runs: ledgerRows(s.ws, "runs.jsonl"),
    receipts: ledgerRows(s.ws, "receipts.jsonl"),
    learning: ledgerRows(s.ws, "learning-ledger.jsonl")
  };
  // The shared honest source of truth.
  const handoff = buildHandoffModel(ledgers);
  // The bootstrap model (scan is irrelevant to the card-derivation assertion).
  const scan = scanLocalStructure({ workspaceRoot: s.ws, repoRoot: path.dirname(s.ws), git: { available: false } });
  const model = buildBootstrapModel({ ledgers, scan, handoffDraftCount: 0 });

  // buildHandoffModel found ZERO Done tasks here (t1 pending, t2 self-declared
  // cross-family, t3 note-only-done) — so VERIFY must not display ANY task as done.
  assert.equal(handoff.counts.done, 0, "precondition: the honest model has no Done task in this scenario");
  for (const v of model.cards.verify) {
    assert.equal(v.displayedAsDone, false, "no VERIFY item is shown done when the honest model has no Done task");
  }
  // Every task buildHandoffModel routed to Unverified must be represented in VERIFY.
  const verifyTaskIds = new Set(model.cards.verify.map((v) => v.taskId));
  for (const entry of handoff.unverified) {
    assert.ok(verifyTaskIds.has(entry.id), `VERIFY must include the honest-model Unverified task ${entry.id}`);
  }
  // HARVEST's confirmed learnings are exactly buildHandoffModel's kept learnings.
  assert.deepEqual(
    model.cards.harvest.confirmedLearnings.map((l) => l.id).sort(),
    handoff.learnings.map((l) => l.id).sort(),
    "HARVEST confirmed learnings come straight from the shared model's kept learnings"
  );
});

test("bootstrap: parseRepeatedlyTouchedFiles counts distinct commits per file and ignores commit-message lines", () => {
  // A deterministic unit check of the git-log parser (the trickiest scan helper):
  // fileA appears in 3 commits, fileB in 1; indented message bodies and headers are
  // not paths. Only fileA (>= 3 commits) is a "kept re-fixing it" signal.
  const log = [
    "commit aaa111",
    "Author: x <x@y.z>",
    "Date: now",
    "",
    "    fix the thing in src/fileA.js",       // indented message: NOT a path
    "",
    "src/fileA.js",
    "README.md",
    "commit bbb222",
    "Author: x <x@y.z>",
    "Date: now",
    "",
    "    still patching fileA",
    "",
    "src/fileA.js",
    "commit ccc333",
    "Author: x <x@y.z>",
    "Date: now",
    "",
    "    again",
    "",
    "src/fileA.js",
    "src/fileB.js"
  ].join("\n");
  const out = parseRepeatedlyTouchedFiles(log, { minCommits: 3, limit: 5 });
  assert.equal(out.length, 1, "only the file touched in >= 3 commits is flagged");
  assert.equal(out[0].file, "src/fileA.js");
  assert.equal(out[0].commits, 3, "distinct commits are counted (not raw line repeats)");
  // An empty / non-string log yields no signal (graceful).
  assert.deepEqual(parseRepeatedlyTouchedFiles(""), []);
  assert.deepEqual(parseRepeatedlyTouchedFiles(undefined), []);
});

// === bootstrap Part A: the two DETERMINISTIC cards (profile clues + roles) =====
//
// The architectural red line for both cards: they may list only CONCRETE,
// machine-observable facts the user can recognise (a detected tool, a file
// extension, a keyword that literally appears in a title) — NEVER a semantic verdict
// ("you prefer X", "you value Y", "this work IS risky"). bootstrap is report-only:
// no model, no profile write, no network. These tests assert the cards carry
// evidence + the explicit no-conclusion flag, degrade honestly with no signal, and
// never count the shipped seed as the user's own work.

// A minimal scan fixture for the pure-unit card builders (they read only the scan
// shape scanLocalStructure produces — detectedTools, recentlyModified, packageJson).
function fakeScan({ detectedTools = [], recentlyModified = [], testScript = null, pkgPresent = true } = {}) {
  return {
    repoRoot: "/tmp/fake",
    // git is always populated by the real scanLocalStructure; the RESUME card reads
    // it, so the fixture mirrors the empty-but-present shape (no churn, clean tree).
    git: { available: false, isRepo: false, root: null, hasUncommittedChanges: false, diffStat: "", repeatedlyTouched: [] },
    ai: { detectedTools, instructionFiles: [] },
    recentlyModified,
    packageJson: { present: pkgPresent, scripts: testScript ? ["test"] : [], testScript }
  };
}

test("bootstrap Part A: buildProfileCard lists deterministic signals (tools, file types, test script) and draws NO semantic conclusion", () => {
  const card = buildProfileCard(fakeScan({
    detectedTools: ["claude", "cursor"],
    recentlyModified: ["app.ts", "db.sql", "notes.ts", "Makefile"],
    testScript: "node --test"
  }));

  // Detected tools are surfaced as a FACT; >= 2 is flagged as a cross-tool signal.
  assert.deepEqual(card.detectedTools, ["claude", "cursor"], "the detected tools are carried verbatim");
  assert.equal(card.multiTool, true, "two tools set the cross-tool (multiTool) signal");

  // The file-type distribution is a deterministic ext count (a .ts ×2, .sql ×1, and
  // the extensionless Makefile bucketed honestly under '(no ext)').
  const byExt = new Map(card.fileTypes.map((f) => [f.ext, f.count]));
  assert.equal(byExt.get(".ts"), 2, "two .ts files are counted");
  assert.equal(byExt.get(".sql"), 1, "one .sql file is counted");
  assert.equal(byExt.get("(no ext)"), 1, "an extensionless file is bucketed under (no ext), not dropped");

  // The test-script presence is a fact, not "you value testing" as a verdict.
  assert.equal(card.hasTestScript, true, "a package.json test script is detected as a signal");

  // THE RED LINE: the card explicitly draws no semantic conclusion.
  assert.equal(card.semanticConclusion, false, "buildProfileCard must NEVER mark a semantic conclusion (report-only)");

  // The rendered text states the clues + the fixed honesty footer, and contains no
  // verdict phrasing ("you prefer/you like/you are a ...").
  const scan = fakeScan({ detectedTools: ["claude", "cursor"], recentlyModified: ["app.ts", "db.sql"], testScript: "node --test" });
  // One real (non-seed) task so hasOwnData is true and the cards render (an empty
  // ledger short-circuits to the honest "no data yet" block instead of the cards).
  const model = buildBootstrapModel({
    ledgers: { tasks: [{ id: "t1", title: "Tidy the home page", status: "open", createdAt: "2026-06-01T00:00:00.000Z" }] },
    scan
  });
  const text = renderBootstrapReport(model, "en");
  assert.match(text, /PROFILE CLUES/, "the profile card has a title");
  assert.match(text, /clues, not conclusions/i, "the profile card states the no-conclusion footer");
  assert.doesNotMatch(text, /you (prefer|like|are a|tend to|usually)\b/i, "the profile card never phrases a semantic verdict");
});

test("bootstrap Part A: buildProfileCard degrades honestly with no signals (no tools, no files) and still draws no conclusion", () => {
  const card = buildProfileCard(fakeScan({ detectedTools: [], recentlyModified: [], testScript: null }));
  assert.deepEqual(card.detectedTools, [], "no tools detected -> empty list, not a guess");
  assert.equal(card.multiTool, false, "no cross-tool signal with zero tools");
  assert.deepEqual(card.fileTypes, [], "no recent files -> empty distribution");
  assert.equal(card.hasTestScript, false, "no test script -> false, not assumed");
  assert.equal(card.semanticConclusion, false, "still no semantic conclusion when there is nothing to show");
});

test("bootstrap Part A: buildRolesCard maps high-risk KEYWORDS in task titles + file paths to EXISTING roles, with the matched evidence and no risk verdict", () => {
  const tasks = [
    { id: "t1", title: "Refactor payment callback", createdAt: "2026-06-01T00:00:00.000Z" },
    { id: "t2", title: "Tidy the footer styles", createdAt: "2026-06-01T00:00:00.000Z" }
  ];
  // Real scanRecentlyModified returns BASENAMES only (single-level readdir, never a
  // dir-prefixed path), so the fixture uses basenames to stay faithful to the scan.
  const scan = fakeScan({ recentlyModified: ["login.ts", "README.md"] });
  const card = buildRolesCard(tasks, scan);

  assert.equal(card.hasHighRisk, true, "a payment/login title+file is a high-risk match");
  assert.equal(card.semanticConclusion, false, "buildRolesCard must NEVER decide the work IS risky (only that a high-risk WORD appears)");

  // Each hit carries the matched evidence (the exact subject + the literal keyword).
  const paymentHit = card.hits.find((h) => h.subject === "Refactor payment callback");
  assert.ok(paymentHit, "the payment task is a hit");
  assert.equal(paymentHit.keyword, "payment", "the hit names the literal keyword that matched");
  assert.equal(paymentHit.source, "task", "a title hit is sourced as a task");
  const loginHit = card.hits.find((h) => h.subject === "login.ts");
  assert.ok(loginHit, "the login file is a hit");
  assert.equal(loginHit.keyword, "login", "the file hit names the literal keyword");
  assert.equal(loginHit.source, "file", "a file-path hit is sourced as a file");

  // The non-risky task and the README are NOT hits (no false positives).
  assert.ok(!card.hits.some((h) => h.subject === "Tidy the footer styles"), "a benign title is not a hit");
  assert.ok(!card.hits.some((h) => h.subject === "README.md"), "a benign file is not a hit");

  // The suggested roles are ones that ACTUALLY ship in the open-source workspace
  // (.aict/skills/ + .aict/mechanisms/) — never an invented role name. `repoRoot` is
  // the module-level constant (the repo root) already defined at the top of this file.
  const allRoleIds = new Set(card.roles.map((r) => r.id));
  for (const id of allRoleIds) {
    const inSkills = existsSync(path.join(repoRoot, ".aict", "skills", id));
    const inMechanisms = existsSync(path.join(repoRoot, ".aict", "mechanisms", id));
    assert.ok(inSkills || inMechanisms, `suggested role "${id}" must exist as a shipped role package (skills/ or mechanisms/)`);
  }
  // payment/auth -> red-team + dual-guard are present.
  assert.ok(allRoleIds.has("red-team") && allRoleIds.has("dual-guard"), "money/auth keywords suggest red-team + dual-guard");
});

test("bootstrap Part A: buildRolesCard is honest with NO high-risk match, EXCLUDES the shipped seed, and caps suggestions at top 3", () => {
  // (a) No high-risk word anywhere -> honest no-match, never a manufactured suggestion.
  const benign = buildRolesCard(
    [{ id: "t1", title: "Polish the about page", createdAt: "2026-06-01T00:00:00.000Z" }],
    fakeScan({ recentlyModified: ["styles.css", "about.md"] })
  );
  assert.equal(benign.hasHighRisk, false, "no high-risk keyword -> hasHighRisk:false");
  assert.deepEqual(benign.hits, [], "no hits are invented");
  assert.deepEqual(benign.roles, [], "no roles suggested when nothing matched");
  const benignText = renderBootstrapReport(buildBootstrapModel({
    ledgers: { tasks: [{ id: "t1", title: "Polish the about page", status: "open", createdAt: "2026-06-01T00:00:00.000Z" }] },
    scan: fakeScan({ recentlyModified: ["styles.css"] })
  }), "en");
  assert.match(benignText, /No high-risk keywords matched/i, "the roles card honestly states the keyword-scan fact, not a low-risk verdict");
  assert.match(benignText, /not a verdict that the work is low-risk/i, "the no-match copy explicitly disclaims a low-risk verdict (no semantic leap)");
  assert.doesNotMatch(benignText, /routine work|one tool is enough/i, "the old semantic-leap phrasing is gone");

  // (b) The shipped SEED task (t0 + the synthetic timestamp) carries 'payment'-like
  // risk words in the example, but it is NOT the user's work — it must never produce
  // a role suggestion. The synthetic seed timestamp is the fixed SYNTHETIC_SEED_TS
  // value isSeedRow keys on (kept inline so this test adds no new import).
  const seedTask = { id: "t0", title: "Add payment auth login token", createdAt: "2026-01-01T00:00:00.000Z" };
  const seedCard = buildRolesCard([seedTask], fakeScan({ recentlyModified: [] }));
  assert.equal(seedCard.hasHighRisk, false, "the shipped seed task never manufactures a roles suggestion");
  assert.deepEqual(seedCard.hits, [], "no hits derive from the seed");

  // (c) Many high-risk tasks -> suggestions are capped at top 3 (no bombardment).
  const many = buildRolesCard([
    { id: "t1", title: "auth one", createdAt: "2026-06-01T00:00:00.000Z" },
    { id: "t2", title: "payment two", createdAt: "2026-06-01T00:00:00.000Z" },
    { id: "t3", title: "deploy three", createdAt: "2026-06-01T00:00:00.000Z" },
    { id: "t4", title: "crypto four", createdAt: "2026-06-01T00:00:00.000Z" },
    { id: "t5", title: "schema five", createdAt: "2026-06-01T00:00:00.000Z" }
  ], fakeScan({ recentlyModified: [] }));
  assert.equal(many.hits.length, 3, "at most the top 3 high-risk items are listed (no bombardment)");
  assert.equal(many.semanticConclusion, false, "still no semantic conclusion under many matches");
});

test("bootstrap Part A: the CLI renders FIVE cards in order (profile->VERIFY->RESUME->roles->HARVEST) and --json keeps English field names", () => {
  // A real workspace with a high-risk task so the roles card has content.
  const ws = initHandoffWorkspace("bootstrap-five-cards");
  makeTask(ws, "Wire the payment webhook");

  const text = runCli(["bootstrap", "--workspace", ws, "--yes"]);
  // All five card headers appear, in the required order.
  const iProfile = text.indexOf("PROFILE CLUES");
  const iVerify = text.indexOf("VERIFY");
  const iResume = text.indexOf("RESUME");
  const iRoles = text.indexOf("ROLES TO CONSIDER");
  const iHarvest = text.indexOf("HARVEST");
  for (const [label, idx] of [["profile", iProfile], ["verify", iVerify], ["resume", iResume], ["roles", iRoles], ["harvest", iHarvest]]) {
    assert.ok(idx >= 0, `the ${label} card must be present`);
  }
  assert.ok(iProfile < iVerify && iVerify < iResume && iResume < iRoles && iRoles < iHarvest,
    "cards render in order: profile -> VERIFY -> RESUME -> roles -> HARVEST");
  // The high-risk roles hint is appended to the Next block (advisory, not a write).
  assert.match(text, /high-risk keywords showed up in your work/i, "a high-risk match adds the roles hint to Next");

  // --json: the new cards are present with STABLE English field names (the data
  // contract stays English even though display is localizable).
  const out = runJson(["bootstrap", "--workspace", ws, "--yes", "--json"]);
  assert.ok(out.cards.profile, "--json carries the profile card");
  assert.ok(out.cards.roles, "--json carries the roles card");
  assert.equal(out.cards.profile.semanticConclusion, false, "--json profile card asserts no semantic conclusion");
  assert.equal(out.cards.roles.semanticConclusion, false, "--json roles card asserts no semantic conclusion");
  assert.equal(out.cards.roles.hasHighRisk, true, "the payment task makes the roles card high-risk");
  // English field names (not localized) in the --json contract.
  for (const key of ["hasHighRisk", "hits", "roles", "semanticConclusion"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(out.cards.roles, key), `--json roles card keeps the English field name "${key}"`);
  }

  // Even in --lang zh the --json field NAMES stay English (only display text localizes).
  const outZh = runJson(["bootstrap", "--workspace", ws, "--yes", "--json", "--lang", "zh"]);
  assert.ok(Object.prototype.hasOwnProperty.call(outZh.cards.roles, "hasHighRisk"), "--json field names stay English under --lang zh");
});

test("bootstrap: help documents the command and init points first-time users to it", () => {
  // The command is documented (term-light first screen; details carry the terms).
  const help = runCli(["help"]);
  assert.match(help, /ai-collab bootstrap \[--workspace <dir>\] \[--report-only\] \[--json\] \[--yes\]/, "help lists the bootstrap usage line");
  assert.match(help, /bootstrap: the read-only scan engine the first-run walkthrough uses/i, "help explains bootstrap");
  assert.match(help, /WRITES NOTHING|report-only/i, "help states bootstrap writes nothing");

  // init's success output points a brand-new user at bootstrap.
  const target = mkdtempSync(path.join(tmpdir(), "aicos-bootstrap-initlink-"));
  const initOut = runCli(["init", "--target", target, "--force"]);
  assert.match(initOut, /bootstrap/, "init success output suggests bootstrap");
  const initJson = runJson(["init", "--target", path.join(target, "again"), "--force", "--json"]);
  assert.match(String(initJson.nextValueReport ?? ""), /bootstrap --yes/, "init --json carries the bootstrap next-step");

  // An unknown bootstrap-adjacent typo still routes through the normal suggestion path.
  const typo = runResult(["bin/ai-collab.js", "bootstrp"]);
  assert.notEqual(typo.status, 0, "a typo'd command fails");
  assert.match(typo.stderr, /Unknown command: bootstrp/i);
  assert.match(typo.stderr, /Did you mean 'bootstrap'\?/i, "the typo suggests bootstrap");
});

// === i18n (bilingual EN/ZH, honesty-faithful) ===============================
//
// The CLI now speaks the user's language. These tests pin down BOTH halves of the
// contract: (1) resolveLocale's precedence ladder + t()'s interpolation/fallback are
// pure-unit verified; (2) the --lang zh end-to-end output is real Chinese AND keeps
// every honesty marker FAITHFUL — the authoritative caveats ("自报跨族·未经验证",
// "候选——不会自动保存", "作者自行标记完成·背后没有已签收的复核", etc.) must appear,
// and an un-trustworthy claim must NEVER be rendered as 已验证 / 已完成 / 已保存.

// Run the CLI with an EXPLICIT language, deliberately bypassing the English pin in
// run()/runResult() (so these tests observe the real localized output). We force the
// env language AND pass --lang to cover both sources; --lang wins regardless.
function runLang(lang, args, options = {}) {
  const res = spawnSync(nodeBin, ["bin/ai-collab.js", "--lang", lang, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
    env: { ...(options.env || process.env), AI_COLLAB_LANG: lang }
  });
  return res;
}

// --- resolveLocale: the precedence ladder (pure) ----------------------------
test("i18n resolveLocale: --lang flag > AI_COLLAB_LANG > OS locale > default 'en'", () => {
  // Default: nothing set -> English.
  assert.equal(resolveLocale({ env: {} }), "en", "no signal -> en");
  assert.equal(resolveLocale({}), "en", "no args -> en");

  // Flag wins outright over every other source.
  assert.equal(resolveLocale({ langFlag: "zh", env: { AI_COLLAB_LANG: "en", LANG: "en_US.UTF-8" } }), "zh", "--lang zh overrides env+LANG");
  assert.equal(resolveLocale({ langFlag: "en", env: { AI_COLLAB_LANG: "zh", LANG: "zh_CN.UTF-8" } }), "en", "--lang en overrides env+LANG");
  // An unsupported flag value falls THROUGH to the next source (never hard-fails).
  assert.equal(resolveLocale({ langFlag: "fr", env: { AI_COLLAB_LANG: "zh" } }), "zh", "an unsupported --lang falls through to env");
  assert.equal(resolveLocale({ langFlag: "", env: { LANG: "zh_CN.UTF-8" } }), "zh", "an empty --lang falls through to LANG");

  // AI_COLLAB_LANG beats the OS locale.
  assert.equal(resolveLocale({ env: { AI_COLLAB_LANG: "zh", LANG: "en_US.UTF-8" } }), "zh", "env zh overrides LANG en");
  assert.equal(resolveLocale({ env: { AI_COLLAB_LANG: "EN", LANG: "zh_CN.UTF-8" } }), "en", "env EN (case-insensitive) overrides LANG zh");

  // OS locale, POSIX precedence LC_ALL > LC_MESSAGES > LANG.
  assert.equal(resolveLocale({ env: { LANG: "zh_CN.UTF-8" } }), "zh", "LANG zh -> zh");
  assert.equal(resolveLocale({ env: { LANG: "en_US.UTF-8" } }), "en", "LANG en -> en");
  assert.equal(resolveLocale({ env: { LC_ALL: "zh_CN.UTF-8", LANG: "en_US.UTF-8" } }), "zh", "LC_ALL beats LANG");
  assert.equal(resolveLocale({ env: { LC_MESSAGES: "zh_CN.UTF-8", LANG: "en_US.UTF-8" } }), "zh", "LC_MESSAGES beats LANG");
  assert.equal(resolveLocale({ env: { LC_ALL: "en_US.UTF-8", LC_MESSAGES: "zh_CN.UTF-8", LANG: "zh_CN.UTF-8" } }), "en", "LC_ALL (en) wins over LC_MESSAGES/LANG (zh)");
  // An empty LC_ALL must NOT win — fall through to the next non-empty source.
  assert.equal(resolveLocale({ env: { LC_ALL: "", LANG: "zh_CN.UTF-8" } }), "zh", "empty LC_ALL falls through to LANG");
  // A "C"/"POSIX" locale is not zh -> default en.
  assert.equal(resolveLocale({ env: { LANG: "C.UTF-8" } }), "en", "C locale -> en");
  assert.equal(resolveLocale({ env: { LANG: "POSIX" } }), "en", "POSIX locale -> en");
  // zh variants (zh_TW, zh-Hans, bare zh) all resolve to zh.
  assert.equal(resolveLocale({ env: { LANG: "zh_TW.UTF-8" } }), "zh", "zh_TW -> zh");
  assert.equal(resolveLocale({ env: { LANG: "zh" } }), "zh", "bare zh -> zh");
});

// B6a-3 (cross-platform robustness): resolveLocale must default cleanly to 'en' on a
// host that has NO POSIX locale variables at all — most importantly Windows, which
// normally sets none of LANG / LC_ALL / LC_MESSAGES. It must NEVER throw on a missing
// or empty locale variable; the absence of a signal is simply "fall through to en".
test("B6a-3: resolveLocale defaults to 'en' with no locale env (Windows / bare shell) and never throws on empty vars", () => {
  // A realistic Windows process.env: plenty of vars, but none of the POSIX locale ones.
  const windowsLikeEnv = {
    OS: "Windows_NT",
    SystemRoot: "C:\\Windows",
    USERPROFILE: "C:\\Users\\dev",
    Path: "C:\\Windows\\system32",
    COMPUTERNAME: "DESKTOP-ABC",
    PROCESSOR_ARCHITECTURE: "AMD64"
  };
  assert.equal(resolveLocale({ env: windowsLikeEnv }), "en", "no LANG/LC_* (Windows) -> en");
  // Even the AI_COLLAB_LANG override absent: still 'en', no throw.
  assert.doesNotThrow(() => resolveLocale({ env: windowsLikeEnv }), "must not throw when locale vars are absent");

  // A truly empty env (every variable missing) defaults to 'en'.
  assert.equal(resolveLocale({ env: {} }), "en", "empty env -> en");
  // No `env` key at all (called with {}): the default param kicks in -> 'en', no throw.
  assert.doesNotThrow(() => resolveLocale({}), "must not throw when env is omitted");
  assert.equal(resolveLocale({}), "en", "omitted env -> en");
  // Called with NO argument object at all: the `= {}` default applies -> 'en', no throw.
  assert.doesNotThrow(() => resolveLocale(), "must not throw when called with no args");
  assert.equal(resolveLocale(), "en", "no args at all -> en");

  // An EMPTY-STRING LANG (a shell that exports LANG= with no value) must NOT be treated
  // as a zh (or any) signal — it falls through to 'en', and never mis-parses "".
  assert.equal(resolveLocale({ env: { LANG: "" } }), "en", "empty-string LANG -> en (not misjudged)");
  // Whitespace-only locale values are likewise not a signal.
  assert.equal(resolveLocale({ env: { LANG: "   " } }), "en", "whitespace-only LANG -> en");
  assert.equal(resolveLocale({ env: { LC_ALL: "", LC_MESSAGES: "", LANG: "" } }), "en", "all-empty locale vars -> en");
  // A non-string locale value (e.g. an env shim that yielded a non-string) must not crash.
  assert.doesNotThrow(() => resolveLocale({ env: { LANG: 123 } }), "a non-string locale value must not throw");
  assert.equal(resolveLocale({ env: { LANG: 123 } }), "en", "a non-string LANG is ignored -> en");
});

// --- t(): interpolation + the zh -> en -> key fallback chain -----------------
test("i18n t(): interpolates {params} and falls back zh -> en -> key (never empty, never crash)", () => {
  // Interpolation in both languages.
  assert.equal(t("error.missingOption", { name: "task" }, "en"), "Missing --task.");
  assert.equal(t("error.missingOption", { name: "task" }, "zh"), "缺少 --task。");
  // Multiple placeholders.
  assert.match(t("error.taskNotFound.update", { id: "t9" }, "zh"), /未找到任务 t9/);
  // A present-but-undefined/null param renders as the EMPTY string — never the literal
  // "undefined" (which would be a misleading value in a user-facing string).
  const nullParam = t("error.missingOption", { name: undefined }, "en");
  assert.equal(nullParam, "Missing --.", "a present-but-undefined param interpolates to empty, not 'undefined'");
  assert.doesNotMatch(nullParam, /undefined/);
  const nullParamZh = t("error.taskNotFound.update", { id: null }, "zh");
  assert.doesNotMatch(nullParamZh, /undefined|null/, "a null param never prints the words 'undefined'/'null'");
  // An ABSENT placeholder (no key at all) is left VISIBLE as {name} — a deliberate
  // debug aid (a silently-blank slot would hide a missing-param bug), and crucially
  // never "undefined". Every real call site supplies its params, so users do not see
  // this; it only guards a developer mistake.
  const absentParam = t("error.missingOption", {}, "en");
  assert.equal(absentParam, "Missing --{name}.", "an absent param leaves the placeholder visible (debuggable), never 'undefined'");
  assert.doesNotMatch(absentParam, /undefined/);

  // Fallback: a key present in en but (hypothetically) absent in zh resolves to en.
  // We simulate by asking for a key that exists only in en. Every real key has both,
  // so we verify the MECHANISM via a key we know is en-only-safe: temporarily, any
  // key missing from zh must equal its en value. Assert the invariant directly:
  // every zh key that is missing should fall back, and an unknown key returns itself.
  assert.equal(t("totally.unknown.key.xyz", {}, "zh"), "totally.unknown.key.xyz", "an unknown key returns the key itself (visible, never empty)");
  assert.equal(t("totally.unknown.key.xyz", {}, "en"), "totally.unknown.key.xyz", "unknown key in en also returns the key");

  // Default locale is 'en' when omitted.
  assert.equal(t("common.networkNotUsed"), "Network: not used.", "t() defaults to en");
  assert.equal(t("common.networkNotUsed", {}, "zh"), "网络：未使用。");

  // Catalog integrity: every key in zh also exists in en (en is canonical, so any zh
  // key without an en twin is a typo that would silently lose its fallback).
  for (const key of Object.keys(MESSAGES.zh)) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(MESSAGES.en, key),
      `zh key "${key}" must have an en canonical twin`
    );
  }
});

// --- The authoritative honesty glossary is present, verbatim, in the catalog ---
test("i18n: the authoritative Chinese honesty translations are present verbatim and never soften the caveat", () => {
  // Each mandated translation must appear EXACTLY as specified.
  assert.equal(MESSAGES.zh["marker.selfDeclaredCrossFamily"], "自报跨族·未经验证");
  assert.equal(MESSAGES.zh["level.L1"].includes("证据太薄·不算通过"), true, "L1 plain language is faithful");
  assert.equal(MESSAGES.zh["level.L2"], "单工具自查·只能睁眼接受风险");
  assert.equal(MESSAGES.zh["level.L2_5"].includes("同工具换模型·弱跨族"), true, "L2.5 plain language is faithful");
  assert.equal(MESSAGES.zh["level.L3"].includes("跨族复核·但家族系自报"), true, "L3 plain language is faithful");
  assert.equal(MESSAGES.zh["level.L4"].includes("本地最强·真执行并已对账复核"), true, "L4 plain language is faithful");
  assert.equal(MESSAGES.zh["bootstrap.verify.title"], "VERIFY——哪些『完成』暂时还不能信");
  assert.equal(MESSAGES.zh["bootstrap.verify.reason.pass_with_risk_unaccepted"], "只是带着一个尚无人签字确认的风险通过");
  assert.equal(MESSAGES.zh["bootstrap.verify.reason.self_declared_cross_family"], "自报的跨族复核——本工具无法验证另一个模型是否真的检查过");
  assert.equal(MESSAGES.zh["bootstrap.verify.reason.author_marked_done"], "作者自行标记完成·背后没有已签收的复核");
  assert.equal(MESSAGES.zh["bootstrap.harvest.candidate"], "  - {detail}（候选——不会自动保存任何东西）。");
  assert.equal(MESSAGES.zh["bootstrap.empty.line1"], "你还没有记录任何自己的工作——目前只有内置示例。");
  assert.equal(MESSAGES.zh["bootstrap.empty.note"], "（示例种子被刻意排除——那不是你的成果。）");

  // L0-L4 codes are NEVER translated (universal symbols) — they stay literal.
  for (const code of ["L0", "L1", "L2", "L2.5", "L3", "L4"]) {
    assert.match(MESSAGES.zh["help.levels"], new RegExp(code.replace(".", "\\.")), `the zh levels help keeps the ${code} code literal`);
  }
});

// --- status --lang zh: full Chinese output, honesty markers faithful --------
test("i18n: `status --lang zh` prints Chinese with the honesty markers faithful (never says verified/done)", () => {
  // Build a scenario with a self-declared cross-family pass (the honesty hot spot).
  const s = bootstrapScenarioWorkspace("i18n-status-zh");
  const res = runLang("zh", ["status", "--workspace", s.ws]);
  assert.equal(res.status, 0, "status --lang zh exits cleanly");
  const out = res.stdout;

  // Chrome is Chinese.
  assert.match(out, /^工作区状态/m, "title is Chinese");
  assert.match(out, /^任务：/m, "the Tasks counter is Chinese");
  assert.match(out, /^你的任务：/m, "the per-task header is Chinese");
  assert.match(out, /下一步：/, "the Next step is Chinese");

  // HONESTY: the self-declared cross-family receipt (t2 -> L3) MUST carry the exact
  // authoritative caveat, and the level gloss is the faithful one.
  assert.match(out, /自报跨族·未经验证/, "the self-declared cross-family caveat is faithful and present");
  assert.match(out, /跨族复核·但家族系自报/, "the L3 plain-language gloss is faithful");
  assert.match(out, /单工具自查·只能睁眼接受风险/, "the L2 plain-language gloss is faithful");
  // The thin author-marked done is shown as unverified, faithfully.
  assert.match(out, /作者自标·未经验证|完成——作者自标·未经验证/, "the author-marked done is shown as unverified");

  // RED LINE: an L3/self-declared receipt is never relabeled as verified/done/saved.
  // The literal level code stays, but the caveat must not be replaced by a 已验证 claim
  // on the SAME line. Assert the dangerous mistranslations are absent from the report.
  assert.doesNotMatch(out, /已验证的跨族|跨族复核已验证|已验证·已完成/, "a self-declared cross-family pass is never relabeled 已验证");
  // The receipt verdict/level tokens stay literal (not translated into a false claim).
  assert.match(out, /L3/, "the L3 code stays literal");
});

// --- bootstrap --lang zh: the five cards, honesty-faithful ------------------
test("i18n: `bootstrap --lang zh` prints the five cards in Chinese and keeps every un-trustworthy claim faithful", () => {
  const s = bootstrapScenarioWorkspace("i18n-bootstrap-zh");
  const res = runLang("zh", ["bootstrap", "--workspace", s.ws, "--yes"]);
  assert.equal(res.status, 0, "bootstrap --lang zh exits cleanly");
  const out = res.stdout;

  // Header + the card titles are Chinese (the card NAMES PROFILE CLUES/VERIFY/RESUME/
  // ROLES/HARVEST stay as stable section labels, but their subtitles are translated).
  assert.match(out, /你的 AI 协作基线（来自你自己最近的工作）/, "the report title is Chinese");
  assert.match(out, /只读。没有任何东西离开过这台机器。/, "the read-only promise is Chinese");
  assert.match(out, /VERIFY——哪些『完成』暂时还不能信/, "the VERIFY subtitle is faithful Chinese");
  assert.match(out, /RESUME——你在哪里、还缺什么/, "the RESUME subtitle is Chinese");
  assert.match(out, /HARVEST——你可以带走什么/, "the HARVEST subtitle is Chinese");

  // VERIFY honesty: the count line + the self-declared reason + the marker, faithful.
  assert.match(out, /个『完成』声明暂时还不能当作已完成/, "the VERIFY count line is faithful (still 'cannot yet count as done')");
  assert.match(out, /自报的跨族复核——本工具无法验证另一个模型是否真的检查过/, "the self-declared cross-family reason is faithful");
  assert.match(out, /自报跨族·未经验证/, "the self-declared marker rides the detail line, faithful");
  assert.match(out, /作者自行标记完成·背后没有已签收的复核/, "the author-marked-done reason is faithful");

  // HARVEST honesty: a candidate is PROPOSED, nothing auto-saved.
  assert.match(out, /候选——不会自动保存任何东西/, "harvest candidates are PROPOSED, nothing auto-saved (faithful)");

  // RED LINE: nowhere does the report relabel an un-trustworthy claim as fully done.
  // The exact dangerous phrases (claiming the self-declared/pending work is verified)
  // must be absent.
  assert.doesNotMatch(out, /这些『完成』已验证|全部已验证完成|已验证·可信赖/, "an un-trustworthy claim is never relabeled verified");
});

// --- empty workspace --lang zh: the seed-honesty line, faithful -------------
test("i18n: `bootstrap --lang zh` on an empty/seed-only workspace honestly says (in Chinese) there is no data of your own", () => {
  const ws = initHandoffWorkspace("i18n-bootstrap-empty-zh");
  const res = runLang("zh", ["bootstrap", "--workspace", ws, "--yes"]);
  assert.equal(res.status, 0);
  const out = res.stdout;
  assert.match(out, /你还没有记录任何自己的工作——目前只有内置示例。/, "the no-own-data line is faithful Chinese");
  assert.match(out, /（示例种子被刻意排除——那不是你的成果。）/, "the seed-excluded note is faithful Chinese");
  // It must NOT borrow the example's numbers / claim the user has verified results.
  assert.doesNotMatch(out, /已验证|已完成的任务/, "the empty report claims no verified/done results of the user's own");
});

// --- consent gate --lang zh: scope shown in Chinese, no-network promise ------
test("i18n: the bootstrap consent gate prints its scope in Chinese and refuses without --yes", () => {
  const s = bootstrapScenarioWorkspace("i18n-consent-zh");
  const res = runLang("zh", ["bootstrap", "--workspace", s.ws]); // no --yes
  assert.equal(res.status, 0, "the consent preview exits cleanly (it just stops before scanning)");
  const out = res.stdout;
  assert.match(out, /bootstrap 将——在本地、只读地——读取以下内容来构建你的基线：/, "the consent head is Chinese");
  assert.match(out, /它不会调用任何外部模型，不做任何猜测，也不会把任何东西发送到任何地方。/, "the no-network promise is faithful Chinese");
  assert.match(out, /加上 --yes 重新运行/, "it asks to re-run with --yes, in Chinese");
});

// --- --help --lang zh: the term-light header + levels page, in Chinese ------
test("i18n: `--help --lang zh` and `--help levels --lang zh` print Chinese, keeping the honesty caveats faithful", () => {
  const help = runLang("zh", ["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /AI 协作开放系统/, "the help banner is Chinese");
  assert.match(help.stdout, /新来的？这些命令/, "the term-light header is Chinese (now leads with first-run + init/bootstrap/status)");
  // The bootstrap blurb keeps the honesty caveat: never shown as done, writes nothing.
  assert.match(help.stdout, /绝不被显示为已完成/, "help keeps 'never shown as done' faithful");
  assert.match(help.stdout, /它什么都不写（只读报告）/, "help keeps 'writes nothing' faithful");

  const levels = runLang("zh", ["--help", "levels"]);
  assert.equal(levels.status, 0);
  assert.match(levels.stdout, /守卫等级（L0-L4）/, "the levels page title is Chinese");
  // Honesty: the self-declared family caveat must be faithful, and L0-L4 stay literal.
  assert.match(levels.stdout, /家族诚实/, "the family-honesty caveat is present in Chinese");
  assert.match(levels.stdout, /自报跨族·未经验证/, "the L3 self-declared caveat is faithful");
  assert.match(levels.stdout, /而非密码学意义上的验证/, "the 'not cryptographic verification' caveat is faithful");
  for (const code of ["L0", "L1", "L2.5", "L3", "L4"]) {
    assert.match(levels.stdout, new RegExp(code.replace(".", "\\.")), `the ${code} code stays literal`);
  }
});

// --- welcome: the proactive onboarding intro the CLI HARD-PRINTS verbatim ----
//
// `welcome` exists so the AI can install the pack, run the command, and show the
// user a FIXED, complete intro (not a re-summarized one). These tests pin the load-
// bearing anchors so a future edit cannot quietly drop a layer, a keyword, the
// privacy-honesty sentence, or the closing call-to-action — in BOTH languages — and
// guard the honesty contract: the English must NOT over-claim privacy as "zero data
// leaves your machine" (the optional scan step does pass your work through the AI's
// provider, and the copy says so plainly).
test("welcome: the English intro hard-prints all six layers, the three keywords, the honest privacy line and the closing question", () => {
  const out = runCli(["welcome"]); // English-pinned by run()/withEnglishEnv()
  // Header: the install-confirmation line.
  assert.match(out, /Your AI collaboration pack is installed/, "the install-confirmation header is present");
  // The scaffolding positioning (the central metaphor) survives.
  assert.match(out, /scaffolding for the AI/, "the scaffolding positioning is present");

  // All SIX layers (by their English labels) appear — none silently dropped.
  for (const layer of ["Profile", "Context", "Acceptance", "Guard", "Handoff", "Harvest"]) {
    assert.match(out, new RegExp(`\\b${layer}\\b`), `the "${layer}" layer is listed`);
  }

  // The three advertised keyword triggers are all there.
  assert.match(out, /collision mode/, "the collision-mode keyword is present");
  assert.match(out, /scan blind spots/, "the scan-blind-spots keyword is present");
  assert.match(out, /red team/, "the red-team keyword is present");

  // HONESTY: the privacy line is faithful — it says the optional scan step passes your
  // work through the AI's provider, exactly the way normal chat already does.
  assert.match(out, /passing it through my provider/, "the honest privacy sentence (provider pass-through) is present");
  // RED LINE: it must NEVER over-claim privacy as an absolute "zero data leaves".
  assert.doesNotMatch(out, /zero data leaves/i, "the English intro never over-claims privacy as 'zero data leaves'");

  // The intro CLOSES on the guiding call-to-action question (a real '?').
  assert.match(out, /Want me to take a look right now\?\s*$/, "the closing guiding question ends the intro");
});

test("welcome --lang zh: the Chinese intro hard-prints all six layers, the three keywords, the honest privacy line and the closing question", () => {
  const res = runLang("zh", ["welcome"]);
  assert.equal(res.status, 0, "welcome --lang zh exits cleanly");
  const out = res.stdout;
  // The Chinese header + scaffolding metaphor.
  assert.match(out, /协作升级包已装好/, "the Chinese install-confirmation header is present");
  assert.match(out, /脚手架/, "the Chinese scaffolding metaphor is present");

  // All SIX layers (by their Chinese labels) appear.
  for (const layer of ["画像", "上下文", "验收", "守卫", "交接", "收割"]) {
    assert.ok(out.includes(layer), `the "${layer}" layer is listed in Chinese`);
  }

  // The three keyword triggers, in Chinese.
  assert.ok(out.includes("碰撞模式"), "the collision-mode keyword is present in Chinese");
  assert.ok(out.includes("扫描盲区"), "the scan-blind-spots keyword is present in Chinese");
  assert.ok(out.includes("红队"), "the red-team keyword is present in Chinese");

  // HONESTY: the privacy line keeps the faithful "the tool itself uploads nothing, but
  // the one scan step goes through the provider like normal chat" framing.
  assert.match(out, /工具自己不传任何东西/, "the Chinese privacy line keeps 'the tool itself sends nothing' faithful");
  assert.match(out, /跟你平时聊天一样过一下服务商/, "the Chinese privacy line keeps the provider-pass-through honesty");

  // The intro closes on the guiding question (a full-width '？' or ASCII '?').
  assert.match(out, /现在就让我扫一眼吗[?？]\s*$/, "the closing guiding question ends the Chinese intro");
});

test("welcome: --help lists the command and an unknown subcommand still resolves the word", () => {
  // The command is discoverable in the reference.
  const help = runCli(["--help"]);
  assert.match(help, /ai-collab welcome/, "welcome is listed in --help");
  // The bilingual EN/ZH text bodies live ONLY in the i18n catalog (a sanctioned
  // bilingual source); cli.js stays English-only. Guard that the Chinese intro is
  // sourced from the catalog, not hard-coded in cli.js.
  const cli = read(repoRoot, "src", "cli.js");
  assert.doesNotMatch(cli, /协作升级包/, "the Chinese welcome body is not hard-coded in cli.js (it lives in i18n)");
});

// --- a missing-option error renders in the active language ------------------
test("i18n: a common error (missing --task) renders in the active language", () => {
  // English (the suite default pin) — byte-stable.
  const en = runResult(["bin/ai-collab.js", "task", "update", "--status", "done"]);
  assert.notEqual(en.status, 0);
  assert.match(en.stderr, /Missing --task\./, "the English error is unchanged");
  // Chinese.
  const zh = runLang("zh", ["task", "update", "--status", "done"]);
  assert.notEqual(zh.status, 0);
  assert.match(zh.stderr, /缺少 --task。/, "the same error renders in Chinese");
});

// --- workspace-marker regression: a project-root START_HERE.md must NOT be
//     mistaken for the workspace (it is a doc; the marker is WORKSPACE_MANIFEST.json)
//
// The bug this guards: findWorkspace/resolveStateDir used to probe for a bare
// START_HERE.md. That same doc ships at the PROJECT ROOT (the repo's own "start
// here" guide), so running a run-layer command from the project root resolved the
// state dir to <root>/state — an empty/stray ledger — instead of the real
// <root>/.aict/state, silently reading the wrong (or no) data. We now key off
// WORKSPACE_MANIFEST.json, which only ever lands inside a generated .aict.
//
// Scenario reproduced verbatim: a project root that has a START_HERE.md DOC AND a
// real workspace under .aict/ holding a real (non-seed) task. status (no
// --workspace, cwd = that root) and bootstrap must both resolve to .aict/state and
// see the real task — never the empty root. Covered in BOTH languages.
function makeRootStartHereCollisionWorkspace(label) {
  // canonical() makes the temp root platform-agnostic for the path comparisons below:
  // it resolves whatever the host symlinks (macOS /var -> /private/var, etc.) with no
  // hard-coded prefix assumption, so the assertions hold on macOS, Linux, and Windows.
  const root = canonical(mkdtempSync(path.join(tmpdir(), `aicos-marker-collision-${label}-`)));
  // A project-root START_HERE.md DOC (the decoy the old marker matched). Content is
  // irrelevant — only its presence at the root mattered to the old bug.
  writeFileSync(
    path.join(root, "START_HERE.md"),
    "# Start Here (project guide)\n\nThis is the repository's own guide, not a workspace marker.\n"
  );
  // A real generated workspace under .aict/ (init writes WORKSPACE_MANIFEST.json there).
  runCli(["init", "--target", root, "--force"]);
  // A REAL (non-seed) task in the .aict workspace, so we can prove the command read
  // the real ledger and not an empty root/state.
  runCli(["task", "create", "--title", `real task for ${label}`, "--workspace", path.join(root, ".aict")]);
  return root;
}

// Run the CLI from an ARBITRARY cwd (runCli pins cwd to repoRoot, which would defeat
// the "default ./.aict resolved from the project root" path we are exercising). The
// CLI script is referenced by ABSOLUTE path so cwd can be the temp project root
// without Node looking for bin/ai-collab.js there.
const cliBin = path.join(repoRoot, "bin", "ai-collab.js");
function runCliInDir(cwd, args, lang = "en") {
  return spawnSync(nodeBin, [cliBin, "--lang", lang, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, AI_COLLAB_LANG: lang }
  });
}

test("workspace marker: a project-root START_HERE.md does not shadow the real .aict workspace (status + bootstrap, EN)", (t) => {
  const root = makeRootStartHereCollisionWorkspace("en");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  // Sanity on the fixture: the decoy doc is at the root, the manifest is ONLY in .aict.
  assert.ok(existsSync(path.join(root, "START_HERE.md")), "fixture must have the root START_HERE.md decoy");
  assert.ok(!existsSync(path.join(root, "WORKSPACE_MANIFEST.json")), "the root must NOT carry the manifest");
  assert.ok(existsSync(path.join(root, ".aict", "WORKSPACE_MANIFEST.json")), "the manifest lives in .aict");

  const realStateDir = path.join(root, ".aict", "state");

  // status, run from the project root, with NO --workspace.
  const status = runCliInDir(root, ["status"]);
  assert.equal(status.status, 0, `status should succeed; stderr:\n${status.stderr}`);
  assert.ok(
    status.stdout.includes(realStateDir),
    `status must resolve to the real .aict/state (${realStateDir}); got:\n${status.stdout}`
  );
  assert.ok(
    status.stdout.includes("real task for en"),
    `status must read the REAL task from the .aict ledger; got:\n${status.stdout}`
  );
  // It must NOT have resolved to a bare <root>/state.
  assert.ok(
    !status.stdout.includes(`${path.join(root, "state")}\n`),
    "status must NOT resolve to the empty root <root>/state"
  );

  // bootstrap --yes --json, same cwd, no --workspace: must scan the .aict ledger and
  // see the one real (non-seed) task.
  const boot = runCliInDir(root, ["bootstrap", "--yes", "--json"]);
  assert.equal(boot.status, 0, `bootstrap should succeed; stderr:\n${boot.stderr}`);
  const bootJson = JSON.parse(boot.stdout);
  assert.equal(bootJson.workspaceRoot, path.join(root, ".aict"), "bootstrap workspaceRoot must be the real .aict");
  assert.equal(bootJson.hasOwnData, true, "bootstrap must see real (non-seed) data from the .aict ledger");
  assert.equal(bootJson.counts.ownTasks, 1, "bootstrap must count the one real task in .aict, not an empty root");
});

test("workspace marker: a project-root START_HERE.md does not shadow the real .aict workspace (status + bootstrap, ZH)", (t) => {
  const root = makeRootStartHereCollisionWorkspace("zh");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const realStateDir = path.join(root, ".aict", "state");

  // status in Chinese, from the project root, no --workspace: the marker resolution
  // is language-independent, so it must still land on the real .aict/state and read
  // the real task even when the surface text is localized.
  const status = runCliInDir(root, ["status"], "zh");
  assert.equal(status.status, 0, `zh status should succeed; stderr:\n${status.stderr}`);
  assert.ok(
    status.stdout.includes(realStateDir),
    `zh status must resolve to the real .aict/state (${realStateDir}); got:\n${status.stdout}`
  );
  assert.ok(
    status.stdout.includes("real task for zh"),
    `zh status must read the REAL task from the .aict ledger; got:\n${status.stdout}`
  );

  const boot = runCliInDir(root, ["bootstrap", "--yes", "--json"], "zh");
  assert.equal(boot.status, 0, `zh bootstrap should succeed; stderr:\n${boot.stderr}`);
  const bootJson = JSON.parse(boot.stdout);
  assert.equal(bootJson.workspaceRoot, path.join(root, ".aict"), "zh bootstrap workspaceRoot must be the real .aict");
  assert.equal(bootJson.hasOwnData, true, "zh bootstrap must see real data from the .aict ledger");
  assert.equal(bootJson.counts.ownTasks, 1, "zh bootstrap must count the one real task in .aict");
});

// --- status --json nextStep.code: a locale-STABLE machine enum ---------------
//
// The next-step line's `text` is localized (varies by --lang), but a --json
// consumer needs a language-independent handle to branch on. We added a `code`
// enum to nextStep; this asserts it is present, a known stable value, and IDENTICAL
// under --lang en vs --lang zh on the same workspace state, while `text` differs.
test("status --json: nextStep.code is a locale-stable enum (same under en/zh, while text localizes)", () => {
  const ws = freshRunWorkspace("nextstep-code");
  // A fresh (seed-only) workspace has no work of the user's own yet, so the derived
  // next step is the "run_bootstrap" branch (stable regardless of language).
  const KNOWN_CODES = new Set([
    "run_bootstrap", "add_evidence", "create_receipt",
    "accept_receipt", "create_handoff", "confirm_learning", "none"
  ]);

  const en = JSON.parse(runLang("en", ["status", "--workspace", ws, "--json"]).stdout);
  const zh = JSON.parse(runLang("zh", ["status", "--workspace", ws, "--json"]).stdout);

  // The code is present and a known stable enum value.
  assert.ok(KNOWN_CODES.has(en.nextStep.code), `en nextStep.code must be a known enum, got ${en.nextStep.code}`);
  assert.equal(en.nextStep.code, "run_bootstrap", "a seed-only workspace's next step is run_bootstrap");

  // Locale stability: the machine code is identical across languages...
  assert.equal(en.nextStep.code, zh.nextStep.code, "nextStep.code must be identical under --lang en and --lang zh");

  // ...while the human text actually localizes (so we are not just comparing two
  // English outputs — the test would be vacuous if zh fell back to en).
  assert.notEqual(en.nextStep.text, zh.nextStep.text, "nextStep.text must differ between en and zh (real localization)");
  assert.match(zh.nextStep.text, /[一-鿿]/, "the zh nextStep.text must contain Chinese characters");

  // The copy-pasteable command stays locale-stable (English), too.
  assert.equal(en.nextStep.command, zh.nextStep.command, "nextStep.command must be locale-stable (identical en/zh)");
});

// ===========================================================================
// Sub-function unit tests for the read-time honesty checks (validate.js).
//
// validateLedgers was refactored from one ~390-line straight-line function into
// one named, exported `check*` sub-function per numbered integrity check, each
// taking a parsed-ledger context and RETURNING an error string array. That lets
// us feed ONE check a hand-built ledger directly — no whole-workspace round-trip
// — so a mutation to a single honesty check can no longer hide behind another
// check tripping (the "only incidentally covered" gap the mutation tests found).
//
// Each test below:
//   (a) builds a minimal ctx with `buildLedgerContext` over a temp state dir
//       populated with exactly the rows the check inspects, then
//   (b) asserts the check returns the precise honesty error for a forged input,
//       AND returns [] for a valid input (a negative control, so a mutant that
//       makes the check always-fire is caught too).
// These call the sub-function ONLY (not validateWorkspace), so they are precise,
// fast, and do not drift with unrelated workspace scaffolding.
// ===========================================================================

// Materialize a temp `state/` dir from hand-crafted ledger rows and return the
// parsed-ledger context the check sub-functions consume. Any ledger left
// unspecified is written empty (a valid empty ledger).
function ledgerCtxFrom({ tasks = [], evidence = [], runs = [], receipts = [], learning = [] } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "aicos-subfn-"));
  const stateDir = path.join(root, "state");
  mkdirSync(stateDir, { recursive: true });
  const files = {
    "tasks.jsonl": tasks,
    "evidence.jsonl": evidence,
    "runs.jsonl": runs,
    "receipts.jsonl": receipts,
    "learning-ledger.jsonl": learning
  };
  for (const [name, rows] of Object.entries(files)) {
    writeFileSync(path.join(stateDir, name), rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
  }
  return buildLedgerContext(stateDir);
}

const ISO = "2026-01-01T00:00:00.000Z";

// (2c) exitCode reconciliation: a rerun whose exitCode disagrees with the
// recorded run it cites must be flagged. This was previously reached only
// incidentally through a full validateWorkspace round-trip; here we drive the
// sub-function directly so the exitCode-mismatch BRANCH is asserted on its own.
test("sub-fn checkRerunRunReconcile: a rerun whose exitCode != the recorded run is flagged (exitCode reconciliation)", () => {
  // Recorded run r0 finished exit 0; the rerun bolts on exit 1 over it.
  const ctx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    runs: [{
      id: "r0", taskId: "t0", command: "echo hi", status: "finished", executed: true,
      exitCode: 0, outputSha256: sha256Text("hi"), createdAt: ISO
    }],
    evidence: [{
      id: "e9", taskId: "t0", kind: "rerun", summary: "exit mismatch",
      command: "echo hi", exitCode: 1, output: "hi", runId: "r0", createdAt: ISO
    }]
  });
  const errors = checkRerunRunReconcile(ctx);
  assert.deepEqual(
    errors,
    [`ledger evidence.jsonl evidence e9: rerun evidence claims exitCode 1 but the recorded run "r0" finished with exitCode 0 (the rerun must agree with the recorded run)`],
    `expected exactly the exitCode-mismatch reconcile error, got:\n${errors.join("\n")}`
  );

  // Negative control: when the rerun exitCode MATCHES the recorded run (and the
  // command + output hash agree), the same check returns no error.
  const cleanCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    runs: [{
      id: "r0", taskId: "t0", command: "echo hi", status: "finished", executed: true,
      exitCode: 0, outputSha256: sha256Text("hi"), createdAt: ISO
    }],
    evidence: [{
      id: "e9", taskId: "t0", kind: "rerun", summary: "reconciled",
      command: "echo hi", exitCode: 0, output: "hi", runId: "r0", createdAt: ISO
    }]
  });
  assert.deepEqual(checkRerunRunReconcile(cleanCtx), [], "a reconciled rerun (matching exitCode/command/output) must produce no error");
});

// (6) zero-evidence acceptance: a receipt written "accepted" with no evidence
// that belongs to its OWN task is an unsupported acceptance. Driven directly on
// the sub-function for both the empty-list and the cross-task-only forms.
test("sub-fn checkAcceptedReceiptHasEvidence: accepted with zero own-task evidence is flagged (empty list AND cross-task-only)", () => {
  // (i) accepted receipt citing an empty evidenceIds list.
  const emptyCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L3", evidenceIds: [], status: "accepted", createdAt: ISO }]
  });
  assert.deepEqual(
    checkAcceptedReceiptHasEvidence(emptyCtx),
    [`ledger receipts.jsonl receipt c9 is "accepted" but cites no evidence`],
    "an accepted receipt with an empty evidence list must be flagged"
  );

  // (ii) accepted receipt for task t1 that only cites task t0's evidence (the
  // cross-task back door): owned-evidence count is 0, so it is still unsupported.
  const crossTaskCtx = ledgerCtxFrom({
    tasks: [
      { id: "t0", title: "a", status: "open", createdAt: ISO },
      { id: "t1", title: "b", status: "open", createdAt: ISO }
    ],
    evidence: [{ id: "e0", taskId: "t0", kind: "note", summary: "owned by t0", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t1", verdict: "pass", guardLevel: "L3", evidenceIds: ["e0"], status: "accepted", createdAt: ISO }]
  });
  assert.deepEqual(
    checkAcceptedReceiptHasEvidence(crossTaskCtx),
    [`ledger receipts.jsonl receipt c9 is "accepted" but cites no evidence`],
    "an accepted receipt that only cites another task's evidence must be flagged (cross-task back door)"
  );

  // Negative control: an accepted receipt that cites its OWN task's evidence is fine.
  const okCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "e0", taskId: "t0", kind: "output", summary: "ran it", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "pass_with_risk", guardLevel: "L2", evidenceIds: ["e0"], status: "accepted", ownerAccepted: true, createdAt: ISO }]
  });
  assert.deepEqual(checkAcceptedReceiptHasEvidence(okCtx), [], "an accepted receipt citing own-task evidence must not be flagged");
});

// (8c) stored level vs computed level: a receipt may not store a guardLevel
// HIGHER than the review method + evidence support. Feed a stored L4 backed by
// evidence that only reaches L3; assert the over-claim is reported. Driven
// directly so the "stored OUTRANKS computed" branch is asserted in isolation.
test("sub-fn checkReceiptComputedLevel: a stored L4 over a body that only computes L3 is flagged (level is computed, not self-asserted)", () => {
  // A cited cross_family_guard reaches L3, but no reconciled rerun -> computed L3.
  // The stored row claims L4: an over-claim.
  const ctx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "x0", taskId: "t0", kind: "cross_family_guard", summary: "gpt reviewed", reviewer: "gpt-5", family: "openai", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L4", reviewMode: "cross_family_rerun", evidenceIds: ["x0"], status: "accepted", createdAt: ISO }]
  });
  const errors = checkReceiptComputedLevel(ctx);
  assert.equal(errors.length, 1, `expected exactly one over-claim error, got:\n${errors.join("\n")}`);
  assert.match(
    errors[0],
    /receipt c9 claims guard level "L4" but the review method \+ evidence only support "L3" .*; the level is computed, not self-asserted/,
    `expected the L4->L3 over-claim error, got: ${errors[0]}`
  );

  // Negative control: a stored L3 that the same evidence body actually supports
  // is NOT flagged (under-claim/exact-claim is allowed; only over-claim fires).
  const okCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "x0", taskId: "t0", kind: "cross_family_guard", summary: "gpt reviewed", reviewer: "gpt-5", family: "openai", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: ["x0"], status: "accepted", familyUnverified: true, createdAt: ISO }]
  });
  assert.deepEqual(checkReceiptComputedLevel(okCtx), [], "a stored level the evidence actually supports must not be flagged as an over-claim");
});

// (8d) family-honesty marker: when the computed level rests on a SELF-DECLARED
// cross-family claim, the row MUST carry familyUnverified: true; conversely the
// marker MUST NOT be present on a level the computation does not flag. Both
// branches are asserted directly — the second branch ("marker is unwarranted")
// had no direct test before this.
test("sub-fn checkFamilyUnverifiedMarker: missing marker on a self-declared cross-family level is flagged, and an unwarranted marker is flagged", () => {
  // Branch 1: computed level is a self-declared cross-family L3 but the stored
  // row omits familyUnverified -> the "missing the familyUnverified: true marker" error.
  const missingCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "x0", taskId: "t0", kind: "cross_family_guard", summary: "gpt reviewed", reviewer: "gpt-5", family: "openai", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: ["x0"], status: "accepted", createdAt: ISO }]
  });
  const missingErrors = checkFamilyUnverifiedMarker(missingCtx);
  assert.equal(missingErrors.length, 1, `expected one missing-marker error, got:\n${missingErrors.join("\n")}`);
  assert.match(
    missingErrors[0],
    /receipt c9 is a self-declared cross-family level \(L3\) but is missing the familyUnverified: true marker/,
    `expected the missing-marker error, got: ${missingErrors[0]}`
  );

  // Branch 2: a row whose computed level is NOT an unverified cross-family level
  // (a plain L2 self-review on author-run evidence) but that carries
  // familyUnverified: true -> the "marker is unwarranted" error. This branch had
  // no direct coverage before.
  const unwarrantedCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "e0", taskId: "t0", kind: "output", summary: "author run", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "pass_with_risk", guardLevel: "L2", reviewMode: "self", evidenceIds: ["e0"], status: "accepted", ownerAccepted: true, familyUnverified: true, createdAt: ISO }]
  });
  const unwarrantedErrors = checkFamilyUnverifiedMarker(unwarrantedCtx);
  assert.equal(unwarrantedErrors.length, 1, `expected one unwarranted-marker error, got:\n${unwarrantedErrors.join("\n")}`);
  assert.match(
    unwarrantedErrors[0],
    /receipt c9 carries familyUnverified: true but its computed level \(L2\) is not an unverified cross-family level \(the marker is unwarranted\)/,
    `expected the unwarranted-marker error, got: ${unwarrantedErrors[0]}`
  );

  // Negative control: a self-declared cross-family L3 that DOES carry the marker
  // (and whose stored level matches the computed level) produces no error.
  const okCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "x0", taskId: "t0", kind: "cross_family_guard", summary: "gpt reviewed", reviewer: "gpt-5", family: "openai", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L3", reviewMode: "cross_family", evidenceIds: ["x0"], status: "accepted", familyUnverified: true, createdAt: ISO }]
  });
  assert.deepEqual(checkFamilyUnverifiedMarker(okCtx), [], "a correctly-marked self-declared cross-family level must not be flagged");
});

// (10) status reverse-consistency: a receipt's status is DERIVED from
// (verdict, owned-evidence, ownerAccepted); a stored status that contradicts the
// rule must be flagged. The "status contradicts the rule" branch had no direct
// assertion before this. Forge a verdict "reject" written status "accepted".
test("sub-fn checkReceiptStatusReverse: status 'accepted' on a 'reject' verdict is flagged (status contradicts the rule)", () => {
  const ctx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "e0", taskId: "t0", kind: "output", summary: "ran it", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "reject", guardLevel: "L1", evidenceIds: ["e0"], status: "accepted", createdAt: ISO }]
  });
  const errors = checkReceiptStatusReverse(ctx);
  assert.equal(errors.length, 1, `expected one status-contradiction error, got:\n${errors.join("\n")}`);
  assert.match(
    errors[0],
    /receipt c9 has status "accepted" but verdict "reject" with 1 own-task evidence and ownerAccepted=false computes to "rejected" \(status contradicts the rule\)/,
    `expected the status-contradicts-rule error, got: ${errors[0]}`
  );

  // Also covers the illegal-status arm (a): a status outside the enum is flagged
  // and the row is not reverse-computed (no double report).
  const illegalCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "reject", guardLevel: "L1", evidenceIds: [], status: "bogus", createdAt: ISO }]
  });
  assert.deepEqual(
    checkReceiptStatusReverse(illegalCtx),
    [`ledger receipts.jsonl receipt c9 has missing/illegal status "bogus" (allowed: accepted, rejected, pending)`],
    "an illegal status value must be reported once, not reverse-computed"
  );

  // Negative control: a reject verdict correctly written status "rejected" passes.
  const okCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "e0", taskId: "t0", kind: "output", summary: "ran it", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "reject", guardLevel: "L1", evidenceIds: ["e0"], status: "rejected", createdAt: ISO }]
  });
  assert.deepEqual(checkReceiptStatusReverse(okCtx), [], "a reject verdict written status 'rejected' must not be flagged");
});

// (8) verdict x guardLevel consistency: a verdict must be one its guard level
// can back. Drive the sub-function directly with an L1 "pass" (a pass needs a
// run-evidence-backed L3+), asserting the consistency error fires on its own.
test("sub-fn checkVerdictGuardLevelConsistency: an L1 'pass' is flagged (the level cannot back the verdict)", () => {
  const ctx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "e0", taskId: "t0", kind: "note", summary: "a note", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "pass", guardLevel: "L1", evidenceIds: ["e0"], status: "accepted", createdAt: ISO }]
  });
  const errors = checkVerdictGuardLevelConsistency(ctx);
  assert.equal(errors.length, 1, `expected one verdict/level error, got:\n${errors.join("\n")}`);
  assert.match(errors[0], /receipt c9: guard level L1 .*cannot return "pass"/, `expected the L1-pass consistency error, got: ${errors[0]}`);

  // Negative control: a "reject" verdict is legal at L1 (a rejection needs no run
  // proof), so the same check returns no error.
  const okCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "t", status: "open", createdAt: ISO }],
    evidence: [{ id: "e0", taskId: "t0", kind: "note", summary: "a note", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "reject", guardLevel: "L1", evidenceIds: ["e0"], status: "rejected", createdAt: ISO }]
  });
  assert.deepEqual(checkVerdictGuardLevelConsistency(okCtx), [], "a reject verdict at L1 must not be flagged");
});

// (4c) cross-task evidence citation: a receipt may only cite its OWN task's
// evidence. Driven directly: a receipt for t1 that cites t0's (existing) evidence
// is flagged as a cross-task citation (distinct from an unknown-id broken ref).
test("sub-fn checkReceiptCrossTaskEvidence: citing another task's existing evidence is flagged", () => {
  const ctx = ledgerCtxFrom({
    tasks: [
      { id: "t0", title: "a", status: "open", createdAt: ISO },
      { id: "t1", title: "b", status: "open", createdAt: ISO }
    ],
    evidence: [{ id: "e0", taskId: "t0", kind: "note", summary: "owned by t0", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t1", verdict: "reject", guardLevel: "L1", evidenceIds: ["e0"], status: "rejected", createdAt: ISO }]
  });
  assert.deepEqual(
    checkReceiptCrossTaskEvidence(ctx),
    [`ledger receipts.jsonl receipt c9 cites evidence "e0" that belongs to another task (not task "t1")`],
    "citing another task's evidence must be flagged as a cross-task citation"
  );

  // Negative control: a receipt citing its own task's evidence is not flagged.
  const okCtx = ledgerCtxFrom({
    tasks: [{ id: "t0", title: "a", status: "open", createdAt: ISO }],
    evidence: [{ id: "e0", taskId: "t0", kind: "note", summary: "owned by t0", createdAt: ISO }],
    receipts: [{ id: "c9", taskId: "t0", verdict: "reject", guardLevel: "L1", evidenceIds: ["e0"], status: "rejected", createdAt: ISO }]
  });
  assert.deepEqual(checkReceiptCrossTaskEvidence(okCtx), [], "citing own-task evidence must not be flagged");
});

// (5) done-requires-evidence: the read-time twin of the write-time "thin done"
// guard. Driven directly: a done task with no evidence row pointing at it is
// flagged; a done task that has evidence is not.
test("sub-fn checkDoneRequiresEvidence: a done task with no evidence is flagged, one with evidence is not", () => {
  const ctx = ledgerCtxFrom({
    tasks: [{ id: "t9", title: "claimed done", status: "done", createdAt: ISO }]
  });
  assert.deepEqual(
    checkDoneRequiresEvidence(ctx),
    [`ledger tasks.jsonl task t9 is "done" but has no evidence (only blocked/partial/unverified may have none)`],
    "a done task with no evidence must be flagged"
  );

  // Negative control: a done task WITH an evidence row pointing at it passes.
  const okCtx = ledgerCtxFrom({
    tasks: [{ id: "t9", title: "real done", status: "done", createdAt: ISO }],
    evidence: [{ id: "e0", taskId: "t9", kind: "command", summary: "tests pass", createdAt: ISO }]
  });
  assert.deepEqual(checkDoneRequiresEvidence(okCtx), [], "a done task with evidence must not be flagged");
});

// === dialogue scan v1 — the LOCAL half of semantic scanning ==================
//
// bootstrap can OPTIONALLY read a LOCAL chat/log export the user EXPLICITLY hands
// over (--dialogue / --logs) and extract DETERMINISTIC signals to enrich the three
// cards. The four red lines this suite pins down:
//   1. DETERMINISTIC ONLY — word-table + normalized count + ledger set lookup; no
//      model, no network (the CLI's `network: "not used"` stays true).
//   2. A chat "done" is NEVER shown as done — it is a VERIFY finding labelled
//      "claimed in dialogue · not verified", cross-referenced against the ledger.
//   3. Candidates are PROPOSED — a repeated correction is a HARVEST *profile*
//      candidate; bootstrap writes NOTHING (state/*.jsonl is byte-identical).
//   4. OPT-IN + redacted — no flag => byte-identical behavior; a secret/email/path in
//      a surfaced snippet is masked before it is ever displayed or recorded.

// Helper: write a temp export file with given content, return its absolute path.
function writeExport(label, content) {
  const dir = mkdtempSync(path.join(tmpdir(), `aicos-dlg-${label}-`));
  const file = path.join(dir, "chat.txt");
  writeFileSync(file, content, "utf8");
  return file;
}

// Synthetic, never-real sensitive-shaped fixtures, ASSEMBLED from fragments at runtime
// so no literal secret/key/path/email/phone string appears in this source file (which
// the release privacy scan reads). Same fragment-concatenation convention the existing
// pack/privacy tests use (e.g. `${"AKIA"}EXAMPLE…`). These exercise the redaction with
// real SHAPES while keeping the test file itself clean.
const FAKE = {
  openaiKey: "sk-" + "ABCDEFGHIJKLMNOPQRSTUV",
  ghToken: "gh" + "p_" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
  awsKey: "AKIA" + "ABCDEFGHIJKLMNOP",
  email: "alice" + "@" + "example.test",
  email2: "bob" + "@" + "private.example.test",
  posixPath: "/Us" + "ers/somebody/secret/x.js",
  homePath: "/ho" + "me/bob/note.txt",
  phone: "415" + "-555-" + "1234",
  // Extended secret SHAPES (C1 hardening). Assembled from fragments so no literal
  // path/secret string appears in this source file (release privacy scan reads it).
  sysVarPath: "/va" + "r/lib/svc/secret.db",       // non-home system path
  sysEtcPath: "/et" + "c/nginx/private.conf",      // non-home system path
  sysOptPath: "/op" + "t/app/keys/id_rsa",         // non-home system path
  winPath: "C:" + "\\ProgramData\\App\\secret.txt", // Windows non-Users drive path
  pemBlock: "---" + "--BEGIN RSA PRIVATE KEY-----\n" +
            "MIIEowIBAAKCAQEA1234567890abcdefGHIJKLmnop\n" +
            "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=\n" +
            "---" + "--END RSA PRIVATE KEY-----",     // multi-line PEM (body, not just header)
  passwdAssign: "pass" + "word=hunter2SuperSecret"  // unquoted password= value
};

// --- redactSnippet: the shared masking (mirrors privacy-scan's forbidden set) ---
test("dialogue redactSnippet masks secrets / tokens / emails / local paths / phones, leaves plain text intact", () => {
  const raw =
    `key ${FAKE.openaiKey} ${FAKE.ghToken} ` +
    `email ${FAKE.email} path ${FAKE.posixPath} home ${FAKE.homePath} ` +
    `phone ${FAKE.phone} aws ${FAKE.awsKey}`;
  const out = redactSnippet(raw);
  // Every sensitive class is masked.
  assert.match(out, /\[redacted:secret-key\]/, "OpenAI-style key masked");
  assert.match(out, /\[redacted:token\]/, "GitHub token masked");
  assert.match(out, /\[redacted:email\]/, "email masked");
  assert.match(out, /\[redacted:path\]/, "local path masked");
  assert.match(out, /\[redacted:aws-key\]/, "AWS key masked");
  assert.match(out, /\[redacted:phone\]/, "phone masked");
  // The raw sensitive substrings are GONE.
  assert.doesNotMatch(out, new RegExp(FAKE.openaiKey), "raw secret key must not survive");
  assert.doesNotMatch(out, new RegExp(FAKE.email.replace(/\./g, "\\.")), "raw email must not survive");
  assert.doesNotMatch(out, new RegExp(FAKE.posixPath), "raw local path must not survive");
  assert.doesNotMatch(out, new RegExp(FAKE.awsKey), "raw AWS key must not survive");
  // Plain words are preserved.
  assert.match(out, /key .* email .* path .* phone/, "non-sensitive words are kept");
  // A non-string input degrades to "" (never throws).
  assert.equal(redactSnippet(null), "", "non-string input returns empty string");
});

// C1 hardening: redactSnippet ALSO masks the extended secret SHAPES — non-home absolute
// paths (/var, /etc, /opt, /srv, /usr), Windows non-Users drive paths, the multi-line PEM
// BODY (not just the header), and an unquoted password=/passwd=/pwd= value. These are the
// shapes the old "ASSERTED clean" claim quietly missed; the redactor now covers them, and
// the near-miss cases below prove it stays NARROW (no over-redaction of ordinary prose).
test("dialogue redactSnippet (C1): masks non-home system paths, Windows paths, multi-line PEM body, and unquoted password values — without over-masking prose", () => {
  // Each extended shape is masked.
  assert.match(redactSnippet(`see ${FAKE.sysVarPath} now`), /\[redacted:path\]/, "/var system path masked");
  assert.match(redactSnippet(`see ${FAKE.sysEtcPath} now`), /\[redacted:path\]/, "/etc system path masked");
  assert.match(redactSnippet(`see ${FAKE.sysOptPath} now`), /\[redacted:path\]/, "/opt system path masked");
  assert.match(redactSnippet(`open ${FAKE.winPath} now`), /\[redacted:path\]/, "Windows non-Users drive path masked");
  const pemOut = redactSnippet(FAKE.pemBlock);
  assert.match(pemOut, /\[redacted:private-key\]/, "the whole PEM block is masked");
  assert.doesNotMatch(pemOut, /MIIEowIBAAKCAQEA/, "the base64 key BODY does NOT survive (not just the header)");
  assert.doesNotMatch(pemOut, /QUJDREVGR0hJSktM/, "no base64 body line leaks through");
  assert.match(redactSnippet(`run with ${FAKE.passwdAssign} ok`), /\[redacted:secret\]/, "unquoted password= value masked");
  assert.match(redactSnippet("login passwd: s3cretValueX done"), /\[redacted:secret\]/, "passwd: value masked");
  assert.match(redactSnippet("set pwd=abcd1234 here"), /\[redacted:secret\]/, "pwd= value masked");

  // The raw secret substrings are GONE.
  assert.doesNotMatch(redactSnippet(`x ${FAKE.sysVarPath}`), new RegExp("svc/secret\\.db"), "raw /var path gone");
  assert.doesNotMatch(redactSnippet(`x ${FAKE.winPath}`), /ProgramData/, "raw Windows path gone");
  assert.doesNotMatch(redactSnippet(`x ${FAKE.passwdAssign}`), /hunter2SuperSecret/, "raw password value gone");

  // NARROWNESS: ordinary prose / near-miss shapes are NOT masked (no false redaction).
  const keep = [
    "the word etc. appears in a sentence",       // "etc." abbreviation, not /etc/
    "my password is hard to remember",           // "password" with no := value
    "passwords are important to rotate",          // plural, no assignment
    "edit src/variables.js in the repo",          // a relative path, not absolute
    "drive C: is almost full today",              // bare drive letter, no child segment
    "the keyword spwd=x is not a password field"  // pwd inside another word (boundary)
  ];
  for (const line of keep) {
    assert.doesNotMatch(redactSnippet(line), /\[redacted:/, `ordinary text must not be redacted: "${line}"`);
  }
});

// C1 hardening: the SEND gate (buildModelPrompt -> findSensitiveLeaks/assertPayloadRedacted)
// recognizes the SAME extended shapes, so the honesty claim in sendmodel.js's header
// ("no recognized-shape secret … no home-dir or /var //etc //opt //srv //usr or Windows
// drive path") matches what the code actually catches. A payload still carrying any
// extended shape must ABORT the send; a properly-redacted payload must pass.
test("sendmodel (C1): findSensitiveLeaks / assertPayloadRedacted catch the extended shapes (system+Windows paths, PEM body, password=), and the redacted form passes", () => {
  // Each extended shape, if it survived into a payload, is detected (the gate would abort).
  for (const [label, leaky, cls] of [
    ["/var path", `frag ${FAKE.sysVarPath}`, "path"],
    ["/etc path", `frag ${FAKE.sysEtcPath}`, "path"],
    ["/opt path", `frag ${FAKE.sysOptPath}`, "path"],
    ["Windows path", `frag ${FAKE.winPath}`, "path"],
    ["PEM body", FAKE.pemBlock, "private-key"],
    ["password assignment", `frag ${FAKE.passwdAssign}`, "secret"]
  ]) {
    const leaks = findSensitiveLeaks(leaky);
    assert.ok(leaks.includes(cls), `findSensitiveLeaks must report ${cls} for ${label} (got ${JSON.stringify(leaks)})`);
    assert.throws(() => assertPayloadRedacted(leaky), /Refusing to send|unredacted/, `${label} must abort the send`);
  }

  // A real buildModelPrompt over these shapes ends up REDACTED (the snippets are masked
  // before assembly), so the payload is leak-free and the gate lets it proceed.
  const snippets = [
    { kind: "completion_claim", source: FAKE.sysVarPath, line: 1, text: redactSnippet(`done at ${FAKE.sysEtcPath}`) },
    { kind: "repeated_correction", count: 2, text: redactSnippet(`stop using ${FAKE.passwdAssign}`) },
    { kind: "completion_claim", source: FAKE.winPath, line: 3, text: redactSnippet(FAKE.pemBlock) }
  ];
  const payload = buildModelPrompt(snippets);
  assert.doesNotMatch(payload, /svc\/secret\.db/, "the raw /var source path is not in the payload");
  assert.doesNotMatch(payload, /ProgramData/, "the raw Windows source path is not in the payload");
  assert.doesNotMatch(payload, /MIIEowIBAAKCAQEA/, "no PEM body in the payload");
  assert.doesNotMatch(payload, /hunter2SuperSecret/, "no raw password value in the payload");
  assert.deepEqual(findSensitiveLeaks(payload), [], "a redacted payload built from extended shapes is leak-free");
  assert.equal(assertPayloadRedacted(payload), true, "and therefore the send gate passes");
});

// C1 hardening: the header comment in sendmodel.js must NOT re-introduce the over-claim it
// was fixed to remove — i.e. it must no longer ASSERT a flat "no key/token/email/absolute
// path" guarantee, and must instead acknowledge a SHAPE allowlist. This pins the honesty
// of the comment itself (the C1 finding was that the comment over-promised).
test("sendmodel (C1): the header comment states a SHAPE allowlist, not a blanket cleanliness guarantee", () => {
  const src = readFileSync(path.join(repoRoot, "src", "sendmodel.js"), "utf8");
  // The exact old over-claim wording must be gone.
  assert.doesNotMatch(src, /ASSERTED clean \(no key\/token\/email\/absolute path\)/,
    "the old over-claiming 'ASSERTED clean (no key/token/email/absolute path)' wording must be removed");
  // The new wording must scope the claim to recognized shapes and disclaim the rest.
  assert.match(src, /recognized[- ]shape/i, "the comment must scope its claim to recognized shapes");
  assert.match(src, /SHAPE allowlist, not a guarantee/i, "the comment must disclaim it is not a total-cleanliness guarantee");
});

// --- parseDialogueExports: opt-in, fail-soft file reading -------------------
test("dialogue parseDialogueExports reads only named files and skips missing/unsupported (never throws)", () => {
  const good = writeExport("read", "user: the build is done\n");
  const parsed = parseDialogueExports([good, "/tmp/aicos-nope-missing.txt"], "dialogue");
  assert.equal(parsed.sources.length, 1, "the existing file is read");
  assert.equal(parsed.sources[0].kind, "dialogue", "the source records its kind");
  assert.ok(parsed.sources[0].lines >= 1, "line count is captured");
  assert.deepEqual(
    parsed.skipped.find((s) => s.reason === "not_found")?.path,
    "/tmp/aicos-nope-missing.txt",
    "a missing file is skipped with reason not_found, not fatal"
  );
  // An empty / non-array input is harmless.
  assert.deepEqual(parseDialogueExports(undefined).sources, [], "no paths => no sources");
});

// --- extractDialogueSignals: deterministic, cross-referenced ----------------
test("dialogue extract: a completion claim with NO backing ledger task is flagged 'not verified'; a backed one is NOT", () => {
  const text = [
    "user: the auth refactor is done",      // unbacked -> flagged
    "user: the rate limiter is done now"    // backed by an executed run -> NOT flagged
  ].join("\n");
  const parsed = { sources: [{ path: "c.txt", kind: "dialogue", bytes: 1, lines: 2, text }], skipped: [] };
  // perTask shaped like summarizeTasks output: t2 (rate limiter) has an executed run.
  const perTask = [
    { id: "t1", title: "Refactor auth flow", isSeed: false, runCount: 0, authorMarkedDoneUnverified: true, receipt: null },
    { id: "t2", title: "Add rate limiter", isSeed: false, runCount: 1, authorMarkedDoneUnverified: false, receipt: null }
  ];
  const sig = extractDialogueSignals({ parsed, perTask });
  assert.equal(sig.used, true, "a source was read");
  // Exactly the unbacked auth claim is flagged; the run-backed rate-limiter claim is not.
  assert.equal(sig.suspectedFalseCompletions.length, 1, "only the unbacked claim is flagged");
  const claim = sig.suspectedFalseCompletions[0];
  assert.match(claim.snippet, /auth refactor is done/, "the flagged claim is the auth one");
  assert.equal(claim.displayedAsDone, false, "a dialogue claim is NEVER displayed as done");
  assert.equal(claim.backed, false, "it is recorded as unbacked by the ledger");
  assert.equal(claim.confidence, "low", "a deterministic guess is low-confidence, never asserted");
});

test("dialogue extract: a self-declared cross-family receipt does NOT count as backing (claim still flagged)", () => {
  const text = "user: the rate limiter is done";
  const parsed = { sources: [{ path: "c.txt", kind: "dialogue", bytes: 1, lines: 1, text }], skipped: [] };
  // t2 has an ACCEPTED receipt but it is self-declared cross-family (familyUnverified) —
  // honesty: that is NOT verification, so the dialogue claim must STILL be flagged.
  const perTask = [
    { id: "t2", title: "Add rate limiter", isSeed: false, runCount: 0, authorMarkedDoneUnverified: false,
      receipt: { status: "accepted", familyUnverified: true } }
  ];
  const sig = extractDialogueSignals({ parsed, perTask });
  assert.equal(sig.suspectedFalseCompletions.length, 1, "a self-declared cross-family pass does not silence a chat claim");
});

test("dialogue extract: the shipped seed never backs a user's chat claim", () => {
  const text = "user: the example task is done";
  const parsed = { sources: [{ path: "c.txt", kind: "dialogue", bytes: 1, lines: 1, text }], skipped: [] };
  // A seed row, even with a run + clean accepted receipt, must not back a real claim.
  const perTask = [
    { id: "t0", title: "example task", isSeed: true, runCount: 5, authorMarkedDoneUnverified: false,
      receipt: { status: "accepted", familyUnverified: false } }
  ];
  const sig = extractDialogueSignals({ parsed, perTask });
  assert.equal(sig.suspectedFalseCompletions.length, 1, "the seed is never the user's backing");
});

test("dialogue extract: a correction repeated >= 2 times (normalized) becomes one low-confidence signal", () => {
  // Same correction, different casing + timestamp + speaker prefix -> ONE normalized
  // signal with count 3 (a normalized COUNT, not an LLM 'these mean the same' judgment).
  const text = [
    "[2026-06-01 10:00] user: Don't use any/cast, type it properly",
    "[2026-06-02 14:30] User: don't use any/cast, type it properly",
    "me > Don't use any/cast, type it properly."
  ].join("\n");
  const parsed = { sources: [{ path: "c.txt", kind: "dialogue", bytes: 1, lines: 3, text }], skipped: [] };
  const sig = extractDialogueSignals({ parsed, perTask: [] });
  assert.equal(sig.repeatedCorrections.length, 1, "the three variants collapse to one normalized correction");
  assert.equal(sig.repeatedCorrections[0].count, 3, "the normalized count is 3");
  assert.equal(sig.repeatedCorrections[0].confidence, "low", "a repeated-correction signal is low-confidence");
  // A correction seen only ONCE is not a repeated-correction signal.
  const once = extractDialogueSignals({
    parsed: { sources: [{ path: "c.txt", kind: "dialogue", bytes: 1, lines: 1, text: "user: no, not like that" }], skipped: [] },
    perTask: []
  });
  assert.equal(once.repeatedCorrections.length, 0, "a single correction is not yet a pattern");
});

// --- CLI integration: the four red lines, end-to-end ------------------------

// Build a workspace where t1 (auth) is unbacked and t2 (rate limiter) has an executed
// run, plus an export naming a 'done' for each + a thrice-repeated correction + a
// secret/email/path. Returns { ws, file }.
function dialogueScenario(label) {
  const ws = initHandoffWorkspace(label);
  makeTask(ws, "Refactor auth flow");                 // t1: unbacked
  makeTask(ws, "Add rate limiter");                   // t2: will get a run
  runCli(["run", "start", "--task", "t2", "--command", "npm test", "--workspace", ws]);
  runCli(["run", "finish", "--task", "t2", "--exit", "0", "--workspace", ws]);
  const file = writeExport(label, [
    "user: ok the auth refactor is done, ship it",
    "[2026-06-01 10:00] user: Don't use any/cast, type it properly",
    "[2026-06-02 14:30] User: don't use any/cast, type it properly",
    "me > Don't use any/cast, type it properly.",
    "user: the rate limiter is done now",
    // A completion claim that ALSO carries a secret + email (assembled from fragments
    // so the literal never appears in this source) — proves redaction on a surfaced line.
    `user: my key is ${FAKE.openaiKey} email ${FAKE.email2} — done`,
    `user: the migration is finished, see ${FAKE.posixPath}`
  ].join("\n"));
  return { ws, file };
}

test("dialogue CLI: a chat 'done' the ledger does not back is shown 'claimed in dialogue · not verified', never done; a backed one is omitted", () => {
  const s = dialogueScenario("dlg-verify");
  const out = runJson(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--json"]);

  assert.equal(out.network, "not used", "no network — the scan is deterministic + local");
  assert.equal(out.dialogueUsed, true, "the dialogue export was read");
  const dlg = out.cards.verify.filter((v) => v.source === "dialogue");
  // The auth, the secret-line, and the migration 'done's are unbacked -> 3 flagged.
  assert.equal(dlg.length, 3, "the three unbacked completion claims are flagged");
  for (const item of dlg) {
    assert.equal(item.displayedAsDone, false, "a dialogue completion claim is NEVER displayed as done");
    assert.equal(item.label, "claimed in dialogue · not verified", "the exact honesty label is carried verbatim");
    assert.equal(item.backed, false, "each is recorded as unbacked");
  }
  // The run-backed rate-limiter 'done' is NOT among the flagged claims.
  assert.ok(
    !dlg.some((v) => /rate limiter/i.test(v.snippet)),
    "the run-backed rate-limiter claim is not flagged (the ledger backs it)"
  );
  // Ledger-sourced VERIFY items stay separate (source:'ledger'); none of THEM are dialogue.
  assert.ok(out.cards.verify.every((v) => v.source === "ledger" || v.source === "dialogue"), "every verify item is tagged with its source");

  // The TEXT report shows the honesty label and never renders a chat 'done' as done.
  const text = runCli(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file]);
  assert.match(text, /claimed in dialogue · not verified/, "the text uses the non-softened honesty label");
  assert.match(text, /From your chat/, "the dialogue findings are in a clearly separated 'From your chat' block");
});

test("dialogue CLI: a redacted secret/email/path never appears raw in the report (displayed or json)", () => {
  const s = dialogueScenario("dlg-redact");
  const text = runCli(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file]);
  const json = runCli(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--json"]);
  for (const blob of [text, json]) {
    assert.doesNotMatch(blob, new RegExp(FAKE.openaiKey), "raw secret key must never surface");
    assert.doesNotMatch(blob, new RegExp(FAKE.email2.replace(/\./g, "\\.")), "raw email must never surface");
    assert.doesNotMatch(blob, new RegExp(FAKE.posixPath), "raw local path must never surface");
  }
  // The masked placeholders ARE present (so the user sees something was redacted).
  assert.match(text, /\[redacted:secret-key\]/, "the secret is shown masked");
  assert.match(text, /\[redacted:email\]/, "the email is shown masked");
  assert.match(text, /\[redacted:path\]/, "the path is shown masked");
});

test("dialogue CLI: a repeated correction becomes a PROPOSED profile candidate and bootstrap writes NOTHING", () => {
  const s = dialogueScenario("dlg-harvest");
  // Snapshot every ledger BEFORE so we can prove report-only wrote nothing.
  const before = {
    tasks: ledgerRows(s.ws, "tasks.jsonl"),
    evidence: ledgerRows(s.ws, "evidence.jsonl"),
    runs: ledgerRows(s.ws, "runs.jsonl"),
    receipts: ledgerRows(s.ws, "receipts.jsonl"),
    learning: ledgerRows(s.ws, "learning-ledger.jsonl")
  };

  const out = runJson(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--json"]);
  const cands = out.cards.harvest.dialogueCandidates;
  assert.equal(cands.length, 1, "the thrice-repeated correction yields one profile candidate");
  assert.equal(cands[0].proposed, true, "the candidate is PROPOSED, never auto-applied");
  assert.equal(cands[0].type, "profile", "it is a profile candidate");
  assert.equal(cands[0].count, 3, "it carries the normalized repeat count");

  // The text says proposed / nothing saved.
  const text = runCli(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file]);
  assert.match(text, /proposed — nothing saved/i, "the dialogue HARVEST block says nothing is saved");

  // RED LINE: report-only bootstrap mutated NO ledger, even with a dialogue scan.
  const after = {
    tasks: ledgerRows(s.ws, "tasks.jsonl"),
    evidence: ledgerRows(s.ws, "evidence.jsonl"),
    runs: ledgerRows(s.ws, "runs.jsonl"),
    receipts: ledgerRows(s.ws, "receipts.jsonl"),
    learning: ledgerRows(s.ws, "learning-ledger.jsonl")
  };
  assert.deepEqual(after, before, "a dialogue scan writes NOTHING to any ledger (report-only)");
});

test("dialogue CLI: WITHOUT --dialogue / --logs the report is byte-identical to before (opt-in, off by default)", () => {
  const s = dialogueScenario("dlg-optin");
  // Two runs with no connector flag must be identical AND carry no dialogue output.
  const a = runCli(["bootstrap", "--yes", "--workspace", s.ws]);
  const b = runCli(["bootstrap", "--yes", "--workspace", s.ws]);
  assert.equal(a, b, "no-flag bootstrap is deterministic");
  assert.doesNotMatch(a, /From your chat|local export|redacted|claimed in dialogue/i, "no dialogue output appears without the flag");
  // --json: dialogue is null + dialogueUsed false when no connector was used.
  const json = runJson(["bootstrap", "--yes", "--workspace", s.ws, "--json"]);
  assert.equal(json.dialogueUsed, false, "dialogueUsed is false without a connector");
  assert.equal(json.dialogue, null, "the dialogue transparency record is null without a connector");
});

test("dialogue CLI: the consent gate (no --yes) names the dialogue file in scope and still promises local-only", () => {
  const s = dialogueScenario("dlg-consent");
  const gated = runResult(["bin/ai-collab.js", "bootstrap", "--workspace", s.ws, "--dialogue", s.file]);
  assert.equal(gated.status, 0, "the consent preview is not an error");
  assert.match(gated.stdout, /chat\.txt/, "the consent scope names the dialogue file the user provided");
  assert.match(gated.stdout, /never sent anywhere|read locally/i, "the consent preview keeps the local-only promise for the dialogue source");
  assert.match(gated.stdout, /--yes/, "it still requires an explicit --yes to proceed");
  // No report (no 'From your chat' findings) is produced before consent.
  assert.doesNotMatch(gated.stdout, /From your chat/, "no dialogue findings are produced before --yes");
});

test("dialogue CLI: a named-but-missing file is reported as skipped (transparent), not silently ignored or fatal", () => {
  const s = dialogueScenario("dlg-skip");
  const out = runCli(["bootstrap", "--yes", "--workspace", s.ws, "--logs", `/tmp/aicos-nope-${Date.now()}.txt,${s.file}`]);
  assert.match(out, /skipped .*not found/i, "the missing file is reported skipped with a reason");
  assert.match(out, /Read 1 local export/, "the real file is still read");
});

// ===========================================================================
// semantic scan v1, EXTERNAL-MODEL HALF (src/sendmodel.js + bootstrap --send-to-model)
// ===========================================================================
// The ONLY path that can send a user's data off this machine. Every test here pins one
// of the five privacy/honesty red lines. CRITICAL: not one test ever spawns a real model
// — unit tests inject `invoke`, CLI tests point `--model` at a tiny node script that
// prints fixed JSON on stdin (commandThatPrints / a written stub). A real network call is
// structurally impossible in this suite.

// A synthetic model "response" object the way the model would emit it (the model gets to
// CLAIM high confidence — the parser must override it to low). Built fresh per test.
function fakeModelStdout(candidates) {
  return JSON.stringify({ candidates });
}

// An injectable `invoke` (the runModel/runExternalModelPass seam) that records the payload
// it was handed and returns a fixed result — NEVER spawns anything. `result` defaults to a
// successful single-candidate response; pass { ok:false } / a bad stdout to exercise degrade.
function stubInvoke(result) {
  const calls = [];
  const invoke = (cmd, payload, opts) => {
    calls.push({ cmd, payload, opts });
    if (typeof result === "function") return result(cmd, payload, opts);
    return result;
  };
  invoke.calls = calls;
  return invoke;
}

// --- A. collectRedactedSnippets: only redacted snippets, from both signal lists --------
test("sendmodel collectRedactedSnippets: pulls redacted snippets from BOTH dialogue signal lists, re-redacting (defense in depth)", () => {
  // A dialogue result shaped like scanDialogueAndLogs() output, but with a RAW secret left
  // in a snippet (simulating an upstream redaction miss) to prove the second masking fires.
  const dialogue = {
    suspectedFalseCompletions: [
      { source: FAKE.posixPath, line: 4, snippet: `auth done, key ${FAKE.openaiKey}` },
      { source: null, line: null, snippet: "" } // empty snippet is skipped
    ],
    repeatedCorrections: [
      { count: 3, snippet: `stop emailing ${FAKE.email2}` }
    ]
  };
  const snippets = collectRedactedSnippets(dialogue);
  assert.equal(snippets.length, 2, "the empty snippet is dropped; the two real ones are kept");

  const completion = snippets.find((s) => s.kind === "completion_claim");
  const correction = snippets.find((s) => s.kind === "repeated_correction");
  assert.ok(completion && correction, "each signal list contributes its kind tag");
  assert.equal(completion.line, 4, "the completion carries its source line");
  assert.equal(correction.count, 3, "the correction carries its repeat count");

  // Defense in depth: even a raw fragment is re-redacted here.
  assert.doesNotMatch(completion.text, new RegExp(FAKE.openaiKey), "a raw key in a snippet is re-masked");
  assert.doesNotMatch(correction.text, new RegExp(FAKE.email2.replace(/\./g, "\\.")), "a raw email in a snippet is re-masked");
  assert.match(completion.text, /\[redacted:secret-key\]/, "the masked placeholder is present instead");

  // Robust to junk input.
  assert.deepEqual(collectRedactedSnippets(null), [], "null dialogue -> no snippets (no throw)");
  assert.deepEqual(collectRedactedSnippets({}), [], "a dialogue with no signal lists -> no snippets");
});

// --- B. buildModelPrompt + the redaction assertion (the hard privacy gate) -------------
test("sendmodel buildModelPrompt: embeds ONLY redacted text + the honesty directive, and REDACTS the source path so a home-dir export does not abort the send", () => {
  // The common real case: the export lives under the user's HOME dir. The source path is an
  // absolute local path (sensitive) — it MUST be masked in the payload, or (1) it would be
  // exfiltrated and (2) assertPayloadRedacted would trip on it and abort every legit send.
  const snippets = [
    { kind: "completion_claim", source: FAKE.posixPath, line: 2, text: "auth refactor [redacted:secret-key] done" },
    { kind: "repeated_correction", count: 2, text: "type it properly" }
  ];
  const payload = buildModelPrompt(snippets);

  // The directive (all four red lines) is present and the model is told JSON-only.
  assert.match(payload, /NEVER claim anything is completed or verified/, "red line #1 is stated to the model");
  assert.match(payload, /PROPOSED candidate/, "red line #2 (everything proposed) is stated");
  assert.match(payload, /independent cross-family/i, "red line #4 (single model != independent) is stated");
  assert.match(payload, /STRICT JSON ONLY/, "the model is constrained to JSON only");

  // The source path is masked (not the raw home path) — the load-bearing fix.
  assert.doesNotMatch(payload, new RegExp(FAKE.posixPath), "the raw source path must NOT appear in the payload");
  assert.match(payload, /\[redacted:path\]/, "the source path is embedded masked");

  // And therefore the hard gate PASSES (the send is allowed to proceed).
  assert.deepEqual(findSensitiveLeaks(payload), [], "a properly-redacted payload has no detected leaks");
  assert.equal(assertPayloadRedacted(payload), true, "assertPayloadRedacted returns true on a clean payload");
});

test("sendmodel assertPayloadRedacted: THROWS (aborts the send) when ANY sensitive shape survives, and findSensitiveLeaks names every class", () => {
  // A payload that still carries every forbidden class (an upstream redaction failure).
  const leaky =
    `key ${FAKE.openaiKey} token ${FAKE.ghToken} aws ${FAKE.awsKey} ` +
    `email ${FAKE.email2} path ${FAKE.homePath}`;
  const leaks = findSensitiveLeaks(leaky);
  for (const cls of ["secret-key", "token", "aws-key", "email", "path"]) {
    assert.ok(leaks.includes(cls), `findSensitiveLeaks must report the surviving ${cls}`);
  }
  assert.throws(
    () => assertPayloadRedacted(leaky),
    /Refusing to send|unredacted sensitive data/,
    "an un-redacted payload must abort the send by throwing"
  );
  // The placeholder tokens themselves are NOT flagged (a redacted payload reads clean).
  assert.deepEqual(findSensitiveLeaks("nothing here but [redacted:secret-key] and [redacted:email]"), [], "redacted placeholders are not leaks");
});

// --- C. runModel: the injectable call; the real model is NEVER spawned -----------------
test("sendmodel runModel: hands the payload to the INJECTED invoke (no real spawn) and normalizes the result; a throwing/failed invoke degrades, never crashes", () => {
  const ok = stubInvoke({ ok: true, stdout: "OUT", stderr: "", code: 0 });
  const r1 = runModel("PAYLOAD", { invoke: ok, cmd: "claude -p" });
  assert.equal(r1.ok, true, "a successful invoke yields ok:true");
  assert.equal(r1.stdout, "OUT", "the model stdout is returned");
  assert.equal(ok.calls.length, 1, "the injected invoke was called exactly once");
  assert.equal(ok.calls[0].payload, "PAYLOAD", "the (already-redacted) payload is what was handed to invoke");

  // A failed invoke (missing binary / non-zero exit) -> ok:false with the reason, no throw.
  const bad = stubInvoke({ ok: false, error: "ENOENT: claude not found", stdout: "", stderr: "" });
  const r2 = runModel("PAYLOAD", { invoke: bad });
  assert.equal(r2.ok, false, "a failed invoke degrades to ok:false");
  assert.match(r2.error, /ENOENT/, "the failure reason is surfaced");

  // An invoke that THROWS must still degrade gracefully (bootstrap can never crash here).
  const thrower = stubInvoke(() => { throw new Error("boom"); });
  const r3 = runModel("PAYLOAD", { invoke: thrower });
  assert.equal(r3.ok, false, "a throwing invoke is caught and degraded");
  assert.match(r3.error, /boom/, "the thrown message is surfaced as the error");

  // An empty payload is refused before any invoke.
  const never = stubInvoke({ ok: true, stdout: "x" });
  const r4 = runModel("", { invoke: never });
  assert.equal(r4.ok, false, "an empty payload is rejected");
  assert.equal(never.calls.length, 0, "invoke is not called for an empty payload");
});

// --- D. parseModelResponse: LLM is the least-trusted input -----------------------------
test("sendmodel parseModelResponse: FORCES low/proposed/source:model/displayedAsDone:false, drops unknown kinds, and DISCARDS unparseable output (never a junk candidate)", () => {
  // The model CLAIMS high confidence and slips in an unaudited kind + a blank-summary item.
  const stdout = "```json\n" + fakeModelStdout([
    { kind: "false_completion", summary: "claims auth done", confidence: "high", basis: "chat says done" },
    { kind: "totally_made_up_kind", summary: "should be dropped", confidence: "high" },
    { kind: "profile_candidate", summary: "   ", confidence: "low" }, // blank summary -> dropped
    { kind: "harvest_candidate", summary: "reuse the retry helper", confidence: "medium" }
  ]) + "\n```";
  const parsed = parseModelResponse(stdout);
  assert.equal(parsed.ok, true, "valid JSON (even inside a ```json fence) parses");
  assert.equal(parsed.candidates.length, 2, "the unknown-kind and blank-summary candidates are dropped");
  assert.equal(parsed.dropped, 2, "the drop count is reported honestly");

  for (const c of parsed.candidates) {
    assert.equal(c.confidence, "low", "the model does NOT get to self-promote confidence — forced low");
    assert.equal(c.proposed, true, "every model candidate is proposed, never a conclusion");
    assert.equal(c.source, "model", "every model candidate is tagged source:model (kept apart)");
    assert.equal(c.displayedAsDone, false, "a model candidate is NEVER displayed as done");
    assert.ok(MODEL_CANDIDATE_KINDS.includes(c.kind), "only audited kinds survive");
  }

  // Unparseable / wrong-shape output is DISCARDED (no candidate is ever fabricated from it).
  for (const junk of ["", "   ", "I cannot help with that", "{not json", JSON.stringify({ notCandidates: [] })]) {
    const r = parseModelResponse(junk);
    assert.equal(r.ok, false, `"${junk.slice(0, 12)}" must not parse into a result`);
    assert.deepEqual(r.candidates, [], "a failed parse yields NO candidates");
    assert.ok(typeof r.reason === "string" && r.reason.length > 0, "a failed parse states why");
  }
});

// --- E. runExternalModelPass: the orchestrated, consent-already-given send -------------
test("sendmodel runExternalModelPass: assert -> (injected) call -> parse, returning ONLY low/proposed/source:model candidates; degrades on call failure / bad output; NEVER writes anything", () => {
  const snippets = [{ kind: "completion_claim", source: FAKE.posixPath, line: 1, text: "auth [redacted:secret-key] done" }];

  // Happy path: a stub returns a valid candidate; the pass surfaces it stamped low/proposed.
  const goodInvoke = stubInvoke({ ok: true, stdout: fakeModelStdout([
    { kind: "false_completion", summary: "auth claimed done, unverified", confidence: "high", basis: "chat" }
  ]) });
  const pass = runExternalModelPass({ snippets, invoke: goodInvoke, modelCmd: "claude -p" });
  assert.equal(pass.ok, true, "a clean payload + valid model output succeeds");
  assert.equal(pass.degraded, false, "a successful pass is not degraded");
  assert.equal(pass.candidates.length, 1, "the one valid candidate is returned");
  assert.equal(pass.candidates[0].confidence, "low", "the surfaced candidate is forced low-confidence");
  assert.equal(pass.candidates[0].source, "model", "the surfaced candidate is source:model");
  assert.equal(pass.candidates[0].displayedAsDone, false, "the surfaced candidate is never done");
  // The payload that was actually handed to the model carries no plaintext path/secret.
  assert.deepEqual(findSensitiveLeaks(goodInvoke.calls[0].payload), [], "the sent payload is leak-free");

  // Degrade #1: the model call fails (missing binary) -> degrade, no candidates, a reason.
  const failInvoke = stubInvoke({ ok: false, error: "ENOENT", stdout: "" });
  const d1 = runExternalModelPass({ snippets, invoke: failInvoke });
  assert.equal(d1.ok, false, "a failed call degrades");
  assert.equal(d1.degraded, true, "degrade is flagged");
  assert.deepEqual(d1.candidates, [], "a degraded pass yields no candidates");

  // Degrade #2: the model answers, but not as JSON -> discard + degrade (never a junk card).
  const junkInvoke = stubInvoke({ ok: true, stdout: "here is some prose, not json" });
  const d2 = runExternalModelPass({ snippets, invoke: junkInvoke });
  assert.equal(d2.ok, false, "unparseable model output degrades");
  assert.deepEqual(d2.candidates, [], "no candidate is fabricated from unparseable output");

  // Degrade #3 (the hard gate): if a payload somehow still leaks, the send ABORTS before
  // the model is ever called. We force this by handing a snippet whose text is NOT redacted.
  const leakSnippets = [{ kind: "completion_claim", text: `key ${FAKE.openaiKey}` }];
  const neverInvoke = stubInvoke({ ok: true, stdout: fakeModelStdout([]) });
  const d3 = runExternalModelPass({ snippets: leakSnippets, invoke: neverInvoke });
  assert.equal(d3.ok, false, "a leaky payload aborts the pass");
  assert.equal(d3.sent, false, "nothing was sent when the gate fired");
  assert.equal(neverInvoke.calls.length, 0, "the model is NEVER called once the leak gate fires");
  assert.match(d3.reason, /Refusing to send|unredacted/, "the abort reason is the redaction gate");
});

// --- F. buildSendPreview + the candidate kinds / default command -----------------------
test("sendmodel buildSendPreview / constants: the preview states sources + count + all-redacted + model, and the public constants are the audited set", () => {
  const dialogue = { sources: [{ path: FAKE.posixPath }, { path: "/tmp/log.txt" }] };
  const snippets = [{ text: "a" }, { text: "b" }, { text: "c" }];
  const preview = buildSendPreview({ dialogue, snippets, modelCmd: "claude -p" });
  assert.equal(preview.snippetCount, 3, "the preview counts the snippets that would be sent");
  assert.equal(preview.allRedacted, true, "the preview asserts every snippet is redacted");
  assert.equal(preview.model, "claude -p", "the preview names the target model");
  assert.deepEqual(preview.sources, [FAKE.posixPath, "/tmp/log.txt"], "the preview lists the sources");
  // Defaulting: no model given -> the documented default command.
  assert.equal(buildSendPreview({ dialogue: null, snippets: [], modelCmd: "" }).model, DEFAULT_MODEL_CMD, "an empty model falls back to the default");

  assert.equal(DEFAULT_MODEL_CMD, "claude -p", "the default external command is claude over stdin (-p / print mode)");
  assert.deepEqual(
    [...MODEL_CANDIDATE_KINDS].sort(),
    ["context_gap", "false_completion", "harvest_candidate", "profile_candidate"],
    "the audited candidate kinds match the four local-half card shapes"
  );
});

// =====================  CLI integration (bootstrap --send-to-model)  =====================
// These drive the REAL CLI. The model is replaced by pointing --model at a node script that
// prints fixed JSON on stdin — so a real `claude` / network is never touched. Each test also
// proves the report-only contract: the ledgers' bytes never change.

// A fixture: an inited workspace + a dialogue export with an UNBACKED completion claim that
// also carries a secret + email + an absolute path (assembled from fragments), so the
// redaction + leak-gate are exercised on a really-sent payload.
function sendScenario(label) {
  const dir = mkdtempSync(path.join(tmpdir(), `aicos-send-${label}-`));
  runCli(["init", "--target", dir, "--force"]);
  const ws = path.join(dir, ".aict");
  const file = path.join(dir, "chat.txt");
  writeFileSync(file, [
    // A completion CLAIM that ALSO carries a secret + email + an absolute /Users path,
    // so the surfaced snippet (which is what travels to the model) exercises redaction on
    // a really-sent line. The sensitive data MUST be on a completion-claim line (one that
    // matches a "done/finished" marker), because only flagged claims become snippets — a
    // secret on a non-claim line would never reach the payload, so the redaction assertion
    // would be testing empty content.
    `user: the auth refactor is done — my key ${FAKE.openaiKey}, ping ${FAKE.email2}, see ${FAKE.posixPath}`,
    "user: ok the rate limiter is finished, ship it"
  ].join("\n"), "utf8");
  return { dir, ws, file };
}

// A node "model" stub: reads the prompt on stdin (ignored) and prints the given JSON. This
// is the SAME shape the production default (`claude -p`) is invoked as (prompt on stdin),
// so --model "<node> <stub>" is a faithful, offline stand-in. `marker` (optional) is a file
// the stub touches when run, so a test can assert the stub was / was NOT invoked.
//
// The returned command is the bin + script joined by a single space, UNQUOTED — the CLI's
// model-command parser is a plain whitespace token split (a command token list, per spec),
// so the node binary path and the temp script path (neither of which contains a space on
// any supported test host) are passed as bare tokens. The script body still references the
// marker/response via JSON.stringify, but the COMMAND tokens must be quote-free.
function fakeModelScript(dir, name, responseObj, marker) {
  const file = path.join(dir, name);
  const touch = marker ? `require("fs").writeFileSync(${JSON.stringify(marker)}, "HIT");` : "";
  writeFileSync(file,
    `let b="";process.stdin.on("data",d=>b+=d);process.stdin.on("end",()=>{${touch}` +
    `process.stdout.write(${JSON.stringify(JSON.stringify(responseObj))});});\n`,
    "utf8");
  return `${nodeBin} ${file}`;
}

// Snapshot every ledger's bytes so a test can prove report-only wrote NOTHING.
function ledgerSha(ws) {
  const names = ["tasks.jsonl", "evidence.jsonl", "runs.jsonl", "receipts.jsonl", "learning-ledger.jsonl"];
  return names.map((n) => `${n}:${sha256Text(JSON.stringify(ledgerRows(ws, n)))}`).join("|");
}

test("bootstrap CLI: WITHOUT --send-to-model the report is byte-identical and the model is NEVER invoked (red line #1: default never sends)", () => {
  const s = sendScenario("default-off");
  const marker = path.join(s.dir, "stub-was-called.txt");
  const model = fakeModelScript(s.dir, "stub.js", { candidates: [] }, marker);

  // The baseline (no send flag) ...
  const plain = runCli(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file]);
  // ... is byte-identical even if a --model is dangling on the line (it's only consumed by
  // the send path, which is OFF). And the stub must never have run.
  const withDanglingModel = runCli(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--model", model]);
  assert.equal(withDanglingModel, plain, "a --model with no --send-to-model does not change the output");
  assert.equal(existsSync(marker), false, "the model stub is NEVER invoked without --send-to-model");
  assert.doesNotMatch(plain, /external model|From the external/i, "no external-model section appears by default");

  // The --json network field stays the honest "not used".
  const json = runJson(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--json"]);
  assert.equal(json.network, "not used", "network stays 'not used' with no send");
  assert.equal(json.sendToModel, null, "sendToModel is null when not requested");
});

test("bootstrap CLI: --send-to-model on a non-interactive shell WITHOUT --yes is REFUSED and the model is never called (red line #2: no consent => nothing sent)", () => {
  const s = sendScenario("consent");
  const marker = path.join(s.dir, "called.txt");
  const model = fakeModelScript(s.dir, "stub.js", { candidates: [{ kind: "false_completion", summary: "x", confidence: "low" }] }, marker);

  // runResult uses stdio: ['ignore', ...] so stdin is NOT a TTY. With no --yes, the
  // local-scan consent gate (which guards the WHOLE bootstrap, the send included) fires
  // first and stops execution before anything is scanned OR sent — the single consent
  // flag (--yes) is required to do anything. Either way the load-bearing invariant holds:
  // with no consent on a non-interactive shell, NOTHING reaches the model.
  const res = runResult(["bin/ai-collab.js", "bootstrap", "--workspace", s.ws, "--dialogue", s.file, "--send-to-model", "--model", model]);
  assert.equal(res.status, 0, "a refusal is not a crash");
  assert.match(res.stdout, /--yes/, "it tells the user that --yes is required to proceed");
  assert.match(res.stdout, /sends nothing anywhere|never sent anywhere|does NOT call any external model/i, "it reaffirms nothing is sent without consent");
  assert.equal(existsSync(marker), false, "the model is NEVER called without consent");
  // And no model section / candidate was produced.
  assert.doesNotMatch(res.stdout, /From the external model/, "no model candidates are produced without consent");
});

test("bootstrap CLI: --send-to-model --yes prints the send preview (sources + count + redacted + model) BEFORE the candidates (red line #2: preview before send)", () => {
  const s = sendScenario("preview");
  const model = fakeModelScript(s.dir, "stub.js", {
    candidates: [{ kind: "false_completion", summary: "auth claimed done, unverified", confidence: "low", basis: "chat" }]
  });
  // --yes satisfies the one consent flag AND pre-confirms the send (non-interactive path);
  // the preview is STILL printed first so the scope is shown before the model is contacted.
  const out = runCli(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--send-to-model", "--model", model]);
  const previewIdx = out.indexOf("About to send to an external model");
  const candidatesIdx = out.indexOf("From the external model");
  assert.ok(previewIdx !== -1, "the send preview names what would go out");
  assert.match(out, /the prompt is delivered on stdin, never on the command line/, "the preview states the prompt travels on stdin");
  assert.match(out, /redacted snippet/, "the preview states the snippet count is redacted");
  assert.match(out, /only feature that contacts a model off this machine/, "the preview states this is the only egress");
  assert.ok(candidatesIdx === -1 || previewIdx < candidatesIdx, "the preview is shown BEFORE any returned candidate");
});

test("bootstrap CLI: --send-to-model --yes runs the (stubbed) model and surfaces a LOW-confidence, PROPOSED, source:model candidate; the ledgers are byte-unchanged (red lines #5/#6: least-trusted + never written)", () => {
  const s = sendScenario("real-send");
  const before = ledgerSha(s.ws);
  // The stub CLAIMS high confidence — the pipeline must override it to low.
  const model = fakeModelScript(s.dir, "stub.js", {
    candidates: [{ kind: "false_completion", summary: "auth refactor claimed done but unverified", confidence: "high", basis: "the chat says done" }]
  });

  const json = runJson(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--send-to-model", "--model", model, "--json"]);
  assert.ok(json.sendToModel, "a send was recorded");
  assert.equal(json.sendToModel.sent, true, "the send actually happened (the stub answered)");
  assert.equal(json.sendToModel.degraded, false, "a valid answer is not a degrade");
  assert.equal(json.sendToModel.candidates.length, 1, "the one model candidate is surfaced");
  const c = json.sendToModel.candidates[0];
  assert.equal(c.confidence, "low", "the model's claimed 'high' is OVERRIDDEN to low (LLM is least-trusted)");
  assert.equal(c.proposed, true, "the candidate is proposed only");
  assert.equal(c.source, "model", "the candidate is tagged source:model");
  assert.equal(c.displayedAsDone, false, "the candidate is never displayed as done");
  assert.equal(json.network, "external model contacted (redacted payload)", "network honestly reports the one egress");

  // RED LINE #6: report-only — NOTHING was written to any ledger.
  assert.equal(ledgerSha(s.ws), before, "a --send-to-model run mutates NO ledger (report-only)");

  // The TEXT report labels the candidate as an unverified AI suggestion, not a result.
  const text = runCli(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--send-to-model", "--model", model]);
  assert.match(text, /From the external model/, "the model section is clearly separated");
  assert.match(text, /AI suggestion · low confidence · unverified · proposed only/, "the unverified caveat is shown verbatim");
  assert.match(text, /Nothing here was written anywhere/, "the text states nothing was written");
});

test("bootstrap CLI: the really-sent payload contains NO plaintext secret / email / absolute path (red line #3: redacted, asserted)", () => {
  const s = sendScenario("redacted-payload");
  // The stub ECHOES the prompt it received (so the test can inspect exactly what was sent),
  // wrapped in a valid empty-candidates JSON so the run still succeeds.
  const echoStub = path.join(s.dir, "echo.js");
  const echoOut = path.join(s.dir, "sent-payload.txt");
  writeFileSync(echoStub,
    `let b="";process.stdin.on("data",d=>b+=d);process.stdin.on("end",()=>{` +
    `require("fs").writeFileSync(${JSON.stringify(echoOut)}, b);` +
    `process.stdout.write('{"candidates":[]}');});\n`, "utf8");
  const model = `${nodeBin} ${echoStub}`;

  runCli(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--send-to-model", "--model", model]);
  const sent = readFileSync(echoOut, "utf8");
  assert.ok(sent.length > 0, "the payload reached the (stub) model on stdin");
  assert.doesNotMatch(sent, new RegExp(FAKE.openaiKey), "the raw secret key must NEVER be in the sent payload");
  assert.doesNotMatch(sent, new RegExp(FAKE.email2.replace(/\./g, "\\.")), "the raw email must NEVER be in the sent payload");
  assert.doesNotMatch(sent, new RegExp(FAKE.posixPath), "the raw absolute path must NEVER be in the sent payload");
  // The masked placeholders ARE present (so the redaction is visible, not just absent data).
  assert.match(sent, /\[redacted:/, "the payload carries masked placeholders");
});

test("bootstrap CLI: a model that returns junk (not JSON) DEGRADES gracefully to the local result, exit 0, nothing fabricated (red line #4: graceful degrade)", () => {
  const s = sendScenario("degrade");
  const before = ledgerSha(s.ws);
  // A stub that prints prose, not JSON.
  const badStub = path.join(s.dir, "bad.js");
  writeFileSync(badStub,
    `process.stdin.on("data",()=>{});process.stdin.on("end",()=>{process.stdout.write("Sorry, I can't help with that.");});\n`, "utf8");
  const model = `${nodeBin} ${badStub}`;

  const res = runResult(["bin/ai-collab.js", "bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--send-to-model", "--model", model]);
  assert.equal(res.status, 0, "a bad model answer is NOT a crash");
  assert.match(res.stdout, /could not be used|falling back to your local result/i, "it degrades to the local result");
  assert.match(res.stdout, /Nothing was fabricated/, "it explicitly fabricates nothing");
  assert.doesNotMatch(res.stdout, /From the external model/, "no candidate section is shown for a degrade");
  // The honest local report is still there ...
  assert.match(res.stdout, /claimed in dialogue · not verified|From your chat/, "the local result still stands");
  // ... and still nothing was written.
  assert.equal(ledgerSha(s.ws), before, "a degraded send writes no ledger");

  const json = runJson(["bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--send-to-model", "--model", model, "--json"]);
  assert.equal(json.sendToModel.degraded, true, "the json marks the pass degraded");
  assert.equal(json.sendToModel.candidates.length, 0, "no candidate is produced from junk output");
  assert.equal(json.network, "not used", "a degraded send did not usefully contact a model -> network stays 'not used'");
});

test("bootstrap CLI: --dry-run-send prints the EXACT redacted payload and calls NO model (red line #3 audit)", () => {
  const s = sendScenario("dry-run");
  const marker = path.join(s.dir, "called.txt");
  const model = fakeModelScript(s.dir, "stub.js", { candidates: [] }, marker);

  // --dry-run-send needs no --yes (it sends nothing) and must not invoke the model.
  const res = runResult(["bin/ai-collab.js", "bootstrap", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--dry-run-send", "--model", model]);
  assert.equal(res.status, 0, "dry-run is not an error");
  assert.equal(existsSync(marker), false, "--dry-run-send NEVER calls the model");
  assert.match(res.stdout, /dry-run-send: the EXACT redacted payload/, "it announces the dry-run payload");
  assert.match(res.stdout, /STRICT JSON ONLY/, "the payload includes the honesty directive that would be sent");
  // The dry-run payload is redaction-clean (it was asserted before printing).
  assert.doesNotMatch(res.stdout, new RegExp(FAKE.openaiKey), "the dry-run payload carries no raw secret");
  assert.doesNotMatch(res.stdout, new RegExp(FAKE.posixPath), "the dry-run payload carries no raw absolute path");
  assert.match(res.stdout, /\[redacted:/, "the dry-run payload shows masked placeholders");
});

test("bootstrap CLI i18n: the external-model surface (preview / candidate caveat / dry-run) is localized to Chinese under --lang zh", () => {
  const s = sendScenario("i18n-zh");
  const model = fakeModelScript(s.dir, "stub.js", {
    candidates: [{ kind: "harvest_candidate", summary: "可复用的重试封装", confidence: "low", basis: "对话里反复出现" }]
  });

  // A real send (with --yes) in Chinese: the candidate caveat is the localized one.
  const sent = runResult(["bin/ai-collab.js", "bootstrap", "--lang", "zh", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--send-to-model", "--model", model], { env: { ...process.env, AI_COLLAB_LANG: "zh" } });
  assert.equal(sent.status, 0, "the zh send is not an error");
  assert.match(sent.stdout, /来自外部模型/, "the candidate section header is in Chinese");
  assert.match(sent.stdout, /AI 建议 · 低置信 · 未验证/, "the unverified caveat is localized to Chinese");
  assert.match(sent.stdout, /没有被写入任何地方/, "the 'nothing was written' promise is localized");

  // A dry-run in Chinese localizes the payload header too.
  const dry = runResult(["bin/ai-collab.js", "bootstrap", "--lang", "zh", "--yes", "--workspace", s.ws, "--dialogue", s.file, "--dry-run-send"], { env: { ...process.env, AI_COLLAB_LANG: "zh" } });
  assert.match(dry.stdout, /将要发送的确切去敏负载/, "the dry-run header is localized to Chinese");
});
