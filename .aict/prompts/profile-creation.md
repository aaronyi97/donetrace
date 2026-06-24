# Profile creation

Purpose: Create a reusable collaboration profile from a redacted user description.

## Scenario

Use when a user is starting a new AI workspace and wants future sessions to know how to collaborate without storing private secrets.

## Input requirements

- Redacted description of the user's work and preferred feedback style.
- Known boundaries: actions the assistant must not take without consent.
- Examples of useful and unhelpful assistant behavior.

## Operating steps

1. Extract stable preferences only; ignore one-off task facts.
2. Separate communication style, decision rules, safety boundaries, and update triggers.
3. Ask no more than three questions if a boundary is ambiguous.
4. Mark any inferred preference as provisional.

## Copy-paste prompt

```text
You are helping me with profile creation in a local-first AI collaboration workspace.

Task: Create a reusable collaboration profile from a redacted user description.

Scenario:
Use when a user is starting a new AI workspace and wants future sessions to know how to collaborate without storing private secrets.

Instructions:
- Work only from the material I provide.
- Follow these steps:
  1. Extract stable preferences only; ignore one-off task facts.
  2. Separate communication style, decision rules, safety boundaries, and update triggers.
  3. Ask no more than three questions if a boundary is ambiguous.
  4. Mark any inferred preference as provisional.
- Do not claim to understand my private business beyond the provided context.
- Return the expected output shape below.

Material:
[paste redacted material here]
```

## Expected output

- Profile summary
- Collaboration defaults
- Hard boundaries
- Review and challenge preferences
- When to update this profile

## Failure modes

- Turning the profile into a biography.
- Saving secrets, customer names, local paths, or raw private conversations.
- Treating a single emotional moment as a permanent preference.

## Example

Input: 'I build prototypes alone and hate vague reassurance.' Output: 'Use direct risk calls, short options, and evidence labels; do not make purchases or publish without explicit consent.'

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
