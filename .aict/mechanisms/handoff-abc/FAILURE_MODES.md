# Handoff A/B/C Failure Modes

DoneTrace failure checklist. Use it in a local-first workflow before trusting a mechanism run, and rewrite any public example into public-safe language.

## Failure modes

- The current-state block includes guesses dressed up as confirmed facts.
- The next-action section lists options but never marks the single first move.
- The baseline is omitted, so the receiver continues from the wrong version.

## Common misuse (operator errors that look fine but break the mechanism)

- Writing every handoff as a maximal B packet, including a two-line same-tool resume, so the heavy ceremony makes people stop writing handoffs at all.
- Letting the current-state block drift into wishful 'basically done' instead of fact, so the receiver trusts work that was never verified.
- Giving the state with no evidence and no 'unverified' label, so a guess gets inherited as a confirmed fact.
- Listing decision points and options but no single concrete next action, leaving the receiver to re-derive 'so what do I actually do first?'.
- Skipping the baseline because 'it's obvious', then a parallel edit or stale checkout makes the receiver continue on the wrong copy.
- Writing a packet that silently assumes the original chat history, so it only works for the same session it was meant to replace.

## Guard questions

1. Did this mechanism change the decision, or just add ceremony?
2. Is any private material copied instead of summarized or synthesized?
3. Are blockers, residual risks, and next actions separated?
4. Could a new session continue from this file alone?
