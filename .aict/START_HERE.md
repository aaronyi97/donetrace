# START_HERE - Open AI Collaboration Workspace

This workspace helps you turn messy AI work into visible state: profile, context, acceptance, guard review, handoff, and harvest.

AI productivity is a product, not a sum — this workspace gives you the factors beyond the model itself (profile, context, acceptance, guard, handoff, harvest). Why: see docs/WHY_THIS_EXISTS.md.

中文：先别背概念。先看同一段混乱输入如何被拆成可执行、可审查、可交接的文件，再复制到自己的任务。

## Start with one AI (you only need one tool to begin)

You do not need two AI tools to start. With a single AI, this workspace turns "the AI said it's done" into a result that has evidence, can be re-checked, handed off, and harvested — and that alone is most of the value. The completion-claim check routes through `mechanisms/single-tool-guard`: a fresh conversation plus an adversarial reviewer prompt, instead of trusting the same assistant that just wrote the work. This is the front door, not a downgrade.

中文：一个AI也能开始：先把"做完了"变成有证据、可复核、可交接、可沉淀的结果。

When a second, different model family is available, you can upgrade to the cross-family double guard (`mechanisms/dual-guard`) — an independent review from a different AI family that a single tool cannot give itself (it can only *claim* one — the CLI marks that self-declared and unverified). That is the ceiling, not the entry bar. Don't have a second family yet? `cookbook/bridge-to-a-second-family.md` shows how to stand one up (manual or auto) and route a review across it.

中文：有第二个模型族时，可以升级成跨族双守卫。

We do not disguise a single-tool self-review as a cross-family pass: the guard level is computed from evidence, not self-asserted. A single tool tops out at L2 (pass-with-risk), and a plain pass requires L3+ with a different model family.

中文：我们不会把单工具自审伪装成跨族通过。

## Messy input -> structured loop

Messy input:

```text
I need this task board cleaned up. Add drag-and-drop, maybe keyboard support,
make it prettier, keep tests passing, and don't rewrite too much.
```

Raw AI usually answers with a broad promise.

This workspace produces visible state instead:

```text
Context: current slice is reorder behavior; visual redesign is out of scope.
Acceptance: existing data survives; drag and keyboard reorder both need tests.
Guard: reject completion until keyboard movement has evidence.
Handoff: mouse and keyboard reorder done and tested, guard accepted; only visual polish unverified.
Harvest: long coding tasks need acceptance before implementation and guard before handoff.
```

## 10-minute path

Goal: feel the system immediately. Two ways in; pick one.

### Path 1 (recommended): run the loop on your own real task

1. Open `walkthroughs/10-minute-your-task.md` and follow its five steps.
2. You describe one real (lightly redacted) task; the AI returns a boundary card and an acceptance card, so "done" is defined before any work.
3. You let the AI do only the accepted slice and report what it changed, ran, and did not verify.
4. You open a fresh chat (ideally a different AI brand) and have it re-check the result against evidence.
5. You watch the independent re-check reject a claim the evidence does not back, on your own task.

### Path 2: watch the prepared demo first

Pick this if your task feels too sensitive to paste right now, or you want to see the flow before running it on your own work.

1. Open `walkthroughs/10-minute.md` (the demo preview) and follow its five steps.
2. It drives the prepared case `examples/ai-coding-long-task/CASE.md` and its artifacts.
3. You copy the context package, acceptance card, and execution prompt into your AI tool.
4. You run guard review before accepting the answer.
5. You watch the guard catch a false "done" the prepared case plants, then read the revised output, handoff, and harvest seed — then run Path 1 on your own task.

Expected result: you walk one complete loop (context -> acceptance -> first output -> guard -> revised -> handoff -> harvest) and get one reusable artifact.

## 30-minute path

Goal: adapt one layer to a real task.

1. Open `context/TEMPLATE.md` or `acceptance/TEMPLATE.md`.
2. Fill it for one current task using redacted, local-only material.
3. Open `adapters/` and choose the adapter for your AI tool.
4. Paste the shared contract pointer and your filled template into the tool.
5. Produce one review result or handoff note.

Expected result: one real task has a written boundary or done standard.

## 60-minute path

Goal: run one complete task loop.

1. Fill `profile/TEMPLATE.md` lightly.
2. Fill `context/TEMPLATE.md`.
3. Fill `acceptance/TEMPLATE.md`.
4. Use `prompts/guard-review.md` after the first artifact.
5. Save `handoff/TEMPLATE.md` before stopping.
6. Extract one reusable lesson with `harvest/TEMPLATE.md`.

Expected result: profile/context, acceptance, execution prompt, guard review, handoff, and harvest all exist for one task.

## What this is

- A complete local workspace you can inspect and modify.
- A set of prompts, templates, skills, adapters, and synthetic cases.
- A method for making AI collaboration resumable and reviewable.

## What this is not

- Not a hosted assistant.
- Not an autonomous agent framework.
- Not a cloud memory store.
- Not a paywall for the basic method.

## Want the AI to remind you on its own

Tired of remembering to run the guard yourself? Install the adapter into your AI tool's always-on instructions with `node bin/ai-collab.js adapters install --target <repo>` (after publish: `ai-collab adapters install --target <repo>`). It turns on restrained coaching reminders, so the AI prompts you at the key moments - define done, review a completion claim, hand off, harvest. If you only have one tool, the completion-claim check routes through `single-tool-guard` (a fresh adversarial pass in the same tool) instead of a second AI brand.

## Where to go next

- New task: start with `context/TEMPLATE.md`.
- Long task: add `acceptance/TEMPLATE.md` before execution.
- Risky output: run `guard/PROMPT.md`.
- Switching tools: use `handoff/TEMPLATE.md` plus the adapter for the next tool.
- Finished loop: write `harvest/TEMPLATE.md`.
- Want proactive nudges: run `adapters install` (one tool only -> `single-tool-guard`).

## 中文 60 分钟搭建

1. 先写一个轻量 profile：你希望 AI 怎么配合你，哪些动作必须先问。
2. 给一个真实任务写 context：目标、现状、约束、不要做什么、还缺什么证据。
3. 先写 acceptance：怎样才算做完，哪些状态必须打回。
4. 把 adapter guidance 和相关模板交给你的 AI 工具。
5. 第一版产物出来后，跑 guard review。
6. 停下来前写 handoff。
7. 最后写 harvest，把这次任务里可复用的经验留下。
