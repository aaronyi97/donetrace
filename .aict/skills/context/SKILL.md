---
name: context
description: Package task context for another AI session.
---

# context skill

## When to use

Use at the beginning of multi-step work, cross-tool work, reviews, or any task that may be resumed later.

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

1. State the goal and non-goals.
2. List artifacts and evidence the next assistant should inspect.
3. Split facts, assumptions, decisions, risks, and open questions.
4. End with a single next action.

## Output

- Goal
- Current state
- Relevant artifacts
- Constraints and non-goals
- Facts versus assumptions
- Risks and open questions
- Next action

## Safety

- Summarize private material instead of copying it.
- Do not include real local paths in public examples.
- Do not hide uncertainty inside fluent narrative.

## Example

Package a messy release task into current version, failing checks, changed files, and the next verification command.
