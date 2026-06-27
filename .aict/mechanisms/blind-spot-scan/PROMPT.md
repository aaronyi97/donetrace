# Blind-Spot Scan Prompt

This prompt belongs to DoneTrace. Use it in a local-first workflow with public-safe or redacted material.

## Purpose

Surface the dead angles you cannot see from your own seat by borrowing an outside viewpoint and re-reading the discussion through it, instead of stress-testing your own logic from the inside. Your own position has a fixed line of sight: the assumptions that feel obvious, the stakeholders you have stopped picturing, the failure that is invisible precisely because it sits where you are standing. This mechanism deliberately swaps the eyes — a customer, a competitor, a domain expert, an opponent, the version of you three years out — and asks what THAT viewpoint would notice that you did not, then hands back a short list of concrete blind spots plus the one counter-question most worth sitting with.

## Copy-paste prompt

```text
Use the Blind-Spot Scan mechanism from my local DoneTrace workspace.

Purpose:
Surface the dead angles you cannot see from your own seat by borrowing an outside viewpoint and re-reading the discussion through it, instead of stress-testing your own logic from the inside. Your own position has a fixed line of sight: the assumptions that feel obvious, the stakeholders you have stopped picturing, the failure that is invisible precisely because it sits where you are standing. This mechanism deliberately swaps the eyes — a customer, a competitor, a domain expert, an opponent, the version of you three years out — and asks what THAT viewpoint would notice that you did not, then hands back a short list of concrete blind spots plus the one counter-question most worth sitting with.

Trigger:
Use it when you ask for it by name — 'scan my blind spots', 'blind spots', 'look at this from outside', 'switch the viewpoint' — or, even unprompted, right before a high-stakes or hard-to-reverse decision and when you are finalizing a plan and want a fresh angle before you commit. It is most valuable exactly when you feel most settled: a direction you have already half-decided, a plan that looks complete, a conclusion everyone in the room nodded at. The more obvious your view feels, the more a borrowed viewpoint is likely to catch something the consensus is sitting on top of.

Do not use when:
Skip it when there is no real exposure to a blind spot: a quick fact lookup, a one-line edit, a mechanical step with a single obvious answer, or a reversible call where being wrong costs almost nothing. Forcing an outside-viewpoint scan onto a trivial task is ceremony, and a viewpoint switch you run on everything trains you to wave it off on the one high-stakes decision where the dead angle actually hides. It is also not a general critique tool: if you want your own reasoning pressure-tested from the inside, that is the anti-drift partner; this mechanism specifically borrows someone else's eyes.

Input:
[paste redacted task material, context package, and acceptance card here]

Process:
1. Pick the outside viewpoint before reading anything else. If the user named one, take it; if not, auto-pick the angle most likely to expose a dead spot for THIS topic — a customer for a product or pricing call, a competitor for a strategy or positioning call, a domain expert for a technical or risk call, an opponent for an argument you are building, your-future-self for an irreversible commitment. State which viewpoint you took and why it fits, so the borrowing is explicit, not a vague 'devil's advocate'.
2. Re-read the entire discussion THROUGH that viewpoint, not through your own. This is the whole mechanism: do not evaluate the plan as yourself wearing a label — actually reason from the other seat. What does a customer who has never heard your internal rationale see first? What does a competitor hope you keep believing? What does the expert know is a solved-and-painful problem that you are treating as novel? Inhabit the line of sight, then look back at the decision from there.
3. Name what that viewpoint sees that you did not — concretely, not in the abstract. Not 'a customer might have concerns' but 'a customer lands on the pricing page, sees no annual option, and assumes the product is too early to commit to'. Each blind spot should be a specific thing visible from the borrowed seat and invisible from yours, tied to the actual situation.
4. Keep it honest pushback, never a costume that agrees. The single worst failure of this mechanism is a FAKE outside-view: a 'customer' who conveniently loves everything, a 'competitor' who is politely impressed, an 'expert' who validates your plan. A borrowed viewpoint that flatters is theater — it must genuinely challenge from that seat, surfacing what that person would actually find wrong, uncomfortable, or naive, even when it stings. If the viewpoint cannot find anything, say so plainly rather than manufacturing soft praise.
5. Stay concrete and bounded, not a vague fog of 'have you considered everything'. A short list of real, specific blind spots beats a long list of generic worries; if the borrowed viewpoint genuinely surfaces only two things, give two. Vagueness is the second-worst failure here, because 'you might be missing something' is unfalsifiable and changes nothing.
6. End with the ONE counter-question most worth thinking about — the single question, asked from the borrowed viewpoint, that would most change the decision if you sat with it honestly. Not a list of questions; the one that has the most leverage.

Output shape:
- Viewpoint borrowed: which outside seat was taken (customer / competitor / expert / opponent / you-in-3-years) and one line on why it fits this topic.
- Concrete blind spots: a short list of specific things that viewpoint sees and you did not, each tied to the actual situation rather than phrased as a generic concern.
- Why each is invisible from your seat: the one-line reason the dead angle sits exactly where you are standing, so it reads as a real blind spot and not just a critique.
- Honesty check: an explicit signal that the borrowed viewpoint genuinely challenged (or, if it truly found little, a plain statement of that) — never a flattering costume that secretly agrees.
- The one counter-question: the single highest-leverage question, asked from the borrowed viewpoint, most worth sitting with before you commit.
- Optional second angle: only if a different viewpoint would expose something the first could not, named briefly — not padded with extra viewpoints for volume.

Return:
- Decision-changing findings only
- Evidence used
- Required fixes
- Residual risk
- Next action

Pass bar (do not pass unless all hold):
- An explicit outside viewpoint was named and the scan actually reasoned FROM that seat, not as the author wearing a label.
- The blind spots are concrete and tied to the real situation, not a generic 'you might be missing something' fog.
- The borrowed viewpoint genuinely challenged — it surfaced what that person would really find wrong or naive, rather than flattering the plan from a costume.
- Each blind spot reads as something invisible from the author's own seat, with a one-line reason it hides there.
- It ends with exactly one high-leverage counter-question, not a scattershot list.

Reject bar (send back if any holds):
- The outside viewpoint secretly agrees — a 'customer' who loves everything, a 'competitor' who is impressed, an 'expert' who validates the plan: the fake outside-view that is the mechanism's worst failure.
- The viewpoint chosen is irrelevant to the topic (a generic bystander for a deep technical call), so the borrowed eyes see nothing the author could not.
- The blind spots stay vague and unfalsifiable ('have you considered all the risks?') instead of pointing at a specific, situation-tied dead angle.
- The scan is really the author critiquing their own logic with a label slapped on, never actually inhabiting the other line of sight.
- It sprawls into a long list of generic worries or many half-used viewpoints instead of a short concrete set plus the single counter-question that matters.

Rules:
- Work from provided material only.
- Keep private material local.
- Use public-safe synthetic wording for examples.
- Label assumptions and unverified claims.
```

## Full worked example

See `EXAMPLE.synthetic.md` for this prompt run from start to finish on a public-safe synthetic task.
