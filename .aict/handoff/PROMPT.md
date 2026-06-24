# Handoff Prompt

## Purpose

Transfer current state, decisions, evidence, blockers, and next actions to another session or tool without replaying the whole conversation.

## When to use

Use before stopping, switching tools, delegating to another assistant, or after any work that may need continuation.

## Input shape

Goal, current status, completed work, changed files or artifacts, decisions, verification evidence, blockers, and next action.

## Output shape

A short handoff note that separates done, pending, blocked, and unverified work.

## Copy-paste prompt

```text
Create a handoff note for the next AI session. Include goal, current state, completed work, pending work, blockers, decisions, verification evidence, and the exact next action. Label unverified claims.

Input:
[paste your redacted task material here]

Output shape:
A short handoff note that separates done, pending, blocked, and unverified work.

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
