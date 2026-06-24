# Dual Guard Failure Modes

AI Collaboration Open System failure checklist. Use it in a local-first workflow before trusting a mechanism run, and rewrite any public example into public-safe language.

## Failure modes

- Both guards review the same surface and miss the real risk.
- The controller copies every comment instead of merging decision-changing findings.
- A warning is treated as a pass without naming residual risk.

## Common misuse (operator errors that look fine but break the mechanism)

- Treating it as a vote: two approvals and one blocker get tallied as 'pass'. It is not a poll; one concrete, evidence-grounded blocker is enough to reject.
- Using two guards from the SAME model family and calling it dual-guard. Same-family reviewers tend to miss the same things; same-family passes catch fewer real problems than a cross-family pass, so without the cross-family binding guard the structure's whole point is gone.
- Letting the binding guard 'review' with no acceptance card or evidence, so it grades tone and fluency instead of checking claims against proof.
- Copying every comment from both guards into the merge instead of keeping only the decision-changing findings, which buries the real blocker in noise.
- Accepting a warning as a pass without writing down the residual risk or who accepted it, so the next session inherits a hidden gap.
- Skipping the whole mechanism on a genuinely high-stakes artifact because it 'reads fine' which is exactly the fluent-but-wrong case the cross-family guard exists to catch.

## Guard questions

1. Did this mechanism change the decision, or just add ceremony?
2. Is any private material copied instead of summarized or synthesized?
3. Are blockers, residual risks, and next actions separated?
4. Could a new session continue from this file alone?
