# Feedback Absorption Ledger

Part of DoneTrace. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Keep independent judgment alive when you are synthesizing feedback from several sources by scoring each incoming point across five tiers instead of silently rubber-stamping all of it: absorb fully, absorb and refine, absorb with a boundary, partly absorb, or reject with a reason. The trap this defends against is the controller who collects three reviews and quietly accepts everything, becoming a courier for other people's opinions; the equal-and-opposite trap is reflexively rejecting things to look independent. The ledger forces a per-item decision with a stated reason, and treats the absorb/reject ratio as an OUTCOME of honest judgment, never a target to hit.

## When to use

Use when you are the one merging feedback from more than one source into a single revision or decision: two or three reviews of the same artifact, a mix of guard verdicts plus a stakeholder's notes, several rounds of comments you have to reconcile, or any moment where 'I got a lot of feedback, now what do I actually do with it' is the real question. It is for the synthesis step, where the temptation to either accept-everything or defend-everything is highest.

## When not to use

Skip the full ledger for a single piece of feedback you can simply act on, or a trivial note with no judgment call in it (a typo fix, an obvious correction). Scoring one unambiguous comment across five tiers is ceremony, and a ritual you run on feedback that needed no deliberation trains you to skip it on the genuinely conflicting feedback where the per-item discipline is the whole point.

## Input shape

Every incoming feedback item, kept as separate line items rather than blurred into one impression (so each can get its own decision). For each, enough of the original to judge it on its merits — what was said, by whom, and the reason behind it if given. The artifact or decision the feedback is about, and the bar it is being held to, so 'absorb' or 'reject' is measured against something. Your own read on each, because the ledger records YOUR judgment, not a vote tally. And a clear understanding that the final ratio is whatever honest per-item judgment produces — you are not aiming for a number.

## Input materials

- The full set of feedback items, listed separately — one row per point, not a single merged blob, because the method's whole value is a per-item decision.
- For each item: what was actually said, the source, and the stated reason if there is one, so you judge the substance instead of the loudest voice.
- The artifact or decision under revision and the bar it must meet, so each absorb/refine/reject call is measured against a real standard.
- Your own independent read on each item — this is a judgment ledger, not a poll; agreement among sources does not auto-win and a lone dissent is not auto-dismissed.
- An explicit reason attached to every reject and every partial-absorb, because an unexplained rejection is indistinguishable from defensiveness.
- A clear stance going in that the absorb/reject ratio is an outcome of honest judgment, not a quota — you are forbidden both from rejecting to look independent and from accepting to avoid friction.

## Process

1. List every feedback item separately before deciding anything. Resist forming one overall impression of 'the feedback' — the method only works if each point gets its own row and its own verdict.
2. Score each item into exactly one of five tiers, and write the reason. (1) ABSORB FULLY: the point is right and its scope is clear — take it as-is. (2) ABSORB AND REFINE: the direction is right but you add a more precise version — keep the intent, improve the execution, and note what you added. (3) ABSORB WITH A BOUNDARY: accept it, but bound where it applies, naming the cases it should and should not cover. (4) PARTLY ABSORB: take one part and set aside or defer the rest, splitting the item into what you took and what you did not. (5) REJECT: decline it, and give an independent reason, contrary evidence, or an alternative — a reject with no reason does not count.
3. Judge substance, not source weight or vote count. Three sources making the same weak point do not outvote one strong objection; a single sharp dissent can be the item you absorb fully while the majority note gets a boundary. The ledger records what is right, not what is popular.
4. Hold the two opposite disciplines at once. You may NOT reject a sound point just to look independent or to avoid feeling like a courier; and you may NOT absorb a weak point just to avoid friction or to be agreeable. Both are failures of judgment in opposite directions, and the stated reason on each row is what keeps you honest about which one you might be slipping into.
5. Treat the ratio as a readout, not a goal. After scoring, you can look at how much you absorbed versus refined, bounded, partly took, or rejected — but that distribution is the RESULT of judging each item honestly. Never nudge an individual call to make the overall ratio look more independent or more agreeable; the moment the ratio drives a row's verdict, the ledger is corrupted.
6. Record the ledger so the synthesis is auditable. Keep the per-item tier and reason, especially for every reject and partial-absorb, so a later reviewer (or your future self) can see that each point was weighed on its merits rather than waved through or swatted away.

## Output shape

- One row per feedback item — never a merged 'I considered all the feedback' summary.
- A single tier per row: absorb fully / absorb and refine / absorb with a boundary / partly absorb / reject.
- A stated reason on every row, and specifically an independent reason, contrary evidence, or alternative on every reject and partial-absorb.
- For refine rows, what you added beyond the original; for boundary rows, where it does and does not apply; for partial rows, what was taken and what was set aside.
- The resulting absorb/reject distribution shown as an outcome readout, with an explicit note that it was not a target.
- An auditable trail: enough that a later reader can see each point was judged on its merits, not by vote count or by source weight.

## Pass bar (what counts as done / safe to trust)

- Every feedback item has its own row and exactly one tier — nothing is merged into a single overall impression.
- Every reject and every partial-absorb carries an independent reason, contrary evidence, or a named alternative.
- Items were judged on substance, not on how many sources said them or how senior the source was.
- Neither failure direction is present: nothing was rejected merely to look independent, nothing absorbed merely to avoid friction.
- The absorb/reject ratio is presented as an outcome of the per-item calls, with no sign that any row was bent to make the ratio look a certain way.
- The ledger is auditable: a later reader can see each point was weighed, not waved through or swatted away.

## Reject bar (what sends it back)

- The feedback was accepted wholesale — 'all good points, I'll incorporate them' — with no per-item decision (the courier failure the ledger exists to prevent).
- A point was rejected with no reason, contrary evidence, or alternative, so it cannot be told apart from reflexive defensiveness.
- Decisions tracked vote count or source seniority instead of substance (the majority note won just for being the majority).
- An individual call was nudged to make the overall ratio look more independent or more agreeable — the ratio drove the verdict.
- Sound feedback was declined specifically to avoid feeling like a rubber stamp (independence theater), or weak feedback absorbed specifically to keep the peace.
- The items were blurred into one impression, so there is no auditable trail of which point got what verdict and why.

## Common misuse

- Collapsing the items into one 'I took the feedback on board' summary, which is exactly the rubber-stamp the ledger is built to stop.
- Setting a target ratio ('I should reject about a third to stay independent') and then bending individual calls to hit it — the ratio is an outcome, never a goal.
- Rejecting a sound point to perform independence, trading the courier failure for an equal-and-opposite defensiveness.
- Absorbing a weak point to avoid friction with the source, then backfilling a reason that does not really hold.
- Counting votes — letting three echoes of the same shallow note outweigh one strong objection because three feels like more.
- Leaving rejects and partials without a stated reason, so the synthesis cannot be audited and looks identical to swatting feedback away.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
