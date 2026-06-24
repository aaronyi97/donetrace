# Dogfood Guide

Try this workspace on your own AI collaboration, then tell us what actually happened. This page is for trying it; [docs/FEEDBACK.md](./FEEDBACK.md) is for reporting back.

Everything here is local-first and synthetic. You read and copy plain files into the AI tools you already use. Nothing is uploaded by the CLI, and we do not want you to upload anything private to us either. See [What NOT to upload](#what-not-to-upload) before you start.

## Who should try it

This is worth ten minutes if you work across more than one AI tool and you keep hitting one of these:

- **Context keeps getting lost.** You re-explain the same task boundary every session, and the AI still drifts out of scope.
- **The AI claims it finished, but it did not.** You get a fluent "done — added X, Y, Z with tests" and only later find a piece was never implemented.
- **You repeat your background across sessions.** Every new chat starts cold; the previous chat's state is gone and you retype it.
- **You cannot tell which AI is right.** Two tools (or two sessions) disagree and you have no structured way to decide which one to trust.

If none of those bite you, this probably is not for you, and that is a fine outcome to report. Skipping it for low-stakes, throwaway work is the right call — running structure over trivial work is just ceremony.

## Try it in 10 minutes (on your own task — recommended)

Run the whole loop on one real task of *yours*, in three short rounds, and watch an independent AI catch a thin "done" on work you actually care about. This is the fastest way to feel why it matters.

1. Initialize a throwaway workspace:
   ```bash
   node bin/ai-collab.js init --target ./my-ai-workspace
   ```
2. Open `./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md` and follow its five steps.
3. You describe one real (lightly redacted) task; the AI returns a **boundary card** and an **acceptance card** — *done* defined before any work — then does only the accepted slice and reports what it changed, ran, and did not verify.
4. The point to notice: you open a fresh chat (ideally a different AI brand) and have it re-check the result against evidence. Where the work over-claimed, it returns `reject` with the defect pinned to a location — on your task, not a prepared one.

What you should feel by the end: your own task had visible state (what is in scope, what "done" means, what is still unproven) instead of one smooth guess — and a thin "done" got caught before you trusted it. Redact before you paste (see [What NOT to upload](#what-not-to-upload)); the loop works on a redacted description and needs no private original.

### Prefer to watch a prepared demo first? (optional)

If your task feels too sensitive to paste right now, or you just want to see the flow first, open `./my-ai-workspace/.aict/walkthroughs/10-minute.md` (the demo preview) instead. It runs the same loop on the prepared `ai-coding-long-task` case: the first output claims arrow-key reorder works, the guard proves the keyboard handler is a stub that never moves anything, and it returns `reject` with a line citation — not a vibe. Then come back and run the loop on your own task above.

## Try it in 30 minutes

Go deeper: take one mechanism and point it at *your own* half-finished work. The cleanest one to start with is **dual-guard**: use it to review a deliverable that claims to be done.

1. Read the recipe: `./my-ai-workspace/.aict/cookbook/review-a-half-product.md`. It explains why each step exists and how to adapt it.
2. Pick something of yours that says "done but maybe not" — a draft, a small feature, a doc whose first-run path you are not sure actually works.
3. Redact it first (see below), then paste the redacted artifact plus the copy-paste block from the cookbook (the dual-guard review prompt) into a second AI tool — ideally a **different model family** from whatever produced the work, because a different family is the pass most likely to see what the author missed.
4. Demand findings tied to specific lines or missing evidence, ordered by severity, with a pass or reject. Do not accept "looks fine".
5. The underlying mechanism is `./my-ai-workspace/.aict/mechanisms/dual-guard/` — read its `PROMPT.md` and `README.md` if you want the full two-layer version (cross-family binding guard + same-family reference guard).

What you should feel by the end: you got an evidence-grounded second opinion on your own work without handing your private original to anyone — the review runs on a redacted artifact plus its evidence.

## What to report back

After either path, open [docs/FEEDBACK.md](./FEEDBACK.md) and fill it in. We mostly want to know:

- Which AI tools you use, and which pain point pulled you in.
- Where the first experience stalled, if it did.
- Which mechanism was the most useful, and which one you could not make sense of.
- Whether you would use this on a real workflow, and whether paying to save calibration time would be worth it to you.

Report the *experience*, not your task. The feedback template asks only for感受-level answers, never the work itself. (中文：只反馈体验感受，不要把真实任务内容贴进来。)

## What NOT to upload

The honest rule of this project is local-first: the open method is complete on your own machine, and we do not collect your work. So when you report back, give us your **experience**, never your **material**. Do not paste, attach, or screenshot any of the following into an issue, a discussion, or anywhere it leaves your machine:

- Actual customer or contact material, or names of people and companies.
- Tokens, API keys, cookies, passwords, or any credential.
- Absolute local machine paths (anything that reveals your home directory or internal folder layout).
- Private chat logs, raw session transcripts, or the unredacted original of whatever you reviewed.
- Company-internal information: private routing, internal numbers, non-public processes, or proprietary docs.
- Unredacted screenshots that show any of the above.

If you want to show an example, rewrite it as a synthetic placeholder first (same shape as the cases in `examples/`), or just describe what happened in words. The review mechanisms are built to work on a redacted artifact plus its evidence — they never need the private original.

Before you post anything, you can sanity-check your own repo the same way this project checks itself:

```bash
node scripts/privacy-scan.js
```

中文（同义）：本地优先，方法在你自己机器上就完整可用，我们不收集你的工作内容。反馈时只给体验感受，不要上传任何隐私材料：客户或联系人信息、密钥口令、本机绝对路径、私有对话原文、公司内部信息、未脱敏截图。要举例就先改写成合成占位例子，或者直接用文字描述。

## Why dogfood this at all

Two reasons, stated plainly:

- It makes the project better. Real friction reports — where the first run stalls, which mechanism reads as jargon — are what fix the open system. A confused first-run is a bug we want to know about.
- It is how a real working relationship can start, honestly. If the open method helps but you would rather have it tuned to your own tools and workflow, that is what paid help is for — calibration, setup, migration, review, pairing. The method here stays complete and free; paid help only saves you the trial-and-error of calibrating it. See [docs/FREE_VS_PAID.md](./FREE_VS_PAID.md). We never gate the basic method behind payment, and we never tell you "you have a problem, pay to see the answer."
