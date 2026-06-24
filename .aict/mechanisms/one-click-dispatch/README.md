# One-Click Dispatch

Part of the AI Collaboration Open System. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Turn a messy task into a compact work packet another AI tool can execute without inheriting the whole chat.

## When to use

Use when handing a task from a controller session to Codex, Claude Code, Cursor, Cline, Windsurf, or Copilot.

## Input shape

Goal, files or artifacts, acceptance card, allowed actions, forbidden actions, and expected return shape.

## Process

1. Package only the state required to act.
2. State authority: read-only, write allowed, review-only, or handoff-only.
3. Attach acceptance and stop conditions.
4. Require the worker to return changed artifacts, verification evidence, blockers, and unverified claims.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
