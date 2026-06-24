# Handoff A/B/C

Part of the AI Collaboration Open System. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Externalize the current state into a structured handoff packet so ANY AI or session can pick up from where the work actually is, instead of the human re-explaining the background every time a tool or session changes. A/B/C are three handoff modes for three situations: A = high-interaction handoff (a human and AI trading turns inside the same tool, lightweight resume); B = programmatic handoff (a clear task an executor picks up and drives to completion on its own); C = delivery overview (a human-facing total account of what one phase produced). Whichever mode, the packet carries the same load-bearing fields so the receiver never starts from zero.

## When to use

Use whenever continuity is about to break or pass to someone else: a session stops with the work half-done, a different AI tool takes over, a long task crosses a natural seam, or a phase finishes and someone needs the result without reading the whole chat. Pick A for a same-tool resume, B for handing a defined task to an executor, C for reporting a finished phase to a human.

## When not to use

Skip a full handoff packet for work that is not actually being passed on: a single self-contained reply you finish in the same turn, a throwaway exploration nobody will continue, or a trivial step where re-explaining the context would take less than writing the packet. A heavy handoff on work that never gets handed off is pure overhead, and overhead with no payoff trains people to skip the packet when a real handoff finally needs it.

## Input shape

Where the work is now (what is done, in plain state terms). The evidence that backs that state (command output, test result, a reviewed artifact, or a clear note that none exists yet). What it is blocked or waiting on, if anything. The single most concrete next action the receiver should take first. The baseline: the exact version, commit, branch, or state the receiver should start from, so they do not pick up the wrong copy. Which handoff mode applies (A high-interaction / B programmatic / C delivery overview), because it changes how much context the packet carries.

## Input materials

- Current state — where the work actually is, written as fact not hope: what is finished, what is in flight, what has not been started. This is the field that replaces 're-explain the background'.
- Supporting evidence — the proof each piece of 'done' rests on (a passing test, a command's output, a reviewed file), or an explicit 'no evidence yet' so the receiver does not over-trust the state.
- Blocker / waiting-on — what is stopping forward progress right now (a missing decision, an unfinished dependency, an unanswered question), or 'none'.
- Next concrete action — the one specific first move the receiver should make, phrased so they can act without asking 'so what do I do first?'.
- Baseline — the exact starting point: version, commit, branch, file set, or named state the receiver must begin from, so a handoff cannot land on the wrong copy.
- Handoff mode — A (high-interaction same-tool resume), B (programmatic task an executor drives alone), or C (delivery overview for a human), since the mode sets how lightweight or complete the packet should be.

## Process

1. Pick the handoff mode first. A = high-interaction: a human and AI are mid-conversation in one tool and you just need a lightweight 'where we are' so the next turn continues cleanly. B = programmatic: you are handing a defined task to an executor (another tool or fresh session) that will run it to completion on its own, so the packet must be self-contained. C = delivery overview: a phase is finished and a human needs the total account, so the packet is a readable result summary, not a work ticket. The mode decides how much the packet carries.
2. Write the current state as fact, not optimism. Say what is actually done, what is in flight, and what has not started. Resist 'basically done' — if it is not verified, it is not done. This block is the whole point: it is what lets the receiver skip 're-explain the background'.
3. Attach the evidence for each claimed-done item: the test that passed, the command output, the reviewed artifact. Where there is no evidence yet, say so plainly. State without evidence is a guess wearing a fact's clothes.
4. Name the blocker or waiting-on, if any, and the single most concrete next action. The next action must be specific enough to act on immediately — 'run the package dry-run against a temp cache and check the file list', not 'continue the task'.
5. Pin the baseline: the exact commit / version / branch / state the receiver starts from. Without it, a parallel edit or a stale copy silently diverges and the handoff lands on the wrong work.
6. Hand off in the chosen mode and stop at the stated stop condition. For A, keep it short and resume in place. For B, the executor takes it and drives to completion. For C, the human reads the overview and decides. Do not pad an A resume into a full B packet, and do not shrink a B packet a stranger must run alone down to an A-sized note.

## Output shape

- Handoff mode: A (high-interaction resume) / B (programmatic task) / C (delivery overview), and one line on why that mode fits.
- Current state: what is done / in flight / not started, written as fact.
- Evidence: the proof behind each 'done', or an explicit 'no evidence yet'.
- Blocker / waiting-on: what is stopping progress, or 'none'.
- Next concrete action: the single specific first move the receiver should make.
- Baseline: the exact commit / version / branch / state to start from.
- Stop condition: where this handoff ends and the receiver takes over.

## Pass bar (what counts as done / safe to trust)

- The handoff mode (A / B / C) is named and fits the situation — a same-tool resume is not bloated into a full task packet, and a stranger-runnable task is not shrunk to a one-liner.
- The current state is written as fact, with no 'basically done' standing in for unverified work.
- Every claimed-done item has evidence attached, or is explicitly marked 'no evidence yet'.
- There is exactly one concrete next action the receiver can act on without asking what to do first.
- The baseline is pinned (commit / version / branch / state), so the receiver cannot pick up the wrong copy.
- A receiver with no access to the original chat could continue from this packet alone.

## Reject bar (what sends it back)

- No mode is chosen, so the packet is either too thin for a stranger to run or too heavy for a quick same-tool resume.
- The current state hides unverified work behind 'basically done' or 'almost there'.
- A 'done' claim has no evidence and is not marked as unverified — the receiver inherits a hidden gap.
- There is no concrete next action, or there are five vague ones and no single first move.
- The baseline is missing, so the receiver can silently start from the wrong version or a stale copy.
- The packet only makes sense to someone who already read the whole conversation, which defeats the purpose.

## Common misuse

- Writing every handoff as a maximal B packet, including a two-line same-tool resume, so the heavy ceremony makes people stop writing handoffs at all.
- Letting the current-state block drift into wishful 'basically done' instead of fact, so the receiver trusts work that was never verified.
- Giving the state with no evidence and no 'unverified' label, so a guess gets inherited as a confirmed fact.
- Listing decision points and options but no single concrete next action, leaving the receiver to re-derive 'so what do I actually do first?'.
- Skipping the baseline because 'it's obvious', then a parallel edit or stale checkout makes the receiver continue on the wrong copy.
- Writing a packet that silently assumes the original chat history, so it only works for the same session it was meant to replace.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
