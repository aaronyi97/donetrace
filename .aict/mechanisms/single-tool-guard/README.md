# Single-Tool Guard

Part of the AI Collaboration Open System. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Give a one-model-family user — the realistic default for most solo users, who have exactly one tool — a real guard to START from, not a downgrade to settle for. With a single AI you still turn 'done' into an evidence-backed, re-checkable result. The single-tool guard runs a fresh conversation plus an adversarial reviewer prompt instead of trusting the same assistant that just wrote it. It honestly does NOT equal the cross-family binding gate: it catches fewer real problems, so the verdict is always labeled not-yet-binding, capped at L2, with the residual risk named on the record. The cross-family dual-guard is the upgrade ceiling, not the entry bar.

## When to use

This is the default starting point for solo users, who have exactly one tool. Use it at a completion claim when only one model family is available and you would otherwise trust the same assistant that just produced the work: a 'done, tested, shipped' claim, a deliverable about to be handed on, or any output where a wrong 'looks fine' would propagate. It is not a fallback you reach for once a cross-family setup fails — it is where most real work begins, and a single AI here already gives you an evidence-backed, re-checkable result instead of a trusted 'looks fine'.

## When not to use

Do not use it as a substitute for a cross-family pass when a second, different model family IS available — in that case run dual-guard, because the cross-family binding gate catches what same-family review cannot. Skip it entirely for low-stakes, easily reversible work a human will fully re-check anyway: a quick fact, a one-line tweak, a throwaway draft. Running an adversarial review on trivial work is ceremony, and ceremony you pay for nothing trains people to skip the review when it actually matters.

## Input shape

The artifact under review, with stable line or section references the reviewer can point to. The acceptance card or definition of done it claims to meet. The completion claim's evidence — command output, test results, a reproduced result — or an explicit note that none exists. The context boundary (goal, scope, non-goals) so the reviewer can catch scope drift. A clear acknowledgement that only one model family is available, which is why this is a single-family review and not a cross-family binding pass.

## Input materials

- Artifact under review, with line numbers or section anchors so a finding cites an exact spot, not a vibe.
- Acceptance card / definition of done: the checkable criteria the artifact claims to satisfy.
- Completion-claim evidence: the actual command output, test result, or reproduced behavior the claim rests on, or an explicit note that none exists.
- Context boundary: goal, in-scope, and explicit non-goals, so the reviewer can catch scope drift.
- Single-family acknowledgement: a stated note that only one model family is available, so the verdict is framed as not-yet-binding from the start.
- The original drafting thread is deliberately NOT reused: a fresh conversation is opened, because the original thread carries the assistant's eagerness to please and its memory of having just claimed done.

## Process

1. Open a NEW conversation. Use a fresh context — the original thread carries the assistant's eagerness to please and its memory of having just claimed done, both of which suppress the very objections you need.
2. Paste an ADVERSARIAL reviewer prompt: instruct the assistant to default to refuting the work, to hunt for missing evidence rather than confirm, and to tie every finding to a specific line or section. The frame must actually be adversarial, not 'take a look'.
3. Give it the artifact plus the acceptance card and the completion claim's evidence (or the explicit note that none exists). Ask it to check each completion claim against the evidence, whether the acceptance criteria are met, and whether scope drifted past the stated non-goals.
4. Mark the verdict explicitly as `single-family-only — cross-family binding gate NOT passed`, and name the residual risk (what a same-family reviewer is most likely to have missed). Never record this as a passed dual-guard.
5. Resolve each finding one of two ways: fix it and re-show the evidence in another fresh adversarial pass, or carry it explicitly as named residual risk the owner accepts on the record. A silent 'good enough' is not allowed here either.
6. Upgrade path: when a second, different model family becomes available, still run one cross-family binding pass. The single-tool guard is the floor, not the ceiling.

## Output shape

- Guard level: this is L2 at best (single tool, author-supplied evidence). It CANNOT reach the cross-family L3 gate, so it cannot return a plain pass.
- Verdict: one of the four standard states, but bounded by L2 — the strongest a single-tool guard may give is pass_with_risk; it must NOT be recorded as a passed dual-guard. Use reject for a real defect and insufficient_evidence when the completion claim has no evidence at all.
- Findings, each tied to a specific line or section, produced under an actually-adversarial frame (not a 'looks good' rubber stamp).
- Residual risk: what a same-family reviewer most likely still missed, named on the record.
- Owner sign-off: a pass_with_risk is not 'accepted' on the guard's say-so — a human must explicitly accept the named residual risk on the record.
- Required fixes: the concrete change each blocker needs, to be re-checked in another fresh adversarial pass.
- Acceptance record: for any finding carried rather than fixed, who accepted the residual risk.
- Upgrade note: a reminder to run one cross-family binding pass once a second, different model family is available (that is what lifts the ceiling from L2/pass_with_risk to L3/pass).

## Pass bar (what counts as done / safe to trust)

- The verdict is at most pass_with_risk (the L2 ceiling) and is NOT recorded as a plain pass or a passed cross-family binding gate.
- Residual risk is named — what a same-family reviewer most likely still missed is on the record, not left blank.
- Any pass_with_risk has an explicit owner sign-off on the named residual risk; the guard did not mark it accepted on its own.
- Every finding is tied to a specific line or section, not a general impression.
- The adversarial frame was actually used (default-to-refute, hunt-for-missing-evidence), in a fresh conversation, not a 'looks good' rubber stamp from the original thread.
- The upgrade path is noted: a cross-family binding pass is still owed once a second, different model family is available (that is what lifts the ceiling to L3/pass).

## Reject bar (what sends it back)

- The single-family review is recorded as a plain pass or as if it cleared the binding gate (the head failure — a same-family pass dressed up as dual-guard / L3).
- A pass_with_risk is treated as accepted without an explicit owner sign-off on the residual risk.
- No residual risk is named, so the next session inherits a hidden gap and assumes more assurance than the pass actually provides.
- The reviewer only graded tone, fluency, or style instead of checking claims against evidence.
- The drafting thread was reused instead of a fresh conversation, so the assistant's just-claimed-done eagerness suppressed the objections.
- The frame was not adversarial — it was a 'take a look' that produced an agreeable 'seems fine'.

## Common misuse

- Treating a same-family single review as having passed dual-guard. Same-family reviewers miss the same things; a single-tool pass catches fewer real problems, so it must always be labeled as not-yet-binding, with the residual risk on the record.
- Skipping the fresh conversation and asking the same thread that just said 'done' to review itself, where its eagerness to please buries the objections.
- Using a soft 'review this' prompt instead of an adversarial default-to-refute frame, which produces an agreeable rubber stamp rather than findings.
- Leaving the residual risk blank, so a reader of the record assumes the artifact got more assurance than a single-family pass can give.
- Reviewing against tone and fluency with no acceptance card or evidence, so the pass grades how it reads instead of whether the claims hold.
- Treating the single-tool guard as the ceiling and never running the cross-family binding pass even after a second, different model family becomes available.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
