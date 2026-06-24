# Guard / Review Template

## Purpose

Challenge work against requirements, risks, privacy boundaries, evidence quality, and user intent before it becomes trusted output.

## When to use

Use after a draft, implementation, research answer, plan, or handoff that could mislead future work if wrong.

## Input shape

The artifact under review, acceptance card, context package, known constraints, and the specific review stance.

## Output shape

A review result with findings, severity, evidence, required fixes, and a pass or reject recommendation.

## Copy-paste prompt

Open `PROMPT.md` and paste this completed template below it.

## Blank template

### Artifact reviewed:


### Review stance:


### Acceptance source:


### Findings:


### Evidence:


### Required fixes:


### Residual risk:


### Recommendation:



## Filled synthetic example

See `EXAMPLE.synthetic.md`.

## Common failure modes

See `FAILURE_MODES.md`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Use the adapter in `../adapters/` and include the shared core contract.
