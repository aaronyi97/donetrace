# Handoff Template

## Purpose

Transfer current state, decisions, evidence, blockers, and next actions to another session or tool without replaying the whole conversation.

## When to use

Use before stopping, switching tools, delegating to another assistant, or after any work that may need continuation.

## Input shape

Goal, current status, completed work, changed files or artifacts, decisions, verification evidence, blockers, and next action.

## Output shape

A short handoff note that separates done, pending, blocked, and unverified work.

## Copy-paste prompt

Open `PROMPT.md` and paste this completed template below it.

## Blank template

### Goal:


### Current status:


### Completed:


### Pending:


### Blocked:


### Decisions:


### Verification evidence:


### Next action:



## Filled synthetic example

See `EXAMPLE.synthetic.md`.

## Common failure modes

See `FAILURE_MODES.md`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Use the adapter in `../adapters/` and include the shared core contract.
