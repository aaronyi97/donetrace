# Harvest Common Failure Modes

## Purpose

Extract reusable patterns, prompts, decisions, examples, and rule-update candidates from completed work.

## When to use

Read this before trusting a harvest artifact.

## Input shape

The artifact plus the original context and acceptance card.

## Output shape

A short list of risks to fix before reuse.

## Copy-paste prompt

Ask your AI tool: "Check this harvest artifact against the failure modes below and name the first concrete fix."

## Blank template

Use `TEMPLATE.md` to rewrite the artifact.

## Filled synthetic example

Use `EXAMPLE.synthetic.md` to compare a safe example.

## Common failure modes

- Harvesting everything and creating clutter.
- Turning one example into a universal rule.
- Saving private raw material instead of synthetic or redacted learning.
- Not linking harvest back to future reuse.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this file after the artifact and ask for findings ordered by risk.
