# Handoff Filled Synthetic Example

## Purpose

Transfer current state, decisions, evidence, blockers, and next actions to another session or tool without replaying the whole conversation.

## When to use

Use before stopping, switching tools, delegating to another assistant, or after any work that may need continuation.

## Input shape

Goal, current status, completed work, changed files or artifacts, decisions, verification evidence, blockers, and next action.

## Output shape

A short handoff note that separates done, pending, blocked, and unverified work.

## Copy-paste prompt

Use `PROMPT.md` with the synthetic input below.

## Blank template

Use `TEMPLATE.md` for your own task.

## Filled synthetic example

Goal: Finish synthetic onboarding checklist.

Current status: Draft exists and failed guard review on privacy-safe evidence.

Completed: Context package and acceptance card are ready.

Pending: Replace analytics step with manual tester observation.

Blocked: Need owner choice on whether account creation belongs in scope.

Decisions: First loop focuses on first note creation only.

Verification evidence: Guard review found one P1 issue.

Next action: Edit checklist step 4 and rerun guard review.

## Common failure modes

See `FAILURE_MODES.md`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this example into any tool with `../adapters/SHARED_CORE_CONTRACT.md` to see the expected shape.
