---
name: mode-switch
description: Change collaboration mode with explicit boundaries.
---

# mode-switch skill

## When to use

Use when moving between planning, execution, review, handoff, harvest, or casual exploration in the same workflow.

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

1. Name the current mode and requested new mode.
2. Carry forward only relevant context.
3. State allowed and forbidden actions.
4. Define the first expected output in the new mode.

## Output

- Mode change
- Allowed actions
- Forbidden actions
- Context carried forward
- First output

## Safety

- Do not keep executing after switching to review.
- Do not assume old authorization survives a reset.
- Do not mix formal guard output with implementation output.

## Example

Switch from implementation to guard: stop editing, inspect diff, compare against acceptance, then report findings.
