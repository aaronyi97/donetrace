import {
  adapterDefinitions,
  caseDefinitions,
  layerDefinitions,
  promptDefinitions,
  skillDefinitions
} from "./catalog.js";

const tools = "Claude Code / Codex / Cursor / Windsurf / Copilot / Cline";

function list(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function numbered(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

// Optional mechanism sections. These render only when the deepened mechanism
// packs (dual-guard, task-splitting) supply the field, so the other mechanism
// packs stay byte-for-byte identical to their committed output.
function section(heading, body) {
  if (!body) return "";
  return `\n\n## ${heading}\n\n${body}`;
}

function listSection(heading, items) {
  if (!items || items.length === 0) return "";
  return section(heading, list(items));
}

function numberedSection(heading, items) {
  if (!items || items.length === 0) return "";
  return section(heading, numbered(items));
}

export function renderStartHere() {
  return `# START_HERE - Open AI Collaboration Workspace

This workspace helps you turn messy AI work into visible state: profile, context, acceptance, guard review, handoff, and harvest.

AI productivity is a product, not a sum — this workspace gives you the factors beyond the model itself (profile, context, acceptance, guard, handoff, harvest). Why: see docs/WHY_THIS_EXISTS.md.

中文：先别背概念。先看同一段混乱输入如何被拆成可执行、可审查、可交接的文件，再复制到自己的任务。

## Start with one AI (you only need one tool to begin)

You do not need two AI tools to start. With a single AI, this workspace turns "the AI said it's done" into a result that has evidence, can be re-checked, handed off, and harvested — and that alone is most of the value. The completion-claim check routes through \`mechanisms/single-tool-guard\`: a fresh conversation plus an adversarial reviewer prompt, instead of trusting the same assistant that just wrote the work. This is the front door, not a downgrade.

中文：一个AI也能开始：先把"做完了"变成有证据、可复核、可交接、可沉淀的结果。

When a second, different model family is available, you can upgrade to the cross-family double guard (\`mechanisms/dual-guard\`) — an independent review from a different AI family that a single tool cannot give itself (it can only *claim* one — the CLI marks that self-declared and unverified). That is the ceiling, not the entry bar. Don't have a second family yet? \`cookbook/bridge-to-a-second-family.md\` shows how to stand one up (manual or auto) and route a review across it.

中文：有第二个模型族时，可以升级成跨族双守卫。

We do not disguise a single-tool self-review as a cross-family pass: the guard level is computed from evidence, not self-asserted. A single tool tops out at L2 (pass-with-risk), and a plain pass requires L3+ with a different model family.

中文：我们不会把单工具自审伪装成跨族通过。

## Messy input -> structured loop

Messy input:

\`\`\`text
I need this task board cleaned up. Add drag-and-drop, maybe keyboard support,
make it prettier, keep tests passing, and don't rewrite too much.
\`\`\`

Raw AI usually answers with a broad promise.

This workspace produces visible state instead:

\`\`\`text
Context: current slice is reorder behavior; visual redesign is out of scope.
Acceptance: existing data survives; drag and keyboard reorder both need tests.
Guard: reject completion until keyboard movement has evidence.
Handoff: mouse and keyboard reorder done and tested, guard accepted; only visual polish unverified.
Harvest: long coding tasks need acceptance before implementation and guard before handoff.
\`\`\`

## 10-minute path

Goal: feel the system immediately. Two ways in; pick one.

### Path 1 (recommended): run the loop on your own real task

1. Open \`walkthroughs/10-minute-your-task.md\` and follow its five steps.
2. You describe one real (lightly redacted) task; the AI returns a boundary card and an acceptance card, so "done" is defined before any work.
3. You let the AI do only the accepted slice and report what it changed, ran, and did not verify.
4. You open a fresh chat (ideally a different AI brand) and have it re-check the result against evidence.
5. You watch the independent re-check reject a claim the evidence does not back, on your own task.

### Path 2: watch the prepared demo first

Pick this if your task feels too sensitive to paste right now, or you want to see the flow before running it on your own work.

1. Open \`walkthroughs/10-minute.md\` (the demo preview) and follow its five steps.
2. It drives the prepared case \`examples/ai-coding-long-task/CASE.md\` and its artifacts.
3. You copy the context package, acceptance card, and execution prompt into your AI tool.
4. You run guard review before accepting the answer.
5. You watch the guard catch a false "done" the prepared case plants, then read the revised output, handoff, and harvest seed — then run Path 1 on your own task.

Expected result: you walk one complete loop (context -> acceptance -> first output -> guard -> revised -> handoff -> harvest) and get one reusable artifact.

## 30-minute path

Goal: adapt one layer to a real task.

1. Open \`context/TEMPLATE.md\` or \`acceptance/TEMPLATE.md\`.
2. Fill it for one current task using redacted, local-only material.
3. Open \`adapters/\` and choose the adapter for your AI tool.
4. Paste the shared contract pointer and your filled template into the tool.
5. Produce one review result or handoff note.

Expected result: one real task has a written boundary or done standard.

## 60-minute path

Goal: run one complete task loop.

1. Fill \`profile/TEMPLATE.md\` lightly.
2. Fill \`context/TEMPLATE.md\`.
3. Fill \`acceptance/TEMPLATE.md\`.
4. Use \`prompts/guard-review.md\` after the first artifact.
5. Save \`handoff/TEMPLATE.md\` before stopping.
6. Extract one reusable lesson with \`harvest/TEMPLATE.md\`.

Expected result: profile/context, acceptance, execution prompt, guard review, handoff, and harvest all exist for one task.

## What this is

- A complete local workspace you can inspect and modify.
- A set of prompts, templates, skills, adapters, and synthetic cases.
- A method for making AI collaboration resumable and reviewable.

## What this is not

- Not a hosted assistant.
- Not an autonomous agent framework.
- Not a cloud memory store.
- Not a paywall for the basic method.

## Want the AI to remind you on its own

Tired of remembering to run the guard yourself? Install the adapter into your AI tool's always-on instructions with \`node bin/ai-collab.js adapters install --target <repo>\` (after publish: \`ai-collab adapters install --target <repo>\`). It turns on restrained coaching reminders, so the AI prompts you at the key moments - define done, review a completion claim, hand off, harvest. If you only have one tool, the completion-claim check routes through \`single-tool-guard\` (a fresh adversarial pass in the same tool) instead of a second AI brand.

## Where to go next

- New task: start with \`context/TEMPLATE.md\`.
- Long task: add \`acceptance/TEMPLATE.md\` before execution.
- Risky output: run \`guard/PROMPT.md\`.
- Switching tools: use \`handoff/TEMPLATE.md\` plus the adapter for the next tool.
- Finished loop: write \`harvest/TEMPLATE.md\`.
- Want proactive nudges: run \`adapters install\` (one tool only -> \`single-tool-guard\`).

## 中文 60 分钟搭建

1. 先写一个轻量 profile：你希望 AI 怎么配合你，哪些动作必须先问。
2. 给一个真实任务写 context：目标、现状、约束、不要做什么、还缺什么证据。
3. 先写 acceptance：怎样才算做完，哪些状态必须打回。
4. 把 adapter guidance 和相关模板交给你的 AI 工具。
5. 第一版产物出来后，跑 guard review。
6. 停下来前写 handoff。
7. 最后写 harvest，把这次任务里可复用的经验留下。
`;
}

export function renderSharedCoreContract() {
  return `# Shared Core Contract

All adapters in this workspace point here. Do not maintain six different rule systems.

## Core loop

1. Profile - how the assistant adapts to the user.
2. Context - what the task boundary is.
3. Acceptance - what done means.
4. Guard / Review - how output is challenged before trust.
5. Handoff - how the next session resumes.
6. Harvest - what becomes reusable knowledge or material.

## Operating rules

- Work local-first. Do not upload user content by default.
- Keep private material out of examples.
- Label facts, assumptions, decisions, and unverified claims.
- Use synthetic cases for public material.
- Paid help may calibrate or save time, but the generic method is open.

## Tool handoff shape

When handing this to ${tools}, include:

1. This shared core contract.
2. The relevant layer template.
3. The task context or synthetic case.
4. The acceptance card if work will be judged.
5. The handoff note if another tool will continue.

## Coaching layer (proactive reminders)

Do not wait to be asked. At these collaboration moments, proactively remind the user of the matching step — briefly, once per moment, then continue:

1. Task start (a new task or vague idea arrives): set a context boundary and acceptance before building.
2. Pre-execution (about to act before "done" is defined): define the acceptance card first.
3. Completion claim (the assistant says "done / finished / shipped"): run a guard review before trusting it. One model family only -> run \`single-tool-guard\` (new conversation + adversarial prompt). A second, different family available -> run \`dual-guard\`. A multi-tool setup -> run the full fusion review.
4. Long thread / tool switch (context is getting long, or work is moving to another tool): generate a handoff instead of relying on chat memory.
5. Reusable insight (a judgment, method, or lesson worth keeping appears): harvest it into a card.
6. Repeated preference (the same preference shows up several times): offer it as a profile-update candidate.

### Restraint (default standard — this is the line that keeps the system installed)

- **light** — prompt only at the two highest-risk nodes: completion-claim and tool-switch.
- **standard (DEFAULT)** — fire at nodes 1, 3, 4, 6; fold node 2 into the task-start reminder (skip it if acceptance was already set) and node 5 into a natural pause rather than a separate interruption. Count "once per moment" by task phase, not by node, so the start of one task is one reminder — do not stack reminders on back-to-back turns at a task's opening. Never every turn, never lecture theory.
- **strict** — prompt at all six nodes, every time they fire.

The user switches with \`coach: light\` / \`coach: standard\` / \`coach: strict\`. Over-prompting is the fastest way to get the whole system uninstalled. Restraint is not a suggestion, it is a hard rule. Default to standard. A reminder that fires every turn is a failure mode, not thoroughness.

### First-run promise (act on this the FIRST time, before anything else)

The first time you work with this user after the workspace is installed — on your very first reply, proactively — introduce yourself and offer to scan. Do not wait to be asked. Speak in the user's own language.

Say, in your own words and their language, roughly this: "You just installed a collaboration discipline (ai-collab). In short, it holds me to a few rules so I'm more trustworthy: before I say 'done' I have to show evidence, not just claim it; when I'm unsure I'll pull in a second AI to double-check; when you switch tools you won't have to re-explain the background; and the useful things we figure out, I'll help you save. Want me to take 30 seconds and look at a few of your recent tasks, and show you concretely what this changes?"

Then STOP and let them choose: "yes" / "just the X project" / "not now".

Honesty about the scan — you MUST say this before scanning, it is the whole point: the scan is done by YOU, the cloud AI they already use, so the content passes through your provider's servers like any normal chat. Say plainly: this is NOT "zero data leaves your machine" — any tool claiming "absolutely no leak" is bluffing. But it is no more exposure than normally talking to you. The ai-collab tool itself sends nothing to third parties. They can narrow the scope or decline. Default scope: only the currently active project, nothing wider unless they ask.

If they say yes:
1. Run \`ai-collab bootstrap --yes\` (before publish: \`node bin/ai-collab.js bootstrap --yes\`) to get the DETERMINISTIC facts: which "done"s lack evidence (VERIFY), what is in flight (RESUME), profile clues, high-risk role signals, harvestable lessons.
2. On top of those facts add YOUR semantic read — but every claim must cite a real fragment they will recognize (their own words, a diff, a behavior). Never an ungrounded "you prefer X"; that is fortune-telling and it kills trust.
3. Present the value one card at a time (a wall of text loses them): a working-habits profile drafted FROM their real work (they only confirm or tweak, not fill a form); which recent "done"s cannot be trusted yet (the aha moment — show one real "done" that had no evidence, stated as a fact, not self-flagellation); which tasks should bring in helper roles (red-team / dual-guard / scout, each tied to their real high-risk task, plain language before the role name); and what is worth harvesting from THIS conversation (close the loop).
4. End with ONE next step, not a menu: offer to run a real task and let them watch it work differently.

If they decline: give a one-line honest intro and "say the word whenever" — degrade gracefully, do not nag. After this first run, restraint applies (coaching layer above): prompt at the key moments, not every turn.

See \`mechanisms/collaboration-coach\` for the full node map and \`mechanisms/single-tool-guard\` for the one-tool front-door guard (a real starting guard, capped at L2 — not a passed cross-family gate).
`;
}

export function renderLayerReadme(layer) {
  return `# ${layer.title}

${layer.summary}

中文：${layer.zh}

## Purpose

${layer.purpose}

## When to use

${layer.when}

## Input shape

${layer.input}

## Output shape

${layer.output}

## Copy-paste prompt

See \`PROMPT.md\`. The prompt is designed to work in ${tools}.

## Blank template

See \`TEMPLATE.md\`.

## Filled synthetic example

See \`EXAMPLE.synthetic.md\`.

## Common failure modes

See \`FAILURE_MODES.md\`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

1. Open the adapter for your tool in \`../adapters/\`.
2. Include \`../adapters/SHARED_CORE_CONTRACT.md\`.
3. Paste this layer's \`PROMPT.md\` plus either \`TEMPLATE.md\` or \`EXAMPLE.synthetic.md\`.
4. Ask the tool to return the layer's output shape exactly.
`;
}

export function renderLayerPrompt(layer) {
  return `# ${layer.title} Prompt

## Purpose

${layer.purpose}

## When to use

${layer.when}

## Input shape

${layer.input}

## Output shape

${layer.output}

## Copy-paste prompt

\`\`\`text
${layer.prompt}

Input:
[paste your redacted task material here]

Output shape:
${layer.output}

Rules:
- Keep private material local and redacted.
- Label facts and assumptions.
- If information is missing, ask at most three concrete questions.
- Make the result usable in Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
\`\`\`

## Blank template

Use \`TEMPLATE.md\`.

## Filled synthetic example

Use \`EXAMPLE.synthetic.md\`.

## Common failure modes

Use \`FAILURE_MODES.md\`.
`;
}

export function renderLayerTemplate(layer) {
  return `# ${layer.title} Template

## Purpose

${layer.purpose}

## When to use

${layer.when}

## Input shape

${layer.input}

## Output shape

${layer.output}

## Copy-paste prompt

Open \`PROMPT.md\` and paste this completed template below it.

## Blank template

${layer.template.map((field) => `### ${field}\n\n`).join("\n")}

## Filled synthetic example

See \`EXAMPLE.synthetic.md\`.

## Common failure modes

See \`FAILURE_MODES.md\`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Use the adapter in \`../adapters/\` and include the shared core contract.
`;
}

export function renderLayerExample(layer) {
  return `# ${layer.title} Filled Synthetic Example

## Purpose

${layer.purpose}

## When to use

${layer.when}

## Input shape

${layer.input}

## Output shape

${layer.output}

## Copy-paste prompt

Use \`PROMPT.md\` with the synthetic input below.

## Blank template

Use \`TEMPLATE.md\` for your own task.

## Filled synthetic example

${layer.example.join("\n\n")}

## Common failure modes

See \`FAILURE_MODES.md\`.

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this example into any tool with \`../adapters/SHARED_CORE_CONTRACT.md\` to see the expected shape.
`;
}

export function renderLayerFailures(layer) {
  return `# ${layer.title} Common Failure Modes

## Purpose

${layer.purpose}

## When to use

Read this before trusting a ${layer.title.toLowerCase()} artifact.

## Input shape

The artifact plus the original context and acceptance card.

## Output shape

A short list of risks to fix before reuse.

## Copy-paste prompt

Ask your AI tool: "Check this ${layer.title.toLowerCase()} artifact against the failure modes below and name the first concrete fix."

## Blank template

Use \`TEMPLATE.md\` to rewrite the artifact.

## Filled synthetic example

Use \`EXAMPLE.synthetic.md\` to compare a safe example.

## Common failure modes

${list(layer.failures)}

## How to hand it to Claude Code / Codex / Cursor / Windsurf / Copilot / Cline

Paste this file after the artifact and ask for findings ordered by risk.
`;
}

export function renderPrompt(prompt) {
  if (prompt.operativeCore) {
    return renderOperativePrompt(prompt);
  }
  return `# ${prompt.title}

Purpose: ${prompt.purpose}

## Scenario

${prompt.scenario}

## Input requirements

${list(prompt.inputRequirements)}

## Operating steps

${numbered(prompt.steps)}

## Copy-paste prompt

\`\`\`text
You are helping me with ${prompt.title.toLowerCase()} in a local-first AI collaboration workspace.

Task: ${prompt.purpose}

Scenario:
${prompt.scenario}

Instructions:
- Work only from the material I provide.
- Follow these steps:
${prompt.steps.map((step, index) => `  ${index + 1}. ${step}`).join("\n")}
- Do not claim to understand my private business beyond the provided context.
- Return the expected output shape below.

Material:
[paste redacted material here]
\`\`\`

## Expected output

${list(prompt.outputFormat)}

## Failure modes

${list(prompt.failureModes)}

## Example

${prompt.example}

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
`;
}

// A small set of "judgment-quality" prompts carry an operativeCore: a core
// distilled from real practice (desensitized). For those, the copy-paste block
// is self-contained and ships the specific thresholds, checks, and
// counter-examples that make the prompt bite — the same shape as a deepened
// mechanism PROMPT.md (Trigger / Do not use / Input / Process / Output shape /
// Pass bar / Reject bar / Rules) — instead of a generic skeleton mechanically
// derived from a flat step list. Prompts without an operativeCore stay
// byte-for-byte identical to their previous template output.
export function renderOperativePrompt(prompt) {
  const core = prompt.operativeCore;
  return `# ${prompt.title}

Purpose: ${prompt.purpose}

## Scenario

${prompt.scenario}

## Input requirements

${list(prompt.inputRequirements)}

## Operating steps

${numbered(core.process)}

## Copy-paste prompt

\`\`\`text
You are helping me with ${prompt.title.toLowerCase()} in a local-first AI collaboration workspace.

Task: ${prompt.purpose}

Trigger:
${core.trigger}

Do not use when:
${core.antiTrigger}

Input:
${core.input}

Process:
${core.process.map((step, index) => `${index + 1}. ${step}`).join("\n")}

Output shape:
${core.outputShape.map((item) => `- ${item}`).join("\n")}

Pass bar (do not pass unless all hold):
${core.passBar.map((item) => `- ${item}`).join("\n")}

Reject bar (send back if any holds):
${core.rejectBar.map((item) => `- ${item}`).join("\n")}

Rules:
- Work only from the material I provide.
- Keep private material local; use public-safe synthetic wording for examples.
- Label facts, assumptions, and unverified claims.
- Do not claim to understand my private business beyond the provided context.

Material:
[paste redacted material here]
\`\`\`

## Expected output

${list(prompt.outputFormat)}

## Counter-example

${core.counterExample}

## Failure modes

${list(prompt.failureModes)}

## Example

${prompt.example}

## Use with

Claude Code / Codex / Cursor / Windsurf / Copilot / Cline.
`;
}

export function renderSkill(skill) {
  return `---
name: ${skill.id}
description: ${skill.purpose}
---

# ${skill.id} skill

## When to use

${skill.when}

## Inputs

- The shared core contract.
- A redacted task context.
- The relevant layer template.
- Any acceptance criteria or review findings.

## Process

${numbered(skill.process)}

## Output

${list(skill.output)}

## Safety

${list(skill.safety)}

## Example

${skill.example}
`;
}

export function renderAdapter(adapter) {
  return `# ${adapter.name} Adapter

${adapter.note}

## Shared contract pointer

Read \`../SHARED_CORE_CONTRACT.md\` before acting. This adapter is intentionally thin so the profile, context, acceptance, guard, handoff, and harvest rules do not drift.

## How to use

1. Attach or paste \`../SHARED_CORE_CONTRACT.md\`.
2. Attach the layer file you need, such as \`../../context/TEMPLATE.md\`.
3. Attach the current context package or synthetic case.
4. Ask ${adapter.name} to return the required artifact shape.

## Minimal instruction

\`\`\`text
Use the local AI collaboration workspace. Follow SHARED_CORE_CONTRACT.md. For this task, use profile, context, acceptance, guard, handoff, and harvest as explicit files. Do not invent hidden memory. Label assumptions and unverified claims.
Follow the coaching layer in SHARED_CORE_CONTRACT.md: proactively remind me at key collaboration moments (defining done, reviewing completion claims, handoff, harvest, profile updates), restrained by default.
\`\`\`

## What this adapter must not do

- It must not duplicate the full core contract.
- It must not create a separate rule system.
- It must not upload private material.
- It must not overwrite user files silently.
`;
}

export function renderMechanismReadme(mechanism) {
  return `# ${mechanism.title}

Part of the AI Collaboration Open System. This is a local-first, public-safe mechanism package you can copy into Claude Code, Codex, Cursor, Cline, Windsurf, or Copilot.

## Purpose

${mechanism.purpose}

## When to use

${mechanism.trigger}${section("When not to use", mechanism.antiTrigger)}

## Input shape

${mechanism.input}${listSection("Input materials", mechanism.inputsDetailed)}

## Process

${numbered(mechanism.process)}${listSection("Output shape", mechanism.outputShape)}${listSection("Pass bar (what counts as done / safe to trust)", mechanism.passBar)}${listSection("Reject bar (what sends it back)", mechanism.rejectBar)}${listSection("Common misuse", mechanism.misuse)}

## Package files

- \`README.md\` explains the mechanism.
- \`PROMPT.md\` gives the copy-paste prompt.
- \`TEMPLATE.md\` gives the blank operating card.
- \`EXAMPLE.synthetic.md\` shows a public-safe run.
- \`FAILURE_MODES.md\` names common ways this mechanism fails.
`;
}

// In-fence (plain text, no markdown heading) optional blocks for the prompt.
function fenceBlock(label, text) {
  if (!text) return "";
  return `\n\n${label}:\n${text}`;
}

function fenceListBlock(label, items) {
  if (!items || items.length === 0) return "";
  return `\n\n${label}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

export function renderMechanismPrompt(mechanism) {
  const secondFamilyPointer =
    mechanism.id === "dual-guard"
      ? "\n\nDon't have a second model family yet? See the cookbook recipe `../../cookbook/bridge-to-a-second-family.md` for how to set one up (manual copy-paste or an optional auto bridge) and route this review across it. The `[paste ... here]` slot below assumes you already have that second, different-family AI to paste into."
      : "";
  return `# ${mechanism.title} Prompt

This prompt belongs to the AI Collaboration Open System. Use it in a local-first workflow with public-safe or redacted material.

## Purpose

${mechanism.purpose}${secondFamilyPointer}

## Copy-paste prompt

\`\`\`text
Use the ${mechanism.title} mechanism from my local AI Collaboration Open System workspace.

Purpose:
${mechanism.purpose}

Trigger:
${mechanism.trigger}${fenceBlock("Do not use when", mechanism.antiTrigger)}

Input:
[paste redacted task material, context package, and acceptance card here]

Process:
${mechanism.process.map((step, index) => `${index + 1}. ${step}`).join("\n")}${fenceListBlock("Output shape", mechanism.outputShape)}

Return:
- Decision-changing findings only
- Evidence used
- Required fixes
- Residual risk
- Next action${fenceListBlock("Pass bar (do not pass unless all hold)", mechanism.passBar)}${fenceListBlock("Reject bar (send back if any holds)", mechanism.rejectBar)}

Rules:
- Work from provided material only.
- Keep private material local.
- Use public-safe synthetic wording for examples.
- Label assumptions and unverified claims.
\`\`\`${section("Full worked example", mechanism.filledExample ? "See `EXAMPLE.synthetic.md` for this prompt run from start to finish on a public-safe synthetic task." : "")}
`;
}

export function renderMechanismTemplate(mechanism) {
  return `# ${mechanism.title} Template

AI Collaboration Open System mechanism card. Fill this in a local-first workflow with public-safe or redacted material.

## Purpose

${mechanism.purpose}

## Template

${mechanism.template.map((field) => `### ${field}\n\n`).join("\n")}${listSection("Pass bar (tick before you trust the result)", mechanism.passBar)}${listSection("Reject bar (send it back if any of these is true)", mechanism.rejectBar)}${section("Worked example", mechanism.filledExample ? "See `EXAMPLE.synthetic.md` for this same card filled out end to end on a public-safe synthetic task." : "")}

## Completion check

- The mechanism has a named trigger.
- The next action is concrete.
- Private details are redacted or rewritten as synthetic examples.
- The result can be handed to another AI tool without extra chat history.
`;
}

function filledExampleBody(filled) {
  if (!filled) return "";
  const scenario = filled.scenario ? `${filled.scenario}\n\n` : "";
  return `\n\n## Full worked example (filled end to end)\n\n${scenario}${filled.lines.join("\n")}`;
}

export function renderMechanismExample(mechanism) {
  return `# ${mechanism.title} Synthetic Example

This is a public-safe synthetic example for the AI Collaboration Open System. It is local-first and contains no private account, customer, route, hook, or conversation material.

## Synthetic example

${mechanism.example}${filledExampleBody(mechanism.filledExample)}

## How the mechanism changes the outcome

Without this mechanism, a single assistant can produce a smooth answer while hiding uncertainty. With this mechanism, the workflow records trigger, evidence, decision, residual risk, and next action.

## Reuse note

Copy the shape, not the synthetic facts. Adapt the template to your own redacted task.
`;
}

export function renderMechanismFailures(mechanism) {
  return `# ${mechanism.title} Failure Modes

AI Collaboration Open System failure checklist. Use it in a local-first workflow before trusting a mechanism run, and rewrite any public example into public-safe language.

## Failure modes

${list(mechanism.failures)}${listSection("Common misuse (operator errors that look fine but break the mechanism)", mechanism.misuse)}

## Guard questions

1. Did this mechanism change the decision, or just add ceremony?
2. Is any private material copied instead of summarized or synthesized?
3. Are blockers, residual risks, and next actions separated?
4. Could a new session continue from this file alone?
`;
}

function codeBlock(lang, lines) {
  return `\`\`\`${lang}\n${lines.join("\n")}\n\`\`\``;
}

function renderGuardChain(finding) {
  return `### Guard finding (cause-and-effect chain)

1. **Under review:** ${finding.target}
2. **Problem:** ${finding.problem}
3. **Evidence:**
${finding.evidence.map((item) => `   - ${item}`).join("\n")}
4. **Why this cannot pass:** ${finding.whyBlock}
5. **Required fix:** ${finding.requiredFix}
6. **Verdict:** ${finding.verdict}`;
}

function renderFlagshipCase(caseItem) {
  const osProcess = [
    `Context package: ${caseItem.profileContext}`,
    `Acceptance card: ${caseItem.acceptance}`,
    `Execution prompt: ${caseItem.executionPrompt}`,
    `First AI output: a fluent "done" claim that overstates what the code does.`,
    `Guard review: independent reviewer points to the lines where the claim and code disagree.`,
    `Revised output: keyboard reorder implemented and tested; blocker resolved.`,
    `Handoff note: ${caseItem.handoff}`,
    `Harvest seed: ${caseItem.harvest}`
  ];
  const acceptanceCard = caseItem.acceptanceCard;
  const beforeAfterRows = [
    "| Dimension | Before (raw single-agent chat) | After (AI Collaboration OS) |",
    "| --- | --- | --- |",
    "| Scope | Refactor, drag, keyboard, visual polish, and tests blur into one promise. | Current slice is reorder only; visual redesign is explicitly out of scope. |",
    "| Done standard | \"Looks done\" based on a fluent reply. | Acceptance card with five checkable criteria (mouse, keyboard, tests, data, scope). |",
    "| Completion claim | \"Keyboard works and tests pass\" is trusted as written. | Guard points to the exact lines where the claim and code disagree. |",
    "| Keyboard accessibility | Silently missing behind a stub handler. | Implemented in the revised output and proven by a keyboard test. |",
    "| Handoff | Next session restarts and re-asks what was rejected. | Done, pending, and unverified are separated for the next session. |",
    "| Reusable lesson | Lost after the chat scrolls away. | Harvested: verify completion claims with code and test evidence. |"
  ];

  return `# ${caseItem.title}

This is a fully synthetic case. It does not contain private customer material, real raw conversations, local paths, or private operational routes. It walks one real collaboration loop: a messy request becomes context, acceptance, a first AI output, a guard review that catches a false completion claim, a revised output, a handoff, and a harvest lesson.

## Confusing raw input

${caseItem.rawInput}

## Likely single-agent failure

${caseItem.baselineOutput}

## AI Collaboration OS process

${numbered(osProcess)}

## Messy starting point

${caseItem.messy}

## Workspace setup

${caseItem.setup}

## Profile/context

${caseItem.profileContext}

## Context package

${caseItem.profileContext}

See \`artifacts/context-package.md\` for the standalone version.

## Acceptance card

${acceptanceCard.summary}

${numbered(acceptanceCard.criteria)}

Reject rule: ${acceptanceCard.rejectIf}

See \`artifacts/acceptance-card.md\` for the standalone version.

## Execution prompt

\`\`\`text
${caseItem.executionPrompt}
\`\`\`

## First AI output

The AI returned a confident completion claim:

> ${caseItem.firstAiOutput.claim}

The code only implements pointer drag; the keyboard handler is a stub and there is no keyboard test. The full artifact, with stable line numbers the guard can cite, is in \`artifacts/first-ai-output.md\`.

## Guard review

A cross-checking guard reviews the first AI output against the acceptance card and reports a causal chain instead of a one-line verdict.

${renderGuardChain(caseItem.guardFinding)}

The full review, with line references into \`first-ai-output.md\`, is in \`artifacts/guard-review.md\`.

## Revised output

${caseItem.revisedOutput.summary} ${caseItem.revisedOutput.guardRecheck} The corrected code and the new keyboard test are in \`artifacts/revised-output.md\`.

## Handoff note

${caseItem.handoff}

## Harvest seed

${caseItem.harvest}

## Before/after comparison

${beforeAfterRows.join("\n")}

## What changes compared with a single raw AI chat

A raw chat would accept the first "done" because it reads well. This loop made the completion claim checkable, so an independent guard caught that keyboard reorder was claimed but never implemented or tested. That gap is exactly what one agent tends not to see in its own fluent answer, and what a guard pointing to specific lines does see.

## artifacts

- Profile artifact: ${caseItem.artifacts.profile}
- Context artifact: ${caseItem.artifacts.context}
- Acceptance artifact: ${caseItem.artifacts.acceptance}
- First AI output artifact: the completion claim plus the flawed TaskBoard code and the single mouse-only test (\`artifacts/first-ai-output.md\`).
- Guard artifact: ${caseItem.artifacts.guard}
- Revised output artifact: the implemented keyboard reorder and the added keyboard test (\`artifacts/revised-output.md\`).
- Handoff artifact: ${caseItem.artifacts.handoff}
- Harvest artifact: ${caseItem.artifacts.harvest}

Artifact files:

- \`artifacts/context-package.md\`
- \`artifacts/acceptance-card.md\`
- \`artifacts/execution-prompt.md\`
- \`artifacts/first-ai-output.md\`
- \`artifacts/guard-review.md\`
- \`artifacts/revised-output.md\`
- \`artifacts/handoff-note.md\`
- \`artifacts/harvest-seed.md\`

## raw-input

${caseItem.rawInput}

## baseline-output

${caseItem.baselineOutput}

## system-run

${numbered(caseItem.systemRun)}

## comparison

${caseItem.comparison}

## next-step

${caseItem.nextStep}
`;
}

export function renderCase(caseItem) {
  if (caseItem.flagship) {
    return renderFlagshipCase(caseItem);
  }
  const rawInput = caseItem.rawInput ?? caseItem.messy;
  const baselineOutput = caseItem.baselineOutput ?? `A likely single-agent answer would produce a fluent artifact from the messy request, but it would not preserve explicit context, acceptance, guard review, handoff state, and harvest learning.`;
  const beforeAfter = caseItem.comparison;
  const osProcess = [
    `Context package: ${caseItem.profileContext}`,
    `Acceptance card: ${caseItem.acceptance}`,
    `Execution prompt: ${caseItem.executionPrompt}`,
    `Guard review: ${caseItem.guardReview}`,
    `Handoff note: ${caseItem.handoff}`,
    `Harvest seed: ${caseItem.harvest}`
  ];

  return `# ${caseItem.title}

This is a fully synthetic case. It does not contain private customer material, real raw conversations, local paths, or private operational routes.

## Confusing raw input

${rawInput}

## Likely single-agent failure

${baselineOutput}

## AI Collaboration OS process

${numbered(osProcess)}

## Context package

${caseItem.profileContext}

## Acceptance card

${caseItem.acceptance}

## Guard review

${caseItem.guardReview}

## Handoff note

${caseItem.handoff}

## Harvest seed

${caseItem.harvest}

## Before/after comparison

${beforeAfter}

## Messy starting point

${caseItem.messy}

## Workspace setup

${caseItem.setup}

## Profile/context

${caseItem.profileContext}

## Acceptance

${caseItem.acceptance}

## Execution prompt

\`\`\`text
${caseItem.executionPrompt}
\`\`\`

## Handoff

${caseItem.handoff}

## Harvest

${caseItem.harvest}

## What changes compared with a single raw AI chat

${caseItem.comparison}

## Artifacts

- \`artifacts/context-package.md\`
- \`artifacts/acceptance-card.md\`
- \`artifacts/execution-prompt.md\`
- \`artifacts/guard-review.md\`
- \`artifacts/handoff-note.md\`
- \`artifacts/harvest-seed.md\`
`;
}

function acceptanceCardContent(caseItem) {
  const card = caseItem.acceptanceCard;
  if (!card) return caseItem.artifacts?.acceptance ?? caseItem.acceptance;
  return `${card.summary}\n\n${numbered(card.criteria)}\n\nReject rule: ${card.rejectIf}`;
}

function firstAiOutputContent(caseItem) {
  const first = caseItem.firstAiOutput;
  if (!first) return caseItem.profileContext ?? "";
  return [
    "Completion claim (what the AI reported):",
    "",
    `> ${first.claim}`,
    "",
    `${first.codeLabel}:`,
    "",
    codeBlock("tsx", first.code),
    "",
    `${first.testLabel}. Self-reported result: ${first.selfReportedTests}.`,
    "",
    codeBlock("tsx", first.test),
    "",
    "Defect summary:",
    "- Claimed arrow-key reorder, but `onKeyDown` is a stub that only logs the key (no `moveTask` call).",
    "- Claimed full test coverage, but only the mouse path has a test; there is no keyboard test.",
    "- The line numbers above are relative to each code block so the guard review can cite them."
  ].join("\n");
}

function guardReviewContent(caseItem) {
  if (!caseItem.guardFinding) return caseItem.artifacts?.guard ?? caseItem.guardReview;
  return `This review challenges \`first-ai-output.md\` against the acceptance card.\n\n${renderGuardChain(caseItem.guardFinding)}`;
}

function revisedOutputContent(caseItem) {
  const revised = caseItem.revisedOutput;
  if (!revised) return caseItem.comparison ?? "";
  return [
    revised.summary,
    "",
    `${revised.codeLabel}:`,
    "",
    codeBlock("tsx", revised.code),
    "",
    `${revised.testLabel}. It fails against the old stub in \`first-ai-output.md\` and passes against this fix.`,
    "",
    codeBlock("tsx", revised.test),
    "",
    `Verification after the fix: ${revised.verification}.`,
    "",
    revised.guardRecheck
  ].join("\n");
}

export function renderCaseArtifact(caseItem, kind) {
  const map = {
    "context-package.md": {
      title: "Context package",
      content: caseItem.artifacts ? `${caseItem.artifacts.profile}\n\n${caseItem.artifacts.context}` : caseItem.profileContext,
      use: "Paste this before asking an AI tool to continue the task. It gives the assistant the working style, scope, constraints, and known evidence.",
      review: "Check that facts and assumptions are separated before execution starts.",
      next: "Use this context to write or verify the acceptance card."
    },
    "acceptance-card.md": {
      title: "Acceptance card",
      content: acceptanceCardContent(caseItem),
      use: "Paste this before implementation, drafting, research, or judgment work. Ask the assistant to treat these criteria as the pass/fail surface.",
      review: "Reject work that claims completion without evidence tied to this card.",
      next: "Use this card with the execution prompt and later guard review."
    },
    "execution-prompt.md": {
      title: "Execution prompt",
      content: `\`\`\`text\n${caseItem.executionPrompt}\n\`\`\``,
      use: "Paste this into the selected AI tool after the context package and acceptance card.",
      review: "Confirm the prompt does not expand scope beyond acceptance.",
      next: "Run guard review on the first artifact produced from this prompt."
    },
    "first-ai-output.md": {
      title: "First AI output",
      content: firstAiOutputContent(caseItem),
      use: "Read this as the artifact under review, not as a finished result. It is the AI's first answer, with a confident completion claim and code that does not fully back it up.",
      review: "Do not accept the completion claim on its own. Check each acceptance criterion against the code and tests here before trusting the answer.",
      next: "Run guard review against this output and find where the claim and the code disagree."
    },
    "guard-review.md": {
      title: "Guard review",
      content: guardReviewContent(caseItem),
      use: "Use this as the review stance after the first artifact exists. It challenges evidence, privacy, scope, and acceptance alignment.",
      review: "A review is not a pass unless it names evidence and residual risk.",
      next: "Fix any blocking finding, then write a handoff note."
    },
    "revised-output.md": {
      title: "Revised output",
      content: revisedOutputContent(caseItem),
      use: "Read this as the corrected answer after the guard review blocked the first one. It resolves the blocker the guard found.",
      review: "Confirm the blocker is actually fixed with evidence: the new behavior exists and a test proves it.",
      next: "Carry remaining unverified work, write the handoff note, then harvest the lesson."
    },
    "handoff-note.md": {
      title: "Handoff note",
      content: caseItem.artifacts?.handoff ?? caseItem.handoff,
      use: "Paste this into the next session or tool so work resumes from current state instead of restarting.",
      review: "Check that completed, pending, blocked, and next action are distinguishable.",
      next: "Use the handoff note as input to harvest."
    },
    "harvest-seed.md": {
      title: "Harvest seed",
      content: caseItem.artifacts?.harvest ?? caseItem.harvest,
      use: "Save this after the loop to preserve reusable knowledge without copying private raw material.",
      review: "Do not generalize from the synthetic case unless the pattern appears in future work.",
      next: "Move reusable prompts or rules into the appropriate workspace file."
    }
  };
  const item = map[kind];
  return `# ${item.title} - ${caseItem.title}

## Source case

- Case id: \`${caseItem.id}\`
- Case title: ${caseItem.title}
- Privacy status: fully synthetic
- Private material: none

## How to use

${item.use}

## Synthetic content

${item.content}

## Review note

${item.review}

## Next step

${item.next}

## Why this exists

This artifact makes the case runnable and reviewable. A raw chat can produce a smooth answer, but this file preserves the specific state needed for profile, context, acceptance, guard, handoff, and harvest work.
`;
}

export function renderPrivacyDoc() {
  return `# Privacy Boundary

This workspace is local-first. It does not call external AI APIs by default, upload user content, scan the whole disk, or install hooks without consent.

## Public-safe material

- Generic architecture
- Generic prompts
- Generic templates
- Thin tool adapters
- Synthetic examples
- Setup docs
- Known limitations

## Forbidden public material

- Real private governance contents
- Knowledge-base source material copied from a private system
- Real personal profile
- Actual client material
- Raw private conversations
- Non-public automation or routing details
- Internal calibration metrics, scoring configuration, or account-specific habits
- Local machine paths
- Tokens, keys, cookies, and credentials
- Unredacted screenshots

## Redaction standard

Before publishing an example, ask:

\`\`\`text
Could a stranger infer the owner's private system, identity, clients, files, habits, or operational routes from this?
\`\`\`

If yes, rewrite it as a synthetic example.
`;
}

export function renderCommercialBoundary() {
  return `# Commercial Boundary

The open-source edition gives the complete generic self-build path.

## Free and open

- Workspace skeleton
- Six collaboration layers
- Generic prompts
- Skills
- Thin adapters
- Synthetic cases
- Privacy and setup docs
- Health checks and their limitations

## Paid help may include

- Real workflow review
- Personalized profile calibration
- Project-specific setup
- Migration from existing AI workflows
- Custom guard rules
- Scenario packs
- Human review
- Async audit
- Long-term workflow improvement

## Required framing

The method is public. Paid help gives users a calibrated version for their real workflow and saves time.

## Forbidden framing

Do not imply that the open version only names problems while paid help unlocks the fix.
`;
}

export function renderExamplesIndex() {
  return `# Synthetic Case Library

Every case is synthetic and shows the full loop:

\`\`\`text
messy starting point
-> workspace setup
-> profile/context
-> acceptance
-> execution prompt
-> guard review
-> handoff
-> harvest
-> what changes compared with a single raw AI chat
\`\`\`

${caseDefinitions.map((item) => `- [${item.title}](./${item.id}/CASE.md)`).join("\n")}
`;
}

export { adapterDefinitions, caseDefinitions, layerDefinitions, promptDefinitions, skillDefinitions };
