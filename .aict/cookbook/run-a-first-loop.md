# Run a First Loop

A do-it recipe: run one complete AI collaboration loop end to end on your own real (lightly redacted) task, and watch a guard catch a false completion claim that a single agent would have accepted. This is the recipe; `../walkthroughs/10-minute-your-task.md` is the operation card for that real-task run. The walkthrough says "press these buttons in this order"; this recipe says "here is why each step exists, and here is how to adapt it to whatever you are actually working on." If you would rather watch the loop on a prepared example before pointing it at your own work, the synthetic case is the optional "look first" track — see the box below.

> Optional "look first" track: if your task feels too sensitive to paste right now, or you just want to see the shape of the loop first, run it once on the prepared synthetic case using `../walkthroughs/10-minute.md` (the demo preview), then come back and run it on your own task with the copy-paste block below.

## When to use this

- Your first time through the system, and you want to feel the whole loop on work you actually care about.
- You can describe the loop but have never watched a guard actually reject a fluent "done".
- You are about to start a real task and want a tested prompt sequence to adapt, not a blank page.

Skip it if you have already run the loop and just need the fast operation card; go straight to `../walkthroughs/10-minute-your-task.md`.

## Prerequisites

- This workspace exists (you are reading a file inside it).
- One real task of your own you can describe in a few sentences (lightly redacted: swap private names, paths, and numbers for placeholders). No private file needs to be uploaded — a redacted description is enough.
- One AI tool you can paste into (any general chat AI, coding assistant, or command-line AI). One tool is enough for a first pass; a second tool of a different model family makes the guard step stronger but is optional.
- Five to ten minutes. Nothing is uploaded; you only read and copy local files plus your own redacted description.

## Steps

Run these five moves on your own task. (Each move maps to one shipped artifact in `../examples/ai-coding-long-task/artifacts/` — open the matching file there any time you want to see the move done once on the prepared synthetic case.)

1. Set context. Describe your task to the AI and have it write a context package: the goal in one sentence, what is in scope, and explicit non-goals. This turns a tangled request into a boundary. Reference: `context-package.md`.
2. Set acceptance. Turn that context into an acceptance card — a short numbered list of checkable "done" criteria a reviewer can verify, not a vibe. This is the step people skip and then regret. Reference: `acceptance-card.md`.
3. Produce the first output. Have the AI do only the accepted slice and report what changed, what it ran, what failed, and what it did NOT verify. Read its completion claim against the actual code or evidence — this is where a fluent "done" usually overstates the work. References: `execution-prompt.md`, `first-ai-output.md`.
4. Run the guard. Paste that output plus `../guard/PROMPT.md` into a second AI tool (or the same one in a fresh turn) and ask it to review against the acceptance card. A good guard returns a cause-and-effect chain tied to specific spots and a reject, not a one-line "looks good". Reference: `guard-review.md`.
5. Revise and close. Fix the named blocker and re-show it with evidence, then write a handoff (done / pending / unverified) and harvest one reusable lesson with all private specifics removed. References: `revised-output.md`, `handoff-note.md`, `harvest-seed.md`.

The copy-paste block below is the prompt sequence that drives exactly these five moves on your task.

## Copy-paste block

Paste these in order into your AI tool, filling the bracketed parts with your own redacted task. This is the same loop as the steps above.

```text
[1 / CONTEXT]
Help me write a context package for this task. Capture: the goal in one sentence, what is in scope, and explicit non-goals. Keep it local-first; I will not upload private material.
Task (redacted): [describe your task; replace any private name, path, or number with a placeholder]

[2 / ACCEPTANCE]
Now turn that context into an acceptance card: a short numbered list of checkable criteria that define "done". Each criterion must be something a reviewer can verify, not a vibe. Mark anything explicitly out of scope.

[3 / EXECUTION]
Do only the work the acceptance card describes. Do not expand scope. When done, report: what changed, what you ran to check it, what failed, and what you did NOT verify.

[4 / GUARD - run this in a SECOND tool, ideally a different model family]
Review the output below against the context and acceptance card. Point to concrete defects, missing evidence, privacy leaks, unsupported claims, and scope drift, each tied to a specific spot. Return findings by severity and a pass or reject. Do not approve a claim that the evidence does not back.
Output under review: [paste the step-3 output]
Acceptance card: [paste the step-2 card]

[5 / HANDOFF + HARVEST]
Write two short artifacts. Handoff: where the work is now, split into done / pending / unverified, plus the single next action and the exact baseline to start from. Harvest: one reusable lesson from this loop, written generally enough to apply to a future task, with all private specifics removed.
```

## Expected output

- A context package and an acceptance card with checkable criteria (not prose).
- A first output whose completion claim you can check against evidence.
- A guard review that names a real, line-level defect and returns reject when the claim outruns the evidence, or pass with named residual risk when it does not.
- A revised output where the named blocker is fixed and re-shown with evidence.
- A handoff that separates done / pending / unverified, and one reusable harvest lesson.

## Failure handling

- The guard just says "looks good" and finds nothing. It is probably grading tone, not claims. Re-run step 4 and force it to check each completion claim against the acceptance card and point to a specific line or a missing piece of evidence; an empty finding list is only valid if it can say what it checked.
- The first output looks perfect and you cannot spot the defect. Re-read the completion claim next to the code or evidence it rests on. The classic failure is a claim ("keyboard reorder works") that the code does not actually perform.
- You only have one AI tool. Run the guard in a fresh turn or a fresh session of the same tool. It is weaker than a second model family (same family tends to miss the same things), but far better than no guard.
- The loop feels like overhead on a tiny task. It is, for a one-line change. Use the full loop on work another session or person will build on; for throwaway work, skip it.

## Privacy note

Redact before you paste: replace real product names, file paths, customer or person names, and internal numbers with placeholders. Do not paste a private profile, raw private chat logs, or a non-public path into an external AI. The loop works on a redacted description; it does not need the private original. (If you take the optional "look first" track instead, the shipped synthetic case uploads nothing at all — there is nothing of yours to redact.)

## Next step

- Connect this loop to the AI tool you actually use day to day: `connect-a-tool.md`.
- When you receive a "done" artifact you did not produce, pressure-test it: `review-a-half-product.md`.
- Reuse the full mechanism behind step 4 on higher-stakes work: `../mechanisms/dual-guard/README.md`.
