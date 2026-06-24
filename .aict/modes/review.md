# Review Mode

Inspect and challenge the artifact — without changing it.

## Entry condition

There is a produced artifact that needs to be checked before anyone trusts it.

## Allowed actions

- Inspect the artifact against context, acceptance, and evidence.
- Challenge claims, surface blind spots, and point each finding to a specific line, section, or missing piece of evidence.

## Forbidden actions

- Editing or fixing the artifact under review. Review and repair stay separate, so the reviewer never becomes the author of what it judges.

## Output format

One of the four standard verdicts (pass / reject / insufficient_evidence / pass_with_risk) plus the guard level (L0-L4) for the evidence seen, the findings with severity, the required fixes, and the named residual risk. A plain pass requires L3+ (a cross-family evidence pack); a pass_with_risk is not accepted until the owner explicitly signs off on the residual risk.

## Exit condition

A verdict has been issued.

## Inter-mode handoff

On reject, hand the required fixes back to execute for repair; on pass, move to handoff or to close. Review never applies the fix itself — it returns the artifact to execute for that.
