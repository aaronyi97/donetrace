# DoneTrace
Formerly AI Collaboration Open System
A local-first layer for evidence, review, supervision, handoff, and learning in AI workflows.

For builders whose AI keeps saying “done” before the work is actually proven.

DoneTrace is a local-first evidence, review, supervision, and handoff layer for AI workflows.
It does not replace Claude, Cursor, Codex, or your other tools.
It makes the work checkable.

## What it adds

- acceptance before execution
- evidence before “done”
- independent re-check with another model family
- handoff across tools and sessions
- harvest after the task

Does your AI keep saying "done" when it is not? This is an **open-source personal AI collaboration workspace** — a thin discipline pack you drop into the AI you already use (Claude, Cursor, Codex, and others). It does not write your code and does not think for you. It does one thing: it makes your AI prove a "done" claim with evidence, gets a second AI to re-check it, and lets you switch tools or pick the work up tomorrow without re-explaining the background. Why a workspace beats a better prompt: [docs/WHY_THIS_EXISTS.md](./docs/WHY_THIS_EXISTS.md). New here? Start at [START_HERE.md](./START_HERE.md).

> Install globally: `npm install -g ai-collab-open-system`, then use the `ai-collab` command everywhere below. If you cloned the source instead, replace `ai-collab` with `node bin/ai-collab.js` in every command.

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

One main path: `first-run`. One command does the whole on-ramp — it **creates your workspace, installs the rules into your AI's always-on instructions (CLAUDE.md / AGENTS.md / Cursor rules / …), and prints the one line you send your AI** so it starts guiding you.

```bash
npm install -g ai-collab-open-system
ai-collab first-run --target . --tool claude   # or codex / cursor / copilot / cline / windsurf
```

(Prefer not to install globally? Clone the repo and run `node bin/ai-collab.js first-run --target . --tool claude` instead — same command, local entry.)

That command ends by printing one line to copy into your AI; the moment your AI receives it, it introduces the system, offers a read-only scan of your recent work, and starts the guided first run. **Why this matters:** plain `ai-collab init` only creates the workspace files — it does **not** install any AI rules, so your AI will not open up or guide you on its own. `first-run` is the path that actually wires the rules into your tool. (`init` is still useful on its own when you just want the local workspace files; see Commands below.)

(`first-run` writes a local `.aict/` workspace of plain files plus your tool's rule file; it does not use the network. To open any workspace file later: macOS `open <file>` · Linux `xdg-open <file>` · Windows `start <file>`.)

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

## `init`: workspace files only (the manual / advanced path)

This is **not** the recommended first experience — `first-run` (above) is. Use `init` only when you want the local `.aict/` workspace files **by themselves**, with **no AI rules installed**. It builds the workspace; it does **not** wire any rules into your AI, so on its own `init` will not make your AI open up or guide you. Cross-platform openers spelled out:

```bash
ai-collab init --target ./my-ai-workspace
# then open these two files in your editor — pick your platform's opener:
#   macOS:   open ./my-ai-workspace/.aict/START_HERE.md
#   Linux:   xdg-open ./my-ai-workspace/.aict/START_HERE.md
#   Windows: start .\my-ai-workspace\.aict\START_HERE.md
# (then the same for ./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md)
```

`init` writes a local `.aict/` workspace of plain files and nothing else. Network: not used at runtime. If you ran this inside a clone of *this* repo, the generated `my-ai-workspace/` is already in our `.gitignore`, so it will not show up as untracked files or dirty your `git status`. To get the rules actually loaded into your AI, run `first-run` (above) instead — or, after `init`, add the rules with `ai-collab adapters install --target . --tool <claude|codex|cursor|...>`. Next, take the 10-minute first experience below: the main path runs the loop on *your own* real task; if you would rather watch the flow on a prepared example first, the demo preview (`.aict/walkthroughs/10-minute.md`) is the optional second path.

### What the first conversation looks like

Onboarding is **trigger-driven**, not automatic: your AI does not open up on its own first reply. Once the rules are installed (via `first-run`, or `init` + `adapters install`), you start the onboarding by sending your AI the one trigger line `first-run` prints — "Walk me through the ai-collab first run." (or by just asking it to start). Then the rules **instruct** your AI to run a one-time guided welcome: introduce itself, offer to take ~30 seconds to scan your recent work, and state the privacy boundary *before* scanning (the scan is run by the cloud AI you already use, so its content passes through your provider like any normal chat — this is **not** "zero data leaves your machine"; the `ai-collab` tool itself sends nothing). You stay in control: answer "yes", "just the X project", or "not now". (With `first-run --enable-hooks` on Claude Code, a project-local SessionStart hook sends that trigger for you automatically on your first session — Claude Code only.) Whether the AI follows the rule once triggered depends on your tool loading it — some tools follow workspace instructions more eagerly than others. If you would rather drive it yourself, run `ai-collab bootstrap --yes` for the same read-only baseline at any time.

中文：引导是**触发式**的，不会自动发生：你的 AI 不会在自己的第一条回复里主动开口。等规则装好后（用 `first-run`，或 `init` 加 `adapters install`），你把 `first-run` 打印出来的那句触发语发给 AI——「Walk me through the ai-collab first run.」（或直接让它开始），这套规则才会**指示**你的 AI 跑一次性的引导欢迎：先自我介绍、提出花约 30 秒扫一眼你最近的活，并在扫描**之前**说清隐私边界——扫描是由你本来就在用的那个云端 AI 执行的，内容会像平常聊天一样经过你的服务商，所以这**不是**「零数据离开你的机器」；`ai-collab` 工具本身不向任何第三方发送东西。主动权在你：回「好」「只看 X 项目」或「先不要」。（在 Claude Code 上用 `first-run --enable-hooks`，一个仅限本项目的 SessionStart 钩子会在你首次会话时替你自动发出那句触发语——仅限 Claude Code。）触发之后 AI 是否照做，取决于你的工具有没有加载这条规则——有的工具比别的更听工作区指令。想自己来，随时跑 `ai-collab bootstrap --yes` 拿同样的只读基线。

## 10-Minute Experience

Two ways in. Pick one.

### Path 1 (recommended): run the loop on your own real task

This is the fast way to feel why it matters: you watch the discipline work on *your* task, and an independent AI catch a thin "done" on something you actually care about.

1. Run `ai-collab first-run --target . --tool claude` (or codex / cursor / …) — creates the workspace, installs your AI's rules, and prints the line to send your AI. (Just want the local files with no AI rules? `ai-collab init --target ./my-ai-workspace` does only that; your AI will not open up on its own.)
2. Send your AI the printed trigger line ("Walk me through the ai-collab first run."), then open `./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md` and follow its five steps.
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

中文路径：两条路任选其一。**路 1（推荐）跑你自己的真实任务**：跑 `ai-collab first-run --target . --tool claude`（或 codex / cursor / …）——它会建工作区、把规则装进你的 AI、并打印出一句要发给 AI 的话（只想要本地工作区文件、不装 AI 规则？用 `ai-collab init --target ./my-ai-workspace` 只建文件，你的 AI 不会自己主动开口）。把打印出来的那句触发语发给 AI 开始引导，打开 `.aict/walkthroughs/10-minute-your-task.md`，把你手头一个（脱敏的）真实乱任务丢进去，看 AI 先给边界卡和验收卡（先把“做完”定义清楚），再只做验收卡里的那一小块，最后你新开一个对话（最好换个牌子的 AI）逼它拿证据复核——它会拿证据压你的“做完了”，可能放行、可能驳回、也可能判证据不足，取决于证据本身，而不是替你假设结论。**路 2 先看演示**：怕任务敏感、或想先看流程长啥样，就先打开 `.aict/walkthroughs/10-minute.md`（演示预览版）走旗舰案例，再回来跑路 1。

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
4. Use your tool adapter or install guidance files with `ai-collab adapters install --target <repo>`.
5. Run a guard review on the first artifact.
6. Write a handoff note.
7. Extract one harvest seed for future reuse.

## Commands

With the package installed globally, run every command under the `ai-collab` name shown here (from a clone, `node bin/ai-collab.js <args>` is the same entry):

```bash
ai-collab first-run --target . --tool claude   # recommended on-ramp: workspace + AI rules + the line to send your AI
ai-collab init --target ./my-ai-workspace      # workspace files only (no AI rules — the AI will not open up on its own)
ai-collab init --target ./my-ai-workspace --dry-run
ai-collab guide
ai-collab demo
ai-collab check --workspace ./my-ai-workspace
ai-collab adapters install --target ./my-repo  # install AI rules into an existing workspace (advanced; first-run does this for you)
npm run check
```

**Optional Claude Code hooks (opt-in, off by default).** Add `--enable-hooks` to `first-run` / `adapters install` (Claude Code only) and the tool merges **two project-local** Claude Code hooks into the repo's own `.claude/settings.json` — never a global/home hook, and the install lists every file first and is removable:

- a **Stop** hook that reminds you to capture evidence + a receipt whenever you claim a task is done, and
- a one-time **SessionStart** hook so that, on your **first** Claude Code session in this repo, the AI starts the first-run walkthrough on its own — no need to paste the trigger line. It writes a small marker (`.claude/.ai-collab-firstrun-done`) the first time it fires and stays silent afterward.

Heads-up on the trust gate: the first time you open the repo in Claude Code it asks **"trust this folder?"** — accept it, otherwise the hook cannot run and the auto-start will not happen (you can always send the printed trigger line by hand instead).

Once a workspace exists, operate the loop on a real task with the **run layer** — these are the commands that actually produce the evidence, receipts, and guard levels this README is about (omit `--workspace` to use `./.aict` here; a state command refuses if no workspace exists rather than scattering files):

```bash
ai-collab task create   --title "Fix the flaky reorder test" --workspace ./my-ai-workspace/.aict
ai-collab run start      --task t1 --command "npm test"        --workspace ./my-ai-workspace/.aict
ai-collab run finish     --task t1 --exit 0                    --workspace ./my-ai-workspace/.aict
ai-collab evidence add   --task t1 --kind output --summary "npm test -> exit 0, suite green" --workspace ./my-ai-workspace/.aict
ai-collab receipt create --task t1 --verdict pass_with_risk --review-mode self --evidence e2 --workspace ./my-ai-workspace/.aict
ai-collab receipt accept --id c1 --owner you                  --workspace ./my-ai-workspace/.aict
ai-collab status                                              --workspace ./my-ai-workspace/.aict
```

Run that and the receipt prints `guardLevel: L2 (computed)` — exactly the single-tool ceiling described next. (Cite only a bare `--kind note` instead and it computes `L1`, which cannot pass; you need run/output evidence to reach L2.)

The guard level (L0–L4) is **computed from the evidence you cite, never self-asserted**: a single tool tops out at L2 (`pass_with_risk`); a plain `pass` needs an L3+ review from a *different* model family; and L4 needs **both** that cross-family review **and** a rerun reconciled to a recorded run — a reconciled rerun on its own is just the author re-running their own command, so it stays L2. Use `run exec` to actually run a command and record its **real** exit code (`run start/finish` only record an exit you report). **Safety: `run exec` runs a real shell command locally — read the command first, especially if an AI suggested it.** A receipt records *who claimed what* — it is a local audit trail, **not** a cryptographic proof or an independent-execution guarantee (the cross-family family label is self-declared; the tool runs locally and cannot verify it). The full ladder is in `ai-collab --help`.

`demo` is a no-setup preview: it writes a throwaway workspace into a new temporary directory so you can see the layout without touching your project. In a strictly read-only environment that temp write can fail; use `init --target <writable-dir>` instead. `init` writes to a directory you choose and is what you keep.

## What You Get

This is a collaboration operating system, not a prompt collection. What makes it one is the chains it carries, not how many prompts ship inside it:

- **A visible task-state chain**: context -> acceptance -> guard -> handoff -> harvest, as plain files, so work has inspectable state instead of living in a chat scroll.
- **A handoff chain** (handoff A/B/C): any session or tool resumes from where the work actually is, instead of you re-explaining the background each time.
- **A review chain** (dual guard + SCOUT review controller + half-product review): output gets challenged for evidence before it is trusted, and a confident "done" with no runnable proof gets caught.
- Six collaboration layers behind that chain: profile, context, acceptance, guard review, handoff, harvest.
- 16 mechanism packages that operate the chains: dual guard, SCOUT review controller, one-click dispatch, task splitting, anti-drift partner, blind-spot scan, root-cause brake, half-product review, handoff A/B/C, harvest and external recap, do-not-handle-yet, plain-language first screen, honest calibration, feedback-absorption ledger, collaboration coach, and single-tool guard.
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

This project moved through four explicit release states to get here. Being honest about which one
we are in is part of the product: the docs describe each step as it actually happened, never ahead
of itself.

| State | Meaning | Reached? | What it means for you (plain language) |
| --- | --- | --- | --- |
| **local candidate** | Built and verified on a local machine; committed to git locally. | Yes | (Superseded.) The earliest state; the source is now on GitHub. |
| **publishable candidate** | All release checks green, packed tarball install-smoke passes, version/CHANGELOG prepared. | Yes | (Superseded.) The quality bar was met before the source was pushed. |
| **GitHub source release** | Pushed to the public GitHub repo; CI green on the pushed commit. | Yes | (Superseded.) The source went public on GitHub with CI green before the package shipped. |
| **npm package** | Published to npm via `npm publish`. | **Yes** | `npm install -g ai-collab-open-system` installs the global `ai-collab` command, so every command in this README works as written. |

**The package is published to npm as `ai-collab-open-system` (version 0.1.0), and the global
`ai-collab` command is live.** The code, privacy, and packaging checks (`npm test`, `npm run check`,
`npm pack --dry-run`) all pass, CI is green, and the package is installable from npm. If you would
rather run from a clone than install globally, `node bin/ai-collab.js <args>` is the same entry.

The release steps that took this from a local build to the published **npm package** (and the
post-publish verification) are recorded in [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

## Release Checks

```bash
npm test
npm run check
npm pack --dry-run
```

See [PRODUCT_CONTRACT.md](./PRODUCT_CONTRACT.md), [docs/PUBLIC_BOUNDARY.md](./docs/PUBLIC_BOUNDARY.md), and [privacy-manifest.json](./privacy-manifest.json).

## How this fits with Spec Kit / BMAD / AGENTS.md

This is a **collaboration discipline + state layer**, not a development methodology or an agent framework. It complements, rather than replaces, tools like Spec Kit, BMAD, or an `AGENTS.md`: keep using those to plan and drive the work; this adds the evidence, guard, handoff, and harvest layer that makes a "done" claim checkable and resumable across tools and sessions.

## Free Async AI Workflow Snapshot

If you want me to diagnose your workflow asynchronously, I’m opening 5 free workflow snapshots.
Start here: [Request a workflow teardown](https://github.com/aaronyi97/ai-collab-open-system/issues/1).

## Contact

- Security issues: see [SECURITY.md](./SECURITY.md) (private channel).
- General: **X/Twitter** [@AaronYiaazw](https://x.com/AaronYiaazw) · **Email** yi19970319@gmail.com
- Source & issues: https://github.com/aaronyi97/ai-collab-open-system

---

## Stay in touch

- **X / Twitter:** [@AaronYiaazw](https://x.com/AaronYiaazw)
- **Substack:** [@aaronyi97](https://substack.com/@aaronyi97)
- **Free Async AI Workflow Snapshot:** [Request a workflow teardown](https://github.com/aaronyi97/ai-collab-open-system/issues/1). Send me one workflow, one failed AI task, or one place where your AI process keeps breaking. I'll tell you where I think it breaks. No live call required.

This snapshot is an AI workflow diagnostic. It is not a certified code audit, security audit, or architecture certification.
