# AI Collaboration Open System - Product Contract

Status: source-of-truth draft
Scope: public open-source project contract
Language: bilingual-first, English and Chinese supported

## 1. Product Truth

This project is a local-first, open-source personal AI collaboration workspace.

It is not a diagnosis tool, not a prompt pack, not a small CLI utility, and not a
generic autonomous agent framework.

The user should be able to download the project, initialize a local workspace,
open the generated `START_HERE.md`, and immediately use the system with the AI
tools they already use: Claude Code, Codex, Cursor, Windsurf, Copilot, Cline, or
any assistant that can read project rules and local files.

The core promise:

> Give users a complete self-buildable AI collaboration workspace, not a teaser.
> Paid help is for calibration, setup, and saving time, not for unlocking the
> basic system.

## 2. One-Line Positioning

An open-source personal AI collaboration workspace that helps users run tasks
with profile, context, acceptance, guard review, handoff, and harvest structure
from the first session.

Chinese positioning:

> 一个本地优先、最大诚意开源的个人 AI 协作工作区。用户下载后就能拿到完整骨架，直接放进
> Claude Code / Codex / Cursor 等工具里使用；付费只买校准、代搭和少踩坑。

## 3. First Experience

The main first experience is not "run a doctor".

The main first experience is:

```text
install or clone
-> initialize workspace
-> open START_HERE.md
-> choose a 10 / 30 / 60 minute path
-> run one complete synthetic task loop
-> adapt the same workspace to a real task
```

The user should feel:

```text
I now have a working AI collaboration workspace.
I can use it directly.
I can inspect and modify it.
I can pay the author only if I want it calibrated for my real workflow.
```

The user should not feel:

```text
I downloaded a checker.
It says I have problems.
The real fix is hidden behind paid help.
```

## 4. Required Open-Source Deliverables

The open-source edition must include the full self-build path.

### 4.1 Workspace

The project must generate or provide a complete local workspace:

```text
.aict/
  START_HERE.md
  profile/
  context/
  acceptance/
  guard/
  handoff/
  harvest/
  prompts/
  skills/
  adapters/
  examples/
  privacy/
```

The exact folder name may change later, but the concept must not: users get a
real collaboration workspace, not loose templates.

### 4.2 Six Collaboration Layers

Each layer must include:

- purpose
- when to use it
- input shape
- output shape
- copy-paste prompt
- blank template
- filled synthetic example
- common failure modes
- how to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

The six required layers:

1. Profile - how the AI adapts to the user
2. Context - what the task boundary is
3. Acceptance - what "done" means
4. Guard / Review - how output is challenged before trust
5. Handoff - how the next session resumes
6. Harvest - what becomes reusable knowledge or material

### 4.3 Prompt Library

The open-source edition must include generic prompts for:

- profile creation
- profile refinement
- project context packaging
- acceptance definition
- guard review
- red-team challenge
- handoff generation
- harvest extraction
- mode switching
- workflow reset
- rule update proposal

These prompts must be usable as-is. They can be generic, but not empty
placeholders.

### 4.4 Skills

The system should package reusable capabilities in a skill-like format inspired
by agent skill conventions:

```text
skills/
  profile/
    SKILL.md
  context/
    SKILL.md
  acceptance/
    SKILL.md
  guard/
    SKILL.md
  handoff/
    SKILL.md
  harvest/
    SKILL.md
  red-team/
    SKILL.md
  mode-switch/
    SKILL.md
```

Each skill must be self-contained enough for a user to copy into an AI tool that
supports file-based instructions.

### 4.5 Tool Adapters

The open-source edition must support the major AI coding/workflow tools through
thin adapters:

- Claude Code
- Codex
- Cursor
- Windsurf
- GitHub Copilot
- Cline

The adapters must point back to one shared core contract. Do not duplicate and
drift six separate rule systems.

### 4.6 Synthetic Case Library

The open-source edition must include at least five fully synthetic cases:

1. AI coding long task
2. Content production and harvest
3. Research / knowledge synthesis
4. Multi-tool collaboration
5. Personal judgment / growth assistant

Each case must show the full loop:

```text
messy starting point
-> workspace setup
-> profile/context
-> acceptance
-> execution prompt
-> guard review
-> handoff
-> harvest
-> what changes compared with a single raw AI chat
```

Cases must not use real private content. If inspired by real work, rewrite them
as fully synthetic examples.

## 5. Role of Doctor / Health Check

Any "doctor" or diagnostic command is optional and secondary.

Allowed roles:

- workspace health check
- migration check
- structure completeness check
- example validation
- "I am lost, where do I start?" helper

Forbidden roles:

- main product identity
- first required user step
- paid-conversion pressure mechanism
- claim of AI diagnosis
- claim of understanding the user's real business

The product must never communicate:

```text
You have a problem; pay me to solve it.
```

It should communicate:

```text
Here is the open system. Use it yourself, inspect it, modify it. If you want it
calibrated to your real work, paid help is available.
```

## 6. Privacy and Public Boundary

### 6.1 Must Never Be Public

Do not publish:

- private governance source material
- private knowledge-base source material
- real personal profile
- actual client material
- raw source conversations
- non-public automation details
- non-public routing details
- internal calibration numbers
- internal scoring rules
- account-specific habits
- local machine paths
- tokens, keys, cookies, credentials
- unredacted screenshots
- full internal service SOP

### 6.2 Can Be Public

Can publish:

- generic architecture
- generic prompts
- generic skills
- generic templates
- thin tool adapters
- synthetic examples
- public-safe case rewrites
- privacy docs
- setup docs
- self-build guide
- known limitations
- health-check rules and limitations

### 6.3 Redaction Standard

Every public example must pass this question:

```text
Could a stranger infer the owner's private system, identity, clients, files,
habits, or operational routes from this?
```

If yes, rewrite it as a synthetic example.

## 7. Commercial Boundary

The open-source edition gives the complete generic self-build path.

Paid work may include:

- real workflow review
- personalized profile calibration
- project-specific setup
- migration from existing AI workflows
- custom guard / review rules
- pain-point packs
- industry/scenario packs
- human review
- async audit
- long-term workflow improvement

Paid work must not be framed as unlocking the basic answer.

Correct framing:

```text
The method is public. Paid help gives you a calibrated version for your real
workflow and saves you the time of trial and error.
```

Incorrect framing:

```text
The open-source version only tells you the problem. Pay to get the fix.
```

## 8. Non-Goals

This project does not aim to be:

- an autonomous agent framework
- a multi-agent orchestrator
- a LangGraph / CrewAI competitor
- a memory database
- a cloud SaaS
- a telemetry product
- a hosted AI assistant
- an LLM API wrapper
- a paid prompt pack
- a diagnosis-first funnel
- a clone of the owner's private system

The project must not:

- call external AI APIs by default
- upload user content
- scan the whole disk
- install global hooks without consent
- overwrite user files silently
- claim guaranteed productivity gains
- claim it can replace human judgment
- claim it can automatically understand the user

## 9. Success Criteria

The project is successful when a new user can:

1. Understand from the first screen that this is an open AI collaboration
   workspace.
2. Initialize or copy the workspace without reading a long theory document.
3. Open `START_HERE.md` and choose a clear path.
4. Run one complete synthetic example.
5. Adapt one layer to their own work.
6. Use the workspace with at least one supported AI tool.
7. Produce a reusable artifact: context package, acceptance card, review result,
   handoff note, or harvest seed.
8. Understand what is free and what paid help is for.
9. Trust that no private content is uploaded or hidden from them.
10. Inspect the system because the core method is open.

## 10. Required User Paths

### 10.1 Ten-Minute Path

Goal: feel the system immediately.

Expected result:

- user opens `START_HERE.md`
- runs or reads one synthetic example
- copies one prompt into their AI tool
- gets one artifact

### 10.2 Thirty-Minute Path

Goal: adapt one layer to a real task.

Expected result:

- user fills a context or acceptance template
- uses one adapter with their AI tool
- produces one review or handoff

### 10.3 Sixty-Minute Path

Goal: run one complete task loop.

Expected result:

- profile/context
- acceptance
- execution prompt
- guard review
- handoff
- harvest

## 11. Implementation Principles

- Keep the first experience concrete.
- Make the system inspectable.
- Prefer files users can copy over hidden logic.
- Prefer synthetic cases over abstract theory.
- Keep CLI small: initialize, guide, check, demo.
- Keep doctor secondary.
- Keep paid messaging light and honest.
- Keep all examples privacy-safe.
- Make every promise testable.

## 12. Acceptance Checklist

Before this project can be treated as a public-ready open-source release:

- `START_HERE.md` exists and is the first user path.
- The generated workspace has all six layers.
- Each layer has prompt, template, example, and failure modes.
- At least five synthetic cases exist.
- At least one case runs end-to-end through the full loop.
- Supported tool adapters point to one shared core contract.
- Doctor/health-check is not the main README headline.
- Privacy docs list public and forbidden materials.
- Commercial boundary is present but not pushy.
- No private paths, real client names, raw source conversations, private governance
  material, or private knowledge-base source material appear in the public package.
- All tests and release checks pass once implementation begins.

## 13. Final Definition of Done

Done means:

```text
A stranger can download the project, initialize or copy the workspace, open
START_HERE.md, and use the public prompts/templates/examples to run one AI
collaboration loop without seeing the owner's private system and without being
forced through a diagnosis-first funnel.
```

Still not done if:

```text
The project is still perceived as a doctor CLI, a thin prompt pack, a README-heavy
idea, or a teaser for paid help.
```
