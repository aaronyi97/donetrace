# Guard review

Purpose: Review an artifact against context, acceptance, evidence, and privacy boundaries.

## Scenario

Use after a draft or implementation exists and before future work treats it as trusted.

## Input requirements

- Artifact under review.
- Context package.
- Acceptance card.
- Verification evidence and known unverified areas.

## Operating steps

1. Lead with findings, not compliments. The job is to find what is wrong before it propagates, not to reassure.
2. Hunt for the five faces of a half-product — work that looks finished but is not — and for each, run its concrete tell. (1) DONE BUT NOT ACTUALLY DONE: the report says complete; demand the command plus real output and confirm it was actually run, not narrated. (2) PAPER EXISTS BUT THE FUNCTION DOES NOT: the file/hook/feature is present but never wired in; check that it is actually invoked and produces a real effect, not just that it exists on disk. (3) NUMBERS LOOK RIGHT BUT THE DENOMINATOR IS WRONG: a clean percentage or count; pin the exact scope and denominator and recompute, because pending and not-started items get quietly mixed in. (4) JUDGMENT THEATER: 'I judged it safe / I reviewed it'; require a named failure scenario actually tried, or an independent check — a verdict with no attempted break is decoration. (5) CITATION DRIFT: a real source is cited but misquoted, dropped a clause, or summarized into a different claim; open the source and compare the quoted span word-for-word, because drift looks more trustworthy than invention.
3. Treat the author's own self-assessment as unreliable in seven specific zones and re-verify each independently rather than accepting 'I checked it': (1) counts — fields, lines, items, totals drift between two spots in the same artifact; (2) self-audit checklists with empty filler rows like 'expected N' or a bracketed blank but no actual result filled in; (3) self-audit table rows that describe a check in prose but never show the command that performs it; (4) 'tested' claims that state an expected value but no observed value; (5) attention on long documents — past a few hundred lines a self-check goes formal and misses things, so spot-check the tail, not just the top; (6) self-rule-compliance — 'I followed rule X strictly' is contradicted by at least one counter-instance often enough that it cannot be taken on faith; (7) running totals carried across sessions, which accumulate off-by-one drift. In all seven, the sentence 'I already verified this' is itself the thing not to trust.
4. Tie every issue to a requirement, a line, a section, or a specific missing piece of evidence. A finding that cannot point at a spot is a vibe, not a finding.
5. Sort findings into blocker / high / medium / residual, and state which are decision-changing.
6. State the GUARD LEVEL — how strong the evidence you actually had was — because it caps the verdict you may give. L0: you saw only a completion summary. L1: the artifact and acceptance card exist but there is no real run/test output. L2: you have the author's commands or tests but you are a single tool / single model family. L3: there is a structured evidence pack AND a guard from a different model family pressed on it. L4: on top of that cross-family review (L3), you ALSO independently re-ran the key evidence and reconciled it to a recorded run — a rerun alone, single-family, stays L2.
7. Return ONE of the four standard verdicts, bounded by the level — pass / reject / insufficient_evidence / pass_with_risk. The ceiling: L0 can only be insufficient_evidence; L1 cannot pass (best is reject or pass_with_risk); L2 (single tool) tops out at pass_with_risk; a plain pass needs L3+ (the cross-family pack); an L4 pass must cite BOTH the cross-family pack AND your reconciled rerun output. A pass_with_risk is NOT 'accepted' on your say-so — the owner must explicitly accept the named residual risk. For anything not fixed, name it as residual risk on the record. A reviewer never silently upgrades 'reads fine' into 'verified'.

## Copy-paste prompt

```text
You are helping me with guard review in a local-first AI collaboration workspace.

Task: Review an artifact against context, acceptance, evidence, and privacy boundaries.

Trigger:
Use after a draft or implementation exists and before any future work treats it as trusted: a completion claim, a release candidate, a citation-heavy document, a 'done and tested' report, or any artifact whose wrong 'looks fine' would propagate into later work.

Do not use when:
Skip the full review on low-stakes, easily reversible work, or a step the owner is about to fully re-run by hand: a one-line wording fix, a scratch draft, a trivial config tweak. A heavy guard pass on throwaway work is ceremony, and ceremony with no payoff trains people to skip review when it matters.

Input:
The artifact under review, with stable line or section references so a finding can cite an exact spot. The acceptance card or definition of done it claims to meet. The context boundary (goal, scope, non-goals). The verification evidence the completion claim rests on (real command output, test results, a reproduced behavior) or a clear note that none exists. Which model family drafted it, so a same-family 'I reviewed my own work' is weighted as the weak signal it is.

Process:
1. Lead with findings, not compliments. The job is to find what is wrong before it propagates, not to reassure.
2. Hunt for the five faces of a half-product — work that looks finished but is not — and for each, run its concrete tell. (1) DONE BUT NOT ACTUALLY DONE: the report says complete; demand the command plus real output and confirm it was actually run, not narrated. (2) PAPER EXISTS BUT THE FUNCTION DOES NOT: the file/hook/feature is present but never wired in; check that it is actually invoked and produces a real effect, not just that it exists on disk. (3) NUMBERS LOOK RIGHT BUT THE DENOMINATOR IS WRONG: a clean percentage or count; pin the exact scope and denominator and recompute, because pending and not-started items get quietly mixed in. (4) JUDGMENT THEATER: 'I judged it safe / I reviewed it'; require a named failure scenario actually tried, or an independent check — a verdict with no attempted break is decoration. (5) CITATION DRIFT: a real source is cited but misquoted, dropped a clause, or summarized into a different claim; open the source and compare the quoted span word-for-word, because drift looks more trustworthy than invention.
3. Treat the author's own self-assessment as unreliable in seven specific zones and re-verify each independently rather than accepting 'I checked it': (1) counts — fields, lines, items, totals drift between two spots in the same artifact; (2) self-audit checklists with empty filler rows like 'expected N' or a bracketed blank but no actual result filled in; (3) self-audit table rows that describe a check in prose but never show the command that performs it; (4) 'tested' claims that state an expected value but no observed value; (5) attention on long documents — past a few hundred lines a self-check goes formal and misses things, so spot-check the tail, not just the top; (6) self-rule-compliance — 'I followed rule X strictly' is contradicted by at least one counter-instance often enough that it cannot be taken on faith; (7) running totals carried across sessions, which accumulate off-by-one drift. In all seven, the sentence 'I already verified this' is itself the thing not to trust.
4. Tie every issue to a requirement, a line, a section, or a specific missing piece of evidence. A finding that cannot point at a spot is a vibe, not a finding.
5. Sort findings into blocker / high / medium / residual, and state which are decision-changing.
6. State the GUARD LEVEL — how strong the evidence you actually had was — because it caps the verdict you may give. L0: you saw only a completion summary. L1: the artifact and acceptance card exist but there is no real run/test output. L2: you have the author's commands or tests but you are a single tool / single model family. L3: there is a structured evidence pack AND a guard from a different model family pressed on it. L4: on top of that cross-family review (L3), you ALSO independently re-ran the key evidence and reconciled it to a recorded run — a rerun alone, single-family, stays L2.
7. Return ONE of the four standard verdicts, bounded by the level — pass / reject / insufficient_evidence / pass_with_risk. The ceiling: L0 can only be insufficient_evidence; L1 cannot pass (best is reject or pass_with_risk); L2 (single tool) tops out at pass_with_risk; a plain pass needs L3+ (the cross-family pack); an L4 pass must cite BOTH the cross-family pack AND your reconciled rerun output. A pass_with_risk is NOT 'accepted' on your say-so — the owner must explicitly accept the named residual risk. For anything not fixed, name it as residual risk on the record. A reviewer never silently upgrades 'reads fine' into 'verified'.

Output shape:
- Verdict: one of pass / reject / insufficient_evidence / pass_with_risk (with the single decisive reason).
- Guard level: L0 / L1 / L2 / L3 / L4 — the strength of the evidence you actually had, which bounds the verdict above.
- Findings ordered by severity, each tied to a line, section, requirement, or missing evidence.
- Half-product check: which of the five faces appeared, and the tell that exposed it.
- Self-assessment check: which of the seven unreliable zones were re-verified independently and what that re-check found.
- Evidence: the command output, citation comparison, or reproduction the verdict rests on (for an L4 pass, the cross-family pack AND your reconciled rerun output).
- Required fixes: the concrete change each blocker needs.
- Residual risk: what stays unverified and who must accept it (a pass_with_risk needs an explicit owner sign-off).

Pass bar (do not pass unless all hold):
- The verdict is within the guard level's ceiling: no plain pass below L3, no pass from a single tool, no L4 pass without BOTH a cross-family pack and a reconciled rerun, and L0 only ever yields insufficient_evidence.
- Every completion claim is backed by evidence the guard could actually point to, not by the author's assurance.
- None of the five half-product faces survives unexamined; any that appeared was caught with its concrete tell.
- Each of the seven self-assessment zones that applies was re-verified by the guard, not taken on the author's 'I checked it'.
- All acceptance criteria are met, or the unmet ones are named as accepted residual risk rather than hidden; any pass_with_risk has an explicit owner sign-off.
- No private material leaked and scope stayed inside the stated boundary.

Reject bar (send back if any holds):
- The verdict claims more than the guard level allows — a plain pass on summary-only or single-tool evidence, or an L4 pass with no cross-family pack or no reconciled rerun (the 'single tool dressed up as a binding pass' failure).
- A pass_with_risk is treated as accepted with no explicit owner sign-off on the residual risk.
- A completion claim asserts more than the evidence shows — the classic 'said it was done but it was not'.
- A file/feature is counted as working purely because it exists, with no proof it is wired in and produces an effect.
- A number or percentage is accepted without pinning its denominator, so not-started items are silently inflating it.
- A safety or correctness call is 'I judged it fine' with no failure scenario tried and no independent check.
- A citation is trusted without opening the source, and a word-for-word compare would have shown drift.
- The review leans on the author's self-audit in one of the seven unreliable zones instead of re-verifying it.

Rules:
- Work only from the material I provide.
- Keep private material local; use public-safe synthetic wording for examples.
- Label facts, assumptions, and unverified claims.
- Do not claim to understand my private business beyond the provided context.

Material:
[paste redacted material here]
```

## Expected output

- Verdict
- Findings ordered by severity
- Evidence
- Required fixes
- Residual risk
- Pass or reject recommendation

## Counter-example

Synthetic: an artifact ships with a confident summary, a self-audit table every row ticked, and the line 'I verified all 12 acceptance items pass.' A tone-only review would approve. Under this prompt: the self-audit rows describe checks but show no commands (zone 3), 'tested' rows give expected values but no observed ones (zone 4), and the count '12' is 11 when actually listed (zone 1). Re-verifying independently shows two items were never wired in (half-product face 2) and one cited source was summarized into a claim it never made (face 5). Because the guard only had the author's artifact and no real run, this is guard level L1 — which cannot pass anyway. Verdict: reject — the polished surface was hiding three unproven claims, which is exactly why the author's own 'I verified it' could not clear the gate.

## Failure modes

- Rubber-stamping the same assistant's output.
- Reviewing tone while ignoring the acceptance card.
- Calling work complete without fresh verification evidence.
- Trusting the author's own 'I checked it' on counts, citations, or self-rule-compliance — exactly the claims a model is worst at self-judging.
- Reading a polished structure (headings, summary, confident prose) as proof the underlying thing actually runs.

## Example

Guard rejects a README that claims multi-tool integration when the code only writes adapter guidance files.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
