# Guard / Review Common Failure Modes

## Purpose

Challenge work against requirements, risks, privacy boundaries, evidence quality, and user intent before it becomes trusted output.

## When to use

Read this before trusting a guard / review artifact.

## Input shape

The artifact plus the original context and acceptance card.

## Output shape

A short list of risks to fix before reuse.

## Copy-paste prompt

Ask your AI tool: "Check this guard / review artifact against the failure modes below and name the first concrete fix."

## Blank template

Use `TEMPLATE.md` to rewrite the artifact.

## Filled synthetic example

Use `EXAMPLE.synthetic.md` to compare a safe example.

## Common failure modes

- Reviewing style instead of requirements.
- Letting the same assistant rubber-stamp its own work.
- Listing vague concerns without actionable fixes.
- Calling something passed without checking the acceptance card.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this file after the artifact and ask for findings ordered by risk.
