---
name: evidence-pack
description: Assemble a structured evidence pack so a completion claim can be checked, not trusted.
---

# evidence-pack skill

## When to use

Use the moment you are about to say done, tested, fixed, or shipped, before a reviewer or the next session inherits the claim.

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

1. List every changed file and what changed in each, so the diff surface is explicit.
2. Record the exact command you ran, its captured output, and its exit code; mark anything you did not actually run.
3. Name the unverified items: edges you skipped, paths you did not exercise, and assumptions still standing.
4. Append each piece with `ai-collab evidence add` (kind diff / output / file / rerun) so the proof lives in the ledger, then point the receipt at those rows.

## Output

- Changed files with per-file intent
- Command, captured output, and exit code
- Reproduction steps a reviewer can rerun
- Unverified items and standing assumptions
- Ledger evidence ids the receipt cites

## Safety

- Do not write a summary in place of the real command output and exit code.
- Do not label a claim verified when the run did not happen; record it as unverified instead.
- Do not paste private paths, tokens, or raw transcripts into an evidence row.

## Example

Before claiming a parser fix is done, attach the changed file, the test command with its exit 0 output, and an unverified note that the empty-input branch was never exercised; add each as an evidence row and cite their ids on the receipt.
