# 10-Minute Walkthrough (Demo preview)

This is the demo preview: it runs the loop on a prepared case so you can see the flow without pasting anything of your own. To run the same loop on your own real task, use `10-minute-your-task.md` instead (that is the recommended first run). Pick this preview if your task feels too sensitive to paste right now, or you just want to watch the shape of the loop first.

Goal: walk one AI collaboration loop end to end on the prepared TaskBoard case, and watch a guard catch a false completion claim that a single agent would have accepted.

The case: a user asks an AI to add task reordering to a TaskBoard. The AI says it added mouse and keyboard reorder with tests. The guard proves the keyboard part was never implemented. You will see context, acceptance, first output, guard review, revised output, handoff, and harvest.

Everything is local-first and synthetic. You only read and copy files; nothing is uploaded.

## Step 1 (1 min) - Open the case

Open `../examples/ai-coding-long-task/CASE.md` and read "Confusing raw input" and "Likely single-agent failure". This is the messy request and the answer a raw chat usually gives.

Expected: you can say in one line why "I will refactor, add drag, keyboard, polish, and tests" is unsafe (it mixes scope and defines no pass standard).

## Step 2 (2 min) - Set context and acceptance

Open `../examples/ai-coding-long-task/artifacts/context-package.md`, then `acceptance-card.md`. Copy both into your AI tool together with `../adapters/SHARED_CORE_CONTRACT.md`.

Expected: your tool now has five checkable acceptance criteria (AC1 mouse, AC2 keyboard, AC3 tests for both, AC4 data preserved, AC5 visual polish out of scope).

## Step 3 (2 min) - Read the first AI output

Open `../examples/ai-coding-long-task/artifacts/first-ai-output.md`. Read the completion claim, then the `TaskBoard.tsx` code block.

Expected: you can point to the defect yourself. The claim says arrow-key reorder works, but `onKeyDown` (lines 27-30 of that code block) only logs the key and never calls `moveTask`, and the test block has no keyboard test.

## Step 4 (2 min) - Run the guard review

Open `../examples/ai-coding-long-task/artifacts/guard-review.md`. Optionally paste `first-ai-output.md` plus `../guard/PROMPT.md` into a second AI tool and ask it to review against the acceptance card.

Expected: the guard returns a cause-and-effect chain, not a one-line verdict. It cites `first-ai-output.md` lines 27-30 (stub handler) and the missing keyboard test, maps them to AC2 and AC3, and returns reject. This is the line the guard checks.

## Step 5 (2 min) - Read the revised output and close the loop

Open `../examples/ai-coding-long-task/artifacts/revised-output.md`, then `handoff-note.md`, then `harvest-seed.md`.

Expected: `onKeyDown` now calls `moveTask` for ArrowUp/ArrowDown, a keyboard test was added that fails on the old stub and passes on the fix, the handoff separates done / pending / unverified (visual polish), and the harvest seed is the reusable artifact you keep: verify completion claims with code and test evidence, do not trust a fluent "done".

## Completion check

You have walked context -> acceptance -> first output -> guard -> revised -> handoff -> harvest on one case, you can name the exact line the guard pointed to, and you leave with one reusable artifact (`harvest-seed.md`) you can apply to your own next task.
