# Harvest and External Recap

Part of DoneTrace. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Stop reusable value from leaking away. Valuable decisions, lessons, methods, and stable preferences get buried in long conversations and are never recovered. Harvest sweeps a conversation, lifts the reusable bits into harvest cards (one card per item — a decision, a lesson, a method, a stable preference), the human confirms them, and they land in the right knowledge base. Redaction is a built-in step, not an afterthought: before anything is filed, private material is rewritten into a general, public-safe form. External Recap (ERC) is a separate, dedicated role that runs harvest across MANY conversations at once — guarded by a double lock (a brand-new session AND the human explicitly declaring that role) so an ordinary chat is never swept by accident.

## When to use

Run a single-conversation harvest when a discussion produced something worth keeping: a real decision got made, a lesson was paid for, a method was figured out, a stable preference surfaced, or a loop finished. Enter the External Recap role only under the double lock — a fresh session plus an explicit human declaration of the recap role — and only when the job is genuinely cross-conversation (recapping several past sessions at once, not extracting from the current one).

## When not to use

Do not harvest a chat that produced nothing durable: a quick fact lookup, a dead-end exploration, a routine step with no reusable insight. Do not let a one-off incident become a permanent rule before the pattern has actually repeated. And do not slip into the External Recap role mid-conversation or in an active working session — without the double lock, ERC would fire on everyday chat and bury the knowledge base in low-value cards. Harvesting noise is worse than missing it: a knowledge base full of trivia is one nobody trusts or reads.

## Input shape

The full conversation text to sweep (or, for ERC, the set of past conversations to recap). The candidate reusable items spotted in it — decisions, lessons, methods, stable preferences. The target knowledge base each item should land in. The private-material boundary: which names, paths, numbers, and specifics must be rewritten before anything is filed. For ERC specifically, proof of the double lock: that this is a fresh session and that the human explicitly asked for the recap role.

## Input materials

- Source conversation(s) — the full text to sweep for a single harvest, or the named set of prior sessions to recap for ERC. You cannot harvest what you did not actually read.
- Candidate items — the reusable things spotted in the source, each tagged by type: a decision ('we chose X over Y'), a lesson ('this failed because Z'), a method ('here is the repeatable way to do W'), or a stable preference ('the human consistently wants V').
- Target knowledge base — where each confirmed card belongs, so a card is filed, not just written and lost.
- Private-material boundary — the specific names, local paths, internal numbers, customer or person references that must be rewritten into general form before filing. This is the redaction map.
- Human confirmation gate — the explicit yes/no on each card before it lands, so harvest proposes and the human disposes.
- ERC double-lock proof (ERC only) — evidence that this is a fresh session AND that the human explicitly declared the recap role, since ERC may not run without both.

## Process

1. Sweep the source conversation end to end and pull out candidate reusable items, each tagged by type: decision, lesson, method, or stable preference. Do not generalize from a single occurrence — a one-off only becomes a rule once the pattern has actually repeated.
2. Turn each candidate into a harvest card: one item per card, stating what it is, why it is reusable, and where it should be filed. A decision card records the choice and the reason; a lesson card records what went wrong and what to do differently; a method card records the repeatable steps; a preference card records the stable want and the evidence it is stable.
3. Redact as a built-in step, before filing — never after. Replace private material (real names, local paths, internal numbers, customer or person references) with general, public-safe wording. A card that still carries private specifics is not ready to file, no matter how useful it is.
4. Show the cards to the human and let them confirm, edit, or drop each one. Harvest proposes; the human disposes. Nothing lands in a knowledge base on the AI's say-so alone.
5. File each confirmed, redacted card into its target knowledge base, and log it so the same insight is not re-harvested next time.
6. For External Recap (ERC): only with the double lock satisfied (fresh session + explicit human role declaration), run the same harvest across the named set of prior conversations, produce cross-conversation cards and candidates, and hand them back for the human to confirm — recapping, not rewriting the source history, and still redacting before anything is filed.

## Output shape

- Harvest cards: one per reusable item, each tagged decision / lesson / method / stable preference, with what it is and why it is reusable.
- Target knowledge base for each card: where it lands once confirmed.
- Redaction record: which private specifics were rewritten into general form before filing.
- Repeat evidence for any card proposed as a rule: the occurrences that justify generalizing.
- Human confirmation: the yes / edit / drop decision recorded per card.
- ERC scope (ERC only): the set of conversations recapped and the double-lock confirmation that authorized the role.

## Pass bar (what counts as done / safe to trust)

- Each reusable item became its own card, tagged by type, instead of a vague 'lessons learned' blob.
- Every card was redacted into public-safe wording before filing — no private names, paths, internal numbers, or person references survive.
- Anything proposed as a reusable rule rests on a repeated pattern, not a single incident.
- The human confirmed (or edited / dropped) each card; nothing was filed on the AI's say-so alone.
- Each confirmed card landed in a named knowledge base and was logged so it is not re-harvested.
- If the External Recap role was used, the double lock (fresh session + explicit role declaration) was satisfied and recorded.

## Reject bar (what sends it back)

- Harvest stored every detail as cards, so the knowledge base fills with trivia and nobody trusts it.
- A card was filed with private specifics still in it — redaction was skipped or left for 'later'.
- A single occurrence was promoted straight to a permanent rule with no repeated evidence.
- Cards were written into a knowledge base without the human confirming them.
- The External Recap role ran without the double lock — on an everyday chat or inside an active working session.
- ERC rewrote or exposed the raw source history instead of producing redacted, confirmable recap cards.

## Common misuse

- Treating harvest as 'save the whole transcript' — storing everything as cards until the knowledge base is clutter no one reads.
- Filing a genuinely useful card before redacting it, so a real name, local path, or internal number leaks into the knowledge base.
- Generalizing from one bad run into a permanent rule, so a single incident hardens into law without the pattern ever repeating.
- Writing cards straight into the knowledge base without the human's confirmation, turning 'propose' into 'decide'.
- Slipping into the External Recap role mid-conversation or in a live working session, so ERC fires without its double lock and sweeps ordinary chat.
- Letting ERC paste or rewrite the raw source conversations instead of producing redacted, confirmable recap cards — which re-exposes exactly the private material harvest is supposed to strip.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
