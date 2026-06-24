# Acceptance Filled Synthetic Example

## Purpose

Make success inspectable by defining observable outcomes, required artifacts, verification steps, and explicit non-acceptance conditions.

## When to use

Use before implementation, writing, research, design, cleanup, or any task where 'looks good' would be too vague.

## Input shape

Goal, expected artifacts, constraints, quality bar, verification command or manual check, and conditions that would reject the work.

## Output shape

An acceptance card that a reviewer can use to pass, reject, or request changes.

## Copy-paste prompt

Use `PROMPT.md` with the synthetic input below.

## Blank template

Use `TEMPLATE.md` for your own task.

## Filled synthetic example

Task: Create a reusable onboarding checklist for a synthetic notes app.

Deliverables: One checklist, one example run, one review note.

Pass criteria: A new user can complete first note creation without reading strategy prose.

Required checks: Run through the checklist using the synthetic case.

Rejected states: Only a theory doc exists; no concrete user path.

Evidence needed: Completed example artifact and reviewer note.

Owner decision needed: Whether to include account creation in the first loop.

## Common failure modes

See `FAILURE_MODES.md`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this example into any tool with `../adapters/SHARED_CORE_CONTRACT.md` to see the expected shape.
