# Acceptance card - AI coding long task

## Source case

- Case id: `ai-coding-long-task`
- Case title: AI coding long task
- Privacy status: fully synthetic
- Private material: none

## How to use

Paste this before implementation, drafting, research, or judgment work. Ask the assistant to treat these criteria as the pass/fail surface.

## Synthetic content

Done means TaskBoard can reorder tasks two ways, both proven by tests, with existing task data preserved.

1. AC1 Mouse: a pointer drag reorders a task and the new order is saved to the tasks array.
2. AC2 Keyboard: focusing a task and pressing ArrowUp or ArrowDown moves that task one slot, for accessibility (keyboard-only users must reach the same outcome as mouse users).
3. AC3 Tests: both the mouse path and the keyboard path have an automated test that fails before the feature and passes after.
4. AC4 Data: existing task ids, titles, and fields survive the reorder; no data-shape migration in this slice.
5. AC5 Scope: visual redesign is out of scope and must be reported as unverified, not done.

Reject rule: Reject if any acceptance criterion lacks evidence, or if the completion claim states more than the code and tests prove.

## Review note

Reject work that claims completion without evidence tied to this card.

## Next step

Use this card with the execution prompt and later guard review.

## Why this exists

This artifact makes the case runnable and reviewable. A raw chat can produce a smooth answer, but this file preserves the specific state needed for profile, context, acceptance, guard, handoff, and harvest work.
