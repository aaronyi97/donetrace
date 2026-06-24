# Profile Common Failure Modes

## Purpose

Capture stable collaboration preferences that affect how an assistant should ask, decide, challenge, summarize, and hand work back.

## When to use

Read this before trusting a profile artifact.

## Input shape

The artifact plus the original context and acceptance card.

## Output shape

A short list of risks to fix before reuse.

## Copy-paste prompt

Ask your AI tool: "Check this profile artifact against the failure modes below and name the first concrete fix."

## Blank template

Use `TEMPLATE.md` to rewrite the artifact.

## Filled synthetic example

Use `EXAMPLE.synthetic.md` to compare a safe example.

## Common failure modes

- Treating a profile as a personality essay instead of operational guidance.
- Storing secrets, account details, or private identity signals.
- Mixing task context into the stable profile and making future sessions stale.
- Letting the assistant infer values without user confirmation.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this file after the artifact and ask for findings ordered by risk.
