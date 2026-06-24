# Profile refinement

Purpose: Update an existing profile with only stable new preferences.

## Scenario

Use after several sessions reveal a repeated working preference or a profile rule is causing friction.

## Input requirements

- Current profile card.
- New evidence from at least one recent task.
- Whether the user explicitly confirmed the new preference.

## Operating steps

1. Compare new evidence against the existing profile.
2. Classify each candidate as stable, task-specific, contradictory, or unsafe to store.
3. Preserve older rules unless there is clear replacement evidence.
4. Return a patch-style update instead of rewriting the whole profile.

## Copy-paste prompt

```text
You are helping me with profile refinement in a local-first AI collaboration workspace.

Task: Update an existing profile with only stable new preferences.

Scenario:
Use after several sessions reveal a repeated working preference or a profile rule is causing friction.

Instructions:
- Work only from the material I provide.
- Follow these steps:
  1. Compare new evidence against the existing profile.
  2. Classify each candidate as stable, task-specific, contradictory, or unsafe to store.
  3. Preserve older rules unless there is clear replacement evidence.
  4. Return a patch-style update instead of rewriting the whole profile.
- Do not claim to understand my private business beyond the provided context.
- Return the expected output shape below.

Material:
[paste redacted material here]
```

## Expected output

- Keep unchanged
- Add
- Revise
- Do not store
- Open confirmation question

## Failure modes

- Overwriting the profile because one task went badly.
- Adding private operational detail as if it were a collaboration preference.
- Hiding uncertainty by merging contradictory preferences.

## Example

Current profile says 'ask before execution.' New evidence says user now gives task-level authorization for explicit implementation requests. Output a narrow revision with the exact trigger.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
