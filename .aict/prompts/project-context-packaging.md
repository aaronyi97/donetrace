# Project context packaging

Purpose: Compress a messy task into facts, boundaries, assumptions, risks, and open questions.

## Scenario

Use when a task spans files, sessions, tools, or decisions and a new assistant would otherwise start by guessing.

## Input requirements

- Goal in the user's words.
- Current state and relevant artifacts.
- Constraints, non-goals, facts, assumptions, blockers, and known risks.

## Operating steps

1. Name the task boundary first — goal plus explicit non-goals — before summarizing any detail. A package without a boundary invites the receiver to expand scope into whatever looks interesting.
2. Compress the situation into five buckets, not a narrative: FACTS (verified, with the evidence or file reference), BOUNDARIES (in scope vs out of scope), ASSUMPTIONS (believed but unverified, labeled as such), RISKS (what could go wrong), OPEN QUESTIONS (what is genuinely undecided). Split fact from assumption and decision from preference; do not let a confident sentence blur the two.
3. Climb the purpose chain before fixing the delivery shape: do not stop at 'this task belongs to category X'. Ask what the owner will ultimately DO with the result — decide something, unblock a downstream step, cut review cost — because the end use is what sets the right granularity, depth, and format. A deliverable that maps to a category but serves no actual use is a compliance document, not a usable tool. If you cannot answer the end use, stop and re-define the task rather than packaging detail around a goal you have not pinned.
4. Frame the next-step options as a menu, not the map: it is your view of what comes next, and you may have missed, misordered, or mis-scoped an item. Mark which options are well-grounded and which are guesses, and invite the receiver to find an unlisted option D or E.
5. Hand the receiver an explicit first-round judgment to run before executing: (1) what is this task actually for — restate the goal, the current sub-task, and the completion bar; (2) is this option list exhaustive — what did I miss; (3) is there an unlisted item that serves the main line versus one that would hijack it? An option list accepted without questioning is an option list whose blind spots get inherited.
6. End with one concrete next action and the smallest missing question — the single piece of information that, once answered, would most change what the receiver should do.

## Copy-paste prompt

```text
You are helping me with project context packaging in a local-first AI collaboration workspace.

Task: Compress a messy task into facts, boundaries, assumptions, risks, and open questions.

Trigger:
Use at the start of any task that will cross a boundary — span multiple files, sessions, or tools, get handed to a different assistant, or be resumed later — and where a new assistant starting cold would otherwise begin by guessing. Package the context BEFORE the next assistant acts, so it inherits a boundary instead of a transcript.

Do not use when:
Skip the full packaging for a single-step task with one obvious goal and no state worth transferring, or a quick fact lookup you will act on yourself in the same breath. A full facts/boundaries/assumptions/risks/open-questions package for a one-line ask is overhead the receiver does not need, and ceremony with no payoff trains people to skip packaging when the task is actually tangled.

Input:
The goal in the owner's own words. The current state and the artifacts that matter (files, links, prior decisions). The constraints and the explicit non-goals. What is known as fact versus assumed. The blockers and known risks. And, honestly, what you may have left off the list — because the biggest risk in a handoff is the option the author never wrote down.

Process:
1. Name the task boundary first — goal plus explicit non-goals — before summarizing any detail. A package without a boundary invites the receiver to expand scope into whatever looks interesting.
2. Compress the situation into five buckets, not a narrative: FACTS (verified, with the evidence or file reference), BOUNDARIES (in scope vs out of scope), ASSUMPTIONS (believed but unverified, labeled as such), RISKS (what could go wrong), OPEN QUESTIONS (what is genuinely undecided). Split fact from assumption and decision from preference; do not let a confident sentence blur the two.
3. Climb the purpose chain before fixing the delivery shape: do not stop at 'this task belongs to category X'. Ask what the owner will ultimately DO with the result — decide something, unblock a downstream step, cut review cost — because the end use is what sets the right granularity, depth, and format. A deliverable that maps to a category but serves no actual use is a compliance document, not a usable tool. If you cannot answer the end use, stop and re-define the task rather than packaging detail around a goal you have not pinned.
4. Frame the next-step options as a menu, not the map: it is your view of what comes next, and you may have missed, misordered, or mis-scoped an item. Mark which options are well-grounded and which are guesses, and invite the receiver to find an unlisted option D or E.
5. Hand the receiver an explicit first-round judgment to run before executing: (1) what is this task actually for — restate the goal, the current sub-task, and the completion bar; (2) is this option list exhaustive — what did I miss; (3) is there an unlisted item that serves the main line versus one that would hijack it? An option list accepted without questioning is an option list whose blind spots get inherited.
6. End with one concrete next action and the smallest missing question — the single piece of information that, once answered, would most change what the receiver should do.

Output shape:
- Goal and boundary: the goal in one line, with explicit non-goals.
- Facts: verified items, each with its evidence or file reference.
- Assumptions: believed-but-unverified items, labeled, kept separate from facts.
- Risks: what could go wrong, ordered by impact.
- Open questions: what is genuinely undecided, with the smallest missing question called out.
- End-use chain: what the owner ultimately does with the result, and how that sets the delivery shape.
- Option menu (not the map): next-step options, each marked well-grounded or guess, with a note of what may be missing.
- Receiver's first-round check: the three questions to answer before executing (what is this for / is the list exhaustive / is there a serving-vs-hijacking D or E).
- Next action: one concrete first step the receiver can take from this package alone.

Pass bar (do not pass unless all hold):
- The task boundary — goal plus explicit non-goals — is stated before any detail, so scope cannot quietly expand.
- Facts and assumptions are in separate buckets, and every assumption is labeled rather than dressed as fact.
- The end-use chain is answered: what the owner finally does with the result is named, not just which category the task falls under.
- The option list is framed as a menu with missing or guessed items flagged, not presented as the complete set of next steps.
- There is one concrete next action and one smallest-missing-question, and a cold reader could continue from this package without the original chat.

Reject bar (send back if any holds):
- The package is a replayed transcript or a story of what happened, not a compressed boundary a stranger can act on.
- Non-goals are missing, so the receiver is free to expand scope into whatever looks interesting.
- An assumption is stated as a fact with no label and no evidence, and a later step would rest on it.
- The task is mapped to a clause or category but the owner's ultimate use is never named, so the delivery granularity is set by guesswork.
- The option list is handed over as the whole map, inviting the receiver to inherit the author's blind spots instead of testing for a missing D or E.

Rules:
- Work only from the material I provide.
- Keep private material local; use public-safe synthetic wording for examples.
- Label facts, assumptions, and unverified claims.
- Do not claim to understand my private business beyond the provided context.

Material:
[paste redacted material here]
```

## Expected output

- Goal
- Current state
- Relevant artifacts
- Constraints and non-goals
- Facts
- Assumptions
- Risks
- Open questions
- Next action

## Counter-example

Synthetic: a handoff package says 'finish the onboarding work; options are A polish the copy, B add a tooltip, C reorder the steps; next: do A.' A cold receiver that runs the first-round check instead of grabbing A asks question one — what is this actually for — and finds the real end use is 'get more new users to create their first note', not 'make the copy nicer'. Question two exposes that the author never listed the fact that three testers abandoned before the first note even loaded — an unlisted item D (the first screen is broken) that the copy options would never fix. The package had mapped the task to the category 'onboarding copy' but never to the owner's actual use, so the polished menu would have shipped prettier words on a screen users never reached.

## Failure modes

- Dumping a transcript instead of packaging context.
- Omitting non-goals and letting scope expand.
- Losing evidence links or file references needed for review.
- Handing over the option list as the whole map, so the receiver inherits whatever the author forgot.
- Naming which clause or category the task belongs to but never what the owner ultimately does with the result.

## Example

Messy input says 'fix onboarding, maybe pricing too, users are confused.' Output separates onboarding as the current scope and pricing as a non-goal until evidence changes.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
