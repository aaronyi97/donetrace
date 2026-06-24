# 10-Minute Walkthrough (Your own task)

This is the recommended first run. You run the whole collaboration loop on one real task of your own, instead of a prepared example, and feel the value on work you actually care about. If you would rather watch the flow on a prepared case first, use `10-minute.md` (the demo preview) and then come back here.

Goal: take one messy task of yours and, in three short rounds, force the AI to (1) define "done" before it acts, (2) do only that, and (3) get re-checked by an independent AI that hunts for a thin "done" - then spend two minutes closing the loop into reusable cards so the next task starts ahead.

Everything stays local-first. You paste a redacted description into the AI tools you already use; nothing is uploaded by this workspace. Redact before you paste: replace any real name, path, customer, or internal number with a placeholder. The loop works on a redacted description; it does not need the private original.

What you need: one real task that is a bit messy, and one AI tool you can paste into. A second tool of a different model family (a different AI brand) makes Step 3 much stronger, but you can run all three rounds in one tool if that is all you have.

Want the AI to prompt you for these steps on its own - to ping you to review every time it says "done", instead of you remembering to paste Step 3? Install the adapter into your tool's always-on instructions with `node bin/ai-collab.js adapters install --target <repo>`; it turns on the coaching reminders, and if you only have one tool it routes the completion-claim check through `single-tool-guard` (a fresh adversarial pass in the same tool).

## Step 1 (2 min) - Define done before any work

Paste this into your AI tool, with your own task in the brackets:

```text
I have a task in front of me that is a bit messy. Do NOT write any implementation yet.
Task (redacted): [describe your task in plain language; replace any private name, path, or number with a placeholder]
Return two things:
1) Boundary card: this run does only this one small slice; explicitly list what is NOT in scope.
2) Acceptance card: a numbered list of hard, checkable standards (AC1, AC2, ...). Mark anything that would be out of scope.
```

Expected: a boundary card and an acceptance card. You now have a written definition of "done" for your own task, before a line of work exists. This is the step people skip and then regret.

## Step 2 (3 min) - Do only the accepted slice, then produce an Evidence Pack

Paste this next, so the AI builds only what the acceptance card described and hands back a structured **Evidence Pack** the next round can actually check - not a prose "it's done":

```text
Do only the work the acceptance card describes. Do not expand scope.
When you are done, produce an "Evidence Pack" in exactly this shape (it is the artifact the re-check will judge):
1) Changed files / diff: the list of files you changed, with the key diff hunks (or the full patch). If you changed nothing, say so.
2) Commands run: the exact commands you ran to verify the work (tests, build, lint, a manual reproduction). If you ran none, write "none".
3) Command output summary: the real output of each command (paste it, do not paraphrase), trimmed to the relevant lines.
4) Exit codes: the exit code of each command (0 = passed). If a command failed, keep its non-zero code and error visible - do NOT hide it.
5) Acceptance mapping: for each acceptance criterion (AC1, AC2, ...), say PASS / FAIL / NOT-VERIFIED and point to the evidence above that backs it.
6) Not verified: everything you could NOT prove (edge cases, things you skipped, criteria with no command behind them).
Do not claim "done" for anything that does not have evidence in this pack.
```

Expected: an Evidence Pack with the six numbered parts above (changed files/diff, commands run, output summary, exit codes, acceptance mapping, not-verified). Keep this whole pack - it is exactly what the next round pressure-tests, and a missing or empty pack is itself a finding in Step 3.

## Step 3 (3 min, the aha moment) - Independent re-check

Open a fresh chat. Ideally use a different AI brand than the one that did Step 2 - a different model family is the pass most likely to catch what the first one missed. Paste this:

```text
You are an independent reviewer. The work below claims to be done. Assume it is NOT done and prove it from the evidence, not the tone.
Acceptance card: [paste your Step 1 acceptance card]
Evidence Pack under review: [paste the Step 2 Evidence Pack: changed files/diff, commands run, output summary, exit codes, acceptance mapping, not-verified]
Do this, in order:
1) First check the Evidence Pack itself. If there is no Evidence Pack, or it is missing real command output / exit codes, or a claimed PASS has no command behind it, you CANNOT pass the work: return the verdict INSUFFICIENT_EVIDENCE and list exactly what evidence is missing. A confident "done" with no evidence is INSUFFICIENT_EVIDENCE, not pass.
2) For each acceptance criterion, point to the exact line/output in the Evidence Pack that backs it, or say there is no evidence for it.
3) Walk it the way a stranger would actually use it and say exactly where it breaks.
4) List defects by severity, each pinned to a specific location.
5) Pick the verdict: REJECT if an evidence-grounded hard defect exists; INSUFFICIENT_EVIDENCE if the pack cannot support a pass; pass only if every criterion is backed by real evidence.
Return: verdict (pass / REJECT / INSUFFICIENT_EVIDENCE) + defect or missing-evidence list (with locations) + the smallest fix for each + what is still unverified.
```

Expected (the aha): the independent reviewer first weighs your Evidence Pack. If Step 2 handed over a fluent "done" with no real evidence, it returns `INSUFFICIENT_EVIDENCE` and names what is missing; if the evidence exists but a criterion is not actually met, it returns `REJECT` with the defect pinned to a location - on your own task, not a tutorial's. Either way, that is the gap a single fluent chat would have hidden from you: no evidence pack means no pass.

## Step 4 (2 min) - Close the loop so it compounds

The re-check is the safety net; this step is where the loop starts paying you back. Keep it light - three short cards, not a report. Paste this:

```text
Close out this task in three short cards. Keep each card to a few lines - do NOT write a long report.
1) Handoff card (so the next session or tool resumes without re-explaining), three columns:
   - Done: what is finished and evidence-backed.
   - To do: what is left.
   - Not verified: what was claimed but not proven (carry over anything the re-check flagged).
2) Harvest card: one reusable lesson from this task, as a single sentence I could apply to a future task.
3) Profile candidate (only if one applies): if a stable preference about how I want you to work showed up more than once, propose it as one line, with status `proposed`. Do NOT add it to my long-term profile yet. If nothing stable showed up, say "no profile candidate this time".
```

Expected: a three-column handoff, a one-line harvest lesson, and either one `proposed` profile candidate or an explicit "none". Save the handoff and harvest cards into your workspace (`../handoff/` and `../harvest/`). A profile candidate does NOT go straight into your long-term profile - it lands in `../profile/CANDIDATES.md` as `proposed` first. It only moves into `profile/EXAMPLE.synthetic.md` (or your real profile) after you review it: mark it `confirmed` (use as-is), `edited` (reword first), or `dropped` (discard) in CANDIDATES.md, and only `confirmed`/`edited` ones graduate. That buffer is why one task makes the next one start ahead without an unreviewed guess hardening into a standing rule - you walk away with a re-checked result *and* something reusable, but nothing edits your profile behind your back.

### Profile-candidate buffer (the state machine)

A profile candidate is a guess about a standing preference. An unreviewed guess must not silently become a rule future sessions obey, so candidates move through four states in `../profile/CANDIDATES.md`:

- `proposed` — the AI suggested it this loop; not yet trusted, not in your profile.
- `confirmed` — you reviewed it and it is correct as written; it may now graduate into your profile.
- `edited` — correct after you reword it; the edited line graduates, the original does not.
- `dropped` — you reviewed it and it does not belong; it stays recorded as dropped so it is not re-proposed every loop.

Rule: only `confirmed` and `edited` candidates graduate into your long-term profile, and only after you say so. `proposed` and `dropped` never edit your profile. Open `../profile/CANDIDATES.md` for the table and how to use it.

Prefer to let the tool track this for you instead of hand-editing a table? The same four states are available as commands: `ai-collab learning add --type profile --content "..."` records the candidate (and `--type harvest` records the one-line lesson from card 2), then `ai-collab learning confirm` / `learning edit` / `learning drop` keep, reword, or discard it. Next time you run `ai-collab status`, it echoes back the one preference you most recently confirmed - so the next task literally starts with "still working the way you confirmed last time." Use the table or the commands, whichever you like; they share the same states, so you are never maintaining two systems.

## Two-track comparison (optional, makes the point undeniable)

Run your task once with no discipline first, then with the loop, and compare:

1. Track A (no discipline): in a fresh chat, paste your messy task with no structure and just ask the AI to do it. Save the smooth "Sure, I will do X, Y, Z" reply. That smooth line is your real before-evidence, generated on your own task.
2. Track B (the loop): the three steps above.
3. Side by side: ask the AI to put both tracks into one table with four rows - scope, definition of done, completion claim, and what would have been missed. The messy half is real evidence from your own task, not something the tutorial invented.

## Want the why behind each step

This walkthrough is the operation card. For the reasoning behind each move and a longer copy-paste sequence to adapt, open `../cookbook/run-a-first-loop.md` (it runs this same loop on your own task and explains why each step exists). To turn Step 3 into a reusable habit on higher-stakes work, see `../cookbook/review-a-half-product.md` and `../mechanisms/dual-guard/README.md`.

## Completion check

You defined "done" before the work, had the AI do only that, had an independent AI re-check it against evidence, and closed the loop into a handoff card, a one-line harvest lesson, and (if one applied) a profile candidate - all on a real task of your own. You can name the exact place the re-check pointed to, and you leave with a re-checked result, reusable cards, and a habit (define done, do only that, get re-checked, then capture what is reusable) that makes your next task start ahead instead of from scratch.
