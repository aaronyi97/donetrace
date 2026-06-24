---
name: red-team
description: Find the failure path before shipping an idea.
---

# red-team skill

## When to use

Use for public releases, irreversible operations, broad claims, security-sensitive behavior, or expensive direction choices.

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

1. Name the most damaging plausible failure.
2. Attack assumptions through user behavior, safety, evidence, and rollback.
3. Separate blockers from tolerable risk.
4. Recommend the smallest mitigation or test.

## Output

- Worst plausible failure
- Attack paths
- Evidence gaps
- Mitigations
- Residual risk

## Safety

- Do not invent dramatic but irrelevant threats.
- Do not skip mundane data-loss or privacy failures.
- Do not treat red-team output as owner approval.

## Example

Before publishing, challenge whether README claims 'integration' when adapters are only guidance files.
