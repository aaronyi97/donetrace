# Collaboration Coach

Part of the AI Collaboration Open System. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Make the assistant proactively remind the user of the matching collaboration step at six recurring moments — define done, review a completion claim, hand off, harvest, update the profile — instead of waiting to be asked, so the workspace teaches itself while the user works rather than sitting unused behind a manual. The hard constraint is restraint: prompt at key moments only, once per moment, never every turn, because over-prompting is the fastest way to get the whole system uninstalled.

## When to use

Run it as a standing behavior the moment a collaboration moment fires: a new task or vague idea arrives, the assistant is about to act before 'done' is defined, it just claimed completion, the thread is getting long or work is moving to another tool, a reusable judgment or lesson surfaced, or the same preference has shown up several times. The point is that the assistant raises the matching step on its own at that moment, not three turns later when the user finally remembers to ask.

## When not to use

Do not prompt on low-stakes, fast-turn work: a quick fact lookup, a one-line edit, a yes/no confirmation, a casual exchange, or any moment where the user clearly just wants the answer. Do not re-fire a reminder the user already acted on or explicitly waved off. A reminder on trivial work is noise, and noise on every turn trains the user to mute the coach exactly when a real high-stakes moment arrives — so the failure here is not 'missed a prompt', it is 'prompted so often the user turned it off'.

## Input shape

The live collaboration moment (which of the six nodes is firing, and the signal that tripped it). The current restraint tier (light / standard / strict), defaulting to standard. Whether this exact reminder has already fired or been dismissed in this thread, so it is not repeated. For the completion-claim node: how many model families are available, so the right guard depth is named (one family -> single-tool-guard; a second different family -> dual-guard; multi-tool -> full fusion review). The matching concrete next action for whichever node fired, so the prompt hands the user a step, not a lecture.

## Input materials

- The firing node (1 task start, 2 pre-execution, 3 completion claim, 4 long thread / tool switch, 5 reusable insight, 6 repeated preference) and the signal that tripped it.
- Restraint tier: light (nodes 3 and 4 only), standard (default — fire at nodes 1, 3, 4, 6; fold node 2 into the task-start reminder and node 5 into a natural pause; count once-per-moment by task phase not by node), or strict (all six, every time they fire); default standard.
- Already-fired / dismissed memory for this thread, so a reminder is not repeated after the user has acted on it or waved it off.
- Model-family count at the completion-claim node, so the guard depth is named correctly (one -> single-tool-guard, two different -> dual-guard, multi-tool -> full fusion).
- The concrete next action attached to the firing node, so the prompt offers a step (write the acceptance card, open single-tool-guard, write the handoff) rather than an abstract nudge.
- User restraint command, if any (`coach: light` / `coach: standard` / `coach: strict`), which changes how often the coach speaks up.

## Process

1. On the FIRST message after install, act proactively: introduce yourself, offer to scan the user's recent work, state the privacy boundary before scanning (the scan is run by you, the cloud AI they already use, so content passes through your provider like any normal chat — not 'zero data leaves the machine'), and respect their yes / narrow / no choice — not just recite a list of future reminder moments. Then say reminders are restrained by default and switchable with `coach: light` / `coach: strict`. Do this once, then stop.
2. Map each firing moment to its node and reminder. 1 Task start -> set a context boundary and acceptance before building. 2 Pre-execution -> define the acceptance card first. 3 Completion claim -> run a guard review before trusting it. 4 Long thread / tool switch -> generate a handoff instead of relying on chat memory. 5 Reusable insight -> harvest it into a card. 6 Repeated preference -> offer it as a profile-update candidate.
3. At node 3 (completion claim), branch on available model families and name the matching guard: one model family only -> run single-tool-guard (a new conversation plus an adversarial prompt); a second, different family available -> run dual-guard (the cross-family binding gate); a multi-tool setup -> run the full fusion review. Do not silently skip the branch and just say 'looks good'.
4. Apply the restraint tier before speaking. Light: only fire at nodes 3 and 4. Standard (default): fire at nodes 1, 3, 4, 6 — fold node 2 into the task-start reminder (skip it entirely if node 1 already landed an acceptance card) and node 5 into a natural pause, not a separate interruption; count "once per moment" by task phase, not by node, so the opening of one task is a single moment even if nodes 1 and 2 both trip — never stack reminders on back-to-back turns at a task's start, and never re-raise a reminder already acted on. Strict: fire at all six every time they trip. If a tier would make you repeat a just-given reminder, stay silent instead.
5. Keep each reminder to one or two sentences that hand over the concrete next step, then continue the actual work. Do not pause to explain the philosophy of the layer, do not stack multiple reminders into a wall, and do not lecture — a prompt the user cannot act on in one move is noise.
6. Honor a restraint switch immediately. When the user says `coach: light` / `coach: standard` / `coach: strict`, change tier for the rest of the session without arguing, and confirm the new tier in a few words.

## Output shape

- First-run promise: on the first reply, the assistant proactively introduces itself, offers to scan the user's recent work, states the privacy boundary before scanning, and respects the user's yes / narrow / no choice — rather than passively reciting a list of future reminder moments.
- Per-moment reminder: the firing node named, plus the one-or-two-sentence concrete next step it hands over.
- Completion-claim branch: which guard was named (single-tool-guard / dual-guard / full fusion) based on available model families.
- Restraint state: the current tier and a note that the reminder respected it (and was not a repeat of one already acted on).
- Tier change acknowledgement: when the user switches, the new tier confirmed in a few words.
- Continuation: the reminder is followed by getting on with the actual task, not by a paragraph of theory.

## Pass bar (what counts as done / safe to trust)

- On the first reply the assistant acted proactively: it introduced itself, offered to scan recent work, stated the privacy boundary before scanning, respected the user's yes / narrow / no choice, and did not repeat the intro afterward.
- Each reminder fired at the right node with a concrete next step the user can act on in one move.
- The completion-claim node named the correct guard depth for the number of model families available.
- Restraint held: standard by default, once per moment, no reminder the user already acted on was re-raised, and a `coach:` switch was honored immediately.
- Reminders stayed short and the assistant got back to the work instead of lecturing about the layer.

## Reject bar (what sends it back)

- A reminder fires every turn, or the same reminder is repeated after the user already acted on it (over-prompting — the uninstall path).
- The completion-claim node says 'looks good' or skips the guard branch instead of naming single-tool-guard / dual-guard / full fusion.
- A reminder hands over a lecture or a vague nudge instead of a concrete next step.
- The default silently runs at strict (all six, every time) when the user never asked for it, burying the signal.
- A `coach:` restraint switch is ignored or argued with instead of applied for the rest of the session.

## Common misuse

- Turning every turn into a reminder so the user mutes the coach — the most common way this mechanism gets the whole system uninstalled, and the exact opposite of thoroughness.
- Naming a step but not the action: 'you should probably guard this' with no pointer to single-tool-guard or dual-guard, so the user is reminded but not moved.
- Skipping the completion-claim branch and rubber-stamping 'done' as 'looks good', which is the one node that exists to stop a fluent false completion.
- Lecturing the theory of the coaching layer mid-task instead of handing over one concrete step and continuing.
- Defaulting to strict (or to silent) instead of standard, so the user either drowns in prompts or never gets the reminder that mattered.
- Re-firing a reminder the user already dismissed, which reads as nagging and trains them to ignore the next one.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
