---
name: profile
description: Build and maintain collaboration profiles.
---

# profile skill

## When to use

Use before recurring or high-context work where the assistant's tone, autonomy, challenge style, and safety boundaries affect the result.

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

1. Extract reusable collaboration preferences from redacted material.
2. Separate stable preferences from task facts.
3. Mark inferred preferences as provisional until confirmed.
4. Return a compact profile card that future sessions can apply.

## Output

- Working style
- Decision preferences
- Hard boundaries
- Challenge and review preferences
- Update rule

## Safety

- Do not store secrets, client names, local paths, account details, or raw private conversations.
- Do not infer identity traits that the user did not provide.
- Do not turn a temporary mood into a permanent rule.

## Example

Create a profile that says: direct risk calls, no publishing without consent, ask before irreversible actions. Include a short evidence note for every stable preference: 'seen in repeated release work' is acceptable, while 'user sounded impatient once' stays provisional. The profile should help the next assistant choose autonomy level, response length, challenge style, and consent boundaries without copying private task history.
