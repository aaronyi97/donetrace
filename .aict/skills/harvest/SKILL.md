---
name: harvest
description: Extract reusable knowledge from finished loops.
---

# harvest skill

## When to use

Use after a task finishes or fails in a way that teaches a reusable workflow pattern.

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

1. Identify what changed the outcome.
2. Separate reusable knowledge, prompt fragments, decisions, and rule candidates.
3. Mark material that must stay case-specific.
4. Choose a storage target and future reuse trigger.

## Output

- Source task
- Reusable knowledge
- Reusable prompts
- Decision record
- Rule candidates
- Do not generalize
- Next reuse

## Safety

- Do not harvest private source material.
- Do not create a universal rule from one example.
- Do not keep clutter that has no future use.

## Example

Harvest the lesson that force overwrite needs backup evidence, while excluding the user's actual workspace path.
