# Handoff Common Failure Modes

## Purpose

Transfer current state, decisions, evidence, blockers, and next actions to another session or tool without replaying the whole conversation.

## When to use

Read this before trusting a handoff artifact.

## Input shape

The artifact plus the original context and acceptance card.

## Output shape

A short list of risks to fix before reuse.

## Copy-paste prompt

Ask your AI tool: "Check this handoff artifact against the failure modes below and name the first concrete fix."

## Blank template

Use `TEMPLATE.md` to rewrite the artifact.

## Filled synthetic example

Use `EXAMPLE.synthetic.md` to compare a safe example.

## Common failure modes

- Writing a narrative summary instead of a resumable state card.
- Not separating completed from unverified.
- Omitting blockers and causing the next assistant to guess.
- Leaving no exact next action.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this file after the artifact and ask for findings ordered by risk.
