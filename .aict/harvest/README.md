# Harvest

What becomes reusable knowledge or material.

中文：把一次任务里可复用的经验收回来，而不是让它消失在聊天里。

## Purpose

Extract reusable patterns, prompts, decisions, examples, and rule-update candidates from completed work.

## When to use

Use after a task loop, review, failed attempt, content draft, research synthesis, or repeated workflow friction.

## Input shape

Final artifact, review result, decisions made, surprising lessons, repeated pain points, and reusable snippets.

## Output shape

A harvest seed with reusable material, where to store it, and what should not be generalized.

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
