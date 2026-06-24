// Shared JSONL ledger module.
//
// The P1 run layer stores its five append-only logs (tasks, evidence, runs,
// receipts, learning-ledger) as JSON Lines files under <workspace>/state/. This
// module is the SINGLE place that knows how to read, parse, and append those
// lines, so the CLI writer and the validator reader can never drift apart on the
// on-disk shape. Zero dependencies: hand-rolled parse + append, same style as
// validate.js (JSON.parse + per-field checks).
//
// Design notes:
// - Append-only: every command appends one line; nothing is rewritten in place
//   except the deliberate run-finish update (readAll -> patch matching line ->
//   rewrite), which stays deterministic because it preserves line order.
// - Line numbers are 1-based and surfaced on parse so a corrupt ledger fails
//   with a pointable "<file>:<line>" the same way the privacy scanner does.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync, statSync } from "node:fs";
import path from "node:path";

// The five ledgers and their on-disk file names. Single source of truth shared
// by the generator (committed templates), the CLI commands, and the validator.
export const LEDGER_FILES = {
  tasks: "tasks.jsonl",
  evidence: "evidence.jsonl",
  runs: "runs.jsonl",
  receipts: "receipts.jsonl",
  learning: "learning-ledger.jsonl"
};

// Enumerations are the contract's load-bearing part (the dispatch instruction
// pins these), so they live here and are imported by both writer and reader.
export const TASK_STATUSES = ["open", "done", "blocked", "partial", "unverified"];
export const RUN_STATUSES = ["running", "finished"];
export const RECEIPT_VERDICTS = ["pass", "reject", "insufficient_evidence", "pass_with_risk"];
export const RECEIPT_STATUSES = ["accepted", "rejected", "pending"];
// Guard evidence-strength levels (P2 + A1). They grade HOW the guard saw the
// work, so the verdict a receipt may carry is bounded by the strength of the
// evidence the guard actually had. Higher = stronger evidence; the verdict
// ceiling rises with the level (see guardLevelVerdictError for the exact bounds):
//   L0 only a completion summary           -> insufficient_evidence only
//   L1 artifact/acceptance, no real run    -> cannot pass (best is pass_with_risk)
//   L2 author-supplied commands/tests,     -> at most pass_with_risk (single tool
//      single tool / single model family,     OR a same-family sub-agent review,
//      OR a same-family sub-agent review       which is ADVISORY, not binding)
//   L2.5 a weak L3: SAME tool, a DIFFERENT  -> at most pass_with_risk (more
//      model under it (some independence,      independence than L2, but still one
//      but one tool, no cross-family pack)     tool — not the cross-family gate)
//   L3 cross-family review claimed +        -> may pass, but the cross-family
//      a cross_family_guard evidence row,      attribution is SELF-DECLARED and
//      family SELF-DECLARED (unverified)       UNVERIFIED (see family-honesty note)
//   L4 reviewer independently re-ran the    -> strongest; pass requires a rerun
//      key evidence AND that rerun is           evidence row that REFERENCES a real
//      RECONCILED against a real run exec       recorded run (runs.jsonl) AND
//      in runs.jsonl — the hardest local        reconciles with it (same task,
//      pass, but still LOCAL-trust only         finished, executed:true, matching
//      (see the L4 note)                        exitCode + command + outputSha256).
//                                               A self-authored rerun with a fabricated
//                                               output but no recorded, reconciled run
//                                               can NO LONGER reach L4.
//
// A1 CORE — the level is NOT self-asserted. It is COMPUTED by computeGuardLevel()
// from (a) the review MODE the author claims (self / same_family_subagent /
// same_tool_other_model / cross_family / cross_family_rerun) and (b) the evidence
// actually cited. A claim can be set high but is CAPPED by the evidence behind it:
// identity (which family reviewed) can be typed in freely, so it never raises the
// level on its own; evidence hardness (a real rerun OUTPUT) is what earns L4. This
// is the anti-"silent green" rule: an AI that opens its OWN same-family sub-agent
// can only reach review mode same_family_subagent -> computed L2 (advisory), never
// L3, no matter what --claimed-level it types.
//
// "L2.5" is a deliberate non-integer label (a weak L3). It sorts between L2 and L3
// via guardLevelRank (index order below), so all ">= L3" / "< L3" comparisons keep
// treating it as below the cross-family gate.
export const GUARD_LEVELS = ["L0", "L1", "L2", "L2.5", "L3", "L4"];
// The lowest guard level at which a plain "pass" is allowed. Below this, a pass
// is unsupported by the evidence the guard had (L0/L1/L2/L2.5 cannot clear the
// cross-family gate; L2.5 is a weak L3 but still one tool).
export const MIN_PASS_GUARD_LEVEL = "L3";

// Review MODE (A1): HOW the work was reviewed. This is the load-bearing INPUT to
// computeGuardLevel — the author records the review method, and the CLI derives
// the real guard level from it (capped by evidence). Recording the METHOD (not
// the level) is what closes the silent-green door: an AI can claim a method, but
// the method itself bounds the ceiling, and the method "I opened a same-family
// sub-agent" can never reach the cross-family gate.
//   - "self": the author checked their own work. No independent reviewer.
//   - "same_family_subagent": a sub-agent of the SAME model family / tool reviewed
//     it. This improves role separation and catches some mistakes, but a same
//     family tends to share the same blind spots, so it is ADVISORY, not binding
//     — it can never, on its own, be cross-family independence. Caps at L2.
//   - "same_tool_other_model": the SAME tool but a DIFFERENT model under it. Some
//     independence (a different model), but still one tool / one vendor sandbox —
//     a weak L3 (L2.5), not the cross-family gate.
//   - "cross_family": a DIFFERENT model family / tool reviewed it. This is the
//     binding gate's intent — BUT locally we cannot verify the family is truly
//     different (the family field is self-declared), so an L3 reached this way is
//     marked self-declared / unverified.
//   - "cross_family_rerun": cross-family AND the reviewer independently RE-RAN the
//     key evidence, capturing the OUTPUT in a rerun row that REFERENCES a real
//     recorded run (runs.jsonl) and RECONCILES with it (same task, finished,
//     executed:true, matching exitCode + command + outputSha256). A recorded,
//     reconciled run exec is harder to fake
//     than a typed-in family name or a free-text output, so this is the path to L4.
//     (Still LOCAL trust: a single user can choose the local command, so even a
//     reconciled L4 is "backed by a recorded output-matched local run", not
//     cryptographically verified — see familyHonestyMarker / the L4 marker.)
export const REVIEW_MODES = [
  "self",
  "same_family_subagent",
  "same_tool_other_model",
  "cross_family",
  "cross_family_rerun"
];

// The HIGHEST guard level each review mode can support on its own (before the
// evidence cap). This is the "a claimed method bounds the ceiling" half of the
// A1 rule: even a structurally perfect evidence pack cannot push the level above
// what the claimed review METHOD allows. SINGLE source, shared by computeGuardLevel
// (so the CLI writer and the validator derive the same level).
//   self / same_family_subagent -> L2  (no independence / same-family advisory)
//   same_tool_other_model       -> L2.5 (one tool, different model: weak L3)
//   cross_family                -> L3  (cross-family claimed; family unverified)
//   cross_family_rerun          -> L4  (cross-family + a rerun reconciled to a recorded run exec)
export const REVIEW_MODE_LEVEL_CEILING = {
  self: "L2",
  same_family_subagent: "L2",
  same_tool_other_model: "L2.5",
  cross_family: "L3",
  cross_family_rerun: "L4"
};

export const LEARNING_TYPES = ["harvest", "profile"];
export const LEARNING_STATUSES = ["proposed", "confirmed", "edited", "dropped"];

// Evidence "kind" is free-form by design (the run loop should be able to attach
// any kind of proof: a diff, a command, captured output, a file, a plain note),
// so there is NO closed enum here and any string stays accepted — backward
// compatibility is a hard requirement. But P2 gives TWO kinds load-bearing
// meaning, because a guard level is only as honest as the evidence behind it:
//   - "cross_family_guard": a review by a DIFFERENT model family / tool that
//     pressed on the work. This is what makes an L3 "binding" pass binding — a
//     plain pass at L3 must cite at least one piece of this kind, so guardLevel
//     L3 can no longer be self-asserted with a kind:"note" row.
//   - "rerun": the reviewer INDEPENDENTLY re-ran the key evidence and captured
//     the output (carries command / exitCode style fields, plus an OPTIONAL runId
//     pointing at a real recorded run in runs.jsonl). An L4 pass must cite a rerun
//     row via --rerun AND that row must REFERENCE A RECONCILED run (see runId in
//     the structure rules below); a plain "note" — and now a self-authored rerun
//     with no recorded, reconciled run — can no longer prop up an L4 pass.
// These are the only two semantic kinds the verdict gate keys off; everything
// else is generic and unconstrained.
export const EVIDENCE_KIND_CROSS_FAMILY_GUARD = "cross_family_guard";
export const EVIDENCE_KIND_RERUN = "rerun";

// Evidence kinds that show the AUTHOR actually RAN something (a command, captured
// output, or a rerun) — the difference between "L1 there is an artifact" and "L2
// the author has run/test evidence". Used by computeGuardLevel's evidence floor.
// Deliberately small + permissive: any of these cited same-task means "ran".
export const RUN_EVIDENCE_KINDS = ["output", "command", "test", EVIDENCE_KIND_RERUN];

// The minimum STRUCTURED fields each load-bearing kind must carry. This turns the
// two semantic kinds from a bare label into a small structured record, so an
// `evidence add --kind cross_family_guard --summary "..."` empty shell can no
// longer prop up an L3 pass and a bare --kind rerun cannot prop up an L4 pass.
// Documented here so the CLI flag help, the writer, and the validator all read
// the same contract:
//   - rerun: the reviewer's independent re-run. Must record WHAT was run
//     (`command`, a non-empty string), HOW it ended (`exitCode`, an integer),
//     AND the raw `output` it produced (a non-empty string). (A1: the OUTPUT is
//     the hard proof — a command + exit code with no captured output is just a
//     claim "I ran it".) OPTIONAL `runId`: a pointer to a real recorded run in
//     runs.jsonl. The runId field is OPTIONAL at the STRUCTURE level (a rerun row
//     without one is still a well-formed generic rerun), but it is what an L4 pass
//     rests on: only a rerun that REFERENCES a recorded run AND RECONCILES with it
//     (rerunRunReconcileError below) counts toward L4. A self-authored rerun with a
//     fabricated output but no runId tops out at L3 — typing an output string is no
//     longer enough; the run must be on the system's own record and agree. Optional
//     context field (runner) stays free-form.
//   - cross_family_guard: a review by a different model family / tool. Must name
//     WHO/WHICH did the review via at least one of `reviewer` (a person/agent),
//     `family` (the model family), or `ref` (a source pointer) — at least one,
//     not all three, so a single honest attribution is enough.
//
// SCOPE (deliberate, local-first): specialEvidenceStructureError is a STRUCTURAL
// completeness check only — it asserts the fields are PRESENT and well-typed, NOT
// that they are TRUE. It does not verify that `reviewer` names a real person or
// that `family` is a real model. ONE step beyond pure structure exists for L4:
// rerunRunReconcileError (below) cross-checks a rerun's claimed exitCode/command
// against the system's OWN recorded run in runs.jsonl, so a rerun that wants to
// reach L4 can no longer self-report an exitCode that contradicts the recorded run
// (closing the red-team "runs=1 but rerun says 0, still L4" hole). This is still
// LOCAL trust, not anti-forgery: the same user can still choose what command to
// execute locally, so a reconciled L4 means "backed by a recorded local run exec
// whose exit/command/output match", not cryptographic proof. It raises the
// forgery cost from "type one output string" to "drive a real local command and
// cite matching output".
// future: cryptographic provenance (signed reviewer identity, attested run logs)
// would live here if the tool ever needed anti-forgery rather than reconciliation.
export const CROSS_FAMILY_GUARD_ATTRIBUTION_FIELDS = ["reviewer", "family", "ref"];

// True when a value is a non-empty, non-blank string — the bar a required
// structured text field (command, reviewer, family, ref) must clear.
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function outputSha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function outputByteLength(value) {
  return Buffer.byteLength(String(value), "utf8");
}

// SINGLE source of the "this special-kind evidence row carries its required
// structured fields" rule, shared by the CLI writer (evidence add) and the
// validator. Returns an error STRING describing the first missing/ill-typed
// field, or null when the row is structurally complete (or is a generic kind
// with no structural requirement). Generic kinds (note / diff / output / file /
// command / anything else) are unconstrained — backward compatibility is a hard
// requirement; only the two load-bearing kinds are gated.
export function specialEvidenceStructureError(record) {
  if (!isLedgerRecord(record)) return null;
  const kind = record.kind;
  if (kind === EVIDENCE_KIND_RERUN) {
    // A rerun must say what was run and how it ended. exitCode must be an
    // integer (0 = passed); a missing or non-integer exit code makes the rerun
    // unverifiable as pass/fail.
    if (!isNonEmptyString(record.command)) {
      return `rerun evidence must record the command that was re-run (--command "..."); none found`;
    }
    if (!Number.isInteger(record.exitCode)) {
      return `rerun evidence must record an integer exitCode (--exit <code>, 0 = passed); got ${JSON.stringify(record.exitCode)}`;
    }
    // A1: the captured OUTPUT is the hard proof. A rerun with a command + exit
    // code but no output is just an unbacked "I ran it" claim and cannot carry an
    // L4 pass; require a non-empty output snippet.
    if (!isNonEmptyString(record.output)) {
      return `rerun evidence must record the raw output it produced (--output "..."); none found (a command + exit code with no output is just a claim "I ran it")`;
    }
    // runId is OPTIONAL at the STRUCTURE level (a rerun without one is a valid
    // generic rerun that just cannot reach L4), but a PRESENT runId must be a
    // real (non-empty string) id — a blank/non-string runId is a malformed
    // reference, not "unlinked". The actual existence/same-task/finished/match
    // reconciliation against runs.jsonl is rerunRunReconcileError (it needs the
    // runs ledger, which a single-record structure check does not have).
    if (record.runId !== undefined && !isNonEmptyString(record.runId)) {
      return `rerun evidence runId, when present, must be a non-empty string (the id of a recorded run in runs.jsonl); got ${JSON.stringify(record.runId)}`;
    }
    return null;
  }
  if (kind === EVIDENCE_KIND_CROSS_FAMILY_GUARD) {
    // A cross-family guard row must name who/which family pressed on the work:
    // at least one of reviewer / family / ref.
    const hasAttribution = CROSS_FAMILY_GUARD_ATTRIBUTION_FIELDS.some((field) => isNonEmptyString(record[field]));
    if (!hasAttribution) {
      return `cross_family_guard evidence must name who/which family reviewed it via at least one of ${CROSS_FAMILY_GUARD_ATTRIBUTION_FIELDS.map((field) => `--${field}`).join(" / ")}; none found`;
    }
    return null;
  }
  return null;
}

// === A1 L4 reconciliation: a rerun must agree with the system's recorded run ===
//
// THE GAP THIS CLOSES (red-team P1-B): before this, an L4 rest on a self-authored
// rerun row (command + exitCode + a typed-in output). runs.jsonl — the system's
// OWN append-only record of runs — never checked whether the referenced run was
// actually executed or whether its captured output matched. A rerun row could cite
// a self-reported start/finish row, or pair a real run exec with fabricated output,
// and still reach a "verified" L4. This function makes a rerun that wants to count
// toward L4 reference a real recorded run exec (via runId) and RECONCILE with it.
//
// SINGLE source of the reconciliation rule, shared by the CLI writer (it gates the
// rerun -> L4 path at receipt create) and the validator (read-time), so write-time
// and read-time can never drift on what "a reconciled rerun" means.
//
// Returns an error STRING describing the first reconciliation failure, or null when
// the rerun row references a recorded run that reconciles. A rerun row with NO runId
// returns a (non-null) error here too — it is "not reconciled", so it cannot back
// L4 (the caller treats any non-null as "does not count for L4", and surfaces the
// string only when an L4 was actually attempted). The rule, in order:
//   1. runId present (a rerun with no runId is unreconciled — cannot reach L4).
//   2. that runId names a run that EXISTS in runs.jsonl.
//   3. that run belongs to the SAME task as the rerun evidence (taskId match) —
//      a rerun cannot borrow another task's run to manufacture an L4.
//   4. that run is status "finished" (a still-running / unfinished run has no
//      settled exitCode to reconcile against).
//   5. that run was recorded by `run exec` (executed:true); `run start/finish`
//      rows are self-reported and can only support lower levels.
//   6. the run's exitCode EQUALS the rerun's exitCode (the red-team case: a run
//      that finished exit 1 cannot back a rerun that self-reports exit 0).
//   7. the run's command EQUALS the rerun's command (so a rerun cannot point at an
//      unrelated recorded run; trimmed string compare, the same key the rerun's
//      own command structural check uses).
//   8. the rerun output hashes to the recorded run exec outputSha256; legacy runs
//      with no hash fail closed and must be re-run via run exec to reach L4.
//
// `evidenceRecord` is the rerun evidence row; `runRecords` is the parsed runs
// ledger (array). NOTE: this assumes the row is already a structurally-complete
// rerun (specialEvidenceStructureError === null); callers filter on that first.
export function rerunRunReconcileError(evidenceRecord, runRecords) {
  if (!isLedgerRecord(evidenceRecord) || evidenceRecord.kind !== EVIDENCE_KIND_RERUN) {
    return `not a rerun evidence row`;
  }
  const runId = evidenceRecord.runId;
  if (!isNonEmptyString(runId)) {
    return `rerun evidence cites no runId — an L4 rerun must reference a recorded run exec in runs.jsonl (re-run via "ai-collab run exec" and pass --run <runId>); a self-authored rerun with no recorded run tops out at L3`;
  }
  const runs = Array.isArray(runRecords) ? runRecords : [];
  const run = runs.find((candidate) => isLedgerRecord(candidate) && candidate.id === runId);
  if (!run) {
    return `rerun evidence references run "${runId}" but no such run exists in runs.jsonl (broken run reference)`;
  }
  if (run.taskId !== evidenceRecord.taskId) {
    return `rerun evidence (task ${JSON.stringify(evidenceRecord.taskId)}) references run "${runId}" that belongs to another task (${JSON.stringify(run.taskId)}); a rerun may only reference a run of its own task`;
  }
  if (run.status !== "finished") {
    return `rerun evidence references run "${runId}" which is not finished (status ${JSON.stringify(run.status)}); only a finished run has a settled exitCode to reconcile against`;
  }
  if (run.executed !== true) {
    return `rerun evidence references run "${runId}" but that run was not recorded by "ai-collab run exec" (executed:true is missing); self-reported run start/finish rows top out at L3 — re-run via "ai-collab run exec" to reach L4`;
  }
  if (run.exitCode !== evidenceRecord.exitCode) {
    return `rerun evidence claims exitCode ${JSON.stringify(evidenceRecord.exitCode)} but the recorded run "${runId}" finished with exitCode ${JSON.stringify(run.exitCode)} (the rerun must agree with the recorded run)`;
  }
  if (!isNonEmptyString(run.command) || run.command.trim() !== String(evidenceRecord.command).trim()) {
    return `rerun evidence command ${JSON.stringify(evidenceRecord.command)} does not match the recorded run "${runId}" command ${JSON.stringify(run.command)} (the rerun must reference the run it actually came from)`;
  }
  if (!isNonEmptyString(run.outputSha256)) {
    return `rerun evidence references run "${runId}" but that run has no stored outputSha256; legacy runs cannot satisfy L4 output-match — re-run via "ai-collab run exec" to reach L4`;
  }
  const rerunOutputSha256 = outputSha256(evidenceRecord.output);
  if (run.outputSha256 !== rerunOutputSha256) {
    return `rerun evidence output does not match the recorded run "${runId}" outputSha256 (recorded ${run.outputSha256}, rerun ${rerunOutputSha256}); use the exact captured run output or re-run via "ai-collab run exec" to reach L4`;
  }
  return null;
}

// True when a rerun evidence row is RECONCILED against a recorded run — i.e.
// rerunRunReconcileError returns null. Convenience wrapper so callers read as
// "does this rerun count toward L4?" rather than re-deriving the null check.
export function isReconciledRerunEvidence(evidenceRecord, runRecords) {
  return rerunRunReconcileError(evidenceRecord, runRecords) === null;
}

// Verdicts that, on their own, lean toward acceptance. NOTE: leaning toward
// acceptance is necessary but NOT sufficient to write status "accepted" — an
// accepted receipt must also cite evidence (see receiptStatusFor). The two
// "do not accept" verdicts are reject / insufficient_evidence.
export const ACCEPTING_VERDICTS = ["pass", "pass_with_risk"];

// SINGLE source of the "this evidence belongs to this task" predicate, shared by
// the CLI writer (receipt create) and the validator. A receipt for task B may
// only be supported by evidence whose own taskId is B: citing task A's evidence
// proves nothing about task B. Centralizing the comparison here keeps the
// write-time guard and the read-time check on the exact same definition of
// "evidence that counts for this task".
export function evidenceBelongsToTask(evidenceRecord, taskId) {
  return isLedgerRecord(evidenceRecord) && evidenceRecord.taskId === taskId;
}

// SINGLE source of "of these cited evidence ids, which actually belong to the
// task" — returns the subset of citedIds whose evidence row has taskId === the
// receipt's task. Both the CLI writer and the validator call this so the
// own-evidence filter cannot drift between write-time and read-time. Unknown
// ids (not present in evidenceRecords) are dropped here too, so a cited id that
// does not resolve to a real same-task evidence row never counts toward
// acceptance.
export function ownedEvidenceIds(citedIds, taskId, evidenceRecords) {
  const ids = Array.isArray(citedIds) ? citedIds : [];
  const byId = new Map();
  for (const record of evidenceRecords ?? []) {
    if (isLedgerRecord(record) && typeof record.id === "string") byId.set(record.id, record);
  }
  return ids.filter((id) => evidenceBelongsToTask(byId.get(id), taskId));
}

// SINGLE source of the receipt verdict -> status rule, shared by the CLI writer
// (receipt create) and the validator. The rule the validator enforces (check 6:
// an accepted receipt MUST cite evidence that belongs to its own task) and the
// rule the writer applies must not drift, or the CLI could emit a row the
// validator rejects. The second argument is the list of cited evidence ids that
// ALREADY belong to the receipt's task (computed via ownedEvidenceIds), NOT the
// raw cited list — so evidence borrowed from another task can never push a
// receipt to "accepted". So:
//   - "pass" WITH >=1 same-task evidence id              -> "accepted"
//   - "pass_with_risk": NEVER auto-accepted (P2 owner gate); it stays "pending"
//     until an owner explicitly accepts it (ownerAccepted = true), at which point
//     it becomes "accepted" — but only if it also has same-task evidence.
//   - an accepting verdict WITHOUT same-task evidence     -> "pending"
//   - reject / insufficient_evidence                      -> "rejected"
// This guarantees the writer never produces the "accepted + no own-task
// evidence" state the validator flags as an unsupported acceptance, AND never
// auto-accepts a risk receipt the owner has not signed off on (P2).
// `ownerAccepted` defaults false so the common "receipt create" path keeps the
// risk receipt pending; the dedicated owner-acceptance entry passes true.
export function receiptStatusFor(verdict, ownedEvidenceIdList, ownerAccepted = false) {
  if (!ACCEPTING_VERDICTS.includes(verdict)) return "rejected";
  const count = Array.isArray(ownedEvidenceIdList) ? ownedEvidenceIdList.length : 0;
  if (count === 0) return "pending"; // no own-task evidence -> never accepted
  // pass_with_risk requires an explicit owner acceptance to move past pending;
  // a plain pass with evidence still auto-accepts (preserves P1 behavior).
  if (verdict === "pass_with_risk") return ownerAccepted ? "accepted" : "pending";
  return "accepted";
}

// SINGLE source of the verdict x guardLevel consistency rule (P2 core), shared by
// the CLI writer (receipt create / receipt accept) and the validator, so the
// write-time guard and the read-time check can never drift. Returns an error
// STRING describing the first violation, or null if the (guardLevel, verdict)
// pair is allowed.
//
// The evidence-strength flags turn guardLevel from a self-asserted string into a
// claim that must be BACKED by real evidence rows (P2 evidence-gate):
//   - `hasRerunEvidence`: the receipt cites >=1 same-task evidence row of kind
//     "rerun" (used only for the L4 rule).
//   - `hasCrossFamilyGuardEvidence`: the receipt cites >=1 same-task evidence row
//     of kind "cross_family_guard" (used only for the L3-pass rule).
//
// The rule, in plain terms: a guard may only hand out a verdict its evidence
// strength can back. A summary-only look (L0) cannot do more than say "not
// enough evidence"; a paper-only look (L1) cannot pass; a single-tool look (L2)
// can warn but not clear the gate; a plain pass needs the cross-family Evidence
// Pack (L3+), and at L3 that pack must actually be cited (a cross_family_guard
// evidence row), not merely declared; and an L4 "I independently re-ran it" pass
// must actually show the rerun output.
// `rerunIdsCited` (optional) is whether the receipt cited ANY rerun ids at all,
// regardless of whether they resolved to real same-task rerun rows. It only
// sharpens the L4 error message (distinguish "you passed no --rerun" from "you
// passed --rerun ids but they are not valid rerun evidence"); it does not change
// any pass/fail decision. Defaults false so existing two/three-arg callers keep
// the original behavior.
export function guardLevelVerdictError(
  guardLevel,
  verdict,
  hasRerunEvidence = false,
  hasCrossFamilyGuardEvidence = false,
  rerunIdsCited = false
) {
  if (!GUARD_LEVELS.includes(guardLevel)) {
    return `guardLevel must be one of: ${GUARD_LEVELS.join(", ")} (got ${JSON.stringify(guardLevel)})`;
  }
  if (!RECEIPT_VERDICTS.includes(verdict)) {
    return `verdict must be one of: ${RECEIPT_VERDICTS.join(", ")} (got ${JSON.stringify(verdict)})`;
  }
  // L0: only a completion summary was seen -> the only honest verdict is "not
  // enough evidence". Anything stronger claims more than a summary can show.
  if (guardLevel === "L0" && verdict !== "insufficient_evidence") {
    return `guard level L0 (summary only) can only return insufficient_evidence, not "${verdict}"`;
  }
  // L1: artifact/acceptance exist but no real run -> cannot pass.
  if (guardLevel === "L1" && verdict === "pass") {
    return `guard level L1 (no real run evidence) cannot return "pass" (no run proves the claim); use pass_with_risk, reject, or insufficient_evidence`;
  }
  // L2: author-supplied commands/tests under a single tool, OR a same-family
  // sub-agent (advisory) review -> at most a warned pass; a clean "pass" requires
  // the cross-family L3 gate.
  if (guardLevel === "L2" && verdict === "pass") {
    return `guard level L2 (single-tool / same-family-advisory evidence) cannot return "pass"; the strongest a single tool or same-family review may give is pass_with_risk`;
  }
  // L2.5 (weak L3): same tool, a different model under it. More independence than
  // L2, but still one tool — it has NOT cleared the cross-family gate, so it tops
  // out at pass_with_risk (a plain "pass" still requires L3+ cross-family).
  if (guardLevel === "L2.5" && verdict === "pass") {
    return `guard level L2.5 (same tool, different model — a weak L3) cannot return "pass"; one tool has not cleared the cross-family gate, so the strongest is pass_with_risk`;
  }
  // A clean "pass" requires the binding cross-family Evidence Pack: guardLevel
  // must be at least L3. (L0/L1/L2/L2.5 are already handled above; this also
  // rejects any non-listed level that somehow ranks below L3.)
  if (verdict === "pass" && guardLevelRank(guardLevel) < guardLevelRank(MIN_PASS_GUARD_LEVEL)) {
    return `a "pass" verdict requires guard level >= ${MIN_PASS_GUARD_LEVEL} (got "${guardLevel}")`;
  }
  // L3+ pass: the cross-family Evidence Pack must be CITED, not just declared. The
  // whole point of a clean pass ("a guard from a different model family pressed on
  // it") is the cross-family review — so an L3 OR L4 pass with no cross_family_guard
  // evidence row of its own is exactly the self-asserted "binding" pass the gate
  // exists to stop. L4 does NOT get to clear this on a rerun alone: a reconciled rerun
  // is run evidence, not an independent cross-family check, so an L4 pass must cite
  // BOTH a cross_family_guard row (this rule) AND a reconciled rerun (the rule below).
  // computeGuardLevel already refuses to LABEL a rerun-only receipt L4; this is the
  // read-side twin that also flags a hand-planted L3/L4 pass that cites no cross-family.
  if (verdict === "pass" && (guardLevel === "L3" || guardLevel === "L4") && !hasCrossFamilyGuardEvidence) {
    return `guard level ${guardLevel} claims a cross-family Evidence Pack but the receipt cites no cross_family_guard evidence (a plain pass at ${guardLevel} must reference at least one cross_family_guard evidence row of its own task; a reconciled rerun alone is single-tool run evidence, not an independent cross-family check)`;
  }
  // L4 claims the reviewer independently re-ran the key evidence. hasRerunEvidence
  // is now "has a RECONCILED rerun" (a rerun row that references a recorded run in
  // runs.jsonl and agrees with it), not merely "has a rerun with output". If the
  // receipt says L4 but carries no reconciled rerun, the local execution claim is
  // unbacked. The message distinguishes the two real causes so it does not mislead:
  // either no --rerun id was cited at all, OR ids were cited but none resolved to a
  // RECONCILED same-task rerun row (wrong kind, a rerun missing its command/exitCode
  // structure, OR — the A1 L4 case — a rerun that does not reference a recorded,
  // reconciled run: missing runId, a self-reported run without executed:true, a
  // legacy run with no outputSha256, an output mismatch, or runId whose
  // exitCode/command/task/status disagree with the recorded run).
  if (guardLevel === "L4" && verdict === "pass" && !hasRerunEvidence) {
    if (rerunIdsCited) {
      return `guard level L4 claims an independent re-run but the cited rerun evidence is not a recorded, reconciled run (it must be of kind "rerun" with a command + integer exitCode + output, belong to this task, AND reference a runs.jsonl run exec that reconciles — same task, finished, executed:true, matching exitCode + command + outputSha256)`;
    }
    return `guard level L4 claims an independent re-run but the receipt cites no reconciled rerun (record the run via "ai-collab run exec", add a kind:"rerun" evidence row with --command/--exit/--output/--run <runId>, then cite it via --rerun)`;
  }
  return null;
}

// Rank a guard level for ordered comparisons (its index in GUARD_LEVELS). An
// unknown level ranks -1 so it never accidentally satisfies a ">= L3" test.
export function guardLevelRank(guardLevel) {
  return GUARD_LEVELS.indexOf(guardLevel);
}

// The lower of two guard levels by rank (used to CAP a claimed level by the
// evidence that actually backs it). An unknown level (rank -1) loses, so a typo'd
// level can never win the min and sneak through.
export function guardLevelMin(a, b) {
  return guardLevelRank(a) <= guardLevelRank(b) ? a : b;
}

// === A1 CORE: COMPUTE the real guard level from review mode + evidence ========
//
// The guard level is NOT what the AI types. computeGuardLevel derives it from two
// inputs and returns the HONEST level + the metadata a caller needs to mark it:
//
//   real level = MIN( ceiling(reviewMode) , what the evidence backs )
//
//   * ceiling(reviewMode) — a claimed METHOD bounds the top. "I opened a
//     same-family sub-agent" caps at L2 no matter what evidence is attached; only
//     a claimed cross_family_rerun can reach L4. (REVIEW_MODE_LEVEL_CEILING.)
//   * what the evidence backs — identity claims do NOT raise this; only real
//     structured evidence does:
//       rerun-with-output cited   -> can support L4
//       else cross_family_guard cited -> can support L3
//       else author run/test evidence -> L2
//       else any evidence (artifact) -> L1
//       else nothing                 -> L0
//
// Taking the MIN is the whole anti-silent-green mechanism: a high claim cannot
// outrun the evidence, and an honest method cannot be inflated past its ceiling.
//
// `inputs`:
//   - reviewMode (string | undefined): one of REVIEW_MODES. When omitted, it is
//     INFERRED conservatively from the evidence (so a pre-A1 caller that passes a
//     cross_family_guard row but no --review-mode still resolves to "cross_family"
//     rather than silently collapsing to L0). Inference NEVER invents independence
//     it cannot see: no special evidence -> "self".
//   - hasCrossFamilyGuardEvidence (bool): a same-task, structurally-complete
//     cross_family_guard row is cited.
//   - hasRerunOutputEvidence (bool): a same-task, structurally-complete rerun row
//     that is ALSO RECONCILED against a recorded run in runs.jsonl is cited. (A1 L4
//     reconciliation: this boolean is true ONLY when the cited rerun references a
//     recorded run whose taskId/status/exitCode/command agree — see
//     ownedRerunEvidenceIds, which the callers compute it from. A self-authored
//     rerun with a fabricated output but no recorded, reconciled run leaves this
//     FALSE, so it cannot reach L4.) The name is kept for API stability; the
//     meaning is "a recorded, reconciled rerun", not merely "a rerun with output".
//   - hasAuthorRunEvidence (bool): the author cited some run/test evidence (e.g.
//     kind output / command / rerun) — enough for L2 but not independence.
//   - hasAnyEvidence (bool): any evidence at all is cited.
//
// Returns { level, reviewMode, familyUnverified, reason }:
//   - level: the computed guard level (a GUARD_LEVELS value).
//   - reviewMode: the resolved review mode (echoes the input, or the inferred one).
//   - familyUnverified: TRUE whenever the level rests on a SELF-DECLARED
//     cross-family claim. A caller MUST surface this as "self-declared
//     cross-family, unverified" — the tool can reconcile local execution/output
//     at L4, but it still cannot verify which model family actually reviewed.
//   - reason: a short human string explaining the cap (for the CLI to print).
export function computeGuardLevel(inputs = {}) {
  const {
    reviewMode: rawReviewMode,
    hasCrossFamilyGuardEvidence = false,
    hasRerunOutputEvidence = false,
    hasAuthorRunEvidence = false,
    hasAnyEvidence = false
  } = inputs;

  // What the EVIDENCE alone can back (identity claims excluded). L4 — the strongest
  // LOCAL level — requires BOTH a different-family review (a cross_family_guard row)
  // AND a rerun reconciled to a recorded run exec output. A reconciled rerun on its OWN is the
  // author re-running their own command (single-tool run evidence), NOT independent
  // cross-family verification, so it tops out at L2 — it can never reach L4 by itself.
  // This keeps "cross_family_rerun" honest: the cross-family part must be CITED, not
  // merely claimed by the review mode.
  let evidenceLevel;
  if (hasRerunOutputEvidence && hasCrossFamilyGuardEvidence) evidenceLevel = "L4";
  else if (hasCrossFamilyGuardEvidence) evidenceLevel = "L3";
  else if (hasAuthorRunEvidence || hasRerunOutputEvidence) evidenceLevel = "L2";
  else if (hasAnyEvidence) evidenceLevel = "L1";
  else evidenceLevel = "L0";

  // Resolve the review mode. If the caller named one, honor it (validated by the
  // CLI before this point); otherwise INFER the most conservative mode the
  // evidence is consistent with, so an omitted --review-mode never grants more
  // independence than the evidence shows.
  let reviewMode;
  if (REVIEW_MODES.includes(rawReviewMode)) {
    reviewMode = rawReviewMode;
  } else if (hasRerunOutputEvidence && hasCrossFamilyGuardEvidence) {
    reviewMode = "cross_family_rerun";
  } else if (hasCrossFamilyGuardEvidence) {
    reviewMode = "cross_family";
  } else {
    reviewMode = "self";
  }

  // The METHOD ceiling, then cap by evidence. real = min(methodCeiling, evidence).
  const methodCeiling = REVIEW_MODE_LEVEL_CEILING[reviewMode] ?? "L0";
  const level = guardLevelMin(methodCeiling, evidenceLevel);

  // familyUnverified: the family label on a cross_family_guard row is
  // SELF-DECLARED — this tool runs locally and cannot verify which model family
  // actually reviewed. L4 adds a locally reconciled rerun (command + exit + output
  // match a recorded run exec), but that proves execution/output matching, not the
  // model family identity typed into the row. Therefore every level that rests on
  // a cross-family claim keeps the unverified-family marker.
  const restsOnCrossFamilyClaim = reviewMode === "cross_family" || reviewMode === "cross_family_rerun";
  const familyUnverified = restsOnCrossFamilyClaim;

  // A short explanation of why the level is what it is (the cap that bound it).
  let reason;
  if (guardLevelRank(methodCeiling) < guardLevelRank(evidenceLevel)) {
    reason = `review method "${reviewMode}" caps the level at ${methodCeiling} (evidence alone would back ${evidenceLevel})`;
  } else if (guardLevelRank(evidenceLevel) < guardLevelRank(methodCeiling)) {
    reason = `evidence backs only ${evidenceLevel} (review method "${reviewMode}" would allow up to ${methodCeiling})`;
  } else {
    reason = `review method "${reviewMode}" and evidence both support ${level}`;
  }

  return { level, reviewMode, familyUnverified, reason };
}

// SINGLE source of "RE-COMPUTE a stored receipt's real guard level from its OWN
// evidence" — the read-side twin of the CLI writer. It does the work the validator
// (check 8c/8d) and the handoff drafter (buildHandoffModel) both need: resolve which
// of the receipt's cited evidence ids are same-task + structurally complete for each
// load-bearing kind, then run computeGuardLevel on those booleans. It deliberately
// IGNORES the receipt's stored `guardLevel` and stored `familyUnverified` fields and
// derives both from the evidence, so a hand-edited / old-schema / hand-planted row
// that lies in those stored fields cannot fool either caller. Returns the full
// computeGuardLevel result { level, reviewMode, familyUnverified, reason }.
//
// Centralizing this is the anti-drift point: before, validate.js inlined the same
// four-line `computeGuardLevel({ ... ownedCrossFamilyGuardEvidenceIds ... })` block
// twice and buildHandoffModel read a stored field instead — three places that could
// disagree. Now all three derive the family-verification truth one way.
export function computeReceiptGuardLevel(receipt, evidenceRecords = [], runRecords = []) {
  const evidenceIds = Array.isArray(receipt?.evidenceIds) ? receipt.evidenceIds : [];
  const rerunIds = Array.isArray(receipt?.rerunEvidenceIds) ? receipt.rerunEvidenceIds : [];
  const taskId = receipt?.taskId;
  return computeGuardLevel({
    reviewMode: receipt?.reviewMode,
    hasCrossFamilyGuardEvidence: ownedCrossFamilyGuardEvidenceIds(evidenceIds, taskId, evidenceRecords).length > 0,
    hasRerunOutputEvidence: ownedRerunEvidenceIds(rerunIds, taskId, evidenceRecords, runRecords).length > 0,
    hasAuthorRunEvidence: hasOwnedRunEvidence(evidenceIds, taskId, evidenceRecords),
    hasAnyEvidence: ownedEvidenceIds(evidenceIds, taskId, evidenceRecords).length > 0
  });
}

// SINGLE source of the "this is a self-declared, unverified cross-family level"
// marker text, so the CLI display, the JSON payload, and the validator describe it
// the same way. Returns the marker string for a familyUnverified level, or null.
export function familyHonestyMarker(familyUnverified) {
  return familyUnverified ? "self-declared cross-family, unverified" : null;
}

// === A2 CORE: capability detection — "how high CAN this setup ever score?" =====
//
// computeGuardLevel (A1) answers "what did THIS task actually earn?" (the achieved
// level, from the evidence cited this time). computeCapability answers a DIFFERENT
// question: "given the TOOLS you have, what is the highest guard level you could
// EVER reach?" — the ceiling, not the achievement. The two are deliberately kept
// apart: the ceiling is set by your setup (how many independent model families you
// can bring, whether you can re-run commands); the achievement is set by what you
// actually did this task. A user with a cross-family setup (ceiling L3/L4) still
// only earns L1 on a task where they cited no real evidence. So this never touches
// the ledger or computeGuardLevel — it is a pure ADVISORY / coaching layer.
//
// THE LOAD-BEARING JUDGE IS MODEL-FAMILY COUNT, NOT TOOL COUNT (design rule 3):
// two tools that are the SAME model family share the same blind spots, so they are
// NOT cross-family independence — they top out where one tool does (L2). The gate
// to L3 is "a DIFFERENT model family can review your work". One tool that can drive
// two families under it is a weak L3 (L2.5). Re-running commands on top of a
// cross-family setup is what unlocks the strongest level (L4).
//
// The six capability tiers (Owner's table), each mapped to a guard-level CEILING:
//   1. one tool, one conversation, no sub-agents      -> L0  (self-check only;
//      can list risks but cannot give a real pass)        cannot pass anything
//   2. one tool, but you can open a NEW conversation   -> L2  (copy an Evidence
//      to adversarially re-check (same family)             Pack into a fresh
//                                                          chat for a second look,
//                                                          but still same family)
//   3. one tool WITH sub-agents (same family)          -> L2  (auto same-family
//                                                          guard/red-team/scout —
//                                                          advisory, at most
//                                                          pass_with_risk)
//   4. one tool that can switch model FAMILIES under it -> L2.5 (a weak L3: a
//      (e.g. switch the model behind the same tool)         different model, but
//                                                          one tool / one sandbox)
//   5. two DIFFERENT model-family tools                -> L3  (a real cross-family
//                                                          double-guard; the gate
//                                                          to a clean pass, though
//                                                          family is self-declared)
//   6. cross-family AND you can re-run the commands     -> L4  (the strongest local
//      yourself (reconcile against a recorded run exec)    pass: an independent
//                                                          re-run reconciled to a
//                                                          recorded run exec)
//
// Tiers 2 and 3 BOTH cap at L2 but describe different setups (a new conversation vs
// sub-agents); the higher-numbered tier still wins the ceiling because the ceiling
// is the MAX across everything the setup can do (see the ranking below).
export const CAPABILITY_TIERS = [
  {
    id: "single-conversation",
    ceiling: "L0",
    label: "one tool, one conversation",
    experience: "self-check and list risks only — cannot give a real pass"
  },
  {
    id: "new-conversation",
    ceiling: "L2",
    label: "one tool, can open a new conversation",
    experience: "copy an Evidence Pack into a fresh conversation for an adversarial re-check (same family)"
  },
  {
    id: "sub-agents",
    ceiling: "L2",
    label: "one tool with sub-agents",
    experience: "auto same-family guard / red-team / scout — advisory, at most pass_with_risk"
  },
  {
    id: "switch-model-family",
    ceiling: "L2.5",
    label: "one tool that can switch the model family under it",
    experience: "a weak L3 — a different model, but still one tool / one sandbox"
  },
  {
    id: "cross-family",
    ceiling: "L3",
    label: "two different model-family tools",
    experience: "a real cross-family double-guard — the gate to a clean pass (family self-declared)"
  },
  {
    id: "cross-family-rerun",
    ceiling: "L4",
    label: "cross-family and you can re-run the commands yourself",
    experience: "the strongest local pass — an independent re-run reconciled to a recorded run exec output"
  }
];

// Map a tool name (lowercased) to the model FAMILY behind it, so distinct families
// can be counted (the load-bearing judge). This is best-effort and DELIBERATELY
// conservative: a tool we do not recognise maps to "unknown", which is treated as
// its OWN family only when no better signal exists (so an unknown tool never
// silently manufactures cross-family independence with a known one — see
// distinctFamilies). The known map covers the tools the adapter layer already
// targets. SINGLE source so the CLI and any future caller count families the same.
//   - claude code / claude  -> "anthropic"
//   - codex / chatgpt / copilot (GitHub Copilot rides GPT) -> "openai"
//   - cursor -> "cursor" : Cursor is a multi-model HOST (it can drive Anthropic,
//     OpenAI, etc.), not itself a single family. It is its OWN bucket so we never
//     assume which family it is on; if a user is on Cursor AND another tool, that
//     is only true cross-family if they SAY which family Cursor is using (via
//     --families), which is exactly the "signal can't prove family" honesty rule.
//   - cline / windsurf -> also multi-model hosts, same own-bucket treatment.
export const TOOL_FAMILY = {
  claude: "anthropic",
  "claude-code": "anthropic",
  codex: "openai",
  chatgpt: "openai",
  copilot: "openai",
  cursor: "cursor",
  cline: "cline",
  windsurf: "windsurf",
  gemini: "google"
};

// The project files that SIGNAL a given tool may be configured here, mapped to
// { tool, family, confident }. `confident` marks whether the marker reliably pins
// the tool: a tool-specific dir/file (.claude/, .codex/, .cursor/) is confident;
// a GENERIC file many tools now share (AGENTS.md, and to a lesser extent CLAUDE.md)
// is NOT — lots of tools read AGENTS.md, so it only hints "some agent tool", never
// proves which family (design rule 4: a signal is "maybe", never a verdict on
// family). The detector surfaces low-confidence hits as "inferred — please
// confirm". SINGLE source so the probe and any test read the same marker table.
export const TOOL_SIGNALS = [
  { marker: ".claude", tool: "claude", family: "anthropic", confident: true },
  { marker: ".codex", tool: "codex", family: "openai", confident: true },
  { marker: ".cursor", tool: "cursor", family: "cursor", confident: true },
  { marker: ".clinerules", tool: "cline", family: "cline", confident: true },
  { marker: ".windsurf", tool: "windsurf", family: "windsurf", confident: true },
  { marker: ".github/copilot-instructions.md", tool: "copilot", family: "openai", confident: true },
  // Generic, multi-tool markers: a HINT that *an* agent tool is in use, but they
  // do not pin a family. Many tools (Codex, Cursor, Cline, Amp, …) read AGENTS.md;
  // CLAUDE.md usually means Claude Code but is also copied by other setups.
  { marker: "CLAUDE.md", tool: "claude", family: "anthropic", confident: false },
  { marker: "AGENTS.md", tool: null, family: null, confident: false }
];

// Count the DISTINCT model families in a list of family strings, ignoring blanks.
// "unknown"/null entries each count as their own anonymous family ONLY if there is
// nothing else to pin them to — but for the cross-family DECISION we must not let an
// unknown pair with a known family to fake independence, so unknowns are collapsed:
// any number of unknown/null families counts as AT MOST ONE extra family, and only
// when there is no other family already (an unknown alongside a known one adds
// nothing, because we cannot prove it is actually different). This keeps the gate
// honest: cross-family requires TWO families we can actually name.
export function distinctNamedFamilies(families) {
  const named = new Set();
  for (const family of families ?? []) {
    if (typeof family === "string" && family.trim().length > 0 && family !== "unknown") {
      named.add(family.trim());
    }
  }
  return named;
}

// COMPUTE the capability ceiling from a setup description. Pure + zero-dep, mirrors
// computeGuardLevel's shape. Returns the highest guard level this setup could ever
// reach, the tier it matches, and the metadata the CLI needs to explain it and to
// recommend the next step up.
//
// `setup`:
//   - families (string[]): the model families the user can bring (e.g.
//     ["anthropic", "openai"]). The COUNT of distinct NAMED families is the gate:
//     >=2 named families -> cross-family (L3 ceiling). Derived from detection +
//     the --families flag; "unknown" entries never count toward the 2 (honesty).
//   - tools (string[]): tool names seen/declared. Used only to derive families
//     when `families` is not given (via TOOL_FAMILY), and for display.
//   - canSwitchModelFamily (bool): one tool can drive a DIFFERENT model family
//     under it -> a weak L3 (L2.5 ceiling) even with a single tool.
//   - hasSubAgents (bool): the tool can spawn same-family sub-agents -> L2 ceiling
//     (advisory reviews) even in one conversation.
//   - canOpenNewConversation (bool): the user can open a fresh conversation to
//     re-check (same family) -> L2 ceiling. Defaults TRUE — almost every chat tool
//     can open a new chat — so the floor for any real tool is L2, not L0. Pass
//     false only to model the strict "one locked conversation" tier 1.
//   - canRerun (bool): the user can independently re-run the commands and reconcile
//     against a recorded run -> unlocks L4, but ONLY on top of a cross-family setup
//     (re-running alone, single family, does not clear the cross-family gate).
//
// Returns { ceiling, tier, reason, distinctFamilies, families, recommendation }:
//   - ceiling: a GUARD_LEVELS value — the highest level this setup can ever reach.
//   - tier: the matched CAPABILITY_TIERS entry (id/label/experience) for display.
//   - reason: a short human string explaining what set the ceiling.
//   - distinctFamilies: the count of distinct NAMED families (the gate input).
//   - families: the sorted list of distinct named families (for display).
//   - recommendation: { nextCeiling, action } — the single most valuable next step
//     to raise the ceiling, or null when already at L4. This is the "how do I level
//     up?" half of A2 (design point: give an upgrade PATH, not just a number).
export function computeCapability(setup = {}) {
  const {
    families: rawFamilies,
    tools: rawTools = [],
    canSwitchModelFamily = false,
    hasSubAgents = false,
    canOpenNewConversation = true,
    canRerun = false
  } = setup;

  // Resolve families: prefer an explicit list; otherwise derive from tools.
  let familyList;
  if (Array.isArray(rawFamilies) && rawFamilies.length > 0) {
    familyList = rawFamilies;
  } else {
    familyList = (Array.isArray(rawTools) ? rawTools : [])
      .map((tool) => TOOL_FAMILY[String(tool).toLowerCase()] ?? "unknown");
  }
  const named = distinctNamedFamilies(familyList);
  const distinctFamilies = named.size;
  const families = [...named].sort();

  // Each capability the setup has votes a ceiling; the real ceiling is the MAX
  // (the best the setup can do), capped by the cross-family gate where it applies.
  // Build the candidate ceilings, then take the highest by guardLevelRank.
  const candidates = [];
  const crossFamily = distinctFamilies >= 2;

  // L0 floor: a single locked conversation with nothing else.
  candidates.push("L0");
  if (canOpenNewConversation) candidates.push("L2"); // a fresh-conversation re-check (same family)
  if (hasSubAgents) candidates.push("L2"); // same-family sub-agent advisory reviews
  if (canSwitchModelFamily) candidates.push("L2.5"); // one tool, a different model under it (weak L3)
  if (crossFamily) candidates.push("L3"); // two named families: the cross-family gate
  // L4 is gated on cross-family: re-running alone (single family) cannot clear the
  // cross-family gate, so canRerun only lifts the ceiling when crossFamily holds.
  if (crossFamily && canRerun) candidates.push("L4");

  let ceiling = "L0";
  for (const candidate of candidates) {
    if (guardLevelRank(candidate) > guardLevelRank(ceiling)) ceiling = candidate;
  }

  // Pick the tier whose ceiling matches AND best describes the dominant capability.
  // We match on the ceiling, preferring the most specific tier for that ceiling
  // (cross-family-rerun > cross-family for L4/L3; switch-model-family for L2.5; for
  // L2 prefer sub-agents when present, else new-conversation; L0 is the floor).
  const tier = pickCapabilityTier(ceiling, { hasSubAgents, canSwitchModelFamily, crossFamily, canRerun });

  // The reason: name the capability that set the ceiling, in plain terms.
  let reason;
  if (ceiling === "L4") {
    reason = `${distinctFamilies} model families plus your own re-run (reconciled to a recorded run exec output) reach the strongest local level`;
  } else if (ceiling === "L3") {
    reason = `${distinctFamilies} distinct model families (${families.join(" + ")}) clear the cross-family gate`;
  } else if (ceiling === "L2.5") {
    reason = `one tool that can switch model families is a weak L3 — more independence than one model, but still one tool`;
  } else if (ceiling === "L2") {
    reason = hasSubAgents
      ? `same-family sub-agent reviews are advisory — useful, but not cross-family independence`
      : `a same-family re-check in a fresh conversation is advisory — not cross-family independence`;
  } else {
    reason = `a single locked conversation can self-check and list risks, but cannot independently review its own work`;
  }

  const recommendation = capabilityRecommendation(ceiling, {
    distinctFamilies,
    canOpenNewConversation,
    hasSubAgents,
    canSwitchModelFamily,
    crossFamily,
    canRerun
  });

  return { ceiling, tier, reason, distinctFamilies, families, recommendation };
}

// Choose the CAPABILITY_TIERS entry that best describes a computed ceiling. For
// ceilings with two tiers (L2 = new-conversation | sub-agents), prefer the more
// capable description the setup actually has. Always returns a tier (falls back to
// the first tier whose ceiling matches, then to the L0 tier) so the caller can
// always show a label.
export function pickCapabilityTier(ceiling, flags = {}) {
  const { hasSubAgents = false } = flags;
  const byId = (id) => CAPABILITY_TIERS.find((tier) => tier.id === id);
  if (ceiling === "L4") return byId("cross-family-rerun");
  if (ceiling === "L3") return byId("cross-family");
  if (ceiling === "L2.5") return byId("switch-model-family");
  if (ceiling === "L2") return hasSubAgents ? byId("sub-agents") : byId("new-conversation");
  // L0 (or any unrecognised ceiling): the single-conversation floor.
  return byId("single-conversation");
}

// The single most valuable next step to RAISE the ceiling, given the current
// ceiling and what the setup already has. Returns { nextCeiling, action } or null
// when already at the top (L4). The advice is concrete and ordered by the cheapest
// real jump: from L0/L2/L2.5 the high-value move is almost always "bring a second
// model family" (the cross-family gate to L3); from L3 it is "re-run the commands
// yourself via run exec and reconcile to the recorded output hash" (L4). SINGLE
// source so the CLI text and any test agree on the recommended path.
export function capabilityRecommendation(ceiling, flags = {}) {
  const { crossFamily = false, canRerun = false } = flags;
  if (ceiling === "L4") return null; // already at the strongest local level
  if (ceiling === "L3") {
    // The only step up from L3 is L4: re-run the key commands independently via
    // run exec and reconcile them against the recorded output hash.
    return {
      nextCeiling: "L4",
      action: canRerun
        ? `you can already re-run commands — record the run with ai-collab run exec and add a kind:"rerun" evidence row with matching --output that cites it (--run) to reach L4 on a task`
        : `independently re-run the key commands with ai-collab run exec, then add a kind:"rerun" evidence row with matching --output that cites the run (--run) to reach L4`
    };
  }
  // L0 / L2 / L2.5 all level up the same way: cross the family gate to L3 by
  // bringing a SECOND, different model family (a second tool on a different family,
  // or a tool that can switch families under it).
  if (!crossFamily) {
    return {
      nextCeiling: "L3",
      action: `add a SECOND model family (a tool on a different model family, or switch the model under your current tool) so a cross-family guard can review your work — this is the gate to a clean pass (L3)`
    };
  }
  // Defensive fallback (cross-family true but ceiling below L3 — should not happen):
  // still point at L4 as the next move.
  return {
    nextCeiling: "L4",
    action: `independently re-run the key commands with ai-collab run exec and reconcile the rerun output to that recorded run to reach L4`
  };
}

// SINGLE source of the owner-acceptance integrity rule (P2), shared by the CLI
// writer and the validator. A receipt that is "accepted" with a pass_with_risk
// verdict MUST carry the owner-acceptance marker (ownerAccepted === true): the
// whole point of pass_with_risk is that a human signed off on the named risk, so
// an accepted risk receipt with no owner mark is an unsupported acceptance.
// Returns an error string or null. Non-accepted receipts and non-risk verdicts
// are unaffected.
export function ownerAcceptanceError(receipt) {
  if (!isLedgerRecord(receipt)) return null;
  if (receipt.status !== "accepted") return null;
  if (receipt.verdict !== "pass_with_risk") return null;
  if (receipt.ownerAccepted === true) return null;
  return `receipt ${receipt.id ?? "(no id)"} is an "accepted" pass_with_risk but has no owner acceptance marker (ownerAccepted: true)`;
}

// SINGLE source of "which of a receipt's cited rerun ids actually count toward
// L4" — the subset of rerunEvidenceIds that resolve to a same-task evidence row,
// are of the load-bearing kind "rerun", are STRUCTURALLY COMPLETE, AND (A1 L4
// reconciliation) reference a recorded run in runs.jsonl that RECONCILES with the
// rerun (rerunRunReconcileError === null). Reused by the L4 check on both write and
// read sides so (a) a rerun id borrowed from another task / a dangling id never
// satisfies the independent-re-run requirement, (b) a plain note cannot be passed
// via --rerun to fake a rerun (only an actual kind:"rerun" row counts), and (c) —
// the NEW gate — a self-authored rerun whose exitCode/command do not match (or that
// names no) recorded run no longer counts: an L4 rerun must agree with the system's
// own run record. (P2/A1 evidence-gate: guardLevel L4 must be backed by a recorded,
// reconciled run, not a self-asserted output string.)
//
// `runRecords` is the parsed runs ledger. It defaults to [] so a legacy 3-arg call
// (no runs passed) yields ZERO reconciled rerun ids — i.e. failing CLOSED: if a
// caller forgets the runs ledger, no rerun reaches L4, rather than silently
// re-opening the hole. Every real caller (CLI create/accept, validator check 8/8c/
// 8d) passes the runs ledger.
export function ownedRerunEvidenceIds(rerunEvidenceIds, taskId, evidenceRecords, runRecords = []) {
  const kindOwned = ownedEvidenceIdsOfKind(rerunEvidenceIds, taskId, evidenceRecords, EVIDENCE_KIND_RERUN);
  if (kindOwned.length === 0) return kindOwned;
  const byId = new Map();
  for (const record of evidenceRecords ?? []) {
    if (isLedgerRecord(record) && typeof record.id === "string") byId.set(record.id, record);
  }
  // Keep only rerun rows whose recorded-run reconciliation passes. This is the
  // step that turns "has a structurally-complete rerun output" into "has a rerun
  // backed by a recorded, reconciled run".
  return kindOwned.filter((id) => isReconciledRerunEvidence(byId.get(id), runRecords));
}

// SINGLE source of "which of a receipt's cited evidence ids are same-task AND of
// the kind 'cross_family_guard'" — i.e. real cross-family review evidence owned
// by this task. Reused by the L3-pass check on both write and read sides so a
// guardLevel L3 "binding" pass can no longer be self-asserted on a kind:"note"
// row: it must cite at least one piece of cross-family guard evidence belonging
// to its own task. (P2 evidence-gate core.)
export function ownedCrossFamilyGuardEvidenceIds(evidenceIds, taskId, evidenceRecords) {
  return ownedEvidenceIdsOfKind(evidenceIds, taskId, evidenceRecords, EVIDENCE_KIND_CROSS_FAMILY_GUARD);
}

// Shared kind-aware owned-evidence filter: of the cited ids, the subset whose
// evidence row belongs to `taskId`, has `record.kind === kind`, AND (for the two
// load-bearing kinds) is STRUCTURALLY COMPLETE. Built on the same ownership
// predicate as ownedEvidenceIds so the cross-task back door stays closed for
// kind-gated evidence too; the extra kind check is what lets a guard level demand
// a SPECIFIC kind of proof (cross_family_guard for L3, rerun for L4) rather than
// any evidence at all; the structural check is what makes that proof a real
// structured record rather than an empty shell with the right label — an
// `--kind cross_family_guard --summary "ok"` row with no reviewer/family/ref no
// longer counts toward an L3 pass, and a bare `--kind rerun` no longer counts
// toward L4. (P2: label gate -> structure gate.)
export function ownedEvidenceIdsOfKind(evidenceIds, taskId, evidenceRecords, kind) {
  const owned = new Set(ownedEvidenceIds(evidenceIds, taskId, evidenceRecords));
  const byId = new Map();
  for (const record of evidenceRecords ?? []) {
    if (isLedgerRecord(record) && typeof record.id === "string") byId.set(record.id, record);
  }
  const ids = Array.isArray(evidenceIds) ? evidenceIds : [];
  return ids.filter((id) => {
    if (!owned.has(id)) return false;
    const record = byId.get(id);
    if (record?.kind !== kind) return false;
    // A special kind only counts if its required structured fields are present;
    // generic kinds have no structural requirement (returns null) so this is a
    // no-op for them — but those never reach here anyway (kind !== the special
    // kind already filtered them out).
    return specialEvidenceStructureError(record) === null;
  });
}

// True when the receipt cites at least one same-task evidence row of a RUN kind
// (output / command / test / rerun) — i.e. the author actually ran something, the
// L1 -> L2 floor for computeGuardLevel. SINGLE source so the CLI writer and the
// validator compute the same level. Built on the same ownership predicate so a
// run row borrowed from another task does not count. (A1 evidence floor.)
export function hasOwnedRunEvidence(evidenceIds, taskId, evidenceRecords) {
  const owned = new Set(ownedEvidenceIds(evidenceIds, taskId, evidenceRecords));
  const byId = new Map();
  for (const record of evidenceRecords ?? []) {
    if (isLedgerRecord(record) && typeof record.id === "string") byId.set(record.id, record);
  }
  const ids = Array.isArray(evidenceIds) ? evidenceIds : [];
  return ids.some((id) => owned.has(id) && RUN_EVIDENCE_KINDS.includes(byId.get(id)?.kind));
}

// SINGLE source of the "a task may be marked done only with evidence" rule,
// shared by the CLI writer (task update) and the validator (check 5). A task in
// the done state with no evidence row pointing at it is exactly the thin "done"
// the system exists to catch, so the writer refuses it up front and the
// validator keeps catching any that arrive by other means.
export function doneRequiresEvidence(status) {
  return status === "done";
}

// SINGLE source of the learning-ledger record shape rule (P4), shared by the CLI
// writer (learning add) and the validator. A learning row records one captured
// lesson (type "harvest") or one suggested standing preference (type "profile"),
// and moves through the same proposed/confirmed/edited/dropped discipline the
// profile-candidate buffer and the harvest mechanism use — nothing graduates on
// the AI's say-so alone. This is the P1 schema (id / taskId? / type / content /
// status / createdAt) turned into an enforced contract so the writer can never
// emit a row the validator would reject, and a hand-edited ledger that drifts off
// the enum (a bogus type, a typo'd status, an empty content) is caught too.
// Returns an error STRING describing the first violation, or null when the row is
// well-formed. `taskId` is OPTIONAL (a lesson may not belong to a single task),
// but when present it must be a non-empty string.
export function learningRecordError(record) {
  if (!isLedgerRecord(record)) return "learning record must be an object";
  if (typeof record.id !== "string" || record.id.length === 0) {
    return "learning record must have a non-empty string id";
  }
  if (!LEARNING_TYPES.includes(record.type)) {
    return `learning type must be one of: ${LEARNING_TYPES.join(", ")} (got ${JSON.stringify(record.type)})`;
  }
  if (!isNonEmptyString(record.content)) {
    return "learning record must have non-empty content";
  }
  if (!LEARNING_STATUSES.includes(record.status)) {
    return `learning status must be one of: ${LEARNING_STATUSES.join(", ")} (got ${JSON.stringify(record.status)})`;
  }
  // createdAt is REQUIRED and part of the row shape (every writer — `learning add`
  // and the seed generator — stamps it). A row missing it, or with a non-string
  // createdAt, is malformed: the recall selector and the "most recent activity"
  // calculation both read createdAt, so a blank one would silently skew ordering.
  if (!isNonEmptyString(record.createdAt)) {
    return `learning record must have a non-empty string createdAt (got ${JSON.stringify(record.createdAt)})`;
  }
  // taskId is optional, but a present taskId must be a real (non-empty) id — a
  // blank or non-string taskId is a malformed binding, not "unbound".
  if (record.taskId !== undefined && !isNonEmptyString(record.taskId)) {
    return `learning record taskId, when present, must be a non-empty string (got ${JSON.stringify(record.taskId)})`;
  }
  return null;
}

// True for the two learning states that have been reviewed and kept by the human
// (confirmed = correct as written; edited = correct after rewording). Only these
// graduate into the long-term profile; "proposed" is an un-reviewed guess and
// "dropped" was reviewed and rejected, so neither counts. SINGLE source of the
// "what counts as a kept preference" rule, shared by the status recall display
// and any future graduation step so they cannot drift.
export function isGraduatedLearningStatus(status) {
  return status === "confirmed" || status === "edited";
}

// SINGLE source of "the standing preference to echo back next time" (P4 recall).
// Returns the most recently captured profile-type learning row the human has kept
// (status confirmed or edited), or null when there is none. "Most recent" is the
// last such row in ledger order; since rows are append-only and status flips are
// rewritten in place preserving order, the last kept profile row is the latest
// preference the user stood behind. Deliberately returns ONE row, not a list —
// the recall is a single "still working the way you confirmed" reminder, not a
// dump of every preference (the point is the user feels understood without being
// made to maintain a system).
export function latestConfirmedProfileLearning(records) {
  let latest = null;
  for (const record of records ?? []) {
    if (!isLedgerRecord(record)) continue;
    if (record.type !== "profile") continue;
    if (!isGraduatedLearningStatus(record.status)) continue;
    latest = record; // keep walking; the last kept profile row wins
  }
  return latest;
}

// SINGLE source of "every standing preference the user has kept" — the LIST twin
// of latestConfirmedProfileLearning. Returns ALL profile-type rows the human kept
// (status confirmed or edited), in ledger order, so a consumer that must surface
// the whole confirmed profile (e.g. `adapters install` injecting "Your confirmed
// preferences" into the rule files a real tool reads) sees them all, not just the
// most recent one. Reuses isGraduatedLearningStatus so "what counts as kept" never
// drifts from the recall display. Deliberately strict: a "proposed" row (an
// un-reviewed guess) and a "dropped" row (reviewed and rejected) are BOTH excluded
// — injecting a proposed preference would pass off an unconfirmed guess as a
// standing rule, exactly the dishonesty the proposed/confirmed buffer exists to
// prevent. Returns [] (never null) when nothing is kept, so the caller can tell
// "no confirmed preferences" from a real list without a null check.
export function confirmedProfileLearnings(records) {
  const kept = [];
  for (const record of records ?? []) {
    if (!isLedgerRecord(record)) continue;
    if (record.type !== "profile") continue;
    if (!isGraduatedLearningStatus(record.status)) continue;
    kept.push(record);
  }
  return kept;
}

// SINGLE source of "the most recent confirmed/edited HARVEST lesson to echo back"
// — the symmetric twin of latestConfirmedProfileLearning, so status can surface a
// kept harvest lesson the same way it surfaces a kept preference. A harvest row is
// a lesson the run loop captured (P4 harvest), NOT a standing preference; before
// this it had nowhere to show up after being confirmed (only profile rows were
// recalled), so a user who confirmed a harvest lesson saw it vanish. Returns the
// last kept harvest row in ledger order (append-only + in-place status rewrites
// preserve order, so the last kept harvest row is the latest), or null when none.
// Deliberately ONE row, not a dump — same restraint as the profile recall.
export function latestConfirmedHarvestLearning(records) {
  let latest = null;
  for (const record of records ?? []) {
    if (!isLedgerRecord(record)) continue;
    if (record.type !== "harvest") continue;
    if (!isGraduatedLearningStatus(record.status)) continue;
    latest = record; // keep walking; the last kept harvest row wins
  }
  return latest;
}

// === Synthetic-seed detection (status honesty) ==============================
//
// init writes one mutually-consistent SYNTHETIC seed set (task t0, evidence
// e0/e1, run r0, receipt c0, learning l0) so a brand-new workspace passes every
// ledger check with zero errors and the privacy scanner has a real line to scan
// (see workspace.js). The side effect: a fresh `status` shows "Receipts: 1
// [accepted=1]" etc. that the user did NOT earn, which reads as fake progress.
// This is the SINGLE source of "is this row the shipped example seed, not the
// user's own work", shared by the status display so the example rows can be
// labelled instead of silently counted as achievements.
//
// SYNTHETIC_SEED_TS is the fixed timestamp every seed row carries (mirrors
// SYNTHETIC_TS in workspace.js — the writer's value; kept in sync by the seed
// self-consistency tests). The detector keys on BOTH a known seed id AND that
// fixed timestamp, so a real user row can never be mislabelled an example:
//   - a user task is t1+ (nextId skips the t0 seed), so id "t0" + the synthetic
//     timestamp is unambiguous; the same holds for the other seed ids.
//   - requiring the synthetic timestamp too means that even if a user somehow
//     reused a seed id, a row stamped with a REAL createdAt is treated as real.
// Conservative on purpose: a row is only an "example seed" when it matches the
// shipped id AND the shipped timestamp; anything else is the user's own.
export const SYNTHETIC_SEED_TS = "2026-01-01T00:00:00.000Z";

const SEED_IDS_BY_LEDGER = {
  tasks: new Set(["t0"]),
  evidence: new Set(["e0", "e1"]),
  runs: new Set(["r0"]),
  receipts: new Set(["c0"]),
  learning: new Set(["l0"])
};

// True when `record` is one of the shipped synthetic seed rows for `ledgerKey`
// (a known seed id stamped with the synthetic timestamp). `ledgerKey` is one of
// the SEED_IDS_BY_LEDGER keys; an unknown key (or a non-record) is never a seed.
export function isSeedRow(record, ledgerKey) {
  if (!isLedgerRecord(record)) return false;
  const ids = SEED_IDS_BY_LEDGER[ledgerKey];
  if (!ids || !ids.has(record.id)) return false;
  // The seed timestamp lives in createdAt for every seed ledger except runs,
  // whose seed row is stamped startedAt/finishedAt (no createdAt). Accept the
  // synthetic timestamp in any of those positions so the run seed is detected too.
  return (
    record.createdAt === SYNTHETIC_SEED_TS ||
    record.startedAt === SYNTHETIC_SEED_TS ||
    record.finishedAt === SYNTHETIC_SEED_TS
  );
}

// How many rows in `records` are the shipped synthetic seed for `ledgerKey`.
// A thin count over isSeedRow so callers (e.g. status's top counters) can mark
// "N of these are example seeds" the same way the Tasks counter already does,
// keeping the definition of "what is a seed" in one place. Pure read: it counts
// existing rows, it never changes them, so the displayed total is unaffected.
export function countSeedRows(records, ledgerKey) {
  if (!Array.isArray(records)) return 0;
  return records.filter((record) => isSeedRow(record, ledgerKey)).length;
}

export function isDoneEligibleReceipt(receipt, evidenceRecords = [], runRecords = []) {
  if (!isLedgerRecord(receipt)) return false;
  if (receipt.status !== "accepted") return false;
  return computeReceiptGuardLevel(receipt, evidenceRecords, runRecords).familyUnverified !== true;
}

export function taskHasDoneEligibleReceipt(taskId, receiptRecords = [], evidenceRecords = [], runRecords = []) {
  if (typeof taskId !== "string" || taskId.length === 0) return false;
  if (!Array.isArray(receiptRecords)) return false;
  return receiptRecords.some(
    (receipt) => isLedgerRecord(receipt) &&
      receipt.taskId === taskId &&
      isDoneEligibleReceipt(receipt, evidenceRecords, runRecords)
  );
}

export function taskHasAcceptedReceipt(taskId, receiptRecords = []) {
  if (typeof taskId !== "string" || taskId.length === 0) return false;
  if (!Array.isArray(receiptRecords)) return false;
  return receiptRecords.some(
    (receipt) => isLedgerRecord(receipt) && receipt.taskId === taskId && receipt.status === "accepted"
  );
}

export function taskIsAuthorMarkedDoneUnverified(task, receiptRecords = [], evidenceRecords = [], runRecords = []) {
  if (!isLedgerRecord(task)) return false;
  return task.status === "done" &&
    !taskHasDoneEligibleReceipt(task.id, receiptRecords, evidenceRecords, runRecords);
}

export function taskStatusDisplay(task, receiptRecords = [], evidenceRecords = [], runRecords = []) {
  const status = typeof task?.status === "string" ? task.status : "";
  if (taskIsAuthorMarkedDoneUnverified(task, receiptRecords, evidenceRecords, runRecords)) {
    return "done — author-marked, unverified";
  }
  return status;
}

// === Per-task achievement summary (the "what did I earn" view) ==============
//
// status used to print only counters ("Tasks: 2 / Receipts: 2 [accepted=2]"),
// which never told the user WHAT they earned ON WHICH TASK. This joins each task
// to its own receipts / evidence / runs so status can show, per task: the title,
// the task status, and the strongest receipt (verdict + recomputed guardLevel +
// who accepted it) plus the evidence/run counts behind it. It is a pure read /
// aggregation over already-recorded rows, but it deliberately RE-COMPUTES a
// receipt's guard level + family marker from that receipt's own evidence via
// computeReceiptGuardLevel. That matches the validator/handoff anti-tamper
// pattern and prevents a hand-edited stored guardLevel/familyUnverified field
// from making `status` look cleaner than `check` and `handoff`.
//
// "Strongest receipt" = highest recomputed guardLevel, ties broken by the later
// createdAt (the most recent at that level), so a task shows its best-earned
// receipt rather than an arbitrary one. A task with no receipt reports
// receipt:null (still useful: title + evidence/run counts so an in-progress task
// is visible). Each entry is flagged isSeed so the display can mark example rows.
export function summarizeTasks(tasks, receipts, evidence, runs) {
  const taskList = Array.isArray(tasks) ? tasks : [];
  const receiptList = Array.isArray(receipts) ? receipts : [];
  const evidenceList = Array.isArray(evidence) ? evidence : [];
  const runList = Array.isArray(runs) ? runs : [];

  return taskList.filter(isLedgerRecord).map((task) => {
    const taskReceipts = receiptList.filter(
      (receipt) => isLedgerRecord(receipt) && receipt.taskId === task.id
    );
    const evidenceCount = evidenceList.filter(
      (row) => isLedgerRecord(row) && row.taskId === task.id
    ).length;
    const runCount = runList.filter(
      (row) => isLedgerRecord(row) && row.taskId === task.id
    ).length;

    const receiptViews = taskReceipts.map((receipt) => ({
      receipt,
      computed: computeReceiptGuardLevel(receipt, evidenceList, runList)
    }));

    // Pick the strongest receipt: highest recomputed guardLevel, tie -> latest createdAt.
    let best = null;
    for (const view of receiptViews) {
      if (best === null) {
        best = view;
        continue;
      }
      const rankDelta = guardLevelRank(view.computed.level) - guardLevelRank(best.computed.level);
      if (rankDelta > 0) {
        best = view;
      } else if (rankDelta === 0 && String(view.receipt.createdAt) > String(best.receipt.createdAt)) {
        best = view;
      }
    }

    const bestSummary = best
      ? {
          id: best.receipt.id,
          verdict: best.receipt.verdict,
          guardLevel: best.computed.level,
          status: best.receipt.status,
          acceptedBy: typeof best.receipt.acceptedBy === "string" ? best.receipt.acceptedBy : null,
          familyUnverified: best.computed.familyUnverified === true
        }
      : null;

    return {
      id: task.id,
      title: typeof task.title === "string" ? task.title : "",
      status: task.status,
      statusDisplay: taskStatusDisplay(task, receiptList, evidenceList, runList),
      authorMarkedDoneUnverified: taskIsAuthorMarkedDoneUnverified(task, receiptList, evidenceList, runList),
      isSeed: isSeedRow(task, "tasks"),
      evidenceCount,
      runCount,
      receiptCount: taskReceipts.length,
      receipt: bestSummary
    };
  });
}

// === Handoff draft model (the "resume across tools" view) ===================
//
// `handoff create` exists to turn the ledger into a draft handoff note so the
// next session/tool does not start from zero. This function is the HONEST CORE
// of that command: it reads the already-recorded rows and sorts each task into
// done / pending / blocked / unverified buckets using the SAME definition of
// "done" the rest of the tool enforces — a task is DONE only when it carries a
// receipt the system actually marked status "accepted". It computes NOTHING new
// about guard levels or acceptance; it only reads what receiptStatusFor already
// wrote, so a draft can never claim more than the ledger granted.
//
// The classification rule (deliberately strict, so "done" cannot overclaim):
//   - DONE: the task has >= 1 DONE-ELIGIBLE receipt — status "accepted" AND not a
//     self-declared/unverified cross-family level (familyUnverified !== true). A
//     plain `pass` with own-task evidence auto-accepts; a `pass_with_risk` only
//     reaches "accepted" after an explicit owner sign-off (see receiptStatusFor);
//     an owner-accepted pass_with_risk is Done (it does not claim cross-family, so
//     it is not familyUnverified). This is the ONLY bucket that asserts verified
//     completion.
//   - UNVERIFIED: the task has >= 1 receipt but NONE is Done-eligible — i.e. the
//     work was reviewed but the review did not clear the bar. This is where a
//     `pass_with_risk` that is still pending lands, where a receipt that cites no
//     own-task evidence (pending) lands, AND where a task whose only acceptance is
//     a SELF-DECLARED cross-family level (familyUnverified === true) lands: the
//     tool cannot verify the family, so an accepted-but-unverified-cross-family
//     receipt is NOT trusted as done — its honest reason ("re-check the family
//     identity with a real different model family") rides along in riskNotes. A task can
//     be in DONE and have OTHER non-Done-eligible receipts; those extra receipts
//     are surfaced as risk notes but do not pull the task out of DONE (its
//     genuine accepted, non-unverified receipt stands).
//   - BLOCKED: the task's own status is "blocked" (and it is not already DONE).
//   - PENDING: everything else — an open/partial/unverified-status task with no
//     accepted receipt and no blocked flag, OR a task with no receipt at all.
//     This is "still in progress / not yet reviewed".
// A task with an accepted receipt is reported as DONE regardless of its task
// status field, because the accepted receipt is the stronger, evidence-backed
// signal (the status string is author-set; acceptance is gated).
//
// `taskId` (optional) narrows the model to a single task (its bucket + a header
// note); omitted, the model covers every non-seed task. Seed rows are excluded
// by default (a draft about the shipped example helps no one) unless a seed task
// is explicitly named via taskId.
//
// Returns a plain data object (no rendering, no I/O) so it is unit-testable and
// the CLI/renderer can format it however it likes:
//   { focusTaskId, generatedFrom: { taskCount, ... },
//     done: [entry], pending: [entry], blocked: [entry], unverified: [entry],
//     learnings: [keptLearningRow], counts: {...} }
// where each `entry` is { id, title, taskStatus, receipts: [receiptView],
//   evidence: [evidenceView], runs: [runView], riskNotes: [string] }.
export function buildHandoffModel(ledgers = {}, options = {}) {
  const tasks = Array.isArray(ledgers.tasks) ? ledgers.tasks.filter(isLedgerRecord) : [];
  const evidence = Array.isArray(ledgers.evidence) ? ledgers.evidence.filter(isLedgerRecord) : [];
  const runs = Array.isArray(ledgers.runs) ? ledgers.runs.filter(isLedgerRecord) : [];
  const receipts = Array.isArray(ledgers.receipts) ? ledgers.receipts.filter(isLedgerRecord) : [];
  const learning = Array.isArray(ledgers.learning) ? ledgers.learning.filter(isLedgerRecord) : [];

  const focusTaskId = typeof options.taskId === "string" && options.taskId.length > 0 ? options.taskId : null;

  // A receipt is "accepted" iff its stored status is exactly "accepted". We do
  // NOT re-derive it from verdict here: receiptStatusFor already settled it at
  // write time (a pass_with_risk is "pending" until owner-accepted), and the
  // status string is the single source the validator also keys on. Reading it
  // (not recomputing) is what keeps the draft from disagreeing with the ledger.
  const isAcceptedReceipt = (receipt) => receipt.status === "accepted";

  // Build a per-task view, then bucket it. We keep a stable, ledger-order list.
  const selected = tasks.filter((task) => {
    if (focusTaskId) return task.id === focusTaskId;
    return !isSeedRow(task, "tasks"); // whole-workspace draft skips the example seed
  });

  const done = [];
  const pending = [];
  const blocked = [];
  const unverified = [];

  for (const task of selected) {
    const taskReceipts = receipts.filter((receipt) => receipt.taskId === task.id);
    const taskEvidence = evidence.filter((row) => row.taskId === task.id);
    const taskRuns = runs.filter((row) => row.taskId === task.id);

    const acceptedReceipts = taskReceipts.filter(isAcceptedReceipt);
    const unacceptedReceipts = taskReceipts.filter((receipt) => !isAcceptedReceipt(receipt));
    // Done-eligible = accepted AND its cross-family completion claim is TRUSTWORTHY.
    // We do NOT read the stored `receipt.familyUnverified` field to decide this:
    // that flag can be absent on an old-schema row, stripped by a hand-edit, or
    // simply never written on a hand-planted row — and an accepted L3 cross-family
    // row with the flag MISSING would then sail into Done and let a reader read a
    // self-asserted cross-family review as an independently verified completion.
    // Instead we RE-COMPUTE the level from the receipt's OWN evidence (the same
    // computeGuardLevel basis the CLI writer and the validator use), and trust the
    // DERIVED familyUnverified. Fail-safe: a receipt that rests on a cross-family
    // CLAIM is treated as unverified NO MATTER what the stored flag says (true /
    // false / missing), and routed to Unverified with an honest reason. L4 adds
    // locally reconciled execution/output evidence, but still cannot verify model
    // family identity. Accepted receipts therefore stay Done-eligible only when
    // they do not claim cross-family (e.g. an owner-accepted pass_with_risk).
    const isFamilyUnverified = (receipt) =>
      computeReceiptGuardLevel(receipt, evidence, runs).familyUnverified === true;
    const isLocallyReconciledL4 = (receipt) =>
      computeReceiptGuardLevel(receipt, evidence, runs).level === "L4";
    // The level the DRAFT must display for a receipt: the level RE-COMPUTED from the
    // receipt's own evidence, never the stored `receipt.guardLevel`. The bucketing
    // and the familyUnverified marker are already derived this way; the detail line
    // (and the risk notes) must match, or a hand-edited row that stores "L4" with
    // only L3 evidence would read "L4" in the draft text even while it sits in
    // Unverified — the stored field lying in the one place a reader actually reads.
    const displayGuardLevel = (receipt) =>
      computeReceiptGuardLevel(receipt, evidence, runs).level;
    const doneEligibleReceipts = acceptedReceipts.filter(
      (receipt) => isDoneEligibleReceipt(receipt, evidence, runs)
    );

    // Sort receipts strongest-first (highest guardLevel, then latest createdAt) so
    // the draft leads with the most load-bearing one in each section. Rank by the
    // RE-COMPUTED level (same basis as the displayed level), so a forged stored
    // "L4" cannot jump a receipt to the top of the list while displaying its real,
    // lower computed level.
    const byStrength = (a, b) => {
      const rankDelta = guardLevelRank(displayGuardLevel(b)) - guardLevelRank(displayGuardLevel(a));
      if (rankDelta !== 0) return rankDelta;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    };
    const sortedAccepted = [...acceptedReceipts].sort(byStrength);
    const sortedUnaccepted = [...unacceptedReceipts].sort(byStrength);

    const toReceiptView = (receipt) => ({
      id: receipt.id,
      verdict: receipt.verdict,
      // The RE-COMPUTED level from the receipt's own evidence, NOT the stored
      // `receipt.guardLevel`. This is the level the draft's detail line prints, so
      // it stays consistent with the bucketing/status and the familyUnverified mark
      // below — a hand-edited stored "L4" backed by only L3 evidence shows the honest
      // L3 here instead of laundering the forged level into the handoff text.
      guardLevel: displayGuardLevel(receipt),
      status: receipt.status,
      acceptedBy: typeof receipt.acceptedBy === "string" ? receipt.acceptedBy : null,
      // familyUnverified marks a SELF-DECLARED cross-family level the tool could not
      // verify — surfaced so a reader never reads such a level as independently
      // checked. DERIVED from the receipt's own evidence (not read from the stored
      // field), so a row whose stored flag is missing/stripped still shows the honest
      // mark when its computed level rests on an unverified cross-family claim.
      familyUnverified: isFamilyUnverified(receipt),
      reviewMode: typeof receipt.reviewMode === "string" ? receipt.reviewMode : null,
      levelExplanation: typeof receipt.levelExplanation === "string" ? receipt.levelExplanation : null,
      evidenceIds: Array.isArray(receipt.evidenceIds) ? receipt.evidenceIds : []
    });

    const evidenceViews = taskEvidence.map((row) => ({
      id: row.id,
      kind: typeof row.kind === "string" ? row.kind : "",
      summary: typeof row.summary === "string" ? row.summary : ""
    }));
    // Most recent run first (a draft wants the latest command + its exit code).
    const runViews = [...taskRuns]
      .sort((a, b) => String(b.finishedAt ?? b.startedAt).localeCompare(String(a.finishedAt ?? a.startedAt)))
      .map((row) => ({
        id: row.id,
        command: typeof row.command === "string" ? row.command : null,
        exitCode: Number.isInteger(row.exitCode) ? row.exitCode : null,
        status: typeof row.status === "string" ? row.status : ""
      }));

    // Risk notes: the honest "do not trust these as done" flags a reviewer must
    // see. Built from the UNACCEPTED receipts (a pass_with_risk still pending, a
    // receipt with no own-task evidence, a self-declared unverified cross-family
    // level). These appear on whatever bucket the task lands in.
    const riskNotes = [];
    for (const receipt of sortedUnaccepted) {
      if (receipt.verdict === "pass_with_risk" && receipt.status !== "accepted") {
        riskNotes.push(
          `receipt ${receipt.id}: pass_with_risk at ${displayGuardLevel(receipt)} is NOT owner-accepted (still ${receipt.status}) — the named residual risk has not been signed off.`
        );
      } else if (receipt.status === "pending") {
        riskNotes.push(
          `receipt ${receipt.id}: ${receipt.verdict} at ${displayGuardLevel(receipt)} is pending (not accepted) — treat as unverified.`
        );
      } else if (receipt.status === "rejected") {
        riskNotes.push(
          `receipt ${receipt.id}: ${receipt.verdict} at ${displayGuardLevel(receipt)} was rejected — the work did not pass review.`
        );
      }
      if (isFamilyUnverified(receipt)) {
        riskNotes.push(
          `receipt ${receipt.id}: the cross-family review at ${displayGuardLevel(receipt)} is SELF-DECLARED and unverified — re-check with a real different model family before trusting it as cross-family done.`
        );
      }
      if (isLocallyReconciledL4(receipt)) {
        riskNotes.push(
          `receipt ${receipt.id}: L4 local execution evidence is present — the cited rerun reconciles to a recorded run exec output.`
        );
      }
    }
    // A self-declared cross-family level on an ACCEPTED receipt is still worth
    // surfacing (accepted does not mean the family claim was independently
    // checked). A task that rests ONLY on such receipts is routed to Unverified
    // (see the bucketing below), so this note doubles as the honest reason it
    // is NOT reported as Done: the cross-family attribution cannot be trusted as
    // "cross-family done" until a real different model family re-checks it. L4
    // rerun reconciliation is surfaced as a separate local-execution note. The flag is DERIVED from the receipt's
    // own evidence, so a hand-planted accepted L3 cross-family row whose stored
    // familyUnverified marker is MISSING still carries this honest reason into
    // Unverified instead of dropping there silently.
    for (const receipt of sortedAccepted) {
      if (isFamilyUnverified(receipt)) {
        riskNotes.push(
          `receipt ${receipt.id}: pass · ${displayGuardLevel(receipt)} · accepted locally, but its cross-family attribution is self-declared / unverified — re-check with a real different model family before trusting it as cross-family done.`
        );
      }
      if (isLocallyReconciledL4(receipt)) {
        riskNotes.push(
          `receipt ${receipt.id}: L4 local execution evidence is present — the cited rerun reconciles to a recorded run exec output.`
        );
      }
    }
    const authorMarkedDoneUnverified = taskIsAuthorMarkedDoneUnverified(task, receipts, evidence, runs);
    if (authorMarkedDoneUnverified) {
      riskNotes.push(
        "task status is done, but there is no done-eligible accepted receipt; shown as author-marked, unverified until evidence plus an accepted receipt verify it."
      );
    }

    const entry = {
      id: task.id,
      title: typeof task.title === "string" ? task.title : "",
      taskStatus: task.status,
      taskStatusDisplay: taskStatusDisplay(task, receipts, evidence, runs),
      authorMarkedDoneUnverified,
      isSeed: isSeedRow(task, "tasks"),
      receipts: [...sortedAccepted, ...sortedUnaccepted].map(toReceiptView),
      acceptedReceipts: sortedAccepted.map(toReceiptView),
      unacceptedReceipts: sortedUnaccepted.map(toReceiptView),
      evidence: evidenceViews,
      runs: runViews,
      riskNotes
    };

    // Bucket. DONE wins on a DONE-ELIGIBLE accepted receipt (the evidence-backed
    // signal: accepted AND not a self-declared/unverified cross-family level),
    // regardless of the author-set task status. A task whose ONLY acceptances are
    // self-declared-unverified-cross-family (familyUnverified) is NOT done — it
    // routes to UNVERIFIED (with the honest reason in its riskNotes), so a reader
    // never reads a self-asserted cross-family claim as independently checked.
    // Otherwise blocked status -> BLOCKED; any other receipt -> UNVERIFIED;
    // nothing reviewed yet -> PENDING.
    if (doneEligibleReceipts.length > 0) {
      done.push(entry);
    } else if (task.status === "blocked") {
      blocked.push(entry);
    } else if (taskReceipts.length > 0) {
      // Reviewed but not Done-eligible: a pass_with_risk still pending, a pending
      // pass, a rejected receipt, OR an accepted-but-self-declared-unverified
      // cross-family receipt (accepted locally, family not verified).
      unverified.push(entry);
    } else {
      pending.push(entry);
    }
  }

  // Kept learnings (confirmed/edited) to carry forward — both standing
  // preferences (profile) and captured lessons (harvest). Proposed/dropped rows
  // are NOT carried (an un-kept guess is not a confirmed learning). One list,
  // ledger order, so the draft echoes what the user actually kept.
  const learnings = learning
    .filter((row) => isGraduatedLearningStatus(row.status))
    .map((row) => ({
      id: row.id,
      type: typeof row.type === "string" ? row.type : "",
      content: typeof row.content === "string" ? row.content : "",
      status: row.status
    }));

  return {
    focusTaskId,
    done,
    pending,
    blocked,
    unverified,
    learnings,
    counts: {
      tasksConsidered: selected.length,
      done: done.length,
      pending: pending.length,
      blocked: blocked.length,
      unverified: unverified.length
    }
  };
}

// === "Why this guard level" plain-language explanation ======================
//
// computeGuardLevel returns a `reason` phrased in terms of method/evidence
// ceilings ('review method "self" and evidence both support L1'), which does not
// tell a first-time user, in their own terms, WHAT evidence they cited and WHAT
// to add to climb a level. This turns the SAME computed inputs into one plain
// sentence: "what you cited -> the level it earned -> the concrete next step to
// the level above". It is DERIVED from the actual evidence flags (not written to
// any fixed string per level), and it NEVER claims a level higher than `level` —
// it only names the next rung and what unlocks it, so it can never mislead a user
// into thinking they earned more than the computed level.
//
// `inputs` mirrors the computeGuardLevel evidence flags plus the resolved level:
//   { level, hasCrossFamilyGuardEvidence, hasRerunOutputEvidence,
//     hasReconciledRerunEvidence, hasAuthorRunEvidence, hasAnyEvidence }
// hasReconciledRerunEvidence is the L4-grade rerun (cited via --rerun AND
// reconciled to a recorded run exec with matching output hash);
// hasRerunOutputEvidence is any rerun row. The caller passes what it actually
// computed; this function only phrases it.
export function guardLevelExplanation(inputs = {}) {
  const {
    level,
    hasCrossFamilyGuardEvidence = false,
    hasReconciledRerunEvidence = false,
    hasAuthorRunEvidence = false,
    hasRerunOutputEvidence = false,
    hasAnyEvidence = false
  } = inputs;

  // What the author actually cited, in plain words (most-load-bearing first).
  let cited;
  if (hasCrossFamilyGuardEvidence && (hasReconciledRerunEvidence || hasRerunOutputEvidence)) {
    cited = "cited a cross-family review and a rerun";
  } else if (hasCrossFamilyGuardEvidence) {
    cited = "cited a cross-family review";
  } else if (hasReconciledRerunEvidence || hasRerunOutputEvidence) {
    cited = "cited a rerun";
  } else if (hasAuthorRunEvidence) {
    cited = "cited run/output evidence";
  } else if (hasAnyEvidence) {
    cited = "cited a note (no run/rerun evidence)";
  } else {
    cited = "cited no evidence";
  }

  // The concrete next rung. Keyed on the achieved level so the advice always
  // points UP from where the receipt actually landed (never claims this level is
  // higher than it is). The "to reach LX" target is the next level the named step
  // would unlock, phrased as guidance, not a grant.
  let nextStep;
  switch (level) {
    case "L0":
      nextStep = "attach any evidence (a note, a diff, captured output) to reach L1";
      break;
    case "L1":
      nextStep = "cite run/output or a rerun (--kind output / command / test / rerun) to reach L2";
      break;
    case "L2":
      nextStep =
        "add a cross-family review (--kind cross_family_guard, naming the reviewer/family) to reach L3";
      break;
    case "L2.5":
      // A weak L3 (one tool driving a second family): a genuinely different
      // model-family review is what promotes it to a full L3.
      nextStep =
        "have a genuinely different model family review it (a cross_family_guard from a separate tool) to reach a full L3";
      break;
    case "L3":
      nextStep =
        "add a rerun reconciled to a recorded run exec (--rerun citing a run id with matching command, exit, and output) to reach L4";
      break;
    case "L4":
      // Top local-trust level — nothing higher to point at.
      nextStep = "this is the strongest local level (L4)";
      break;
    default:
      nextStep = null;
  }

  return nextStep ? `${level}: ${cited} — ${nextStep}` : `${level}: ${cited}`;
}

// === Recognized evidence kinds (advisory, NOT a closed enum) ================
//
// Evidence kind stays FREE-FORM by design (see the long note at the top of this
// file: any string is accepted, backward compatibility is a hard requirement).
// This list is the set of kinds the docs/help describe and the tool gives meaning
// to — the two load-bearing semantic kinds (cross_family_guard, rerun), the run
// kinds (output, command, test), and the generic documented kinds (note, diff,
// file). It exists ONLY so `evidence add` can WARN on an unrecognized kind (a
// likely typo like "reun" for "rerun") while still recording the row. It is NOT a
// validation gate — isRecognizedEvidenceKind is advisory; an unknown kind is
// still a valid generic evidence row.
export const KNOWN_EVIDENCE_KINDS = [
  "note",
  "diff",
  "file",
  ...RUN_EVIDENCE_KINDS, // output, command, test, rerun
  EVIDENCE_KIND_CROSS_FAMILY_GUARD
];

// True when `kind` is one of the documented/meaningful kinds above. Advisory only
// (used to warn on a probable typo); an unrecognized kind is still accepted and
// recorded as a generic evidence row.
export function isRecognizedEvidenceKind(kind) {
  return KNOWN_EVIDENCE_KINDS.includes(kind);
}

export function ledgerPath(stateDir, ledgerKey) {
  const fileName = LEDGER_FILES[ledgerKey];
  if (!fileName) throw new Error(`Unknown ledger "${ledgerKey}".`);
  return path.join(stateDir, fileName);
}

// A ledger record must be a plain JSON object ({...}). Arrays, null, strings,
// and numbers are all legal JSON but are NOT valid ledger rows: every downstream
// check reads record.id / record.status / record.taskId, which would throw a
// non-pointable TypeError on a null or a scalar. Centralizing the shape rule
// here keeps the CLI writer (via readLedger) and the validator reader on the
// same definition of "a valid record line".
export function isLedgerRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Parse a JSONL file into { records, errors }. Each record is a parsed plain
// object; each error is `{ file, line, message, kind }` for a line that is
// non-empty but either (kind "json") does not parse as JSON, or (kind "type")
// parses but is not a plain object. Blank lines are skipped (they are not data).
// A missing file yields empty records + no errors (an unused ledger is valid).
export function parseLedgerFile(file) {
  const records = [];
  const errors = [];
  if (!existsSync(file)) return { records, errors };

  const raw = readFileSync(file, "utf8");
  const lines = raw.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().length === 0) continue; // blank line: not data
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (parseError) {
      errors.push({ file, line: index + 1, message: parseError.message, kind: "json" });
      continue;
    }
    // Legal JSON but not a record object (null / array / scalar): reject with a
    // pointable error instead of letting a later record.id access crash.
    if (!isLedgerRecord(parsed)) {
      errors.push({ file, line: index + 1, message: "record must be an object", kind: "type" });
      continue;
    }
    records.push(parsed);
  }
  return { records, errors };
}

// Read all valid records from a ledger by key (throws on the first parse error,
// for command-side callers that want fail-fast on a corrupt ledger rather than a
// silent partial read).
export function readLedger(stateDir, ledgerKey) {
  const file = ledgerPath(stateDir, ledgerKey);
  const { records, errors } = parseLedgerFile(file);
  if (errors.length > 0) {
    const first = errors[0];
    // A JSON parse error keeps the "is not valid JSON (...)" wording; a type
    // error (legal JSON but not an object) carries its own message verbatim.
    const reason = first.kind === "type" ? first.message : `is not valid JSON (${first.message})`;
    throw new Error(`Corrupt ledger ${path.basename(file)}:${first.line}: ${reason}`);
  }
  return records;
}

// Append one record as a single compact JSON line. Creates the state dir if
// needed. Always writes a trailing newline so the next append starts on its own
// line (and a one-line file stays a valid single record).
export function appendLedger(stateDir, ledgerKey, record) {
  const file = ledgerPath(stateDir, ledgerKey);
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

// Rewrite a ledger from a full record array (used by run finish: read all ->
// patch the matching line -> write back). Preserves order; one record per line.
export function writeLedger(stateDir, ledgerKey, records) {
  const file = ledgerPath(stateDir, ledgerKey);
  mkdirSync(path.dirname(file), { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join("\n");
  writeFileSync(file, records.length === 0 ? "" : `${body}\n`, "utf8");
}

// Generate the next sequential id for a ledger given a one-letter prefix, by
// taking max(numeric suffix of existing ids with this prefix) + 1. Counting rows
// instead would skip an id: the synthetic seed already occupies `t0`, so a
// rows.length+1 scheme made the first real task `t2` (gap at t1) and could also
// collide after a deletion. Anchoring on the highest existing suffix yields t1
// after the t0 seed and stays gap-free / collision-resistant. Deterministic at
// runtime; never used for the committed synthetic templates (fixed ids).
export function nextId(records, prefix) {
  let max = -1;
  for (const record of records) {
    if (!isLedgerRecord(record)) continue;
    const id = record.id;
    if (typeof id !== "string" || !id.startsWith(prefix)) continue;
    const suffix = id.slice(prefix.length);
    // Only a pure run of digits is a sequential id we own (e.g. "t12"); ignore
    // anything else so a hand-edited id cannot derail the counter.
    if (!/^\d+$/.test(suffix)) continue;
    const value = Number.parseInt(suffix, 10);
    if (value > max) max = value;
  }
  return `${prefix}${max + 1}`;
}

// --- Concurrency lock (B6a-2) ----------------------------------------------
//
// The id-allocation path is read-modify-write: readLedger -> nextId(max+1) ->
// appendLedger. Two processes (e.g. parallel `task create`s) can interleave between
// the read and the append and BOTH mint the same id — a duplicate that later trips
// `check`. The CLI is synchronous (spawnSync everywhere), so we serialize the whole
// read->compute->append (and run finish's read-all->rewrite) with a short, on-disk
// MUTEX: a lock file created with O_EXCL (openSync flag 'wx'), which fails if the file
// already exists, so exactly one process holds it at a time. A loser retries with a
// small backoff until it wins or times out, and a STALE lock (left by a crashed
// process) is reclaimed once it is older than a threshold so the ledger can never
// wedge permanently.

const LOCK_RETRY_MS = 25;        // backoff between acquisition attempts
const LOCK_TIMEOUT_MS = 5000;    // give up acquiring after ~5s (then throw, never hang)
const LOCK_STALE_MS = 10000;     // a lock file older than this is treated as abandoned

// Sleep synchronously for `ms` without busy-spinning the CPU. The CLI commands are
// synchronous, so we cannot await; Atomics.wait blocks the thread on a private buffer
// that is never notified, which the runtime implements as a real timed sleep.
function sleepSync(ms) {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
}

function lockPathFor(stateDir) {
  return path.join(stateDir, ".ledger.lock");
}

// Try to create the lock file atomically. Returns the open fd on success, or null if
// it already exists (someone else holds it). Any other error propagates (e.g. a real
// permissions / disk problem should not be silently swallowed as "locked").
function tryAcquire(lockPath) {
  try {
    // 'wx' = O_CREAT | O_EXCL | O_WRONLY: create-only, fail if it already exists.
    return openSync(lockPath, "wx");
  } catch (error) {
    if (error && error.code === "EEXIST") return null; // held by someone else
    throw error;
  }
}

// If the existing lock file is older than LOCK_STALE_MS, it was almost certainly left
// by a process that died mid-critical-section; remove it so a live process can proceed.
// Returns true if a stale lock was cleared (the caller should retry immediately).
function reclaimIfStale(lockPath) {
  try {
    const age = Date.now() - statSync(lockPath).mtimeMs;
    if (age > LOCK_STALE_MS) {
      unlinkSync(lockPath);
      return true;
    }
  } catch (error) {
    // The lock vanished between the failed acquire and this stat (the holder released
    // it): that is fine — signal "retry now".
    if (error && error.code === "ENOENT") return true;
    // Any other error: do not loop forever on it.
    throw error;
  }
  return false;
}

// Run `fn` while holding the ledger lock for `stateDir`. Acquires (with backoff +
// stale reclamation), runs fn, and ALWAYS releases in finally (closes the fd + deletes
// the lock file) so a throw inside fn cannot leave a wedged lock. Throws if the lock
// cannot be acquired within LOCK_TIMEOUT_MS (a real deadlock surfaces loudly rather
// than hanging the CLI). Synchronous, matching the rest of the writer path.
export function withLedgerLock(stateDir, fn) {
  mkdirSync(stateDir, { recursive: true }); // the lock lives in stateDir; ensure it exists
  const lockPath = lockPathFor(stateDir);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let fd = null;
  for (;;) {
    fd = tryAcquire(lockPath);
    if (fd !== null) break; // acquired
    // Could not acquire: either wait and retry, or reclaim a stale lock and retry now.
    if (!reclaimIfStale(lockPath)) {
      if (Date.now() >= deadline) {
        throw new Error(`Could not acquire ledger lock (${lockPath}) within ${LOCK_TIMEOUT_MS}ms — another process may be stuck. No changes made.`);
      }
      sleepSync(LOCK_RETRY_MS);
    }
    // If reclaimIfStale() cleared a stale/vanished lock, loop straight back and retry
    // the acquire without sleeping.
  }
  try {
    return fn();
  } finally {
    // Release: close the fd, then remove the lock file. Tolerate a missing file (a
    // stale-reclaim race could have deleted it) so cleanup never throws over the result.
    try { closeSync(fd); } catch { /* fd already closed */ }
    try { unlinkSync(lockPath); } catch (error) {
      if (!(error && error.code === "ENOENT")) throw error;
    }
  }
}

// Atomically allocate the next id for `ledgerKey` and append a record, all UNDER the
// lock so two concurrent callers can never mint the same id. `buildRecord(id)` receives
// the freshly-computed id and returns the full record object to append. The ledger is
// re-read INSIDE the lock (not before it), so the id reflects every row another process
// committed while we were waiting. Returns the appended record.
export function appendWithNextId(stateDir, ledgerKey, prefix, buildRecord) {
  return withLedgerLock(stateDir, () => {
    const records = readLedger(stateDir, ledgerKey);
    const id = nextId(records, prefix);
    const record = buildRecord(id);
    appendLedger(stateDir, ledgerKey, record);
    return record;
  });
}

// Read every row of `ledgerKey`, hand them to `mutate(records)` (which returns the new
// full array), and rewrite the file — all UNDER the lock. Used by run finish's
// read-all -> patch matching line -> rewrite, so a concurrent append cannot be lost to
// the rewrite (the read and the write are serialized against other writers). `mutate`
// runs on a fresh in-lock read; its return value is what gets written.
export function rewriteLedgerUnderLock(stateDir, ledgerKey, mutate) {
  return withLedgerLock(stateDir, () => {
    const records = readLedger(stateDir, ledgerKey);
    const next = mutate(records);
    writeLedger(stateDir, ledgerKey, next);
    return next;
  });
}
