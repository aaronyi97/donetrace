# Guard / Review Filled Synthetic Example

## Purpose

Challenge work against requirements, risks, privacy boundaries, evidence quality, and user intent before it becomes trusted output.

## When to use

Use after a draft, implementation, research answer, plan, or handoff that could mislead future work if wrong.

## Input shape

The artifact under review, acceptance card, context package, known constraints, and the specific review stance.

## Output shape

A review result with findings, severity, evidence, required fixes, and a pass or reject recommendation.

## Copy-paste prompt

Use `PROMPT.md` with the synthetic input below.

## Blank template

Use `TEMPLATE.md` for your own task.

## Filled synthetic example

Artifact reviewed: Onboarding checklist draft.

Review stance: First-user path and privacy review.

Acceptance source: Acceptance card dated synthetic-case-01.

Findings: P1 checklist says 'review analytics' but privacy constraint forbids adding analytics now.

Evidence: Context states no analytics SDK until privacy language is reviewed.

Required fixes: Replace analytics step with manual tester observation.

Residual risk: Still untested with a real user.

Recommendation: Reject until the flow uses privacy-safe evidence.

## Common failure modes

See `FAILURE_MODES.md`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this example into any tool with `../adapters/SHARED_CORE_CONTRACT.md` to see the expected shape.
