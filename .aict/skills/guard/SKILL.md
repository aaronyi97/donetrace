---
name: guard
description: Challenge artifacts before trust, and grade how strong the evidence actually was.
---

# guard skill

## When to use

Use after a plan, draft, implementation, or research answer exists and before it becomes the basis for the next step.

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

1. Read the context and acceptance card first.
2. Inspect the artifact for missing evidence, privacy leaks, scope drift, and unsupported claims.
3. Lead with findings ordered by severity.
4. State the evidence level you actually saw (L0 summary only / L1 artifact but no real run / L2 author-supplied commands or tests, single tool / L3 structured evidence pack reviewed by a different model family / L4 that cross-family review AND you independently re-ran and reconciled the key evidence).
5. Return one of the four standard verdicts, bounded by that level: pass / reject / insufficient_evidence / pass_with_risk. A plain pass needs L3+ (the cross-family pack); a single tool tops out at pass_with_risk (L2); summary-only is insufficient_evidence (L0); an L4 pass must show a cross-family review AND your reconciled rerun output.

## Output

- Verdict (pass / reject / insufficient_evidence / pass_with_risk)
- Guard level (L0-L4) for the evidence you saw
- Findings
- Evidence
- Required fixes
- Residual risk

## Safety

- Do not rubber-stamp your own work.
- Do not review only style.
- Do not call work complete without fresh verification.
- Do not return pass above your evidence level: no pass without an L3+ cross-family pack, no pass from a single tool, no L4 pass without BOTH a cross-family pack and a reconciled rerun.
- Do not treat a pass_with_risk as accepted on your own — it needs an explicit owner sign-off.

## Example

Reject a case study that lacks baseline output because users cannot see why the structured loop is better than raw chat; record it as guard level L1 (artifact exists, no real run).
