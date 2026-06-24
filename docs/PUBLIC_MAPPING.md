# Public Mapping — a good-faith open-source ledger

This document is the honest account of how a private collaboration system was turned into this public edition. It is a safety map, not a source dump — but it is written so a stranger can verify that the desensitization preserved a usable method instead of gutting it into marketing.

The short version: **the thinking and the structure are public. Only the private fuel is removed, and where something is removed you are given a synthetic equivalent you can actually run.** This is meant to be real open source, not a teaser.

## How to read this ledger

Below is one row per **class of published asset**. Each row answers seven questions:

1. **Source idea** — the core idea the asset encodes (the part worth keeping).
2. **Public artifact** — which files or directories carry it in this repo.
3. **Kept verbatim (Y/N)** — whether the structure, templates, and reasoning are published unchanged.
4. **Rewritten / desensitized (Y/N)** — whether anything was redacted, and exactly what.
5. **Cannot be published** — the private parts that never enter this repo, and why.
6. **Public-safe equivalent** — what you get instead of the removed parts, so the method still works.
7. **File evidence** — concrete paths you can open and check against these claims.

If a row says **kept verbatim: Y**, open the file evidence and you should find the real structure, not a paraphrase. If a row says **desensitized: Y**, the public-safe-equivalent column tells you what generic version replaced the private fuel — never just "rewritten," always "rewritten into *this*, and here is why it is still useful."

## Our desensitization principles

These are the rules the rewrite followed. The full boundary is in `../PRODUCT_CONTRACT.md` §6.

- **Keep the method, drop the fuel.** The reusable part of a mechanism is its idea, structure, prompt, template, and pass/reject bar. Those are kept verbatim. The fuel — a real person's profile, real client work, raw conversations, calibration numbers — is what makes it private, so the fuel is removed and the method stays.
- **Every removal earns an equivalent.** When private numbers or transcripts are pulled, they are replaced with a synthetic equivalent that does the same job: a definitional binding strength instead of a measured percentage, a worked synthetic run instead of a real one, an example threshold you re-tune to your own tools instead of someone else's tuned value. Desensitization is a swap, not a deletion.
- **The redaction question.** Every public example had to pass one test (`PRODUCT_CONTRACT.md` §6.3): *could a stranger infer the owner's private system, identity, clients, files, habits, or routes from this?* If yes, it was rewritten as a synthetic example before it was allowed in.
- **A machine gate, not a promise.** The boundary is not enforced by good intentions. `scripts/privacy-scan.js` hard-blocks local paths, the private governance path, the private knowledge system, private hook references, tokens, keys, and emails — and it scans this ledger too. The principle "key rules are machine-enforced, not left to self-discipline" is itself a published idea (last row), even though the private enforcement internals are not.

---

## The ledger

### Asset class 1 — The six-layer file workspace (profile / context / acceptance / guard / handoff / harvest)

| Column | Account |
| --- | --- |
| **Source idea** | Local-first and file-based: instead of holding collaboration state in chat memory, externalize it into reviewable files a human can open, diff, and audit. State you can see is state you can govern. |
| **Public artifact** | The six layer directories, each with the same five-file shape (`README.md`, `PROMPT.md`, `TEMPLATE.md`, `EXAMPLE.synthetic.md`, `FAILURE_MODES.md`). |
| **Kept verbatim (Y/N)** | **Y** — the layer structure, the blank templates, and the prompts are published unchanged. The skeleton is the asset, and the skeleton is real. |
| **Rewritten / desensitized (Y/N)** | **Y** — every `EXAMPLE.synthetic.md` is fully synthetic. No real profile, no real task context, no real acceptance trail. |
| **Cannot be published** | The owner's real personal profile, real client requirements, raw private chats, account-specific habits, and machine-local paths. These are exactly the fuel that would let a stranger reconstruct a private system. |
| **Public-safe equivalent** | Blank templates you fill with **your own** profile and tasks, plus synthetic filled examples that show the shape without copying anyone's life. The workflow value survives the absence of the private source. |
| **File evidence** | `.aict/profile/`, `.aict/context/`, `.aict/acceptance/`, `.aict/guard/`, `.aict/handoff/`, `.aict/harvest/` |

### Asset class 2 — Dual Guard

| Column | Account |
| --- | --- |
| **Source idea** | Cancel a single AI's shared blind spot with **structure, not a stronger model**: a guard from a different model family is the binding gate; a same-family guard is a non-binding reference. A fluent answer is not trusted just because it reads well. |
| **Public artifact** | The full mechanism package, deepened to nine elements (purpose, when / when-not, input shape, process, output shape, pass bar, reject bar, common misuse, package files). |
| **Kept verbatim (Y/N)** | **Y** — the idea, the layered-strictness merge rule ("not a vote; one evidence-grounded blocker rejects"), the process steps, and the pass/reject bars are published as-is. |
| **Rewritten / desensitized (Y/N)** | **Y** — the real **binding-strength numbers were removed**. Private "how often each family misses" percentages and calibration data are replaced with a qualitative statement: cross-family = the gold-standard binding pass; same-family = reference only. |
| **Cannot be published** | Real miss-rate percentages, internal calibration datasets, and any private scoring weights that backed the original tuning. |
| **Public-safe equivalent** | A definitional experience range you can act on (same-family reviewers tend to miss the same things; a different family catches more), plus a fully worked synthetic run — a synthetic task board, "family X" drafts and "family Y" binds — that demonstrates the gate without a single private number. |
| **File evidence** | `.aict/mechanisms/dual-guard/` (`README.md`, `EXAMPLE.synthetic.md`, `FAILURE_MODES.md`) |

### Asset class 3 — Task splitting

| Column | Account |
| --- | --- |
| **Source idea** | Before handing a large job to another AI, split it so each piece is self-contained and small enough not to overflow the tool's working window — prevention by splitting, not recovery after a stall. |
| **Public artifact** | The mechanism package, including the pre-dispatch self-audit. |
| **Kept verbatim (Y/N)** | **Y** — the self-audit checklist and the "split by topic/segment, keep each piece self-contained" rule are published unchanged. |
| **Rewritten / desensitized (Y/N)** | **Y** — the **real tuned numeric thresholds were removed** and relabeled as example thresholds you re-tune to your own tool's context window. |
| **Cannot be published** | The owner's specific tuned trigger values, which are calibrated to private tooling and would leak operational detail. |
| **Public-safe equivalent** | An operational set of self-audit questions with **example** values clearly marked "adjust to your tool," so you get a working procedure instead of someone else's machine-specific constants. |
| **File evidence** | `.aict/mechanisms/task-splitting/` |

### Asset class 4 — Handoff (A / B / C three modes)

| Column | Account |
| --- | --- |
| **Source idea** | Hand a task between sessions or tools by carrying explicit state, not chat memory — with three handoff modes for three situations (A high-interaction / B programmatic / C delivery overview) that all carry the same fixed set of must-include fields so the next session starts cleanly. |
| **Public artifact** | The mechanism package with the three-mode model and required-field list. |
| **Kept verbatim (Y/N)** | **Y** — the A/B/C modes and the required-field structure are published as-is; that structure is the whole point. |
| **Rewritten / desensitized (Y/N)** | **Y** — example session identifiers and paths are synthetic. |
| **Cannot be published** | Real session ids and real machine-local paths from actual handoffs. |
| **Public-safe equivalent** | A synthetic end-to-end handoff example (made-up session, made-up next-step) that shows exactly which fields to fill, without exposing a real session. |
| **File evidence** | `.aict/mechanisms/handoff-abc/` |

### Asset class 5 — Harvest and ERC

| Column | Account |
| --- | --- |
| **Source idea** | Turn a working conversation into durable knowledge through a fixed pipeline — scan → card → desensitize → confirm → file — and gate the cross-session "external recap" role behind a two-lock entry so it cannot start by accident. |
| **Public artifact** | The mechanism package with the harvest pipeline and the ERC two-lock entry. |
| **Kept verbatim (Y/N)** | **Y** — the scan→card→desensitize→confirm→file pipeline and the two-lock entry condition are published unchanged. |
| **Rewritten / desensitized (Y/N)** | **Y** — the worked harvest card is synthetic. |
| **Cannot be published** | Real harvested content (it would be private strategy, business, or growth material from actual sessions). |
| **Public-safe equivalent** | A synthetic harvest-card example that demonstrates the pipeline end to end, so you can run the same flow on your own conversations. |
| **File evidence** | `.aict/mechanisms/harvest-and-erc/` |

### Asset class 6 — The role system

| Column | Account |
| --- | --- |
| **Source idea** | Split collaboration into named roles with an explicit authority matrix — who proposes, who executes, who guards, who gathers facts, who harvests — so no single agent silently does everything. |
| **Public artifact** | Five role cards plus a roles README, written as a responsibility matrix. |
| **Kept verbatim (Y/N)** | **Y** — the responsibility-matrix structure and the role boundaries are published unchanged. |
| **Rewritten / desensitized (Y/N)** | **Y** — specific private product names were **replaced with generic terms**: a "main-brain AI," an "execution AI," and "different model families," instead of named tools and private internal routing. |
| **Cannot be published** | The owner's private authority structure tied to specific tools, and tool-specific internal routing. |
| **Public-safe equivalent** | Generic, vendor-neutral role cards (owner-controller / executor / guardian / scout / harvester) that map onto any tool stack, so the boundaries transfer without naming a private setup. |
| **File evidence** | `.aict/roles/` (`owner-controller.md`, `executor.md`, `system-guardian.md`, `scout.md`, `harvester.md`, `README.md`) |

### Asset class 7 — The mode system

| Column | Account |
| --- | --- |
| **Source idea** | Run collaboration in explicit modes (execute / review / handoff / harvest) with defined entry, exit, and cross-mode handoff, so the system always knows which posture it is in. |
| **Public artifact** | Four mode cards plus a modes README. |
| **Kept verbatim (Y/N)** | **Y** — the entry / exit / handoff structure of each mode is published unchanged. |
| **Rewritten / desensitized (Y/N)** | **N (structure)** — the mode mechanics are generic and need no redaction; any illustrative content is synthetic. |
| **Cannot be published** | Nothing mode-structural is private. (Private *content* that might pass through a mode is handled by the other asset classes' redaction.) |
| **Public-safe equivalent** | The mode cards themselves are already the public-safe form — generic postures usable on any stack. |
| **File evidence** | `.aict/modes/` (`execute.md`, `review.md`, `handoff.md`, `harvest.md`, `README.md`) |

### Asset class 8 — The mistake log / failure modes

| Column | Account |
| --- | --- |
| **Source idea** | Distill real incidents into anti-recurrence rules — every accident becomes a named failure mode so it does not happen twice. |
| **Public artifact** | A `FAILURE_MODES.md` alongside each layer and each mechanism. |
| **Kept verbatim (Y/N)** | **Y** — the method (incident → named failure mode → guard against it) is published unchanged. |
| **Rewritten / desensitized (Y/N)** | **Y** — the **real incident write-ups are not published**; the failure modes are reconstructed as synthetic, generic failures. |
| **Cannot be published** | Actual private feedback entries, which would describe real sessions, real mistakes, and real context. |
| **Public-safe equivalent** | The distillation method plus synthetic failure modes that name the same traps (e.g. treating a guard pass as a vote, skipping the gate on "looks fine" work) without exposing where they were learned. |
| **File evidence** | `.aict/mechanisms/dual-guard/FAILURE_MODES.md` and the other `FAILURE_MODES.md` files under `.aict/mechanisms/` and the six layers |

### Asset class 9 — The flagship case study (and the other synthetic labs)

| Column | Account |
| --- | --- |
| **Source idea** | Show the whole system on one realistic long task — an AI-coding job carried from request to a guarded "done" — so the mechanisms are seen working together, not just described. |
| **Public artifact** | The flagship case plus four more synthetic labs, each with a `CASE.md` and supporting artifacts. |
| **Kept verbatim (Y/N)** | **Y (shape)** — the case structure (request → execution → review → verdict → residual risk) is real and complete. |
| **Rewritten / desensitized (Y/N)** | **Y** — every case is **fully synthetic**: a fictional task board, not a real project. |
| **Cannot be published** | Real source code, real projects, real customers, or real source conversations. |
| **Public-safe equivalent** | A synthetic-but-realistic reviewed artifact — invented code and an invented task whose review still exercises real acceptance criteria — so the demonstration is honest about being synthetic while still teaching the loop. |
| **File evidence** | `.aict/examples/ai-coding-long-task/` (`CASE.md`, `artifacts/`) and the four sibling labs under `.aict/examples/` |

### Asset class 10 — Machine gates and format locks (the idea, not the implementation)

| Column | Account |
| --- | --- |
| **Source idea** | Key rules must be **machine-enforced, not left to self-discipline** — a soft instruction a model can rationalize away is weaker than a gate that hard-blocks. This *philosophy* is publishable even though the private enforcement is not. |
| **Public artifact** | One concrete, public-safe gate (`scripts/privacy-scan.js`) plus the privacy docs that state the principle. |
| **Kept verbatim (Y/N)** | **Y (principle)** — the idea "machine-enforce the rules that matter" is stated plainly. |
| **Rewritten / desensitized (Y/N)** | **Y** — the **specific private hook implementations, routing, and thresholds are not published**; only a lightweight public gate is. |
| **Cannot be published** | The private hook code and paths, the internal routing logic, and the tuned thresholds — the operational guts that would leak how the private system is wired. |
| **Public-safe equivalent** | A real, runnable lightweight gate (`privacy-scan.js`) you can read and use, proving the principle is genuine and not vaporware, without shipping the private enforcement internals. |
| **File evidence** | `scripts/privacy-scan.js`, `../PRODUCT_CONTRACT.md` §6, `.aict/privacy/` |

---

## Summary in the contract's own terms

These are the boundary terms from `PRODUCT_CONTRACT.md` §6, restated so this ledger is searchable against the contract.

### Public asset

The public asset across every row is the **reusable mechanism shape**: ideas, structures, prompts, templates, acceptance cards, guard reviews, handoffs, harvest seeds, roles, modes, and synthetic labs. That shape is published, in most rows verbatim.

### Rewritten

Private fuel is **rewritten** into public-safe equivalents — never simply dropped. A rule is published only when it can be explained without exposing private source material, and when it can, the explanation is kept whole.

### Cannot be published

The following never enter this repo: real personal profiles, raw conversations, actual customer or project details, **non-public automation** hooks, non-public routing, hidden thresholds, internal calibration numbers, internal weights, account clues, tokens, and local machine paths.

### Public-safe equivalent

For every removal there is a **public-safe equivalent**: synthetic labs, generic mechanism packages, blank templates you fill yourself, definitional binding strengths in place of measured numbers, and explicit privacy boundaries. The value stays usable even when the private source is absent — that is the whole point of a ledger instead of a deletion list.

### Synthetic cases

All public examples are **synthetic cases**. They preserve workflow value without copying private source material, and they say so on their face. If a stranger reads this ledger and then opens the file evidence, the two should agree — that agreement is the proof that this is real open source.
