# Rule update proposal

Purpose: Suggest a new rule from repeated evidence without silently changing the system.

## Scenario

Use when the same failure appears across tasks and may deserve a reusable rule, checklist item, or template change.

## Input requirements

- Observed failures or repeated friction.
- Evidence count and examples.
- Proposed rule text.
- Scope, exceptions, and rollback condition.

## Operating steps

1. Prove the pattern is repeated before proposing anything. State the distinct instances and their dates or contexts; if you have only one, stop and label it a watch-item, not a rule. One anecdote does not earn standing doctrine.
2. Write the rule in operational, checkable language — a reader must be able to tell whether it was followed. 'Be more careful with releases' is uncheckable; 'before labeling a release candidate, install the packed package in a clean temp directory and confirm it runs' is.
3. Answer the lifecycle question that every addition must carry: what does this rule REPLACE, RETIRE, or DEMOTE? A rule that adds to the set without removing or superseding anything is bloat until proven otherwise. If it truly adds net-new coverage, say what it is net-new over and why nothing existing covers it.
4. Specify the full lifecycle in five fields, not just the trigger: (1) TRIGGER — when the rule is read or applied; (2) REPLACES — the rule it supersedes, demotes, or makes redundant; (3) ACCEPTANCE — what observable evidence would show it is actually helping; (4) ARCHIVE CONDITION — how long unused or how much drift before it is demoted or retired; (5) REVIEW WINDOW — when its keep/cut decision gets revisited. A rule with no archive condition and no review window is a rule that can only accumulate.
5. Judge the proposal on net benefit, not on the act of adding or cutting. The test is (expected benefit minus carrying cost and risk), and you only adopt the clearly-positive, low-downside cases; when the benefit is uncertain, do not add it. Equally, do not cut for the sake of looking lean — a dormant rule with no harm can stay; removing a negative is the only subtraction that is automatically worth it.
6. Before proposing any removal or merge, answer the three subtraction questions: (1) does any main-line capability drop if this goes; (2) is the path to bring it back clear; (3) how is a wrong cut rolled back? If those are not answered, the cut is not ready.
7. Present it as a proposal for sign-off, never a silent change to shared behavior. Name the approver and the rollback condition; staging waits for a human to file it.

## Copy-paste prompt

```text
You are helping me with rule update proposal in a local-first AI collaboration workspace.

Task: Suggest a new rule from repeated evidence without silently changing the system.

Trigger:
Use when the same failure or friction has shown up across multiple tasks and may deserve a standing rule, checklist item, or template change — or when you are weighing whether to add, merge, demote, or retire a rule. The unit of justification is a repeated pattern, not a single bad moment.

Do not use when:
Do not run this to mint a rule from one incident, and do not invent a rule just to feel productive — an unjustified standing rule is worse than none, because every future task then has to obey it and read past it. Skip it for a one-off slip with an obvious local fix, or a throwaway preference that will not recur. If the only evidence is a single anecdote, the honest output is 'not yet a rule; watch for recurrence', not a new line in the rulebook.

Input:
The observed failures or friction, with how many distinct times each occurred and a concrete example of each — enough to show a pattern, not one story. The exact rule text being proposed, in operational language. Where it would apply and where it must not. Which existing rule it would replace, demote, or make redundant. The cost of carrying it (added reading, added ceremony, conflict with other rules). And who can approve a change to shared behavior.

Process:
1. Prove the pattern is repeated before proposing anything. State the distinct instances and their dates or contexts; if you have only one, stop and label it a watch-item, not a rule. One anecdote does not earn standing doctrine.
2. Write the rule in operational, checkable language — a reader must be able to tell whether it was followed. 'Be more careful with releases' is uncheckable; 'before labeling a release candidate, install the packed package in a clean temp directory and confirm it runs' is.
3. Answer the lifecycle question that every addition must carry: what does this rule REPLACE, RETIRE, or DEMOTE? A rule that adds to the set without removing or superseding anything is bloat until proven otherwise. If it truly adds net-new coverage, say what it is net-new over and why nothing existing covers it.
4. Specify the full lifecycle in five fields, not just the trigger: (1) TRIGGER — when the rule is read or applied; (2) REPLACES — the rule it supersedes, demotes, or makes redundant; (3) ACCEPTANCE — what observable evidence would show it is actually helping; (4) ARCHIVE CONDITION — how long unused or how much drift before it is demoted or retired; (5) REVIEW WINDOW — when its keep/cut decision gets revisited. A rule with no archive condition and no review window is a rule that can only accumulate.
5. Judge the proposal on net benefit, not on the act of adding or cutting. The test is (expected benefit minus carrying cost and risk), and you only adopt the clearly-positive, low-downside cases; when the benefit is uncertain, do not add it. Equally, do not cut for the sake of looking lean — a dormant rule with no harm can stay; removing a negative is the only subtraction that is automatically worth it.
6. Before proposing any removal or merge, answer the three subtraction questions: (1) does any main-line capability drop if this goes; (2) is the path to bring it back clear; (3) how is a wrong cut rolled back? If those are not answered, the cut is not ready.
7. Present it as a proposal for sign-off, never a silent change to shared behavior. Name the approver and the rollback condition; staging waits for a human to file it.

Output shape:
- Problem pattern: the repeated failure, stated once.
- Evidence: the distinct instances with dates or contexts — enough to show repetition, not a single anecdote.
- Proposed rule: operational, checkable text.
- Replaces / retires / demotes: what existing rule this supersedes, or an explicit argument for why it is net-new.
- Lifecycle fields: trigger / replaces / acceptance / archive condition / review window.
- Net-benefit call: expected benefit versus carrying cost and risk, and why it is clearly positive (or why it should wait).
- Subtraction check (for any removal or merge): capability-loss / recovery-path / rollback answered.
- Scope and exceptions: where it applies and where it must not.
- Review owner and rollback condition: who approves and how a wrong call is undone.

Pass bar (do not pass unless all hold):
- The pattern is shown as repeated across distinct instances, not generalized from one incident.
- The rule is written so a reader can mechanically tell whether it was followed.
- The proposal names what it replaces, retires, or demotes — or argues explicitly why it is net-new — so the rule set is not just growing.
- All five lifecycle fields are present, including an archive condition and a review window, so the rule can later be cut, not only kept.
- The decision rests on net benefit, and any removal answers the capability-loss / recovery-path / rollback questions rather than cutting to look lean.

Reject bar (send back if any holds):
- A standing rule is proposed from a single anecdote with no evidence of recurrence.
- The rule text is a vibe ('be more careful', 'handle releases better') that no one can check compliance against.
- The addition names nothing it replaces, retires, or demotes, and makes no case for being net-new — pure accumulation.
- Lifecycle fields are missing, especially the archive condition and review window, so the rule can only ever be added and never retired.
- A removal or merge is proposed without answering whether a main-line capability drops, how to recover it, or how to roll back a wrong cut — or a harmless dormant rule is cut purely for tidiness.

Rules:
- Work only from the material I provide.
- Keep private material local; use public-safe synthetic wording for examples.
- Label facts, assumptions, and unverified claims.
- Do not claim to understand my private business beyond the provided context.

Material:
[paste redacted material here]
```

## Expected output

- Problem pattern
- Evidence
- Proposed rule
- Scope
- Exceptions
- Review owner
- Rollback condition

## Counter-example

Synthetic: an assistant proposes a brand-new governance rule after one release slipped, adds it to the rulebook, and names nothing it supersedes. Reviewed under this prompt, two faults surface. First, the lifecycle question is unanswered — the rule replaces, retires, and demotes nothing, so it is pure accumulation; and it carries no archive condition or review window, meaning it can only ever be added to the pile. Second, the evidence is a single incident, below the repeated-pattern bar, so the honest output is a watch-item, not doctrine. A revealing real-world tell of this failure mode: a cleanup round that set out to 'add a subtraction metric' ended up adding several new items and removing zero — proof that knowing you should subtract is not the same as the system actually subtracting. The disciplined proposal waits for a second and third recurrence, writes the rule as a checkable temp-install step, states that it replaces an older vaguer 'test before release' note, and attaches an archive condition and a named approver before anything lands.

## Failure modes

- Creating governance bloat from one incident.
- Silently changing shared behavior without approval.
- Writing a rule so vague that it cannot be checked.
- Proposing an addition without naming what it replaces, retires, or demotes, so the rule set only ever grows.
- Cutting a harmless, dormant rule purely to look lean, with no check on what capability is lost or how to roll back.

## Example

After three release tasks missed packed-package smoke tests, propose a release checklist item requiring temp install before candidate labeling.

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
