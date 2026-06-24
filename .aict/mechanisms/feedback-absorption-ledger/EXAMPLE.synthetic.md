# Feedback Absorption Ledger Synthetic Example

This is a public-safe synthetic example for the AI Collaboration Open System. It is local-first and contains no private account, customer, route, hook, or conversation material.

## Synthetic example

A controller merging three reviews of a synthetic spec does not write 'all helpful, will incorporate'. They ledger it: reviewer A's data-shape fix is ABSORBED FULLY (right and clearly scoped); reviewer B's 'add retries everywhere' is ABSORBED WITH A BOUNDARY (yes for the network call, no for the local parse, with the reason); reviewer C's 'rename the module' is REJECTED with an independent reason (the name encodes a deliberate distinction C missed) plus an alternative comment. The resulting mix — one full, one bounded, one rejected — is reported as the outcome of judging each on its merits, explicitly not a quota the controller was aiming for.

## Full worked example (filled end to end)

A maintainer of a synthetic open-source tool gets three reviews on the same pull request and has to merge them into one revision. The instinct is to thank everyone and apply all of it. Instead they run the Feedback Absorption Ledger so the synthesis stays their own judgment.

### Artifact under revision and the bar
A pull request adding a retry wrapper to a synthetic data-fetch tool. Bar: it must be correct, must not retry non-idempotent work, and must stay readable for the next maintainer.

### Feedback items, listed separately (not merged)
Item 1 (reviewer A): 'The backoff is fixed-interval; under load this will thundering-herd. Use exponential backoff with jitter.'
Item 2 (reviewer B): 'Wrap every external call in the retry, not just the fetch — be consistent.'
Item 3 (reviewer C): 'Rename `fetchOnce` to `fetch`; the `Once` suffix is ugly.'
Item 4 (reviewer A and reviewer B, same point): 'Add a comment explaining the retry budget.'

### Item 1 — tier + reason
ABSORB AND REFINE. The direction is right (fixed interval is a real herd risk) and I add the more precise version: exponential backoff WITH a cap, so retries do not grow unbounded on a long outage. What I added beyond A's note: the cap, which A did not mention.

### Item 2 — tier + reason
ABSORB WITH A BOUNDARY. Yes for idempotent reads, NO for the write path — blindly retrying a non-idempotent write can double-apply it. Boundary stated in code and review reply: retry wraps reads only; writes are explicitly excluded with a reason.

### Item 3 — tier + reason
REJECT, with an independent reason and an alternative. `Once` is not ugliness — it encodes that the function performs exactly one attempt, which is the contract the retry wrapper depends on; renaming it to `fetch` would blur that distinction and invite someone to add a second internal retry. Alternative offered to C: if the suffix reads oddly, rename to `fetchAttempt`, which keeps the single-attempt meaning. Not rejected to look independent — rejected because the name carries information C's note would erase.

### Item 4 — tier + reason
ABSORB FULLY. Right and clearly scoped, and the fact that two reviewers raised it does not change the verdict — it would be a full absorb even as a lone note, because a retry budget is genuinely opaque without a comment. (Logged explicitly so the ledger shows substance decided it, not the vote count.)

### Discipline check (both directions)
Did I reject anything just to look independent? Checked item 3 specifically — no; the reason stands on the contract, and I offered C a real alternative. Did I absorb anything just to avoid friction? Checked item 2 — I could have just said yes to 'wrap everything' to be agreeable, but the write-path boundary is load-bearing, so it gets a boundary, not a full absorb.

### Ratio readout (outcome, not a target)
Of four items: one full, one refine, one boundary, one reject. I was not aiming for any split — this is simply what judging each point on its merits produced. If all four had been sound I would have absorbed all four; the one rejection is there because one point did not hold, not to keep a ratio looking independent.

### Auditable note
The PR revision links each change back to its ledger row, so the next maintainer can see why writes are excluded from retry and why `fetchOnce` kept its suffix — the synthesis is traceable to per-item judgment, not a wholesale 'applied all review feedback'.

## How the mechanism changes the outcome

Without this mechanism, a single assistant can produce a smooth answer while hiding uncertainty. With this mechanism, the workflow records trigger, evidence, decision, residual risk, and next action.

## Reuse note

Copy the shape, not the synthetic facts. Adapt the template to your own redacted task.
