---
name: acceptance
description: Define pass criteria and verification evidence.
---

# acceptance skill

## When to use

Use before any implementation, writing, research, or cleanup task where completion could otherwise be subjective.

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

1. Convert the goal into deliverables.
2. Define pass criteria a reviewer can inspect.
3. Name rejected states explicitly.
4. Attach the exact command or manual check required before completion.

## Output

- Deliverables
- Pass criteria
- Required checks
- Rejected states
- Evidence needed
- Decision needed

## Safety

- Do not accept unverified claims.
- Do not let passing tests substitute for missing user-path validation.
- Do not move acceptance after implementation.

## Example

For a first-run CLI, acceptance includes real bin command, no fallback target, clear errors, and temp install smoke.
