# SCOUT Review Controller Prompt

This prompt belongs to the AI Collaboration Open System. Use it in a local-first workflow with public-safe or redacted material.

## Purpose

Separate exploration from decision so the assistant gathers options without prematurely choosing a path.

## Copy-paste prompt

```text
Use the SCOUT Review Controller mechanism from my local AI Collaboration Open System workspace.

Purpose:
Separate exploration from decision so the assistant gathers options without prematurely choosing a path.

Trigger:
Use when the task is ambiguous, cross-tool, or likely to be distorted by the first plausible answer.

Input:
[paste redacted task material, context package, and acceptance card here]

Process:
1. Scout collects candidate paths and evidence without deciding.
2. Reviewer attacks weak assumptions and missing evidence.
3. Controller selects the smallest path that changes the outcome.
4. Handoff records rejected paths so the next session does not reopen them by accident.

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
