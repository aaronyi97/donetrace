# Handoff

How the next session resumes without restarting.

中文：给下一棒留一个能直接接上的交接卡。

## Purpose

Transfer current state, decisions, evidence, blockers, and next actions to another session or tool without replaying the whole conversation.

## When to use

Use before stopping, switching tools, delegating to another assistant, or after any work that may need continuation.

## Input shape

Goal, current status, completed work, changed files or artifacts, decisions, verification evidence, blockers, and next action.

## Output shape

A short handoff note that separates done, pending, blocked, and unverified work.

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
