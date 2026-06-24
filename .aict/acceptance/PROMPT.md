# Acceptance Prompt

## Purpose

Make success inspectable by defining observable outcomes, required artifacts, verification steps, and explicit non-acceptance conditions.

## When to use

Use before implementation, writing, research, design, cleanup, or any task where 'looks good' would be too vague.

## Input shape

Goal, expected artifacts, constraints, quality bar, verification command or manual check, and conditions that would reject the work.

## Output shape

An acceptance card that a reviewer can use to pass, reject, or request changes.

## Copy-paste prompt

```text
Write an acceptance card for this task. Define concrete deliverables, pass criteria, required checks, rejected states, and evidence needed before claiming completion. Do not rely on vibes or intent.

Input:
[paste your redacted task material here]

Output shape:
An acceptance card that a reviewer can use to pass, reject, or request changes.

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
