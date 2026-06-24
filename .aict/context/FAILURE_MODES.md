# Context Common Failure Modes

## Purpose

Package the task so an assistant can start from the right boundary, evidence, constraints, and unknowns without reading the whole history.

## When to use

Read this before trusting a context artifact.

## Input shape

The artifact plus the original context and acceptance card.

## Output shape

A short list of risks to fix before reuse.

## Copy-paste prompt

Ask your AI tool: "Check this context artifact against the failure modes below and name the first concrete fix."

## Blank template

Use `TEMPLATE.md` to rewrite the artifact.

## Filled synthetic example

Use `EXAMPLE.synthetic.md` to compare a safe example.

## Common failure modes

- Dumping the whole history instead of compressing decision-changing facts.
- Not labeling assumptions.
- Forgetting non-goals, causing assistants to expand scope.
- Including private file paths or raw conversations.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this file after the artifact and ask for findings ordered by risk.
