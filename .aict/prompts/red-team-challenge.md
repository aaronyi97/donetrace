# Red-team challenge

Purpose: Attack a plan or artifact from the angle most likely to make it fail.

## Scenario

Use before high-risk decisions, public release, data migration, force overwrite, or claims that could mislead users.

## Input requirements

- Plan or artifact to challenge.
- What failure would be expensive, embarrassing, unsafe, or irreversible.
- Known assumptions and skipped checks.

## Operating steps

1. Take the attacker's stance, not the helper's. Your job is to make the thing fail, get abused, or get bypassed — and to show it, not to politely suggest improvements. 'Consider adding validation' is not a red-team finding; 'here is the exact input that deletes the user's files' is.
2. Name the single most damaging plausible failure first, in concrete terms (what is lost, who is harmed, can it be undone). Lead with the worst case so a reader feels the stakes before the details.
3. Walk real abuse and bypass paths, not exotic ones: the ordinary user who clicks the destructive button by accident or misreads the prompt; the insider who takes the convenient shortcut around the safeguard; the automated or repeated call that hits an unhandled edge; the malformed or hostile input; the missing rollback when a step fails halfway; the privacy or secret that leaks through an error message, a log, or an example. Prefer the mundane data-loss path over the cinematic one.
4. For each path, try to actually break it on the provided material and show the trigger — the exact input, sequence, or condition — and the resulting damage. If you cannot fully demonstrate it from what was given, say what specific evidence or test would confirm or kill the attack.
5. Separate fatal flaws (must fix before this ships) from acceptable trade-offs (real but tolerable, named as residual risk). Do not inflate every nit into a blocker; that buries the one attack that actually matters.
6. End with the smallest concrete change or test that closes the most dangerous path — the minimal mitigation, not a rewrite.

## Copy-paste prompt

```text
You are helping me with red-team challenge in a local-first AI collaboration workspace.

Task: Attack a plan or artifact from the angle most likely to make it fail.

Trigger:
Use before high-stakes, hard-to-reverse moves: a public release, a data migration, a force-overwrite or destructive flag, a security or auth change, a permissions or payment path, or any claim that could mislead users if it were wrong. Run it when you need to know how the thing breaks, not whether it is nice.

Do not use when:
Skip it on low-stakes, easily reversible work, or where the worst case is trivial and self-correcting: a wording tweak, a scratch script, a change you can undo in one step with no data or trust at risk. A full attack pass on trivial work is theater, and theater with no payoff trains people to ignore the red team when the stakes are real.

Input:
The plan or artifact to attack. What a failure would cost — money, data loss, a privacy leak, user harm, reputational damage, an irreversible state. The acceptance criteria it claims to meet. The assumptions the author is leaning on and the checks they admit they skipped. Who can touch it: end users, insiders, automated callers, a future maintainer who forgot the context.

Process:
1. Take the attacker's stance, not the helper's. Your job is to make the thing fail, get abused, or get bypassed — and to show it, not to politely suggest improvements. 'Consider adding validation' is not a red-team finding; 'here is the exact input that deletes the user's files' is.
2. Name the single most damaging plausible failure first, in concrete terms (what is lost, who is harmed, can it be undone). Lead with the worst case so a reader feels the stakes before the details.
3. Walk real abuse and bypass paths, not exotic ones: the ordinary user who clicks the destructive button by accident or misreads the prompt; the insider who takes the convenient shortcut around the safeguard; the automated or repeated call that hits an unhandled edge; the malformed or hostile input; the missing rollback when a step fails halfway; the privacy or secret that leaks through an error message, a log, or an example. Prefer the mundane data-loss path over the cinematic one.
4. For each path, try to actually break it on the provided material and show the trigger — the exact input, sequence, or condition — and the resulting damage. If you cannot fully demonstrate it from what was given, say what specific evidence or test would confirm or kill the attack.
5. Separate fatal flaws (must fix before this ships) from acceptable trade-offs (real but tolerable, named as residual risk). Do not inflate every nit into a blocker; that buries the one attack that actually matters.
6. End with the smallest concrete change or test that closes the most dangerous path — the minimal mitigation, not a rewrite.

Output shape:
- Worst plausible failure: the single most damaging realistic outcome, stated concretely.
- Attack paths: each with its trigger (exact input / sequence / condition) and the damage it causes.
- How it gets abused or bypassed: the accidental-user, insider-shortcut, and automated-edge angles, not just the malicious outsider.
- Evidence gaps: what could not be fully demonstrated and the exact test that would confirm or kill each attack.
- Fatal vs tolerable: which findings block shipping and which are named residual risk.
- Smallest mitigation: the minimal change or test that closes the most dangerous path.

Pass bar (do not pass unless all hold):
- The worst-case failure is named first and in concrete, this-is-what-is-lost terms.
- At least one attack is shown with its actual trigger and damage, not phrased as a gentle suggestion.
- Accidental-misuse and insider-shortcut paths are covered, not only deliberate outsider attacks.
- Mundane data-loss and rollback gaps are checked, not skipped in favor of exotic threats.
- Findings are split into fatal vs tolerable, and each fatal one comes with the smallest mitigation that closes it.

Reject bar (send back if any holds):
- The output is theatrical or vague ('an attacker could do bad things') with no concrete trigger.
- It only offers polite improvements and never demonstrates or pins a real break.
- It invents impossible or exotic threats while missing the obvious data-loss, overwrite, or leak path.
- It challenges the idea in general but never tests the exact acceptance criteria or the destructive flag in question.
- Every finding is rated a blocker, so the one attack that actually matters is buried in nits.

Rules:
- Work only from the material I provide.
- Keep private material local; use public-safe synthetic wording for examples.
- Label facts, assumptions, and unverified claims.
- Do not claim to understand my private business beyond the provided context.

Material:
[paste redacted material here]
```

## Expected output

- Worst plausible failure
- Attack paths
- Evidence gaps
- Required mitigations
- Acceptable residual risk

## Counter-example

Synthetic: a CLI ships a `--force` flag that re-creates a workspace directory. A gentle review says 'consider warning the user before overwriting.' The red-team stance instead shows the break: run `init --force` in a directory where the user also keeps their own notes file, and the worst case is those user-created files are deleted with no backup and no undo. The trigger is concrete (force flag plus a non-empty target), the damage is irreversible data loss, the abuse path is the ordinary user who did not realize the directory was shared, and the smallest mitigation is to move the existing workspace to a timestamped backup before recreating it and to refuse on unexpected extra files — not a rewrite.

## Failure modes

- Being theatrical instead of specific.
- Inventing impossible threats while missing mundane data-loss risks.
- Challenging the idea but not the exact acceptance criteria.
- Giving gentle suggestions ('consider adding a check') instead of demonstrating an actual break.
- Attacking only malicious outsiders while ignoring the ordinary user who clicks the wrong thing and the insider who takes a convenient shortcut.

## Example

For a --force option, the red team asks whether user-created files inside the target directory survive or are backed up.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
