# Single-Tool Guard Synthetic Example

This is a public-safe synthetic example for the AI Collaboration Open System. It is local-first and contains no private account, customer, route, hook, or conversation material.

## Synthetic example

A solo user on one model family gets a confident 'done and tested' claim, opens a fresh conversation, and pastes an adversarial reviewer prompt. The review finds a claimed test that does not exist and ties it to the line. The verdict is recorded as `single-family-only — cross-family binding gate NOT passed`, with the residual risk (a same-family reviewer may share the drafter's blind spots) named on the record.

## Full worked example (filled end to end)

A solo developer has only one model family available. Their execution assistant returned a confident completion claim. Rather than trust the same assistant, they run Single-Tool Guard: a fresh conversation plus an adversarial reviewer prompt, with the verdict explicitly labeled as not-yet-binding.

### Artifact under review (with line/section refs)
A short completion report plus a code block from the execution assistant. The report says: "Done. I added the CSV export and a test that covers it; everything passes." The code block is pasted with line numbers so the reviewer can cite exact lines.

### Acceptance source / definition of done
AC1: a button exports the current rows to CSV. AC2: there is an automated test that fails before the change and passes after. AC3: empty-table export produces a header-only file, not a crash. AC4: existing data is untouched.

### Completion claim's evidence (or explicit 'none exists')
The report asserts 'everything passes' but pastes NO command output and NO test run. Evidence: none provided. That gap is recorded explicitly.

### Single-family acknowledgement
Only one model family is available. So this is a single-family review from the start, and the verdict will be labeled accordingly — it cannot be a cross-family binding pass.

### Fresh conversation opened?
Yes. A brand-new conversation is opened; the original drafting thread is NOT reused, because that thread just claimed 'done' and is primed to defend it.

### Adversarial reviewer prompt used
"You are an adversarial reviewer. Default to refuting this completion claim. Hunt for missing evidence. Tie every finding to a specific line or section. Do not be agreeable; if a claim lacks proof, say so."

### Findings (each cites a line/section)
- AC2 UNSUPPORTED. The pasted code shows the export function but NO test file and NO test run output. 'Added a test; everything passes' has no evidence behind it at the cited lines.
- AC3 FAIL. The export maps over the rows with no empty-table branch, so an empty table would write a malformed (or empty) file rather than a header-only file — the cited loop has no guard.
- AC1 PLAUSIBLE but unverified: the export function is present and looks correct, but with no run output it is asserted, not proven.

### Verdict
`single-family-only — cross-family binding gate NOT passed`. Reject as a completion claim: AC2 has no evidence and AC3 has a real defect. This is explicitly NOT recorded as a passed dual-guard.

### Residual risk (what a same-family reviewer likely still missed) and who accepted it
A same-family reviewer shares the drafter's blind spots, so it may have missed an issue a different model family would catch — for example a CSV-escaping bug (commas or quotes inside a cell) that neither the drafter nor this same-family reviewer flagged. The owner accepts this residual risk for now, on the record, pending a cross-family pass.

### Required fixes (re-check in another fresh adversarial pass)
1. Add the empty-table header-only branch. 2. Add the automated test and paste its fail-then-pass output. Re-review in a new adversarial conversation once both exist.

### Upgrade path
When a second, different model family becomes available, still run one cross-family binding pass — especially on the CSV-escaping risk a same-family review is most likely to share the blind spot on.

## How the mechanism changes the outcome

Without this mechanism, a single assistant can produce a smooth answer while hiding uncertainty. With this mechanism, the workflow records trigger, evidence, decision, residual risk, and next action.

## Reuse note

Copy the shape, not the synthetic facts. Adapt the template to your own redacted task.
