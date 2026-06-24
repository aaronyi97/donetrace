# Workflow reset

Purpose: Recover from drift by restating goal, state, acceptance, and next action.

## Scenario

Use when a thread has become confusing, has nested sub-tasks, or the assistant can no longer explain why the current step serves the main goal.

## Input requirements

- Original goal or latest confirmed goal.
- What has been done.
- Where the thread drifted.
- Known blockers and verification state.

## Operating steps

1. Stop adding new work. A reset is a re-grounding, not a fresh brainstorm; resist the pull to fix one more thing before you know where you stand.
2. Restate the four components explicitly, in order: GOAL (the main line in one sentence), CURRENT STATE (where things actually are now), ACCEPTANCE (what 'done' means for the main line), NEXT ACTION (the single concrete first step). All four are required — a reset missing any one of them leaves the thread still adrift.
3. Re-measure the current state instead of trusting the pre-drift picture. The numbers, counts, file states, and 'it already works' assumptions from before the drift are exactly what may have gone stale; re-run the cheap deterministic check (count it, list it, open it, reproduce it) rather than carrying a remembered value forward. A figure quoted from earlier in the thread is treated as 'pre-drift, unverified' until re-measured.
4. Separate the work honestly into done / pending / blocked / unverified, and never let a claimed-but-unproven item sit in 'done'. A check claimed without evidence is unverified, not complete.
5. Decide whether to close the current sub-task or return to the main line, judged by what serves the goal — not by which tangent is easiest to keep pushing. A genuinely useful side-finding that does not serve the main line is parked as a residual, not pursued now.
6. State one concrete next action and the exact baseline to resume from (the precise point, file, or command to start at), so work re-enters cleanly instead of re-deriving the starting point.

## Copy-paste prompt

```text
You are helping me with workflow reset in a local-first AI collaboration workspace.

Task: Recover from drift by restating goal, state, acceptance, and next action.

Trigger:
Use when a thread has drifted: it has nested into sub-tasks, chased a tangent, run long enough that state is fuzzy, or reached the point where the assistant can no longer explain why the current step serves the main goal. Reset before doing more work, not after producing more output on a shaky base.

Do not use when:
Skip the formal reset on a short, on-track thread with one clear goal and a state you can hold in your head. Running a full four-part reset on a task that never drifted is ceremony, and ceremony with no payoff trains people to ignore the reset when the thread has genuinely lost its thread.

Input:
The original goal, or the latest goal the owner actually confirmed. What has been done so far and what was claimed about it. Where the thread drifted — the point it stopped serving the main goal. The known blockers and the current verification state, including which 'done' claims have real evidence and which are only asserted.

Process:
1. Stop adding new work. A reset is a re-grounding, not a fresh brainstorm; resist the pull to fix one more thing before you know where you stand.
2. Restate the four components explicitly, in order: GOAL (the main line in one sentence), CURRENT STATE (where things actually are now), ACCEPTANCE (what 'done' means for the main line), NEXT ACTION (the single concrete first step). All four are required — a reset missing any one of them leaves the thread still adrift.
3. Re-measure the current state instead of trusting the pre-drift picture. The numbers, counts, file states, and 'it already works' assumptions from before the drift are exactly what may have gone stale; re-run the cheap deterministic check (count it, list it, open it, reproduce it) rather than carrying a remembered value forward. A figure quoted from earlier in the thread is treated as 'pre-drift, unverified' until re-measured.
4. Separate the work honestly into done / pending / blocked / unverified, and never let a claimed-but-unproven item sit in 'done'. A check claimed without evidence is unverified, not complete.
5. Decide whether to close the current sub-task or return to the main line, judged by what serves the goal — not by which tangent is easiest to keep pushing. A genuinely useful side-finding that does not serve the main line is parked as a residual, not pursued now.
6. State one concrete next action and the exact baseline to resume from (the precise point, file, or command to start at), so work re-enters cleanly instead of re-deriving the starting point.

Output shape:
- Goal: the main line in one sentence.
- Current state (re-measured): where things actually are now, with the cheap check that re-confirmed it, and any figure still carried from before the drift flagged as unverified.
- Acceptance: what 'done' means for the main line.
- Drift point: where and why the thread stopped serving the goal.
- State table: done / pending / blocked / unverified, kept separate, with no unproven item parked in done.
- Decision: close the sub-task or return to the main line, with the reason it serves the goal.
- Parked residuals: useful side-findings that do not serve the main line, recorded for later rather than chased now.
- Next action: one concrete first step plus the exact baseline to resume from.

Pass bar (do not pass unless all hold):
- All four components — goal, current state, acceptance, next action — are restated explicitly, none left implicit.
- The current state was re-measured with a real check, and any number carried from before the drift is labeled unverified rather than reused as truth.
- Done / pending / blocked / unverified are cleanly separated, with no claimed-but-unproven item sitting in done.
- The close-or-return decision is justified by what serves the main goal, not by which tangent is easiest to continue.
- There is exactly one concrete next action and an exact baseline to resume from, so a cold restart is unnecessary.

Reject bar (send back if any holds):
- The reset turns into a new brainstorm that adds scope instead of re-grounding the existing goal.
- The goal is restated but pre-drift numbers or 'it already works' assumptions are carried forward without re-measuring — the classic stale-baseline trap.
- A claimed-but-unproven item is filed under done, so the state table reads cleaner than the work actually is.
- The thread returns to the most recent tangent because it is easiest, even though it does not serve the main line.
- The card ends with no single concrete next action, or with no exact baseline, so the next session must re-derive where to start.

Rules:
- Work only from the material I provide.
- Keep private material local; use public-safe synthetic wording for examples.
- Label facts, assumptions, and unverified claims.
- Do not claim to understand my private business beyond the provided context.

Material:
[paste redacted material here]
```

## Expected output

- Main goal
- Current sub-task
- Drift point
- State table
- Recommended next action

## Counter-example

Synthetic: a release thread drifts into debugging a package-install cache error. The lazy reset writes 'goal: ship the release; we already smoke-tested the build earlier, so next just publish.' But re-measuring the current state shows the earlier smoke test ran against an old build that predates the cache fix — the carried-forward 'already tested' was a pre-drift assumption, now stale. The disciplined reset re-runs the smoke test in a clean temp directory (re-measure, not remember), marks the cache error as an environment-specific residual that does not block the main line, files 'release smoke test' as unverified rather than done, and sets one concrete next action with an exact baseline: run the packaged build's smoke test against the post-fix build before publishing. Trusting the pre-drift 'already tested' would have shipped a release that was never actually verified.

## Failure modes

- Treating reset as a new brainstorm.
- Continuing the most recent tangent because it is easier.
- Claiming closure while verification is missing.
- Restating the goal but carrying forward the pre-drift numbers and assumptions as if they were still true.
- Producing a tidy reset card with no single concrete next action and no exact baseline to resume from.

## Example

Reset a release thread after debugging npm cache issues: mark cache as environment-specific, return to package smoke test with a temp cache.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
