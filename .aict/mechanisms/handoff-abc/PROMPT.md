# Handoff A/B/C Prompt

This prompt belongs to the AI Collaboration Open System. Use it in a local-first workflow with public-safe or redacted material.

## Purpose

Externalize the current state into a structured handoff packet so ANY AI or session can pick up from where the work actually is, instead of the human re-explaining the background every time a tool or session changes. A/B/C are three handoff modes for three situations: A = high-interaction handoff (a human and AI trading turns inside the same tool, lightweight resume); B = programmatic handoff (a clear task an executor picks up and drives to completion on its own); C = delivery overview (a human-facing total account of what one phase produced). Whichever mode, the packet carries the same load-bearing fields so the receiver never starts from zero.

## Copy-paste prompt

```text
Use the Handoff A/B/C mechanism from my local AI Collaboration Open System workspace.

Purpose:
Externalize the current state into a structured handoff packet so ANY AI or session can pick up from where the work actually is, instead of the human re-explaining the background every time a tool or session changes. A/B/C are three handoff modes for three situations: A = high-interaction handoff (a human and AI trading turns inside the same tool, lightweight resume); B = programmatic handoff (a clear task an executor picks up and drives to completion on its own); C = delivery overview (a human-facing total account of what one phase produced). Whichever mode, the packet carries the same load-bearing fields so the receiver never starts from zero.

Trigger:
Use whenever continuity is about to break or pass to someone else: a session stops with the work half-done, a different AI tool takes over, a long task crosses a natural seam, or a phase finishes and someone needs the result without reading the whole chat. Pick A for a same-tool resume, B for handing a defined task to an executor, C for reporting a finished phase to a human.

Do not use when:
Skip a full handoff packet for work that is not actually being passed on: a single self-contained reply you finish in the same turn, a throwaway exploration nobody will continue, or a trivial step where re-explaining the context would take less than writing the packet. A heavy handoff on work that never gets handed off is pure overhead, and overhead with no payoff trains people to skip the packet when a real handoff finally needs it.

Input:
[paste redacted task material, context package, and acceptance card here]

Process:
1. Pick the handoff mode first. A = high-interaction: a human and AI are mid-conversation in one tool and you just need a lightweight 'where we are' so the next turn continues cleanly. B = programmatic: you are handing a defined task to an executor (another tool or fresh session) that will run it to completion on its own, so the packet must be self-contained. C = delivery overview: a phase is finished and a human needs the total account, so the packet is a readable result summary, not a work ticket. The mode decides how much the packet carries.
2. Write the current state as fact, not optimism. Say what is actually done, what is in flight, and what has not started. Resist 'basically done' — if it is not verified, it is not done. This block is the whole point: it is what lets the receiver skip 're-explain the background'.
3. Attach the evidence for each claimed-done item: the test that passed, the command output, the reviewed artifact. Where there is no evidence yet, say so plainly. State without evidence is a guess wearing a fact's clothes.
4. Name the blocker or waiting-on, if any, and the single most concrete next action. The next action must be specific enough to act on immediately — 'run the package dry-run against a temp cache and check the file list', not 'continue the task'.
5. Pin the baseline: the exact commit / version / branch / state the receiver starts from. Without it, a parallel edit or a stale copy silently diverges and the handoff lands on the wrong work.
6. Hand off in the chosen mode and stop at the stated stop condition. For A, keep it short and resume in place. For B, the executor takes it and drives to completion. For C, the human reads the overview and decides. Do not pad an A resume into a full B packet, and do not shrink a B packet a stranger must run alone down to an A-sized note.

Output shape:
- Handoff mode: A (high-interaction resume) / B (programmatic task) / C (delivery overview), and one line on why that mode fits.
- Current state: what is done / in flight / not started, written as fact.
- Evidence: the proof behind each 'done', or an explicit 'no evidence yet'.
- Blocker / waiting-on: what is stopping progress, or 'none'.
- Next concrete action: the single specific first move the receiver should make.
- Baseline: the exact commit / version / branch / state to start from.
- Stop condition: where this handoff ends and the receiver takes over.

Return:
- Decision-changing findings only
- Evidence used
- Required fixes
- Residual risk
- Next action

Pass bar (do not pass unless all hold):
- The handoff mode (A / B / C) is named and fits the situation — a same-tool resume is not bloated into a full task packet, and a stranger-runnable task is not shrunk to a one-liner.
- The current state is written as fact, with no 'basically done' standing in for unverified work.
- Every claimed-done item has evidence attached, or is explicitly marked 'no evidence yet'.
- There is exactly one concrete next action the receiver can act on without asking what to do first.
- The baseline is pinned (commit / version / branch / state), so the receiver cannot pick up the wrong copy.
- A receiver with no access to the original chat could continue from this packet alone.

Reject bar (send back if any holds):
- No mode is chosen, so the packet is either too thin for a stranger to run or too heavy for a quick same-tool resume.
- The current state hides unverified work behind 'basically done' or 'almost there'.
- A 'done' claim has no evidence and is not marked as unverified — the receiver inherits a hidden gap.
- There is no concrete next action, or there are five vague ones and no single first move.
- The baseline is missing, so the receiver can silently start from the wrong version or a stale copy.
- The packet only makes sense to someone who already read the whole conversation, which defeats the purpose.

Rules:
- Work from provided material only.
- Keep private material local.
- Use public-safe synthetic wording for examples.
- Label assumptions and unverified claims.
```

## Full worked example

See `EXAMPLE.synthetic.md` for this prompt run from start to finish on a public-safe synthetic task.
