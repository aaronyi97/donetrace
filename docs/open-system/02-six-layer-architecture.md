# 02 Six-Layer Architecture

The AI Collaboration Open System uses a local-first six-layer architecture. Each layer answers one question and produces one inspectable artifact.

## 1. Profile

Question: how should AI collaborate with this person or team?

Output: stable working preferences, decision style, boundaries, and review preferences.

## 2. Context

Question: what is the current task, and what should not be assumed?

Output: goal, state, artifacts, facts, assumptions, risks, non-goals, and open questions.

## 3. Acceptance

Question: what does done mean before work starts?

Output: deliverables, pass criteria, required checks, rejected states, and evidence needed.

## 4. Guard

Question: what must be challenged before trust?

Output: findings, evidence, required fixes, residual risk, and recommendation.

This is the single review layer (`.aict/guard/`). When work needs two independent review passes, use the dual-guard mechanism in `.aict/mechanisms/dual-guard/`.

## 5. Handoff

Question: how can the next session continue without replaying the whole chat?

Output: done, pending, blocked, unverified, decisions, verification evidence, and next action.

## 6. Harvest

Question: what reusable learning should survive this task?

Output: reusable knowledge, prompt fragments, decision records, rule candidates, and what not to generalize.

## Why files matter

Single-agent chats hide state in the conversation. A local-first workspace keeps state in files that can be reviewed, copied, corrected, and handed to any AI tool.
