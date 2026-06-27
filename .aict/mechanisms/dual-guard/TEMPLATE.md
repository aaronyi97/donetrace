# Dual Guard Template

DoneTrace mechanism card. Fill this in a local-first workflow with public-safe or redacted material.

## Purpose

Cancel shared blind spots with structure instead of a stronger model: a guard from a different model family is the binding gate, and a same-family guard is a non-binding reference, so a fluent answer cannot be trusted just because it reads well.

## Template

### Artifact under review (with line/section refs):


### Acceptance source / definition of done:


### Drafting model family:


### Binding guard (different family) focus:


### Binding guard findings (each cites a line/section/missing evidence):


### Reference guard (same family) focus and findings (advisory only):


### Merge rule = layered strictness (any evidence-grounded blocker = reject; not majority vote):


### Guard level reached (L3 cross-family pack, or L4 if the binding guard re-ran the key evidence):


### Verdict (pass / reject / insufficient_evidence / pass_with_risk):


### Required fixes:


### Residual risk and who accepted it (pass_with_risk needs an explicit owner sign-off):


### Next action:



## Pass bar (tick before you trust the result)

- Every completion claim in the artifact is backed by evidence the binding guard could actually point to.
- All acceptance criteria are met, or the unmet ones are named as accepted residual risk, not hidden.
- The binding guard came from a different model family than the drafter, and its pass is on the record.
- No private material leaked and scope stayed inside the stated boundary.
- A later session could trust the result from the record alone, without re-running the whole review.

## Reject bar (send it back if any of these is true)

- A completion claim asserts more than the evidence shows (the classic 'said it was done but it was not').
- An acceptance criterion is unmet and is being quietly skipped instead of named as residual risk.
- Only a same-family reference pass was run; no cross-family binding guard cleared the gate.
- A finding points to a real, evidence-grounded defect anywhere, even if another guard approved (layered strictness overrides the 'majority liked it' instinct).
- Private detail leaks, or the work expanded past the stated non-goals.

## Worked example

See `EXAMPLE.synthetic.md` for this same card filled out end to end on a public-safe synthetic task.

## Completion check

- The mechanism has a named trigger.
- The next action is concrete.
- Private details are redacted or rewritten as synthetic examples.
- The result can be handed to another AI tool without extra chat history.
