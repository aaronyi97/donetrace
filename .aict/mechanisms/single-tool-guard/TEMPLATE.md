# Single-Tool Guard Template

AI Collaboration Open System mechanism card. Fill this in a local-first workflow with public-safe or redacted material.

## Purpose

Give a one-model-family user — the realistic default for most solo users, who have exactly one tool — a real guard to START from, not a downgrade to settle for. With a single AI you still turn 'done' into an evidence-backed, re-checkable result. The single-tool guard runs a fresh conversation plus an adversarial reviewer prompt instead of trusting the same assistant that just wrote it. It honestly does NOT equal the cross-family binding gate: it catches fewer real problems, so the verdict is always labeled not-yet-binding, capped at L2, with the residual risk named on the record. The cross-family dual-guard is the upgrade ceiling, not the entry bar.

## Template

### Artifact under review (with line/section refs):


### Acceptance source / definition of done:


### Completion claim's evidence (or explicit 'none exists'):


### Single-family acknowledgement (only one model family available):


### Fresh conversation opened? (must be yes — do not reuse the drafting thread):


### Adversarial reviewer prompt used (default to refute, hunt missing evidence, cite specific spots):


### Findings (each cites a line/section/missing evidence):


### Guard level reached — L2 at most (single tool); a clean pass would need the cross-family L3 pack:


### Verdict — pass_with_risk / reject / insufficient_evidence (NEVER a plain pass; NEVER recorded as a passed dual-guard):


### Residual risk (what a same-family reviewer likely still missed) and who accepted it (a pass_with_risk needs an explicit owner sign-off):


### Required fixes (re-check in another fresh adversarial pass):


### Upgrade path (run a cross-family binding pass when a second family is available):



## Pass bar (tick before you trust the result)

- The verdict is at most pass_with_risk (the L2 ceiling) and is NOT recorded as a plain pass or a passed cross-family binding gate.
- Residual risk is named — what a same-family reviewer most likely still missed is on the record, not left blank.
- Any pass_with_risk has an explicit owner sign-off on the named residual risk; the guard did not mark it accepted on its own.
- Every finding is tied to a specific line or section, not a general impression.
- The adversarial frame was actually used (default-to-refute, hunt-for-missing-evidence), in a fresh conversation, not a 'looks good' rubber stamp from the original thread.
- The upgrade path is noted: a cross-family binding pass is still owed once a second, different model family is available (that is what lifts the ceiling to L3/pass).

## Reject bar (send it back if any of these is true)

- The single-family review is recorded as a plain pass or as if it cleared the binding gate (the head failure — a same-family pass dressed up as dual-guard / L3).
- A pass_with_risk is treated as accepted without an explicit owner sign-off on the residual risk.
- No residual risk is named, so the next session inherits a hidden gap and assumes more assurance than the pass actually provides.
- The reviewer only graded tone, fluency, or style instead of checking claims against evidence.
- The drafting thread was reused instead of a fresh conversation, so the assistant's just-claimed-done eagerness suppressed the objections.
- The frame was not adversarial — it was a 'take a look' that produced an agreeable 'seems fine'.

## Worked example

See `EXAMPLE.synthetic.md` for this same card filled out end to end on a public-safe synthetic task.

## Completion check

- The mechanism has a named trigger.
- The next action is concrete.
- Private details are redacted or rewritten as synthetic examples.
- The result can be handed to another AI tool without extra chat history.
