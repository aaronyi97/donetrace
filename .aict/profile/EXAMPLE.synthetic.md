# Profile Filled Synthetic Example

## Purpose

Capture stable collaboration preferences that affect how an assistant should ask, decide, challenge, summarize, and hand work back.

## When to use

Use before long tasks, recurring work, cross-tool handoffs, or any situation where tone, risk appetite, and decision rules matter.

## Input shape

A short description of the user's role, work type, preferred feedback style, constraints, review habits, and known failure patterns.

## Output shape

A compact profile card with preferences, hard boundaries, collaboration defaults, and update rules.

## Copy-paste prompt

Use `PROMPT.md` with the synthetic input below.

## Blank template

Use `TEMPLATE.md` for your own task.

## Filled synthetic example

User role or situation: Solo product builder validating a weekend prototype.

Preferred collaboration style: Direct risk calls, short summaries, concrete next actions.

Decision rules: Prefer evidence from user behavior over elegant architecture.

Hard boundaries: Do not upload private notes or make purchasing decisions.

Review habits: Wants assumptions and unverified claims labeled.

Known failure patterns: Over-polished plans can replace real validation.

How to update this profile: Add new stable preferences only after they appear in at least two tasks.

## Common failure modes

See `FAILURE_MODES.md`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this example into any tool with `../adapters/SHARED_CORE_CONTRACT.md` to see the expected shape.
