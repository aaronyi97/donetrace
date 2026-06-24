# Guard / Review Prompt

## Purpose

Challenge work against requirements, risks, privacy boundaries, evidence quality, and user intent before it becomes trusted output.

## When to use

Use after a draft, implementation, research answer, plan, or handoff that could mislead future work if wrong.

## Input shape

The artifact under review, acceptance card, context package, known constraints, and the specific review stance.

## Output shape

A review result with findings, severity, evidence, required fixes, and a pass or reject recommendation.

## Copy-paste prompt

```text
Review this artifact against the context and acceptance card. Prioritize concrete defects, missing evidence, privacy risk, unsupported claims, and scope drift. Return findings ordered by severity with file or section references when possible.

Input:
[paste your redacted task material here]

Output shape:
A review result with findings, severity, evidence, required fixes, and a pass or reject recommendation.

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
