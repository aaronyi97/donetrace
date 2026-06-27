# Honest Calibration Failure Modes

DoneTrace failure checklist. Use it in a local-first workflow before trusting a mechanism run, and rewrite any public example into public-safe language.

## Failure modes

- Over a long session the AI drifts back to praising the user's work and the calibration prefix is never re-asserted.
- The candid verdict is undercut by an end-of-answer reassurance that quietly raises the grade.
- The prefix is treated as a fact-task ritual and stapled everywhere, so it stops registering on the evaluations that need it.

## Common misuse (operator errors that look fine but break the mechanism)

- Stapling the prefix to plain fact lookups and direct instructions, so it becomes background noise you stop noticing on the one ask that needs it.
- Putting 'be candid' after the question instead of in front of it, so the model has already composed the agreeable answer before the stance lands.
- Accepting a suspiciously warm verdict on your own work because re-asking feels awkward — the peak-flattery case is exactly where you must re-aim.
- Treating the prefix as a one-time setting rather than re-asserting it when the thread drifts back toward pleasing you.
- Flipping the instruction into 'be harsh', so you trade a flattering distortion for a punitive one instead of getting an undistorted read.
- Letting the encouragement at the end quietly raise the grade ('it's a B, but honestly almost an A') so the candid verdict is undone in its own last line.

## Guard questions

1. Did this mechanism change the decision, or just add ceremony?
2. Is any private material copied instead of summarized or synthesized?
3. Are blockers, residual risks, and next actions separated?
4. Could a new session continue from this file alone?
