# Bridge to a Second Family

A do-it recipe: set up the second, different-model-family AI that the cross-family guard needs, and route a review across it. The rest of the system keeps telling you "when a second, different model family is available, you can upgrade to the cross-family double guard" — this recipe is the missing how. It does not redefine the guard: `../mechanisms/dual-guard/README.md` owns the judgment rules (L3 vs L4, binding vs reference, layered strictness over majority vote, the pass and reject bars). This recipe only covers the part those rules assume you already did: pick a second family, get your material across to it safely, and keep evidence that the second family actually ran.

There are two tracks. The manual bridge (copy-paste between two AIs) is the main path: it works with any two tools, needs no setup, and never breaks. The auto bridge (a tool that dispatches the review to another family for you) is an optional convenience. Start manual; reach for auto only if a tool you already use offers it.

## When to use this

- A completion claim is about to be trusted by another session, tool, or person, and you want the cross-family binding gate the dual-guard mechanism describes — but you only have one tool wired up so far.
- You keep stopping at "upgrade to a second model family" and do not know how to actually stand one up.
- You have run `single-tool-guard` and want to move a result above its L2 ceiling with a genuine cross-family pass.

Skip it for low-stakes, easily reversible work a human will fully re-check anyway. A single tool's own adversarial pass (`../mechanisms/single-tool-guard/README.md`) is the right tool there; bridging to a second family is the upgrade for work that will propagate.

## Prerequisites

- A redacted version of the artifact under review (swap private names, paths, and numbers for placeholders). Nothing private needs to leave your machine; a redacted copy is enough.
- Its acceptance card or one-line "done" claim, and the evidence that supposedly backs it (command output, test result, a reproduced result, or a clear note that none exists).
- One AI tool you already use as your primary (the family that drafted the work, or any family you treat as home base).
- A second AI that is a DIFFERENT model family from your primary. That is the whole point: a different family does not share your primary's blind spots. (How to choose one is Step 1 below — you do not need it set up before you start.)

## Track A — the manual bridge (main path, works with any two tools)

### Step 1. Choose a second family

Pick any AI that is a different model family from your primary tool. The families differ; the move does not. Concrete examples (each is just an example — substitute freely):

- Primary is a Claude-family tool? Use a GPT-family or a Gemini-family AI as the second.
- Primary is a GPT-family tool? Use a Claude-family or a Gemini-family AI as the second.
- Primary is a Gemini-family tool? Use a Claude-family or a GPT-family AI as the second.

Any different-family pairing works — the names above are illustrations, not a required list. What matters is "different family", not which brands. Two tools that wrap the same underlying family (for example two products both built on the same model) do NOT count as a cross-family pair; the dual-guard mechanism treats that as same-family, capped below the cross-family gate. If you are unsure whether two tools share a family, treat them as same-family until you can confirm otherwise.

### Step 2. Redact before it leaves your primary

The second AI cannot read your disk; to review your material it has to be pasted in. So redact first, exactly as in `connect-a-tool.md`: replace real product names, customer or person names, file paths, and internal numbers with placeholders. Do not paste a private profile, raw private chat logs, internal numbers, or non-public paths into the second AI. The review works on a redacted artifact plus its evidence; it does not need the private original.

### Step 3. Send the package across and run the cross-family review

This is your move to make, not the second AI's — it cannot read your disk, so you fetch the file contents and paste them in. On your own machine, open `../mechanisms/dual-guard/PROMPT.md` and copy its "Copy-paste prompt" body. Then paste one combined message into the second (different-family) AI: the carrier wrapper below, the dual-guard body you just copied, and your redacted material (artifact, acceptance card, context boundary, evidence). The carrier is a thin wrapper that hands the pasted dual-guard body to the second AI as its instructions; it does not restate the guard's rules, because the dual-guard mechanism owns them.

### Step 4. Collect the verdict and record binding evidence

Read back the verdict using the dual-guard pass and reject bars (do not re-derive them here). Then record what makes the result trustworthy later: which family was the binding guard, the findings, the fixes, and the residual risk. A bridge to a second family reaches L3 (a structured evidence pack reviewed by a different family). To reach L4, the binding guard must independently re-run the key evidence and reconcile it to a recorded run — re-running the critical check yourself across the second family is what raises a cross-family L3 to L4 (the strongest LOCAL-trust level, not cryptographic proof).

## Copy-paste block (manual bridge)

Paste this into the second, different-family AI. It carries your material to the dual-guard prompt; it deliberately does not repeat the guard's judgment rules.

```text
Run a cross-family review for me. You are the second, different-model-family guard.

Your full instructions are the Dual Guard prompt body, which I have pasted directly below. Follow it exactly (process, output shape, pass bar, reject bar, guard-level rules). It is the source of truth; do not invent your own rubric. You cannot read my disk, so I am pasting the body in here rather than pointing you at a local file.

--- Dual Guard PROMPT body (begin) ---
[Paste the Dual Guard PROMPT.md "Copy-paste prompt" body here — open it locally and copy it in yourself; the second AI cannot read your disk.]
--- Dual Guard PROMPT body (end) ---

Then review this material under the Dual Guard prompt body pasted above:
- Drafting model family (my primary): [name the family that produced the work]
- Artifact under review (redacted, with line/section refs): [paste]
- Acceptance card / definition of done: [paste]
- Context boundary (goal, in-scope, non-goals): [paste]
- Evidence provided: [paste command output / test result / reproduced result, or write "none provided"]

Return exactly the dual-guard output shape (verdict, guard level, binding findings, required fixes, residual risk, next action). Work only from what I pasted; if key evidence is missing, say so rather than assume it passes. Keep examples public-safe.
```

## Track B — the auto bridge (optional, point-to-point, depends on your tool)

Some tools can dispatch the review to a second family for you, so you do not hand-carry the paste. The shape is the same cross-family pass; the tool just automates the hand-off.

Concrete example (an example, not a requirement): a coding tool that supports a "rescue" or cross-model plugin can route a review to a different family — for instance a Claude-family coding tool with a plugin that sends the review to a GPT-family model. That auto-dispatched second model is your cross-family bridge.

Two rules make an auto bridge safe to trust:

- Read-only is mandatory. The auto-dispatched second AI must review only — it must NOT be allowed to edit your files. If the bridge lets the second AI change the work, it is no longer an independent reviewer of that work, and the cross-family independence the whole gate depends on is gone. Configure the dispatch as read-only and confirm it actually ran read-only before you trust the verdict.
- It is convenience, not a requirement. The auto bridge depends on a specific tool and integration, and those change over time. The manual bridge in Track A always works. Treat the auto bridge as a way to save effort, never as the only way to reach a second family.

Everything else — which verdicts are allowed, the L3/L4 boundary, binding vs reference — is unchanged and still lives in `../mechanisms/dual-guard/README.md`. The auto bridge changes how the material gets there, not what counts as a pass.

## Expected output

- A cross-family review of your artifact, returned in the dual-guard output shape (verdict, guard level, findings, fixes, residual risk, next action).
- A recorded note of which family was the binding guard, so a later session can trust the result without re-litigating it.
- Honest leveling: an L3 result from the second family's review of your evidence pack, or L4 only if the binding guard re-ran the key evidence and showed that output. A bare claim that "a second family looked at it" is not a pass — the evidence is.

## Failure handling

- Your two tools turn out to share a model family. Then this is a same-family reference pass, not a cross-family gate; under the dual-guard rules it cannot clear the binding gate or move you above L2. Find a genuinely different family for the binding pass.
- The second family just says "looks good" with no specifics. It is grading tone, not claims. Make sure you pasted the dual-guard prompt body (not only the carrier wrapper) so its "each finding cites a line/section/missing evidence" rule is in force; an empty finding list is only valid if it can say what it checked.
- You only claimed a second family but kept no evidence. Family can be faked — anyone can say "a different AI reviewed this". What is hard to fake is a rerun and a reconciliation: record the binding family, the findings, and, for L4, your own rerun output. If you cannot show the review happened, treat the result as single-tool (L2), not cross-family.
- The auto bridge ran with write access. Discard the verdict and re-run it read-only. A reviewer that could edit the work is not independent of it.

## Privacy note

A second family means a second place your material gets pasted, so the privacy bar is the same as `connect-a-tool.md`, applied twice. Redact before pasting into either tool: replace real product names, customer or person names, file paths, and internal numbers with placeholders. Do not paste a private profile, raw private chat logs, internal numbers, or non-public paths into any external AI. For an auto bridge, confirm the dispatched second AI is read-only and does not exfiltrate or store your content beyond the review. The cross-family review works on a redacted artifact plus its evidence; it never needs the private original.

## Next step

- Read the judgment rules this recipe feeds into: `../mechanisms/dual-guard/README.md` (L3 vs L4, binding vs reference, pass and reject bars).
- Coming from one tool? See the L2 front door you are upgrading from: `../mechanisms/single-tool-guard/README.md`.
- Wire the second family in as a standing tool so the bridge is one trigger away: `connect-a-tool.md`.
