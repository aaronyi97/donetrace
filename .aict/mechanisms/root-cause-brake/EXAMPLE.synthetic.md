# Root-Cause Brake Synthetic Example

This is a public-safe synthetic example for DoneTrace. It is local-first and contains no private account, customer, route, hook, or conversation material.

## Synthetic example

A synthetic data-quarantine feature is blocked twice in a row: round one for an inconsistent status field, round two for the same status field plus a self-check that 'passed' a broken case. Instead of shipping a third patch, the brake trips, the four questions reveal a contract conflict (the status field keeps being redefined) compounded by fake verification (the self-check was cosmetic), and the next version is rebuilt by freezing the contract first — not by adding a third fix.

## Full worked example (filled end to end)

An execution AI is building a 'quarantine' feature for a synthetic records tool: bad records get parked in a holding state instead of deleted. The owner reviews each version with an independent guard. Version 4 is blocked. Version 5 is blocked too. The owner is about to ask for version 6 — and trips the Root-Cause Brake instead.

### Twice-rejected target
The quarantine feature for the synthetic records tool. Two consecutive blocking reviews: V4 and V5.

### Trip condition met?
Yes. Same artifact, two blocks in a row. By the rule, version 6 may NOT be another patched draft. Stop and diagnose.

### Findings from block 1 (V4, verbatim)
BLOCK. The quarantine `status` field is written as the string 'held' in one path and the enum value QUARANTINED in another, so downstream reads disagree about whether a record is parked.

### Findings from block 2 (V5, verbatim)
BLOCK. The `status` mismatch from V4 is only half-fixed — one more path still writes 'held'. Also: the self-check claims 'all quarantine transitions verified' but it never exercises the restore-from-quarantine path, so a broken restore passed review.

### Patch-on-patch trail
V4 -> V5 was 'fix the status string in the path the guard named'. It patched the one spot the reviewer pointed at, did not sweep the rest, and added no real test — classic symptom-chasing.

### Q1 Contract conflict?
YES. Evidence: V4 finding + V5 finding both turn on `status` being two things at once ('held' vs QUARANTINED). The agreed definition of the status field is not frozen, so every patch fixes one writer and leaves others on the old assumption.

### Q2 Fake verification?
YES. Evidence: V5 finding — the self-check reported 'all transitions verified' while never running the restore path. The check was cosmetic; it passed a case it never tested.

### Q3 Scope too big?
PARTLY. Evidence: the feature bundles park + restore + audit-log in one unit; the restore path is where the untested gap hid. Not the primary cause, but it widened the surface the fake check let slip.

### Q4 Wrong split?
NO. Evidence: the task was a single coherent feature; the failures are about contract and verification, not about how the work was divided.

### Named root cause
A contract conflict on the `status` field (it was never frozen to one representation), made invisible each round by a verification step that only went through the motions. The patches kept fixing the spot the guard named while the unfrozen contract reintroduced the same class of bug elsewhere, and the hollow self-check kept certifying it.

### Owner decision
Agree with the root cause. Adjustment: freeze the `status` contract to a single enum as step zero of V6, and make the self-check fail first on the restore path before any further work.

### Version 6 direction, rebuilt around the cause (NOT another patch)
V6 does not start from the V5 patch list. Step 1: define `status` as one enum, single source of truth, and update every writer to it at once. Step 2: write a restore-from-quarantine check that fails against the current code, then make it pass. Only then continue. The brake record (both findings, four answers, cause, decision) is filed so a later session sees why the V4->V5->V6 chain was broken on purpose instead of patched a third time.

## How the mechanism changes the outcome

Without this mechanism, a single assistant can produce a smooth answer while hiding uncertainty. With this mechanism, the workflow records trigger, evidence, decision, residual risk, and next action.

## Reuse note

Copy the shape, not the synthetic facts. Adapt the template to your own redacted task.
