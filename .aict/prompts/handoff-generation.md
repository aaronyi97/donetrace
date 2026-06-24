# Handoff generation

Purpose: Write a next-session state card with completed, pending, blocked, and unverified work.

## Scenario

Use before stopping, changing tools, delegating, or compressing a long task into a resumable state.

## Input requirements

- Current goal and status.
- Completed work and changed artifacts.
- Verification commands and outputs.
- Blockers, decisions, and the next action.

## Operating steps

1. State the goal in one sentence, then separate the work into done / pending / blocked / unverified. Do not narrate a story; transfer a state a stranger can act on.
2. Record the exact commands or checks already run with their real outputs — including failures shown openly, never smoothed into a summary. A check claimed but not shown is treated as not run.
3. Frame the option list honestly as a menu, not the whole map: it is the author's view of what comes next, and the author may have missed, misordered, or mis-scoped an item. Mark which options are well-grounded and which are guesses.
4. Give the receiver an explicit first-round judgment to run before executing, not just a task to pick: (1) what is this next stint actually for — restate the main-line goal, the current sub-task, and the completion bar; (2) is the handed-off option list exhaustive — what did the author miss; (3) is there an unlisted item D or E, and if so does it serve the main line or hijack it? An option list you accept without questioning is an option list whose blind spots you inherit.
5. Set the discipline for new items: a genuinely high-signal item that does NOT serve the current main line is recorded as a parked / after-closeout residual, not seized on round one. High signal is not the same as 'do it now'; the main line that was handed off keeps priority unless the owner re-points it.
6. Give one concrete first action and the exact baseline to start from, so the receiver re-enters work cleanly instead of re-deriving the starting point or re-explaining the background.

## Copy-paste prompt

```text
You are helping me with handoff generation in a local-first AI collaboration workspace.

Task: Write a next-session state card with completed, pending, blocked, and unverified work.

Trigger:
Use before work crosses a boundary: a session is ending, a different tool or model is taking over, a long task is being compressed into a resumable state, or you are delegating to someone who was not in the original context.

Do not use when:
Skip the full packet when the same session simply continues, or for a trivial task with a single obvious next step and no state worth transferring. A formal handoff for a one-line continuation is overhead the receiver does not need.

Input:
The goal in the author's words and the current status. The completed work and the artifacts that changed. The exact verification commands run and their real outputs (including the ones that failed). The blockers, the decisions already made, the sealed baseline (the exact point being handed off), and the author's best read of the next action. Crucially, an honest note of what the author may have left off the list.

Process:
1. State the goal in one sentence, then separate the work into done / pending / blocked / unverified. Do not narrate a story; transfer a state a stranger can act on.
2. Record the exact commands or checks already run with their real outputs — including failures shown openly, never smoothed into a summary. A check claimed but not shown is treated as not run.
3. Frame the option list honestly as a menu, not the whole map: it is the author's view of what comes next, and the author may have missed, misordered, or mis-scoped an item. Mark which options are well-grounded and which are guesses.
4. Give the receiver an explicit first-round judgment to run before executing, not just a task to pick: (1) what is this next stint actually for — restate the main-line goal, the current sub-task, and the completion bar; (2) is the handed-off option list exhaustive — what did the author miss; (3) is there an unlisted item D or E, and if so does it serve the main line or hijack it? An option list you accept without questioning is an option list whose blind spots you inherit.
5. Set the discipline for new items: a genuinely high-signal item that does NOT serve the current main line is recorded as a parked / after-closeout residual, not seized on round one. High signal is not the same as 'do it now'; the main line that was handed off keeps priority unless the owner re-points it.
6. Give one concrete first action and the exact baseline to start from, so the receiver re-enters work cleanly instead of re-deriving the starting point or re-explaining the background.

Output shape:
- Goal: one sentence.
- Current status: done / pending / blocked / unverified, kept separate.
- Verification evidence: the exact commands run and their real outputs, failures included.
- Option menu (not the map): the next-step options, each marked well-grounded or guess, with a note of what may be missing.
- Receiver's first-round check: the three questions to answer before executing (what is this for / is the list exhaustive / is there an unlisted D-or-E that serves vs hijacks the main line).
- Parked residuals: high-signal items that do not serve the current main line, recorded for later, not seized now.
- Next action: one concrete first step plus the exact baseline to start from.

Pass bar (do not pass unless all hold):
- Done / pending / blocked / unverified are cleanly separated, with no failed check hidden inside a summary.
- Every verification claim shows its real command and output, so 'verified' means shown, not asserted.
- The option list is framed as the author's menu, not the whole map, with missing or guessed items flagged.
- The receiver is handed an explicit first-round judgment (what is this for / is the list exhaustive / is there a D or E) rather than just a task to pick.
- A single concrete next action and the exact starting baseline are stated, and off-main-line items are parked rather than promoted to round one.

Reject bar (send back if any holds):
- The handoff is a narrative of what happened instead of an actionable state transfer.
- A check is claimed ('tests pass') with no command or output shown, so the receiver must rediscover it.
- The option list is presented as the complete and only set of next steps, inviting the receiver to inherit the author's blind spots.
- A failed or skipped check is smoothed over rather than surfaced in the unverified column.
- A tempting new item is teed up as the immediate next action even though it does not serve the handed-off main line.

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
- Current status
- Completed
- Pending
- Blocked
- Verification evidence
- Next action

## Counter-example

Synthetic: a handoff lists options A/B/C for finishing a release and says 'next: do B'. The receiver runs the first-round check instead of grabbing B. Question two exposes that the author never listed reconciling a data-count mismatch — an unlisted item D — and question three judges that D actually blocks the release, so it serves the main line and is promoted; meanwhile a flashy idea E (add a new export format) is high-signal but off the main line, so it is parked as an after-closeout residual rather than hijacking round one. Treating the menu as the whole map would have shipped the release with the count bug the author had silently omitted.

## Failure modes

- Writing a story instead of a state transfer.
- Hiding failed checks in a summary.
- Leaving the next assistant to rediscover the first command.
- Presenting the option list as the whole world, so the receiver never asks what the author missed.
- Letting the receiver grab a tempting new item on round one and hijack the main line that was actually handed off.

## Example

Handoff says: tests pass, pack smoke not run, adapter installer added, next action is fresh temp install.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
