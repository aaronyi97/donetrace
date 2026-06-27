# Feedback Absorption Ledger Prompt

This prompt belongs to DoneTrace. Use it in a local-first workflow with public-safe or redacted material.

## Purpose

Keep independent judgment alive when you are synthesizing feedback from several sources by scoring each incoming point across five tiers instead of silently rubber-stamping all of it: absorb fully, absorb and refine, absorb with a boundary, partly absorb, or reject with a reason. The trap this defends against is the controller who collects three reviews and quietly accepts everything, becoming a courier for other people's opinions; the equal-and-opposite trap is reflexively rejecting things to look independent. The ledger forces a per-item decision with a stated reason, and treats the absorb/reject ratio as an OUTCOME of honest judgment, never a target to hit.

## Copy-paste prompt

```text
Use the Feedback Absorption Ledger mechanism from my local DoneTrace workspace.

Purpose:
Keep independent judgment alive when you are synthesizing feedback from several sources by scoring each incoming point across five tiers instead of silently rubber-stamping all of it: absorb fully, absorb and refine, absorb with a boundary, partly absorb, or reject with a reason. The trap this defends against is the controller who collects three reviews and quietly accepts everything, becoming a courier for other people's opinions; the equal-and-opposite trap is reflexively rejecting things to look independent. The ledger forces a per-item decision with a stated reason, and treats the absorb/reject ratio as an OUTCOME of honest judgment, never a target to hit.

Trigger:
Use when you are the one merging feedback from more than one source into a single revision or decision: two or three reviews of the same artifact, a mix of guard verdicts plus a stakeholder's notes, several rounds of comments you have to reconcile, or any moment where 'I got a lot of feedback, now what do I actually do with it' is the real question. It is for the synthesis step, where the temptation to either accept-everything or defend-everything is highest.

Do not use when:
Skip the full ledger for a single piece of feedback you can simply act on, or a trivial note with no judgment call in it (a typo fix, an obvious correction). Scoring one unambiguous comment across five tiers is ceremony, and a ritual you run on feedback that needed no deliberation trains you to skip it on the genuinely conflicting feedback where the per-item discipline is the whole point.

Input:
[paste redacted task material, context package, and acceptance card here]

Process:
1. List every feedback item separately before deciding anything. Resist forming one overall impression of 'the feedback' — the method only works if each point gets its own row and its own verdict.
2. Score each item into exactly one of five tiers, and write the reason. (1) ABSORB FULLY: the point is right and its scope is clear — take it as-is. (2) ABSORB AND REFINE: the direction is right but you add a more precise version — keep the intent, improve the execution, and note what you added. (3) ABSORB WITH A BOUNDARY: accept it, but bound where it applies, naming the cases it should and should not cover. (4) PARTLY ABSORB: take one part and set aside or defer the rest, splitting the item into what you took and what you did not. (5) REJECT: decline it, and give an independent reason, contrary evidence, or an alternative — a reject with no reason does not count.
3. Judge substance, not source weight or vote count. Three sources making the same weak point do not outvote one strong objection; a single sharp dissent can be the item you absorb fully while the majority note gets a boundary. The ledger records what is right, not what is popular.
4. Hold the two opposite disciplines at once. You may NOT reject a sound point just to look independent or to avoid feeling like a courier; and you may NOT absorb a weak point just to avoid friction or to be agreeable. Both are failures of judgment in opposite directions, and the stated reason on each row is what keeps you honest about which one you might be slipping into.
5. Treat the ratio as a readout, not a goal. After scoring, you can look at how much you absorbed versus refined, bounded, partly took, or rejected — but that distribution is the RESULT of judging each item honestly. Never nudge an individual call to make the overall ratio look more independent or more agreeable; the moment the ratio drives a row's verdict, the ledger is corrupted.
6. Record the ledger so the synthesis is auditable. Keep the per-item tier and reason, especially for every reject and partial-absorb, so a later reviewer (or your future self) can see that each point was weighed on its merits rather than waved through or swatted away.

Output shape:
- One row per feedback item — never a merged 'I considered all the feedback' summary.
- A single tier per row: absorb fully / absorb and refine / absorb with a boundary / partly absorb / reject.
- A stated reason on every row, and specifically an independent reason, contrary evidence, or alternative on every reject and partial-absorb.
- For refine rows, what you added beyond the original; for boundary rows, where it does and does not apply; for partial rows, what was taken and what was set aside.
- The resulting absorb/reject distribution shown as an outcome readout, with an explicit note that it was not a target.
- An auditable trail: enough that a later reader can see each point was judged on its merits, not by vote count or by source weight.

Return:
- Decision-changing findings only
- Evidence used
- Required fixes
- Residual risk
- Next action

Pass bar (do not pass unless all hold):
- Every feedback item has its own row and exactly one tier — nothing is merged into a single overall impression.
- Every reject and every partial-absorb carries an independent reason, contrary evidence, or a named alternative.
- Items were judged on substance, not on how many sources said them or how senior the source was.
- Neither failure direction is present: nothing was rejected merely to look independent, nothing absorbed merely to avoid friction.
- The absorb/reject ratio is presented as an outcome of the per-item calls, with no sign that any row was bent to make the ratio look a certain way.
- The ledger is auditable: a later reader can see each point was weighed, not waved through or swatted away.

Reject bar (send back if any holds):
- The feedback was accepted wholesale — 'all good points, I'll incorporate them' — with no per-item decision (the courier failure the ledger exists to prevent).
- A point was rejected with no reason, contrary evidence, or alternative, so it cannot be told apart from reflexive defensiveness.
- Decisions tracked vote count or source seniority instead of substance (the majority note won just for being the majority).
- An individual call was nudged to make the overall ratio look more independent or more agreeable — the ratio drove the verdict.
- Sound feedback was declined specifically to avoid feeling like a rubber stamp (independence theater), or weak feedback absorbed specifically to keep the peace.
- The items were blurred into one impression, so there is no auditable trail of which point got what verdict and why.

Rules:
- Work from provided material only.
- Keep private material local.
- Use public-safe synthetic wording for examples.
- Label assumptions and unverified claims.
```

## Full worked example

See `EXAMPLE.synthetic.md` for this prompt run from start to finish on a public-safe synthetic task.
