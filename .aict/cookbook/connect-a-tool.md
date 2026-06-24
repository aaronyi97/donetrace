# Connect a Tool

A do-it recipe: point any AI tool you already use at this workspace, so the same profile, context, acceptance, guard, handoff, and harvest rules drive every tool instead of six drifting rule systems. The key idea is that every mechanism here is just a Markdown file. You connect a tool by copying file contents into that tool's instruction slot. Nothing depends on this CLI staying installed; the CLI only writes the files.

## When to use this

- You have a favorite AI tool (a general chat AI, a coding assistant, or a command-line AI) and want it to follow this system's loop.
- You use more than one tool and they each behave differently because each has its own ad hoc rules.
- You want a mechanism (like a guard pass) available inside your tool as a reusable instruction, not something you re-type every time.

Skip it if you only ever read these files by hand and never paste them into a tool.

## Prerequisites

- This workspace exists locally.
- The AI tool you want to connect, and knowledge of where it accepts standing instructions. Three common shapes: a general chat AI uses a "system prompt" or "custom instructions" box; a coding assistant uses a project rules file (for example a `CLAUDE.md`, an `AGENTS.md`, a `.cursorrules`, a `.clinerules`, or an equivalent); a command-line AI uses its config or a per-project instruction file.
- Two minutes per tool. This is copy and paste, not installation.

## Steps

1. Open the shared contract. Open `../adapters/SHARED_CORE_CONTRACT.md`. This is the one rule source every tool should share so the loop does not drift between tools.
2. Open the adapter for your tool family. Look in `../adapters/` for the closest match to your tool (each adapter is a thin pointer, intentionally not a second copy of the contract). If none matches exactly, pick the nearest one. The adapter shows the minimal instruction your tool needs.
3. Put the contract where your tool reads standing instructions. For a chat AI, paste the contract into the system-prompt or custom-instructions box. For a coding assistant, save it (or a pointer to it) into that tool's project rules file. For a command-line AI, add it to the tool's config or per-project instruction file. Use the copy-paste block below.
4. Add one mechanism as a reusable instruction (optional but the high-value move). Pick a mechanism you want on tap, for example `../mechanisms/dual-guard/PROMPT.md` or `../guard/PROMPT.md`. Copy the prompt body from that file's "Copy-paste prompt" block into a saved prompt, snippet, or rule in your tool, so a guard pass is one trigger away instead of a retype.
5. Verify the wiring with a throwaway ask. Tell the tool: "State the core loop you are now following and where each step's rules live." A correctly connected tool names profile, context, acceptance, guard, handoff, harvest and treats them as explicit files, instead of inventing hidden memory.
6. Save anything worth keeping back into this workspace (a filled template, a handoff, a harvest card) so the next tool or session starts from the same files.

## Copy-paste block

Two pieces. The first wires the whole loop into a tool. The second drops a single mechanism in as a reusable instruction. Before pasting, open the referenced file and paste its real contents where marked; do not paste the file path and expect the tool to read your disk.

```text
[A / WIRE THE LOOP INTO A TOOL - paste into the tool's system prompt or project rules file]
Follow this shared contract for our work. Treat profile, context, acceptance, guard/review, handoff, and harvest as explicit files in a local-first workspace, not as hidden memory. Work local-first; do not upload my content by default. Label facts, assumptions, decisions, and unverified claims. Use synthetic, redacted examples for anything I might share publicly.
--- shared contract begins ---
[paste the full contents of ../adapters/SHARED_CORE_CONTRACT.md here]
--- shared contract ends ---

[B / ADD ONE MECHANISM AS A REUSABLE INSTRUCTION - save as a snippet, saved prompt, or rule]
When I invoke this, run the mechanism below on the material I provide. Keep private material local and redacted. Point findings to specific spots. Return the mechanism's stated output shape, not a vague summary.
--- mechanism prompt begins ---
[paste the "Copy-paste prompt" block from ../mechanisms/<mechanism>/PROMPT.md here]
--- mechanism prompt ends ---
```

## Expected output

- Your tool, when asked, can name the core loop (profile, context, acceptance, guard, handoff, harvest) and treats each as a file rather than invented memory.
- At least one mechanism is reachable inside the tool as a saved instruction you can trigger without retyping it.
- The same contract now drives every tool you connected this way, so behavior is consistent across tools.

## Failure handling

- The tool ignores the standing instruction. You likely pasted into a one-off chat turn instead of the persistent slot. Move the contract into the actual system-prompt box or project rules file so it survives across turns.
- The tool "can't find" a referenced file. Tools generally cannot read your disk from a path in a prompt. Paste the file's contents inline (as the block marks), not just its path. Files are the source of truth; pasting is how a tool sees them.
- Behavior still drifts between two tools. Confirm both point at the same single `SHARED_CORE_CONTRACT.md` and that neither has an older private rule set fighting it. One contract, many thin adapters; never six full rule systems.
- The adapter looks too thin and you want to fatten it. Do not. The adapter is meant to be a pointer; thickening it recreates the drift the shared contract exists to prevent.

## Privacy note

Connecting a tool means standing instructions, not your private data. Paste the contract and mechanism prompts (they are public-safe). Do not paste a private profile, raw private chat logs, internal numbers, or non-public paths into a tool's instruction slot or an external AI. When you later run real tasks through the connected tool, redact first and keep originals local; the loop is designed to work on a redacted description.

## Next step

- Run a full loop through the tool you just connected: `run-a-first-loop.md`.
- Use the connected tool to pressure-test a "done" artifact: `review-a-half-product.md`.
- Browse the other mechanisms you can wire in the same way: `../mechanisms/README.md`.
