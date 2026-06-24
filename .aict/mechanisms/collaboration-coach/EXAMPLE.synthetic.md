# Collaboration Coach Synthetic Example

This is a public-safe synthetic example for the AI Collaboration Open System. It is local-first and contains no private account, customer, route, hook, or conversation material.

## Synthetic example

A synthetic execution session reaches a 'done, implemented and tested' claim. At the completion-claim node the coach fires once, sees only one model family is available, and points the user to single-tool-guard (new conversation plus an adversarial prompt) instead of accepting the fluent claim — then continues, without lecturing.

## Full worked example (filled end to end)

A solo user is working in one AI tool on a small synthetic feature. The coach runs at standard. The session passes through several collaboration moments; this shows the coach firing at the completion-claim node, once, with a concrete next step.

### First-run promise (stated once, at session start)
"I'll remind you at a few key moments — defining done, reviewing a completion claim, generating a handoff, harvesting reusable lessons, and updating your stable profile. You don't need to read a manual first; just follow the prompts. Reminders are restrained by default — say 'coach: light' or 'coach: strict' to change how often I speak up." Then it stops and gets to work; it does not repeat this.

### Firing node and signal
Node 3, completion claim. The execution assistant just returned: "Done. I implemented the new sort option and added a test; everything passes." That 'done / everything passes' phrasing is the signal.

### Restraint tier in effect
Standard (default). Nodes 1 and 2 already fired once earlier this session (a one-line 'want to set acceptance first?' at task start), so they are not re-raised. Node 3 has not fired yet, so it may fire now — once.

### Matching reminder (one or two sentences, concrete next step)
"Before trusting that 'done', this is the completion-claim moment — worth a guard review. You're on a single tool right now, so the fitting move is single-tool-guard: open a fresh conversation and paste an adversarial reviewer prompt against this claim. Want the prompt?"

### Completion-claim branch
Only one model family is available, so the coach named single-tool-guard (new conversation + adversarial prompt), explicitly NOT dual-guard. It noted in passing that if a second, different model family were available, the stronger move would be the cross-family dual-guard, and a multi-tool setup would run the full fusion review.

### Tier change to acknowledge
None this turn. (If the user had said 'coach: light', the coach would have confirmed 'switched to light — I'll only flag completion claims and tool switches now' and applied it for the rest of the session.)

### Continue the actual task
After the one reminder, the coach drops it and continues helping with the feature. It does not re-raise the guard reminder on the next turn, and it does not deliver a paragraph on why guarding matters — the user already has the one step they can act on.

## How the mechanism changes the outcome

Without this mechanism, a single assistant can produce a smooth answer while hiding uncertainty. With this mechanism, the workflow records trigger, evidence, decision, residual risk, and next action.

## Reuse note

Copy the shape, not the synthetic facts. Adapt the template to your own redacted task.
