# Root-Cause Brake

Part of DoneTrace. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

Stop a patch-on-patch death spiral by treating repeated rejection as a signal to fix the cause, not the symptom. When the same artifact gets sent back twice in a row, an automatic brake trips: you may NOT ship another patched version. You must first stop and answer four diagnostic questions — is there a contract conflict, is the verification fake, is the scope too big, is the work split wrong — decide the real root cause, and only then write the next version, rebuilt around that cause instead of carrying forward another layer of fixes.

## When to use

Trip the brake the moment the same thing has been rejected twice in a row (two consecutive blocking reviews on the same artifact or task), or whenever you catch yourself about to start version N+1 by adding more fixes to a growing patch list. It also fires on suspicion: a reviewer says 'we keep treating symptoms', or you notice the same kind of defect coming back under a different name each round.

## When not to use

Do not trip it on a first rejection, on rejections of genuinely different things, or on a single small fix that clearly resolves a one-off mistake. One block is normal review; the brake is specifically for the repeated-block pattern. Forcing a full root-cause stop after every minor note is ceremony that buries the signal — the brake only means something if it stays reserved for the second consecutive block on the same target.

## Input shape

The same artifact or task that has now been rejected twice. The findings from each blocking review, kept intact (do not edit the originals — you need the actual pattern across rounds). The version history: which patched versions you produced after each block, so the 'kept adding fixes' pattern is visible. Enough detail on each finding to answer the four diagnostic questions with evidence (which finding, which version, where), not from memory or vibe.

## Input materials

- The twice-rejected artifact or task, named explicitly so the brake is scoped to one target, not a vague 'things keep failing'.
- Each blocking review's findings, preserved verbatim — the cross-round pattern is the whole diagnostic, and editing the originals destroys it.
- The version trail: the patched version you shipped after block 1, after block 2, so the patch-on-patch shape is on the record.
- Per-finding specifics (which finding, which version, what exactly failed) so each of the four questions can be answered with a concrete pointer, not a guess.
- Any reviewer remark that named a root cause ('this is symptom-chasing'), since that is often the first real diagnosis of why the patches are not landing.

## Process

1. Detect the trip condition: the same artifact has two consecutive blocking reviews. The moment that is true, stop. Do NOT open version N+1 as another patched draft — that move is exactly what the brake forbids.
2. Answer all four diagnostic questions, each with a yes / no / partly AND concrete evidence (which finding, which version, where it shows). Partial answers are not allowed; a hand-waved 'probably fine' on any question defeats the brake. Q1 Contract conflict: are the agreed definitions — fields, states, interfaces, success criteria — quietly changing from round to round, so each fix breaks a different assumption? Q2 Fake verification: is the checking step (a self-review, a gate, a test) only going through the motions, passing things it should have caught? Q3 Scope too big: is a single unit of work carrying too many fields / states / responsibilities to get right in one pass? Q4 Wrong split: is the work cut too coarse or too fine — a packet that is really five tasks, or a job shattered into pieces that cannot be verified alone?
3. Name the root cause. From the four answers, state which underlying cause is actually generating the repeat blocks — not a list of surface fixes, but the one structural reason the patches keep failing.
4. Get the root cause confirmed by the human owner before proceeding (agree / adjust / reject and re-diagnose). The brake is a deliberate governance stop, so the person who owns the work signs off on the diagnosis before the next version starts. This is not a project pause — work resumes immediately after sign-off; it just resumes rebuilt around the cause.
5. Write version N+1 from the root cause, not from the patch list. The next version is a rebuild aimed at the named cause; it must not re-enact the old defect under a new patch. If the cause was 'scope too big', the next version is smaller; if it was 'fake verification', the next version fixes the check first, and so on.
6. Record the brake on the record: the preserved findings from each block, the four answered questions with evidence, the named root cause, the owner's decision, and the rebuilt direction — so a later session sees why the chain was broken and does not restart the patch spiral.

## Output shape

- Trip confirmation: a one-line statement that the same target hit two consecutive blocks, so the brake applies.
- Four answered questions: Q1 contract conflict, Q2 fake verification, Q3 scope too big, Q4 wrong split — each yes/no/partly with a concrete evidence pointer (finding + version + where).
- Named root cause: the single structural reason the patches kept failing, derived from the four answers.
- Owner decision: agree / adjust / reject-and-re-diagnose, recorded.
- Rebuilt direction for version N+1: how the next version is built around the cause, explicitly not a continuation of the patch list.
- Brake record: preserved per-round findings + answers + cause + decision, so the next session does not reopen the spiral.

## Pass bar (what counts as done / safe to trust)

- The brake actually tripped at the second consecutive block instead of a third patched version going out.
- All four diagnostic questions are answered with yes/no/partly AND a concrete evidence pointer — none hand-waved.
- A single structural root cause is named, not a longer list of surface fixes.
- The human owner confirmed (or adjusted) the root cause before the next version started.
- Version N+1 is visibly rebuilt around the cause, and the per-round findings are preserved on the record.

## Reject bar (what sends it back)

- A third patched version was shipped after two blocks without ever stopping to diagnose (the patch-on-patch spiral the brake exists to break).
- One or more of the four questions was skipped or answered 'probably fine' with no evidence, so the brake was ceremony, not a real stop.
- The 'root cause' is just a restated list of the same surface fixes, so the next version will reproduce the defect.
- The next version started before the owner signed off on the diagnosis.
- The original per-round findings were edited or discarded, destroying the cross-round pattern that the diagnosis depends on.
- The brake was tripped on a first block or on unrelated rejections, draining the signal so a real repeat-block does not stand out.

## Common misuse

- Quietly shipping 'just one more small patch' after the second block because the fix 'feels close', which is precisely the spiral the brake is built to stop.
- Filling in the four questions as a formality with no evidence, so the diagnostic theatre passes while the real cause stays unfound.
- Calling a list of surface symptoms the 'root cause', so version N+1 patches the same things again under a new name.
- Editing the earlier findings to look tidier, which erases the across-rounds pattern that is the entire point of the diagnosis.
- Tripping the brake on every minor rejection, so the team learns to ignore it and it no longer signals a genuine repeat-block.
- Treating the brake as a project freeze and stalling the work, when it is only a diagnostic stop — work resumes the moment the owner confirms the cause.

## Package files

- `README.md` explains the mechanism.
- `PROMPT.md` gives the copy-paste prompt.
- `TEMPLATE.md` gives the blank operating card.
- `EXAMPLE.synthetic.md` shows a public-safe run.
- `FAILURE_MODES.md` names common ways this mechanism fails.
