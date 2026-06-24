# Review a Half Product

A do-it recipe: audit a deliverable that says "done" but might not be, by forcing an independent AI to point at evidence and find the gap, instead of nodding along with "looks good". It uses the review mode plus the dual-guard and half-product-review mechanisms. The target is the classic half product: lots of docs, demo, and confident prose, but the thing it claims a stranger can do does not actually run.

## When to use this

- Someone (a tool, another session, a contributor) hands you work claimed complete and you will build on it or ship it.
- A project has a polished README and architecture talk but you are not sure the first-run experience actually works.
- A completion claim feels too smooth and you want a second, independent pass before you trust it.

Skip it for low-stakes, easily reversible work, or a step you are about to fully re-check yourself anyway. Running a full review on trivial work is ceremony, and ceremony with no payoff trains people to skip review when it matters.

## Prerequisites

- The artifact under review, with stable references the reviewer can point to (line numbers, section anchors, or named files).
- Its definition of done: an acceptance card, or at least the public claim it makes ("a stranger can do X in ten minutes").
- The evidence that supposedly backs the claim: command output, test results, a reproduced result, or a clear note that none exists.
- An AI tool to run the review in, ideally a different model family from whatever produced the artifact, since a different family is the pass most likely to see what the author cannot.

## Steps

1. Pin the claim. Write down, in one line, exactly what the artifact claims is done or usable. A claim you cannot state is a claim you cannot test. If it has an acceptance card, use that; if not, lift the strongest promise from its README or start page.
2. Trace each claim to evidence. For every claim, find the file, command output, or test that proves it, or note that none exists. The half-product pattern is docs and demos that point at nothing runnable. A claim with no evidence is the finding.
3. Try the first-run path. If the claim is "a stranger can do X", do X the way a stranger would: run the entry command, open the file the docs point to, follow the start page. Watch where it breaks or where a referenced artifact is missing.
4. Run the independent guard. Paste the artifact, the acceptance card or pinned claim, and any evidence into the review prompt below, in a second tool. Demand findings tied to specific lines or missing evidence, ordered by severity, with a pass or reject. Do not accept a fluent "looks fine".
5. Merge by strictness, not vote. If the guard names one real, evidence-grounded blocker, the artifact does not pass, even if everything else reads well. One concrete defect outweighs a pile of fluent approval. Compare against `../mechanisms/dual-guard/README.md` for how the binding pass works.
6. Decide the wording. If the first-run path is not actually runnable, downgrade the release language (from "anyone can use this" to "early / not yet runnable end to end") or carry the gap as named residual risk the owner accepts on the record. Silent "good enough" is not allowed.

## Copy-paste block

Paste this into an independent AI tool, ideally a different model family from the one that produced the work. It is tuned to make the reviewer hunt for the gap and cite it, not to praise.

```text
You are an independent reviewer. The work below claims to be complete or usable. Assume it might not be, and prove it either way against the evidence, not the tone.

Claim under test: [paste the one-line "done"/usable claim, or the acceptance card]
Artifact: [paste the artifact, or the README/start page and the key files it points to]
Evidence provided: [paste command output / test results / reproduced result, or write "none provided"]

Do this:
1. For each claim, name the specific evidence that backs it, or state that none was provided.
2. Walk the first-run path a stranger would take. Say exactly where it breaks or where a referenced file/command is missing.
3. List defects ordered by severity. Tie each to a line, section, or the specific missing evidence. No vague "looks good" or "seems fine".
4. If any one real, evidence-grounded blocker exists, the verdict is REJECT even if the rest reads well.

Return:
- Verdict: pass / reject / insufficient_evidence / pass_with_risk (a plain pass needs an L3+ cross-family evidence pack; a single tool tops out at pass_with_risk; summary-only is insufficient_evidence)
- Guard level: L0-L4, the strength of the evidence you actually had. The CLI COMPUTES this from your review method + the evidence (it is not self-declared); a cross-family L3 is shown "self-declared, unverified" because a local tool cannot verify the reviewer's family — L4 (that cross-family review AND a rerun reconciled to a recorded run) is the strongest LOCAL-trust level, not cryptographic proof.
- Findings (each tied to a line, section, or missing evidence)
- Required fixes (the smallest change each blocker needs)
- Residual risk (what stays unverified and who must accept it; a pass_with_risk needs an explicit owner sign-off)
- Recommended release wording (downgrade it if the first-run path is not runnable)

Rules: work only from what I provided; if key evidence is missing, say so rather than assuming it passes; keep examples public-safe.
```

## Expected output

- A verdict: pass, reject, insufficient_evidence, or pass_with_risk, plus the guard level (L0-L4) for the evidence seen.
- A findings list where each item points to a line, section, or a specific missing piece of evidence, not a vibe.
- The exact first-run step where the experience breaks, if it does.
- The smallest fixes required before the work can wear its completion label, and recommended release wording.

## Failure handling

- The reviewer just approves it. It is grading tone, not claims. Re-run and force step 1: every claim must be matched to specific evidence or marked unproven; "looks good" is not a finding.
- The reviewer invents evidence or assumes the path works. Tell it to work only from what you pasted and to say "none provided" rather than assume. If it cannot see the evidence, that absence is itself the result.
- Two reviewers disagree (one approves, one rejects). Do not average them. If the rejection points to a real, evidence-grounded defect, it wins; one concrete blocker beats fluent approval.
- You only have the same tool the author used. Run it anyway in a fresh session, but treat the pass as weaker: same model family tends to miss the same things, so a clean result here is a reference, not a guarantee.

## Privacy note

Review the work, not your private data. Redact before pasting: replace real product names, customer or person names, file paths, and internal numbers with placeholders. Do not paste a private profile, raw private chat logs, or non-public paths into an external AI for review. The review works on a redacted artifact plus its evidence; it does not need the private original.

## Next step

- Use the full two-layer review behind this on higher-stakes artifacts: `../mechanisms/dual-guard/README.md`.
- See the dedicated mechanism for the docs-outrun-runtime pattern: `../mechanisms/half-product-review/README.md`.
- After a reject, package the exact remaining work for whoever fixes it: `../mechanisms/handoff-abc/README.md`.
