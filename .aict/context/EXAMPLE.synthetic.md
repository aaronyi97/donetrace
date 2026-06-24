# Context Filled Synthetic Example

## Purpose

Package the task so an assistant can start from the right boundary, evidence, constraints, and unknowns without reading the whole history.

## When to use

Use at the start of any task that spans more than one message, touches files, involves judgment, or may be resumed later.

## Input shape

Goal, current state, relevant files or links, constraints, non-goals, known facts, assumptions, risks, and open questions.

## Output shape

A context package that lets another assistant continue without inventing missing background.

## Copy-paste prompt

Use `PROMPT.md` with the synthetic input below.

## Blank template

Use `TEMPLATE.md` for your own task.

## Filled synthetic example

Goal: Prepare a public beta onboarding flow for a synthetic note app.

Current state: Landing copy exists; onboarding has not been tested.

Relevant artifacts: README draft, onboarding checklist, synthetic tester notes.

Constraints: No analytics SDK until privacy language is reviewed.

Non-goals: Payment, account recovery, enterprise SSO.

Facts: Three testers abandoned before creating a first note.

Assumptions: The first-run prompt may be too abstract.

Risks: Improving copy without testing the actual flow.

Open questions: Which first action should count as activation?

## Common failure modes

See `FAILURE_MODES.md`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this example into any tool with `../adapters/SHARED_CORE_CONTRACT.md` to see the expected shape.
