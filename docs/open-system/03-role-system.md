# 03 Role System

DoneTrace uses roles to separate responsibility. Roles are public-safe collaboration boundaries, not secret authority.

Each role is defined as a responsibility matrix rather than a two-line "does / does not". A matrix states six things — what the role **can do**, what it **cannot do**, what it takes **in**, what it produces **out**, who it **escalates to** when something exceeds its authority, and a concrete **overreach example** of what breaks when the boundary is crossed. The full role cards live in `.aict/roles/`; the summaries below mirror them.

## Owner / controller

Top of the responsibility chain. **Can:** set the goal and acceptance, issue instructions, choose between options, accept or reject work, and own the final decision. **Cannot:** approve its own judgment as if it were independent review, make the guardian's call, or step in to do the heavy production work that should have been delegated. **In:** the task plus proposed plans, options, returned artifacts, and verdicts. **Out:** instructions, acceptance decisions, and the final recorded decision. **Escalates to:** no one above it — it tasks a scout for facts or a guardian for a check, but never hands the decision upward. **Overreach:** if the controller writes the implementation itself, no independent party is left to review it, so it grades its own homework and a defect ships.

## Executor

**Can:** implement the task from the provided files, change the agreed artifacts, save state, and self-verify. **Cannot:** make the controller's decisions, silently expand scope, or cross a core boundary without stopping to ask. **In:** a task packet (goal, boundary, files, constraints, acceptance). **Out:** the artifact plus a three-part report — what changed, the verification evidence, and what is still unverified. **Escalates to:** the controller, whenever the task is ambiguous, scope must grow, or a core boundary is in the way. **Overreach:** if it edits a shared rule while fixing a small bug, a scoped fix quietly becomes an unreviewed rule change.

## System guardian

A referee, not a player. **Can:** independently review for acceptance fit, privacy, evidence quality, and handoff readiness; surface blind spots; and issue a verdict with every finding pointed at concrete evidence. **Cannot:** give orders, execute, or rewrite the artifact it judges; a concern is not approval. **In:** the object under review plus its acceptance card, context, and evidence. **Out:** a verdict and findings, with required fixes and named residual risk handed back — not applied. **Escalates to:** the controller, which decides what to fix, what to accept, and whether to close. **Overreach:** if it edits the artifact to fix a flaw it found, it becomes both referee and player and its verdict can no longer be trusted.

## Scout

Gathers facts; does not judge them. **Can:** collect external facts, candidate paths, and comparisons; list evidence gaps; and label how time-sensitive each finding is. **Cannot:** interpret or rule on the evidence, recommend a path, or turn exploration into implementation. **In:** the specific question or unknown to investigate. **Out:** a fact card with sources and freshness labels and no verdict attached. **Escalates to:** the controller, which does the synthesis and the decision. **Overreach:** if it returns "you should choose A," it mixes evidence with judgment and contaminates the later independent decision.

## Supervisor

A state translator, not a driver. **Can:** turn the AI's current state into plain language (where the main line is, what just happened, what is next), watch the main line for drift, watch whether "done-pending-verification" is being passed off as "accepted," watch whether a decision is being punted back to the human, and issue one of three plain verdicts (send / send-with-a-correction / stop-and-fix-first). **Cannot:** steer direction or make the call, do the guardian's job (no formal verdict on facts, no code-level defect hunting, no ruling on evidence), or open a side issue into a new main line. **In:** the AI's current state to translate (a status update, handoff packet, plan, or progress report) plus the main line it is supposed to serve. **Out:** a short plain-language status read plus the three-question check, ending in send / send-with-a-correction / stop-and-fix-first. **Escalates to:** the owner / controller for the decision, and the guardian for any true facts-and-evidence judgment. **Overreach:** if it stops translating and starts grading the code, it becomes a second guardian — "main line on track" gets mixed with "code verified," the real fact-check never gets an independent pass, and the cheap plain-language safety net turns into one more heavyweight reviewer.

## Harvester

Proposes; does not file to the source of truth on its own. **Can:** sweep a finished loop, lift reusable bits into harvest cards, and redact private material into a public-safe form. **Cannot:** write directly into the knowledge base, accept its own cards as final, or generalize one incident into a permanent rule without evidence and sign-off. **In:** the conversation or material to harvest. **Out:** public-safe harvest cards presented as candidates awaiting confirmation. **Escalates to:** the owner / controller, who confirms each card before it lands. **Overreach:** if it files a card without confirmation, an unverified lesson is frozen into a standing rule by accident.

## How roles work with tools

Codex, Claude Code, Cursor, Cline, Windsurf, and Copilot can all run these roles by reading the same local-first workspace files. The role tells the tool what responsibility it has in this step, and the matrix tells it exactly where that responsibility starts, stops, and gets handed off.
