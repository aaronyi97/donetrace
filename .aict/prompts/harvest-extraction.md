# Harvest extraction

Purpose: Extract reusable knowledge, prompt fragments, and rule candidates after a loop.

## Scenario

Use after a task finishes, fails in an instructive way, or reveals a repeatable collaboration pattern.

## Input requirements

- Final artifact and review result.
- What changed the outcome.
- Reusable snippets or rules.
- What should stay case-specific.

## Operating steps

1. First ask whether anything here is worth keeping at all. If the honest answer is no, say so and stop — restraint is part of the method, not a failure of it. If the person was asked 'anything you want to keep?' and said no, do not push.
2. Extract one item per card, each card a single kind of thing — a DECISION (a choice future work should not silently reopen), a LESSON (a mistake and the rule that prevents it), a METHOD (a reusable move or prompt fragment), or a PREFERENCE (a stable way of working). Do not blend a decision, a lesson, and a method into one mushy entry; one card, one thing, so each can be trusted, found, and revisited on its own.
3. Redact as you extract, not as an afterthought: rewrite every real name, client, path, number, and raw quote into a general, public-safe form before the card is even proposed. The card must carry the lesson, never the private original. Privacy is built into the extraction step, not bolted on later.
4. Resist generalizing a single incident into a permanent rule. A one-off needs either repeated evidence or an explicit human sign-off before it becomes standing doctrine; otherwise mark it as a candidate, not a rule.
5. For a DECISION or a LESSON, record its current state honestly — still open, recorded-but-unresolved, resolved, or superseded — so a stale card is not mistaken for live truth.
6. Present every card as a candidate awaiting confirmation, with a proposed storage target and the next moment it would be reused. Nothing lands in the knowledge base until the human confirms it: the harvester stages, the human files.

## Copy-paste prompt

```text
You are helping me with harvest extraction in a local-first AI collaboration workspace.

Task: Extract reusable knowledge, prompt fragments, and rule candidates after a loop.

Trigger:
Use at the end of one loop or conversation: a task finished, failed in an instructive way, or revealed a repeatable collaboration pattern. The goal is to lift the reusable bit before it leaks away, while the context is still fresh.

Do not use when:
Skip it when nothing reusable happened: a routine answer, a trivial fix, a conversation that taught nothing a future task would want. Do not manufacture a 'lesson' to justify running the step — an invented rule is worse than no rule, because future loops will obey it. If the person had nothing they wanted to keep, stop; do not interrogate them for one.

Input:
The finished loop or conversation. The final artifact and the review result. What actually changed the outcome (the decision, the mistake, the move that worked). Any reusable snippet, prompt fragment, or candidate rule. And what should stay specific to this case and never be generalized.

Process:
1. First ask whether anything here is worth keeping at all. If the honest answer is no, say so and stop — restraint is part of the method, not a failure of it. If the person was asked 'anything you want to keep?' and said no, do not push.
2. Extract one item per card, each card a single kind of thing — a DECISION (a choice future work should not silently reopen), a LESSON (a mistake and the rule that prevents it), a METHOD (a reusable move or prompt fragment), or a PREFERENCE (a stable way of working). Do not blend a decision, a lesson, and a method into one mushy entry; one card, one thing, so each can be trusted, found, and revisited on its own.
3. Redact as you extract, not as an afterthought: rewrite every real name, client, path, number, and raw quote into a general, public-safe form before the card is even proposed. The card must carry the lesson, never the private original. Privacy is built into the extraction step, not bolted on later.
4. Resist generalizing a single incident into a permanent rule. A one-off needs either repeated evidence or an explicit human sign-off before it becomes standing doctrine; otherwise mark it as a candidate, not a rule.
5. For a DECISION or a LESSON, record its current state honestly — still open, recorded-but-unresolved, resolved, or superseded — so a stale card is not mistaken for live truth.
6. Present every card as a candidate awaiting confirmation, with a proposed storage target and the next moment it would be reused. Nothing lands in the knowledge base until the human confirms it: the harvester stages, the human files.

Output shape:
- Source: which loop or conversation this came from (public-safe).
- Cards: one item per card, each typed DECISION / LESSON / METHOD / PREFERENCE — never blended.
- Redacted form: each card already rewritten public-safe, with no private name, path, number, or raw quote.
- State (for decisions and lessons): open / recorded-unresolved / resolved / superseded.
- Candidate vs rule: whether each item is a confirmed rule or a candidate still needing evidence or sign-off.
- Do not generalize: what must stay case-specific.
- Storage target and next reuse: where each card would live and when it would next be used — all pending human confirmation.

Pass bar (do not pass unless all hold):
- Each card carries exactly one kind of thing (decision / lesson / method / preference), not a blend.
- Every card is already redacted public-safe at the moment it is proposed, carrying the lesson and not the private original.
- No single incident has been promoted to a permanent rule without repeated evidence or explicit sign-off.
- Decision and lesson cards show an honest current state, so nothing stale reads as live truth.
- All cards are staged as candidates for human confirmation; none has been filed into the knowledge base unilaterally.

Reject bar (send back if any holds):
- Everything got harvested, producing clutter instead of the few items that actually matter.
- A card blends a decision, a lesson, and a method together, so none of them can be trusted or revisited cleanly.
- A private name, path, number, or raw quote survives in a card instead of a synthetic rewrite.
- A one-off anecdote was turned into a standing rule with no repeated evidence and no sign-off.
- A card was filed straight into the knowledge base without the human confirming it, or the user was interrogated for a lesson after saying there was nothing to keep.

Rules:
- Work only from the material I provide.
- Keep private material local; use public-safe synthetic wording for examples.
- Label facts, assumptions, and unverified claims.
- Do not claim to understand my private business beyond the provided context.

Material:
[paste redacted material here]
```

## Expected output

- Source task
- Reusable knowledge
- Reusable prompts
- Decision record
- Rule candidates
- Do not generalize
- Storage target

## Counter-example

Synthetic: a release check fails because a packaged build was never smoke-tested. The wrong harvest writes one fat entry mixing the decision, the lesson, and the user's real repo path, then files it automatically. The disciplined harvest stages two separate public-safe candidate cards — a LESSON ('smoke-test the packed package in a throwaway temp directory before claiming a release is ready', state: resolved) and a METHOD (the exact temp-install command, with the private path rewritten to a generic stand-in) — keeps the private repo path out entirely, and waits for the human to confirm before anything lands. And if that same session had ended with nothing instructive, the right move would have been to say 'nothing worth keeping this round' rather than inventing a rule.

## Failure modes

- Harvesting everything and creating clutter.
- Turning one anecdote into a permanent rule.
- Saving private raw material instead of a synthetic lesson.
- Filing a card straight into the knowledge base without waiting for the human to confirm it.
- Interrogating the user for lessons when nothing this round was actually worth keeping.

## Example

From a failed release check, harvest the rule 'smoke test the packed package in a temp directory' but do not store the user's private repo path.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
