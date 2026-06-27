# Harvest and External Recap Synthetic Example

This is a public-safe synthetic example for DoneTrace. It is local-first and contains no private account, customer, route, hook, or conversation material.

## Synthetic example

A single-conversation harvest turns one discussion into two cards — a decision card ('chose the temp-cache dry-run path because it isolates the local-cache failure') and a lesson card ('do not label a release before the packaged smoke test runs') — each redacted into public-safe wording, confirmed by the human, and filed; ERC would do the same across several past sessions, but only under its fresh-session-plus-explicit-role double lock.

## Full worked example (filled end to end)

A working session ends with a real choice having been made about how to verify a synthetic app's release. The discussion is full of useful judgment that would otherwise evaporate. The human says 'harvest this', so the AI sweeps the conversation, proposes cards, redacts them, and files the confirmed ones. (An External Recap would look the same but span several past sessions — here it is a single-conversation harvest, so the ERC double lock is noted as not engaged.)

### Source conversation swept
One working session that debated how to confirm a release was safe, hit a snag with a local cache during packaging, and settled on a specific verification path.

### Candidate items by type
- Decision: the team chose to run the package dry-run against a temporary cache rather than the default local cache.
- Lesson: an earlier near-miss happened because a release was labeled before the packaged smoke test had run.
- (Considered and dropped) a passing remark about file naming — one-off, no reuse value, not carded.

### Harvest cards
Card 1 — DECISION. What: when packaging fails only because of a stale local cache, run the dry-run against a temporary cache to isolate the real file-list check from the cache noise. Why reusable: the same cache trap recurs across releases. Target knowledge base: the team's release-practices notes.
Card 2 — LESSON. What: never move a release label from 'candidate' to 'releasable' before the packaged smoke test has actually run and shown a complete file list. Why reusable: it is a guardrail that prevents shipping an incomplete package. Target knowledge base: the release-practices notes, under pre-release checks.

### Redaction record (before filing)
Replaced the specific app name with 'a synthetic note app'; replaced concrete local cache paths with 'the local cache' / 'a temporary cache'; removed the contributor's name and referred to 'the human' / 'the team'. No real names, paths, or internal numbers remain on either card.

### Repeat evidence for the rule
Card 2 is proposed as a standing rule, so it is backed by more than this one chat: the same 'labeled too early' miss had shown up in a prior release loop. Two occurrences, not one, justify generalizing it into a rule. Card 1 is filed as a reusable method, not a hard rule, so it needs less.

### Human confirmation per card
Card 1: confirmed, filed as written. Card 2: confirmed with a small edit (the human tightened 'smoke test' to 'packaged smoke test' for precision), then filed. The dropped file-naming remark: confirmed dropped.

### ERC double-lock check
Not engaged. This is a single-conversation harvest inside the working session, not a cross-session recap. The External Recap role would require a brand-new session AND an explicit human declaration of that role before it could run across several past conversations; neither applies here, so harvest runs in its ordinary single-conversation form.

## How the mechanism changes the outcome

Without this mechanism, a single assistant can produce a smooth answer while hiding uncertainty. With this mechanism, the workflow records trigger, evidence, decision, residual risk, and next action.

## Reuse note

Copy the shape, not the synthetic facts. Adapt the template to your own redacted task.
