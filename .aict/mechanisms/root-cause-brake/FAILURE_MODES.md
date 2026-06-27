# Root-Cause Brake Failure Modes

DoneTrace failure checklist. Use it in a local-first workflow before trusting a mechanism run, and rewrite any public example into public-safe language.

## Failure modes

- A third patched version goes out because nobody noticed the second block was the trip condition.
- The four questions get answered without evidence, so the named 'root cause' is just the old symptoms relabeled.
- The earlier findings are overwritten, so the across-rounds pattern that proves the real cause is lost.

## Common misuse (operator errors that look fine but break the mechanism)

- Quietly shipping 'just one more small patch' after the second block because the fix 'feels close', which is precisely the spiral the brake is built to stop.
- Filling in the four questions as a formality with no evidence, so the diagnostic theatre passes while the real cause stays unfound.
- Calling a list of surface symptoms the 'root cause', so version N+1 patches the same things again under a new name.
- Editing the earlier findings to look tidier, which erases the across-rounds pattern that is the entire point of the diagnosis.
- Tripping the brake on every minor rejection, so the team learns to ignore it and it no longer signals a genuine repeat-block.
- Treating the brake as a project freeze and stalling the work, when it is only a diagnostic stop — work resumes the moment the owner confirms the cause.

## Guard questions

1. Did this mechanism change the decision, or just add ceremony?
2. Is any private material copied instead of summarized or synthesized?
3. Are blockers, residual risks, and next actions separated?
4. Could a new session continue from this file alone?
