# Synthetic Loop Transcript

This transcript demonstrates one complete loop using `ai-coding-long-task`.

## Goal

Show that one user can move from a messy starting point to context, acceptance, execution, guard review, handoff, and harvest without relying on a raw chat memory.

## Expected output

A complete artifact chain: context package, acceptance card, execution request, guard review result, handoff note, harvest seed, and a short comparison against single raw AI chat.

## User

A developer asks an assistant to refactor a small task board, then keeps adding bugs, design requests, accessibility requests, and test fixes across multiple sessions. Each new chat forgets which tradeoffs were rejected, whether keyboard movement is required, and which visual polish is out of scope.

## Context package

Profile: prefers direct bug risk calls, small verified steps, and no silent scope expansion. Context: synthetic task board, local-only, no auth, no deployment, existing task data must survive, keyboard accessibility matters, visual redesign is not in scope.

## Acceptance card

Done means the board preserves existing task data, supports drag and keyboard reorder, has tests for both flows, reports changed files and verification output, and leaves a handoff note listing visual polish as unverified rather than done.

## Execution request

Implement only the reorder behavior described in the acceptance card. Keep the existing data shape. Do not redesign the board. After code, report changed files, tests run, failures, and unverified areas.

## Guard review result

Guard finds that mouse reorder was tested but keyboard movement lacks evidence. It rejects completion until a keyboard reorder test exists and the handoff labels visual polish as unverified.

## Handoff note

Current state: mouse drag and keyboard arrow-key reorder are both implemented and covered by tests (2 passing), and the guard re-review accepted the fix. Completed: data shape preserved; keyboard reorder implemented and tested. Pending: only visual polish for the reorder affordance, carried as unverified. Next action: pick up the visual polish, not the keyboard work.

## Harvest seed

Reusable pattern: long coding tasks need an acceptance card before implementation, a guard pass before handoff, and an explicit unverified bucket for visual polish. Do not generalize the synthetic task board data model.

## Difference from raw chat

A raw chat produces a plausible refactor plan but loses rejected scope and unverified accessibility work. The six-layer workspace keeps the goal, done standard, review finding, next action, and reusable lesson visible.
