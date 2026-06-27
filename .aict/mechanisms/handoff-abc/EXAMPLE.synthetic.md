# Handoff A/B/C Synthetic Example

This is a public-safe synthetic example for DoneTrace. It is local-first and contains no private account, customer, route, hook, or conversation material.

## Synthetic example

An A/B/C handoff: mode B (programmatic), current state says the feature is implemented and unit-tested, evidence is the passing test output, the blocker is an un-run package dry-run, the next concrete action is 'run the package dry-run against a temp cache before release labeling', and the baseline is the named commit — so a fresh executor continues without re-reading the chat.

## Full worked example (filled end to end)

Session 1 (a controller AI in one tool) gets a synthetic note app close to release but runs low on context before the final packaging check. Rather than dump the chat on whoever continues, it writes a Handoff A/B/C packet. Session 2 — a different AI tool entirely, with none of session 1's memory — reads the packet and picks up cleanly.

### Handoff mode + why
Mode B (programmatic). A defined, bounded task remains (one packaging check, then a release-label decision) and it will be handed to a separate executor that must run it on its own, so the packet is fully self-contained — not an A-style in-place resume.

### Current state (as fact)
- Done: the feature is implemented; the unit suite passes; a cross-family guard review accepted the completion claim after an earlier keyboard gap was fixed.
- In flight: nothing actively running.
- Not started: the package dry-run (pack the project in a temp directory and confirm every required file ships) and the final release-label decision that depends on it.

### Evidence behind each 'done'
- 'Unit suite passes' — evidence: the test command's output, all green, captured in the run log.
- 'Guard review accepted' — evidence: the recorded verdict from the binding cross-family pass, which named the earlier gap and then cleared it after the fix.
- 'Package dry-run' — NO evidence yet; it has not been run. Flagged so the receiver does not assume it.

### Blocker / waiting-on
Not blocked, but waiting on one thing before release labeling: the package dry-run has to run clean. The release label must stay 'candidate' until that output exists.

### Next concrete action
Run the package dry-run against a temp cache and confirm the file list contains every required file. If the list is complete, move the release label from 'candidate' to 'releasable'. If anything is missing, file it as the next fix and keep the label at 'candidate'.

### Baseline
Start from the named release-candidate commit on the release branch (the one whose log entry records the accepted guard review). Do not start from any local working copy that has uncommitted edits — pull the exact commit first, so the dry-run reflects what would actually ship.

### Stop condition
This handoff ends once the dry-run has run and the release label has been set accordingly. At that point the receiver owns the result; if the label moves to 'releasable', the next step is a separate release handoff, not a continuation of this one.

### What session 2 actually does first
Session 2 — a different tool with zero shared memory — reads the packet, checks out the named baseline commit (not its own stale copy), and runs exactly the one next action: the package dry-run against a temp cache. It never has to ask 'what was the background?' or 'where were we?' — the packet already answered both. The dry-run lists every required file, so session 2 flips the label to 'releasable' and writes a short follow-on note. The whole continuation cost the human zero re-explanation.

## How the mechanism changes the outcome

Without this mechanism, a single assistant can produce a smooth answer while hiding uncertainty. With this mechanism, the workflow records trigger, evidence, decision, residual risk, and next action.

## Reuse note

Copy the shape, not the synthetic facts. Adapt the template to your own redacted task.
