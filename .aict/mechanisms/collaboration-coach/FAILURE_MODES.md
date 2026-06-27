# Collaboration Coach Failure Modes

DoneTrace failure checklist. Use it in a local-first workflow before trusting a mechanism run, and rewrite any public example into public-safe language.

## Failure modes

- The coach fires a reminder on every turn until the user switches it off entirely, losing the one prompt that would have mattered.
- The completion-claim node is reduced to 'looks good' and never names a guard, so a fluent false 'done' passes unchallenged.
- Reminders arrive as theory lectures rather than one concrete next step, so the user reads them as noise and stops acting on them.

## Common misuse (operator errors that look fine but break the mechanism)

- Turning every turn into a reminder so the user mutes the coach — the most common way this mechanism gets the whole system uninstalled, and the exact opposite of thoroughness.
- Naming a step but not the action: 'you should probably guard this' with no pointer to single-tool-guard or dual-guard, so the user is reminded but not moved.
- Skipping the completion-claim branch and rubber-stamping 'done' as 'looks good', which is the one node that exists to stop a fluent false completion.
- Lecturing the theory of the coaching layer mid-task instead of handing over one concrete step and continuing.
- Defaulting to strict (or to silent) instead of standard, so the user either drowns in prompts or never gets the reminder that mattered.
- Re-firing a reminder the user already dismissed, which reads as nagging and trains them to ignore the next one.

## Guard questions

1. Did this mechanism change the decision, or just add ceremony?
2. Is any private material copied instead of summarized or synthesized?
3. Are blockers, residual risks, and next actions separated?
4. Could a new session continue from this file alone?
