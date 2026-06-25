# 04 Core Mechanisms

The AI Collaboration Open System ships local-first mechanism packages in `.aict/mechanisms/`. Each package has README, prompt, template, synthetic example, and failure modes.

## Mechanisms

- Dual Guard: a cross-family guard is the binding gate and a same-family guard is a non-binding reference, so a fluent answer is not trusted just because it reads well; passes merge by strictness, where one evidence-grounded blocker outweighs fluent approval.
- SCOUT Review Controller: exploration, challenge, and controller decision stay separate.
- One-Click Dispatch: compact work packet for another AI tool.
- Task Splitting: a five-question pre-dispatch self-check; if any answer is yes, split the task by topic or deliverable (not line count) into self-contained sub-packets so an oversized prompt does not stall or degrade.
- Anti-Drift Partner: a long thinking conversation with an AI that pushes back instead of agreeing — it surfaces blind spots, probes at most two rounds, then commits to a judgment, so the talk never drifts into fluent confirmation.
- Blind-Spot Scan: borrows an outside viewpoint (customer, competitor, expert, opponent, your-future-self), re-reads the decision through that seat, and returns the concrete dead angles you cannot see from your own plus the one counter-question most worth sitting with — and the borrowed viewpoint must genuinely challenge, never flatter from a costume.
- Root-Cause Brake: when the same artifact is rejected twice in a row, the brake trips — no more patches until four diagnostic questions are answered, the real cause is named, and the next version is rebuilt around it.
- Half-Product Review: blocks release claims when docs outrun runnable proof.
- Handoff A/B/C: three handoff modes for three situations - A high-interaction (lightweight same-tool resume), B programmatic (a defined task an executor drives to completion), C delivery overview (a human-facing account of a finished phase) - all carrying the same load-bearing fields.
- Harvest and External Recap: a conversation is swept into harvest cards (one per decision, lesson, method, or stable preference), the human confirms them, and redaction runs before filing; External Recap is a separate role that recaps many conversations at once, gated by a double lock (a fresh session plus an explicit human declaration).
- Do Not Handle Yet: parks tempting adjacent work without losing it.
- Plain-Language First Screen: makes the first user view runnable before theoretical.
- Honest Calibration: leads every ask for a rating or recommendation with a short candor prefix (be candid, do not inflate, do not over-hedge) that offsets the model's pull to please and re-aims the baseline from make-you-happy to tell-the-truth.
- Feedback-Absorption Ledger: when merging feedback from several sources, scores each item across five tiers (absorb fully / refine / add a boundary / partly absorb / reject with a reason) so independent judgment is kept instead of rubber-stamping — the absorb/reject ratio is an outcome, not a target.
- Collaboration Coach: the assistant proactively reminds the user of the matching collaboration step at six recurring moments (define done, review a completion claim, hand off, harvest, update the profile), restrained by default — once per moment, never every turn, because over-prompting is the fastest way to get the system uninstalled.
- Single-Tool Guard: the default starting guard for a one-model-family user — a new conversation plus an adversarial reviewer prompt — whose verdict is always labeled single-family-only with the residual risk named, honestly capped at L2 and never recorded as a passed cross-family binding gate, which is the upgrade ceiling.

## How to use a mechanism

1. Open the mechanism package.
2. Fill the template with redacted local material.
3. Paste the prompt plus context and acceptance into your AI tool.
4. Save the result into handoff or harvest.
5. Run guard review if the result will be trusted by another session.

## Why mechanisms are public-safe

They preserve the workflow shape without exposing private profiles, source conversations, non-public routes, or account material.
