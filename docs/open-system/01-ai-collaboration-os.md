# 01 AI Collaboration OS

AI Collaboration Open System is a local-first collaboration operating system for people who use AI tools but do not want the tool to become the center of judgment.

## Core idea

The system does not try to automate all agents. It keeps the human in the controller seat and gives every AI tool the same visible state:

- Who is this work for?
- What is the task boundary?
- What does done mean?
- What evidence exists?
- What must be reviewed before trust?
- What should the next session know?
- What reusable learning should be saved?

## What runs locally

The CLI writes plain files into `.aict/`. It does not call model APIs, upload content, or run telemetry. Your AI tool can read the files you choose to paste or attach.

## Operating loop

1. Profile sets collaboration defaults.
2. Context packages the task.
3. Acceptance defines pass and reject states.
4. Execution creates the artifact.
5. Guards challenge evidence, scope, and privacy.
6. Handoff transfers state.
7. Harvest saves reusable knowledge.

## Public edition boundary

The public edition includes generic mechanisms, templates, prompts, roles, modes, and synthetic labs. It excludes private personal profiles, non-public automation hooks, account material, raw chats, and any real client or identity trail.
