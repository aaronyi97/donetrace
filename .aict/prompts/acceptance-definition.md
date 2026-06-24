# Acceptance definition

Purpose: Define observable pass criteria and required evidence before work starts.

## Scenario

Use before implementation, writing, research, cleanup, or review when 'looks good' would be too vague.

## Input requirements

- Task goal and expected artifact.
- Quality bar and constraints.
- Available verification commands or manual checks.
- Rejected states that must not be accepted.

## Operating steps

1. Turn the goal into inspectable deliverables: name the file, the behavior, the output a skeptical reviewer could open and check. A deliverable you cannot point at is a deliverable you cannot accept.
2. Write each pass criterion so it is mechanically checkable (a command that exits 0, a string that must appear, a behavior a stranger can reproduce), not a vibe like 'works well' or 'is clean'.
3. Bind every completion claim to one of exactly three states and forbid any fourth: NOT DONE (nothing to show yet), DONE-PENDING-VERIFICATION (built but not yet proven), ACCEPTED (proven and signed off). Ban soft words like 'basically done', 'should be fine', 'mostly working' — they hide which state the work is really in.
4. Require that any DONE-PENDING-VERIFICATION claim carry three-part evidence, and that the three parts are present before the claim counts: (1) WHAT CHANGED — file plus line plus a one-line description, specific enough that a reader sees the change in thirty seconds; (2) REAL COMMAND OUTPUT — the actual pasted text of grep -n / diff / wc -l / ls -la / the test run, not a verbal 'it is landed' or 'tests pass'; (3) WHAT IS NOT YET VERIFIED — the blind spots, edge cases, cross-file effects, and downstream dependencies, listed openly so the owner decides whether to verify or to accept the gap on the record.
5. List the rejected states explicitly so false closure is blocked up front: e.g. exit code ignored, a test that passes without exercising the user-facing requirement, a claim broader than its evidence, scope that drifted past the stated non-goals.
6. Hand the card back as the contract the work will be judged against, and name what still needs an owner decision (which gaps are acceptable, which must be closed before acceptance).

## Copy-paste prompt

```text
You are helping me with acceptance definition in a local-first AI collaboration workspace.

Task: Define observable pass criteria and required evidence before work starts.

Trigger:
Use before any work where 'looks good' would be too vague and where a wrong 'done' would propagate: an implementation, a piece of writing, a research result, a cleanup, or any artifact another session or person will trust. Define done BEFORE the work starts, not after.

Do not use when:
Skip the full ceremony for a throwaway one-line change, a quick fact lookup, or a step you will fully re-check by hand in the next minute anyway. Writing a six-part acceptance card for a trivial edit is cost you pay for nothing, and ceremony with no payoff trains people to skip acceptance when it actually matters.

Input:
The task goal and the exact artifact expected. The quality bar and constraints. The verification commands or manual checks actually available (the real test command, the real grep, the real way to reproduce). The rejected states that must never be silently accepted. If the work is already partly done, the completion claims made so far so each can be tagged with a state.

Process:
1. Turn the goal into inspectable deliverables: name the file, the behavior, the output a skeptical reviewer could open and check. A deliverable you cannot point at is a deliverable you cannot accept.
2. Write each pass criterion so it is mechanically checkable (a command that exits 0, a string that must appear, a behavior a stranger can reproduce), not a vibe like 'works well' or 'is clean'.
3. Bind every completion claim to one of exactly three states and forbid any fourth: NOT DONE (nothing to show yet), DONE-PENDING-VERIFICATION (built but not yet proven), ACCEPTED (proven and signed off). Ban soft words like 'basically done', 'should be fine', 'mostly working' — they hide which state the work is really in.
4. Require that any DONE-PENDING-VERIFICATION claim carry three-part evidence, and that the three parts are present before the claim counts: (1) WHAT CHANGED — file plus line plus a one-line description, specific enough that a reader sees the change in thirty seconds; (2) REAL COMMAND OUTPUT — the actual pasted text of grep -n / diff / wc -l / ls -la / the test run, not a verbal 'it is landed' or 'tests pass'; (3) WHAT IS NOT YET VERIFIED — the blind spots, edge cases, cross-file effects, and downstream dependencies, listed openly so the owner decides whether to verify or to accept the gap on the record.
5. List the rejected states explicitly so false closure is blocked up front: e.g. exit code ignored, a test that passes without exercising the user-facing requirement, a claim broader than its evidence, scope that drifted past the stated non-goals.
6. Hand the card back as the contract the work will be judged against, and name what still needs an owner decision (which gaps are acceptable, which must be closed before acceptance).

Output shape:
- Deliverables: the concrete artifacts, each one something a reviewer can open and inspect.
- Pass criteria: numbered, each mechanically checkable.
- Required checks: the exact command or manual step that proves each criterion.
- Three states in use: which claims are NOT DONE / DONE-PENDING-VERIFICATION / ACCEPTED right now.
- Required evidence per claim: the three-part block (what changed / real command output / what is not yet verified) demanded before any DONE-PENDING-VERIFICATION claim is trusted.
- Rejected states: the failure conditions that must never be silently accepted.
- Owner decision needed: which residual gaps need a human call before acceptance.

Pass bar (do not pass unless all hold):
- Every pass criterion is checkable by a named command or a reproducible manual step, not by opinion.
- Each completion claim is tagged NOT DONE / DONE-PENDING-VERIFICATION / ACCEPTED, with no soft fourth state.
- Every DONE-PENDING-VERIFICATION claim has all three evidence parts, and part two is real pasted command output, not a verbal assurance.
- Rejected states are written down so false closure has an explicit tripwire.
- What stays unverified is named openly and left to the owner to accept or close, not buried.

Reject bar (send back if any holds):
- A criterion is a vibe ('looks clean', 'works well') that no command or reproducible step can test.
- A claim says 'done' / 'basically done' / 'should be fine' without a state tag, so the reviewer cannot tell proven from unproven.
- A DONE-PENDING-VERIFICATION claim rests on a verbal 'it landed' or 'tests pass' with no pasted output — exactly the gap where a fluent claim outruns the evidence.
- A test passes but does not exercise the actual user-facing requirement, and that is being counted as acceptance.
- Unverified areas are folded into 'done' instead of being listed for an owner decision.

Rules:
- Work only from the material I provide.
- Keep private material local; use public-safe synthetic wording for examples.
- Label facts, assumptions, and unverified claims.
- Do not claim to understand my private business beyond the provided context.

Material:
[paste redacted material here]
```

## Expected output

- Deliverables
- Pass criteria
- Required checks
- Rejected states
- Evidence needed
- Owner decision needed

## Counter-example

Synthetic: an assistant reports 'Done — added keyboard reordering to the task board and all tests pass.' Under this prompt the claim is tagged DONE-PENDING-VERIFICATION and the three-part evidence is demanded. Part two comes back empty: there is no pasted test output for a keyboard case, only the sentence 'tests pass'. Acceptance is withheld. When the real `grep -n moveTask` and test run are pasted, they show the keyboard handler only logs the key and never calls the reorder function and no keyboard test exists — so the verbal 'all tests pass' was a half-product claim the evidence never backed.

## Failure modes

- Accepting intent instead of observable output.
- Writing criteria after the work is already done.
- Letting tests pass even though they do not prove the user-facing requirement.
- Accepting a verbal 'it is done / it landed' with no pasted command output behind it.
- Collapsing 'not verified yet' into 'done' so the reviewer cannot tell which claims are actually proven.

## Example

For a CLI dry-run task, acceptance requires exit 0, no files created, clear stdout, and a test proving the target directory stays empty.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
