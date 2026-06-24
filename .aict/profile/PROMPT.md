# Profile Prompt

## Purpose

Capture stable collaboration preferences that affect how an assistant should ask, decide, challenge, summarize, and hand work back.

## When to use

Use before long tasks, recurring work, cross-tool handoffs, or any situation where tone, risk appetite, and decision rules matter.

## Input shape

A short description of the user's role, work type, preferred feedback style, constraints, review habits, and known failure patterns.

## Output shape

A compact profile card with preferences, hard boundaries, collaboration defaults, and update rules.

## Copy-paste prompt

```text
Create a profile card for this user. Extract only reusable collaboration preferences, not private secrets. Separate stable preferences from task-specific context. Return: working style, decision rules, communication preferences, hard boundaries, and what future assistants should ask before acting.

Input:
[paste your redacted task material here]

Output shape:
A compact profile card with preferences, hard boundaries, collaboration defaults, and update rules.

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
