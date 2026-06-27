# Task Splitting Prompt

This prompt belongs to DoneTrace. Use it in a local-first workflow with public-safe or redacted material.

## Purpose

Before you hand a task to another AI, run a five-question pre-dispatch self-check; if any answer is yes, split the task by topic or deliverable (not by line count) into self-contained sub-packets, so a too-large prompt does not stall, overflow the context window, or collapse in quality midway.

## Copy-paste prompt

```text
Use the Task Splitting mechanism from my local DoneTrace workspace.

Purpose:
Before you hand a task to another AI, run a five-question pre-dispatch self-check; if any answer is yes, split the task by topic or deliverable (not by line count) into self-contained sub-packets, so a too-large prompt does not stall, overflow the context window, or collapse in quality midway.

Trigger:
Run the self-check before dispatching ANY non-trivial task to an external AI (a worker model, another tool, a fresh session). The point is to catch an oversized packet at the door, before the other side accepts it and quietly degrades.

Do not use when:
Do not split a task that already fits comfortably: a single focused change, one short input to read, one deliverable, well inside the model's context budget. Over-splitting has its own cost — it multiplies handoffs, scatters the work across packets, and makes the merge harder than the original task. If the self-check is all 'no', keep it as one packet.

Input:
[paste redacted task material, context package, and acceptance card here]

Process:
1. Run the five-question pre-dispatch self-check. Split if ANY answer is yes: (1) Are there too many required inputs to paste or read in one pass? (2) Does the task span multiple unrelated topics or deliverables? (3) Would it consume a large share of the model's context window? (4) Has this kind of task stalled or overflowed before? (5) Are you reusing one long prompt across different model families, where stale 'nearby' context from a prior run could bleed in? Treat all the numbers below as example values to calibrate for your own tools and model, not fixed law.
2. If the answer is split, cut by TOPIC or DELIVERABLE, never by line count. A natural seam is 'one self-contained outcome', not 'the first N lines'. Splitting by size alone produces packets that each carry half an idea.
3. Make every sub-packet self-contained: it states the full goal, its own slice of context, its own acceptance, and everything needed to run alone. A packet that cannot run without three others was not really split.
4. Forbid cross-references between sub-packets for each other's private content. Packet B must not say 'use what A produced'; if B needs something, restate it inside B. Cross-references re-create the giant task you were trying to avoid and make parallel work impossible.
5. Order the packets by dependency, pick the first one that can be verified on its own, and define the merge point: how the finished packets recombine into the original goal.
6. Defer lower-value slices with an explicit do-not-handle-yet note (why parked, when to revisit) so deferred work is parked on purpose, not silently dropped.

Output shape:
- Self-check result: each of the five questions answered yes/no, with the one-line reason any 'yes' triggers a split.
- Split decision: split or keep-as-one, and the seam used (which topics / deliverables).
- Sub-packet list: for each packet — its goal, its own inputs, its own acceptance, and a note that it is self-contained.
- Dependency order and the first independently verifiable packet.
- Merge point: how the packets recombine into the original goal.
- Deferred slices: anything parked, with a do-not-handle-yet reason and revisit condition.

Return:
- Decision-changing findings only
- Evidence used
- Required fixes
- Residual risk
- Next action

Pass bar (do not pass unless all hold):
- The five-question self-check was actually run and recorded before dispatch.
- Each sub-packet can run on its own: full goal, own context, own acceptance, no dependency on another packet's private content.
- The split follows topic / deliverable seams, so each packet is one coherent outcome rather than an arbitrary slice of size.
- There is a clear dependency order, a first verifiable packet, and a stated merge point.
- Deferred work has an explicit do-not-handle-yet note, so nothing was silently dropped.

Reject bar (send back if any holds):
- The task was dispatched whole even though a self-check answer was yes (the oversized packet that stalls or degrades midway).
- It was split by line count or file count instead of by topic / deliverable, so packets each carry partial ideas.
- A sub-packet says 'use what the other packet produced', re-creating the monolith and blocking parallel work.
- A packet cannot run alone because its goal, context, or acceptance lives in a different packet.
- Lower-value work was dropped with no do-not-handle-yet note, so it silently disappears.

Rules:
- Work from provided material only.
- Keep private material local.
- Use public-safe synthetic wording for examples.
- Label assumptions and unverified claims.
```

## Full worked example

See `EXAMPLE.synthetic.md` for this prompt run from start to finish on a public-safe synthetic task.
