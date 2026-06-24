# Harvest Prompt

## Purpose

Extract reusable patterns, prompts, decisions, examples, and rule-update candidates from completed work.

## When to use

Use after a task loop, review, failed attempt, content draft, research synthesis, or repeated workflow friction.

## Input shape

Final artifact, review result, decisions made, surprising lessons, repeated pain points, and reusable snippets.

## Output shape

A harvest seed with reusable material, where to store it, and what should not be generalized.

## Copy-paste prompt

```text
Extract harvest from this completed task. Separate reusable knowledge, reusable prompt fragments, decision records, future rule candidates, and material that should stay task-specific. Do not over-generalize from one case.

Input:
[paste your redacted task material here]

Output shape:
A harvest seed with reusable material, where to store it, and what should not be generalized.

Rules:
- Keep private material local and redacted.
- Label facts and assumptions.
- If information is missing, ask at most three concrete questions.
- Make the result usable in Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
```

## Blank template

Use `TEMPLATE.md`.

## Filled synthetic example

Use `EXAMPLE.synthetic.md`.

## Common failure modes

Use `FAILURE_MODES.md`.
