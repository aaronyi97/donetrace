# Context Template

## Purpose

Package the task so an assistant can start from the right boundary, evidence, constraints, and unknowns without reading the whole history.

## When to use

Use at the start of any task that spans more than one message, touches files, involves judgment, or may be resumed later.

## Input shape

Goal, current state, relevant files or links, constraints, non-goals, known facts, assumptions, risks, and open questions.

## Output shape

A context package that lets another assistant continue without inventing missing background.

## Copy-paste prompt

Open `PROMPT.md` and paste this completed template below it.

## Blank template

### Goal:


### Current state:


### Relevant artifacts:


### Constraints:


### Non-goals:


### Facts:


### Assumptions:


### Risks:


### Open questions:



## Filled synthetic example

See `EXAMPLE.synthetic.md`.

## Common failure modes

See `FAILURE_MODES.md`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Use the adapter in `../adapters/` and include the shared core contract.
