# Task Splitting Template

AI Collaboration Open System mechanism card. Fill this in a local-first workflow with public-safe or redacted material.

## Purpose

Before you hand a task to another AI, run a five-question pre-dispatch self-check; if any answer is yes, split the task by topic or deliverable (not by line count) into self-contained sub-packets, so a too-large prompt does not stall, overflow the context window, or collapse in quality midway.

## Template

### Main goal (one sentence):


### Pre-dispatch self-check (answer each; any yes = split; numbers are example values, tune for your tools):


###   Q1 too many required inputs to read in one pass?


###   Q2 spans multiple unrelated topics / deliverables?


###   Q3 would consume a large share of the context window?


###   Q4 has this shape of task stalled / overflowed before?


###   Q5 reusing one long prompt across model families (nearby-context bleed risk)?


### Split decision and seam (by topic / deliverable, never by line count):


### Sub-packets (each self-contained: goal + own inputs + own acceptance; no cross-references):


### Dependency order:


### First independently verifiable packet:


### Merge point:


### Deferred slices (with do-not-handle-yet reason + revisit condition):



## Pass bar (tick before you trust the result)

- The five-question self-check was actually run and recorded before dispatch.
- Each sub-packet can run on its own: full goal, own context, own acceptance, no dependency on another packet's private content.
- The split follows topic / deliverable seams, so each packet is one coherent outcome rather than an arbitrary slice of size.
- There is a clear dependency order, a first verifiable packet, and a stated merge point.
- Deferred work has an explicit do-not-handle-yet note, so nothing was silently dropped.

## Reject bar (send it back if any of these is true)

- The task was dispatched whole even though a self-check answer was yes (the oversized packet that stalls or degrades midway).
- It was split by line count or file count instead of by topic / deliverable, so packets each carry partial ideas.
- A sub-packet says 'use what the other packet produced', re-creating the monolith and blocking parallel work.
- A packet cannot run alone because its goal, context, or acceptance lives in a different packet.
- Lower-value work was dropped with no do-not-handle-yet note, so it silently disappears.

## Worked example

See `EXAMPLE.synthetic.md` for this same card filled out end to end on a public-safe synthetic task.

## Completion check

- The mechanism has a named trigger.
- The next action is concrete.
- Private details are redacted or rewritten as synthetic examples.
- The result can be handed to another AI tool without extra chat history.
