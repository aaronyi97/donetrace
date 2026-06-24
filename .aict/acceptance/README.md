# Acceptance

What done means before work starts.

中文：先定义完成标准，再让 AI 干活。

## Purpose

Make success inspectable by defining observable outcomes, required artifacts, verification steps, and explicit non-acceptance conditions.

## When to use

Use before implementation, writing, research, design, cleanup, or any task where 'looks good' would be too vague.

## Input shape

Goal, expected artifacts, constraints, quality bar, verification command or manual check, and conditions that would reject the work.

## Output shape

An acceptance card that a reviewer can use to pass, reject, or request changes.

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
