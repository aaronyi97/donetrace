# Half-Product Review

Part of the AI Collaboration Open System. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Block confident claims when the project has docs, demos, or architecture but no runnable first experience.

## When to use

Use before release, README polish, launch copy, or any claim that a stranger can use the system.

## Input shape

README, START_HERE, CLI output, generated workspace, demo path, tests, and known gaps.

## Process

1. Inspect the first ten minutes as a user would experience them.
2. Check whether docs point to runnable artifacts.
3. Reject strategy prose that is not backed by files or commands.
4. List the smallest fixes required before public labeling.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
