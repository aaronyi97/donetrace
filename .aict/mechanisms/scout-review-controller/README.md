# SCOUT Review Controller

Part of DoneTrace. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Separate exploration from decision so the assistant gathers options without prematurely choosing a path.

## When to use

Use when the task is ambiguous, cross-tool, or likely to be distorted by the first plausible answer.

## Input shape

Question, known constraints, candidate paths, evidence sources, and decision deadline.

## Process

1. Scout collects candidate paths and evidence without deciding.
2. Reviewer attacks weak assumptions and missing evidence.
3. Controller selects the smallest path that changes the outcome.
4. Handoff records rejected paths so the next session does not reopen them by accident.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
