import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  mechanismDefinitions,
  requiredAdapterIds,
  requiredCaseIds,
  requiredMechanismIds,
  requiredPromptFiles,
  requiredSkillIds,
  requiredWorkspaceDirs
} from "./catalog.js";
import {
  parseLedgerFile,
  ledgerPath,
  TASK_STATUSES,
  GUARD_LEVELS,
  RECEIPT_VERDICTS,
  REVIEW_MODES,
  doneRequiresEvidence,
  ownedEvidenceIds,
  ownedRerunEvidenceIds,
  ownedCrossFamilyGuardEvidenceIds,
  guardLevelVerdictError,
  guardLevelRank,
  computeReceiptGuardLevel,
  ownerAcceptanceError,
  receiptStatusFor,
  specialEvidenceStructureError,
  rerunRunReconcileError,
  learningRecordError,
  EVIDENCE_KIND_RERUN,
  RECEIPT_STATUSES
} from "./ledger.js";

// True for a rerun evidence row that carries a (present, non-blank) runId — the
// rows the L4 reconciliation read-check (2c) inspects. A rerun with no runId is a
// valid generic rerun that simply cannot reach L4, so it is intentionally excluded.
function isRerunWithRunId(record) {
  return (
    record != null &&
    typeof record === "object" &&
    record.kind === EVIDENCE_KIND_RERUN &&
    typeof record.runId === "string" &&
    record.runId.trim().length > 0
  );
}

function read(file) {
  return readFileSync(file, "utf8");
}

function exists(root, ...parts) {
  return existsSync(path.join(root, ...parts));
}

function requireFile(errors, root, ...parts) {
  const file = path.join(root, ...parts);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    errors.push(`missing file ${path.relative(root, file)}`);
    return "";
  }
  return read(file);
}

function requireDir(errors, root, ...parts) {
  const dir = path.join(root, ...parts);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    errors.push(`missing directory ${path.relative(root, dir)}`);
  }
}

function includesAll(errors, label, content, phrases) {
  for (const phrase of phrases) {
    if (!new RegExp(phrase, "i").test(content)) {
      errors.push(`${label} missing ${phrase}`);
    }
  }
}

// --- Deep-validation helpers ----------------------------------------------
//
// These power the structural depth checks (P2): they look past "the file
// exists and contains keyword X" into "this file actually carries the
// substance a real workspace would". Each helper is intentionally cheap and
// deterministic so a degraded workspace fails loudly with a pointable reason.

const MECHANISM_BY_ID = new Map(mechanismDefinitions.map((mechanism) => [mechanism.id, mechanism]));

// Mechanisms whose catalog entry carries the deepened 9-element shape
// (antiTrigger + inputsDetailed + outputShape + passBar + rejectBar + misuse).
// Their rendered README therefore must expose those structural anchors; a thin
// mechanism that only has Purpose/When/Input/Process/Package files is fine for
// the lighter mechanisms but a regression for these.
const DEEP_MECHANISM_README_ANCHORS = [
  "## When not to use",
  "## Input materials",
  "## Output shape",
  "## Pass bar",
  "## Reject bar",
  "## Common misuse"
];

function isDeepMechanism(mechanismId) {
  const mechanism = MECHANISM_BY_ID.get(mechanismId);
  if (!mechanism) return false;
  return Boolean(
    mechanism.antiTrigger &&
      mechanism.inputsDetailed &&
      mechanism.outputShape &&
      mechanism.passBar &&
      mechanism.rejectBar &&
      mechanism.misuse
  );
}

function readIfPresent(root, ...parts) {
  const file = path.join(root, ...parts);
  if (!existsSync(file) || statSync(file).isDirectory()) return null;
  return read(file);
}

function countFences(content) {
  return (content.match(/^```/gm) ?? []).length;
}

function nonEmptyLines(content) {
  return content.split("\n").filter((line) => line.trim().length > 0);
}

// "Substance" lines = non-empty lines that are not part of the fixed artifact
// scaffold (the title, the standard `## ` section headings, fence markers, and
// the boilerplate "Why this exists" trailer). This is what separates a real
// filled artifact from a hollowed-out template that still keeps its headings.
function substanceLines(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("```"))
    .filter((line) => !/^This artifact makes the case runnable and reviewable\./i.test(line));
}

// Level-2 headings, lower-cased, in document order — used both to detect
// duplicated stacked sections inside one file and to compare across cases.
function level2Headings(content) {
  const headings = [];
  for (const match of content.matchAll(/^##\s+(.+?)\s*$/gm)) {
    headings.push(match[1].trim().toLowerCase());
  }
  return headings;
}

// A normalized signature of a case CASE.md body with the per-case unique text
// (code fences) stripped, used to catch "same boilerplate copied across N
// cases". Two genuinely different cases share headings but differ in prose; a
// copy-paste clone collapses to (near) the same signature.
function caseBodySignature(content) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .join(" ")
    .trim();
}

// ===========================================================================
// Deep structural validation (P2), refactored into one named sub-function per
// numbered block. Unlike the ledger checks (which return error arrays), the
// deep blocks interleave `tick()` calls inside their loops and write to BOTH
// `errors` and `warnings`, so each block keeps the original passthrough shape:
// it receives the shared `errors` / `warnings` / `tick` and performs its own
// ticks at the EXACT points the inline block did. The split is mechanical
// (extract-method) — every pushed string, every tick, and their order are
// byte-for-byte the pre-refactor behavior; the deepValidate orchestrator just
// calls the blocks in sequence and threads the values they share (the parsed
// manifest, the flagship artifact bodies, the case-dir list). Each is exported
// so a unit test can exercise one structural block in isolation too.
// ===========================================================================

// (1) Manifest really exists, parses, and its declared files/dirs are real.
// Returns the parsed manifest (or null) so check (2) can reuse it without a
// second parse — exactly the data flow of the original inline blocks.
export function deepCheckManifest(workspace, errors, tick) {
  tick();
  const manifestRaw = readIfPresent(workspace, "WORKSPACE_MANIFEST.json");
  let manifest = null;
  if (manifestRaw === null) {
    errors.push("manifest WORKSPACE_MANIFEST.json is missing");
  } else {
    try {
      manifest = JSON.parse(manifestRaw);
    } catch (parseError) {
      errors.push(`manifest WORKSPACE_MANIFEST.json is not valid JSON (${parseError.message})`);
    }
  }

  if (manifest) {
    for (const field of ["name", "workspaceDirs", "layers", "mechanisms", "prompts", "skills", "adapters", "syntheticCases"]) {
      if (manifest[field] === undefined) errors.push(`manifest missing field "${field}"`);
    }

    // Every directory the manifest declares must actually exist on disk.
    if (Array.isArray(manifest.workspaceDirs)) {
      for (const dir of manifest.workspaceDirs) {
        if (!exists(workspace, dir) || !statSync(path.join(workspace, dir)).isDirectory()) {
          errors.push(`manifest declares directory "${dir}" but it is missing on disk`);
        }
      }
    }

    // Manifest-listed mechanism / prompt / skill / adapter / case assets exist.
    if (Array.isArray(manifest.mechanisms)) {
      for (const mechanism of manifest.mechanisms) {
        if (!exists(workspace, "mechanisms", mechanism, "README.md")) {
          errors.push(`manifest lists mechanism "${mechanism}" but mechanisms/${mechanism}/README.md is missing`);
        }
      }
    }
    if (Array.isArray(manifest.prompts)) {
      for (const prompt of manifest.prompts) {
        if (!exists(workspace, "prompts", prompt)) {
          errors.push(`manifest lists prompt "${prompt}" but prompts/${prompt} is missing`);
        }
      }
    }
    if (Array.isArray(manifest.skills)) {
      for (const skill of manifest.skills) {
        if (!exists(workspace, "skills", skill, "SKILL.md")) {
          errors.push(`manifest lists skill "${skill}" but skills/${skill}/SKILL.md is missing`);
        }
      }
    }
    if (Array.isArray(manifest.adapters)) {
      for (const adapter of manifest.adapters) {
        if (!exists(workspace, "adapters", adapter, "ADAPTER.md")) {
          errors.push(`manifest lists adapter "${adapter}" but adapters/${adapter}/ADAPTER.md is missing`);
        }
      }
    }
    if (Array.isArray(manifest.syntheticCases)) {
      for (const caseId of manifest.syntheticCases) {
        if (!exists(workspace, "examples", caseId, "CASE.md")) {
          errors.push(`manifest lists case "${caseId}" but examples/${caseId}/CASE.md is missing`);
        }
      }
    }
  }

  return manifest;
}

// (2) Declared workspaceDirs == the actual governance dir set under .aict/.
//     "Governance" dirs = the canonical set the manifest is supposed to own;
//     walkthroughs/ is generated but intentionally not a manifest dir, so it
//     is excluded from the equality check rather than reported as extra.
export function deepCheckWorkspaceDirs(workspace, manifest, errors, tick) {
  tick();
  if (manifest && Array.isArray(manifest.workspaceDirs)) {
    const declared = new Set(manifest.workspaceDirs);
    const actualDirs = readdirSync(workspace, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const nonManifestDirs = new Set(["walkthroughs"]);

    for (const dir of actualDirs) {
      if (!declared.has(dir) && !nonManifestDirs.has(dir)) {
        errors.push(`directory "${dir}" exists under .aict/ but is not declared in manifest.workspaceDirs`);
      }
    }
    for (const dir of declared) {
      if (!actualDirs.includes(dir)) {
        errors.push(`manifest.workspaceDirs declares "${dir}" but no such directory exists`);
      }
    }
    // Cross-check against the generator's own canonical list so a manifest that
    // was hand-edited away from the generator is caught too.
    for (const dir of requiredWorkspaceDirs) {
      if (!declared.has(dir)) errors.push(`manifest.workspaceDirs is missing canonical dir "${dir}"`);
    }
  }
}

// (3) Mechanism schema completeness: 5 files each, and deepened mechanisms
//     keep their 9-element README structure anchors. (Ticks once per mechanism,
//     matching the inline loop.)
export function deepCheckMechanismSchema(workspace, errors, tick) {
  for (const mechanism of requiredMechanismIds) {
    tick();
    const readme = readIfPresent(workspace, "mechanisms", mechanism, "README.md");
    if (readme === null) {
      // requireFile in the base pass already reports the missing file; skip.
      continue;
    }
    if (isDeepMechanism(mechanism)) {
      for (const anchor of DEEP_MECHANISM_README_ANCHORS) {
        if (!readme.includes(anchor)) {
          errors.push(`mechanisms/${mechanism}/README.md lost deepened structure anchor "${anchor}"`);
        }
      }
    }
  }
}

// (4) Flagship lab completeness: the 11-step artifact chain is present, the
//     causal-chain trio exists, and guard-review really cites first-ai-output
//     line numbers (not just mentions the filename). Returns the three
//     load-bearing artifact bodies (firstAi/guard/revised) + flagshipId so the
//     depth block (5) can reuse them without re-reading — the original flow.
//     This function performs BOTH the presence tick AND the causal-chain tick,
//     in that order, exactly as the inline code did.
export function deepCheckFlagship(workspace, errors, warnings, tick) {
  tick();
  const flagshipId = "ai-coding-long-task";
  const flagshipArtifactsDir = path.join(workspace, "examples", flagshipId, "artifacts");
  const flagshipArtifacts = [
    "context-package.md",
    "acceptance-card.md",
    "execution-prompt.md",
    "first-ai-output.md",
    "guard-review.md",
    "revised-output.md",
    "handoff-note.md",
    "harvest-seed.md"
  ];
  // 11 environment "rungs" of the loop = case file + the 8 artifacts + the
  // case's two narrative proof surfaces (raw-input/baseline). We assert the
  // load-bearing artifacts directly.
  if (!exists(workspace, "examples", flagshipId, "CASE.md")) {
    errors.push(`flagship examples/${flagshipId}/CASE.md is missing`);
  }
  for (const artifact of flagshipArtifacts) {
    if (!existsSync(path.join(flagshipArtifactsDir, artifact))) {
      errors.push(`flagship artifact examples/${flagshipId}/artifacts/${artifact} is missing`);
    }
  }

  const firstAi = readIfPresent(workspace, "examples", flagshipId, "artifacts", "first-ai-output.md");
  const guard = readIfPresent(workspace, "examples", flagshipId, "artifacts", "guard-review.md");
  const revised = readIfPresent(workspace, "examples", flagshipId, "artifacts", "revised-output.md");

  // Causal link: guard-review must reference first-ai-output.md AND quote a line
  // range (the cited onKeyDown stub), proving it actually reviewed the code, not
  // just name-dropped the file.
  tick();
  if (guard !== null) {
    if (!/first-ai-output\.md/i.test(guard)) {
      errors.push(`flagship guard-review.md does not reference first-ai-output.md (causal chain broken)`);
    }
    const lineRefs = guard.match(/\blines?\s+\d+(?:\s*-\s*\d+)?/gi) ?? [];
    if (lineRefs.length === 0) {
      errors.push(`flagship guard-review.md cites no line numbers from first-ai-output.md (cannot prove it reviewed the code)`);
    }
    if (!/\blines?\s+27\s*-\s*30\b/i.test(guard)) {
      warnings.push(`flagship guard-review.md no longer cites the onKeyDown stub at lines 27-30 (causal-chain anchor weakened)`);
    }
  }

  return { flagshipId, firstAi, guard, revised };
}

// (5) Minimum artifact depth: the causal-chain artifacts must carry real
//     structural substance (code fences, a verdict, evidence), not just a
//     template header + one sentence. Then every ordinary case artifact must
//     clear a minimum substance floor. Returns caseDirs (computed here, reused
//     by check 9). Performs the three flagship-depth ticks plus one tick per
//     ordinary case artifact, in the original order.
export function deepCheckArtifactDepth(workspace, firstAi, guard, revised, errors, tick) {
  tick();
  if (firstAi !== null) {
    if (countFences(firstAi) < 2) {
      errors.push(`flagship first-ai-output.md has no fenced code block (boilerplate, not a runnable artifact)`);
    }
    if (!/completion claim/i.test(firstAi)) {
      errors.push(`flagship first-ai-output.md is missing the completion claim it is supposed to expose`);
    }
    if (substanceLines(firstAi).length < 12) {
      errors.push(`flagship first-ai-output.md is too thin (${substanceLines(firstAi).length} substance lines; looks like boilerplate)`);
    }
  }
  tick();
  if (guard !== null) {
    if (!/verdict/i.test(guard)) {
      errors.push(`flagship guard-review.md has no verdict (a review without a verdict is boilerplate)`);
    }
    if (!/evidence/i.test(guard)) {
      errors.push(`flagship guard-review.md cites no evidence section`);
    }
    if (substanceLines(guard).length < 8) {
      errors.push(`flagship guard-review.md is too thin (${substanceLines(guard).length} substance lines; looks like boilerplate)`);
    }
  }
  tick();
  if (revised !== null) {
    if (countFences(revised) < 2) {
      errors.push(`flagship revised-output.md has no fenced code block (the fix is not actually shown)`);
    }
    if (!/Arrow(?:Up|Down)/.test(revised) || !/moveTask/.test(revised)) {
      errors.push(`flagship revised-output.md does not show the keyboard reorder fix (ArrowUp/Down -> moveTask)`);
    }
  }

  // Every ordinary case artifact must clear a minimum substance floor so a case
  // cannot be hollowed into the bare scaffold. The scaffold itself contributes
  // ~0 substance lines (title + headings + trailer are all stripped), so the
  // synthetic content body is what is measured here.
  const caseDirs = exists(workspace, "examples")
    ? readdirSync(path.join(workspace, "examples"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
  for (const caseId of caseDirs) {
    const artifactsDir = path.join(workspace, "examples", caseId, "artifacts");
    if (!existsSync(artifactsDir)) continue;
    for (const artifact of readdirSync(artifactsDir).filter((file) => file.endsWith(".md"))) {
      tick();
      const content = read(path.join(artifactsDir, artifact));
      const substance = substanceLines(content);
      // Floor of 2 substance lines: a real artifact has at least a "how to use"
      // body + a "synthetic content" body + a review note. A gutted artifact
      // (headings only, or one stub sentence) falls under this.
      if (substance.length < 2) {
        errors.push(`examples/${caseId}/artifacts/${artifact} is boilerplate-only (${substance.length} substance lines)`);
      }
    }
  }

  return caseDirs;
}

// (6) Cookbook recipes must carry the 8-element shape AND a real copy-paste
//     block (a fenced code block), not just a prose outline. (Ticks once per
//     recipe, matching the inline loop.)
export function deepCheckCookbook(workspace, errors, tick) {
  const cookbookRecipes = ["run-a-first-loop.md", "connect-a-tool.md", "review-a-half-product.md"];
  const cookbookElements = [
    "When to use",
    "Prerequisites",
    "Steps",
    "Copy-paste block",
    "Expected output",
    "Failure handling",
    "Privacy note",
    "Next step"
  ];
  for (const recipe of cookbookRecipes) {
    tick();
    const content = readIfPresent(workspace, "cookbook", recipe);
    if (content === null) continue; // base pass reports the missing file.
    for (const element of cookbookElements) {
      if (!new RegExp(element, "i").test(content)) {
        errors.push(`cookbook/${recipe} missing operational element "${element}"`);
      }
    }
    if (countFences(content) < 2) {
      errors.push(`cookbook/${recipe} has no copy-paste fenced block (empty outline, not a do-it recipe)`);
    }
  }
}

// (8 entry) Entry path consistency: the generated START_HERE first screen must
//     point at the real flagship loop surfaces the workspace ships, so a reader
//     who follows it does not hit a dead link.
export function deepCheckEntryPath(workspace, flagshipId, errors, tick) {
  tick();
  const startHere = readIfPresent(workspace, "START_HERE.md");
  if (startHere !== null) {
    const previewTargets = [
      ["walkthroughs/10-minute.md", path.join(workspace, "walkthroughs", "10-minute.md")],
      ["examples/ai-coding-long-task/CASE.md", path.join(workspace, "examples", flagshipId, "CASE.md")]
    ];
    for (const [label, target] of previewTargets) {
      if (new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(startHere) && !existsSync(target)) {
        errors.push(`START_HERE points to "${label}" but that path does not exist in the workspace`);
      }
    }
    // The handoff preview line must reflect the accepted/post-revised state, not
    // a stale "keyboard test pending" that contradicts revised-output.md.
    const handoffLine = (startHere.match(/^Handoff:.*$/m) ?? [])[0] ?? "";
    if (handoffLine && /keyboard[^.\n]*\b(pending|missing)\b|\b(pending|missing)\b[^.\n]*keyboard/i.test(handoffLine)) {
      errors.push(`START_HERE "Handoff:" preview still describes keyboard work as pending/missing (contradicts the accepted revised output)`);
    }
  }
}

// (9) Duplicate-boilerplate detection: no level-2 heading repeats inside a
//     single CASE.md, and no two cases collapse to the same body signature
//     (the "same boilerplate copied N times" failure). Ticks once per case in
//     the per-case loop, then one final tick for the cross-case comparison.
export function deepCheckDuplicateBoilerplate(workspace, caseDirs, errors, tick) {
  const caseSignatures = [];
  for (const caseId of caseDirs) {
    tick();
    const caseContent = readIfPresent(workspace, "examples", caseId, "CASE.md");
    if (caseContent === null) continue;

    const headings = level2Headings(caseContent);
    const seen = new Map();
    for (const heading of headings) {
      seen.set(heading, (seen.get(heading) ?? 0) + 1);
    }
    for (const [heading, count] of seen) {
      if (count >= 2) {
        errors.push(`examples/${caseId}/CASE.md duplicates level-2 heading "## ${heading}" (${count}x; stacked boilerplate)`);
      }
    }

    caseSignatures.push({ caseId, signature: caseBodySignature(caseContent) });
  }
  // Cross-case duplicate boilerplate: identical (or empty) signatures mean the
  // synthetic prose was copied wholesale instead of being a distinct case.
  tick();
  for (let i = 0; i < caseSignatures.length; i += 1) {
    for (let j = i + 1; j < caseSignatures.length; j += 1) {
      const a = caseSignatures[i];
      const b = caseSignatures[j];
      if (a.signature.length > 0 && a.signature === b.signature) {
        errors.push(`examples/${a.caseId}/CASE.md and examples/${b.caseId}/CASE.md are identical boilerplate copies`);
      }
    }
  }
}

// Deep structural validation orchestrator (P2). Thin sequencer: runs each
// numbered block (above) in the EXACT original order, threading the values the
// blocks share (parsed manifest -> dir check; flagship artifact bodies -> depth
// check; case-dir list -> duplicate check). Tick order/count and the
// errors/warnings contents are unchanged from the pre-refactor inline body.
function deepValidate(workspace, errors, warnings, counters) {
  const tick = () => {
    counters.deepChecks += 1;
  };

  const manifest = deepCheckManifest(workspace, errors, tick); // (1)
  deepCheckWorkspaceDirs(workspace, manifest, errors, tick); // (2)
  deepCheckMechanismSchema(workspace, errors, tick); // (3)
  const { flagshipId, firstAi, guard, revised } = deepCheckFlagship(workspace, errors, warnings, tick); // (4)
  const caseDirs = deepCheckArtifactDepth(workspace, firstAi, guard, revised, errors, tick); // (5)
  deepCheckCookbook(workspace, errors, tick); // (6)
  deepCheckEntryPath(workspace, flagshipId, errors, tick); // (8 entry)
  deepCheckDuplicateBoilerplate(workspace, caseDirs, errors, tick); // (9)

  // ---------------------------------------------------------------------
  // (7) PUBLIC_MAPPING coverage — scope note.
  //     docs/PUBLIC_MAPPING.md lives in the repo, NOT inside the .aict user
  //     workspace this validator inspects, so it is intentionally out of scope
  //     here and is covered by the contract test layer instead. No check is
  //     emitted; see the blind-spots note in the task report.
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // (8) Run-layer ledger integrity (P1). The five JSONL ledgers under state/
  //     are the live substance of the run loop, so a degraded ledger (corrupt
  //     line, orphaned evidence, illegal status, broken reference, a "done"
  //     task with no evidence, an accepted receipt with no evidence) must fail
  //     loudly with a pointable reason — never silently accept inconsistent
  //     state. Reads go through the SAME ledger.js parser the CLI writes with,
  //     so the on-disk shape cannot drift between writer and reader.
  // ---------------------------------------------------------------------
  validateLedgers(workspace, errors, tick);
}

// ===========================================================================
// Run-layer ledger validation — refactored into one named sub-function per
// numbered integrity check. Each `check*` function:
//   - receives a parsed-ledger context `ctx` (the five record arrays plus the
//     derived id Sets), reads only what it needs, and
//   - RETURNS an array of error strings (never mutates shared state).
// The error strings are byte-for-byte identical to the pre-refactor inline
// blocks — this is a behavior-preserving split, NOT a wording change. The
// `validateLedgers` orchestrator calls them in the original order, ticks once
// per check exactly as before, and appends each returned array to `errors`.
// Exporting them lets a unit test feed one check a hand-built ledger directly
// (no whole-workspace round-trip), which is what closes the thin-coverage gaps
// the mutation tests surfaced.
// ===========================================================================

// Build the parsed-ledger context once. Checks 1 (bad JSONL) and 1b (per-ledger
// id integrity) are folded in here because they BOTH run during the parse pass
// in the original (1 emits parse errors per file; 1b walks each file's records),
// and they produce the parse `errors` the orchestrator ticks for. The returned
// object carries the parse/id errors (already ordered file-by-file) plus every
// derived value the later checks read, so no check re-parses or re-derives.
//
// Exported so a unit test can build the same context (from a temp state dir it
// populated with hand-crafted .jsonl rows) and feed an individual check
// directly — the precise, fast path the thin-coverage tests use instead of a
// whole validateWorkspace round-trip.
export function buildLedgerContext(stateDir) {
  const LEDGER_KEYS = ["tasks", "evidence", "runs", "receipts", "learning"];
  const parsed = {};

  // (1) Bad JSONL: any non-empty line that does not parse as JSON, OR parses to
  // a non-object (null / array / scalar), is an error with file + line number.
  // The parser tags each error kind so a type error reads "record must be an
  // object" (pointable) instead of crashing a later record.id access with a
  // non-pointable TypeError. parseErrorsByKey[key] is the ordered list for that
  // ledger so the orchestrator can tick + append per file, preserving order.
  const parseErrorsByKey = {};
  for (const key of LEDGER_KEYS) {
    const file = ledgerPath(stateDir, key);
    const { records, errors: parseErrors } = parseLedgerFile(file);
    const fileErrors = [];
    for (const parseError of parseErrors) {
      const reason = parseError.kind === "type"
        ? parseError.message
        : `is not valid JSON (${parseError.message})`;
      fileErrors.push(`ledger ${path.basename(file)}:${parseError.line} ${reason}`);
    }
    parseErrorsByKey[key] = fileErrors;
    parsed[key] = records;
  }

  // (1b) Per-ledger id integrity: within ONE ledger every record needs a
  // non-empty string id, and ids must be unique. Without this the cross-ledger
  // Sets below silently fold duplicate ids into one entry (so a duplicate task
  // id or a blank id passes unnoticed). Report each with a pointable file + id.
  const idErrorsByKey = {};
  for (const key of LEDGER_KEYS) {
    const file = ledgerPath(stateDir, key);
    const seen = new Set();
    const fileErrors = [];
    for (const record of parsed[key]) {
      const id = record.id;
      if (typeof id !== "string" || id.length === 0) {
        fileErrors.push(`ledger ${path.basename(file)} has a record with a missing or non-string id`);
        continue;
      }
      if (seen.has(id)) {
        fileErrors.push(`ledger ${path.basename(file)} has duplicate id "${id}"`);
      }
      seen.add(id);
    }
    idErrorsByKey[key] = fileErrors;
  }

  const tasks = parsed.tasks;
  const evidence = parsed.evidence;
  const receipts = parsed.receipts;
  // The runs ledger is now load-bearing for the L4 gate: a rerun only counts
  // toward L4 if it reconciles against a recorded run here (A1 L4 reconciliation).
  const runs = parsed.runs;
  const learning = parsed.learning;

  return {
    LEDGER_KEYS,
    parseErrorsByKey,
    idErrorsByKey,
    tasks,
    evidence,
    receipts,
    runs,
    learning,
    taskIds: new Set(tasks.map((task) => task.id)),
    evidenceIds: new Set(evidence.map((item) => item.id)),
    // Set of task ids that have at least one piece of evidence — used by check 5.
    tasksWithEvidence: new Set(evidence.map((item) => item.taskId))
  };
}

// (3) Illegal task status: task.status must be in the enum.
export function checkTaskStatusEnum(ctx) {
  const errors = [];
  for (const task of ctx.tasks) {
    if (!TASK_STATUSES.includes(task.status)) {
      errors.push(`ledger tasks.jsonl task ${task.id ?? "(no id)"} has illegal status "${task.status}" (allowed: ${TASK_STATUSES.join(", ")})`);
    }
  }
  return errors;
}

// (5) A done task must have evidence. A task marked done with no evidence row
//     pointing at it is exactly the "thin done" the system exists to catch.
//     Uses the SAME doneRequiresEvidence predicate the CLI writer (task update)
//     applies, so the write-time check and this read-time check cannot drift.
export function checkDoneRequiresEvidence(ctx) {
  const errors = [];
  for (const task of ctx.tasks) {
    if (doneRequiresEvidence(task.status) && !ctx.tasksWithEvidence.has(task.id)) {
      errors.push(`ledger tasks.jsonl task ${task.id} is "done" but has no evidence (only blocked/partial/unverified may have none)`);
    }
  }
  return errors;
}

// (2) Orphan evidence: evidence.taskId must reference an existing task.
export function checkOrphanEvidence(ctx) {
  const errors = [];
  for (const item of ctx.evidence) {
    if (!ctx.taskIds.has(item.taskId)) {
      errors.push(`ledger evidence.jsonl evidence ${item.id ?? "(no id)"} references unknown task "${item.taskId}" (orphan)`);
    }
  }
  return errors;
}

// (2b) Special-evidence structure (P2 structure gate): a load-bearing kind
//      (cross_family_guard / rerun) must carry its required structured fields,
//      not just the right label. Uses the SAME specialEvidenceStructureError
//      predicate the CLI writer applies at evidence-add time, so a hand-planted
//      empty-shell special row (e.g. a cross_family_guard with no
//      reviewer/family/ref, or a rerun with no command/exitCode) is caught
//      read-time exactly as the writer refuses it write-time — even if no
//      receipt cites it yet. Generic kinds return null here and are unaffected.
export function checkSpecialEvidenceStructure(ctx) {
  const errors = [];
  for (const item of ctx.evidence) {
    const structureError = specialEvidenceStructureError(item);
    if (structureError) {
      errors.push(`ledger evidence.jsonl evidence ${item.id ?? "(no id)"}: ${structureError}`);
    }
  }
  return errors;
}

// (2c) Rerun-run reconciliation (A1 L4 reconciliation, read side): a rerun row
//      that carries a runId MUST reconcile against a recorded run in runs.jsonl
//      (same task, finished, executed:true, matching exitCode + command + output hash), using the SAME
//      rerunRunReconcileError the CLI applies at evidence-add time. This catches a
//      hand-edited jsonl that bolts a runId onto a rerun whose exitCode/command
//      disagree with the recorded run (the red-team "runs=1 but rerun says 0"
//      forgery), even before any receipt cites it. A rerun with NO runId is NOT
//      flagged here (it is a valid generic rerun that simply cannot reach L4 — the
//      L4 gate is enforced where a receipt claims L4, via ownedRerunEvidenceIds);
//      only a PRESENT-but-broken runId is an integrity error. Structurally-
//      incomplete rerun rows are already reported by (2b); skip them so the
//      reconcile check does not double-report.
export function checkRerunRunReconcile(ctx) {
  const errors = [];
  for (const item of ctx.evidence) {
    if (!isRerunWithRunId(item)) continue;
    if (specialEvidenceStructureError(item) !== null) continue; // (2b) already reported
    const reconcileError = rerunRunReconcileError(item, ctx.runs);
    if (reconcileError) {
      errors.push(`ledger evidence.jsonl evidence ${item.id ?? "(no id)"}: ${reconcileError}`);
    }
  }
  return errors;
}

// (4) Broken reference: every id in receipt.evidenceIds must exist in evidence.
export function checkReceiptEvidenceRefs(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    const ids = Array.isArray(receipt.evidenceIds) ? receipt.evidenceIds : [];
    for (const id of ids) {
      if (!ctx.evidenceIds.has(id)) {
        errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} references unknown evidence "${id}" (broken reference)`);
      }
    }
  }
  return errors;
}

// (4b) Receipt task reference: receipt.taskId must point at an existing task.
//      A receipt for a task that does not exist is a dangling receipt — and it
//      is also the entry point the cross-task check (4c) needs, since "does
//      this evidence belong to the receipt's task" is meaningless if the task
//      itself is unknown. Same rule the CLI writer enforces at receipt create.
export function checkReceiptTaskRef(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    if (!ctx.taskIds.has(receipt.taskId)) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} references unknown task "${receipt.taskId}"`);
    }
  }
  return errors;
}

// (4c) Cross-task evidence: every evidence id a receipt cites must belong to
//      the receipt's OWN task. Citing another task's evidence is the back door
//      that lets a task with no evidence of its own be written "accepted" by
//      borrowing someone else's proof. Uses the SAME ownedEvidenceIds filter
//      the CLI writer applies, so the write-time guard and this read-time check
//      cannot drift. Unknown ids are already reported by (4); here we flag only
//      ids that resolve to a real evidence row owned by a DIFFERENT task.
export function checkReceiptCrossTaskEvidence(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    const ids = Array.isArray(receipt.evidenceIds) ? receipt.evidenceIds : [];
    const owned = new Set(ownedEvidenceIds(ids, receipt.taskId, ctx.evidence));
    for (const id of ids) {
      if (ctx.evidenceIds.has(id) && !owned.has(id)) {
        errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} cites evidence "${id}" that belongs to another task (not task "${receipt.taskId}")`);
      }
    }
  }
  return errors;
}

// (4d) rerunEvidenceIds reference integrity (G2): rerunEvidenceIds is a real
//      cited-evidence list (the writer rejects unknown/foreign ids in it at
//      receipt-create time exactly like evidenceIds), but read-time it was only
//      consulted inside the L4-pass boolean — so a hand-planted receipt with a
//      bad rerunEvidenceIds (an id that does not exist, or one owned by another
//      task) slipped past the global reference checks unless it happened to be
//      an L4 pass. This check covers ALL receipts, mirroring (4) + (4c) for the
//      plain evidenceIds list: an unknown id is a broken reference; a known id
//      owned by a different task is a cross-task citation. Uses the SAME
//      ownedEvidenceIds ownership predicate the writer applies, so write-time
//      and read-time cannot drift. (The L4 kind/structure requirement is a
//      separate, stronger gate handled by check 8 via ownedRerunEvidenceIds.)
export function checkRerunEvidenceIdRefs(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    const rerunIds = Array.isArray(receipt.rerunEvidenceIds) ? receipt.rerunEvidenceIds : [];
    if (rerunIds.length === 0) continue;
    const ownedRerunByTask = new Set(ownedEvidenceIds(rerunIds, receipt.taskId, ctx.evidence));
    for (const id of rerunIds) {
      if (!ctx.evidenceIds.has(id)) {
        errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} references unknown rerun evidence "${id}" (broken reference)`);
      } else if (!ownedRerunByTask.has(id)) {
        errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} cites rerun evidence "${id}" that belongs to another task (not task "${receipt.taskId}")`);
      }
    }
  }
  return errors;
}

// (6) Accepted receipt must cite SAME-TASK evidence: an accepted verdict with no
//     evidence that belongs to its own task is an unsupported acceptance — whether
//     the evidenceIds list is empty OR it only cites another task's evidence.
//     Counting via ownedEvidenceIds (not raw length) closes the cross-task back
//     door at the status level too, and matches `receipt accept`, which also keys
//     on owned regular evidence — so the two never disagree on what backs an
//     acceptance. (A clean pass needs a cited cross_family_guard row to reach L3+,
//     so a legitimately-accepted pass always has same-task evidenceIds.)
export function checkAcceptedReceiptHasEvidence(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    if (receipt.status !== "accepted") continue;
    const ids = Array.isArray(receipt.evidenceIds) ? receipt.evidenceIds : [];
    const owned = ownedEvidenceIds(ids, receipt.taskId, ctx.evidence);
    if (owned.length === 0) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} is "accepted" but cites no evidence`);
    }
  }
  return errors;
}

// (7) Guard level present + valid (P2): every receipt must carry a guardLevel
//     in the enum. The level grades the evidence the guard saw and is what the
//     verdict-consistency check (8) bounds the verdict against, so a missing or
//     bogus level is rejected here first.
export function checkGuardLevelEnum(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    if (!GUARD_LEVELS.includes(receipt.guardLevel)) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} has missing/illegal guardLevel "${receipt.guardLevel}" (allowed: ${GUARD_LEVELS.join(", ")})`);
    }
  }
  return errors;
}

// (8) Verdict x guardLevel consistency (P2 core): the verdict a receipt carries
//     must be one its guard level can back. Uses the SAME guardLevelVerdictError
//     predicate the CLI writer applies, so a hand-planted row (an L0 "pass", an
//     L2 "pass", a pass below L3, or an L4 "pass" with no rerun output) is
//     caught read-time exactly as the writer refuses it write-time. hasRerun is
//     computed from rerun ids that actually belong to this task (a rerun id
//     borrowed from another task does not satisfy the L4 requirement). Receipts
//     whose guardLevel is already invalid are skipped (reported by check 7).
export function checkVerdictGuardLevelConsistency(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    if (!GUARD_LEVELS.includes(receipt.guardLevel)) continue;
    const rerunIds = Array.isArray(receipt.rerunEvidenceIds) ? receipt.rerunEvidenceIds : [];
    // A1 L4 reconciliation: ownedRerun counts a rerun toward L4 only if it
    // references a recorded run that reconciles (runs passed), so a hand-planted L4
    // whose rerun output disagrees with the recorded run is flagged read-time.
    const ownedRerun = ownedRerunEvidenceIds(rerunIds, receipt.taskId, ctx.evidence, ctx.runs);
    // P2 evidence-gate: an L3 pass must cite a real cross_family_guard evidence
    // row owned by this task; computed the SAME way the CLI writer computes it so
    // a hand-planted L3 "pass" on a kind:"note" row is flagged read-time exactly
    // as the writer refuses it write-time.
    const evidenceIds = Array.isArray(receipt.evidenceIds) ? receipt.evidenceIds : [];
    const ownedCrossFamily = ownedCrossFamilyGuardEvidenceIds(evidenceIds, receipt.taskId, ctx.evidence);
    const consistencyError = guardLevelVerdictError(
      receipt.guardLevel,
      receipt.verdict,
      ownedRerun.length > 0,
      ownedCrossFamily.length > 0,
      rerunIds.length > 0
    );
    if (consistencyError) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"}: ${consistencyError}`);
    }
  }
  return errors;
}

// (8b) Review-mode validity (A1): a receipt's reviewMode, when present, must be
//      a legal REVIEW_MODES value. The reviewMode is the load-bearing input to
//      the level computation, so a bogus mode (a typo, or a made-up "binding")
//      must be caught before check 8c trusts it. reviewMode is OPTIONAL on a row
//      (a pre-A1 receipt has none; the computation infers it), so absence is
//      fine — only a present-but-illegal value is flagged.
export function checkReviewModeEnum(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    if (receipt.reviewMode !== undefined && !REVIEW_MODES.includes(receipt.reviewMode)) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} has illegal reviewMode "${receipt.reviewMode}" (allowed: ${REVIEW_MODES.join(", ")})`);
    }
  }
  return errors;
}

// (8c) Computed-level integrity (A1 CORE, read side): the guard level is COMPUTED
//      from the review method + the evidence, never self-asserted. A hand-edited
//      receipts.jsonl could set guardLevel HIGHER than the method + evidence
//      support (e.g. guardLevel "L4" on a row with no rerun output, or "L3" with
//      reviewMode "same_family_subagent"). We RE-COMPUTE the level the SAME way
//      the CLI writer does and flag any receipt whose stored level OUTRANKS the
//      computed one — the read-time twin of "the CLI never stores a level above
//      the evidence". A stored level <= computed is allowed (a row may under-claim
//      its level; only OVER-claiming is the silent-green danger). Receipts whose
//      guardLevel or reviewMode is already invalid are skipped (reported above).
export function checkReceiptComputedLevel(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    if (!GUARD_LEVELS.includes(receipt.guardLevel)) continue;
    if (receipt.reviewMode !== undefined && !REVIEW_MODES.includes(receipt.reviewMode)) continue;
    // RE-COMPUTE the level from the receipt's own evidence — the SAME shared helper
    // the handoff drafter uses, so the two never drift on what the evidence backs.
    const computed = computeReceiptGuardLevel(receipt, ctx.evidence, ctx.runs);
    if (guardLevelRank(receipt.guardLevel) > guardLevelRank(computed.level)) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} claims guard level "${receipt.guardLevel}" but the review method + evidence only support "${computed.level}" (${computed.reason}); the level is computed, not self-asserted`);
    }
  }
  return errors;
}

// (8d) Family-honesty marker integrity (A1/C1): when the computed level rests on a
//      SELF-DECLARED cross-family claim (familyUnverified), the stored row MUST
//      carry familyUnverified: true — so a hand-edit cannot strip the
//      "unverified" mark off any cross-family level to make it read like a hard pass.
//      Conversely, familyUnverified must NOT be set on a row the computation does
//      not flag (a non-cross-family level), so a row cannot
//      falsely advertise an unverified caveat it has not earned either way. Only
//      receipts whose stored level matches the computed level are checked here
//      (an over-claimed level is already reported by 8c, and re-flagging its
//      marker would be noise).
export function checkFamilyUnverifiedMarker(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    if (!GUARD_LEVELS.includes(receipt.guardLevel)) continue;
    if (receipt.reviewMode !== undefined && !REVIEW_MODES.includes(receipt.reviewMode)) continue;
    // Same shared re-computation as 8c (single source of the family-verification truth).
    const computed = computeReceiptGuardLevel(receipt, ctx.evidence, ctx.runs);
    if (receipt.guardLevel !== computed.level) continue; // over/under-claim handled by 8c
    const storedUnverified = receipt.familyUnverified === true;
    if (computed.familyUnverified && !storedUnverified) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} is a self-declared cross-family level (${computed.level}) but is missing the familyUnverified: true marker (the cross-family family is unverified and must be marked so)`);
    } else if (!computed.familyUnverified && storedUnverified) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} carries familyUnverified: true but its computed level (${computed.level}) is not an unverified cross-family level (the marker is unwarranted)`);
    }
  }
  return errors;
}

// (9) Owner acceptance integrity (P2): an "accepted" pass_with_risk receipt
//     MUST carry the owner-acceptance marker (ownerAccepted: true). A risk
//     receipt exists precisely because a human accepted the named residual
//     risk; an accepted risk receipt with no owner mark is an unsupported
//     acceptance. Same ownerAcceptanceError predicate the CLI accept path uses.
export function checkOwnerAcceptanceMarker(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    const acceptanceError = ownerAcceptanceError(receipt);
    if (acceptanceError) {
      errors.push(`ledger receipts.jsonl ${acceptanceError}`);
    }
  }
  return errors;
}

// (10) Receipt status reverse-consistency (P2 evidence-gate, REJECT follow-up):
//      a receipt's status is not just a free-form label — it is DERIVED from
//      (verdict, owned-evidence, ownerAccepted) by the SAME receiptStatusFor
//      rule the writer applies. Before this check, a hand-planted row could
//      carry a status that contradicts its own verdict (e.g. verdict "reject"
//      with status "accepted", or "pass_with_risk" written "accepted" with no
//      owner sign-off) and slip past as long as it cited some evidence. Here we
//      (a) require status to be a legal enum value, then (b) RE-COMPUTE the
//      expected status and flag any receipt whose stored status differs — so
//      the status can never claim more (or less) than the rule grants.
export function checkReceiptStatusReverse(ctx) {
  const errors = [];
  for (const receipt of ctx.receipts) {
    // (a) status must be one of the three legal values.
    if (!RECEIPT_STATUSES.includes(receipt.status)) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} has missing/illegal status "${receipt.status}" (allowed: ${RECEIPT_STATUSES.join(", ")})`);
      continue; // a bogus status cannot be meaningfully reverse-computed.
    }
    // (b) reverse-compute the status the rule would assign and compare. A verdict
    // outside the enum is already reported by check 8's predicate; receiptStatusFor
    // treats any non-accepting verdict as "rejected", so we only reverse-check
    // receipts whose verdict is a known value to avoid a confusing double report.
    if (!RECEIPT_VERDICTS.includes(receipt.verdict)) continue;
    const evidenceIds = Array.isArray(receipt.evidenceIds) ? receipt.evidenceIds : [];
    // Re-derive status from owned regular evidence — the SAME basis the CLI writer
    // and `receipt accept` use, so the three never disagree. (Under the L4 rule a
    // clean pass always carries a cited cross_family_guard row in evidenceIds, so a
    // top-level pass reverse-computes to "accepted", never a contradictory "pending".)
    const owned = ownedEvidenceIds(evidenceIds, receipt.taskId, ctx.evidence);
    const expected = receiptStatusFor(receipt.verdict, owned, receipt.ownerAccepted === true);
    if (receipt.status !== expected) {
      errors.push(`ledger receipts.jsonl receipt ${receipt.id ?? "(no id)"} has status "${receipt.status}" but verdict "${receipt.verdict}" with ${owned.length} own-task evidence and ownerAccepted=${receipt.ownerAccepted === true} computes to "${expected}" (status contradicts the rule)`);
    }
  }
  return errors;
}

// (11) Learning-ledger record shape (P4): each learning row must carry a legal
//      type (harvest/profile), a non-empty content, and a legal status
//      (proposed/confirmed/edited/dropped). Uses the SAME learningRecordError
//      predicate the CLI writer (learning add / confirm / edit / drop) applies,
//      so a row the writer would refuse is flagged read-time too — and a
//      hand-edited ledger that drifts off the enum (a bogus type, a typo'd
//      status, an emptied content) is caught instead of silently feeding the
//      status recall a malformed preference. (P1 had id-integrity only; this is
//      the P4 type/status/content contract.)
export function checkLearningRecordShape(ctx) {
  const errors = [];
  for (const row of ctx.learning) {
    const shapeError = learningRecordError(row);
    if (shapeError) {
      errors.push(`ledger learning-ledger.jsonl learning ${row.id ?? "(no id)"}: ${shapeError}`);
    }
  }
  return errors;
}

// (12) Orphan learning row: a learning row MAY be unbound (no taskId), but a
//      taskId that is present must name a real task — a learning row pointing at
//      a non-existent task is a dangling binding, the same standard the evidence
//      orphan check (check 2) holds. Rows with no taskId are skipped (legitimate
//      cross-task lessons).
export function checkOrphanLearning(ctx) {
  const errors = [];
  for (const row of ctx.learning) {
    if (row.taskId !== undefined && !ctx.taskIds.has(row.taskId)) {
      errors.push(`ledger learning-ledger.jsonl learning ${row.id ?? "(no id)"} references unknown task "${row.taskId}" (orphan)`);
    }
  }
  return errors;
}

// Run-layer ledger validation. Split out for readability; called from
// deepValidate so its checks land in the same `errors` list (CLI check + the
// contract validator both keep failing on a degraded ledger with no interface
// change). Each `tick()` records one performed check.
//
// This is now a thin ORCHESTRATOR: it builds the parsed-ledger context once,
// then runs each numbered check (above) IN THE ORIGINAL ORDER, ticking once per
// check and appending the check's returned errors. The parse pass (check 1) and
// the per-ledger id pass (check 1b) each tick once per ledger file, exactly as
// the original loops did, so the tick count and error order are unchanged.
function validateLedgers(workspace, errors, tick) {
  const stateDir = path.join(workspace, "state");
  const ctx = buildLedgerContext(stateDir);

  // (1) Bad JSONL — one tick + append per ledger file (preserves order/count).
  for (const key of ctx.LEDGER_KEYS) {
    tick();
    for (const error of ctx.parseErrorsByKey[key]) errors.push(error);
  }

  // (1b) Per-ledger id integrity — one tick + append per ledger file.
  for (const key of ctx.LEDGER_KEYS) {
    tick();
    for (const error of ctx.idErrorsByKey[key]) errors.push(error);
  }

  // Each remaining numbered check: tick once, append its returned errors. The
  // call order below is the EXACT order the inline checks ran in originally.
  for (const check of [
    checkTaskStatusEnum, // (3)
    checkDoneRequiresEvidence, // (5)
    checkOrphanEvidence, // (2)
    checkSpecialEvidenceStructure, // (2b)
    checkRerunRunReconcile, // (2c)
    checkReceiptEvidenceRefs, // (4)
    checkReceiptTaskRef, // (4b)
    checkReceiptCrossTaskEvidence, // (4c)
    checkRerunEvidenceIdRefs, // (4d)
    checkAcceptedReceiptHasEvidence, // (6)
    checkGuardLevelEnum, // (7)
    checkVerdictGuardLevelConsistency, // (8)
    checkReviewModeEnum, // (8b)
    checkReceiptComputedLevel, // (8c)
    checkFamilyUnverifiedMarker, // (8d)
    checkOwnerAcceptanceMarker, // (9)
    checkReceiptStatusReverse, // (10)
    checkLearningRecordShape, // (11)
    checkOrphanLearning // (12)
  ]) {
    tick();
    for (const error of check(ctx)) errors.push(error);
  }
}

export function validateWorkspace(workspace) {
  const errors = [];
  const warnings = [];
  let checks = 0;

  requireDir(errors, workspace);
  const startHere = requireFile(errors, workspace, "START_HERE.md");
  checks += 1;
  includesAll(errors, "START_HERE.md", startHere, ["10-minute path", "30-minute path", "60-minute path", "guard", "handoff", "harvest"]);
  if (/doctor/i.test(startHere.slice(0, 1200))) {
    errors.push("START_HERE first screen must not lead with doctor");
  }

  for (const dir of requiredWorkspaceDirs) {
    requireDir(errors, workspace, dir);
    checks += 1;
  }

  for (const layer of ["profile", "context", "acceptance", "guard", "handoff", "harvest"]) {
    for (const file of ["README.md", "PROMPT.md", "TEMPLATE.md", "EXAMPLE.synthetic.md", "FAILURE_MODES.md"]) {
      requireFile(errors, workspace, layer, file);
      checks += 1;
    }
    const combined = ["README.md", "PROMPT.md", "TEMPLATE.md", "EXAMPLE.synthetic.md", "FAILURE_MODES.md"]
      .map((file) => (exists(workspace, layer, file) ? read(path.join(workspace, layer, file)) : ""))
      .join("\n");
    includesAll(errors, layer, combined, [
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
    ]);
  }

  // Profile candidate buffer (P0-5): a proposed preference must pass through
  // profile/CANDIDATES.md before it can graduate into the long-term profile.
  // Require the file and its four-state machine so a degraded workspace that
  // drops the buffer (and lets unreviewed guesses edit the profile) fails loudly.
  const candidates = requireFile(errors, workspace, "profile", "CANDIDATES.md");
  checks += 1;
  includesAll(errors, "profile/CANDIDATES.md", candidates, [
    "State machine",
    "proposed",
    "confirmed",
    "edited",
    "dropped"
  ]);

  for (const mechanism of requiredMechanismIds) {
    for (const file of ["README.md", "PROMPT.md", "TEMPLATE.md", "EXAMPLE.synthetic.md", "FAILURE_MODES.md"]) {
      const content = requireFile(errors, workspace, "mechanisms", mechanism, file);
      checks += 1;
      includesAll(errors, `${mechanism}/${file}`, content, ["AI Collaboration Open System", "local-first", "public-safe"]);
      if (/TBD|TODO|placeholder/i.test(content)) errors.push(`${mechanism}/${file} contains placeholder text`);
    }
  }

  for (const file of ["README.md", "owner-controller.md", "executor.md", "system-guardian.md", "scout.md", "harvester.md"]) {
    requireFile(errors, workspace, "roles", file);
    checks += 1;
  }

  for (const file of ["README.md", "execute.md", "review.md", "handoff.md", "harvest.md"]) {
    requireFile(errors, workspace, "modes", file);
    checks += 1;
  }

  for (const file of ["README.md", "run-a-first-loop.md", "connect-a-tool.md", "review-a-half-product.md"]) {
    requireFile(errors, workspace, "cookbook", file);
    checks += 1;
  }

  for (const file of ["CURRENT_STATE.md", "TASK_LOG.md", "DECISIONS.md"]) {
    requireFile(errors, workspace, "state", file);
    checks += 1;
  }

  // P1 run-layer ledgers must exist (their content integrity is checked in the
  // deep ledger pass; here we only assert presence so a workspace that dropped a
  // ledger fails the base check too).
  for (const file of ["tasks.jsonl", "evidence.jsonl", "runs.jsonl", "receipts.jsonl", "learning-ledger.jsonl"]) {
    requireFile(errors, workspace, "state", file);
    checks += 1;
  }

  for (const file of requiredPromptFiles) {
    const content = requireFile(errors, workspace, "prompts", file);
    checks += 1;
    includesAll(errors, file, content, ["Copy-paste prompt", "Expected output"]);
    if (/TBD|TODO|placeholder/i.test(content)) errors.push(`${file} contains placeholder text`);
  }

  for (const skill of requiredSkillIds) {
    const content = requireFile(errors, workspace, "skills", skill, "SKILL.md");
    checks += 1;
    includesAll(errors, `${skill} skill`, content, ["name:", "When to use", "Output", "Safety"]);
  }

  const shared = requireFile(errors, workspace, "adapters", "SHARED_CORE_CONTRACT.md");
  includesAll(errors, "shared core", shared, ["Profile", "Context", "Acceptance", "Guard", "Handoff", "Harvest"]);
  for (const adapter of requiredAdapterIds) {
    const content = requireFile(errors, workspace, "adapters", adapter, "ADAPTER.md");
    checks += 1;
    includesAll(errors, `${adapter} adapter`, content, ["SHARED_CORE_CONTRACT.md", "profile", "context", "acceptance", "guard", "handoff", "harvest"]);
  }

  const caseDirs = exists(workspace, "examples")
    ? readdirSync(path.join(workspace, "examples"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    : [];
  for (const caseId of requiredCaseIds) {
    if (!caseDirs.includes(caseId)) errors.push(`missing synthetic case ${caseId}`);
    const content = requireFile(errors, workspace, "examples", caseId, "CASE.md");
    checks += 1;
    includesAll(errors, caseId, content, [
      "Confusing raw input",
      "Likely single-agent failure",
      "AI Collaboration OS process",
      "Context package",
      "Acceptance card",
      "Handoff note",
      "Harvest seed",
      "Before/after comparison",
      "Messy starting point",
      "Workspace setup",
      "Profile/context",
      "Acceptance",
      "Execution prompt",
      "Guard review",
      "Handoff",
      "Harvest",
      "What changes compared with a single raw AI chat"
    ]);
    for (const artifact of ["context-package.md", "acceptance-card.md", "execution-prompt.md", "guard-review.md", "handoff-note.md", "harvest-seed.md"]) {
      requireFile(errors, workspace, "examples", caseId, "artifacts", artifact);
      checks += 1;
    }
  }

  for (const file of ["PRIVACY.md", "COMMERCIAL_BOUNDARY.md", "REDACTION_CHECKLIST.md"]) {
    requireFile(errors, workspace, "privacy", file);
    checks += 1;
  }

  for (const file of ["10-minute-your-task.md", "10-minute.md", "30-minute.md", "60-minute.md", "synthetic-loop-transcript.md"]) {
    const content = requireFile(errors, workspace, "walkthroughs", file);
    checks += 1;
    includesAll(errors, file, content, ["Goal", "Expected"]);
  }

  // The real first-run walkthrough (10-minute-your-task.md) is the main path the
  // init/guide/help all point users to, so it is held to a higher bar than the
  // generic "Goal/Expected" floor: its loop must actually carry the hardened
  // evidence chain (P0-4) and the profile-candidate buffer (P0-5), not a thin
  // "report what you did" + "drop it into the profile". If the walkthrough is
  // gutted back to the soft version, these anchors disappear and validation fails.
  const yourTask = requireFile(errors, workspace, "walkthroughs", "10-minute-your-task.md");
  checks += 1;
  includesAll(errors, "10-minute-your-task.md", yourTask, [
    "Evidence Pack", // Step 2 must produce a structured evidence pack
    // The Evidence Pack must keep its six concrete segments, not collapse back to
    // a vague "report what you changed". Each segment is what makes the Step 3
    // re-check checkable; dropping one silently re-softens the loop.
    "Changed files / diff", // segment 1: what changed
    "Commands run", // segment 2: how it was verified
    "Command output summary", // segment 3: real output, not paraphrase
    "exit code", // segment 4: exit codes (0 = passed)
    "Acceptance mapping", // segment 5: AC -> PASS/FAIL/NOT-VERIFIED
    "Not verified", // segment 6: what could not be proven
    "INSUFFICIENT_EVIDENCE", // Step 3 reviewer verdict when evidence is absent/thin
    "REJECT", // Step 3 verdict when an evidence-grounded hard defect exists
    "acceptance", // re-check maps evidence to acceptance criteria
    "CANDIDATES\\.md", // Step 4 buffers profile candidates instead of dropping them in
    "proposed", // ...via the proposed/confirmed/edited/dropped state machine
    "confirmed",
    "dropped"
  ]);
  // Guard the specific regression P0-5 fixed: candidates must not be dropped
  // straight into the long-term profile dir.
  if (/drop it into\s+`?\.\.\/profile\/`?[^C]/i.test(yourTask)) {
    errors.push("10-minute-your-task.md still drops profile candidates straight into ../profile/ (must buffer in CANDIDATES.md first)");
  }

  // Deep structural validation (P2): goes past presence + keyword into the
  // substance / integrity of the workspace. Failures are appended to the same
  // `errors` list so CLI `check` and the contract validator keep failing on a
  // degraded workspace without any interface change; advisory findings go to
  // `warnings`.
  const counters = { deepChecks: 0 };
  deepValidate(workspace, errors, warnings, counters);
  checks += counters.deepChecks;

  return { ok: errors.length === 0, errors, warnings, checks, deepChecks: counters.deepChecks };
}
