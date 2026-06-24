# Context Prompt

## Purpose

Package the task so an assistant can start from the right boundary, evidence, constraints, and unknowns without reading the whole history.

## When to use

Use at the start of any task that spans more than one message, touches files, involves judgment, or may be resumed later.

## Input shape

Goal, current state, relevant files or links, constraints, non-goals, known facts, assumptions, risks, and open questions.

## Output shape

A context package that lets another assistant continue without inventing missing background.

## Copy-paste prompt

```text
Turn this messy situation into a context package. Separate facts from assumptions. Include goal, current state, relevant artifacts, constraints, non-goals, risks, and open questions. Keep private material summarized or redacted.

Input:
[paste your redacted task material here]

Output shape:
A context package that lets another assistant continue without inventing missing background.

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
