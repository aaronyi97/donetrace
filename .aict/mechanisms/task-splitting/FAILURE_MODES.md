# Task Splitting Failure Modes

DoneTrace failure checklist. Use it in a local-first workflow before trusting a mechanism run, and rewrite any public example into public-safe language.

## Failure modes

- Splitting by file extension instead of user-visible outcome.
- Starting the most interesting slice rather than the first verifiable slice.
- Deferred work is lost because it has no handoff note.

## Common misuse (operator errors that look fine but break the mechanism)

- Splitting by line count or file type ('first 200 lines to packet A') instead of by outcome, which hands each packet half a feature and guarantees a painful merge.
- Calling it split but leaving packets that reference each other ('continue from B's result'), which rebuilds the original oversized, serial task.
- Starting with the most interesting packet instead of the first one that can be verified independently, so progress cannot be confirmed before later packets pile on.
- Treating the example numbers as hard law and either over-splitting tiny tasks or refusing to split because a count was one under an arbitrary line.
- Deferring work with no revisit condition, so 'do not handle yet' quietly becomes 'never handled'.
- Skipping the self-check entirely and only reacting after the worker stalls — the whole point is to catch the oversized packet before dispatch, not after it has already collapsed.

## Guard questions

1. Did this mechanism change the decision, or just add ceremony?
2. Is any private material copied instead of summarized or synthesized?
3. Are blockers, residual risks, and next actions separated?
4. Could a new session continue from this file alone?
