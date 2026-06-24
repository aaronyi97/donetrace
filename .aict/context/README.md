# Context

What the task boundary is, what is known, and what should not be assumed.

中文：把当前任务边界写清楚，避免新会话靠猜。

## Purpose

Package the task so an assistant can start from the right boundary, evidence, constraints, and unknowns without reading the whole history.

## When to use

Use at the start of any task that spans more than one message, touches files, involves judgment, or may be resumed later.

## Input shape

Goal, current state, relevant files or links, constraints, non-goals, known facts, assumptions, risks, and open questions.

## Output shape

A context package that lets another assistant continue without inventing missing background.

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
