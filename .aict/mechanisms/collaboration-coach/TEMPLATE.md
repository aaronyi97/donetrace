# Collaboration Coach Template

DoneTrace mechanism card. Fill this in a local-first workflow with public-safe or redacted material.

## Purpose

Make the assistant proactively remind the user of the matching collaboration step at six recurring moments — define done, review a completion claim, hand off, harvest, update the profile — instead of waiting to be asked, so the workspace teaches itself while the user works rather than sitting unused behind a manual. The hard constraint is restraint: prompt at key moments only, once per moment, never every turn, because over-prompting is the fastest way to get the whole system uninstalled.

## Template

### First-run promise (one-time, trigger-driven — on the first-run trigger line / a start request, NOT auto on the first reply: introduce + offer to scan + state the privacy boundary + respect yes / narrow / no):


### Firing node (1-6) and the signal that tripped it:


### Restraint tier in effect (light / standard / strict; default standard):


### Already fired or dismissed this thread? (if yes, stay silent):


### Matching reminder (one or two sentences, hands over the concrete next step):


### Completion-claim branch (one family -> single-tool-guard / two different -> dual-guard / multi-tool -> full fusion):


### Tier change to acknowledge (if the user said coach: light / standard / strict):


### Continue the actual task:



## Pass bar (tick before you trust the result)

- When the user sent the first-run trigger line (or otherwise asked to start), the assistant ran the one-time onboarding: it introduced itself, offered to scan recent work, stated the privacy boundary before scanning, respected the user's yes / narrow / no choice, and did not repeat the intro afterward — and it did not fire this onboarding automatically on an unrelated first reply.
- Each reminder fired at the right node with a concrete next step the user can act on in one move.
- The completion-claim node named the correct guard depth for the number of model families available.
- Restraint held: standard by default, once per moment, no reminder the user already acted on was re-raised, and a `coach:` switch was honored immediately.
- Reminders stayed short and the assistant got back to the work instead of lecturing about the layer.

## Reject bar (send it back if any of these is true)

- A reminder fires every turn, or the same reminder is repeated after the user already acted on it (over-prompting — the uninstall path).
- The completion-claim node says 'looks good' or skips the guard branch instead of naming single-tool-guard / dual-guard / full fusion.
- A reminder hands over a lecture or a vague nudge instead of a concrete next step.
- The default silently runs at strict (all six, every time) when the user never asked for it, burying the signal.
- A `coach:` restraint switch is ignored or argued with instead of applied for the rest of the session.

## Worked example

See `EXAMPLE.synthetic.md` for this same card filled out end to end on a public-safe synthetic task.

## Completion check

- The mechanism has a named trigger.
- The next action is concrete.
- Private details are redacted or rewritten as synthetic examples.
- The result can be handed to another AI tool without extra chat history.
