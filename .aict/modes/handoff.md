# Handoff Mode

Compress state so the next session or tool can pick up exactly where this one stopped.

## Entry condition

Work is about to cross a boundary: a session is ending, a different tool is taking over, or a long task has reached a natural seam.

## Allowed actions

- Compress the current state into a structured handoff packet.
- Seal the baseline (the exact point being handed off) so the receiver starts from a known state.

## Forbidden actions

- Dropping context the receiver needs.
- Omitting the exact first action the next session should take.

## Output format

A handoff packet: what is done, what is pending, what is blocked, what is unverified, the sealed baseline, and the exact next step.

## Exit condition

The receiver confirms they can pick up from the packet alone, without re-reading the whole history.

## Inter-mode handoff

The receiver reads the packet and re-enters execute on the stated first action, continuing the loop from the sealed baseline rather than from zero.
