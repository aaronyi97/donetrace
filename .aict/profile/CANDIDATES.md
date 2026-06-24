# Profile Candidates (buffer before the long-term profile)

This file is the holding area for **proposed** profile preferences. The 10-minute loop (`../walkthroughs/10-minute-your-task.md`, Step 4) can suggest a profile candidate when a stable preference shows up more than once. That suggestion is a guess, not a fact - so it lands here as `proposed` instead of editing your real profile, and an unreviewed guess never hardens into a standing rule future sessions obey.

This is local-first and public-safe. Keep only general, redacted preferences here - no private names, paths, customers, or internal numbers. The row below is a synthetic example, not real data.

## State machine

Every candidate moves through exactly these four states:

| State | Meaning | Touches your long-term profile? |
| --- | --- | --- |
| `proposed` | The AI suggested it this loop; not yet reviewed, not trusted. | No |
| `confirmed` | You reviewed it and it is correct as written. | Yes - it may graduate as-is |
| `edited` | Correct only after you reword it; the edited line is what graduates. | Yes - the edited line graduates |
| `dropped` | You reviewed it and it does not belong; kept on the record so it is not re-proposed. | No |

Rule: **only `confirmed` and `edited` candidates graduate into your long-term profile, and only after you say so.** `proposed` and `dropped` never edit your profile. This is the same confirm / edit / drop discipline the harvest mechanism uses for harvested cards - nothing lands on the AI's say-so alone.

## How to use this

1. After a loop, a new candidate is appended below with status `proposed`.
2. When you review it, change its status to `confirmed`, `edited`, or `dropped` (edit the wording in place if `edited`).
3. Move `confirmed` / `edited` lines into your profile (`EXAMPLE.synthetic.md` here, or your own real profile file), then mark the row `graduated` in the Notes column or delete it.
4. Leave `dropped` rows here so the same guess is not proposed every loop.

## Candidates

| Candidate (one line) | Status | Source loop | Reviewed on | Notes |
| --- | --- | --- | --- | --- |
| (synthetic) Prefer direct risk calls over reassurance | proposed | synthetic-loop-01 | (not reviewed yet) | example row; replace with your own |

## Why this buffer exists

Without it, the loop would "drop a candidate straight into the profile" - and a one-off observation from a single task could quietly become a permanent rule that every future session obeys, with no human in the loop. The buffer keeps your profile honest: it only ever grows from preferences you actually confirmed.

## This file vs the learning ledger (two surfaces, same discipline)

There are two places a proposed preference can live, and they are partners, not rivals:

- **This file (`CANDIDATES.md`)** is the human view - a table you read and edit by hand while deciding what belongs in your profile. It covers profile candidates only.
- **The learning ledger (`../state/learning-ledger.jsonl`)** is the machine record the CLI writes - `ai-collab learning add --type profile --content "..."` appends a `proposed` row, `learning confirm/edit/drop` flips its state, and `ai-collab status` echoes back the one preference you most recently confirmed so the next task starts ahead. It also records `harvest` lessons, which this file does not.

Both use the exact same `proposed / confirmed / edited / dropped` states and the same graduation rule (only `confirmed`/`edited` graduate, only when you say so). But they are **two separate stores with no auto-sync, shared id, or dedupe between them** - so pick one place per candidate and keep it there. If you record the same preference in both and then change one, they will drift, and nothing reconciles them for you. When they do disagree, the **learning ledger is the source of truth**: it is what `ai-collab status` reads back and what the machine acts on; `CANDIDATES.md` is a human-only view that no command reads. Use whichever fits the moment - hand-edit this table, or run the `learning` commands - just not both for the same candidate, and let `confirmed`/`edited` lines graduate into your real profile.
