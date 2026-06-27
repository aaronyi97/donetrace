# Root-Cause Brake Template

DoneTrace mechanism card. Fill this in a local-first workflow with public-safe or redacted material.

## Purpose

Stop a patch-on-patch death spiral by treating repeated rejection as a signal to fix the cause, not the symptom. When the same artifact gets sent back twice in a row, an automatic brake trips: you may NOT ship another patched version. You must first stop and answer four diagnostic questions — is there a contract conflict, is the verification fake, is the scope too big, is the work split wrong — decide the real root cause, and only then write the next version, rebuilt around that cause instead of carrying forward another layer of fixes.

## Template

### Twice-rejected target (name it):


### Trip condition met? (two consecutive blocks on this same target — yes/no):


### Findings from block 1 (verbatim, do not edit):


### Findings from block 2 (verbatim, do not edit):


### Patched versions shipped after each block (the patch-on-patch trail):


### Q1 Contract conflict? (yes/no/partly + evidence: finding + version + where):


### Q2 Fake verification? (yes/no/partly + evidence):


### Q3 Scope too big? (yes/no/partly + evidence):


### Q4 Wrong split? (yes/no/partly + evidence):


### Named root cause (one structural reason, not a fix list):


### Owner decision (agree / adjust / reject and re-diagnose):


### Version N+1 direction, rebuilt around the cause (NOT another patch):



## Pass bar (tick before you trust the result)

- The brake actually tripped at the second consecutive block instead of a third patched version going out.
- All four diagnostic questions are answered with yes/no/partly AND a concrete evidence pointer — none hand-waved.
- A single structural root cause is named, not a longer list of surface fixes.
- The human owner confirmed (or adjusted) the root cause before the next version started.
- Version N+1 is visibly rebuilt around the cause, and the per-round findings are preserved on the record.

## Reject bar (send it back if any of these is true)

- A third patched version was shipped after two blocks without ever stopping to diagnose (the patch-on-patch spiral the brake exists to break).
- One or more of the four questions was skipped or answered 'probably fine' with no evidence, so the brake was ceremony, not a real stop.
- The 'root cause' is just a restated list of the same surface fixes, so the next version will reproduce the defect.
- The next version started before the owner signed off on the diagnosis.
- The original per-round findings were edited or discarded, destroying the cross-round pattern that the diagnosis depends on.
- The brake was tripped on a first block or on unrelated rejections, draining the signal so a real repeat-block does not stand out.

## Worked example

See `EXAMPLE.synthetic.md` for this same card filled out end to end on a public-safe synthetic task.

## Completion check

- The mechanism has a named trigger.
- The next action is concrete.
- Private details are redacted or rewritten as synthetic examples.
- The result can be handed to another AI tool without extra chat history.
