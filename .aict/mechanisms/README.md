# Mechanisms

The reusable collaboration moves of DoneTrace. Each one is a local-first, public-safe Markdown package you can copy-paste into any AI tool. A mechanism is a self-contained directory with five files:

- `README.md` — what it is, when to use it, and when not to.
- `PROMPT.md` — the copy-paste prompt that runs it.
- `TEMPLATE.md` — a blank you fill in for your own task.
- `EXAMPLE.synthetic.md` — a worked synthetic example (no private data).
- `FAILURE_MODES.md` — how it goes wrong and how to keep it honest.

These are the standing moves; the six layers (profile, context, acceptance, guard, handoff, harvest) are the spine they plug into, and the `cookbook/` recipes show how to run them on a real task.

## The 16 mechanisms

- `dual-guard/` — **Dual Guard.** Trust an artifact only after a guard from a different model family (binding) plus an optional same-family guard (reference) have pressed on it, so a fluent answer is not believed just because it reads well.
- `scout-review-controller/` — **SCOUT Review Controller.** Separate exploration from the decision: a SCOUT gathers options and evidence without choosing, so the controller decides on a real spread instead of the first path that came up.
- `one-click-dispatch/` — **One-Click Dispatch.** Turn a messy task into one self-contained work packet another AI tool can run without inheriting the whole chat.
- `task-splitting/` — **Task Splitting.** Run a five-question pre-dispatch check before handing work to another AI, and split by topic or deliverable so a too-large prompt does not stall or collapse midway.
- `anti-drift-partner/` — **Anti-Drift Partner.** Run a long thinking conversation with an AI that pushes back instead of agreeing — it surfaces your blind spots, probes at most two rounds, then commits to a judgment, so the talk never drifts into fluent confirmation.
- `blind-spot-scan/` — **Blind-Spot Scan.** Borrow an outside viewpoint (customer, competitor, expert, opponent, your-future-self), re-read the decision through that seat, and get back the concrete dead angles you cannot see from your own plus the one counter-question most worth sitting with — and the borrowed viewpoint must genuinely challenge, never flatter from a costume.
- `root-cause-brake/` — **Root-Cause Brake.** When the same artifact is rejected twice in a row, trip a brake: no more patches until you answer four diagnostic questions, name the real cause, and rebuild the next version around it.
- `half-product-review/` — **Half-Product Review.** Block confident "done" when there are docs, demos, and architecture but no runnable first experience a stranger can actually complete.
- `handoff-abc/` — **Handoff A/B/C.** Externalize the current state into a structured packet so any session or tool resumes from where the work really is, instead of re-explaining the background each time.
- `harvest-and-erc/` — **Harvest and External Recap.** Capture the reusable lesson, prompt fragment, or rule candidate from finished work before it leaks away, including across multiple sessions.
- `do-not-handle-yet/` — **Do Not Handle Yet.** Protect the main line by explicitly parking tempting but lower-priority work, on the record, instead of silently dropping or drifting into it.
- `plain-language-first-screen/` — **Plain-Language First Screen.** Make the first screen explain the result, the path, and the proof before any concept or framework name.
- `honest-calibration/` — **Honest Calibration.** Lead every ask for a rating or recommendation with a short candor prefix (be candid, do not inflate, do not over-hedge) that offsets the model's pull to please and re-aims the baseline from make-you-happy to tell-the-truth.
- `feedback-absorption-ledger/` — **Feedback Absorption Ledger.** When merging feedback from several sources, score each item across five tiers (absorb fully / refine / add a boundary / partly absorb / reject with a reason) so you keep independent judgment instead of rubber-stamping — the absorb/reject ratio is an outcome, not a target.
- `collaboration-coach/` — **Collaboration Coach.** Proactively remind the user of the matching collaboration step at key moments, restrained by default.
- `single-tool-guard/` — **Single-Tool Guard.** The default starting guard for one-model-family users (most solo users) — new conversation + adversarial prompt turns a trusted "looks fine" into an evidence-backed, re-checkable result; honestly capped at L2 and explicitly not a passed cross-family gate, which is the upgrade ceiling.

## How to use one

Open the mechanism's `README.md` to confirm it fits, copy the body of its `PROMPT.md` into your AI tool, and paste your own material where the `TEMPLATE.md` marks it. Keep private material local and redacted: the prompts are public-safe, your inputs may not be. To wire a mechanism into a tool as a standing instruction, see `../cookbook/connect-a-tool.md`.
