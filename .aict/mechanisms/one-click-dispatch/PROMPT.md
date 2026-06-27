# One-Click Dispatch Prompt

This prompt belongs to DoneTrace. Use it in a local-first workflow with public-safe or redacted material.

## Purpose

Turn a messy task into a compact work packet another AI tool can execute without inheriting the whole chat.

## Copy-paste prompt

```text
Use the One-Click Dispatch mechanism from my local DoneTrace workspace.

Purpose:
Turn a messy task into a compact work packet another AI tool can execute without inheriting the whole chat.

Trigger:
Use when handing a task from a controller session to Codex, Claude Code, Cursor, Cline, Windsurf, or Copilot.

Input:
[paste redacted task material, context package, and acceptance card here]

Process:
1. Package only the state required to act.
2. State authority: read-only, write allowed, review-only, or handoff-only.
3. Attach acceptance and stop conditions.
4. Require the worker to return changed artifacts, verification evidence, blockers, and unverified claims.

Return:
- Decision-changing findings only
- Evidence used
- Required fixes
- Residual risk
- Next action

Rules:
- Work from provided material only.
- Keep private material local.
- Use public-safe synthetic wording for examples.
- Label assumptions and unverified claims.
```
