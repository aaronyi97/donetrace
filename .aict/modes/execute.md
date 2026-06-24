# Execute Mode

Build the agreed artifact, and only that.

## Entry condition

There is a clearly defined task with execution authority granted: a goal, a boundary, and acceptance criteria are all in place.

## Allowed actions

- Create or edit the agreed artifact.
- Change the in-scope files or sections and save state.
- Self-verify the work and capture the evidence.

## Forbidden actions

- Doing work outside the stated task or boundary.
- Crossing a core boundary (rules, security-sensitive areas, anything out of scope) without stopping.
- Declaring the work done without running the checks.

## Output format

The artifact, the list of changed files or sections, the verification evidence, and an explicit note of what is still unverified.

## Exit condition

The task is wrapped up and has passed acceptance, or it is blocked and must be handed off.

## Inter-mode handoff

When the artifact is done, move to review so an independent pass can challenge it before it is trusted; if work must cross a session or tool boundary first, move to handoff and let the receiver re-enter execute.
