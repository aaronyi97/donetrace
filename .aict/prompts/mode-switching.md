# Mode switching

Purpose: Switch an assistant between execution, review, planning, and reflection without losing boundaries.

## Scenario

Use when a conversation changes from brainstorming to implementation, from execution to review, or from review to handoff.

## Input requirements

- Current mode and requested new mode.
- Authority boundary: who may write, review, or decide.
- Current goal, acceptance card, and stop conditions.

## Operating steps

1. Confirm the old mode and new mode in plain language.
2. Carry forward only the context needed for the new mode.
3. Restate what actions are allowed and forbidden.
4. Name the first output expected in the new mode.

## Copy-paste prompt

```text
You are helping me with mode switching in a local-first AI collaboration workspace.

Task: Switch an assistant between execution, review, planning, and reflection without losing boundaries.

Scenario:
Use when a conversation changes from brainstorming to implementation, from execution to review, or from review to handoff.

Instructions:
- Work only from the material I provide.
- Follow these steps:
  1. Confirm the old mode and new mode in plain language.
  2. Carry forward only the context needed for the new mode.
  3. Restate what actions are allowed and forbidden.
  4. Name the first output expected in the new mode.
- Do not claim to understand my private business beyond the provided context.
- Return the expected output shape below.

Material:
[paste redacted material here]
```

## Expected output

- Mode change
- Allowed actions
- Forbidden actions
- Context carried forward
- First output

## Failure modes

- Continuing to execute while pretending to review.
- Losing authorization boundaries after a role switch.
- Dragging irrelevant old context into a focused task.

## Example

Switch from execution to guard review: stop editing, inspect the changed files, compare against acceptance, and report findings first.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
