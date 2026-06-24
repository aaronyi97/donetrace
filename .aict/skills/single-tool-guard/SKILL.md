---
name: single-tool-guard
description: Run the minimum guard when only one model family is available, with the ceiling named on the record.
---

# single-tool-guard skill

## When to use

Use at a completion claim when no second, different model family exists to run the cross-family binding gate, and you would otherwise trust the same assistant that just wrote the work.

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

1. Open a brand new conversation rather than reusing the drafting thread, whose eagerness to please suppresses objections.
2. Paste an adversarial prompt that defaults to refuting and hunts for missing evidence, tying each finding to a line or section.
3. Bound the verdict at the single-tool ceiling: this tops out at L2 / pass_with_risk and may never be filed as a passed cross-family gate.
4. Name the residual risk a same-family reviewer most likely shares, and leave the upgrade note to run one cross-family pass once a second family appears.

## Output

- Verdict bounded at pass_with_risk (never a plain pass)
- Findings tied to specific lines or sections
- Residual risk a same-family reviewer would share
- Owner sign-off required before pass_with_risk counts as accepted
- Upgrade note: cross-family pass still owed

## Safety

- Do not record a single-family review as if the cross-family binding gate cleared it.
- Do not let pass_with_risk count as accepted without an explicit owner sign-off on the named risk.
- Do not reuse the thread that just claimed done, and do not leave the residual risk blank.

## Example

With only one tool available, a fresh adversarial pass downgrades a done claim to pass_with_risk, names the CSV-escaping blind spot a same-family reviewer would share, and leaves an upgrade note to run a cross-family pass later.
