# 00 Start Here - AI Collaboration Open System

AI Collaboration Open System is a local-first way to make AI work visible, reviewable, handoff-ready, and reusable. Start by running the CLI, not by reading the whole theory.

This package is not published to npm yet, so run the CLI from a clone with `node bin/ai-collab.js`. The global `ai-collab` command only works after publish.

## 10 minutes

This is the first-run path, consistent with the README and START_HERE: two ways in, with **Path 1 (run the loop on your own real task) recommended** and the prepared demo as the optional Path 2.

```bash
node bin/ai-collab.js init --target ./my-ai-workspace
node bin/ai-collab.js check --workspace ./my-ai-workspace
```

(The package is not on npm yet, so use the local CLI entry `node bin/ai-collab.js`; after the npm package ships, the same commands run under the global `ai-collab` name. You can also run `node bin/ai-collab.js demo` to generate a throwaway synthetic workspace and inspect it.)

**Path 1 (recommended) — your own task:** open `./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md` and follow its five steps on one real (lightly redacted) task: the AI returns a boundary card and an acceptance card (done defined before any work), does only the accepted slice, then a fresh chat re-checks the result against evidence and rejects a claim the evidence does not back.

**Path 2 (optional) — watch the prepared demo first:** if your task feels too sensitive to paste, open `./my-ai-workspace/.aict/walkthroughs/10-minute.md` instead; it walks you through the flagship synthetic lab at `examples/ai-coding-long-task/CASE.md` and its artifacts, then catches a planted false "done". After it, run Path 1 on your own task.

The workspace map is `./my-ai-workspace/.aict/START_HERE.md`.

## Why this is not a prompt pack

A prompt pack gives you better one-off instructions. This system gives you a workspace with state: profile, context, acceptance, guard, handoff, harvest, roles, modes, mechanisms, cookbook, examples, and local state files.

## Why it is steadier than a single-agent chat

A single-agent chat can sound confident while losing rejected scope, missing evidence, and forgetting what is unverified. The local-first OS keeps those things in files:

- Context names the task boundary.
- Acceptance defines done before work starts.
- Guard review challenges the output before trust.
- Handoff lets another session resume.
- Harvest keeps the reusable lesson.

## The two paths in steps

This restates the 10-minute paths above, in steps. Path 1 is the recommended on-ramp; Path 2 is the optional demo.

**Path 1 (recommended) — run the loop on your own real task:**

1. Run `node bin/ai-collab.js init --target ./my-ai-workspace`.
2. Open `./my-ai-workspace/.aict/walkthroughs/10-minute-your-task.md` and follow its five steps.
3. Describe one real (lightly redacted) task; the AI returns a boundary card and an acceptance card — done defined before any work.
4. Let it do only the accepted slice and report what it changed, ran, and did not verify.
5. Open a fresh chat (ideally a different AI family) and have it re-check the result against evidence — watch it pressure-test the "done" claim and either pass it, reject it, or flag insufficient evidence, depending on what the evidence shows rather than the tone.

**Path 2 (optional) — watch the prepared demo first:**

1. Run the same `init` as above.
2. Open `./my-ai-workspace/.aict/walkthroughs/10-minute.md` and follow its five steps; optionally run `node bin/ai-collab.js demo` to inspect a throwaway synthetic workspace.
3. It walks you through the flagship case `examples/ai-coding-long-task/CASE.md` and its artifacts.
4. Copy the context package, acceptance card, and execution prompt into Codex, Claude Code, Cursor, Cline, Windsurf, or Copilot.
5. Run guard review before accepting the answer and watch it catch the planted false "done" — then come back and run Path 1 on your own task.

## Next file

Read `01-ai-collaboration-os.md` after you have run your first loop.
