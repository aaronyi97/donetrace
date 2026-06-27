# 06 How to Adapt to Your Workflow

DoneTrace is local-first and tool-agnostic. You adapt it by copying files into the AI tools you already use.

## Codex

Paste the shared contract, context package, and acceptance card into the task. Ask Codex to return changed files, checks run, failures, and unverified areas.

## Claude Code

Use the same context and acceptance files. For review work, ask Claude Code to act as system guardian and lead with findings.

## Cursor or Copilot

Keep the shared contract in project instructions. For each task, attach context and acceptance, then save a handoff note before stopping.

## Cline or Windsurf

Use adapter guidance as a thin pointer to `.aict/`. Do not maintain a second rule system inside the tool.

## Team workflow

1. Keep `.aict/` in a repo or local folder.
2. Redact before sharing.
3. Make every long task produce context, acceptance, guard, handoff, and harvest.
4. Use mechanisms only when they reduce real risk or drift.
5. Run `ai-collab check --workspace <dir>` before trusting a generated workspace.

## Adaptation rule

Change examples and language freely, but keep the loop: context before execution, acceptance before completion, guard before trust, handoff before switching, harvest after learning.
