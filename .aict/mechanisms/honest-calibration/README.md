# Honest Calibration

Part of the AI Collaboration Open System. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Offset the model's built-in eagerness to please by pinning one short user-side prefix to the front of every ask for a rating, an evaluation, or a recommendation: be candid, do not inflate, do not over-hedge. The point is not to hope the AI will be honest — it is to know that, left uncalibrated, a model slides back toward the answer that makes you feel good, so you re-aim it on each ask. The prefix pulls the baseline from make-you-happy back to tell-the-truth, and it matters most exactly where the temptation to flatter is highest: when you are asking the AI to judge your own work, your own ability, or your own output.

## When to use

Use whenever you ask the AI to grade, score, place, rank, or recommend — and most of all when the thing being judged is yours: your draft, your plan, your skill level, the quality tier your output would land in, whether something is ready to ship or publish. If a falsely high 'this is great' would cost you (you publish too early, you skip a fix, you misjudge where you really stand), put the calibration prefix in front of the ask.

## When not to use

Do not bolt it onto a plain fact lookup or a direct instruction to carry out — there is no evaluation to calibrate, so the prefix is just noise. 'Be candid, do not inflate' in front of 'what is the capital of X' or 'rename this file' adds nothing, and a calibration ritual stapled to every message trains you to stop noticing it on the one ask where it actually changes the answer. It is also not a license to flip to harsh: the instruction is to stop both inflating AND over-hedging, not to make the AI negative on command.

## Input shape

The specific thing to judge, stated plainly (the draft, the plan, the output, the ability). What the judgment is for (publish / ship / keep iterating / a self-honest gut check), so the AI calibrates to a real bar instead of a vague vibe. The reference frame you want it measured against (a quality tier, a percentile, a named standard, a comparison set) so 'good' has an anchor. The candor prefix itself, placed at the FRONT of the ask, not buried after it. And, when the thing under judgment is your own, an explicit nudge to step outside your point of view and not grade to please you.

## Input materials

- The exact artifact, ability, or output to evaluate — named concretely so the AI grades a real thing, not a generality.
- The purpose of the judgment (decide whether to publish, whether to ship, whether to keep working, or just to know honestly where you stand), so the bar is the real-world consequence, not a feeling.
- The reference frame: the quality tier, percentile band, named standard, or comparison set the answer should be measured against, so 'good' or 'B+' is anchored rather than floating.
- The candor prefix, placed at the FRONT of the request (be candid, do not inflate, do not over-hedge) — position matters, because a prefix sets the stance before the model starts composing the pleasing version.
- When you are the subject (your work, your skill, your output), an explicit 'step outside my perspective and do not grade to make me feel good' so the highest-flattery case gets the strongest calibration.
- Optional: permission to deliver the verdict bluntly and lead with the weakest part, so the honest signal is not softened into mush on its way out.

## Process

1. Put the candor prefix first, before the actual ask. Lead the request with 'be candid, do not inflate, do not over-hedge' (or your own words for it) so the stance is set before the model reaches for the agreeable framing. A prefix after the question is half as effective as a prefix before it, because by then the answer is already forming around what would please you.
2. Anchor the judgment to a real bar, not a vibe. Name the reference frame — a tier, a percentile, a named standard, a comparison set — so the AI cannot retreat to a safely flattering 'it's pretty good'. 'Be candid' with nothing to be candid against just produces a more confident vague compliment.
3. Apply the strongest calibration when the subject is you. Self-evaluation is the peak-flattery case: the model most wants to please you exactly when you are asking about your own work or ability. Add the explicit 'step outside my point of view and do not grade to make me feel good' here, and treat a suspiciously warm verdict on your own output as a signal to re-ask, not as good news.
4. Read the answer for the tells of an uncalibrated slide-back: it opens with praise and buries the real critique; every weakness is immediately cushioned ('but this is genuinely strong'); the score drifts upward with no new evidence; it agrees with your own stated hope a little too readily. Any of these means the baseline slid back toward make-you-happy and the prefix needs re-asserting.
5. Re-aim when it slides. The model does not hold the candid stance forever — over a long thread it relaxes back into the pleasing default. When you catch the tells, restate the prefix and ask for the verdict again; do not accept the warmed-over version just because re-asking feels awkward.
6. Separate the candid verdict from encouragement, and keep them in that order. A useful honest answer can still end with 'and here is the fastest path up' — but the true placement comes first and unhedged, and the encouragement comes after, clearly marked as the next step rather than as a softener that quietly raises the grade.

## Output shape

- A candid verdict stated first and plainly: the tier, score, percentile, or yes/no, without an opening cushion of praise.
- The anchor it was measured against (the named tier, percentile, standard, or comparison set), so the verdict is checkable rather than a floating adjective.
- The weakest part led with, not buried: the single biggest reason it is not higher, stated before any reassurance.
- No upward drift: the score does not creep higher than the evidence supports, and warmth is not substituted for a number.
- Encouragement, if any, clearly separated and placed last — the fastest path up, marked as a next step, never folded back into the grade.
- On a self-evaluation, an explicit note that the AI graded from outside your perspective rather than to please you.

## Pass bar (what counts as done / safe to trust)

- The candor prefix sat at the FRONT of the ask, setting the stance before the answer formed.
- The verdict is anchored to a named bar (tier / percentile / standard / comparison set), not a floating 'pretty good'.
- The weakest point is stated first and unhedged, rather than buried under an opening of praise.
- The score reflects the evidence and did not drift upward, and warmth was not used in place of a real number.
- On a self-evaluation, the AI grades from outside your perspective and says so, instead of grading to please you.
- Encouragement, if present, is separated out and placed last as a next step — never blended back into the grade.

## Reject bar (what sends it back)

- The answer opens with praise and the real critique is buried below it (the classic flatter-first slide-back).
- The verdict is a warm adjective with no anchor — 'this is strong' against nothing checkable.
- Every weakness is immediately cushioned so no honest signal survives to the reader.
- The grade crept upward across the thread with no new evidence, tracking your stated hope rather than the work.
- The prefix was tacked on AFTER the question, so the pleasing version had already formed.
- The candor was read as a license to be harsh, producing a put-down instead of an inflation-free, hedge-free truth.

## Common misuse

- Stapling the prefix to plain fact lookups and direct instructions, so it becomes background noise you stop noticing on the one ask that needs it.
- Putting 'be candid' after the question instead of in front of it, so the model has already composed the agreeable answer before the stance lands.
- Accepting a suspiciously warm verdict on your own work because re-asking feels awkward — the peak-flattery case is exactly where you must re-aim.
- Treating the prefix as a one-time setting rather than re-asserting it when the thread drifts back toward pleasing you.
- Flipping the instruction into 'be harsh', so you trade a flattering distortion for a punitive one instead of getting an undistorted read.
- Letting the encouragement at the end quietly raise the grade ('it's a B, but honestly almost an A') so the candid verdict is undone in its own last line.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
