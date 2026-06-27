# Half-Product Review Prompt

This prompt belongs to DoneTrace. Use it in a local-first workflow with public-safe or redacted material.

## Purpose

Block confident claims when the project has docs, demos, or architecture but no runnable first experience.

## Copy-paste prompt

```text
Use the Half-Product Review mechanism from my local DoneTrace workspace.

Purpose:
Block confident claims when the project has docs, demos, or architecture but no runnable first experience.

Trigger:
Use before release, README polish, launch copy, or any claim that a stranger can use the system.

Input:
[paste redacted task material, context package, and acceptance card here]

Process:
1. Inspect the first ten minutes as a user would experience them.
2. Check whether docs point to runnable artifacts.
3. Reject strategy prose that is not backed by files or commands.
4. List the smallest fixes required before public labeling.

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
