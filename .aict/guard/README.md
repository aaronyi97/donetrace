# Guard / Review

How output is challenged before trust.

中文：让另一个视角先挑错，再决定是否相信产物。

## Purpose

Challenge work against requirements, risks, privacy boundaries, evidence quality, and user intent before it becomes trusted output.

## When to use

Use after a draft, implementation, research answer, plan, or handoff that could mislead future work if wrong.

## Input shape

The artifact under review, acceptance card, context package, known constraints, and the specific review stance.

## Output shape

A review result with findings, severity, evidence, required fixes, and a pass or reject recommendation.

## Copy-paste prompt

See `PROMPT.md`. The prompt is designed to work in Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.

## Blank template

See `TEMPLATE.md`.

## Filled synthetic example

See `EXAMPLE.synthetic.md`.

## Common failure modes

See `FAILURE_MODES.md`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

1. Open the adapter for your tool in `../adapters/`.
2. Include `../adapters/SHARED_CORE_CONTRACT.md`.
3. Paste this layer's `PROMPT.md` plus either `TEMPLATE.md` or `EXAMPLE.synthetic.md`.
4. Ask the tool to return the layer's output shape exactly.
