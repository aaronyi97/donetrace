# Profile

How the AI adapts to the user's working style, constraints, and decision habits.

中文：让 AI 先知道怎样配合这个人，而不是每次都按通用助理口吻开始。

## Purpose

Capture stable collaboration preferences that affect how an assistant should ask, decide, challenge, summarize, and hand work back.

## When to use

Use before long tasks, recurring work, cross-tool handoffs, or any situation where tone, risk appetite, and decision rules matter.

## Input shape

A short description of the user's role, work type, preferred feedback style, constraints, review habits, and known failure patterns.

## Output shape

A compact profile card with preferences, hard boundaries, collaboration defaults, and update rules.

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
