# Do Not Handle Yet

Part of DoneTrace. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Protect the main line by explicitly parking tempting but lower-priority work.

## When to use

Use when a task reveals adjacent bugs, polish ideas, product questions, or architecture tangents.

## Input shape

Main goal, current slice, tempting adjacent item, risk if handled now, and revisit condition.

## Process

1. Name the current slice and completion standard.
2. Write the adjacent item in a parking note.
3. Explain why handling it now would harm the main line.
4. Define when to revisit it.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
