# 05 Failure Patterns

AI Collaboration Open System exists because local-first AI work fails in repeatable ways when everything stays inside a single chat.

## Smooth wrong answer

The assistant gives a confident answer before acceptance exists. Fix: write acceptance first and run guard review after the artifact.

## Scope drift

A coding task becomes design, research, and release work in one response. Fix: use task splitting and do-not-handle-yet.

## Half product

README, architecture, or launch copy claims more than the runnable files prove. Fix: run half-product review and package smoke checks.

## Lost handoff

A later session restarts because the previous chat never separated done, pending, blocked, and unverified. Fix: write handoff before stopping.

## No harvest

The same lesson is rediscovered every week. Fix: extract one reusable harvest seed after each meaningful loop.

## Privacy erosion

Useful examples slowly accumulate private details. Fix: rewrite cases as synthetic labs and run the privacy scan before packaging.

## Human judgment replaced

The AI starts deciding values, risk tolerance, or product direction. Fix: keep controller and guardian roles separate and mark decisions that need the user.
