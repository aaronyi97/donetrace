# START_HERE

This is the repository entry point — how to start. (Different file from the workspace map: once you run `init`, the generated `./my-ai-workspace/.aict/START_HERE.md` is *your own workspace's* map. This root file gets you there; that one navigates what you built.)

Give the AI you already use a thin collaboration discipline: it has to prove a "done" claim before you trust it, let a second AI re-check it, and let you switch tools or pick up tomorrow without re-explaining the background. It treats four process diseases of AI work: the chat that drifts off-task, the AI that says it finished when it did not, output you cannot trust, and the lesson you lose by tomorrow. It does not do the work for you, it does not go online, and it is not another AI assistant.

中文：这是仓库入口（怎么开始）。注意和工作区地图不是同一个文件：你跑完 init 后，生成的 .aict/START_HERE.md 才是你自己工作区的地图——根目录这个文件带你进门，那个文件带你逛你建好的工作区。给你现有的 AI 装一套协作纪律：让它说“做完”前先自证、让另一个 AI 复核、换工具不用重讲背景。治四种病：聊跑偏、AI 假装做完、输出不敢信、经验留不住。不替你干活、不联网、不是新助手。

This system is extracted from a long-running, real AI-collaboration practice. It does not replace your judgment with automation — it makes AI work visible: define done, guard against false completion, hand off context, harvest lessons, and grow a profile that makes the next round better. AI productivity is a product, not a sum (see docs/WHY_THIS_EXISTS.md) — this gives you the factors beyond the model itself.

中文：这套体系抽取自长期真实的 AI 协作实践。它不是用自动化替你判断，而是让 AI 的工作显性化：定义“做完”、守住虚假完成、交接上下文、收割经验、积累一份让下一轮更准的画像。AI 生产力是乘法不是加法（见 docs/WHY_THIS_EXISTS.md）——这套给你模型本身之外的那些因子。

## One AI is enough to start

You do not need two tools to begin. With a single AI, the completion-claim check runs through `single-tool-guard`: a real adversarial review (a fresh conversation + a reviewer prompt) instead of trusting the same assistant that just wrote it. This is the front door, not a downgrade. Adding a second, different model family makes the re-check stronger (`dual-guard`) — an independent review a single tool cannot give itself — but it is the optional upgrade, not the entry bar. Don't have a second family yet? `.aict/cookbook/bridge-to-a-second-family.md` shows how to set one up (manual or auto). How the guard levels (L0–L4) are computed, and why a single tool's cross-family claim is marked unverified, is the honesty detail covered once you are inside the workspace and in the README's Commands section — not something you need before your first run.

中文：一个 AI 也能开始：先把"做完了"变成有证据、可复核、可交接、可沉淀的结果。有第二个不同模型族时复核更强，但那是可选升级、不是入门门槛。守卫等级（L0–L4）怎么算、为什么单工具自称的跨族复核会被标成"未验证"，是进了工作区和 README Commands 里才需要看的诚实细节，第一次跑之前不用纠结。

Start with the result, not the concept.

The source is on GitHub (CI green), but the package is not published to npm yet. Run the CLI from a clone with `node bin/ai-collab.js`. The global `ai-collab` command shown in docs only works after the package is published.

## 10 minutes

Two ways in; pick one.

**Path 1 (recommended) — run the loop on your own real task:**

```bash
node bin/ai-collab.js init --target ./my-ai-workspace
# then open in your editor — macOS: open <file> · Linux: xdg-open <file> · Windows: start <file>
#   ./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md
```

Follow the five steps in `.aict/walkthroughs/10-minute-your-task.md`. You describe one real (lightly redacted) task; the AI returns a boundary card and an acceptance card (done defined before any work); you let it do only the accepted slice; then you open a fresh chat — your own tool is enough to start, a different AI family is the optional upgrade — and have it re-check the result against evidence: it pressure-tests the "done" claim and either passes it, rejects it, or flags insufficient evidence, depending on what the evidence shows rather than the tone. This is the fast way to feel the value on work you actually care about.

**Path 2 — watch the prepared demo first** (pick this if your task feels too sensitive to paste, or you want to see the flow first):

```bash
node bin/ai-collab.js init --target ./my-ai-workspace
# then open in your editor — macOS: open <file> · Linux: xdg-open <file> · Windows: start <file>
#   ./my-ai-workspace/.aict/walkthroughs/10-minute.md
```

Follow the five steps in `.aict/walkthroughs/10-minute.md` (the demo preview). It walks you through the prepared case `examples/ai-coding-long-task/CASE.md` and its artifacts in order: context -> acceptance -> first AI output -> guard -> revised -> handoff -> harvest, then catches a false "done" the case plants. After it, run Path 1 on your own task.

Either way you should see why the system is different from a single raw AI chat: it keeps task state, acceptance, review, handoff, and reusable learning visible.

Want the AI to remind you on its own — to ping you to review every time it claims "done", instead of you remembering? Install the adapter into your tool's always-on instructions with `node bin/ai-collab.js adapters install --target <repo>`. It turns on restrained coaching reminders; if you only use one tool, the completion-claim check routes through `single-tool-guard` (a fresh adversarial pass in the same tool).

Then open `docs/open-system/00-start-here.md` in this repository if you want the full public-system explanation.

> The file paths in the next two sections live **inside the generated workspace**, not in this repo. They do not exist until you run `node bin/ai-collab.js init --target ./my-ai-workspace` (see the 10-minute path above), which writes them under `./my-ai-workspace/.aict/`. Paths below are shown relative to that `.aict/` workspace root.

## 30 minutes

Adapt one layer to a current task (run `init` first, then work inside the generated `.aict/`):

1. Fill `.aict/context/TEMPLATE.md` or `.aict/acceptance/TEMPLATE.md`.
2. Open `.aict/adapters/SHARED_CORE_CONTRACT.md`.
3. Paste the shared contract and your filled template into your AI tool.
4. Ask for one guard review or handoff note.
5. Save the artifact back into the workspace.

## 60 minutes

Run one real task through the loop (again, all paths are inside the generated `.aict/`):

1. Fill `.aict/profile/TEMPLATE.md` lightly.
2. Fill `.aict/context/TEMPLATE.md`.
3. Fill `.aict/acceptance/TEMPLATE.md`.
4. Ask your AI tool to execute only against that acceptance card.
5. Run `.aict/guard/PROMPT.md`.
6. Save `.aict/handoff/TEMPLATE.md`.
7. Save one lesson in `.aict/harvest/TEMPLATE.md`.

## What is inside `.aict`

`init` generates the `.aict/` workspace; these directories do not exist in this repo until then:

- `profile/`, `context/`, `acceptance/`, `guard/`, `handoff/`, `harvest/`
- `roles/`, `modes/`, `mechanisms/`, `examples/`, `cookbook/`, `state/`
- adapter guidance for Codex, Claude Code, Cursor, Cline, Windsurf, and Copilot

## 中文路径

先拿你自己的真实任务跑一遍，不要先读一堆概念（按上面 Path 1：`init` 后打开 `.aict/walkthroughs/10-minute-your-task.md`）。任务太敏感不方便贴、或想先看一遍流程，再走 Path 2 的演示版 `.aict/walkthroughs/10-minute.md`。你要看的不是“这个系统怎么自我介绍”，而是你自己那段混乱需求如何被拆成：目标边界、完成标准、审查意见、交接状态、可复用经验。

想让 AI 自己提醒你、每次说“做完了”都主动喊你复核，而不是你自己记着？用 `node bin/ai-collab.js adapters install --target <repo>` 把 adapter 装进工具的常驻指令，就会打开克制的提醒；只有一个工具时，完成自检会走 `single-tool-guard`（同一个工具里新开一轮对抗式复核）。
