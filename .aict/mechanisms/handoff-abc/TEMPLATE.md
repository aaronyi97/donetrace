# Handoff A/B/C Template

AI Collaboration Open System mechanism card. Fill this in a local-first workflow with public-safe or redacted material.

## Purpose

Externalize the current state into a structured handoff packet so ANY AI or session can pick up from where the work actually is, instead of the human re-explaining the background every time a tool or session changes. A/B/C are three handoff modes for three situations: A = high-interaction handoff (a human and AI trading turns inside the same tool, lightweight resume); B = programmatic handoff (a clear task an executor picks up and drives to completion on its own); C = delivery overview (a human-facing total account of what one phase produced). Whichever mode, the packet carries the same load-bearing fields so the receiver never starts from zero.

## Template

### Handoff mode (A high-interaction / B programmatic / C delivery overview) + why this mode:


### Current state (done / in flight / not started — as fact, not 'basically done'):


### Evidence behind each 'done' (or explicit 'no evidence yet'):


### Blocker / waiting-on (or 'none'):


### Next concrete action (one specific first move the receiver can act on):


### Baseline (exact commit / version / branch / state to start from):


### Stop condition (where this handoff ends and the receiver takes over):



## Pass bar (tick before you trust the result)

- The handoff mode (A / B / C) is named and fits the situation — a same-tool resume is not bloated into a full task packet, and a stranger-runnable task is not shrunk to a one-liner.
- The current state is written as fact, with no 'basically done' standing in for unverified work.
- Every claimed-done item has evidence attached, or is explicitly marked 'no evidence yet'.
- There is exactly one concrete next action the receiver can act on without asking what to do first.
- The baseline is pinned (commit / version / branch / state), so the receiver cannot pick up the wrong copy.
- A receiver with no access to the original chat could continue from this packet alone.

## Reject bar (send it back if any of these is true)

- No mode is chosen, so the packet is either too thin for a stranger to run or too heavy for a quick same-tool resume.
- The current state hides unverified work behind 'basically done' or 'almost there'.
- A 'done' claim has no evidence and is not marked as unverified — the receiver inherits a hidden gap.
- There is no concrete next action, or there are five vague ones and no single first move.
- The baseline is missing, so the receiver can silently start from the wrong version or a stale copy.
- The packet only makes sense to someone who already read the whole conversation, which defeats the purpose.

## Worked example

See `EXAMPLE.synthetic.md` for this same card filled out end to end on a public-safe synthetic task.

## Completion check

- The mechanism has a named trigger.
- The next action is concrete.
- Private details are redacted or rewritten as synthetic examples.
- The result can be handed to another AI tool without extra chat history.
