# Acceptance Common Failure Modes

## Purpose

Make success inspectable by defining observable outcomes, required artifacts, verification steps, and explicit non-acceptance conditions.

## When to use

Read this before trusting a acceptance artifact.

## Input shape

The artifact plus the original context and acceptance card.

## Output shape

A short list of risks to fix before reuse.

## Copy-paste prompt

Ask your AI tool: "Check this acceptance artifact against the failure modes below and name the first concrete fix."

## Blank template

Use `TEMPLATE.md` to rewrite the artifact.

## Filled synthetic example

Use `EXAMPLE.synthetic.md` to compare a safe example.

## Common failure modes

- Defining acceptance after the answer is already written.
- Using subjective phrases like polished, robust, or complete without evidence.
- Skipping rejected states.
- Treating tests as proof when they do not cover the stated behavior.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this file after the artifact and ask for findings ordered by risk.
