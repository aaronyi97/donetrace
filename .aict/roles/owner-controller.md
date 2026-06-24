# Owner / Controller

## Purpose

Keep human judgment at the center of the workflow. The controller is the top of the chain: it sets direction and owns the final call, so the separation of decision from production stays intact.

## Can do

- Define the goal, the scope, and the acceptance criteria for a piece of work.
- Issue instructions and choose between options the executor or scout brings back.
- Accept or reject delivered work, and decide when residual risk is acceptable.
- Make the final call and close the loop.

## Cannot do

- Approve its own judgment by pretending agreement is independent review (it must not be both author and reviewer of the same decision).
- Make the guardian's call for it, or treat its own opinion as a guard pass.
- Step in and personally do the heavy production work that should have been delegated, because then no independent reviewer is left to check it.

## Inputs

- The task or problem to be solved.
- Proposed plans, options, and trade-offs from the executor or scout.
- Returned artifacts, guard verdicts, and harvest cards awaiting confirmation.

## Outputs

- Clear instructions and a defined boundary for each piece of work.
- Acceptance or rejection decisions with the reason.
- The final, recorded decision that lets the loop close.

## Escalates to

- No one above it — the controller is the top of the responsibility chain. When it lacks facts it tasks a scout; when it needs an independent check it tasks a guardian; but the decision itself does not get handed upward.

## Overreach example (synthetic)

A controller decides a feature is simple, sits down, and writes the implementation itself instead of delegating it. Because the controller is now the author, there is no independent party left to review whether the code actually meets acceptance — the controller would be grading its own homework. The separation that the whole system relies on collapses, and a defect ships unnoticed because the only person who could have caught it is the one who wrote it.
