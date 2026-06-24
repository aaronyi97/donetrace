# Dual Guard

Part of the AI Collaboration Open System. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Cancel shared blind spots with structure instead of a stronger model: a guard from a different model family is the binding gate, and a same-family guard is a non-binding reference, so a fluent answer cannot be trusted just because it reads well.

## When to use

Use before you trust an artifact that another session, another tool, or another person will build on: a release candidate, a public document, a high-risk plan, a completion claim that says work is done, or any output where a wrong 'looks fine' would propagate.

## When not to use

Skip it for low-stakes, easily reversible, or already-verified work: a quick fact lookup, a one-line wording tweak, a throwaway scratch draft, or a step a human is about to fully re-check anyway. Running the full two-layer review on trivial work is pure ceremony cost, and ceremony you pay for nothing trains people to skip the review when it actually matters.

## Input shape

The artifact under review (with stable line or section references the guards can point to). The acceptance card or definition of done it claims to meet. The context boundary (goal, scope, non-goals). The verification evidence that supposedly backs the completion claim (command output, test results, a reproduced result). The list of areas the author already knows are unverified. A note of which model family drafted the artifact, so you can pick a guard from a different family for the binding pass.

## Input materials

- Artifact under review, with line numbers or section anchors so a finding can cite an exact spot, not a vibe.
- Acceptance card / definition of done: the checkable criteria the artifact claims to satisfy.
- Context boundary: goal, in-scope, and explicit non-goals, so the guards can catch scope drift.
- Verification evidence: the actual command output, test result, or reproduced behavior the completion claim rests on (or a clear note that none exists).
- Known-unverified list from the author: what they already flagged as not yet checked.
- Drafting model family: which family produced the artifact, so the binding guard can be chosen from a different family.

## Process

1. Pick a binding guard from a DIFFERENT model family than the one that drafted the artifact. It does not share the drafter's context window, recent training nudges, or eagerness to please, so it is the pass most likely to see a problem the author cannot. This is the hard gate.
2. Give the binding guard the artifact plus acceptance card, context boundary, and the evidence list. Ask it to check, in order: does each completion claim have evidence that actually backs it; does the work meet the acceptance criteria; did scope drift past the stated non-goals; is anything private leaking; what is asserted but unproven. Require every finding to point to a specific line, section, or missing piece of evidence.
3. Optionally run a same-family guard as a REFERENCE pass for a second angle (style, an alternate user path, a missed edge case). Treat its output as input only: it never substitutes for the cross-family pass and never alone clears the gate.
4. Merge by layered strictness, not by majority vote. This is not a poll. If ANY guard names a real, evidence-grounded blocker, the artifact does not pass, even if the other guard liked it. One concrete defect outweighs two fluent approvals.
5. Resolve each blocker one of two ways: fix it and re-show the evidence, or carry it explicitly as named residual risk that the human owner accepts on the record. Silent 'good enough' is not allowed.
6. Record the outcome so a later session can trust it without re-litigating: what was reviewed, which guard was binding vs reference, the findings, the fixes, the residual risk, and the next action.

## Output shape

- Verdict: one of the four standard states — pass / reject / insufficient_evidence / pass_with_risk.
- Guard level: this is the L3 path (a structured evidence pack reviewed by a different model family), so it can return pass; an L4 pass additionally requires the binding guard to have independently re-run the key evidence and shown that rerun output.
- Binding guard (cross-family) findings: each tied to a line, section, or missing evidence.
- Reference guard (same-family) findings: labeled as advisory, not gate-clearing.
- Merge decision: which findings were decision-changing and why the verdict follows from layered strictness.
- Required fixes: the concrete change each blocker needs.
- Residual risk: what stays unverified and who accepted it (a pass_with_risk needs an explicit owner sign-off, not the guard's own say-so).
- Next action: the exact next step (re-review after fix, hand off, or release).

## Pass bar (what counts as done / safe to trust)

- Every completion claim in the artifact is backed by evidence the binding guard could actually point to.
- All acceptance criteria are met, or the unmet ones are named as accepted residual risk, not hidden.
- The binding guard came from a different model family than the drafter, and its pass is on the record.
- No private material leaked and scope stayed inside the stated boundary.
- A later session could trust the result from the record alone, without re-running the whole review.

## Reject bar (what sends it back)

- A completion claim asserts more than the evidence shows (the classic 'said it was done but it was not').
- An acceptance criterion is unmet and is being quietly skipped instead of named as residual risk.
- Only a same-family reference pass was run; no cross-family binding guard cleared the gate.
- A finding points to a real, evidence-grounded defect anywhere, even if another guard approved (layered strictness overrides the 'majority liked it' instinct).
- Private detail leaks, or the work expanded past the stated non-goals.

## Common misuse

- Treating it as a vote: two approvals and one blocker get tallied as 'pass'. It is not a poll; one concrete, evidence-grounded blocker is enough to reject.
- Using two guards from the SAME model family and calling it dual-guard. Same-family reviewers tend to miss the same things; same-family passes catch fewer real problems than a cross-family pass, so without the cross-family binding guard the structure's whole point is gone.
- Letting the binding guard 'review' with no acceptance card or evidence, so it grades tone and fluency instead of checking claims against proof.
- Copying every comment from both guards into the merge instead of keeping only the decision-changing findings, which buries the real blocker in noise.
- Accepting a warning as a pass without writing down the residual risk or who accepted it, so the next session inherits a hidden gap.
- Skipping the whole mechanism on a genuinely high-stakes artifact because it 'reads fine' which is exactly the fluent-but-wrong case the cross-family guard exists to catch.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
