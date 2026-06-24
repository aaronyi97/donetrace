# AI Collaboration Open System

Does your AI keep saying "done" when it is not? This is an **open-source personal AI collaboration workspace** — a thin discipline pack you drop into the AI you already use (Claude, Cursor, Codex, and others). It does not write your code and does not think for you. It does one thing: it makes your AI prove a "done" claim with evidence, gets a second AI to re-check it, and lets you switch tools or pick the work up tomorrow without re-explaining the background. Why a workspace beats a better prompt: [docs/WHY_THIS_EXISTS.md](./docs/WHY_THIS_EXISTS.md). New here? Start at [START_HERE.md](./START_HERE.md).

> Runs today from a clone (`node bin/ai-collab.js`); the npm package and global `ai-collab` command are not published yet — see [Release Status](#release-status).

中文：你的 AI 是不是老跟你说"搞定了"，其实没做完？这是一套塞进你现有 AI（Claude、Cursor、Codex 等）的开源"协作纪律包"。它不替你写代码、不替你想，只干一件事：让 AI 说"做完了"前先拿证据自证、让另一个 AI 复核一遍、让你换工具或隔天再接着干时不用重讲背景。为什么是工作区而不是提示词，见 docs/WHY_THIS_EXISTS.md；新手从 START_HERE.md 开始。

## See it in one glance

Here is the same messy request, before and after. Messy input:

```text
I need this task board cleaned up. Add drag-and-drop, maybe keyboard support,
make it prettier, keep tests passing, and don't rewrite too much. Last chat
already changed things but I forgot what.
```

Raw AI output usually says:

```text
Sure. I will refactor the board, improve drag and drop, add keyboard support,
modernize the UI, and update tests.
```

This workspace turns the same input into:

```text
Context: current slice is reorder behavior; visual redesign is out of scope.
Acceptance: existing data survives; drag and keyboard reorder both need tests.
Guard: reject completion until keyboard movement has evidence.
Handoff: mouse and keyboard reorder done and tested, guard accepted; only visual polish unverified.
Harvest: long coding tasks need acceptance before implementation and guard before handoff.
```

That is the value: less smooth guessing, more visible state. This is a local AI collaboration workspace made of plain files, not a prompt pack: it carries task state (context, acceptance, guard, handoff, harvest), not just better one-off instructions.

## Run it in 2 minutes

One main path. Clone, init a workspace, then open the 10-minute walkthrough — that is the whole on-ramp.

> The package is not on npm yet, so the commands below use the local CLI entry `node bin/ai-collab.js`. After the npm package ships, the same commands work under the global `ai-collab` name (e.g. `ai-collab init ...`); until then, keep using `node bin/ai-collab.js`.

```bash
git clone https://github.com/aaronyi97/ai-collab-open-system.git
cd ai-collab-open-system
node bin/ai-collab.js init --target ./my-ai-workspace
```

Now open `./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md`. In 10 minutes you will feel three things on your own task: **the AI defines *done* before it touches the work**, an **independent re-check pressure-tests the "completed" claim against the evidence — passing, rejecting, or flagging insufficient evidence depending on what the evidence shows**, and **task state stops living only in the chat scroll** (it sits in plain files you can reopen, hand off, and resume).

(To open the file: macOS `open <file>` · Linux `xdg-open <file>` · Windows `start <file>`. `init` writes a local `.aict/` workspace of plain files; it does not use the network.)

### Or taste it with zero install (60 seconds)

Not ready to clone? Open the AI you already use, think of one real task that is a bit messy, and paste this:

```text
I have a task in front of me that's a bit messy. Before writing any implementation, do this:
Task (redacted — replace any private name/path/number with a placeholder): [your one-paragraph plain-language description]
1) Boundary card: this slice does only X; explicitly list what is NOT in scope.
2) Acceptance card: a numbered list of hard, checkable standards (AC1, AC2, ...), and mark anything that would be out of scope.
Do not start the work yet — just return the boundary card and the acceptance card.
```

That is the first move of the loop — the AI defines *done* before it acts, on your own task. To make it repeatable across tools and sessions (saved as local files), run the 2-minute path above. The full three-step loop (boundary → build → independent re-check) is in the [10-Minute Experience](#10-minute-experience) below.

## Start with one AI

One AI is enough to start — you do not need two tools. With a single AI, this system turns "the AI said it's done" into a result that has evidence, can be re-checked, handed off, and harvested. That alone is most of the value; the single-tool guard runs a real adversarial review (a fresh conversation + a reviewer prompt) instead of trusting the same assistant that just wrote it. This is the front door, not a downgrade. Adding a second, different model family makes the re-check stronger — an independent review a single tool cannot give itself — but that is the ceiling, not the entry bar. (How the guard levels are computed, and why a single tool's cross-family claim is marked unverified, is in the [Commands](#commands) section and `--help`.)

For the full public-system explanation, read [docs/open-system/00-start-here.md](./docs/open-system/00-start-here.md). For privacy and source-to-public rewriting, read [docs/PUBLIC_MAPPING.md](./docs/PUBLIC_MAPPING.md).

中文：一个AI也能开始：先把"做完了"变成有证据、可复核、可交接、可沉淀的结果。这就是大部分价值。有第二个模型族时，可以升级成跨族双守卫。那是一个单工具给不了自己的独立复核。守卫等级怎么算、为什么单工具自称的跨族复核会被标成"未验证"，见下面 Commands 和 --help。

## First Run (keep the workspace as local files)

This is the same `init` as the 2-minute path, with the cross-platform openers spelled out. You only need it if you want the workspace saved locally so the same rules drive every tool and survive across sessions:

```bash
node bin/ai-collab.js init --target ./my-ai-workspace
# then open these two files in your editor — pick your platform's opener:
#   macOS:   open ./my-ai-workspace/.aict/START_HERE.md
#   Linux:   xdg-open ./my-ai-workspace/.aict/START_HERE.md
#   Windows: start .\my-ai-workspace\.aict\START_HERE.md
# (then the same for ./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md)
```

`init` writes a local `.aict/` workspace of plain files. Network: not used at runtime. If you ran this inside a clone of *this* repo, the generated `my-ai-workspace/` is already in our `.gitignore`, so it will not show up as untracked files or dirty your `git status`. Next, take the 10-minute first experience below: the main path runs the loop on *your own* real task; if you would rather watch the flow on a prepared example first, the demo preview (`.aict/walkthroughs/10-minute.md`) is the optional second path.

### What the first conversation looks like

Once the workspace is installed, the rules **instruct** your AI to open the first conversation proactively, rather than waiting to be asked: introduce itself, offer to take ~30 seconds to scan your recent work, and state the privacy boundary *before* scanning (the scan is run by the cloud AI you already use, so its content passes through your provider like any normal chat — this is **not** "zero data leaves your machine"; the `ai-collab` tool itself sends nothing). You stay in control: answer "yes", "just the X project", or "not now". Whether the AI actually opens this way depends on your tool loading this rule — some tools follow workspace instructions more eagerly than others. If you would rather drive it yourself, run `node bin/ai-collab.js bootstrap --yes` for the same read-only baseline at any time.

中文：装好工作区后，这套规则会**指示**你的 AI 在第一次对话时主动开口（而不是等你问）：先自我介绍、提出花约 30 秒扫一眼你最近的活，并在扫描**之前**说清隐私边界——扫描是由你本来就在用的那个云端 AI 执行的，内容会像平常聊天一样经过你的服务商，所以这**不是**「零数据离开你的机器」；`ai-collab` 工具本身不向任何第三方发送东西。主动权在你：回「好」「只看 X 项目」或「先不要」。AI 是否真的这样开口，取决于你的工具有没有加载这条规则——有的工具比别的更听工作区指令。想自己来，随时跑 `node bin/ai-collab.js bootstrap --yes` 拿同样的只读基线。

## 10-Minute Experience

Two ways in. Pick one.

### Path 1 (recommended): run the loop on your own real task

This is the fast way to feel why it matters: you watch the discipline work on *your* task, and an independent AI catch a thin "done" on something you actually care about.

1. Run `node bin/ai-collab.js init --target ./my-ai-workspace`.
2. Open `./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md` and follow its five steps.
3. You describe one real (lightly redacted) task and the AI returns a boundary card and an acceptance card — *done* defined before any work.
4. You let it do only the accepted slice and report what it changed, ran, and did not verify.
5. You open a fresh chat (ideally a different AI brand) and have it re-check the result against evidence — watch it pressure-test the "done" claim and either pass it, reject it, or flag insufficient evidence, depending on what the evidence shows rather than the tone.

### Path 2: watch the prepared demo first

Pick this if your task feels too sensitive to paste right now, or you just want to see what the flow looks like before running it on your own work.

1. Run the same `init` as above.
2. Open `./my-ai-workspace/.aict/walkthroughs/10-minute.md` (the demo preview) and follow its five steps.
3. It walks you through the prepared `examples/ai-coding-long-task/CASE.md` and its artifacts.
4. You copy the context, acceptance, and execution prompt into your AI tool.
5. You run guard review and watch it catch a false "done" the prepared case plants — then come back and run Path 1 on your own task.

中文路径：两条路任选其一。**路 1（推荐）跑你自己的真实任务**：跑 `node bin/ai-collab.js init --target ./my-ai-workspace`（发布到 npm 后才能用全局 `ai-collab`），打开 `.aict/walkthroughs/10-minute-your-task.md`，把你手头一个（脱敏的）真实乱任务丢进去，看 AI 先给边界卡和验收卡（先把“做完”定义清楚），再只做验收卡里的那一小块，最后你新开一个对话（最好换个牌子的 AI）逼它拿证据复核——它会拿证据压你的“做完了”，可能放行、可能驳回、也可能判证据不足，取决于证据本身，而不是替你假设结论。**路 2 先看演示**：怕任务敏感、或想先看流程长啥样，就先打开 `.aict/walkthroughs/10-minute.md`（演示预览版）走旗舰案例，再回来跑路 1。

### Optional: prove it is the discipline, not the model (two-track comparison)

Want hard proof the structure is doing the work, not just a smarter model? After Path 1, run the same task a second way with no discipline and compare:

1. **Track A — no discipline.** Paste your messy one-paragraph task straight into the AI with no structure and ask it to just do it. Screenshot the smooth "Sure, I'll do X, Y, Z" reply — that smooth line is your real before-evidence, generated on your own task.
2. **Track B — with the loop.** This is just Path 1 above (boundary → build → independent re-check).
3. **Put them side by side.** Ask the AI to lay both tracks into one table with four rows: *scope*, *definition of done*, *completion claim*, *what would have been missed*. The point lands when you see, on your own work, how thin Track A's "done" was.

Want to try it on your own work and tell us what happened? See the [Dogfood Guide](./docs/DOGFOOD.md) (who it is for, 10-minute and 30-minute paths, and — importantly — what *not* to upload), then report back through [docs/FEEDBACK.md](./docs/FEEDBACK.md). Feedback collects your experience, never your private material.

## 60-Minute Setup

1. Fill a light profile for how you want AI to collaborate.
2. Fill one context package for a real task, with private details redacted.
3. Define acceptance before asking for output.
4. Use your tool adapter or install guidance files with `node bin/ai-collab.js adapters install --target <repo>`.
5. Run a guard review on the first artifact.
6. Write a handoff note.
7. Extract one harvest seed for future reuse.

## Commands

Before publish, run every command as `node bin/ai-collab.js <args>` from a clone. After the package is published to npm, the same commands work under the global `ai-collab` name shown here:

```bash
node bin/ai-collab.js init --target ./my-ai-workspace
node bin/ai-collab.js init --target ./my-ai-workspace --dry-run
node bin/ai-collab.js guide
node bin/ai-collab.js demo
node bin/ai-collab.js check --workspace ./my-ai-workspace
node bin/ai-collab.js adapters install --target ./my-repo
npm run check
```

Once a workspace exists, operate the loop on a real task with the **run layer** — these are the commands that actually produce the evidence, receipts, and guard levels this README is about (omit `--workspace` to use `./.aict` here; a state command refuses if no workspace exists rather than scattering files):

```bash
node bin/ai-collab.js task create   --title "Fix the flaky reorder test" --workspace ./my-ai-workspace/.aict
node bin/ai-collab.js run start      --task t1 --command "npm test"        --workspace ./my-ai-workspace/.aict
node bin/ai-collab.js run finish     --task t1 --exit 0                    --workspace ./my-ai-workspace/.aict
node bin/ai-collab.js evidence add   --task t1 --kind output --summary "npm test -> exit 0, suite green" --workspace ./my-ai-workspace/.aict
node bin/ai-collab.js receipt create --task t1 --verdict pass_with_risk --review-mode self --evidence e2 --workspace ./my-ai-workspace/.aict
node bin/ai-collab.js receipt accept --id c1 --owner you                  --workspace ./my-ai-workspace/.aict
node bin/ai-collab.js status                                              --workspace ./my-ai-workspace/.aict
```

Run that and the receipt prints `guardLevel: L2 (computed)` — exactly the single-tool ceiling described next. (Cite only a bare `--kind note` instead and it computes `L1`, which cannot pass; you need run/output evidence to reach L2.)

The guard level (L0–L4) is **computed from the evidence you cite, never self-asserted**: a single tool tops out at L2 (`pass_with_risk`); a plain `pass` needs an L3+ review from a *different* model family; and L4 needs **both** that cross-family review **and** a rerun reconciled to a recorded run — a reconciled rerun on its own is just the author re-running their own command, so it stays L2. Use `run exec` to actually run a command and record its **real** exit code (`run start/finish` only record an exit you report). **Safety: `run exec` runs a real shell command locally — read the command first, especially if an AI suggested it.** A receipt records *who claimed what* — it is a local audit trail, **not** a cryptographic proof or an independent-execution guarantee (the cross-family family label is self-declared; the tool runs locally and cannot verify it). The full ladder is in `node bin/ai-collab.js --help`.

`demo` is a no-setup preview: it writes a throwaway workspace into a new temporary directory so you can see the layout without touching your project. In a strictly read-only environment that temp write can fail; use `init --target <writable-dir>` instead. `init` writes to a directory you choose and is what you keep.

## What You Get

This is a collaboration operating system, not a prompt collection. What makes it one is the chains it carries, not how many prompts ship inside it:

- **A visible task-state chain**: context -> acceptance -> guard -> handoff -> harvest, as plain files, so work has inspectable state instead of living in a chat scroll.
- **A handoff chain** (handoff A/B/C): any session or tool resumes from where the work actually is, instead of you re-explaining the background each time.
- **A review chain** (dual guard + SCOUT review controller + half-product review): output gets challenged for evidence before it is trusted, and a confident "done" with no runnable proof gets caught.
- Six collaboration layers behind that chain: profile, context, acceptance, guard review, handoff, harvest.
- 15 mechanism packages that operate the chains: dual guard, SCOUT review controller, one-click dispatch, task splitting, anti-drift partner, root-cause brake, half-product review, handoff A/B/C, harvest and external recap, do-not-handle-yet, plain-language first screen, honest calibration, feedback-absorption ledger, collaboration coach, and single-tool guard.
- A complete `.aict/` workspace with `START_HERE.md` and public OS directories: profile, context, acceptance, guard, handoff, harvest, roles, modes, mechanisms, examples, cookbook, and state.
- Adapter guidance files so common AI tools all work off one shared contract instead of six drifting rule sets.
- A flagship synthetic case plus additional synthetic cases, and privacy / commercial-boundary docs.
- The reusable prompt and skill library that powers the above (11 distinct prompts for different workflow moments; 10 distinct skills with process, output, and safety rules) — the count is the supply, the chains above are the point.
- Contract checks that prevent the project from drifting back into a thin prompt pack.

## Honesty Boundary

- This is not a hosted assistant.
- This is not an autonomous agent framework.
- We do not disguise a single-tool self-review as a cross-family pass. The guard level is computed from evidence, not self-asserted: a single tool tops out at L2 (pass-with-risk); a plain pass requires L3+ with a different model family. 中文：我们不会把单工具自审伪装成跨族通过。
- Adapter files are guidance, not deep integration with every tool.
- The CLI does not call external AI APIs, upload content, or run telemetry.
- Known limitations are documented honestly, not hidden — e.g. concurrent writes to one workspace can produce a duplicate ledger id (rare for a single local user), which `check` catches after the fact. See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).
- Paid help, if offered by a maintainer, may calibrate the generic system for a real workflow, but the open method is complete enough to self-run. The open method is never gated behind payment; paid help is only calibration / setup / migration / review / pairing. See [docs/FREE_VS_PAID.md](./docs/FREE_VS_PAID.md).

## Release Status

This project moves through four explicit release states. Being honest about which one we are
in is part of the product: the docs must never describe a step that has not happened yet as if
it already has.

| State | Meaning | Reached? | What it means for you (plain language) |
| --- | --- | --- | --- |
| **local candidate** | Built and verified on a local machine; committed to git locally. | Yes | (Superseded.) The earliest state; the source is now on GitHub. |
| **publishable candidate** | All release checks green, packed tarball install-smoke passes, version/CHANGELOG prepared. | Yes | (Superseded.) The quality bar was met before the source was pushed. |
| **GitHub source release** | Pushed to the public GitHub repo; CI green on the pushed commit. Not git-tagged yet. | **Current** | You can `git clone` it from GitHub and run `node bin/ai-collab.js`. There is **no** `npm install` and no global `ai-collab` command yet, and no version tag. |
| **npm package** | Published to npm via `npm publish`. | No | Only then does `npm install -g ai-collab-open-system` (the package name) install the global `ai-collab` command so it works as written elsewhere in this README. |

**The source is on GitHub and CI is green, but it is still not an npm package.** The code,
privacy, and packaging checks (`npm test`, `npm run check`, `npm pack --dry-run`) all pass on the
pushed `main`, and CI is green. What has **not** happened: a git version tag, and the actual
`npm publish`. "Release-ready" is a quality bar, not a release event, so no doc here claims an
`npm install` works today.

Everywhere this README (or `ai-collab guide`/`--help`) shows a global `ai-collab ...` command or an
`npm install`, read it as **"available after the npm package state"**. Until then the working
command is `node bin/ai-collab.js <args>` from a clone.

The exact remaining steps that move this from the current **GitHub source release** to an **npm
package** (tag, publish, post-publish verification) are listed in
[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

## Release Checks

```bash
npm test
npm run check
npm pack --dry-run
```

See [PRODUCT_CONTRACT.md](./PRODUCT_CONTRACT.md), [docs/PUBLIC_BOUNDARY.md](./docs/PUBLIC_BOUNDARY.md), and [privacy-manifest.json](./privacy-manifest.json).

## How this fits with Spec Kit / BMAD / AGENTS.md

This is a **collaboration discipline + state layer**, not a development methodology or an agent framework. It complements, rather than replaces, tools like Spec Kit, BMAD, or an `AGENTS.md`: keep using those to plan and drive the work; this adds the evidence, guard, handoff, and harvest layer that makes a "done" claim checkable and resumable across tools and sessions.

## Contact

- Security issues: see [SECURITY.md](./SECURITY.md) (private channel).
- General: **X/Twitter** [@AaronYiaazw](https://x.com/AaronYiaazw) · **Email** yi19970319@gmail.com
- Source & issues: https://github.com/aaronyi97/ai-collab-open-system
