# Multi-tool collaboration

This is a fully synthetic case. It does not contain private customer material, real raw conversations, local paths, or private operational routes.

## Confusing raw input

A user starts planning in one assistant, implements in another, and reviews in a third. Each tool uses a different memory of the task.

## Likely single-agent failure

A likely single-agent answer would produce a fluent artifact from the messy request, but it would not preserve explicit context, acceptance, guard review, handoff state, and harvest learning.

## AI Collaboration OS process

1. Context package: Profile: wants one controller view and concise cross-tool handoffs. Context: synthetic static-site cleanup spread across Codex, Claude Code, and Cursor.
2. Acceptance card: Done means each tool reads the same core contract, uses the same acceptance card, and leaves a handoff note with changed artifacts.
3. Execution prompt: Tool A packages context, Tool B edits the synthetic site copy, Tool C reviews against acceptance. All tools must cite the same shared contract.
4. Guard review: Guard catches that Cursor-specific instructions duplicated rules instead of pointing to the shared contract.
5. Handoff note: Fix adapter drift by replacing duplicated rules with a pointer to SHARED_CORE_CONTRACT.md.
6. Harvest seed: Reusable pattern: adapters must be thin pointers, not six separate rule systems.

## Context package

Profile: wants one controller view and concise cross-tool handoffs. Context: synthetic static-site cleanup spread across Codex, Claude Code, and Cursor.

## Acceptance card

Done means each tool reads the same core contract, uses the same acceptance card, and leaves a handoff note with changed artifacts.

## Guard review

Guard catches that Cursor-specific instructions duplicated rules instead of pointing to the shared contract.

## Handoff note

Fix adapter drift by replacing duplicated rules with a pointer to SHARED_CORE_CONTRACT.md.

## Harvest seed

Reusable pattern: adapters must be thin pointers, not six separate rule systems.

## Before/after comparison

A raw multi-tool workflow creates rule drift. The workspace keeps a shared contract and thin adapters.

## Messy starting point

A user starts planning in one assistant, implements in another, and reviews in a third. Each tool uses a different memory of the task.

## Workspace setup

Use the adapter files to point each tool to the same shared core contract and the same context, acceptance, guard, handoff, and harvest files.

## Profile/context

Profile: wants one controller view and concise cross-tool handoffs. Context: synthetic static-site cleanup spread across Codex, Claude Code, and Cursor.

## Acceptance

Done means each tool reads the same core contract, uses the same acceptance card, and leaves a handoff note with changed artifacts.

## Execution prompt

```text
Tool A packages context, Tool B edits the synthetic site copy, Tool C reviews against acceptance. All tools must cite the same shared contract.
```

## Handoff

Fix adapter drift by replacing duplicated rules with a pointer to SHARED_CORE_CONTRACT.md.

## Harvest

Reusable pattern: adapters must be thin pointers, not six separate rule systems.

## What changes compared with a single raw AI chat

A raw multi-tool workflow creates rule drift. The workspace keeps a shared contract and thin adapters.

## Artifacts

- `artifacts/context-package.md`
- `artifacts/acceptance-card.md`
- `artifacts/execution-prompt.md`
- `artifacts/guard-review.md`
- `artifacts/handoff-note.md`
- `artifacts/harvest-seed.md`
