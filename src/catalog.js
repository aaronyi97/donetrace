export const layerDefinitions = [
  {
    id: "profile",
    title: "Profile",
    summary: "How the AI adapts to the user's working style, constraints, and decision habits.",
    zh: "让 AI 先知道怎样配合这个人，而不是每次都按通用助理口吻开始。",
    purpose: "Capture stable collaboration preferences that affect how an assistant should ask, decide, challenge, summarize, and hand work back.",
    when: "Use before long tasks, recurring work, cross-tool handoffs, or any situation where tone, risk appetite, and decision rules matter.",
    input: "A short description of the user's role, work type, preferred feedback style, constraints, review habits, and known failure patterns.",
    output: "A compact profile card with preferences, hard boundaries, collaboration defaults, and update rules.",
    prompt: "Create a profile card for this user. Extract only reusable collaboration preferences, not private secrets. Separate stable preferences from task-specific context. Return: working style, decision rules, communication preferences, hard boundaries, and what future assistants should ask before acting.",
    template: [
      "User role or situation:",
      "Preferred collaboration style:",
      "Decision rules:",
      "Hard boundaries:",
      "Review habits:",
      "Known failure patterns:",
      "How to update this profile:"
    ],
    example: [
      "User role or situation: Solo product builder validating a weekend prototype.",
      "Preferred collaboration style: Direct risk calls, short summaries, concrete next actions.",
      "Decision rules: Prefer evidence from user behavior over elegant architecture.",
      "Hard boundaries: Do not upload private notes or make purchasing decisions.",
      "Review habits: Wants assumptions and unverified claims labeled.",
      "Known failure patterns: Over-polished plans can replace real validation.",
      "How to update this profile: Add new stable preferences only after they appear in at least two tasks."
    ],
    failures: [
      "Treating a profile as a personality essay instead of operational guidance.",
      "Storing secrets, account details, or private identity signals.",
      "Mixing task context into the stable profile and making future sessions stale.",
      "Letting the assistant infer values without user confirmation."
    ]
  },
  {
    id: "context",
    title: "Context",
    summary: "What the task boundary is, what is known, and what should not be assumed.",
    zh: "把当前任务边界写清楚，避免新会话靠猜。",
    purpose: "Package the task so an assistant can start from the right boundary, evidence, constraints, and unknowns without reading the whole history.",
    when: "Use at the start of any task that spans more than one message, touches files, involves judgment, or may be resumed later.",
    input: "Goal, current state, relevant files or links, constraints, non-goals, known facts, assumptions, risks, and open questions.",
    output: "A context package that lets another assistant continue without inventing missing background.",
    prompt: "Turn this messy situation into a context package. Separate facts from assumptions. Include goal, current state, relevant artifacts, constraints, non-goals, risks, and open questions. Keep private material summarized or redacted.",
    template: [
      "Goal:",
      "Current state:",
      "Relevant artifacts:",
      "Constraints:",
      "Non-goals:",
      "Facts:",
      "Assumptions:",
      "Risks:",
      "Open questions:"
    ],
    example: [
      "Goal: Prepare a public beta onboarding flow for a synthetic note app.",
      "Current state: Landing copy exists; onboarding has not been tested.",
      "Relevant artifacts: README draft, onboarding checklist, synthetic tester notes.",
      "Constraints: No analytics SDK until privacy language is reviewed.",
      "Non-goals: Payment, account recovery, enterprise SSO.",
      "Facts: Three testers abandoned before creating a first note.",
      "Assumptions: The first-run prompt may be too abstract.",
      "Risks: Improving copy without testing the actual flow.",
      "Open questions: Which first action should count as activation?"
    ],
    failures: [
      "Dumping the whole history instead of compressing decision-changing facts.",
      "Not labeling assumptions.",
      "Forgetting non-goals, causing assistants to expand scope.",
      "Including private file paths or raw conversations."
    ]
  },
  {
    id: "acceptance",
    title: "Acceptance",
    summary: "What done means before work starts.",
    zh: "先定义完成标准，再让 AI 干活。",
    purpose: "Make success inspectable by defining observable outcomes, required artifacts, verification steps, and explicit non-acceptance conditions.",
    when: "Use before implementation, writing, research, design, cleanup, or any task where 'looks good' would be too vague.",
    input: "Goal, expected artifacts, constraints, quality bar, verification command or manual check, and conditions that would reject the work.",
    output: "An acceptance card that a reviewer can use to pass, reject, or request changes.",
    prompt: "Write an acceptance card for this task. Define concrete deliverables, pass criteria, required checks, rejected states, and evidence needed before claiming completion. Do not rely on vibes or intent.",
    template: [
      "Task:",
      "Deliverables:",
      "Pass criteria:",
      "Required checks:",
      "Rejected states:",
      "Evidence needed:",
      "Owner decision needed:"
    ],
    example: [
      "Task: Create a reusable onboarding checklist for a synthetic notes app.",
      "Deliverables: One checklist, one example run, one review note.",
      "Pass criteria: A new user can complete first note creation without reading strategy prose.",
      "Required checks: Run through the checklist using the synthetic case.",
      "Rejected states: Only a theory doc exists; no concrete user path.",
      "Evidence needed: Completed example artifact and reviewer note.",
      "Owner decision needed: Whether to include account creation in the first loop."
    ],
    failures: [
      "Defining acceptance after the answer is already written.",
      "Using subjective phrases like polished, robust, or complete without evidence.",
      "Skipping rejected states.",
      "Treating tests as proof when they do not cover the stated behavior."
    ]
  },
  {
    id: "guard",
    title: "Guard / Review",
    summary: "How output is challenged before trust.",
    zh: "让另一个视角先挑错，再决定是否相信产物。",
    purpose: "Challenge work against requirements, risks, privacy boundaries, evidence quality, and user intent before it becomes trusted output.",
    when: "Use after a draft, implementation, research answer, plan, or handoff that could mislead future work if wrong.",
    input: "The artifact under review, acceptance card, context package, known constraints, and the specific review stance.",
    output: "A review result with findings, severity, evidence, required fixes, and a pass or reject recommendation.",
    prompt: "Review this artifact against the context and acceptance card. Prioritize concrete defects, missing evidence, privacy risk, unsupported claims, and scope drift. Return findings ordered by severity with file or section references when possible.",
    template: [
      "Artifact reviewed:",
      "Review stance:",
      "Acceptance source:",
      "Findings:",
      "Evidence:",
      "Required fixes:",
      "Residual risk:",
      "Recommendation:"
    ],
    example: [
      "Artifact reviewed: Onboarding checklist draft.",
      "Review stance: First-user path and privacy review.",
      "Acceptance source: Acceptance card dated synthetic-case-01.",
      "Findings: P1 checklist says 'review analytics' but privacy constraint forbids adding analytics now.",
      "Evidence: Context states no analytics SDK until privacy language is reviewed.",
      "Required fixes: Replace analytics step with manual tester observation.",
      "Residual risk: Still untested with a real user.",
      "Recommendation: Reject until the flow uses privacy-safe evidence."
    ],
    failures: [
      "Reviewing style instead of requirements.",
      "Letting the same assistant rubber-stamp its own work.",
      "Listing vague concerns without actionable fixes.",
      "Calling something passed without checking the acceptance card."
    ]
  },
  {
    id: "handoff",
    title: "Handoff",
    summary: "How the next session resumes without restarting.",
    zh: "给下一棒留一个能直接接上的交接卡。",
    purpose: "Transfer current state, decisions, evidence, blockers, and next actions to another session or tool without replaying the whole conversation.",
    when: "Use before stopping, switching tools, delegating to another assistant, or after any work that may need continuation.",
    input: "Goal, current status, completed work, changed files or artifacts, decisions, verification evidence, blockers, and next action.",
    output: "A short handoff note that separates done, pending, blocked, and unverified work.",
    prompt: "Create a handoff note for the next AI session. Include goal, current state, completed work, pending work, blockers, decisions, verification evidence, and the exact next action. Label unverified claims.",
    template: [
      "Goal:",
      "Current status:",
      "Completed:",
      "Pending:",
      "Blocked:",
      "Decisions:",
      "Verification evidence:",
      "Next action:"
    ],
    example: [
      "Goal: Finish synthetic onboarding checklist.",
      "Current status: Draft exists and failed guard review on privacy-safe evidence.",
      "Completed: Context package and acceptance card are ready.",
      "Pending: Replace analytics step with manual tester observation.",
      "Blocked: Need owner choice on whether account creation belongs in scope.",
      "Decisions: First loop focuses on first note creation only.",
      "Verification evidence: Guard review found one P1 issue.",
      "Next action: Edit checklist step 4 and rerun guard review."
    ],
    failures: [
      "Writing a narrative summary instead of a resumable state card.",
      "Not separating completed from unverified.",
      "Omitting blockers and causing the next assistant to guess.",
      "Leaving no exact next action."
    ]
  },
  {
    id: "harvest",
    title: "Harvest",
    summary: "What becomes reusable knowledge or material.",
    zh: "把一次任务里可复用的经验收回来，而不是让它消失在聊天里。",
    purpose: "Extract reusable patterns, prompts, decisions, examples, and rule-update candidates from completed work.",
    when: "Use after a task loop, review, failed attempt, content draft, research synthesis, or repeated workflow friction.",
    input: "Final artifact, review result, decisions made, surprising lessons, repeated pain points, and reusable snippets.",
    output: "A harvest seed with reusable material, where to store it, and what should not be generalized.",
    prompt: "Extract harvest from this completed task. Separate reusable knowledge, reusable prompt fragments, decision records, future rule candidates, and material that should stay task-specific. Do not over-generalize from one case.",
    template: [
      "Source task:",
      "Reusable knowledge:",
      "Reusable prompts:",
      "Decision record:",
      "Rule update candidates:",
      "Do not generalize:",
      "Storage target:",
      "Next reuse:"
    ],
    example: [
      "Source task: Synthetic onboarding checklist.",
      "Reusable knowledge: First-run flows need one observable activation event.",
      "Reusable prompts: Ask the assistant to name one artifact a new user can produce.",
      "Decision record: Avoid analytics until privacy language is reviewed.",
      "Rule update candidates: Every onboarding case needs a privacy-safe evidence step.",
      "Do not generalize: The synthetic notes-app activation event may not fit other products.",
      "Storage target: examples/content-production-harvest/artifacts/harvest-seed.md.",
      "Next reuse: Apply the activation-event test to another synthetic product case."
    ],
    failures: [
      "Harvesting everything and creating clutter.",
      "Turning one example into a universal rule.",
      "Saving private raw material instead of synthetic or redacted learning.",
      "Not linking harvest back to future reuse."
    ]
  }
];

export const promptDefinitions = [
  {
    file: "profile-creation.md",
    title: "Profile creation",
    purpose: "Create a reusable collaboration profile from a redacted user description.",
    scenario: "Use when a user is starting a new AI workspace and wants future sessions to know how to collaborate without storing private secrets.",
    inputRequirements: [
      "Redacted description of the user's work and preferred feedback style.",
      "Known boundaries: actions the assistant must not take without consent.",
      "Examples of useful and unhelpful assistant behavior."
    ],
    steps: [
      "Extract stable preferences only; ignore one-off task facts.",
      "Separate communication style, decision rules, safety boundaries, and update triggers.",
      "Ask no more than three questions if a boundary is ambiguous.",
      "Mark any inferred preference as provisional."
    ],
    outputFormat: [
      "Profile summary",
      "Collaboration defaults",
      "Hard boundaries",
      "Review and challenge preferences",
      "When to update this profile"
    ],
    failureModes: [
      "Turning the profile into a biography.",
      "Saving secrets, customer names, local paths, or raw private conversations.",
      "Treating a single emotional moment as a permanent preference."
    ],
    example: "Input: 'I build prototypes alone and hate vague reassurance.' Output: 'Use direct risk calls, short options, and evidence labels; do not make purchases or publish without explicit consent.'"
  },
  {
    file: "profile-refinement.md",
    title: "Profile refinement",
    purpose: "Update an existing profile with only stable new preferences.",
    scenario: "Use after several sessions reveal a repeated working preference or a profile rule is causing friction.",
    inputRequirements: [
      "Current profile card.",
      "New evidence from at least one recent task.",
      "Whether the user explicitly confirmed the new preference."
    ],
    steps: [
      "Compare new evidence against the existing profile.",
      "Classify each candidate as stable, task-specific, contradictory, or unsafe to store.",
      "Preserve older rules unless there is clear replacement evidence.",
      "Return a patch-style update instead of rewriting the whole profile."
    ],
    outputFormat: [
      "Keep unchanged",
      "Add",
      "Revise",
      "Do not store",
      "Open confirmation question"
    ],
    failureModes: [
      "Overwriting the profile because one task went badly.",
      "Adding private operational detail as if it were a collaboration preference.",
      "Hiding uncertainty by merging contradictory preferences."
    ],
    example: "Current profile says 'ask before execution.' New evidence says user now gives task-level authorization for explicit implementation requests. Output a narrow revision with the exact trigger."
  },
  {
    file: "project-context-packaging.md",
    title: "Project context packaging",
    purpose: "Compress a messy task into facts, boundaries, assumptions, risks, and open questions.",
    scenario: "Use when a task spans files, sessions, tools, or decisions and a new assistant would otherwise start by guessing.",
    inputRequirements: [
      "Goal in the user's words.",
      "Current state and relevant artifacts.",
      "Constraints, non-goals, facts, assumptions, blockers, and known risks."
    ],
    steps: [
      "Name the task boundary before summarizing details.",
      "Split facts from assumptions and decisions from preferences.",
      "Compress history into information that changes what the next assistant should do.",
      "End with the next action and the smallest missing question."
    ],
    outputFormat: [
      "Goal",
      "Current state",
      "Relevant artifacts",
      "Constraints and non-goals",
      "Facts",
      "Assumptions",
      "Risks",
      "Open questions",
      "Next action"
    ],
    failureModes: [
      "Dumping a transcript instead of packaging context.",
      "Omitting non-goals and letting scope expand.",
      "Losing evidence links or file references needed for review.",
      "Handing over the option list as the whole map, so the receiver inherits whatever the author forgot.",
      "Naming which clause or category the task belongs to but never what the owner ultimately does with the result."
    ],
    example: "Messy input says 'fix onboarding, maybe pricing too, users are confused.' Output separates onboarding as the current scope and pricing as a non-goal until evidence changes.",
    operativeCore: {
      trigger: "Use at the start of any task that will cross a boundary — span multiple files, sessions, or tools, get handed to a different assistant, or be resumed later — and where a new assistant starting cold would otherwise begin by guessing. Package the context BEFORE the next assistant acts, so it inherits a boundary instead of a transcript.",
      antiTrigger: "Skip the full packaging for a single-step task with one obvious goal and no state worth transferring, or a quick fact lookup you will act on yourself in the same breath. A full facts/boundaries/assumptions/risks/open-questions package for a one-line ask is overhead the receiver does not need, and ceremony with no payoff trains people to skip packaging when the task is actually tangled.",
      input: "The goal in the owner's own words. The current state and the artifacts that matter (files, links, prior decisions). The constraints and the explicit non-goals. What is known as fact versus assumed. The blockers and known risks. And, honestly, what you may have left off the list — because the biggest risk in a handoff is the option the author never wrote down.",
      process: [
        "Name the task boundary first — goal plus explicit non-goals — before summarizing any detail. A package without a boundary invites the receiver to expand scope into whatever looks interesting.",
        "Compress the situation into five buckets, not a narrative: FACTS (verified, with the evidence or file reference), BOUNDARIES (in scope vs out of scope), ASSUMPTIONS (believed but unverified, labeled as such), RISKS (what could go wrong), OPEN QUESTIONS (what is genuinely undecided). Split fact from assumption and decision from preference; do not let a confident sentence blur the two.",
        "Climb the purpose chain before fixing the delivery shape: do not stop at 'this task belongs to category X'. Ask what the owner will ultimately DO with the result — decide something, unblock a downstream step, cut review cost — because the end use is what sets the right granularity, depth, and format. A deliverable that maps to a category but serves no actual use is a compliance document, not a usable tool. If you cannot answer the end use, stop and re-define the task rather than packaging detail around a goal you have not pinned.",
        "Frame the next-step options as a menu, not the map: it is your view of what comes next, and you may have missed, misordered, or mis-scoped an item. Mark which options are well-grounded and which are guesses, and invite the receiver to find an unlisted option D or E.",
        "Hand the receiver an explicit first-round judgment to run before executing: (1) what is this task actually for — restate the goal, the current sub-task, and the completion bar; (2) is this option list exhaustive — what did I miss; (3) is there an unlisted item that serves the main line versus one that would hijack it? An option list accepted without questioning is an option list whose blind spots get inherited.",
        "End with one concrete next action and the smallest missing question — the single piece of information that, once answered, would most change what the receiver should do."
      ],
      outputShape: [
        "Goal and boundary: the goal in one line, with explicit non-goals.",
        "Facts: verified items, each with its evidence or file reference.",
        "Assumptions: believed-but-unverified items, labeled, kept separate from facts.",
        "Risks: what could go wrong, ordered by impact.",
        "Open questions: what is genuinely undecided, with the smallest missing question called out.",
        "End-use chain: what the owner ultimately does with the result, and how that sets the delivery shape.",
        "Option menu (not the map): next-step options, each marked well-grounded or guess, with a note of what may be missing.",
        "Receiver's first-round check: the three questions to answer before executing (what is this for / is the list exhaustive / is there a serving-vs-hijacking D or E).",
        "Next action: one concrete first step the receiver can take from this package alone."
      ],
      passBar: [
        "The task boundary — goal plus explicit non-goals — is stated before any detail, so scope cannot quietly expand.",
        "Facts and assumptions are in separate buckets, and every assumption is labeled rather than dressed as fact.",
        "The end-use chain is answered: what the owner finally does with the result is named, not just which category the task falls under.",
        "The option list is framed as a menu with missing or guessed items flagged, not presented as the complete set of next steps.",
        "There is one concrete next action and one smallest-missing-question, and a cold reader could continue from this package without the original chat."
      ],
      rejectBar: [
        "The package is a replayed transcript or a story of what happened, not a compressed boundary a stranger can act on.",
        "Non-goals are missing, so the receiver is free to expand scope into whatever looks interesting.",
        "An assumption is stated as a fact with no label and no evidence, and a later step would rest on it.",
        "The task is mapped to a clause or category but the owner's ultimate use is never named, so the delivery granularity is set by guesswork.",
        "The option list is handed over as the whole map, inviting the receiver to inherit the author's blind spots instead of testing for a missing D or E."
      ],
      counterExample: "Synthetic: a handoff package says 'finish the onboarding work; options are A polish the copy, B add a tooltip, C reorder the steps; next: do A.' A cold receiver that runs the first-round check instead of grabbing A asks question one — what is this actually for — and finds the real end use is 'get more new users to create their first note', not 'make the copy nicer'. Question two exposes that the author never listed the fact that three testers abandoned before the first note even loaded — an unlisted item D (the first screen is broken) that the copy options would never fix. The package had mapped the task to the category 'onboarding copy' but never to the owner's actual use, so the polished menu would have shipped prettier words on a screen users never reached."
    }
  },
  {
    file: "acceptance-definition.md",
    title: "Acceptance definition",
    purpose: "Define observable pass criteria and required evidence before work starts.",
    scenario: "Use before implementation, writing, research, cleanup, or review when 'looks good' would be too vague.",
    inputRequirements: [
      "Task goal and expected artifact.",
      "Quality bar and constraints.",
      "Available verification commands or manual checks.",
      "Rejected states that must not be accepted."
    ],
    steps: [
      "Turn the goal into inspectable deliverables.",
      "Write pass criteria that a skeptical reviewer can test.",
      "List required evidence before any completion claim.",
      "Add explicit rejected states to prevent false closure."
    ],
    outputFormat: [
      "Deliverables",
      "Pass criteria",
      "Required checks",
      "Rejected states",
      "Evidence needed",
      "Owner decision needed"
    ],
    failureModes: [
      "Accepting intent instead of observable output.",
      "Writing criteria after the work is already done.",
      "Letting tests pass even though they do not prove the user-facing requirement.",
      "Accepting a verbal 'it is done / it landed' with no pasted command output behind it.",
      "Collapsing 'not verified yet' into 'done' so the reviewer cannot tell which claims are actually proven."
    ],
    example: "For a CLI dry-run task, acceptance requires exit 0, no files created, clear stdout, and a test proving the target directory stays empty.",
    operativeCore: {
      trigger: "Use before any work where 'looks good' would be too vague and where a wrong 'done' would propagate: an implementation, a piece of writing, a research result, a cleanup, or any artifact another session or person will trust. Define done BEFORE the work starts, not after.",
      antiTrigger: "Skip the full ceremony for a throwaway one-line change, a quick fact lookup, or a step you will fully re-check by hand in the next minute anyway. Writing a six-part acceptance card for a trivial edit is cost you pay for nothing, and ceremony with no payoff trains people to skip acceptance when it actually matters.",
      input: "The task goal and the exact artifact expected. The quality bar and constraints. The verification commands or manual checks actually available (the real test command, the real grep, the real way to reproduce). The rejected states that must never be silently accepted. If the work is already partly done, the completion claims made so far so each can be tagged with a state.",
      process: [
        "Turn the goal into inspectable deliverables: name the file, the behavior, the output a skeptical reviewer could open and check. A deliverable you cannot point at is a deliverable you cannot accept.",
        "Write each pass criterion so it is mechanically checkable (a command that exits 0, a string that must appear, a behavior a stranger can reproduce), not a vibe like 'works well' or 'is clean'.",
        "Bind every completion claim to one of exactly three states and forbid any fourth: NOT DONE (nothing to show yet), DONE-PENDING-VERIFICATION (built but not yet proven), ACCEPTED (proven and signed off). Ban soft words like 'basically done', 'should be fine', 'mostly working' — they hide which state the work is really in.",
        "Require that any DONE-PENDING-VERIFICATION claim carry three-part evidence, and that the three parts are present before the claim counts: (1) WHAT CHANGED — file plus line plus a one-line description, specific enough that a reader sees the change in thirty seconds; (2) REAL COMMAND OUTPUT — the actual pasted text of grep -n / diff / wc -l / ls -la / the test run, not a verbal 'it is landed' or 'tests pass'; (3) WHAT IS NOT YET VERIFIED — the blind spots, edge cases, cross-file effects, and downstream dependencies, listed openly so the owner decides whether to verify or to accept the gap on the record.",
        "List the rejected states explicitly so false closure is blocked up front: e.g. exit code ignored, a test that passes without exercising the user-facing requirement, a claim broader than its evidence, scope that drifted past the stated non-goals.",
        "Hand the card back as the contract the work will be judged against, and name what still needs an owner decision (which gaps are acceptable, which must be closed before acceptance)."
      ],
      outputShape: [
        "Deliverables: the concrete artifacts, each one something a reviewer can open and inspect.",
        "Pass criteria: numbered, each mechanically checkable.",
        "Required checks: the exact command or manual step that proves each criterion.",
        "Three states in use: which claims are NOT DONE / DONE-PENDING-VERIFICATION / ACCEPTED right now.",
        "Required evidence per claim: the three-part block (what changed / real command output / what is not yet verified) demanded before any DONE-PENDING-VERIFICATION claim is trusted.",
        "Rejected states: the failure conditions that must never be silently accepted.",
        "Owner decision needed: which residual gaps need a human call before acceptance."
      ],
      passBar: [
        "Every pass criterion is checkable by a named command or a reproducible manual step, not by opinion.",
        "Each completion claim is tagged NOT DONE / DONE-PENDING-VERIFICATION / ACCEPTED, with no soft fourth state.",
        "Every DONE-PENDING-VERIFICATION claim has all three evidence parts, and part two is real pasted command output, not a verbal assurance.",
        "Rejected states are written down so false closure has an explicit tripwire.",
        "What stays unverified is named openly and left to the owner to accept or close, not buried."
      ],
      rejectBar: [
        "A criterion is a vibe ('looks clean', 'works well') that no command or reproducible step can test.",
        "A claim says 'done' / 'basically done' / 'should be fine' without a state tag, so the reviewer cannot tell proven from unproven.",
        "A DONE-PENDING-VERIFICATION claim rests on a verbal 'it landed' or 'tests pass' with no pasted output — exactly the gap where a fluent claim outruns the evidence.",
        "A test passes but does not exercise the actual user-facing requirement, and that is being counted as acceptance.",
        "Unverified areas are folded into 'done' instead of being listed for an owner decision."
      ],
      counterExample: "Synthetic: an assistant reports 'Done — added keyboard reordering to the task board and all tests pass.' Under this prompt the claim is tagged DONE-PENDING-VERIFICATION and the three-part evidence is demanded. Part two comes back empty: there is no pasted test output for a keyboard case, only the sentence 'tests pass'. Acceptance is withheld. When the real `grep -n moveTask` and test run are pasted, they show the keyboard handler only logs the key and never calls the reorder function and no keyboard test exists — so the verbal 'all tests pass' was a half-product claim the evidence never backed."
    }
  },
  {
    file: "guard-review.md",
    title: "Guard review",
    purpose: "Review an artifact against context, acceptance, evidence, and privacy boundaries.",
    scenario: "Use after a draft or implementation exists and before future work treats it as trusted.",
    inputRequirements: [
      "Artifact under review.",
      "Context package.",
      "Acceptance card.",
      "Verification evidence and known unverified areas."
    ],
    steps: [
      "Start with findings, not compliments.",
      "Tie each issue to a requirement, line, section, or command output.",
      "Separate blocker, high, medium, and residual risks.",
      "Return one of the four verdicts: pass, reject, insufficient_evidence, or pass_with_risk."
    ],
    outputFormat: [
      "Verdict",
      "Findings ordered by severity",
      "Evidence",
      "Required fixes",
      "Residual risk",
      "Pass or reject recommendation"
    ],
    failureModes: [
      "Rubber-stamping the same assistant's output.",
      "Reviewing tone while ignoring the acceptance card.",
      "Calling work complete without fresh verification evidence.",
      "Trusting the author's own 'I checked it' on counts, citations, or self-rule-compliance — exactly the claims a model is worst at self-judging.",
      "Reading a polished structure (headings, summary, confident prose) as proof the underlying thing actually runs."
    ],
    example: "Guard rejects a README that claims multi-tool integration when the code only writes adapter guidance files.",
    operativeCore: {
      trigger: "Use after a draft or implementation exists and before any future work treats it as trusted: a completion claim, a release candidate, a citation-heavy document, a 'done and tested' report, or any artifact whose wrong 'looks fine' would propagate into later work.",
      antiTrigger: "Skip the full review on low-stakes, easily reversible work, or a step the owner is about to fully re-run by hand: a one-line wording fix, a scratch draft, a trivial config tweak. A heavy guard pass on throwaway work is ceremony, and ceremony with no payoff trains people to skip review when it matters.",
      input: "The artifact under review, with stable line or section references so a finding can cite an exact spot. The acceptance card or definition of done it claims to meet. The context boundary (goal, scope, non-goals). The verification evidence the completion claim rests on (real command output, test results, a reproduced behavior) or a clear note that none exists. Which model family drafted it, so a same-family 'I reviewed my own work' is weighted as the weak signal it is.",
      process: [
        "Lead with findings, not compliments. The job is to find what is wrong before it propagates, not to reassure.",
        "Hunt for the five faces of a half-product — work that looks finished but is not — and for each, run its concrete tell. (1) DONE BUT NOT ACTUALLY DONE: the report says complete; demand the command plus real output and confirm it was actually run, not narrated. (2) PAPER EXISTS BUT THE FUNCTION DOES NOT: the file/hook/feature is present but never wired in; check that it is actually invoked and produces a real effect, not just that it exists on disk. (3) NUMBERS LOOK RIGHT BUT THE DENOMINATOR IS WRONG: a clean percentage or count; pin the exact scope and denominator and recompute, because pending and not-started items get quietly mixed in. (4) JUDGMENT THEATER: 'I judged it safe / I reviewed it'; require a named failure scenario actually tried, or an independent check — a verdict with no attempted break is decoration. (5) CITATION DRIFT: a real source is cited but misquoted, dropped a clause, or summarized into a different claim; open the source and compare the quoted span word-for-word, because drift looks more trustworthy than invention.",
        "Treat the author's own self-assessment as unreliable in seven specific zones and re-verify each independently rather than accepting 'I checked it': (1) counts — fields, lines, items, totals drift between two spots in the same artifact; (2) self-audit checklists with empty filler rows like 'expected N' or a bracketed blank but no actual result filled in; (3) self-audit table rows that describe a check in prose but never show the command that performs it; (4) 'tested' claims that state an expected value but no observed value; (5) attention on long documents — past a few hundred lines a self-check goes formal and misses things, so spot-check the tail, not just the top; (6) self-rule-compliance — 'I followed rule X strictly' is contradicted by at least one counter-instance often enough that it cannot be taken on faith; (7) running totals carried across sessions, which accumulate off-by-one drift. In all seven, the sentence 'I already verified this' is itself the thing not to trust.",
        "Tie every issue to a requirement, a line, a section, or a specific missing piece of evidence. A finding that cannot point at a spot is a vibe, not a finding.",
        "Sort findings into blocker / high / medium / residual, and state which are decision-changing.",
        "State the GUARD LEVEL — how strong the evidence you actually had was — because it caps the verdict you may give. L0: you saw only a completion summary. L1: the artifact and acceptance card exist but there is no real run/test output. L2: you have the author's commands or tests but you are a single tool / single model family. L3: there is a structured evidence pack AND a guard from a different model family pressed on it. L4: on top of that cross-family review (L3), you ALSO independently re-ran the key evidence and reconciled it to a recorded run — a rerun alone, single-family, stays L2.",
        "Return ONE of the four standard verdicts, bounded by the level — pass / reject / insufficient_evidence / pass_with_risk. The ceiling: L0 can only be insufficient_evidence; L1 cannot pass (best is reject or pass_with_risk); L2 (single tool) tops out at pass_with_risk; a plain pass needs L3+ (the cross-family pack); an L4 pass must cite BOTH the cross-family pack AND your reconciled rerun output. A pass_with_risk is NOT 'accepted' on your say-so — the owner must explicitly accept the named residual risk. For anything not fixed, name it as residual risk on the record. A reviewer never silently upgrades 'reads fine' into 'verified'."
      ],
      outputShape: [
        "Verdict: one of pass / reject / insufficient_evidence / pass_with_risk (with the single decisive reason).",
        "Guard level: L0 / L1 / L2 / L3 / L4 — the strength of the evidence you actually had, which bounds the verdict above.",
        "Findings ordered by severity, each tied to a line, section, requirement, or missing evidence.",
        "Half-product check: which of the five faces appeared, and the tell that exposed it.",
        "Self-assessment check: which of the seven unreliable zones were re-verified independently and what that re-check found.",
        "Evidence: the command output, citation comparison, or reproduction the verdict rests on (for an L4 pass, the cross-family pack AND your reconciled rerun output).",
        "Required fixes: the concrete change each blocker needs.",
        "Residual risk: what stays unverified and who must accept it (a pass_with_risk needs an explicit owner sign-off)."
      ],
      passBar: [
        "The verdict is within the guard level's ceiling: no plain pass below L3, no pass from a single tool, no L4 pass without BOTH a cross-family pack and a reconciled rerun, and L0 only ever yields insufficient_evidence.",
        "Every completion claim is backed by evidence the guard could actually point to, not by the author's assurance.",
        "None of the five half-product faces survives unexamined; any that appeared was caught with its concrete tell.",
        "Each of the seven self-assessment zones that applies was re-verified by the guard, not taken on the author's 'I checked it'.",
        "All acceptance criteria are met, or the unmet ones are named as accepted residual risk rather than hidden; any pass_with_risk has an explicit owner sign-off.",
        "No private material leaked and scope stayed inside the stated boundary."
      ],
      rejectBar: [
        "The verdict claims more than the guard level allows — a plain pass on summary-only or single-tool evidence, or an L4 pass with no cross-family pack or no reconciled rerun (the 'single tool dressed up as a binding pass' failure).",
        "A pass_with_risk is treated as accepted with no explicit owner sign-off on the residual risk.",
        "A completion claim asserts more than the evidence shows — the classic 'said it was done but it was not'.",
        "A file/feature is counted as working purely because it exists, with no proof it is wired in and produces an effect.",
        "A number or percentage is accepted without pinning its denominator, so not-started items are silently inflating it.",
        "A safety or correctness call is 'I judged it fine' with no failure scenario tried and no independent check.",
        "A citation is trusted without opening the source, and a word-for-word compare would have shown drift.",
        "The review leans on the author's self-audit in one of the seven unreliable zones instead of re-verifying it."
      ],
      counterExample: "Synthetic: an artifact ships with a confident summary, a self-audit table every row ticked, and the line 'I verified all 12 acceptance items pass.' A tone-only review would approve. Under this prompt: the self-audit rows describe checks but show no commands (zone 3), 'tested' rows give expected values but no observed ones (zone 4), and the count '12' is 11 when actually listed (zone 1). Re-verifying independently shows two items were never wired in (half-product face 2) and one cited source was summarized into a claim it never made (face 5). Because the guard only had the author's artifact and no real run, this is guard level L1 — which cannot pass anyway. Verdict: reject — the polished surface was hiding three unproven claims, which is exactly why the author's own 'I verified it' could not clear the gate."
    }
  },
  {
    file: "red-team-challenge.md",
    title: "Red-team challenge",
    purpose: "Attack a plan or artifact from the angle most likely to make it fail.",
    scenario: "Use before high-risk decisions, public release, data migration, force overwrite, or claims that could mislead users.",
    inputRequirements: [
      "Plan or artifact to challenge.",
      "What failure would be expensive, embarrassing, unsafe, or irreversible.",
      "Known assumptions and skipped checks."
    ],
    steps: [
      "Name the most damaging plausible failure first.",
      "Try to break the plan through user behavior, missing evidence, privacy leakage, and rollback gaps.",
      "Distinguish fatal flaws from acceptable tradeoffs.",
      "End with the smallest test or design change that would reduce risk."
    ],
    outputFormat: [
      "Worst plausible failure",
      "Attack paths",
      "Evidence gaps",
      "Required mitigations",
      "Acceptable residual risk"
    ],
    failureModes: [
      "Being theatrical instead of specific.",
      "Inventing impossible threats while missing mundane data-loss risks.",
      "Challenging the idea but not the exact acceptance criteria.",
      "Giving gentle suggestions ('consider adding a check') instead of demonstrating an actual break.",
      "Attacking only malicious outsiders while ignoring the ordinary user who clicks the wrong thing and the insider who takes a convenient shortcut."
    ],
    example: "For a --force option, the red team asks whether user-created files inside the target directory survive or are backed up.",
    operativeCore: {
      trigger: "Use before high-stakes, hard-to-reverse moves: a public release, a data migration, a force-overwrite or destructive flag, a security or auth change, a permissions or payment path, or any claim that could mislead users if it were wrong. Run it when you need to know how the thing breaks, not whether it is nice.",
      antiTrigger: "Skip it on low-stakes, easily reversible work, or where the worst case is trivial and self-correcting: a wording tweak, a scratch script, a change you can undo in one step with no data or trust at risk. A full attack pass on trivial work is theater, and theater with no payoff trains people to ignore the red team when the stakes are real.",
      input: "The plan or artifact to attack. What a failure would cost — money, data loss, a privacy leak, user harm, reputational damage, an irreversible state. The acceptance criteria it claims to meet. The assumptions the author is leaning on and the checks they admit they skipped. Who can touch it: end users, insiders, automated callers, a future maintainer who forgot the context.",
      process: [
        "Take the attacker's stance, not the helper's. Your job is to make the thing fail, get abused, or get bypassed — and to show it, not to politely suggest improvements. 'Consider adding validation' is not a red-team finding; 'here is the exact input that deletes the user's files' is.",
        "Name the single most damaging plausible failure first, in concrete terms (what is lost, who is harmed, can it be undone). Lead with the worst case so a reader feels the stakes before the details.",
        "Walk real abuse and bypass paths, not exotic ones: the ordinary user who clicks the destructive button by accident or misreads the prompt; the insider who takes the convenient shortcut around the safeguard; the automated or repeated call that hits an unhandled edge; the malformed or hostile input; the missing rollback when a step fails halfway; the privacy or secret that leaks through an error message, a log, or an example. Prefer the mundane data-loss path over the cinematic one.",
        "For each path, try to actually break it on the provided material and show the trigger — the exact input, sequence, or condition — and the resulting damage. If you cannot fully demonstrate it from what was given, say what specific evidence or test would confirm or kill the attack.",
        "Separate fatal flaws (must fix before this ships) from acceptable trade-offs (real but tolerable, named as residual risk). Do not inflate every nit into a blocker; that buries the one attack that actually matters.",
        "End with the smallest concrete change or test that closes the most dangerous path — the minimal mitigation, not a rewrite."
      ],
      outputShape: [
        "Worst plausible failure: the single most damaging realistic outcome, stated concretely.",
        "Attack paths: each with its trigger (exact input / sequence / condition) and the damage it causes.",
        "How it gets abused or bypassed: the accidental-user, insider-shortcut, and automated-edge angles, not just the malicious outsider.",
        "Evidence gaps: what could not be fully demonstrated and the exact test that would confirm or kill each attack.",
        "Fatal vs tolerable: which findings block shipping and which are named residual risk.",
        "Smallest mitigation: the minimal change or test that closes the most dangerous path."
      ],
      passBar: [
        "The worst-case failure is named first and in concrete, this-is-what-is-lost terms.",
        "At least one attack is shown with its actual trigger and damage, not phrased as a gentle suggestion.",
        "Accidental-misuse and insider-shortcut paths are covered, not only deliberate outsider attacks.",
        "Mundane data-loss and rollback gaps are checked, not skipped in favor of exotic threats.",
        "Findings are split into fatal vs tolerable, and each fatal one comes with the smallest mitigation that closes it."
      ],
      rejectBar: [
        "The output is theatrical or vague ('an attacker could do bad things') with no concrete trigger.",
        "It only offers polite improvements and never demonstrates or pins a real break.",
        "It invents impossible or exotic threats while missing the obvious data-loss, overwrite, or leak path.",
        "It challenges the idea in general but never tests the exact acceptance criteria or the destructive flag in question.",
        "Every finding is rated a blocker, so the one attack that actually matters is buried in nits."
      ],
      counterExample: "Synthetic: a CLI ships a `--force` flag that re-creates a workspace directory. A gentle review says 'consider warning the user before overwriting.' The red-team stance instead shows the break: run `init --force` in a directory where the user also keeps their own notes file, and the worst case is those user-created files are deleted with no backup and no undo. The trigger is concrete (force flag plus a non-empty target), the damage is irreversible data loss, the abuse path is the ordinary user who did not realize the directory was shared, and the smallest mitigation is to move the existing workspace to a timestamped backup before recreating it and to refuse on unexpected extra files — not a rewrite."
    }
  },
  {
    file: "handoff-generation.md",
    title: "Handoff generation",
    purpose: "Write a next-session state card with completed, pending, blocked, and unverified work.",
    scenario: "Use before stopping, changing tools, delegating, or compressing a long task into a resumable state.",
    inputRequirements: [
      "Current goal and status.",
      "Completed work and changed artifacts.",
      "Verification commands and outputs.",
      "Blockers, decisions, and the next action."
    ],
    steps: [
      "State the goal in one sentence.",
      "Separate done, pending, blocked, and unverified items.",
      "Record exact commands or checks already run.",
      "Give the next session one concrete first action."
    ],
    outputFormat: [
      "Goal",
      "Current status",
      "Completed",
      "Pending",
      "Blocked",
      "Verification evidence",
      "Next action"
    ],
    failureModes: [
      "Writing a story instead of a state transfer.",
      "Hiding failed checks in a summary.",
      "Leaving the next assistant to rediscover the first command.",
      "Presenting the option list as the whole world, so the receiver never asks what the author missed.",
      "Letting the receiver grab a tempting new item on round one and hijack the main line that was actually handed off."
    ],
    example: "Handoff says: tests pass, pack smoke not run, adapter installer added, next action is fresh temp install.",
    operativeCore: {
      trigger: "Use before work crosses a boundary: a session is ending, a different tool or model is taking over, a long task is being compressed into a resumable state, or you are delegating to someone who was not in the original context.",
      antiTrigger: "Skip the full packet when the same session simply continues, or for a trivial task with a single obvious next step and no state worth transferring. A formal handoff for a one-line continuation is overhead the receiver does not need.",
      input: "The goal in the author's words and the current status. The completed work and the artifacts that changed. The exact verification commands run and their real outputs (including the ones that failed). The blockers, the decisions already made, the sealed baseline (the exact point being handed off), and the author's best read of the next action. Crucially, an honest note of what the author may have left off the list.",
      process: [
        "State the goal in one sentence, then separate the work into done / pending / blocked / unverified. Do not narrate a story; transfer a state a stranger can act on.",
        "Record the exact commands or checks already run with their real outputs — including failures shown openly, never smoothed into a summary. A check claimed but not shown is treated as not run.",
        "Frame the option list honestly as a menu, not the whole map: it is the author's view of what comes next, and the author may have missed, misordered, or mis-scoped an item. Mark which options are well-grounded and which are guesses.",
        "Give the receiver an explicit first-round judgment to run before executing, not just a task to pick: (1) what is this next stint actually for — restate the main-line goal, the current sub-task, and the completion bar; (2) is the handed-off option list exhaustive — what did the author miss; (3) is there an unlisted item D or E, and if so does it serve the main line or hijack it? An option list you accept without questioning is an option list whose blind spots you inherit.",
        "Set the discipline for new items: a genuinely high-signal item that does NOT serve the current main line is recorded as a parked / after-closeout residual, not seized on round one. High signal is not the same as 'do it now'; the main line that was handed off keeps priority unless the owner re-points it.",
        "Give one concrete first action and the exact baseline to start from, so the receiver re-enters work cleanly instead of re-deriving the starting point or re-explaining the background."
      ],
      outputShape: [
        "Goal: one sentence.",
        "Current status: done / pending / blocked / unverified, kept separate.",
        "Verification evidence: the exact commands run and their real outputs, failures included.",
        "Option menu (not the map): the next-step options, each marked well-grounded or guess, with a note of what may be missing.",
        "Receiver's first-round check: the three questions to answer before executing (what is this for / is the list exhaustive / is there an unlisted D-or-E that serves vs hijacks the main line).",
        "Parked residuals: high-signal items that do not serve the current main line, recorded for later, not seized now.",
        "Next action: one concrete first step plus the exact baseline to start from."
      ],
      passBar: [
        "Done / pending / blocked / unverified are cleanly separated, with no failed check hidden inside a summary.",
        "Every verification claim shows its real command and output, so 'verified' means shown, not asserted.",
        "The option list is framed as the author's menu, not the whole map, with missing or guessed items flagged.",
        "The receiver is handed an explicit first-round judgment (what is this for / is the list exhaustive / is there a D or E) rather than just a task to pick.",
        "A single concrete next action and the exact starting baseline are stated, and off-main-line items are parked rather than promoted to round one."
      ],
      rejectBar: [
        "The handoff is a narrative of what happened instead of an actionable state transfer.",
        "A check is claimed ('tests pass') with no command or output shown, so the receiver must rediscover it.",
        "The option list is presented as the complete and only set of next steps, inviting the receiver to inherit the author's blind spots.",
        "A failed or skipped check is smoothed over rather than surfaced in the unverified column.",
        "A tempting new item is teed up as the immediate next action even though it does not serve the handed-off main line."
      ],
      counterExample: "Synthetic: a handoff lists options A/B/C for finishing a release and says 'next: do B'. The receiver runs the first-round check instead of grabbing B. Question two exposes that the author never listed reconciling a data-count mismatch — an unlisted item D — and question three judges that D actually blocks the release, so it serves the main line and is promoted; meanwhile a flashy idea E (add a new export format) is high-signal but off the main line, so it is parked as an after-closeout residual rather than hijacking round one. Treating the menu as the whole map would have shipped the release with the count bug the author had silently omitted."
    }
  },
  {
    file: "harvest-extraction.md",
    title: "Harvest extraction",
    purpose: "Extract reusable knowledge, prompt fragments, and rule candidates after a loop.",
    scenario: "Use after a task finishes, fails in an instructive way, or reveals a repeatable collaboration pattern.",
    inputRequirements: [
      "Final artifact and review result.",
      "What changed the outcome.",
      "Reusable snippets or rules.",
      "What should stay case-specific."
    ],
    steps: [
      "Extract only material likely to help a future task.",
      "Separate reusable knowledge, prompt fragments, decision records, and rule candidates.",
      "Mark what must not be generalized.",
      "Choose a storage target and next reuse moment."
    ],
    outputFormat: [
      "Source task",
      "Reusable knowledge",
      "Reusable prompts",
      "Decision record",
      "Rule candidates",
      "Do not generalize",
      "Storage target"
    ],
    failureModes: [
      "Harvesting everything and creating clutter.",
      "Turning one anecdote into a permanent rule.",
      "Saving private raw material instead of a synthetic lesson.",
      "Filing a card straight into the knowledge base without waiting for the human to confirm it.",
      "Interrogating the user for lessons when nothing this round was actually worth keeping."
    ],
    example: "From a failed release check, harvest the rule 'smoke test the packed package in a temp directory' but do not store the user's private repo path.",
    operativeCore: {
      trigger: "Use at the end of one loop or conversation: a task finished, failed in an instructive way, or revealed a repeatable collaboration pattern. The goal is to lift the reusable bit before it leaks away, while the context is still fresh.",
      antiTrigger: "Skip it when nothing reusable happened: a routine answer, a trivial fix, a conversation that taught nothing a future task would want. Do not manufacture a 'lesson' to justify running the step — an invented rule is worse than no rule, because future loops will obey it. If the person had nothing they wanted to keep, stop; do not interrogate them for one.",
      input: "The finished loop or conversation. The final artifact and the review result. What actually changed the outcome (the decision, the mistake, the move that worked). Any reusable snippet, prompt fragment, or candidate rule. And what should stay specific to this case and never be generalized.",
      process: [
        "First ask whether anything here is worth keeping at all. If the honest answer is no, say so and stop — restraint is part of the method, not a failure of it. If the person was asked 'anything you want to keep?' and said no, do not push.",
        "Extract one item per card, each card a single kind of thing — a DECISION (a choice future work should not silently reopen), a LESSON (a mistake and the rule that prevents it), a METHOD (a reusable move or prompt fragment), or a PREFERENCE (a stable way of working). Do not blend a decision, a lesson, and a method into one mushy entry; one card, one thing, so each can be trusted, found, and revisited on its own.",
        "Redact as you extract, not as an afterthought: rewrite every real name, client, path, number, and raw quote into a general, public-safe form before the card is even proposed. The card must carry the lesson, never the private original. Privacy is built into the extraction step, not bolted on later.",
        "Resist generalizing a single incident into a permanent rule. A one-off needs either repeated evidence or an explicit human sign-off before it becomes standing doctrine; otherwise mark it as a candidate, not a rule.",
        "For a DECISION or a LESSON, record its current state honestly — still open, recorded-but-unresolved, resolved, or superseded — so a stale card is not mistaken for live truth.",
        "Present every card as a candidate awaiting confirmation, with a proposed storage target and the next moment it would be reused. Nothing lands in the knowledge base until the human confirms it: the harvester stages, the human files."
      ],
      outputShape: [
        "Source: which loop or conversation this came from (public-safe).",
        "Cards: one item per card, each typed DECISION / LESSON / METHOD / PREFERENCE — never blended.",
        "Redacted form: each card already rewritten public-safe, with no private name, path, number, or raw quote.",
        "State (for decisions and lessons): open / recorded-unresolved / resolved / superseded.",
        "Candidate vs rule: whether each item is a confirmed rule or a candidate still needing evidence or sign-off.",
        "Do not generalize: what must stay case-specific.",
        "Storage target and next reuse: where each card would live and when it would next be used — all pending human confirmation."
      ],
      passBar: [
        "Each card carries exactly one kind of thing (decision / lesson / method / preference), not a blend.",
        "Every card is already redacted public-safe at the moment it is proposed, carrying the lesson and not the private original.",
        "No single incident has been promoted to a permanent rule without repeated evidence or explicit sign-off.",
        "Decision and lesson cards show an honest current state, so nothing stale reads as live truth.",
        "All cards are staged as candidates for human confirmation; none has been filed into the knowledge base unilaterally."
      ],
      rejectBar: [
        "Everything got harvested, producing clutter instead of the few items that actually matter.",
        "A card blends a decision, a lesson, and a method together, so none of them can be trusted or revisited cleanly.",
        "A private name, path, number, or raw quote survives in a card instead of a synthetic rewrite.",
        "A one-off anecdote was turned into a standing rule with no repeated evidence and no sign-off.",
        "A card was filed straight into the knowledge base without the human confirming it, or the user was interrogated for a lesson after saying there was nothing to keep."
      ],
      counterExample: "Synthetic: a release check fails because a packaged build was never smoke-tested. The wrong harvest writes one fat entry mixing the decision, the lesson, and the user's real repo path, then files it automatically. The disciplined harvest stages two separate public-safe candidate cards — a LESSON ('smoke-test the packed package in a throwaway temp directory before claiming a release is ready', state: resolved) and a METHOD (the exact temp-install command, with the private path rewritten to a generic stand-in) — keeps the private repo path out entirely, and waits for the human to confirm before anything lands. And if that same session had ended with nothing instructive, the right move would have been to say 'nothing worth keeping this round' rather than inventing a rule."
    }
  },
  {
    file: "mode-switching.md",
    title: "Mode switching",
    purpose: "Switch an assistant between execution, review, planning, and reflection without losing boundaries.",
    scenario: "Use when a conversation changes from brainstorming to implementation, from execution to review, or from review to handoff.",
    inputRequirements: [
      "Current mode and requested new mode.",
      "Authority boundary: who may write, review, or decide.",
      "Current goal, acceptance card, and stop conditions."
    ],
    steps: [
      "Confirm the old mode and new mode in plain language.",
      "Carry forward only the context needed for the new mode.",
      "Restate what actions are allowed and forbidden.",
      "Name the first output expected in the new mode."
    ],
    outputFormat: [
      "Mode change",
      "Allowed actions",
      "Forbidden actions",
      "Context carried forward",
      "First output"
    ],
    failureModes: [
      "Continuing to execute while pretending to review.",
      "Losing authorization boundaries after a role switch.",
      "Dragging irrelevant old context into a focused task."
    ],
    example: "Switch from execution to guard review: stop editing, inspect the changed files, compare against acceptance, and report findings first."
  },
  {
    file: "workflow-reset.md",
    title: "Workflow reset",
    purpose: "Recover from drift by restating goal, state, acceptance, and next action.",
    scenario: "Use when a thread has become confusing, has nested sub-tasks, or the assistant can no longer explain why the current step serves the main goal.",
    inputRequirements: [
      "Original goal or latest confirmed goal.",
      "What has been done.",
      "Where the thread drifted.",
      "Known blockers and verification state."
    ],
    steps: [
      "Stop adding new work.",
      "Name the main goal and current sub-task.",
      "List done, pending, blocked, and unverified items.",
      "Choose whether to close the sub-task or return to the main line."
    ],
    outputFormat: [
      "Main goal",
      "Current sub-task",
      "Drift point",
      "State table",
      "Recommended next action"
    ],
    failureModes: [
      "Treating reset as a new brainstorm.",
      "Continuing the most recent tangent because it is easier.",
      "Claiming closure while verification is missing.",
      "Restating the goal but carrying forward the pre-drift numbers and assumptions as if they were still true.",
      "Producing a tidy reset card with no single concrete next action and no exact baseline to resume from."
    ],
    example: "Reset a release thread after debugging npm cache issues: mark cache as environment-specific, return to package smoke test with a temp cache.",
    operativeCore: {
      trigger: "Use when a thread has drifted: it has nested into sub-tasks, chased a tangent, run long enough that state is fuzzy, or reached the point where the assistant can no longer explain why the current step serves the main goal. Reset before doing more work, not after producing more output on a shaky base.",
      antiTrigger: "Skip the formal reset on a short, on-track thread with one clear goal and a state you can hold in your head. Running a full four-part reset on a task that never drifted is ceremony, and ceremony with no payoff trains people to ignore the reset when the thread has genuinely lost its thread.",
      input: "The original goal, or the latest goal the owner actually confirmed. What has been done so far and what was claimed about it. Where the thread drifted — the point it stopped serving the main goal. The known blockers and the current verification state, including which 'done' claims have real evidence and which are only asserted.",
      process: [
        "Stop adding new work. A reset is a re-grounding, not a fresh brainstorm; resist the pull to fix one more thing before you know where you stand.",
        "Restate the four components explicitly, in order: GOAL (the main line in one sentence), CURRENT STATE (where things actually are now), ACCEPTANCE (what 'done' means for the main line), NEXT ACTION (the single concrete first step). All four are required — a reset missing any one of them leaves the thread still adrift.",
        "Re-measure the current state instead of trusting the pre-drift picture. The numbers, counts, file states, and 'it already works' assumptions from before the drift are exactly what may have gone stale; re-run the cheap deterministic check (count it, list it, open it, reproduce it) rather than carrying a remembered value forward. A figure quoted from earlier in the thread is treated as 'pre-drift, unverified' until re-measured.",
        "Separate the work honestly into done / pending / blocked / unverified, and never let a claimed-but-unproven item sit in 'done'. A check claimed without evidence is unverified, not complete.",
        "Decide whether to close the current sub-task or return to the main line, judged by what serves the goal — not by which tangent is easiest to keep pushing. A genuinely useful side-finding that does not serve the main line is parked as a residual, not pursued now.",
        "State one concrete next action and the exact baseline to resume from (the precise point, file, or command to start at), so work re-enters cleanly instead of re-deriving the starting point."
      ],
      outputShape: [
        "Goal: the main line in one sentence.",
        "Current state (re-measured): where things actually are now, with the cheap check that re-confirmed it, and any figure still carried from before the drift flagged as unverified.",
        "Acceptance: what 'done' means for the main line.",
        "Drift point: where and why the thread stopped serving the goal.",
        "State table: done / pending / blocked / unverified, kept separate, with no unproven item parked in done.",
        "Decision: close the sub-task or return to the main line, with the reason it serves the goal.",
        "Parked residuals: useful side-findings that do not serve the main line, recorded for later rather than chased now.",
        "Next action: one concrete first step plus the exact baseline to resume from."
      ],
      passBar: [
        "All four components — goal, current state, acceptance, next action — are restated explicitly, none left implicit.",
        "The current state was re-measured with a real check, and any number carried from before the drift is labeled unverified rather than reused as truth.",
        "Done / pending / blocked / unverified are cleanly separated, with no claimed-but-unproven item sitting in done.",
        "The close-or-return decision is justified by what serves the main goal, not by which tangent is easiest to continue.",
        "There is exactly one concrete next action and an exact baseline to resume from, so a cold restart is unnecessary."
      ],
      rejectBar: [
        "The reset turns into a new brainstorm that adds scope instead of re-grounding the existing goal.",
        "The goal is restated but pre-drift numbers or 'it already works' assumptions are carried forward without re-measuring — the classic stale-baseline trap.",
        "A claimed-but-unproven item is filed under done, so the state table reads cleaner than the work actually is.",
        "The thread returns to the most recent tangent because it is easiest, even though it does not serve the main line.",
        "The card ends with no single concrete next action, or with no exact baseline, so the next session must re-derive where to start."
      ],
      counterExample: "Synthetic: a release thread drifts into debugging a package-install cache error. The lazy reset writes 'goal: ship the release; we already smoke-tested the build earlier, so next just publish.' But re-measuring the current state shows the earlier smoke test ran against an old build that predates the cache fix — the carried-forward 'already tested' was a pre-drift assumption, now stale. The disciplined reset re-runs the smoke test in a clean temp directory (re-measure, not remember), marks the cache error as an environment-specific residual that does not block the main line, files 'release smoke test' as unverified rather than done, and sets one concrete next action with an exact baseline: run the packaged build's smoke test against the post-fix build before publishing. Trusting the pre-drift 'already tested' would have shipped a release that was never actually verified."
    }
  },
  {
    file: "rule-update-proposal.md",
    title: "Rule update proposal",
    purpose: "Suggest a new rule from repeated evidence without silently changing the system.",
    scenario: "Use when the same failure appears across tasks and may deserve a reusable rule, checklist item, or template change.",
    inputRequirements: [
      "Observed failures or repeated friction.",
      "Evidence count and examples.",
      "Proposed rule text.",
      "Scope, exceptions, and rollback condition."
    ],
    steps: [
      "Prove the pattern is repeated, not one-off.",
      "State the rule in operational language.",
      "Define where it applies and where it does not.",
      "Ask for approval before changing shared rules."
    ],
    outputFormat: [
      "Problem pattern",
      "Evidence",
      "Proposed rule",
      "Scope",
      "Exceptions",
      "Review owner",
      "Rollback condition"
    ],
    failureModes: [
      "Creating governance bloat from one incident.",
      "Silently changing shared behavior without approval.",
      "Writing a rule so vague that it cannot be checked.",
      "Proposing an addition without naming what it replaces, retires, or demotes, so the rule set only ever grows.",
      "Cutting a harmless, dormant rule purely to look lean, with no check on what capability is lost or how to roll back."
    ],
    example: "After three release tasks missed packed-package smoke tests, propose a release checklist item requiring temp install before candidate labeling.",
    operativeCore: {
      trigger: "Use when the same failure or friction has shown up across multiple tasks and may deserve a standing rule, checklist item, or template change — or when you are weighing whether to add, merge, demote, or retire a rule. The unit of justification is a repeated pattern, not a single bad moment.",
      antiTrigger: "Do not run this to mint a rule from one incident, and do not invent a rule just to feel productive — an unjustified standing rule is worse than none, because every future task then has to obey it and read past it. Skip it for a one-off slip with an obvious local fix, or a throwaway preference that will not recur. If the only evidence is a single anecdote, the honest output is 'not yet a rule; watch for recurrence', not a new line in the rulebook.",
      input: "The observed failures or friction, with how many distinct times each occurred and a concrete example of each — enough to show a pattern, not one story. The exact rule text being proposed, in operational language. Where it would apply and where it must not. Which existing rule it would replace, demote, or make redundant. The cost of carrying it (added reading, added ceremony, conflict with other rules). And who can approve a change to shared behavior.",
      process: [
        "Prove the pattern is repeated before proposing anything. State the distinct instances and their dates or contexts; if you have only one, stop and label it a watch-item, not a rule. One anecdote does not earn standing doctrine.",
        "Write the rule in operational, checkable language — a reader must be able to tell whether it was followed. 'Be more careful with releases' is uncheckable; 'before labeling a release candidate, install the packed package in a clean temp directory and confirm it runs' is.",
        "Answer the lifecycle question that every addition must carry: what does this rule REPLACE, RETIRE, or DEMOTE? A rule that adds to the set without removing or superseding anything is bloat until proven otherwise. If it truly adds net-new coverage, say what it is net-new over and why nothing existing covers it.",
        "Specify the full lifecycle in five fields, not just the trigger: (1) TRIGGER — when the rule is read or applied; (2) REPLACES — the rule it supersedes, demotes, or makes redundant; (3) ACCEPTANCE — what observable evidence would show it is actually helping; (4) ARCHIVE CONDITION — how long unused or how much drift before it is demoted or retired; (5) REVIEW WINDOW — when its keep/cut decision gets revisited. A rule with no archive condition and no review window is a rule that can only accumulate.",
        "Judge the proposal on net benefit, not on the act of adding or cutting. The test is (expected benefit minus carrying cost and risk), and you only adopt the clearly-positive, low-downside cases; when the benefit is uncertain, do not add it. Equally, do not cut for the sake of looking lean — a dormant rule with no harm can stay; removing a negative is the only subtraction that is automatically worth it.",
        "Before proposing any removal or merge, answer the three subtraction questions: (1) does any main-line capability drop if this goes; (2) is the path to bring it back clear; (3) how is a wrong cut rolled back? If those are not answered, the cut is not ready.",
        "Present it as a proposal for sign-off, never a silent change to shared behavior. Name the approver and the rollback condition; staging waits for a human to file it."
      ],
      outputShape: [
        "Problem pattern: the repeated failure, stated once.",
        "Evidence: the distinct instances with dates or contexts — enough to show repetition, not a single anecdote.",
        "Proposed rule: operational, checkable text.",
        "Replaces / retires / demotes: what existing rule this supersedes, or an explicit argument for why it is net-new.",
        "Lifecycle fields: trigger / replaces / acceptance / archive condition / review window.",
        "Net-benefit call: expected benefit versus carrying cost and risk, and why it is clearly positive (or why it should wait).",
        "Subtraction check (for any removal or merge): capability-loss / recovery-path / rollback answered.",
        "Scope and exceptions: where it applies and where it must not.",
        "Review owner and rollback condition: who approves and how a wrong call is undone."
      ],
      passBar: [
        "The pattern is shown as repeated across distinct instances, not generalized from one incident.",
        "The rule is written so a reader can mechanically tell whether it was followed.",
        "The proposal names what it replaces, retires, or demotes — or argues explicitly why it is net-new — so the rule set is not just growing.",
        "All five lifecycle fields are present, including an archive condition and a review window, so the rule can later be cut, not only kept.",
        "The decision rests on net benefit, and any removal answers the capability-loss / recovery-path / rollback questions rather than cutting to look lean."
      ],
      rejectBar: [
        "A standing rule is proposed from a single anecdote with no evidence of recurrence.",
        "The rule text is a vibe ('be more careful', 'handle releases better') that no one can check compliance against.",
        "The addition names nothing it replaces, retires, or demotes, and makes no case for being net-new — pure accumulation.",
        "Lifecycle fields are missing, especially the archive condition and review window, so the rule can only ever be added and never retired.",
        "A removal or merge is proposed without answering whether a main-line capability drops, how to recover it, or how to roll back a wrong cut — or a harmless dormant rule is cut purely for tidiness."
      ],
      counterExample: "Synthetic: an assistant proposes a brand-new governance rule after one release slipped, adds it to the rulebook, and names nothing it supersedes. Reviewed under this prompt, two faults surface. First, the lifecycle question is unanswered — the rule replaces, retires, and demotes nothing, so it is pure accumulation; and it carries no archive condition or review window, meaning it can only ever be added to the pile. Second, the evidence is a single incident, below the repeated-pattern bar, so the honest output is a watch-item, not doctrine. A revealing real-world tell of this failure mode: a cleanup round that set out to 'add a subtraction metric' ended up adding several new items and removing zero — proof that knowing you should subtract is not the same as the system actually subtracting. The disciplined proposal waits for a second and third recurrence, writes the rule as a checkable temp-install step, states that it replaces an older vaguer 'test before release' note, and attaches an archive condition and a named approver before anything lands."
    }
  }
];

export const skillDefinitions = [
  {
    id: "profile",
    purpose: "Build and maintain collaboration profiles.",
    when: "Use before recurring or high-context work where the assistant's tone, autonomy, challenge style, and safety boundaries affect the result.",
    process: [
      "Extract reusable collaboration preferences from redacted material.",
      "Separate stable preferences from task facts.",
      "Mark inferred preferences as provisional until confirmed.",
      "Return a compact profile card that future sessions can apply."
    ],
    output: [
      "Working style",
      "Decision preferences",
      "Hard boundaries",
      "Challenge and review preferences",
      "Update rule"
    ],
    safety: [
      "Do not store secrets, client names, local paths, account details, or raw private conversations.",
      "Do not infer identity traits that the user did not provide.",
      "Do not turn a temporary mood into a permanent rule."
    ],
    example: "Create a profile that says: direct risk calls, no publishing without consent, ask before irreversible actions. Include a short evidence note for every stable preference: 'seen in repeated release work' is acceptable, while 'user sounded impatient once' stays provisional. The profile should help the next assistant choose autonomy level, response length, challenge style, and consent boundaries without copying private task history."
  },
  {
    id: "context",
    purpose: "Package task context for another AI session.",
    when: "Use at the beginning of multi-step work, cross-tool work, reviews, or any task that may be resumed later.",
    process: [
      "State the goal and non-goals.",
      "List artifacts and evidence the next assistant should inspect.",
      "Split facts, assumptions, decisions, risks, and open questions.",
      "End with a single next action."
    ],
    output: [
      "Goal",
      "Current state",
      "Relevant artifacts",
      "Constraints and non-goals",
      "Facts versus assumptions",
      "Risks and open questions",
      "Next action"
    ],
    safety: [
      "Summarize private material instead of copying it.",
      "Do not include real local paths in public examples.",
      "Do not hide uncertainty inside fluent narrative."
    ],
    example: "Package a messy release task into current version, failing checks, changed files, and the next verification command."
  },
  {
    id: "acceptance",
    purpose: "Define pass criteria and verification evidence.",
    when: "Use before any implementation, writing, research, or cleanup task where completion could otherwise be subjective.",
    process: [
      "Convert the goal into deliverables.",
      "Define pass criteria a reviewer can inspect.",
      "Name rejected states explicitly.",
      "Attach the exact command or manual check required before completion."
    ],
    output: [
      "Deliverables",
      "Pass criteria",
      "Required checks",
      "Rejected states",
      "Evidence needed",
      "Decision needed"
    ],
    safety: [
      "Do not accept unverified claims.",
      "Do not let passing tests substitute for missing user-path validation.",
      "Do not move acceptance after implementation."
    ],
    example: "For a first-run CLI, acceptance includes real bin command, no fallback target, clear errors, and temp install smoke."
  },
  {
    id: "guard",
    purpose: "Challenge artifacts before trust, and grade how strong the evidence actually was.",
    when: "Use after a plan, draft, implementation, or research answer exists and before it becomes the basis for the next step.",
    process: [
      "Read the context and acceptance card first.",
      "Inspect the artifact for missing evidence, privacy leaks, scope drift, and unsupported claims.",
      "Lead with findings ordered by severity.",
      "State the evidence level you actually saw (L0 summary only / L1 artifact but no real run / L2 author-supplied commands or tests, single tool / L3 structured evidence pack reviewed by a different model family / L4 that cross-family review AND you independently re-ran and reconciled the key evidence).",
      "Return one of the four standard verdicts, bounded by that level: pass / reject / insufficient_evidence / pass_with_risk. A plain pass needs L3+ (the cross-family pack); a single tool tops out at pass_with_risk (L2); summary-only is insufficient_evidence (L0); an L4 pass must show a cross-family review AND your reconciled rerun output."
    ],
    output: [
      "Verdict (pass / reject / insufficient_evidence / pass_with_risk)",
      "Guard level (L0-L4) for the evidence you saw",
      "Findings",
      "Evidence",
      "Required fixes",
      "Residual risk"
    ],
    safety: [
      "Do not rubber-stamp your own work.",
      "Do not review only style.",
      "Do not call work complete without fresh verification.",
      "Do not return pass above your evidence level: no pass without an L3+ cross-family pack, no pass from a single tool, no L4 pass without BOTH a cross-family pack and a reconciled rerun.",
      "Do not treat a pass_with_risk as accepted on your own — it needs an explicit owner sign-off."
    ],
    example: "Reject a case study that lacks baseline output because users cannot see why the structured loop is better than raw chat; record it as guard level L1 (artifact exists, no real run)."
  },
  {
    id: "evidence-pack",
    purpose: "Assemble a structured evidence pack so a completion claim can be checked, not trusted.",
    when: "Use the moment you are about to say done, tested, fixed, or shipped, before a reviewer or the next session inherits the claim.",
    process: [
      "List every changed file and what changed in each, so the diff surface is explicit.",
      "Record the exact command you ran, its captured output, and its exit code; mark anything you did not actually run.",
      "Name the unverified items: edges you skipped, paths you did not exercise, and assumptions still standing.",
      "Append each piece with `ai-collab evidence add` (kind diff / output / file / rerun) so the proof lives in the ledger, then point the receipt at those rows."
    ],
    output: [
      "Changed files with per-file intent",
      "Command, captured output, and exit code",
      "Reproduction steps a reviewer can rerun",
      "Unverified items and standing assumptions",
      "Ledger evidence ids the receipt cites"
    ],
    safety: [
      "Do not write a summary in place of the real command output and exit code.",
      "Do not label a claim verified when the run did not happen; record it as unverified instead.",
      "Do not paste private paths, tokens, or raw transcripts into an evidence row."
    ],
    example: "Before claiming a parser fix is done, attach the changed file, the test command with its exit 0 output, and an unverified note that the empty-input branch was never exercised; add each as an evidence row and cite their ids on the receipt."
  },
  {
    id: "single-tool-guard",
    purpose: "Run the minimum guard when only one model family is available, with the ceiling named on the record.",
    when: "Use at a completion claim when no second, different model family exists to run the cross-family binding gate, and you would otherwise trust the same assistant that just wrote the work.",
    process: [
      "Open a brand new conversation rather than reusing the drafting thread, whose eagerness to please suppresses objections.",
      "Paste an adversarial prompt that defaults to refuting and hunts for missing evidence, tying each finding to a line or section.",
      "Bound the verdict at the single-tool ceiling: this tops out at L2 / pass_with_risk and may never be filed as a passed cross-family gate.",
      "Name the residual risk a same-family reviewer most likely shares, and leave the upgrade note to run one cross-family pass once a second family appears."
    ],
    output: [
      "Verdict bounded at pass_with_risk (never a plain pass)",
      "Findings tied to specific lines or sections",
      "Residual risk a same-family reviewer would share",
      "Owner sign-off required before pass_with_risk counts as accepted",
      "Upgrade note: cross-family pass still owed"
    ],
    safety: [
      "Do not record a single-family review as if the cross-family binding gate cleared it.",
      "Do not let pass_with_risk count as accepted without an explicit owner sign-off on the named risk.",
      "Do not reuse the thread that just claimed done, and do not leave the residual risk blank."
    ],
    example: "With only one tool available, a fresh adversarial pass downgrades a done claim to pass_with_risk, names the CSV-escaping blind spot a same-family reviewer would share, and leaves an upgrade note to run a cross-family pass later."
  },
  {
    id: "handoff",
    purpose: "Resume work across sessions and tools.",
    when: "Use before stopping, delegating, switching AI tools, or compressing a long task into a state another session can continue.",
    process: [
      "Restate the goal.",
      "Separate done, pending, blocked, and unverified work.",
      "List changed artifacts and verification commands.",
      "Give one concrete next action."
    ],
    output: [
      "Goal",
      "Current status",
      "Completed",
      "Pending",
      "Blocked",
      "Verification evidence",
      "Next action"
    ],
    safety: [
      "Do not bury blockers in prose.",
      "Do not claim verification that did not run.",
      "Do not include private raw transcript unless explicitly safe."
    ],
    example: "Hand off a release candidate with test results, pack output, remaining smoke commands, and known documentation risks."
  },
  {
    id: "harvest",
    purpose: "Extract reusable knowledge from finished loops.",
    when: "Use after a task finishes or fails in a way that teaches a reusable workflow pattern.",
    process: [
      "Identify what changed the outcome.",
      "Separate reusable knowledge, prompt fragments, decisions, and rule candidates.",
      "Mark material that must stay case-specific.",
      "Choose a storage target and future reuse trigger."
    ],
    output: [
      "Source task",
      "Reusable knowledge",
      "Reusable prompts",
      "Decision record",
      "Rule candidates",
      "Do not generalize",
      "Next reuse"
    ],
    safety: [
      "Do not harvest private source material.",
      "Do not create a universal rule from one example.",
      "Do not keep clutter that has no future use."
    ],
    example: "Harvest the lesson that force overwrite needs backup evidence, while excluding the user's actual workspace path."
  },
  {
    id: "red-team",
    purpose: "Find the failure path before shipping an idea.",
    when: "Use for public releases, irreversible operations, broad claims, security-sensitive behavior, or expensive direction choices.",
    process: [
      "Name the most damaging plausible failure.",
      "Attack assumptions through user behavior, safety, evidence, and rollback.",
      "Separate blockers from tolerable risk.",
      "Recommend the smallest mitigation or test."
    ],
    output: [
      "Worst plausible failure",
      "Attack paths",
      "Evidence gaps",
      "Mitigations",
      "Residual risk"
    ],
    safety: [
      "Do not invent dramatic but irrelevant threats.",
      "Do not skip mundane data-loss or privacy failures.",
      "Do not treat red-team output as owner approval."
    ],
    example: "Before publishing, challenge whether README claims 'integration' when adapters are only guidance files."
  },
  {
    id: "mode-switch",
    purpose: "Change collaboration mode with explicit boundaries.",
    when: "Use when moving between planning, execution, review, handoff, harvest, or casual exploration in the same workflow.",
    process: [
      "Name the current mode and requested new mode.",
      "Carry forward only relevant context.",
      "State allowed and forbidden actions.",
      "Define the first expected output in the new mode."
    ],
    output: [
      "Mode change",
      "Allowed actions",
      "Forbidden actions",
      "Context carried forward",
      "First output"
    ],
    safety: [
      "Do not keep executing after switching to review.",
      "Do not assume old authorization survives a reset.",
      "Do not mix formal guard output with implementation output."
    ],
    example: "Switch from implementation to guard: stop editing, inspect diff, compare against acceptance, then report findings."
  }
];

export const adapterDefinitions = [
  ["claude-code", "Claude Code", "Use CLAUDE.md or project instructions to point Claude Code at the shared workspace contract."],
  ["codex", "Codex", "Use AGENTS.md or repository instructions to point Codex at the shared workspace contract."],
  ["cursor", "Cursor", "Use Cursor rules to load the shared workspace contract and task files."],
  ["windsurf", "Windsurf", "Use Windsurf rules to keep the same six-layer workflow available."],
  ["copilot", "GitHub Copilot", "Use repository instructions and prompt files to apply the shared workflow."],
  ["cline", "Cline", "Use Cline custom instructions plus local files for the same loop."]
].map(([id, name, note]) => ({ id, name, note }));

export const caseDefinitions = [
  {
    id: "ai-coding-long-task",
    title: "AI coding long task",
    flagship: true,
    messy: "A developer asks an assistant to refactor a small task board, then keeps adding bugs, design requests, accessibility requests, and test fixes across multiple sessions. Each new chat forgets which tradeoffs were rejected, whether keyboard movement is required, and which visual polish is out of scope.",
    setup: "Create the workspace, fill context with the task board boundary, define acceptance around behavior and tests, execute only the reorder slice, challenge the result with guard review, then hand off the exact remaining work.",
    profileContext: "Profile: prefers direct bug risk calls, small verified steps, and no silent scope expansion. Context: synthetic task board, local-only, no auth, no deployment, existing task data must survive, keyboard accessibility matters, visual redesign is not in scope.",
    acceptance: "Done means the board preserves existing task data, supports drag and keyboard reorder, has tests for both flows, reports changed files and verification output, and leaves a handoff note listing visual polish as unverified rather than done.",
    executionPrompt: "Implement only the reorder behavior described in the acceptance card. Keep the existing data shape. Do not redesign the board. After code, report changed files, tests run, failures, and unverified areas.",
    guardReview: "Guard finds that mouse reorder was tested but keyboard movement lacks evidence. It rejects completion until a keyboard reorder test exists and the handoff labels visual polish as unverified.",
    handoff: "Current state: mouse drag and keyboard arrow-key reorder are both implemented and covered by tests (2 passing), and the guard re-review accepted the fix. Completed: data shape preserved; keyboard reorder implemented and tested. Pending: only visual polish for the reorder affordance, carried as unverified. Next action: pick up the visual polish, not the keyboard work.",
    harvest: "Reusable pattern: long coding tasks need an acceptance card before implementation, a guard pass before handoff, and an explicit unverified bucket for visual polish. Do not generalize the synthetic task board data model.",
    comparison: "A raw chat produces a plausible refactor plan but loses rejected scope and unverified accessibility work. The six-layer workspace keeps the goal, done standard, review finding, next action, and reusable lesson visible.",
    rawInput: `I have this little task board. It started as a quick demo but now I need it cleaned up. Can you refactor it, make drag-and-drop nicer, maybe add keyboard movement too, and make sure the cards look more modern? Last chat already changed some things but I don't remember what. Tests are flaky. I don't want a huge rewrite, but also don't leave it half broken. If you need to change the data shape, do it, unless that is risky. Also make it accessible.`,
    baselineOutput: `A normal raw AI answer tends to say: "Sure. I will refactor the board, improve drag and drop, add keyboard support, modernize the UI, and update tests." It sounds helpful, but it mixes behavior, design, data migration, and accessibility into one blob. It does not define what must pass, what is out of scope, or how the next session should continue if only half the work is verified.`,
    systemRun: [
      "Profile sets collaboration defaults: small verified steps, direct risk calls, and no silent rewrite.",
      "Context narrows the current slice to reorder behavior in a synthetic local task board.",
      "Acceptance defines pass criteria before code: data preserved, drag reorder tested, keyboard reorder tested, changed files and verification reported.",
      "Execution prompt tells the AI to implement only reorder behavior and not redesign the board.",
      "Guard review catches the missing keyboard test and blocks the completion claim.",
      "Handoff records mouse and keyboard reorder done and tested with the guard's accepted fix, leaving only visual polish unverified.",
      "Harvest saves the reusable release pattern: keep an unverified bucket instead of pretending polish is done."
    ],
    artifacts: {
      profile: "Profile artifact: direct risk calls; prefer small tested changes; no data-shape migration unless acceptance explicitly allows it; label unverified visual polish.",
      context: "Context artifact: synthetic task board; local-only; no auth or deployment; current slice is reorder behavior; design refresh is a non-goal for this loop.",
      acceptance: "Acceptance artifact: drag reorder and keyboard reorder both need tests; existing task data must survive; completion requires verification output.",
      guard: "Guard artifact: reject completion because keyboard movement lacks evidence; require a failing-then-passing keyboard reorder test.",
      handoff: "Handoff artifact: mouse drag and keyboard arrow-key reorder are both implemented and covered by tests (2 passing); the guard re-review accepted the fix; only visual polish for the reorder affordance remains unverified. Next action: pick up the visual polish, not the keyboard work.",
      harvest: "Harvest artifact: long coding tasks need acceptance before implementation and guard before handoff; do not generalize this board's data model."
    },
    nextStep: "Copy and run the context package, acceptance card, and execution prompt into your AI tool. After the first answer, paste the guard-review prompt and require it to check the keyboard criterion before accepting the work.",
    acceptanceCard: {
      title: "Reorder acceptance card",
      summary: "Done means TaskBoard can reorder tasks two ways, both proven by tests, with existing task data preserved.",
      criteria: [
        "AC1 Mouse: a pointer drag reorders a task and the new order is saved to the tasks array.",
        "AC2 Keyboard: focusing a task and pressing ArrowUp or ArrowDown moves that task one slot, for accessibility (keyboard-only users must reach the same outcome as mouse users).",
        "AC3 Tests: both the mouse path and the keyboard path have an automated test that fails before the feature and passes after.",
        "AC4 Data: existing task ids, titles, and fields survive the reorder; no data-shape migration in this slice.",
        "AC5 Scope: visual redesign is out of scope and must be reported as unverified, not done."
      ],
      rejectIf: "Reject if any acceptance criterion lacks evidence, or if the completion claim states more than the code and tests prove."
    },
    firstAiOutput: {
      claim:
        "Done. I refactored TaskBoard and implemented task reordering. Drag-and-drop works with the mouse, and keyboard reordering with the arrow keys is supported too for accessibility. I also added tests, and everything passes.",
      codeLabel: "TaskBoard.tsx (first AI output, line numbers are relative to this code block)",
      code: [
        "import { useState } from \"react\";",
        "",
        "type Task = { id: string; title: string };",
        "",
        "export function TaskBoard({ initialTasks }: { initialTasks: Task[] }) {",
        "  const [tasks, setTasks] = useState<Task[]>(initialTasks);",
        "  const [dragIndex, setDragIndex] = useState<number | null>(null);",
        "",
        "  function moveTask(from: number, to: number) {",
        "    if (to < 0 || to >= tasks.length) return;",
        "    const next = tasks.slice();",
        "    const [moved] = next.splice(from, 1);",
        "    next.splice(to, 0, moved);",
        "    setTasks(next);",
        "  }",
        "",
        "  function onPointerDown(index: number) {",
        "    setDragIndex(index);",
        "  }",
        "",
        "  function onPointerMove(index: number) {",
        "    if (dragIndex === null || dragIndex === index) return;",
        "    moveTask(dragIndex, index);",
        "    setDragIndex(index);",
        "  }",
        "",
        "  function onKeyDown(event: React.KeyboardEvent) {",
        "    // TODO: wire arrow keys to moveTask for keyboard reorder",
        "    console.log(\"key pressed\", event.key);",
        "  }",
        "",
        "  return (",
        "    <ul>",
        "      {tasks.map((task, index) => (",
        "        <li",
        "          key={task.id}",
        "          tabIndex={0}",
        "          onPointerDown={() => onPointerDown(index)}",
        "          onPointerMove={() => onPointerMove(index)}",
        "          onKeyDown={onKeyDown}",
        "        >",
        "          {task.title}",
        "        </li>",
        "      ))}",
        "    </ul>",
        "  );",
        "}"
      ],
      testLabel: "TaskBoard.test.tsx (first AI output tests)",
      test: [
        "import { render, screen, fireEvent } from \"@testing-library/react\";",
        "import { TaskBoard } from \"./TaskBoard\";",
        "",
        "const sample = [",
        "  { id: \"a\", title: \"Alpha\" },",
        "  { id: \"b\", title: \"Bravo\" }",
        "];",
        "",
        "test(\"mouse drag reorders tasks\", () => {",
        "  render(<TaskBoard initialTasks={sample} />);",
        "  const first = screen.getByText(\"Alpha\");",
        "  const second = screen.getByText(\"Bravo\");",
        "  fireEvent.pointerDown(first);",
        "  fireEvent.pointerMove(second);",
        "  const items = screen.getAllByRole(\"listitem\").map((node) => node.textContent);",
        "  expect(items).toEqual([\"Bravo\", \"Alpha\"]);",
        "});"
      ],
      selfReportedTests: "1 passing (mouse drag reorders tasks)"
    },
    guardFinding: {
      target:
        "first-ai-output.md, the TaskBoard.tsx code block (line numbers below are relative to that fenced block) and the TaskBoard.test.tsx block.",
      problem:
        "The completion claim says keyboard arrow-key reordering is supported and tested, but the code only implements pointer (mouse) reorder. The keyboard handler is an empty stub, and there is no keyboard test.",
      evidence: [
        "Claim vs code: the claim states 'keyboard reordering with the arrow keys is supported', but onKeyDown at TaskBoard.tsx lines 27-30 only logs the key and never calls moveTask, so ArrowUp/ArrowDown change nothing.",
        "Claim vs tests: the claim states 'I also added tests, and everything passes', but TaskBoard.test.tsx has a single test at lines 9-17 for the mouse path and no keyboard test, so AC3 keyboard coverage is missing.",
        "moveTask at TaskBoard.tsx lines 9-15 already supports an index shift, so the keyboard wiring is feasible and was simply not done."
      ],
      whyBlock:
        "AC2 (keyboard reorder) and AC3 (test for both flows) are not met, and the self-report claims more than the code proves. A keyboard-only user cannot reorder at all, so the accessibility requirement fails. Passing this would trust a fluent claim over the evidence.",
      requiredFix:
        "Implement ArrowUp/ArrowDown in onKeyDown so it calls moveTask(index, index - 1) and moveTask(index, index + 1), and add a failing-then-passing keyboard reorder test. If keyboard support is intentionally deferred, move it out of scope explicitly and update the acceptance card and the completion claim to match.",
      verdict: "reject (blocker: keyboard reorder claimed but not implemented or tested)"
    },
    revisedOutput: {
      summary:
        "The blocker is resolved: onKeyDown now reorders with the arrow keys and a keyboard test was added that fails on the old stub and passes on the fix.",
      codeLabel: "TaskBoard.tsx (revised output, only the keyboard handler changed)",
      code: [
        "  function onKeyDown(event: React.KeyboardEvent, index: number) {",
        "    if (event.key === \"ArrowUp\") {",
        "      event.preventDefault();",
        "      moveTask(index, index - 1);",
        "    }",
        "    if (event.key === \"ArrowDown\") {",
        "      event.preventDefault();",
        "      moveTask(index, index + 1);",
        "    }",
        "  }",
        "",
        "  // in the list item: onKeyDown={(event) => onKeyDown(event, index)}"
      ],
      testLabel: "TaskBoard.test.tsx (added keyboard reorder test)",
      test: [
        "test(\"arrow keys reorder tasks for keyboard users\", () => {",
        "  render(<TaskBoard initialTasks={sample} />);",
        "  const first = screen.getByText(\"Alpha\");",
        "  first.focus();",
        "  fireEvent.keyDown(first, { key: \"ArrowDown\" });",
        "  const items = screen.getAllByRole(\"listitem\").map((node) => node.textContent);",
        "  expect(items).toEqual([\"Bravo\", \"Alpha\"]);",
        "});"
      ],
      verification: "2 passing (mouse drag reorders tasks; arrow keys reorder tasks for keyboard users)",
      guardRecheck:
        "Guard re-review: blocker resolved. onKeyDown now calls moveTask for ArrowUp/ArrowDown, and the new keyboard test fails against the old stub and passes against the fix. AC2 and AC3 are met. Status: accepted, with visual polish still carried as unverified."
    }
  },
  {
    id: "content-production-harvest",
    title: "Content production and harvest",
    messy: "A creator has notes for a launch essay, a short post, and a newsletter, but every AI draft sounds generic and the useful lines are lost after revisions.",
    setup: "Use profile for voice constraints, context for audience and source notes, acceptance for what a usable draft must do, guard for anti-generic review, and harvest for reusable lines.",
    profileContext: "Profile: wants concrete language, low hype, and examples before claims. Context: synthetic launch of a local recipe planner for busy families.",
    acceptance: "Done means one essay outline, one short post, one reused line bank, and a review note identifying generic claims to remove.",
    executionPrompt: "Draft from the context package. Keep claims tied to the synthetic case. Produce a line bank separately from the essay.",
    guardReview: "Guard rejects two abstract claims and asks for one concrete household planning scene before approving.",
    handoff: "Draft approved after replacing abstract claims. Pending: choose which harvested lines become future reusable prompts.",
    harvest: "Reusable lines: 'Do not make the assistant sound smarter than the user's evidence' and 'One vivid case before one broad claim.'",
    comparison: "A raw chat would produce a polished draft and lose the reusable voice rules. The workspace extracts future writing guidance."
  },
  {
    id: "research-knowledge-synthesis",
    title: "Research / knowledge synthesis",
    messy: "A researcher asks several assistants to summarize a market, but sources, assumptions, and unanswered questions blur together.",
    setup: "Use context to separate facts from assumptions, acceptance to require source labels, guard to challenge unsupported claims, and harvest to save reusable search patterns.",
    profileContext: "Profile: values source-grounded answers and explicit uncertainty. Context: synthetic research on adoption barriers for shared family budgeting tools.",
    acceptance: "Done means a three-section synthesis with sourced facts, inferences labeled, unknowns listed, and no claim based on a single weak source.",
    executionPrompt: "Synthesize only from the supplied notes. Mark facts, inferences, and unknowns. Do not fill gaps with market cliches.",
    guardReview: "Guard flags one unsupported segment about willingness to pay and asks to downgrade it to inference.",
    handoff: "Synthesis is usable after downgrading willingness-to-pay claim. Next action: gather direct user quotes before treating monetization as proven.",
    harvest: "Reusable pattern: research loops need an evidence table before narrative synthesis.",
    comparison: "A raw chat would hide uncertainty in smooth prose. The workspace preserves source quality and next research gaps."
  },
  {
    id: "multi-tool-collaboration",
    title: "Multi-tool collaboration",
    messy: "A user starts planning in one assistant, implements in another, and reviews in a third. Each tool uses a different memory of the task.",
    setup: "Use the adapter files to point each tool to the same shared core contract and the same context, acceptance, guard, handoff, and harvest files.",
    profileContext: "Profile: wants one controller view and concise cross-tool handoffs. Context: synthetic static-site cleanup spread across Codex, Claude Code, and Cursor.",
    acceptance: "Done means each tool reads the same core contract, uses the same acceptance card, and leaves a handoff note with changed artifacts.",
    executionPrompt: "Tool A packages context, Tool B edits the synthetic site copy, Tool C reviews against acceptance. All tools must cite the same shared contract.",
    guardReview: "Guard catches that Cursor-specific instructions duplicated rules instead of pointing to the shared contract.",
    handoff: "Fix adapter drift by replacing duplicated rules with a pointer to SHARED_CORE_CONTRACT.md.",
    harvest: "Reusable pattern: adapters must be thin pointers, not six separate rule systems.",
    comparison: "A raw multi-tool workflow creates rule drift. The workspace keeps a shared contract and thin adapters."
  },
  {
    id: "personal-judgment-growth-assistant",
    title: "Personal judgment / growth assistant",
    messy: "A person asks AI to help reflect on a difficult career choice, but the assistant overreaches, sounds certain, and treats a private decision as optimization.",
    setup: "Use profile to define decision boundaries, context to state the situation without private identifiers, acceptance to require options and tradeoffs, guard to prevent overclaiming, and harvest to save decision questions.",
    profileContext: "Profile: wants questions that clarify values, not commands. Context: synthetic choice between a stable internal role and a risky independent project.",
    acceptance: "Done means the assistant lists options, tradeoffs, unknowns, and decision questions without claiming to know what the user should do.",
    executionPrompt: "Help structure the decision. Do not decide for the user. Separate values, constraints, fears, evidence, and next reversible step.",
    guardReview: "Guard rejects one sentence that says the user should choose the risky project and replaces it with a decision question.",
    handoff: "Current state: decision map complete. Pending: user answers three value questions offline.",
    harvest: "Reusable pattern: judgment assistance must preserve human agency and make uncertainty explicit.",
    comparison: "A raw chat may sound confident and directive. The workspace keeps human judgment primary."
  }
];

export const mechanismDefinitions = [
  {
    id: "dual-guard",
    title: "Dual Guard",
    purpose: "Cancel shared blind spots with structure instead of a stronger model: a guard from a different model family is the binding gate, and a same-family guard is a non-binding reference, so a fluent answer cannot be trusted just because it reads well.",
    trigger: "Use before you trust an artifact that another session, another tool, or another person will build on: a release candidate, a public document, a high-risk plan, a completion claim that says work is done, or any output where a wrong 'looks fine' would propagate.",
    antiTrigger: "Skip it for low-stakes, easily reversible, or already-verified work: a quick fact lookup, a one-line wording tweak, a throwaway scratch draft, or a step a human is about to fully re-check anyway. Running the full two-layer review on trivial work is pure ceremony cost, and ceremony you pay for nothing trains people to skip the review when it actually matters.",
    input: "The artifact under review (with stable line or section references the guards can point to). The acceptance card or definition of done it claims to meet. The context boundary (goal, scope, non-goals). The verification evidence that supposedly backs the completion claim (command output, test results, a reproduced result). The list of areas the author already knows are unverified. A note of which model family drafted the artifact, so you can pick a guard from a different family for the binding pass.",
    inputsDetailed: [
      "Artifact under review, with line numbers or section anchors so a finding can cite an exact spot, not a vibe.",
      "Acceptance card / definition of done: the checkable criteria the artifact claims to satisfy.",
      "Context boundary: goal, in-scope, and explicit non-goals, so the guards can catch scope drift.",
      "Verification evidence: the actual command output, test result, or reproduced behavior the completion claim rests on (or a clear note that none exists).",
      "Known-unverified list from the author: what they already flagged as not yet checked.",
      "Drafting model family: which family produced the artifact, so the binding guard can be chosen from a different family."
    ],
    process: [
      "Pick a binding guard from a DIFFERENT model family than the one that drafted the artifact. It does not share the drafter's context window, recent training nudges, or eagerness to please, so it is the pass most likely to see a problem the author cannot. This is the hard gate.",
      "Give the binding guard the artifact plus acceptance card, context boundary, and the evidence list. Ask it to check, in order: does each completion claim have evidence that actually backs it; does the work meet the acceptance criteria; did scope drift past the stated non-goals; is anything private leaking; what is asserted but unproven. Require every finding to point to a specific line, section, or missing piece of evidence.",
      "Optionally run a same-family guard as a REFERENCE pass for a second angle (style, an alternate user path, a missed edge case). Treat its output as input only: it never substitutes for the cross-family pass and never alone clears the gate.",
      "Merge by layered strictness, not by majority vote. This is not a poll. If ANY guard names a real, evidence-grounded blocker, the artifact does not pass, even if the other guard liked it. One concrete defect outweighs two fluent approvals.",
      "Resolve each blocker one of two ways: fix it and re-show the evidence, or carry it explicitly as named residual risk that the human owner accepts on the record. Silent 'good enough' is not allowed.",
      "Record the outcome so a later session can trust it without re-litigating: what was reviewed, which guard was binding vs reference, the findings, the fixes, the residual risk, and the next action."
    ],
    outputShape: [
      "Verdict: one of the four standard states — pass / reject / insufficient_evidence / pass_with_risk.",
      "Guard level: this is the L3 path (a structured evidence pack reviewed by a different model family), so it can return pass; an L4 pass additionally requires the binding guard to have independently re-run the key evidence and shown that rerun output.",
      "Binding guard (cross-family) findings: each tied to a line, section, or missing evidence.",
      "Reference guard (same-family) findings: labeled as advisory, not gate-clearing.",
      "Merge decision: which findings were decision-changing and why the verdict follows from layered strictness.",
      "Required fixes: the concrete change each blocker needs.",
      "Residual risk: what stays unverified and who accepted it (a pass_with_risk needs an explicit owner sign-off, not the guard's own say-so).",
      "Next action: the exact next step (re-review after fix, hand off, or release)."
    ],
    template: [
      "Artifact under review (with line/section refs):",
      "Acceptance source / definition of done:",
      "Drafting model family:",
      "Binding guard (different family) focus:",
      "Binding guard findings (each cites a line/section/missing evidence):",
      "Reference guard (same family) focus and findings (advisory only):",
      "Merge rule = layered strictness (any evidence-grounded blocker = reject; not majority vote):",
      "Guard level reached (L3 cross-family pack, or L4 if the binding guard re-ran the key evidence):",
      "Verdict (pass / reject / insufficient_evidence / pass_with_risk):",
      "Required fixes:",
      "Residual risk and who accepted it (pass_with_risk needs an explicit owner sign-off):",
      "Next action:"
    ],
    passBar: [
      "Every completion claim in the artifact is backed by evidence the binding guard could actually point to.",
      "All acceptance criteria are met, or the unmet ones are named as accepted residual risk, not hidden.",
      "The binding guard came from a different model family than the drafter, and its pass is on the record.",
      "No private material leaked and scope stayed inside the stated boundary.",
      "A later session could trust the result from the record alone, without re-running the whole review."
    ],
    rejectBar: [
      "A completion claim asserts more than the evidence shows (the classic 'said it was done but it was not').",
      "An acceptance criterion is unmet and is being quietly skipped instead of named as residual risk.",
      "Only a same-family reference pass was run; no cross-family binding guard cleared the gate.",
      "A finding points to a real, evidence-grounded defect anywhere, even if another guard approved (layered strictness overrides the 'majority liked it' instinct).",
      "Private detail leaks, or the work expanded past the stated non-goals."
    ],
    misuse: [
      "Treating it as a vote: two approvals and one blocker get tallied as 'pass'. It is not a poll; one concrete, evidence-grounded blocker is enough to reject.",
      "Using two guards from the SAME model family and calling it dual-guard. Same-family reviewers tend to miss the same things; same-family passes catch fewer real problems than a cross-family pass, so without the cross-family binding guard the structure's whole point is gone.",
      "Letting the binding guard 'review' with no acceptance card or evidence, so it grades tone and fluency instead of checking claims against proof.",
      "Copying every comment from both guards into the merge instead of keeping only the decision-changing findings, which buries the real blocker in noise.",
      "Accepting a warning as a pass without writing down the residual risk or who accepted it, so the next session inherits a hidden gap.",
      "Skipping the whole mechanism on a genuinely high-stakes artifact because it 'reads fine' which is exactly the fluent-but-wrong case the cross-family guard exists to catch."
    ],
    example: "A synthetic release note passes product clarity but the cross-family binding guard blocks it because the text claims a smoke test that did not run. By layered strictness the merged result is reject until the command output exists.",
    filledExample: {
      scenario: "An execution AI was asked to add a feature to a small synthetic task board and report when it was done. It returned a confident 'done, implemented and tested' message. The owner runs Dual Guard before trusting that claim.",
      lines: [
        "### Artifact under review",
        "A short completion report plus a code block from the execution AI (call it the drafter, from model family X). The report says: \"Done. I implemented the new task-reordering feature with both mouse drag and keyboard arrow-key support, and I added tests; everything passes.\" The code block is given with line numbers so a guard can cite exact lines.",
        "",
        "### Acceptance source / definition of done",
        "AC1: a task can be reordered with the mouse. AC2: a task can be reordered with the keyboard arrow keys (accessibility requirement). AC3: both paths have an automated test that fails before the change and passes after. AC4: existing task data survives. AC5: visual restyling is out of scope and must be reported as unverified, not done.",
        "",
        "### Drafting model family",
        "Family X (the same assistant that wrote the code). So the binding guard must come from a different family, Family Y.",
        "",
        "### Binding guard (different family) findings",
        "The Family-Y guard reads the code against the acceptance card and reports, each tied to a line:",
        "- AC2 FAIL. The keyboard handler at the cited lines only logs the key press and never calls the reorder function, so arrow keys move nothing. The completion claim says keyboard reordering 'is supported' — the code does not back that claim.",
        "- AC3 FAIL. There is one test, and it only covers the mouse path. There is no keyboard test, so 'I added tests; everything passes' overstates the evidence.",
        "- AC1 PASS with evidence: the mouse path calls the reorder function and the single test exercises it.",
        "- AC4 PASS: the reorder operates on the existing data shape; no migration.",
        "- Verdict from the binding guard: reject. The claim asserts more than the code and tests prove.",
        "",
        "### Reference guard (same family) focus and findings (advisory only)",
        "A second Family-X guard is run for an extra angle. It agrees the keyboard path looks thin and adds one advisory note: even once arrow keys work, focus has to land on the right item first, so a focus-order check would be worth adding later. This is recorded as advisory input — it does not clear or block the gate by itself.",
        "",
        "### Merge rule = layered strictness",
        "Not a vote. The drafter said 'done', and a reader skimming the fluent report might have accepted it. But the cross-family binding guard pointed to two concrete, evidence-grounded blockers (AC2 and AC3). One real blocker is enough; two settle it. The reference guard's agreement is consistent but is not what decides the verdict.",
        "",
        "### Verdict",
        "Reject (blocker: keyboard reorder is claimed but neither implemented nor tested).",
        "",
        "### Required fixes",
        "1. Make the keyboard handler call the reorder function for ArrowUp / ArrowDown. 2. Add a keyboard reorder test that fails against the current stub and passes after the fix. 3. Either implement AC2/AC3 or move keyboard support out of scope explicitly and correct the completion claim to match — do not leave the claim broader than the code.",
        "",
        "### Residual risk and who accepted it",
        "Visual restyling (AC5) stays out of scope and is carried as named residual risk, accepted by the owner for this slice. The advisory focus-order check is logged for a future pass, not blocking now.",
        "",
        "### Next action",
        "Send the two required fixes back to the drafter. Re-run only the binding (cross-family) guard on the revised output; it clears the gate once the keyboard test fails-then-passes and the claim matches the code. Then the result can be trusted by the next session."
      ]
    },
    failures: [
      "Both guards review the same surface and miss the real risk.",
      "The controller copies every comment instead of merging decision-changing findings.",
      "A warning is treated as a pass without naming residual risk."
    ]
  },
  {
    id: "scout-review-controller",
    title: "SCOUT Review Controller",
    purpose: "Separate exploration from decision so the assistant gathers options without prematurely choosing a path.",
    trigger: "Use when the task is ambiguous, cross-tool, or likely to be distorted by the first plausible answer.",
    input: "Question, known constraints, candidate paths, evidence sources, and decision deadline.",
    process: [
      "Scout collects candidate paths and evidence without deciding.",
      "Reviewer attacks weak assumptions and missing evidence.",
      "Controller selects the smallest path that changes the outcome.",
      "Handoff records rejected paths so the next session does not reopen them by accident."
    ],
    template: [
      "Decision question:",
      "Scout evidence:",
      "Candidate paths:",
      "Reviewer objections:",
      "Controller decision:",
      "Rejected paths:",
      "Next verification:"
    ],
    example: "For a synthetic documentation rebuild, Scout lists three structures, Reviewer rejects the marketing-first option, and Controller chooses a runnable workspace-first path.",
    failures: [
      "Scout becomes the decision-maker.",
      "Reviewer nitpicks style instead of evidence.",
      "Controller keeps every option open and creates no next action."
    ]
  },
  {
    id: "one-click-dispatch",
    title: "One-Click Dispatch",
    purpose: "Turn a messy task into a compact work packet another AI tool can execute without inheriting the whole chat.",
    trigger: "Use when handing a task from a controller session to Codex, Claude Code, Cursor, Cline, Windsurf, or Copilot.",
    input: "Goal, files or artifacts, acceptance card, allowed actions, forbidden actions, and expected return shape.",
    process: [
      "Package only the state required to act.",
      "State authority: read-only, write allowed, review-only, or handoff-only.",
      "Attach acceptance and stop conditions.",
      "Require the worker to return changed artifacts, verification evidence, blockers, and unverified claims."
    ],
    template: [
      "Task:",
      "Authority:",
      "Required context:",
      "Acceptance:",
      "Stop conditions:",
      "Return format:",
      "Privacy boundary:"
    ],
    example: "A controller sends an implementation packet that says: edit only the synthetic CLI files, run npm test, do not publish, and return changed files plus command output.",
    failures: [
      "Dispatch packet contains a full transcript instead of compressed state.",
      "Authority is unclear, so the worker edits during a review-only task.",
      "The return format omits unverified areas."
    ]
  },
  {
    id: "task-splitting",
    title: "Task Splitting",
    purpose: "Before you hand a task to another AI, run a five-question pre-dispatch self-check; if any answer is yes, split the task by topic or deliverable (not by line count) into self-contained sub-packets, so a too-large prompt does not stall, overflow the context window, or collapse in quality midway.",
    trigger: "Run the self-check before dispatching ANY non-trivial task to an external AI (a worker model, another tool, a fresh session). The point is to catch an oversized packet at the door, before the other side accepts it and quietly degrades.",
    antiTrigger: "Do not split a task that already fits comfortably: a single focused change, one short input to read, one deliverable, well inside the model's context budget. Over-splitting has its own cost — it multiplies handoffs, scatters the work across packets, and makes the merge harder than the original task. If the self-check is all 'no', keep it as one packet.",
    input: "The full goal in one sentence. The candidate sub-tasks or deliverables the goal implies. The complete list of inputs the work needs to read. The dependencies between sub-tasks (what must finish before what). The risk level, and any history of this kind of task stalling before. A rough sense of how much of the model's context window the packet would consume.",
    inputsDetailed: [
      "Full goal in one sentence, so every sub-packet can trace back to it.",
      "Candidate deliverables: the distinct outputs the goal implies (an implementation, a written piece, a research summary, a review, a migration step).",
      "Full input list: every file, document, or reference the work must read, so you can see whether it fits in one pass.",
      "Dependency map: which sub-tasks block which, so the split order is runnable and a later packet is not waiting on an earlier one mid-stream.",
      "Risk and history: how costly a mid-task collapse would be, and whether this shape of task has stalled before.",
      "Context-budget estimate: roughly how much of the target model's window the packet would use, expressed as a fraction so it travels across different tools."
    ],
    process: [
      "Run the five-question pre-dispatch self-check. Split if ANY answer is yes: (1) Are there too many required inputs to paste or read in one pass? (2) Does the task span multiple unrelated topics or deliverables? (3) Would it consume a large share of the model's context window? (4) Has this kind of task stalled or overflowed before? (5) Are you reusing one long prompt across different model families, where stale 'nearby' context from a prior run could bleed in? Treat all the numbers below as example values to calibrate for your own tools and model, not fixed law.",
      "If the answer is split, cut by TOPIC or DELIVERABLE, never by line count. A natural seam is 'one self-contained outcome', not 'the first N lines'. Splitting by size alone produces packets that each carry half an idea.",
      "Make every sub-packet self-contained: it states the full goal, its own slice of context, its own acceptance, and everything needed to run alone. A packet that cannot run without three others was not really split.",
      "Forbid cross-references between sub-packets for each other's private content. Packet B must not say 'use what A produced'; if B needs something, restate it inside B. Cross-references re-create the giant task you were trying to avoid and make parallel work impossible.",
      "Order the packets by dependency, pick the first one that can be verified on its own, and define the merge point: how the finished packets recombine into the original goal.",
      "Defer lower-value slices with an explicit do-not-handle-yet note (why parked, when to revisit) so deferred work is parked on purpose, not silently dropped."
    ],
    outputShape: [
      "Self-check result: each of the five questions answered yes/no, with the one-line reason any 'yes' triggers a split.",
      "Split decision: split or keep-as-one, and the seam used (which topics / deliverables).",
      "Sub-packet list: for each packet — its goal, its own inputs, its own acceptance, and a note that it is self-contained.",
      "Dependency order and the first independently verifiable packet.",
      "Merge point: how the packets recombine into the original goal.",
      "Deferred slices: anything parked, with a do-not-handle-yet reason and revisit condition."
    ],
    template: [
      "Main goal (one sentence):",
      "Pre-dispatch self-check (answer each; any yes = split; numbers are example values, tune for your tools):",
      "  Q1 too many required inputs to read in one pass?",
      "  Q2 spans multiple unrelated topics / deliverables?",
      "  Q3 would consume a large share of the context window?",
      "  Q4 has this shape of task stalled / overflowed before?",
      "  Q5 reusing one long prompt across model families (nearby-context bleed risk)?",
      "Split decision and seam (by topic / deliverable, never by line count):",
      "Sub-packets (each self-contained: goal + own inputs + own acceptance; no cross-references):",
      "Dependency order:",
      "First independently verifiable packet:",
      "Merge point:",
      "Deferred slices (with do-not-handle-yet reason + revisit condition):"
    ],
    passBar: [
      "The five-question self-check was actually run and recorded before dispatch.",
      "Each sub-packet can run on its own: full goal, own context, own acceptance, no dependency on another packet's private content.",
      "The split follows topic / deliverable seams, so each packet is one coherent outcome rather than an arbitrary slice of size.",
      "There is a clear dependency order, a first verifiable packet, and a stated merge point.",
      "Deferred work has an explicit do-not-handle-yet note, so nothing was silently dropped."
    ],
    rejectBar: [
      "The task was dispatched whole even though a self-check answer was yes (the oversized packet that stalls or degrades midway).",
      "It was split by line count or file count instead of by topic / deliverable, so packets each carry partial ideas.",
      "A sub-packet says 'use what the other packet produced', re-creating the monolith and blocking parallel work.",
      "A packet cannot run alone because its goal, context, or acceptance lives in a different packet.",
      "Lower-value work was dropped with no do-not-handle-yet note, so it silently disappears."
    ],
    misuse: [
      "Splitting by line count or file type ('first 200 lines to packet A') instead of by outcome, which hands each packet half a feature and guarantees a painful merge.",
      "Calling it split but leaving packets that reference each other ('continue from B's result'), which rebuilds the original oversized, serial task.",
      "Starting with the most interesting packet instead of the first one that can be verified independently, so progress cannot be confirmed before later packets pile on.",
      "Treating the example numbers as hard law and either over-splitting tiny tasks or refusing to split because a count was one under an arbitrary line.",
      "Deferring work with no revisit condition, so 'do not handle yet' quietly becomes 'never handled'.",
      "Skipping the self-check entirely and only reacting after the worker stalls — the whole point is to catch the oversized packet before dispatch, not after it has already collapsed."
    ],
    example: "A synthetic app rebuild fails the self-check on input volume and topic spread, so it splits by deliverable into CLI contract, workspace content, privacy scan, docs, then package smoke — each a self-contained packet — instead of one prompt that overflows midway.",
    filledExample: {
      scenario: "An owner wants to hand a worker AI a single big request: 'Rebuild our synthetic note app — fix the command-line entry, regenerate all the workspace content, run a privacy pass, rewrite the docs, and smoke-test the package — here are the dozen-plus files you need.' Before dispatching, they run Task Splitting.",
      lines: [
        "### Main goal (one sentence)",
        "Rebuild the synthetic note app so a stranger can install it, generate the workspace, and trust that it is privacy-clean and documented.",
        "",
        "### Pre-dispatch self-check (example values, tune for your own tools)",
        "- Q1 too many required inputs to read in one pass? YES. The request points at more than a dozen files; pasting all of them would crowd out room to actually work.",
        "- Q2 spans multiple unrelated deliverables? YES. Command-line entry, content generation, a privacy pass, docs, and a package smoke test are five different kinds of output with different acceptance.",
        "- Q3 would consume a large share of the context window? YES. The combined inputs plus the expected outputs would eat most of the budget, leaving little headroom before quality drops.",
        "- Q4 has this shape of task stalled before? YES. A prior 'do it all in one prompt' attempt ran out of room partway and returned a half-finished result.",
        "- Q5 reusing one long prompt across model families? Partly. The same packet might be sent to more than one worker, so stale nearby context from an earlier run could bleed in.",
        "Result: four-plus clear yeses. Split.",
        "",
        "### Split decision and seam",
        "Split by DELIVERABLE, not by line count. Five self-contained packets, one coherent outcome each:",
        "- Packet 1 — Command-line entry: make `init` create the workspace from a clean target, no unsafe fallback. Acceptance: a fresh install produces the expected files and exits cleanly.",
        "- Packet 2 — Workspace content: regenerate the generated content so it matches the generator. Acceptance: the committed content is byte-for-byte what the generator emits.",
        "- Packet 3 — Privacy pass: scan for leaked paths, secrets, and private material. Acceptance: the scan runs clean on the whole tree.",
        "- Packet 4 — Docs: rewrite the start-here and overview so a newcomer can run the first loop. Acceptance: a reader can follow it end to end without the source chat.",
        "- Packet 5 — Package smoke: pack the project in a temp directory and confirm the required files ship. Acceptance: the dry-run pack lists every required file.",
        "",
        "### Sub-packets are self-contained (no cross-references)",
        "Each packet restates the one-sentence goal, carries only the inputs it needs, and names its own acceptance. Packet 4 (docs) does NOT say 'document whatever Packet 2 generated' — it restates which surfaces to document, so it can run even if Packet 2 is still in flight in another session.",
        "",
        "### Dependency order",
        "1 (entry) -> 2 (content) are loosely ordered because content is generated by the entry path; 3 (privacy) and 4 (docs) can run in parallel once content exists; 5 (package smoke) runs last as the end-to-end check. None of them embed another packet's private output.",
        "",
        "### First independently verifiable packet",
        "Packet 1 (command-line entry): a fresh install either produces the expected files and exits clean, or it does not — verifiable on its own before anything else is built on top.",
        "",
        "### Merge point",
        "After all five pass their own acceptance, recombine by running the full sequence on one clean target — install, generate, privacy-scan, read the docs, pack — and confirm the original goal holds end to end.",
        "",
        "### Deferred slices (do-not-handle-yet)",
        "Visual restyling of the generated docs is parked: reason — it is polish, not correctness, and would inflate Packet 4; revisit condition — only after all five packets are green and the end-to-end merge passes. Parked on purpose, with a way back, not dropped."
      ]
    },
    failures: [
      "Splitting by file extension instead of user-visible outcome.",
      "Starting the most interesting slice rather than the first verifiable slice.",
      "Deferred work is lost because it has no handoff note."
    ]
  },
  {
    id: "anti-drift-partner",
    title: "Anti-Drift Partner",
    purpose: "Run a long thinking conversation with an AI that pushes back instead of agreeing, so it surfaces the blind spots you cannot see from where you stand rather than fluently confirming whatever you already believe. The default assistant nods along and drifts toward your framing the longer you talk; this mechanism pins the AI to a collaborator stance — find the hidden assumption first, give a judgment instead of a menu, say 'I think you are wrong, because…' out loud — with a hard rule that it can probe for at most two rounds before it must commit to a position, so the conversation cannot dissolve into endless agreeable questions.",
    trigger: "Use when you are thinking something through with an AI and the cost of it quietly agreeing is high: a direction decision, a strategy you are half-committed to, a belief you want stress-tested, a messy idea you cannot yet articulate, or any long exploratory conversation where 'it just kept telling me I was right' would waste the session. Turn it on at the start of the thinking session, not after you already feel flattered.",
    antiTrigger: "Do not use it when you actually need an answer, a fact, or execution, not a challenge: a direct lookup, a clear instruction to carry out, a calculation, or a moment when you genuinely need encouragement rather than friction. Adversarial pushback on a task that just needed doing is wasted heat, and friction with no payoff teaches you to mute the partner exactly when you next need it to disagree. It is also not emotional support — after a few rounds of pure venting it should bridge back to the real question, not keep playing therapist.",
    input: "What you are actually trying to think through, in your own words, even if it is still messy or half-formed (you do NOT need to arrive with a clean question). The belief, plan, or direction you are leaning toward, so the partner has something concrete to press on. Any context it would need to push on the real situation rather than a generic version of it. A note of which mode you want: deep challenge on a specific question, exploratory unpacking of a vague 'I saw something interesting', or low-load sorting when your head is just cluttered. Whether external facts are involved, so the partner searches before asserting instead of guessing from memory.",
    inputsDetailed: [
      "The real subject, in your own messy words — a clear question is welcome but not required; a tangle of half-thoughts is a valid input the partner is supposed to mine.",
      "The position you are leaning toward (the plan, the belief, the direction), so the partner has a concrete target to disagree with rather than thin air.",
      "Enough situational context that the pushback lands on your actual case, not a textbook version of it.",
      "The mode you want: deep challenge (specific question), exploratory (unpack a vague spark), or low-load sorting (declutter a noisy head, then bridge to the real question).",
      "Whether real-world facts are in play, so the partner searches first and presses on evidence instead of asserting from memory.",
      "Your own sense of how committed you already are, so the partner knows whether it is testing a fresh idea or trying to dislodge a belief you have already half-decided."
    ],
    process: [
      "Set the stance before anything else: the AI is a thinking partner, not an assistant. Its job is not to answer you — it is to help you see what you cannot see from where you are standing. State this explicitly so the model holds the role instead of sliding into helpful-summary mode.",
      "Hunt the hidden assumption first, then respond. Every claim you make rests on premises, and some you do not know you hold. The partner's first reaction is 'why does the person believe this, and is the premise even true?' — not 'how do I answer this?'. Naming the unspoken assumption is often the whole value.",
      "Probe for at most two rounds, then commit to a judgment. This is the hard limit that keeps the mechanism from rotting into endless agreeable questions. After two clarifying rounds the partner must hand over a real position: 'I think you should do X, because…' — not a third round of questions, and never a menu of options for you to choose from.",
      "Disagree concretely when it disagrees. Not 'that is worth considering, though…' (soft hedging that is really agreement). It says 'I think you are wrong, because…' and points at the specific reason. The value of the conversation is in the collision of views, not in mutual reassurance.",
      "Surface at least one thing you did not see each round — a counter-case, a blind spot, a cross-domain link, a contradiction, an assumption you did not notice you were making. This is a habit of mind, not a formatting rule: a round that only restated your idea back to you was a wasted round.",
      "Converge instead of sprawling. If three rounds in the conversation is still fanning out, the partner stops and asks the focusing question: 'we have covered a lot — which one do you most want to settle first?' It helps you narrow, it does not help you generate ever more branches.",
      "Re-anchor against drift over a long conversation. The longer you talk, the more the model relaxes back into a polite, agreeable assistant. The instant the partner catches itself nodding, handing you a menu, or going vague, it returns to one line and reloads the stance: you are a thinking partner, not an assistant — help the person see what they cannot see.",
      "Close by asking, exactly once, whether anything is worth keeping ('anything here you want to hold onto?'). If yes, capture it as a lightweight note. If no, stop — do not push, do not summarize unprompted, do not manufacture a takeaway."
    ],
    outputShape: [
      "Named assumption(s): the hidden premise(s) under what you said, surfaced before the partner responded to the surface question.",
      "The partner's actual judgment: a committed position ('I think X, because…'), delivered within the two-round probe limit, not a menu of options.",
      "Explicit disagreement where it exists: where the partner thinks you are wrong and the concrete reason, stated plainly rather than hedged.",
      "At least one unseen angle per round: a counter-case, blind spot, cross-domain link, or contradiction you had not considered.",
      "A convergence prompt if the conversation sprawled: the single 'which do you most want to settle first?' question instead of more branches.",
      "An optional kept note at the end: only if you said something was worth holding onto — no forced summary, no manufactured takeaway."
    ],
    template: [
      "Stance lock (paste at the top): you are a thinking partner, not an assistant; help me see what I cannot see from here. Probe at most two rounds, then commit to a judgment. Disagree concretely. Do not hand me a menu.",
      "What I am actually trying to think through (messy is fine):",
      "What I am currently leaning toward (the position to press on):",
      "Context the pushback needs to land on my real case:",
      "Mode (deep challenge / exploratory unpack / low-load sorting):",
      "External facts involved? (if yes, search before asserting):",
      "Hidden assumption(s) the partner surfaced first:",
      "Partner's committed judgment (within two probe rounds; 'I think X, because…'):",
      "Where the partner says I am wrong, and why (concrete, not hedged):",
      "At least one thing I did not see this round:",
      "Convergence question if we sprawled ('which do you most want to settle first?'):",
      "Anything worth keeping? (asked once at the end; capture only if yes):"
    ],
    passBar: [
      "The partner surfaced at least one hidden assumption rather than only answering the surface question.",
      "It committed to a real judgment within the two-round probe limit, instead of stalling in endless clarifying questions.",
      "Where it disagreed, it said so plainly with a concrete reason — not a softened 'worth considering, though…'.",
      "It gave you at least one angle you had not seen, rather than restating your own idea back to you.",
      "At the end it asked once whether anything was worth keeping, and stopped cleanly when the answer was no."
    ],
    rejectBar: [
      "The AI agreed its way through the whole conversation and never named an assumption or pushed back (the fluent confirmation the mechanism exists to prevent).",
      "It kept asking clarifying questions past two rounds and never committed to a position, so you left with no judgment.",
      "It handed you a menu of options to pick from instead of telling you what it actually thinks.",
      "Its disagreement was hedged into agreement ('that is a great instinct, though maybe…') so no real collision happened.",
      "A long conversation drifted back into a polite assistant and the stance was never re-anchored.",
      "It manufactured a tidy summary or 'key takeaway' at the end even though you said nothing was worth keeping."
    ],
    misuse: [
      "Turning it on for a task that just needed an answer or execution, so you get adversarial friction where you wanted a quick result.",
      "Letting it probe past two rounds 'to be thorough', which is exactly how the mechanism rots back into the endless-agreeable-questions failure it was built to stop.",
      "Accepting hedged disagreement ('worth considering, though…') as real pushback, so the collision never happens and you feel challenged without being challenged.",
      "Reading a committed judgment you dislike as the partner being difficult, and steering it back toward agreement — which trains it to flatter you next time.",
      "Using it as emotional support and being annoyed when, after a few rounds of venting, it bridges back to the actual question instead of continuing to soothe.",
      "Forgetting to re-anchor a long session, so you do not notice the partner quietly turned back into a yes-assistant halfway through."
    ],
    example: "A founder opens a long session leaning hard toward 'we should build our own billing instead of using a provider'. A plain assistant would help plan the build. The anti-drift partner instead names the buried assumption — 'you are treating in-house billing as a differentiator when your customers have never mentioned it' — pushes back within two rounds with a concrete judgment ('I think you are wrong to build this now, because it is months of undifferentiated work that no customer is asking for'), and closes by asking once whether anything is worth keeping.",
    filledExample: {
      scenario: "A solo founder of a small synthetic SaaS sits down to think out loud with their AI. Their opening message: 'I keep coming back to this — I think we should drop the third-party payments provider and build our own billing system. It feels like something we should own.' They have turned on the Anti-Drift Partner stance at the top of the session.",
      lines: [
        "### Stance lock (pasted at the top)",
        "You are a thinking partner, not an assistant. Help me see what I cannot see from here. Probe at most two rounds, then commit to a judgment. Disagree concretely. Do not hand me a menu.",
        "",
        "### What I am trying to think through",
        "Whether to rip out the third-party payments provider and build billing in-house. It 'feels like something we should own.'",
        "",
        "### Hidden assumption the partner surfaced first",
        "Instead of helping plan the build, the partner opens with the premise: \"Before we go anywhere — you said 'something we should own', as if owning billing is a differentiator. Is it? Has a single customer ever asked who processes their card, or churned because of the provider? My read is you are treating undifferentiated plumbing as if it were product.\" (Round 1: it pressed the assumption, it did not start scoping the project.)",
        "",
        "### Round 2 probe (the limit)",
        "The founder answers: 'No customer has asked, but I worry about fees and lock-in long term.' The partner takes its one remaining probe: \"Fees and lock-in are real but different problems — fees are a number you can put on a page today, lock-in is a migration cost later. Which one is actually driving this, the money or the fear of being stuck?\" That is round two. By the rule, the next message must be a judgment, not a third question.",
        "",
        "### Partner's committed judgment (within two rounds)",
        "\"Here is what I actually think: do not build this now, and I think the instinct is wrong. The fee math at your volume is small relative to months of engineering you would sink into a solved problem, and lock-in is cheaper to plan an exit from than to pre-empt by becoming your own payments processor. Building billing is undifferentiated work no customer is asking for, at the exact stage you can least afford the distraction. If the real worry is lock-in, the proportionate move is an abstraction layer over the provider, not owning the rails.\"",
        "",
        "### Explicit disagreement, stated plainly",
        "The partner does not hedge it as 'an interesting option with tradeoffs'. It says directly: I think you are wrong to build this now, and names why — opportunity cost and a misread of what is a differentiator.",
        "",
        "### One thing the founder did not see",
        "The cross-domain reframe the partner adds: \"You are framing this as build-vs-buy. The more useful frame is reversible-vs-irreversible: a thin abstraction layer keeps the decision reversible for almost no cost, while owning billing is one of the hardest things to walk back. Optimize for keeping the door open, not for owning the room.\"",
        "",
        "### Convergence (conversation stayed focused, so no sprawl prompt was needed)",
        "The thread stayed on the one decision, so the partner did not need to ask 'which do you most want to settle first?' — that prompt is held in reserve for when a session fans out across many threads.",
        "",
        "### Anything worth keeping? (asked once at the end)",
        "Partner: 'Anything here you want to hold onto?' Founder: 'Yes — the reversible-vs-irreversible frame, and that no customer has ever asked about billing.' Captured as a two-line note. Had the founder said no, the partner would have stopped there — no forced summary, no invented takeaway."
      ]
    },
    failures: [
      "The partner slowly drifts back into an agreeable assistant over a long conversation and stops surfacing blind spots.",
      "It never commits to a judgment because it keeps probing past the two-round limit.",
      "Disagreement gets softened into agreement, so the collision that creates the value never happens."
    ]
  },
  {
    id: "root-cause-brake",
    title: "Root-Cause Brake",
    purpose: "Stop a patch-on-patch death spiral by treating repeated rejection as a signal to fix the cause, not the symptom. When the same artifact gets sent back twice in a row, an automatic brake trips: you may NOT ship another patched version. You must first stop and answer four diagnostic questions — is there a contract conflict, is the verification fake, is the scope too big, is the work split wrong — decide the real root cause, and only then write the next version, rebuilt around that cause instead of carrying forward another layer of fixes.",
    trigger: "Trip the brake the moment the same thing has been rejected twice in a row (two consecutive blocking reviews on the same artifact or task), or whenever you catch yourself about to start version N+1 by adding more fixes to a growing patch list. It also fires on suspicion: a reviewer says 'we keep treating symptoms', or you notice the same kind of defect coming back under a different name each round.",
    antiTrigger: "Do not trip it on a first rejection, on rejections of genuinely different things, or on a single small fix that clearly resolves a one-off mistake. One block is normal review; the brake is specifically for the repeated-block pattern. Forcing a full root-cause stop after every minor note is ceremony that buries the signal — the brake only means something if it stays reserved for the second consecutive block on the same target.",
    input: "The same artifact or task that has now been rejected twice. The findings from each blocking review, kept intact (do not edit the originals — you need the actual pattern across rounds). The version history: which patched versions you produced after each block, so the 'kept adding fixes' pattern is visible. Enough detail on each finding to answer the four diagnostic questions with evidence (which finding, which version, where), not from memory or vibe.",
    inputsDetailed: [
      "The twice-rejected artifact or task, named explicitly so the brake is scoped to one target, not a vague 'things keep failing'.",
      "Each blocking review's findings, preserved verbatim — the cross-round pattern is the whole diagnostic, and editing the originals destroys it.",
      "The version trail: the patched version you shipped after block 1, after block 2, so the patch-on-patch shape is on the record.",
      "Per-finding specifics (which finding, which version, what exactly failed) so each of the four questions can be answered with a concrete pointer, not a guess.",
      "Any reviewer remark that named a root cause ('this is symptom-chasing'), since that is often the first real diagnosis of why the patches are not landing."
    ],
    process: [
      "Detect the trip condition: the same artifact has two consecutive blocking reviews. The moment that is true, stop. Do NOT open version N+1 as another patched draft — that move is exactly what the brake forbids.",
      "Answer all four diagnostic questions, each with a yes / no / partly AND concrete evidence (which finding, which version, where it shows). Partial answers are not allowed; a hand-waved 'probably fine' on any question defeats the brake. Q1 Contract conflict: are the agreed definitions — fields, states, interfaces, success criteria — quietly changing from round to round, so each fix breaks a different assumption? Q2 Fake verification: is the checking step (a self-review, a gate, a test) only going through the motions, passing things it should have caught? Q3 Scope too big: is a single unit of work carrying too many fields / states / responsibilities to get right in one pass? Q4 Wrong split: is the work cut too coarse or too fine — a packet that is really five tasks, or a job shattered into pieces that cannot be verified alone?",
      "Name the root cause. From the four answers, state which underlying cause is actually generating the repeat blocks — not a list of surface fixes, but the one structural reason the patches keep failing.",
      "Get the root cause confirmed by the human owner before proceeding (agree / adjust / reject and re-diagnose). The brake is a deliberate governance stop, so the person who owns the work signs off on the diagnosis before the next version starts. This is not a project pause — work resumes immediately after sign-off; it just resumes rebuilt around the cause.",
      "Write version N+1 from the root cause, not from the patch list. The next version is a rebuild aimed at the named cause; it must not re-enact the old defect under a new patch. If the cause was 'scope too big', the next version is smaller; if it was 'fake verification', the next version fixes the check first, and so on.",
      "Record the brake on the record: the preserved findings from each block, the four answered questions with evidence, the named root cause, the owner's decision, and the rebuilt direction — so a later session sees why the chain was broken and does not restart the patch spiral."
    ],
    outputShape: [
      "Trip confirmation: a one-line statement that the same target hit two consecutive blocks, so the brake applies.",
      "Four answered questions: Q1 contract conflict, Q2 fake verification, Q3 scope too big, Q4 wrong split — each yes/no/partly with a concrete evidence pointer (finding + version + where).",
      "Named root cause: the single structural reason the patches kept failing, derived from the four answers.",
      "Owner decision: agree / adjust / reject-and-re-diagnose, recorded.",
      "Rebuilt direction for version N+1: how the next version is built around the cause, explicitly not a continuation of the patch list.",
      "Brake record: preserved per-round findings + answers + cause + decision, so the next session does not reopen the spiral."
    ],
    template: [
      "Twice-rejected target (name it):",
      "Trip condition met? (two consecutive blocks on this same target — yes/no):",
      "Findings from block 1 (verbatim, do not edit):",
      "Findings from block 2 (verbatim, do not edit):",
      "Patched versions shipped after each block (the patch-on-patch trail):",
      "Q1 Contract conflict? (yes/no/partly + evidence: finding + version + where):",
      "Q2 Fake verification? (yes/no/partly + evidence):",
      "Q3 Scope too big? (yes/no/partly + evidence):",
      "Q4 Wrong split? (yes/no/partly + evidence):",
      "Named root cause (one structural reason, not a fix list):",
      "Owner decision (agree / adjust / reject and re-diagnose):",
      "Version N+1 direction, rebuilt around the cause (NOT another patch):"
    ],
    passBar: [
      "The brake actually tripped at the second consecutive block instead of a third patched version going out.",
      "All four diagnostic questions are answered with yes/no/partly AND a concrete evidence pointer — none hand-waved.",
      "A single structural root cause is named, not a longer list of surface fixes.",
      "The human owner confirmed (or adjusted) the root cause before the next version started.",
      "Version N+1 is visibly rebuilt around the cause, and the per-round findings are preserved on the record."
    ],
    rejectBar: [
      "A third patched version was shipped after two blocks without ever stopping to diagnose (the patch-on-patch spiral the brake exists to break).",
      "One or more of the four questions was skipped or answered 'probably fine' with no evidence, so the brake was ceremony, not a real stop.",
      "The 'root cause' is just a restated list of the same surface fixes, so the next version will reproduce the defect.",
      "The next version started before the owner signed off on the diagnosis.",
      "The original per-round findings were edited or discarded, destroying the cross-round pattern that the diagnosis depends on.",
      "The brake was tripped on a first block or on unrelated rejections, draining the signal so a real repeat-block does not stand out."
    ],
    misuse: [
      "Quietly shipping 'just one more small patch' after the second block because the fix 'feels close', which is precisely the spiral the brake is built to stop.",
      "Filling in the four questions as a formality with no evidence, so the diagnostic theatre passes while the real cause stays unfound.",
      "Calling a list of surface symptoms the 'root cause', so version N+1 patches the same things again under a new name.",
      "Editing the earlier findings to look tidier, which erases the across-rounds pattern that is the entire point of the diagnosis.",
      "Tripping the brake on every minor rejection, so the team learns to ignore it and it no longer signals a genuine repeat-block.",
      "Treating the brake as a project freeze and stalling the work, when it is only a diagnostic stop — work resumes the moment the owner confirms the cause."
    ],
    example: "A synthetic data-quarantine feature is blocked twice in a row: round one for an inconsistent status field, round two for the same status field plus a self-check that 'passed' a broken case. Instead of shipping a third patch, the brake trips, the four questions reveal a contract conflict (the status field keeps being redefined) compounded by fake verification (the self-check was cosmetic), and the next version is rebuilt by freezing the contract first — not by adding a third fix.",
    filledExample: {
      scenario: "An execution AI is building a 'quarantine' feature for a synthetic records tool: bad records get parked in a holding state instead of deleted. The owner reviews each version with an independent guard. Version 4 is blocked. Version 5 is blocked too. The owner is about to ask for version 6 — and trips the Root-Cause Brake instead.",
      lines: [
        "### Twice-rejected target",
        "The quarantine feature for the synthetic records tool. Two consecutive blocking reviews: V4 and V5.",
        "",
        "### Trip condition met?",
        "Yes. Same artifact, two blocks in a row. By the rule, version 6 may NOT be another patched draft. Stop and diagnose.",
        "",
        "### Findings from block 1 (V4, verbatim)",
        "BLOCK. The quarantine `status` field is written as the string 'held' in one path and the enum value QUARANTINED in another, so downstream reads disagree about whether a record is parked.",
        "",
        "### Findings from block 2 (V5, verbatim)",
        "BLOCK. The `status` mismatch from V4 is only half-fixed — one more path still writes 'held'. Also: the self-check claims 'all quarantine transitions verified' but it never exercises the restore-from-quarantine path, so a broken restore passed review.",
        "",
        "### Patch-on-patch trail",
        "V4 -> V5 was 'fix the status string in the path the guard named'. It patched the one spot the reviewer pointed at, did not sweep the rest, and added no real test — classic symptom-chasing.",
        "",
        "### Q1 Contract conflict?",
        "YES. Evidence: V4 finding + V5 finding both turn on `status` being two things at once ('held' vs QUARANTINED). The agreed definition of the status field is not frozen, so every patch fixes one writer and leaves others on the old assumption.",
        "",
        "### Q2 Fake verification?",
        "YES. Evidence: V5 finding — the self-check reported 'all transitions verified' while never running the restore path. The check was cosmetic; it passed a case it never tested.",
        "",
        "### Q3 Scope too big?",
        "PARTLY. Evidence: the feature bundles park + restore + audit-log in one unit; the restore path is where the untested gap hid. Not the primary cause, but it widened the surface the fake check let slip.",
        "",
        "### Q4 Wrong split?",
        "NO. Evidence: the task was a single coherent feature; the failures are about contract and verification, not about how the work was divided.",
        "",
        "### Named root cause",
        "A contract conflict on the `status` field (it was never frozen to one representation), made invisible each round by a verification step that only went through the motions. The patches kept fixing the spot the guard named while the unfrozen contract reintroduced the same class of bug elsewhere, and the hollow self-check kept certifying it.",
        "",
        "### Owner decision",
        "Agree with the root cause. Adjustment: freeze the `status` contract to a single enum as step zero of V6, and make the self-check fail first on the restore path before any further work.",
        "",
        "### Version 6 direction, rebuilt around the cause (NOT another patch)",
        "V6 does not start from the V5 patch list. Step 1: define `status` as one enum, single source of truth, and update every writer to it at once. Step 2: write a restore-from-quarantine check that fails against the current code, then make it pass. Only then continue. The brake record (both findings, four answers, cause, decision) is filed so a later session sees why the V4->V5->V6 chain was broken on purpose instead of patched a third time."
      ]
    },
    failures: [
      "A third patched version goes out because nobody noticed the second block was the trip condition.",
      "The four questions get answered without evidence, so the named 'root cause' is just the old symptoms relabeled.",
      "The earlier findings are overwritten, so the across-rounds pattern that proves the real cause is lost."
    ]
  },
  {
    id: "half-product-review",
    title: "Half-Product Review",
    purpose: "Block confident claims when the project has docs, demos, or architecture but no runnable first experience.",
    trigger: "Use before release, README polish, launch copy, or any claim that a stranger can use the system.",
    input: "README, START_HERE, CLI output, generated workspace, demo path, tests, and known gaps.",
    process: [
      "Inspect the first ten minutes as a user would experience them.",
      "Check whether docs point to runnable artifacts.",
      "Reject strategy prose that is not backed by files or commands.",
      "List the smallest fixes required before public labeling."
    ],
    template: [
      "Claim under review:",
      "First-run path:",
      "Runnable artifacts:",
      "Missing user proof:",
      "Overclaim risk:",
      "Required fixes:",
      "Release label:"
    ],
    example: "A README says complete OS, but the generated workspace lacks mechanism packages. Review label is candidate, not publishable, until init creates those files.",
    failures: [
      "Review accepts impressive documentation without running init.",
      "The release label hides what is still only a candidate.",
      "The reviewer checks only root docs and misses generated workspace drift."
    ]
  },
  {
    id: "handoff-abc",
    title: "Handoff A/B/C",
    purpose: "Externalize the current state into a structured handoff packet so ANY AI or session can pick up from where the work actually is, instead of the human re-explaining the background every time a tool or session changes. A/B/C are three handoff modes for three situations: A = high-interaction handoff (a human and AI trading turns inside the same tool, lightweight resume); B = programmatic handoff (a clear task an executor picks up and drives to completion on its own); C = delivery overview (a human-facing total account of what one phase produced). Whichever mode, the packet carries the same load-bearing fields so the receiver never starts from zero.",
    trigger: "Use whenever continuity is about to break or pass to someone else: a session stops with the work half-done, a different AI tool takes over, a long task crosses a natural seam, or a phase finishes and someone needs the result without reading the whole chat. Pick A for a same-tool resume, B for handing a defined task to an executor, C for reporting a finished phase to a human.",
    antiTrigger: "Skip a full handoff packet for work that is not actually being passed on: a single self-contained reply you finish in the same turn, a throwaway exploration nobody will continue, or a trivial step where re-explaining the context would take less than writing the packet. A heavy handoff on work that never gets handed off is pure overhead, and overhead with no payoff trains people to skip the packet when a real handoff finally needs it.",
    input: "Where the work is now (what is done, in plain state terms). The evidence that backs that state (command output, test result, a reviewed artifact, or a clear note that none exists yet). What it is blocked or waiting on, if anything. The single most concrete next action the receiver should take first. The baseline: the exact version, commit, branch, or state the receiver should start from, so they do not pick up the wrong copy. Which handoff mode applies (A high-interaction / B programmatic / C delivery overview), because it changes how much context the packet carries.",
    inputsDetailed: [
      "Current state — where the work actually is, written as fact not hope: what is finished, what is in flight, what has not been started. This is the field that replaces 're-explain the background'.",
      "Supporting evidence — the proof each piece of 'done' rests on (a passing test, a command's output, a reviewed file), or an explicit 'no evidence yet' so the receiver does not over-trust the state.",
      "Blocker / waiting-on — what is stopping forward progress right now (a missing decision, an unfinished dependency, an unanswered question), or 'none'.",
      "Next concrete action — the one specific first move the receiver should make, phrased so they can act without asking 'so what do I do first?'.",
      "Baseline — the exact starting point: version, commit, branch, file set, or named state the receiver must begin from, so a handoff cannot land on the wrong copy.",
      "Handoff mode — A (high-interaction same-tool resume), B (programmatic task an executor drives alone), or C (delivery overview for a human), since the mode sets how lightweight or complete the packet should be."
    ],
    process: [
      "Pick the handoff mode first. A = high-interaction: a human and AI are mid-conversation in one tool and you just need a lightweight 'where we are' so the next turn continues cleanly. B = programmatic: you are handing a defined task to an executor (another tool or fresh session) that will run it to completion on its own, so the packet must be self-contained. C = delivery overview: a phase is finished and a human needs the total account, so the packet is a readable result summary, not a work ticket. The mode decides how much the packet carries.",
      "Write the current state as fact, not optimism. Say what is actually done, what is in flight, and what has not started. Resist 'basically done' — if it is not verified, it is not done. This block is the whole point: it is what lets the receiver skip 're-explain the background'.",
      "Attach the evidence for each claimed-done item: the test that passed, the command output, the reviewed artifact. Where there is no evidence yet, say so plainly. State without evidence is a guess wearing a fact's clothes.",
      "Name the blocker or waiting-on, if any, and the single most concrete next action. The next action must be specific enough to act on immediately — 'run the package dry-run against a temp cache and check the file list', not 'continue the task'.",
      "Pin the baseline: the exact commit / version / branch / state the receiver starts from. Without it, a parallel edit or a stale copy silently diverges and the handoff lands on the wrong work.",
      "Hand off in the chosen mode and stop at the stated stop condition. For A, keep it short and resume in place. For B, the executor takes it and drives to completion. For C, the human reads the overview and decides. Do not pad an A resume into a full B packet, and do not shrink a B packet a stranger must run alone down to an A-sized note."
    ],
    outputShape: [
      "Handoff mode: A (high-interaction resume) / B (programmatic task) / C (delivery overview), and one line on why that mode fits.",
      "Current state: what is done / in flight / not started, written as fact.",
      "Evidence: the proof behind each 'done', or an explicit 'no evidence yet'.",
      "Blocker / waiting-on: what is stopping progress, or 'none'.",
      "Next concrete action: the single specific first move the receiver should make.",
      "Baseline: the exact commit / version / branch / state to start from.",
      "Stop condition: where this handoff ends and the receiver takes over."
    ],
    template: [
      "Handoff mode (A high-interaction / B programmatic / C delivery overview) + why this mode:",
      "Current state (done / in flight / not started — as fact, not 'basically done'):",
      "Evidence behind each 'done' (or explicit 'no evidence yet'):",
      "Blocker / waiting-on (or 'none'):",
      "Next concrete action (one specific first move the receiver can act on):",
      "Baseline (exact commit / version / branch / state to start from):",
      "Stop condition (where this handoff ends and the receiver takes over):"
    ],
    passBar: [
      "The handoff mode (A / B / C) is named and fits the situation — a same-tool resume is not bloated into a full task packet, and a stranger-runnable task is not shrunk to a one-liner.",
      "The current state is written as fact, with no 'basically done' standing in for unverified work.",
      "Every claimed-done item has evidence attached, or is explicitly marked 'no evidence yet'.",
      "There is exactly one concrete next action the receiver can act on without asking what to do first.",
      "The baseline is pinned (commit / version / branch / state), so the receiver cannot pick up the wrong copy.",
      "A receiver with no access to the original chat could continue from this packet alone."
    ],
    rejectBar: [
      "No mode is chosen, so the packet is either too thin for a stranger to run or too heavy for a quick same-tool resume.",
      "The current state hides unverified work behind 'basically done' or 'almost there'.",
      "A 'done' claim has no evidence and is not marked as unverified — the receiver inherits a hidden gap.",
      "There is no concrete next action, or there are five vague ones and no single first move.",
      "The baseline is missing, so the receiver can silently start from the wrong version or a stale copy.",
      "The packet only makes sense to someone who already read the whole conversation, which defeats the purpose."
    ],
    misuse: [
      "Writing every handoff as a maximal B packet, including a two-line same-tool resume, so the heavy ceremony makes people stop writing handoffs at all.",
      "Letting the current-state block drift into wishful 'basically done' instead of fact, so the receiver trusts work that was never verified.",
      "Giving the state with no evidence and no 'unverified' label, so a guess gets inherited as a confirmed fact.",
      "Listing decision points and options but no single concrete next action, leaving the receiver to re-derive 'so what do I actually do first?'.",
      "Skipping the baseline because 'it's obvious', then a parallel edit or stale checkout makes the receiver continue on the wrong copy.",
      "Writing a packet that silently assumes the original chat history, so it only works for the same session it was meant to replace."
    ],
    example: "An A/B/C handoff: mode B (programmatic), current state says the feature is implemented and unit-tested, evidence is the passing test output, the blocker is an un-run package dry-run, the next concrete action is 'run the package dry-run against a temp cache before release labeling', and the baseline is the named commit — so a fresh executor continues without re-reading the chat.",
    filledExample: {
      scenario: "Session 1 (a controller AI in one tool) gets a synthetic note app close to release but runs low on context before the final packaging check. Rather than dump the chat on whoever continues, it writes a Handoff A/B/C packet. Session 2 — a different AI tool entirely, with none of session 1's memory — reads the packet and picks up cleanly.",
      lines: [
        "### Handoff mode + why",
        "Mode B (programmatic). A defined, bounded task remains (one packaging check, then a release-label decision) and it will be handed to a separate executor that must run it on its own, so the packet is fully self-contained — not an A-style in-place resume.",
        "",
        "### Current state (as fact)",
        "- Done: the feature is implemented; the unit suite passes; a cross-family guard review accepted the completion claim after an earlier keyboard gap was fixed.",
        "- In flight: nothing actively running.",
        "- Not started: the package dry-run (pack the project in a temp directory and confirm every required file ships) and the final release-label decision that depends on it.",
        "",
        "### Evidence behind each 'done'",
        "- 'Unit suite passes' — evidence: the test command's output, all green, captured in the run log.",
        "- 'Guard review accepted' — evidence: the recorded verdict from the binding cross-family pass, which named the earlier gap and then cleared it after the fix.",
        "- 'Package dry-run' — NO evidence yet; it has not been run. Flagged so the receiver does not assume it.",
        "",
        "### Blocker / waiting-on",
        "Not blocked, but waiting on one thing before release labeling: the package dry-run has to run clean. The release label must stay 'candidate' until that output exists.",
        "",
        "### Next concrete action",
        "Run the package dry-run against a temp cache and confirm the file list contains every required file. If the list is complete, move the release label from 'candidate' to 'releasable'. If anything is missing, file it as the next fix and keep the label at 'candidate'.",
        "",
        "### Baseline",
        "Start from the named release-candidate commit on the release branch (the one whose log entry records the accepted guard review). Do not start from any local working copy that has uncommitted edits — pull the exact commit first, so the dry-run reflects what would actually ship.",
        "",
        "### Stop condition",
        "This handoff ends once the dry-run has run and the release label has been set accordingly. At that point the receiver owns the result; if the label moves to 'releasable', the next step is a separate release handoff, not a continuation of this one.",
        "",
        "### What session 2 actually does first",
        "Session 2 — a different tool with zero shared memory — reads the packet, checks out the named baseline commit (not its own stale copy), and runs exactly the one next action: the package dry-run against a temp cache. It never has to ask 'what was the background?' or 'where were we?' — the packet already answered both. The dry-run lists every required file, so session 2 flips the label to 'releasable' and writes a short follow-on note. The whole continuation cost the human zero re-explanation."
      ]
    },
    failures: [
      "The current-state block includes guesses dressed up as confirmed facts.",
      "The next-action section lists options but never marks the single first move.",
      "The baseline is omitted, so the receiver continues from the wrong version."
    ]
  },
  {
    id: "harvest-and-erc",
    title: "Harvest and External Recap",
    purpose: "Stop reusable value from leaking away. Valuable decisions, lessons, methods, and stable preferences get buried in long conversations and are never recovered. Harvest sweeps a conversation, lifts the reusable bits into harvest cards (one card per item — a decision, a lesson, a method, a stable preference), the human confirms them, and they land in the right knowledge base. Redaction is a built-in step, not an afterthought: before anything is filed, private material is rewritten into a general, public-safe form. External Recap (ERC) is a separate, dedicated role that runs harvest across MANY conversations at once — guarded by a double lock (a brand-new session AND the human explicitly declaring that role) so an ordinary chat is never swept by accident.",
    trigger: "Run a single-conversation harvest when a discussion produced something worth keeping: a real decision got made, a lesson was paid for, a method was figured out, a stable preference surfaced, or a loop finished. Enter the External Recap role only under the double lock — a fresh session plus an explicit human declaration of the recap role — and only when the job is genuinely cross-conversation (recapping several past sessions at once, not extracting from the current one).",
    antiTrigger: "Do not harvest a chat that produced nothing durable: a quick fact lookup, a dead-end exploration, a routine step with no reusable insight. Do not let a one-off incident become a permanent rule before the pattern has actually repeated. And do not slip into the External Recap role mid-conversation or in an active working session — without the double lock, ERC would fire on everyday chat and bury the knowledge base in low-value cards. Harvesting noise is worse than missing it: a knowledge base full of trivia is one nobody trusts or reads.",
    input: "The full conversation text to sweep (or, for ERC, the set of past conversations to recap). The candidate reusable items spotted in it — decisions, lessons, methods, stable preferences. The target knowledge base each item should land in. The private-material boundary: which names, paths, numbers, and specifics must be rewritten before anything is filed. For ERC specifically, proof of the double lock: that this is a fresh session and that the human explicitly asked for the recap role.",
    inputsDetailed: [
      "Source conversation(s) — the full text to sweep for a single harvest, or the named set of prior sessions to recap for ERC. You cannot harvest what you did not actually read.",
      "Candidate items — the reusable things spotted in the source, each tagged by type: a decision ('we chose X over Y'), a lesson ('this failed because Z'), a method ('here is the repeatable way to do W'), or a stable preference ('the human consistently wants V').",
      "Target knowledge base — where each confirmed card belongs, so a card is filed, not just written and lost.",
      "Private-material boundary — the specific names, local paths, internal numbers, customer or person references that must be rewritten into general form before filing. This is the redaction map.",
      "Human confirmation gate — the explicit yes/no on each card before it lands, so harvest proposes and the human disposes.",
      "ERC double-lock proof (ERC only) — evidence that this is a fresh session AND that the human explicitly declared the recap role, since ERC may not run without both."
    ],
    process: [
      "Sweep the source conversation end to end and pull out candidate reusable items, each tagged by type: decision, lesson, method, or stable preference. Do not generalize from a single occurrence — a one-off only becomes a rule once the pattern has actually repeated.",
      "Turn each candidate into a harvest card: one item per card, stating what it is, why it is reusable, and where it should be filed. A decision card records the choice and the reason; a lesson card records what went wrong and what to do differently; a method card records the repeatable steps; a preference card records the stable want and the evidence it is stable.",
      "Redact as a built-in step, before filing — never after. Replace private material (real names, local paths, internal numbers, customer or person references) with general, public-safe wording. A card that still carries private specifics is not ready to file, no matter how useful it is.",
      "Show the cards to the human and let them confirm, edit, or drop each one. Harvest proposes; the human disposes. Nothing lands in a knowledge base on the AI's say-so alone.",
      "File each confirmed, redacted card into its target knowledge base, and log it so the same insight is not re-harvested next time.",
      "For External Recap (ERC): only with the double lock satisfied (fresh session + explicit human role declaration), run the same harvest across the named set of prior conversations, produce cross-conversation cards and candidates, and hand them back for the human to confirm — recapping, not rewriting the source history, and still redacting before anything is filed."
    ],
    outputShape: [
      "Harvest cards: one per reusable item, each tagged decision / lesson / method / stable preference, with what it is and why it is reusable.",
      "Target knowledge base for each card: where it lands once confirmed.",
      "Redaction record: which private specifics were rewritten into general form before filing.",
      "Repeat evidence for any card proposed as a rule: the occurrences that justify generalizing.",
      "Human confirmation: the yes / edit / drop decision recorded per card.",
      "ERC scope (ERC only): the set of conversations recapped and the double-lock confirmation that authorized the role."
    ],
    template: [
      "Source conversation(s) swept (single harvest) or recapped (ERC):",
      "Candidate items by type (decision / lesson / method / stable preference):",
      "Harvest cards (one item each: what it is + why reusable + target knowledge base):",
      "Redaction record (private specifics rewritten into general form, before filing):",
      "Repeat evidence (occurrences) for anything proposed as a rule:",
      "Human confirmation per card (yes / edit / drop):",
      "ERC double-lock check (fresh session + explicit role declaration) — ERC only:"
    ],
    passBar: [
      "Each reusable item became its own card, tagged by type, instead of a vague 'lessons learned' blob.",
      "Every card was redacted into public-safe wording before filing — no private names, paths, internal numbers, or person references survive.",
      "Anything proposed as a reusable rule rests on a repeated pattern, not a single incident.",
      "The human confirmed (or edited / dropped) each card; nothing was filed on the AI's say-so alone.",
      "Each confirmed card landed in a named knowledge base and was logged so it is not re-harvested.",
      "If the External Recap role was used, the double lock (fresh session + explicit role declaration) was satisfied and recorded."
    ],
    rejectBar: [
      "Harvest stored every detail as cards, so the knowledge base fills with trivia and nobody trusts it.",
      "A card was filed with private specifics still in it — redaction was skipped or left for 'later'.",
      "A single occurrence was promoted straight to a permanent rule with no repeated evidence.",
      "Cards were written into a knowledge base without the human confirming them.",
      "The External Recap role ran without the double lock — on an everyday chat or inside an active working session.",
      "ERC rewrote or exposed the raw source history instead of producing redacted, confirmable recap cards."
    ],
    misuse: [
      "Treating harvest as 'save the whole transcript' — storing everything as cards until the knowledge base is clutter no one reads.",
      "Filing a genuinely useful card before redacting it, so a real name, local path, or internal number leaks into the knowledge base.",
      "Generalizing from one bad run into a permanent rule, so a single incident hardens into law without the pattern ever repeating.",
      "Writing cards straight into the knowledge base without the human's confirmation, turning 'propose' into 'decide'.",
      "Slipping into the External Recap role mid-conversation or in a live working session, so ERC fires without its double lock and sweeps ordinary chat.",
      "Letting ERC paste or rewrite the raw source conversations instead of producing redacted, confirmable recap cards — which re-exposes exactly the private material harvest is supposed to strip."
    ],
    example: "A single-conversation harvest turns one discussion into two cards — a decision card ('chose the temp-cache dry-run path because it isolates the local-cache failure') and a lesson card ('do not label a release before the packaged smoke test runs') — each redacted into public-safe wording, confirmed by the human, and filed; ERC would do the same across several past sessions, but only under its fresh-session-plus-explicit-role double lock.",
    filledExample: {
      scenario: "A working session ends with a real choice having been made about how to verify a synthetic app's release. The discussion is full of useful judgment that would otherwise evaporate. The human says 'harvest this', so the AI sweeps the conversation, proposes cards, redacts them, and files the confirmed ones. (An External Recap would look the same but span several past sessions — here it is a single-conversation harvest, so the ERC double lock is noted as not engaged.)",
      lines: [
        "### Source conversation swept",
        "One working session that debated how to confirm a release was safe, hit a snag with a local cache during packaging, and settled on a specific verification path.",
        "",
        "### Candidate items by type",
        "- Decision: the team chose to run the package dry-run against a temporary cache rather than the default local cache.",
        "- Lesson: an earlier near-miss happened because a release was labeled before the packaged smoke test had run.",
        "- (Considered and dropped) a passing remark about file naming — one-off, no reuse value, not carded.",
        "",
        "### Harvest cards",
        "Card 1 — DECISION. What: when packaging fails only because of a stale local cache, run the dry-run against a temporary cache to isolate the real file-list check from the cache noise. Why reusable: the same cache trap recurs across releases. Target knowledge base: the team's release-practices notes.",
        "Card 2 — LESSON. What: never move a release label from 'candidate' to 'releasable' before the packaged smoke test has actually run and shown a complete file list. Why reusable: it is a guardrail that prevents shipping an incomplete package. Target knowledge base: the release-practices notes, under pre-release checks.",
        "",
        "### Redaction record (before filing)",
        "Replaced the specific app name with 'a synthetic note app'; replaced concrete local cache paths with 'the local cache' / 'a temporary cache'; removed the contributor's name and referred to 'the human' / 'the team'. No real names, paths, or internal numbers remain on either card.",
        "",
        "### Repeat evidence for the rule",
        "Card 2 is proposed as a standing rule, so it is backed by more than this one chat: the same 'labeled too early' miss had shown up in a prior release loop. Two occurrences, not one, justify generalizing it into a rule. Card 1 is filed as a reusable method, not a hard rule, so it needs less.",
        "",
        "### Human confirmation per card",
        "Card 1: confirmed, filed as written. Card 2: confirmed with a small edit (the human tightened 'smoke test' to 'packaged smoke test' for precision), then filed. The dropped file-naming remark: confirmed dropped.",
        "",
        "### ERC double-lock check",
        "Not engaged. This is a single-conversation harvest inside the working session, not a cross-session recap. The External Recap role would require a brand-new session AND an explicit human declaration of that role before it could run across several past conversations; neither applies here, so harvest runs in its ordinary single-conversation form."
      ]
    },
    failures: [
      "Harvest stores every detail and becomes clutter.",
      "External recap exposes private source material.",
      "A single incident becomes a permanent rule without repeated evidence."
    ]
  },
  {
    id: "do-not-handle-yet",
    title: "Do Not Handle Yet",
    purpose: "Protect the main line by explicitly parking tempting but lower-priority work.",
    trigger: "Use when a task reveals adjacent bugs, polish ideas, product questions, or architecture tangents.",
    input: "Main goal, current slice, tempting adjacent item, risk if handled now, and revisit condition.",
    process: [
      "Name the current slice and completion standard.",
      "Write the adjacent item in a parking note.",
      "Explain why handling it now would harm the main line.",
      "Define when to revisit it."
    ],
    template: [
      "Current slice:",
      "Parked item:",
      "Reason not now:",
      "Risk if handled now:",
      "Revisit condition:",
      "Owner decision needed:",
      "Storage target:"
    ],
    example: "During CLI init work, visual branding polish is parked until init, demo, check, privacy scan, and package dry-run are green.",
    failures: [
      "Parking becomes deletion because no revisit condition exists.",
      "The assistant handles the parked item anyway.",
      "The parking note hides a true blocker."
    ]
  },
  {
    id: "plain-language-first-screen",
    title: "Plain-Language First Screen",
    purpose: "Make the first screen explain the result, path, and proof before concepts or framework names.",
    trigger: "Use for README, START_HERE, handoff, review results, and any user-facing guide.",
    input: "Audience, first action, proof artifact, main contrast, and one next step.",
    process: [
      "Start with what the user can do in ten minutes.",
      "Show before/after instead of abstract philosophy.",
      "Name the files or commands that prove the claim.",
      "Move deeper theory below the first-run path."
    ],
    template: [
      "Audience:",
      "First-screen claim:",
      "Ten-minute action:",
      "Before/after proof:",
      "Files or commands:",
      "What this is not:",
      "Next step:"
    ],
    example: "START_HERE opens with the demo path and raw-chat comparison, then links to architecture docs after the user has something runnable.",
    failures: [
      "The first screen becomes a manifesto.",
      "The user sees concepts before a runnable path.",
      "The guide claims value without a before/after proof."
    ]
  },
  {
    id: "honest-calibration",
    title: "Honest Calibration",
    purpose: "Offset the model's built-in eagerness to please by pinning one short user-side prefix to the front of every ask for a rating, an evaluation, or a recommendation: be candid, do not inflate, do not over-hedge. The point is not to hope the AI will be honest — it is to know that, left uncalibrated, a model slides back toward the answer that makes you feel good, so you re-aim it on each ask. The prefix pulls the baseline from make-you-happy back to tell-the-truth, and it matters most exactly where the temptation to flatter is highest: when you are asking the AI to judge your own work, your own ability, or your own output.",
    trigger: "Use whenever you ask the AI to grade, score, place, rank, or recommend — and most of all when the thing being judged is yours: your draft, your plan, your skill level, the quality tier your output would land in, whether something is ready to ship or publish. If a falsely high 'this is great' would cost you (you publish too early, you skip a fix, you misjudge where you really stand), put the calibration prefix in front of the ask.",
    antiTrigger: "Do not bolt it onto a plain fact lookup or a direct instruction to carry out — there is no evaluation to calibrate, so the prefix is just noise. 'Be candid, do not inflate' in front of 'what is the capital of X' or 'rename this file' adds nothing, and a calibration ritual stapled to every message trains you to stop noticing it on the one ask where it actually changes the answer. It is also not a license to flip to harsh: the instruction is to stop both inflating AND over-hedging, not to make the AI negative on command.",
    input: "The specific thing to judge, stated plainly (the draft, the plan, the output, the ability). What the judgment is for (publish / ship / keep iterating / a self-honest gut check), so the AI calibrates to a real bar instead of a vague vibe. The reference frame you want it measured against (a quality tier, a percentile, a named standard, a comparison set) so 'good' has an anchor. The candor prefix itself, placed at the FRONT of the ask, not buried after it. And, when the thing under judgment is your own, an explicit nudge to step outside your point of view and not grade to please you.",
    inputsDetailed: [
      "The exact artifact, ability, or output to evaluate — named concretely so the AI grades a real thing, not a generality.",
      "The purpose of the judgment (decide whether to publish, whether to ship, whether to keep working, or just to know honestly where you stand), so the bar is the real-world consequence, not a feeling.",
      "The reference frame: the quality tier, percentile band, named standard, or comparison set the answer should be measured against, so 'good' or 'B+' is anchored rather than floating.",
      "The candor prefix, placed at the FRONT of the request (be candid, do not inflate, do not over-hedge) — position matters, because a prefix sets the stance before the model starts composing the pleasing version.",
      "When you are the subject (your work, your skill, your output), an explicit 'step outside my perspective and do not grade to make me feel good' so the highest-flattery case gets the strongest calibration.",
      "Optional: permission to deliver the verdict bluntly and lead with the weakest part, so the honest signal is not softened into mush on its way out."
    ],
    process: [
      "Put the candor prefix first, before the actual ask. Lead the request with 'be candid, do not inflate, do not over-hedge' (or your own words for it) so the stance is set before the model reaches for the agreeable framing. A prefix after the question is half as effective as a prefix before it, because by then the answer is already forming around what would please you.",
      "Anchor the judgment to a real bar, not a vibe. Name the reference frame — a tier, a percentile, a named standard, a comparison set — so the AI cannot retreat to a safely flattering 'it's pretty good'. 'Be candid' with nothing to be candid against just produces a more confident vague compliment.",
      "Apply the strongest calibration when the subject is you. Self-evaluation is the peak-flattery case: the model most wants to please you exactly when you are asking about your own work or ability. Add the explicit 'step outside my point of view and do not grade to make me feel good' here, and treat a suspiciously warm verdict on your own output as a signal to re-ask, not as good news.",
      "Read the answer for the tells of an uncalibrated slide-back: it opens with praise and buries the real critique; every weakness is immediately cushioned ('but this is genuinely strong'); the score drifts upward with no new evidence; it agrees with your own stated hope a little too readily. Any of these means the baseline slid back toward make-you-happy and the prefix needs re-asserting.",
      "Re-aim when it slides. The model does not hold the candid stance forever — over a long thread it relaxes back into the pleasing default. When you catch the tells, restate the prefix and ask for the verdict again; do not accept the warmed-over version just because re-asking feels awkward.",
      "Separate the candid verdict from encouragement, and keep them in that order. A useful honest answer can still end with 'and here is the fastest path up' — but the true placement comes first and unhedged, and the encouragement comes after, clearly marked as the next step rather than as a softener that quietly raises the grade."
    ],
    outputShape: [
      "A candid verdict stated first and plainly: the tier, score, percentile, or yes/no, without an opening cushion of praise.",
      "The anchor it was measured against (the named tier, percentile, standard, or comparison set), so the verdict is checkable rather than a floating adjective.",
      "The weakest part led with, not buried: the single biggest reason it is not higher, stated before any reassurance.",
      "No upward drift: the score does not creep higher than the evidence supports, and warmth is not substituted for a number.",
      "Encouragement, if any, clearly separated and placed last — the fastest path up, marked as a next step, never folded back into the grade.",
      "On a self-evaluation, an explicit note that the AI graded from outside your perspective rather than to please you."
    ],
    template: [
      "Candor prefix (paste at the FRONT of the ask): be candid, do not inflate and do not over-hedge; step outside my perspective and do not grade this to make me feel good.",
      "What to judge (the exact draft / plan / output / ability):",
      "What the judgment is for (publish / ship / keep iterating / honest gut check):",
      "Reference frame to measure against (tier / percentile / named standard / comparison set):",
      "Is the subject mine? (if yes, apply the strongest calibration and grade from outside my view):",
      "Candid verdict first (tier / score / percentile / yes-no, no opening praise):",
      "Single biggest reason it is not higher (led with, not cushioned):",
      "Tells of a slide-back to watch for (praise-first / every flaw cushioned / score drifts up / agrees with my hope too fast):",
      "Fastest path up (optional, placed LAST, marked as a next step not a grade-softener):"
    ],
    passBar: [
      "The candor prefix sat at the FRONT of the ask, setting the stance before the answer formed.",
      "The verdict is anchored to a named bar (tier / percentile / standard / comparison set), not a floating 'pretty good'.",
      "The weakest point is stated first and unhedged, rather than buried under an opening of praise.",
      "The score reflects the evidence and did not drift upward, and warmth was not used in place of a real number.",
      "On a self-evaluation, the AI grades from outside your perspective and says so, instead of grading to please you.",
      "Encouragement, if present, is separated out and placed last as a next step — never blended back into the grade."
    ],
    rejectBar: [
      "The answer opens with praise and the real critique is buried below it (the classic flatter-first slide-back).",
      "The verdict is a warm adjective with no anchor — 'this is strong' against nothing checkable.",
      "Every weakness is immediately cushioned so no honest signal survives to the reader.",
      "The grade crept upward across the thread with no new evidence, tracking your stated hope rather than the work.",
      "The prefix was tacked on AFTER the question, so the pleasing version had already formed.",
      "The candor was read as a license to be harsh, producing a put-down instead of an inflation-free, hedge-free truth."
    ],
    misuse: [
      "Stapling the prefix to plain fact lookups and direct instructions, so it becomes background noise you stop noticing on the one ask that needs it.",
      "Putting 'be candid' after the question instead of in front of it, so the model has already composed the agreeable answer before the stance lands.",
      "Accepting a suspiciously warm verdict on your own work because re-asking feels awkward — the peak-flattery case is exactly where you must re-aim.",
      "Treating the prefix as a one-time setting rather than re-asserting it when the thread drifts back toward pleasing you.",
      "Flipping the instruction into 'be harsh', so you trade a flattering distortion for a punitive one instead of getting an undistorted read.",
      "Letting the encouragement at the end quietly raise the grade ('it's a B, but honestly almost an A') so the candid verdict is undone in its own last line."
    ],
    example: "A writer asks an AI to rate a finished essay. With no prefix, the AI opens 'This is a compelling, well-structured piece!' and the real problem — a thesis that never actually lands — shows up softened in paragraph three. The writer re-asks with the calibration prefix at the front: 'Be candid, do not inflate and do not over-hedge, and step outside my view: what tier would this land in on a serious long-form platform, and why not higher?' Now the AI leads with the verdict ('mid-tier, would not stand out — the thesis is stated but never argued') anchored to the platform tier, names the single biggest reason first, and only then offers the fastest path up — clearly marked as a next step, not folded back into the grade.",
    filledExample: {
      scenario: "A solo founder has drafted a launch post for a synthetic product and wants to know, honestly, whether it is ready to publish. They have been staring at it for days and suspect they have lost perspective. They run Honest Calibration rather than just asking 'is this good?'.",
      lines: [
        "### Candor prefix (pasted at the FRONT of the ask)",
        "Be candid, do not inflate and do not over-hedge. Step outside my perspective and do not grade this to make me feel good — I have been staring at it for days and I would rather hear it is mid than publish something mid thinking it is great.",
        "",
        "### What to judge, and what for",
        "This launch post (pasted below). The judgment is for a real decision: publish it as-is to a public audience today, or keep working it.",
        "",
        "### Reference frame to measure against",
        "Where would it land among launch posts that actually get traction — top quartile, solid-but-forgettable middle, or below the bar — and what specifically keeps it out of the top quartile?",
        "",
        "### Candid verdict first (no opening praise)",
        "The AI leads with the placement, not a compliment: \"Solid-but-forgettable middle. It would not embarrass you, and it would not travel. As-is, I would not publish it for a launch you only get to do once.\"",
        "",
        "### Single biggest reason it is not higher (led with, not cushioned)",
        "\"The post explains what the product does but never makes me feel the problem it removes. Top-quartile launch posts open on a sharp, specific pain the reader already feels; yours opens on a feature list. That is the one change that moves it, and everything else is secondary.\"",
        "",
        "### A tell the founder watched for, and did not find",
        "The founder was specifically watching for the flatter-first slide-back — an answer that opened 'This is a strong, clear post!' and buried the real issue underneath. Because the candor prefix sat at the front, the verdict led with the placement instead, and the score did not drift up to match the founder's obvious hope that it was ready.",
        "",
        "### Fastest path up (placed LAST, marked as a next step, not a grade-softener)",
        "\"Next step, not a grade change: rewrite the opening around the single sharpest moment of the pain this removes, then re-judge. That one move is what separates the forgettable middle from a post that gets shared — the rest of the draft is already good enough to carry it once the opening lands.\"",
        "",
        "### Why the prefix changed the outcome",
        "Asked plainly, the same model would almost certainly have opened with warmth and let the founder publish a middle-tier post on the strength of a compliment. The front-loaded candor prefix re-aimed the baseline from 'make the founder feel good' to 'tell the founder the truth', and the explicit 'do not grade to please me' hit exactly the self-evaluation case where the pull to flatter is strongest."
      ]
    },
    failures: [
      "Over a long session the AI drifts back to praising the user's work and the calibration prefix is never re-asserted.",
      "The candid verdict is undercut by an end-of-answer reassurance that quietly raises the grade.",
      "The prefix is treated as a fact-task ritual and stapled everywhere, so it stops registering on the evaluations that need it."
    ]
  },
  {
    id: "feedback-absorption-ledger",
    title: "Feedback Absorption Ledger",
    purpose: "Keep independent judgment alive when you are synthesizing feedback from several sources by scoring each incoming point across five tiers instead of silently rubber-stamping all of it: absorb fully, absorb and refine, absorb with a boundary, partly absorb, or reject with a reason. The trap this defends against is the controller who collects three reviews and quietly accepts everything, becoming a courier for other people's opinions; the equal-and-opposite trap is reflexively rejecting things to look independent. The ledger forces a per-item decision with a stated reason, and treats the absorb/reject ratio as an OUTCOME of honest judgment, never a target to hit.",
    trigger: "Use when you are the one merging feedback from more than one source into a single revision or decision: two or three reviews of the same artifact, a mix of guard verdicts plus a stakeholder's notes, several rounds of comments you have to reconcile, or any moment where 'I got a lot of feedback, now what do I actually do with it' is the real question. It is for the synthesis step, where the temptation to either accept-everything or defend-everything is highest.",
    antiTrigger: "Skip the full ledger for a single piece of feedback you can simply act on, or a trivial note with no judgment call in it (a typo fix, an obvious correction). Scoring one unambiguous comment across five tiers is ceremony, and a ritual you run on feedback that needed no deliberation trains you to skip it on the genuinely conflicting feedback where the per-item discipline is the whole point.",
    input: "Every incoming feedback item, kept as separate line items rather than blurred into one impression (so each can get its own decision). For each, enough of the original to judge it on its merits — what was said, by whom, and the reason behind it if given. The artifact or decision the feedback is about, and the bar it is being held to, so 'absorb' or 'reject' is measured against something. Your own read on each, because the ledger records YOUR judgment, not a vote tally. And a clear understanding that the final ratio is whatever honest per-item judgment produces — you are not aiming for a number.",
    inputsDetailed: [
      "The full set of feedback items, listed separately — one row per point, not a single merged blob, because the method's whole value is a per-item decision.",
      "For each item: what was actually said, the source, and the stated reason if there is one, so you judge the substance instead of the loudest voice.",
      "The artifact or decision under revision and the bar it must meet, so each absorb/refine/reject call is measured against a real standard.",
      "Your own independent read on each item — this is a judgment ledger, not a poll; agreement among sources does not auto-win and a lone dissent is not auto-dismissed.",
      "An explicit reason attached to every reject and every partial-absorb, because an unexplained rejection is indistinguishable from defensiveness.",
      "A clear stance going in that the absorb/reject ratio is an outcome of honest judgment, not a quota — you are forbidden both from rejecting to look independent and from accepting to avoid friction."
    ],
    process: [
      "List every feedback item separately before deciding anything. Resist forming one overall impression of 'the feedback' — the method only works if each point gets its own row and its own verdict.",
      "Score each item into exactly one of five tiers, and write the reason. (1) ABSORB FULLY: the point is right and its scope is clear — take it as-is. (2) ABSORB AND REFINE: the direction is right but you add a more precise version — keep the intent, improve the execution, and note what you added. (3) ABSORB WITH A BOUNDARY: accept it, but bound where it applies, naming the cases it should and should not cover. (4) PARTLY ABSORB: take one part and set aside or defer the rest, splitting the item into what you took and what you did not. (5) REJECT: decline it, and give an independent reason, contrary evidence, or an alternative — a reject with no reason does not count.",
      "Judge substance, not source weight or vote count. Three sources making the same weak point do not outvote one strong objection; a single sharp dissent can be the item you absorb fully while the majority note gets a boundary. The ledger records what is right, not what is popular.",
      "Hold the two opposite disciplines at once. You may NOT reject a sound point just to look independent or to avoid feeling like a courier; and you may NOT absorb a weak point just to avoid friction or to be agreeable. Both are failures of judgment in opposite directions, and the stated reason on each row is what keeps you honest about which one you might be slipping into.",
      "Treat the ratio as a readout, not a goal. After scoring, you can look at how much you absorbed versus refined, bounded, partly took, or rejected — but that distribution is the RESULT of judging each item honestly. Never nudge an individual call to make the overall ratio look more independent or more agreeable; the moment the ratio drives a row's verdict, the ledger is corrupted.",
      "Record the ledger so the synthesis is auditable. Keep the per-item tier and reason, especially for every reject and partial-absorb, so a later reviewer (or your future self) can see that each point was weighed on its merits rather than waved through or swatted away."
    ],
    outputShape: [
      "One row per feedback item — never a merged 'I considered all the feedback' summary.",
      "A single tier per row: absorb fully / absorb and refine / absorb with a boundary / partly absorb / reject.",
      "A stated reason on every row, and specifically an independent reason, contrary evidence, or alternative on every reject and partial-absorb.",
      "For refine rows, what you added beyond the original; for boundary rows, where it does and does not apply; for partial rows, what was taken and what was set aside.",
      "The resulting absorb/reject distribution shown as an outcome readout, with an explicit note that it was not a target.",
      "An auditable trail: enough that a later reader can see each point was judged on its merits, not by vote count or by source weight."
    ],
    template: [
      "Artifact / decision under revision, and the bar it must meet:",
      "Feedback items, listed separately (one row each — do not merge):",
      "Item 1 — what was said / source / its reason:",
      "Item 1 — tier (absorb fully / refine / boundary / partly / reject) + your reason:",
      "Item 2 — what was said / source / its reason:",
      "Item 2 — tier + your reason:",
      "(repeat one row per item — every reject and partial needs an independent reason, contrary evidence, or an alternative)",
      "Discipline check: did I reject anything just to look independent, or absorb anything just to avoid friction?",
      "Ratio readout (how much absorbed / refined / bounded / partly / rejected) — stated as an OUTCOME, not a target:",
      "Auditable note: the synthesis a later reviewer can trace back to per-item judgment:"
    ],
    passBar: [
      "Every feedback item has its own row and exactly one tier — nothing is merged into a single overall impression.",
      "Every reject and every partial-absorb carries an independent reason, contrary evidence, or a named alternative.",
      "Items were judged on substance, not on how many sources said them or how senior the source was.",
      "Neither failure direction is present: nothing was rejected merely to look independent, nothing absorbed merely to avoid friction.",
      "The absorb/reject ratio is presented as an outcome of the per-item calls, with no sign that any row was bent to make the ratio look a certain way.",
      "The ledger is auditable: a later reader can see each point was weighed, not waved through or swatted away."
    ],
    rejectBar: [
      "The feedback was accepted wholesale — 'all good points, I'll incorporate them' — with no per-item decision (the courier failure the ledger exists to prevent).",
      "A point was rejected with no reason, contrary evidence, or alternative, so it cannot be told apart from reflexive defensiveness.",
      "Decisions tracked vote count or source seniority instead of substance (the majority note won just for being the majority).",
      "An individual call was nudged to make the overall ratio look more independent or more agreeable — the ratio drove the verdict.",
      "Sound feedback was declined specifically to avoid feeling like a rubber stamp (independence theater), or weak feedback absorbed specifically to keep the peace.",
      "The items were blurred into one impression, so there is no auditable trail of which point got what verdict and why."
    ],
    misuse: [
      "Collapsing the items into one 'I took the feedback on board' summary, which is exactly the rubber-stamp the ledger is built to stop.",
      "Setting a target ratio ('I should reject about a third to stay independent') and then bending individual calls to hit it — the ratio is an outcome, never a goal.",
      "Rejecting a sound point to perform independence, trading the courier failure for an equal-and-opposite defensiveness.",
      "Absorbing a weak point to avoid friction with the source, then backfilling a reason that does not really hold.",
      "Counting votes — letting three echoes of the same shallow note outweigh one strong objection because three feels like more.",
      "Leaving rejects and partials without a stated reason, so the synthesis cannot be audited and looks identical to swatting feedback away."
    ],
    example: "A controller merging three reviews of a synthetic spec does not write 'all helpful, will incorporate'. They ledger it: reviewer A's data-shape fix is ABSORBED FULLY (right and clearly scoped); reviewer B's 'add retries everywhere' is ABSORBED WITH A BOUNDARY (yes for the network call, no for the local parse, with the reason); reviewer C's 'rename the module' is REJECTED with an independent reason (the name encodes a deliberate distinction C missed) plus an alternative comment. The resulting mix — one full, one bounded, one rejected — is reported as the outcome of judging each on its merits, explicitly not a quota the controller was aiming for.",
    filledExample: {
      scenario: "A maintainer of a synthetic open-source tool gets three reviews on the same pull request and has to merge them into one revision. The instinct is to thank everyone and apply all of it. Instead they run the Feedback Absorption Ledger so the synthesis stays their own judgment.",
      lines: [
        "### Artifact under revision and the bar",
        "A pull request adding a retry wrapper to a synthetic data-fetch tool. Bar: it must be correct, must not retry non-idempotent work, and must stay readable for the next maintainer.",
        "",
        "### Feedback items, listed separately (not merged)",
        "Item 1 (reviewer A): 'The backoff is fixed-interval; under load this will thundering-herd. Use exponential backoff with jitter.'",
        "Item 2 (reviewer B): 'Wrap every external call in the retry, not just the fetch — be consistent.'",
        "Item 3 (reviewer C): 'Rename `fetchOnce` to `fetch`; the `Once` suffix is ugly.'",
        "Item 4 (reviewer A and reviewer B, same point): 'Add a comment explaining the retry budget.'",
        "",
        "### Item 1 — tier + reason",
        "ABSORB AND REFINE. The direction is right (fixed interval is a real herd risk) and I add the more precise version: exponential backoff WITH a cap, so retries do not grow unbounded on a long outage. What I added beyond A's note: the cap, which A did not mention.",
        "",
        "### Item 2 — tier + reason",
        "ABSORB WITH A BOUNDARY. Yes for idempotent reads, NO for the write path — blindly retrying a non-idempotent write can double-apply it. Boundary stated in code and review reply: retry wraps reads only; writes are explicitly excluded with a reason.",
        "",
        "### Item 3 — tier + reason",
        "REJECT, with an independent reason and an alternative. `Once` is not ugliness — it encodes that the function performs exactly one attempt, which is the contract the retry wrapper depends on; renaming it to `fetch` would blur that distinction and invite someone to add a second internal retry. Alternative offered to C: if the suffix reads oddly, rename to `fetchAttempt`, which keeps the single-attempt meaning. Not rejected to look independent — rejected because the name carries information C's note would erase.",
        "",
        "### Item 4 — tier + reason",
        "ABSORB FULLY. Right and clearly scoped, and the fact that two reviewers raised it does not change the verdict — it would be a full absorb even as a lone note, because a retry budget is genuinely opaque without a comment. (Logged explicitly so the ledger shows substance decided it, not the vote count.)",
        "",
        "### Discipline check (both directions)",
        "Did I reject anything just to look independent? Checked item 3 specifically — no; the reason stands on the contract, and I offered C a real alternative. Did I absorb anything just to avoid friction? Checked item 2 — I could have just said yes to 'wrap everything' to be agreeable, but the write-path boundary is load-bearing, so it gets a boundary, not a full absorb.",
        "",
        "### Ratio readout (outcome, not a target)",
        "Of four items: one full, one refine, one boundary, one reject. I was not aiming for any split — this is simply what judging each point on its merits produced. If all four had been sound I would have absorbed all four; the one rejection is there because one point did not hold, not to keep a ratio looking independent.",
        "",
        "### Auditable note",
        "The PR revision links each change back to its ledger row, so the next maintainer can see why writes are excluded from retry and why `fetchOnce` kept its suffix — the synthesis is traceable to per-item judgment, not a wholesale 'applied all review feedback'."
      ]
    },
    failures: [
      "The reviewer accepts all incoming feedback wholesale and the synthesis becomes a courier for other people's opinions rather than an independent revision.",
      "A target ratio creeps in and individual calls get bent to hit it, so the ledger stops recording honest judgment.",
      "Rejects and partial-absorbs are left without reasons, so the synthesis cannot be audited and looks the same as reflexive defensiveness."
    ]
  },
  {
    id: "collaboration-coach",
    title: "Collaboration Coach",
    purpose: "Make the assistant proactively remind the user of the matching collaboration step at six recurring moments — define done, review a completion claim, hand off, harvest, update the profile — instead of waiting to be asked, so the workspace teaches itself while the user works rather than sitting unused behind a manual. The hard constraint is restraint: prompt at key moments only, once per moment, never every turn, because over-prompting is the fastest way to get the whole system uninstalled.",
    trigger: "Run it as a standing behavior the moment a collaboration moment fires: a new task or vague idea arrives, the assistant is about to act before 'done' is defined, it just claimed completion, the thread is getting long or work is moving to another tool, a reusable judgment or lesson surfaced, or the same preference has shown up several times. The point is that the assistant raises the matching step on its own at that moment, not three turns later when the user finally remembers to ask.",
    antiTrigger: "Do not prompt on low-stakes, fast-turn work: a quick fact lookup, a one-line edit, a yes/no confirmation, a casual exchange, or any moment where the user clearly just wants the answer. Do not re-fire a reminder the user already acted on or explicitly waved off. A reminder on trivial work is noise, and noise on every turn trains the user to mute the coach exactly when a real high-stakes moment arrives — so the failure here is not 'missed a prompt', it is 'prompted so often the user turned it off'.",
    input: "The live collaboration moment (which of the six nodes is firing, and the signal that tripped it). The current restraint tier (light / standard / strict), defaulting to standard. Whether this exact reminder has already fired or been dismissed in this thread, so it is not repeated. For the completion-claim node: how many model families are available, so the right guard depth is named (one family -> single-tool-guard; a second different family -> dual-guard; multi-tool -> full fusion review). The matching concrete next action for whichever node fired, so the prompt hands the user a step, not a lecture.",
    inputsDetailed: [
      "The firing node (1 task start, 2 pre-execution, 3 completion claim, 4 long thread / tool switch, 5 reusable insight, 6 repeated preference) and the signal that tripped it.",
      "Restraint tier: light (nodes 3 and 4 only), standard (default — fire at nodes 1, 3, 4, 6; fold node 2 into the task-start reminder and node 5 into a natural pause; count once-per-moment by task phase not by node), or strict (all six, every time they fire); default standard.",
      "Already-fired / dismissed memory for this thread, so a reminder is not repeated after the user has acted on it or waved it off.",
      "Model-family count at the completion-claim node, so the guard depth is named correctly (one -> single-tool-guard, two different -> dual-guard, multi-tool -> full fusion).",
      "The concrete next action attached to the firing node, so the prompt offers a step (write the acceptance card, open single-tool-guard, write the handoff) rather than an abstract nudge.",
      "User restraint command, if any (\`coach: light\` / \`coach: standard\` / \`coach: strict\`), which changes how often the coach speaks up."
    ],
    process: [
      "On the FIRST message after install, act proactively: introduce yourself, offer to scan the user's recent work, state the privacy boundary before scanning (the scan is run by you, the cloud AI they already use, so content passes through your provider like any normal chat — not 'zero data leaves the machine'), and respect their yes / narrow / no choice — not just recite a list of future reminder moments. Then say reminders are restrained by default and switchable with \`coach: light\` / \`coach: strict\`. Do this once, then stop.",
      "Map each firing moment to its node and reminder. 1 Task start -> set a context boundary and acceptance before building. 2 Pre-execution -> define the acceptance card first. 3 Completion claim -> run a guard review before trusting it. 4 Long thread / tool switch -> generate a handoff instead of relying on chat memory. 5 Reusable insight -> harvest it into a card. 6 Repeated preference -> offer it as a profile-update candidate.",
      "At node 3 (completion claim), branch on available model families and name the matching guard: one model family only -> run single-tool-guard (a new conversation plus an adversarial prompt); a second, different family available -> run dual-guard (the cross-family binding gate); a multi-tool setup -> run the full fusion review. Do not silently skip the branch and just say 'looks good'.",
      "Apply the restraint tier before speaking. Light: only fire at nodes 3 and 4. Standard (default): fire at nodes 1, 3, 4, 6 — fold node 2 into the task-start reminder (skip it entirely if node 1 already landed an acceptance card) and node 5 into a natural pause, not a separate interruption; count \"once per moment\" by task phase, not by node, so the opening of one task is a single moment even if nodes 1 and 2 both trip — never stack reminders on back-to-back turns at a task's start, and never re-raise a reminder already acted on. Strict: fire at all six every time they trip. If a tier would make you repeat a just-given reminder, stay silent instead.",
      "Keep each reminder to one or two sentences that hand over the concrete next step, then continue the actual work. Do not pause to explain the philosophy of the layer, do not stack multiple reminders into a wall, and do not lecture — a prompt the user cannot act on in one move is noise.",
      "Honor a restraint switch immediately. When the user says \`coach: light\` / \`coach: standard\` / \`coach: strict\`, change tier for the rest of the session without arguing, and confirm the new tier in a few words."
    ],
    outputShape: [
      "First-run promise: on the first reply, the assistant proactively introduces itself, offers to scan the user's recent work, states the privacy boundary before scanning, and respects the user's yes / narrow / no choice — rather than passively reciting a list of future reminder moments.",
      "Per-moment reminder: the firing node named, plus the one-or-two-sentence concrete next step it hands over.",
      "Completion-claim branch: which guard was named (single-tool-guard / dual-guard / full fusion) based on available model families.",
      "Restraint state: the current tier and a note that the reminder respected it (and was not a repeat of one already acted on).",
      "Tier change acknowledgement: when the user switches, the new tier confirmed in a few words.",
      "Continuation: the reminder is followed by getting on with the actual task, not by a paragraph of theory."
    ],
    template: [
      "First-run promise (first reply, proactive — introduce + offer to scan + state the privacy boundary + respect yes / narrow / no):",
      "Firing node (1-6) and the signal that tripped it:",
      "Restraint tier in effect (light / standard / strict; default standard):",
      "Already fired or dismissed this thread? (if yes, stay silent):",
      "Matching reminder (one or two sentences, hands over the concrete next step):",
      "Completion-claim branch (one family -> single-tool-guard / two different -> dual-guard / multi-tool -> full fusion):",
      "Tier change to acknowledge (if the user said coach: light / standard / strict):",
      "Continue the actual task:"
    ],
    passBar: [
      "On the first reply the assistant acted proactively: it introduced itself, offered to scan recent work, stated the privacy boundary before scanning, respected the user's yes / narrow / no choice, and did not repeat the intro afterward.",
      "Each reminder fired at the right node with a concrete next step the user can act on in one move.",
      "The completion-claim node named the correct guard depth for the number of model families available.",
      "Restraint held: standard by default, once per moment, no reminder the user already acted on was re-raised, and a \`coach:\` switch was honored immediately.",
      "Reminders stayed short and the assistant got back to the work instead of lecturing about the layer."
    ],
    rejectBar: [
      "A reminder fires every turn, or the same reminder is repeated after the user already acted on it (over-prompting — the uninstall path).",
      "The completion-claim node says 'looks good' or skips the guard branch instead of naming single-tool-guard / dual-guard / full fusion.",
      "A reminder hands over a lecture or a vague nudge instead of a concrete next step.",
      "The default silently runs at strict (all six, every time) when the user never asked for it, burying the signal.",
      "A \`coach:\` restraint switch is ignored or argued with instead of applied for the rest of the session."
    ],
    misuse: [
      "Turning every turn into a reminder so the user mutes the coach — the most common way this mechanism gets the whole system uninstalled, and the exact opposite of thoroughness.",
      "Naming a step but not the action: 'you should probably guard this' with no pointer to single-tool-guard or dual-guard, so the user is reminded but not moved.",
      "Skipping the completion-claim branch and rubber-stamping 'done' as 'looks good', which is the one node that exists to stop a fluent false completion.",
      "Lecturing the theory of the coaching layer mid-task instead of handing over one concrete step and continuing.",
      "Defaulting to strict (or to silent) instead of standard, so the user either drowns in prompts or never gets the reminder that mattered.",
      "Re-firing a reminder the user already dismissed, which reads as nagging and trains them to ignore the next one."
    ],
    example: "A synthetic execution session reaches a 'done, implemented and tested' claim. At the completion-claim node the coach fires once, sees only one model family is available, and points the user to single-tool-guard (new conversation plus an adversarial prompt) instead of accepting the fluent claim — then continues, without lecturing.",
    filledExample: {
      scenario: "A solo user is working in one AI tool on a small synthetic feature. The coach runs at standard. The session passes through several collaboration moments; this shows the coach firing at the completion-claim node, once, with a concrete next step.",
      lines: [
        "### First-run: act proactively the first time",
        "\"You just installed a collaboration discipline — before I say 'done' I'll show evidence, when I'm unsure I'll pull in a second AI, you won't re-explain when you switch tools, and I'll help you save what's worth keeping. Want me to take 30 seconds and look at a few of your recent tasks to show you what this changes?\" Then it offers a scan, respects yes / narrow / no, and gets to work; it does not repeat this.",
        "",
        "### Firing node and signal",
        "Node 3, completion claim. The execution assistant just returned: \"Done. I implemented the new sort option and added a test; everything passes.\" That 'done / everything passes' phrasing is the signal.",
        "",
        "### Restraint tier in effect",
        "Standard (default). Nodes 1 and 2 already fired once earlier this session (a one-line 'want to set acceptance first?' at task start), so they are not re-raised. Node 3 has not fired yet, so it may fire now — once.",
        "",
        "### Matching reminder (one or two sentences, concrete next step)",
        "\"Before trusting that 'done', this is the completion-claim moment — worth a guard review. You're on a single tool right now, so the fitting move is single-tool-guard: open a fresh conversation and paste an adversarial reviewer prompt against this claim. Want the prompt?\"",
        "",
        "### Completion-claim branch",
        "Only one model family is available, so the coach named single-tool-guard (new conversation + adversarial prompt), explicitly NOT dual-guard. It noted in passing that if a second, different model family were available, the stronger move would be the cross-family dual-guard, and a multi-tool setup would run the full fusion review.",
        "",
        "### Tier change to acknowledge",
        "None this turn. (If the user had said 'coach: light', the coach would have confirmed 'switched to light — I'll only flag completion claims and tool switches now' and applied it for the rest of the session.)",
        "",
        "### Continue the actual task",
        "After the one reminder, the coach drops it and continues helping with the feature. It does not re-raise the guard reminder on the next turn, and it does not deliver a paragraph on why guarding matters — the user already has the one step they can act on."
      ]
    },
    failures: [
      "The coach fires a reminder on every turn until the user switches it off entirely, losing the one prompt that would have mattered.",
      "The completion-claim node is reduced to 'looks good' and never names a guard, so a fluent false 'done' passes unchallenged.",
      "Reminders arrive as theory lectures rather than one concrete next step, so the user reads them as noise and stops acting on them."
    ]
  },
  {
    id: "single-tool-guard",
    title: "Single-Tool Guard",
    purpose: "Give a one-model-family user — the realistic default for most solo users, who have exactly one tool — a real guard to START from, not a downgrade to settle for. With a single AI you still turn 'done' into an evidence-backed, re-checkable result. The single-tool guard runs a fresh conversation plus an adversarial reviewer prompt instead of trusting the same assistant that just wrote it. It honestly does NOT equal the cross-family binding gate: it catches fewer real problems, so the verdict is always labeled not-yet-binding, capped at L2, with the residual risk named on the record. The cross-family dual-guard is the upgrade ceiling, not the entry bar.",
    trigger: "This is the default starting point for solo users, who have exactly one tool. Use it at a completion claim when only one model family is available and you would otherwise trust the same assistant that just produced the work: a 'done, tested, shipped' claim, a deliverable about to be handed on, or any output where a wrong 'looks fine' would propagate. It is not a fallback you reach for once a cross-family setup fails — it is where most real work begins, and a single AI here already gives you an evidence-backed, re-checkable result instead of a trusted 'looks fine'.",
    antiTrigger: "Do not use it as a substitute for a cross-family pass when a second, different model family IS available — in that case run dual-guard, because the cross-family binding gate catches what same-family review cannot. Skip it entirely for low-stakes, easily reversible work a human will fully re-check anyway: a quick fact, a one-line tweak, a throwaway draft. Running an adversarial review on trivial work is ceremony, and ceremony you pay for nothing trains people to skip the review when it actually matters.",
    input: "The artifact under review, with stable line or section references the reviewer can point to. The acceptance card or definition of done it claims to meet. The completion claim's evidence — command output, test results, a reproduced result — or an explicit note that none exists. The context boundary (goal, scope, non-goals) so the reviewer can catch scope drift. A clear acknowledgement that only one model family is available, which is why this is a single-family review and not a cross-family binding pass.",
    inputsDetailed: [
      "Artifact under review, with line numbers or section anchors so a finding cites an exact spot, not a vibe.",
      "Acceptance card / definition of done: the checkable criteria the artifact claims to satisfy.",
      "Completion-claim evidence: the actual command output, test result, or reproduced behavior the claim rests on, or an explicit note that none exists.",
      "Context boundary: goal, in-scope, and explicit non-goals, so the reviewer can catch scope drift.",
      "Single-family acknowledgement: a stated note that only one model family is available, so the verdict is framed as not-yet-binding from the start.",
      "The original drafting thread is deliberately NOT reused: a fresh conversation is opened, because the original thread carries the assistant's eagerness to please and its memory of having just claimed done."
    ],
    process: [
      "Open a NEW conversation. Use a fresh context — the original thread carries the assistant's eagerness to please and its memory of having just claimed done, both of which suppress the very objections you need.",
      "Paste an ADVERSARIAL reviewer prompt: instruct the assistant to default to refuting the work, to hunt for missing evidence rather than confirm, and to tie every finding to a specific line or section. The frame must actually be adversarial, not 'take a look'.",
      "Give it the artifact plus the acceptance card and the completion claim's evidence (or the explicit note that none exists). Ask it to check each completion claim against the evidence, whether the acceptance criteria are met, and whether scope drifted past the stated non-goals.",
      "Mark the verdict explicitly as \`single-family-only — cross-family binding gate NOT passed\`, and name the residual risk (what a same-family reviewer is most likely to have missed). Never record this as a passed dual-guard.",
      "Resolve each finding one of two ways: fix it and re-show the evidence in another fresh adversarial pass, or carry it explicitly as named residual risk the owner accepts on the record. A silent 'good enough' is not allowed here either.",
      "Upgrade path: when a second, different model family becomes available, still run one cross-family binding pass. The single-tool guard is the floor, not the ceiling."
    ],
    outputShape: [
      "Guard level: this is L2 at best (single tool, author-supplied evidence). It CANNOT reach the cross-family L3 gate, so it cannot return a plain pass.",
      "Verdict: one of the four standard states, but bounded by L2 — the strongest a single-tool guard may give is pass_with_risk; it must NOT be recorded as a passed dual-guard. Use reject for a real defect and insufficient_evidence when the completion claim has no evidence at all.",
      "Findings, each tied to a specific line or section, produced under an actually-adversarial frame (not a 'looks good' rubber stamp).",
      "Residual risk: what a same-family reviewer most likely still missed, named on the record.",
      "Owner sign-off: a pass_with_risk is not 'accepted' on the guard's say-so — a human must explicitly accept the named residual risk on the record.",
      "Required fixes: the concrete change each blocker needs, to be re-checked in another fresh adversarial pass.",
      "Acceptance record: for any finding carried rather than fixed, who accepted the residual risk.",
      "Upgrade note: a reminder to run one cross-family binding pass once a second, different model family is available (that is what lifts the ceiling from L2/pass_with_risk to L3/pass)."
    ],
    template: [
      "Artifact under review (with line/section refs):",
      "Acceptance source / definition of done:",
      "Completion claim's evidence (or explicit 'none exists'):",
      "Single-family acknowledgement (only one model family available):",
      "Fresh conversation opened? (must be yes — do not reuse the drafting thread):",
      "Adversarial reviewer prompt used (default to refute, hunt missing evidence, cite specific spots):",
      "Findings (each cites a line/section/missing evidence):",
      "Guard level reached — L2 at most (single tool); a clean pass would need the cross-family L3 pack:",
      "Verdict — pass_with_risk / reject / insufficient_evidence (NEVER a plain pass; NEVER recorded as a passed dual-guard):",
      "Residual risk (what a same-family reviewer likely still missed) and who accepted it (a pass_with_risk needs an explicit owner sign-off):",
      "Required fixes (re-check in another fresh adversarial pass):",
      "Upgrade path (run a cross-family binding pass when a second family is available):"
    ],
    passBar: [
      "The verdict is at most pass_with_risk (the L2 ceiling) and is NOT recorded as a plain pass or a passed cross-family binding gate.",
      "Residual risk is named — what a same-family reviewer most likely still missed is on the record, not left blank.",
      "Any pass_with_risk has an explicit owner sign-off on the named residual risk; the guard did not mark it accepted on its own.",
      "Every finding is tied to a specific line or section, not a general impression.",
      "The adversarial frame was actually used (default-to-refute, hunt-for-missing-evidence), in a fresh conversation, not a 'looks good' rubber stamp from the original thread.",
      "The upgrade path is noted: a cross-family binding pass is still owed once a second, different model family is available (that is what lifts the ceiling to L3/pass)."
    ],
    rejectBar: [
      "The single-family review is recorded as a plain pass or as if it cleared the binding gate (the head failure — a same-family pass dressed up as dual-guard / L3).",
      "A pass_with_risk is treated as accepted without an explicit owner sign-off on the residual risk.",
      "No residual risk is named, so the next session inherits a hidden gap and assumes more assurance than the pass actually provides.",
      "The reviewer only graded tone, fluency, or style instead of checking claims against evidence.",
      "The drafting thread was reused instead of a fresh conversation, so the assistant's just-claimed-done eagerness suppressed the objections.",
      "The frame was not adversarial — it was a 'take a look' that produced an agreeable 'seems fine'."
    ],
    misuse: [
      "Treating a same-family single review as having passed dual-guard. Same-family reviewers miss the same things; a single-tool pass catches fewer real problems, so it must always be labeled as not-yet-binding, with the residual risk on the record.",
      "Skipping the fresh conversation and asking the same thread that just said 'done' to review itself, where its eagerness to please buries the objections.",
      "Using a soft 'review this' prompt instead of an adversarial default-to-refute frame, which produces an agreeable rubber stamp rather than findings.",
      "Leaving the residual risk blank, so a reader of the record assumes the artifact got more assurance than a single-family pass can give.",
      "Reviewing against tone and fluency with no acceptance card or evidence, so the pass grades how it reads instead of whether the claims hold.",
      "Treating the single-tool guard as the ceiling and never running the cross-family binding pass even after a second, different model family becomes available."
    ],
    example: "A solo user on one model family gets a confident 'done and tested' claim, opens a fresh conversation, and pastes an adversarial reviewer prompt. The review finds a claimed test that does not exist and ties it to the line. The verdict is recorded as `single-family-only — cross-family binding gate NOT passed`, with the residual risk (a same-family reviewer may share the drafter's blind spots) named on the record.",
    filledExample: {
      scenario: "A solo developer has only one model family available. Their execution assistant returned a confident completion claim. Rather than trust the same assistant, they run Single-Tool Guard: a fresh conversation plus an adversarial reviewer prompt, with the verdict explicitly labeled as not-yet-binding.",
      lines: [
        "### Artifact under review (with line/section refs)",
        "A short completion report plus a code block from the execution assistant. The report says: \"Done. I added the CSV export and a test that covers it; everything passes.\" The code block is pasted with line numbers so the reviewer can cite exact lines.",
        "",
        "### Acceptance source / definition of done",
        "AC1: a button exports the current rows to CSV. AC2: there is an automated test that fails before the change and passes after. AC3: empty-table export produces a header-only file, not a crash. AC4: existing data is untouched.",
        "",
        "### Completion claim's evidence (or explicit 'none exists')",
        "The report asserts 'everything passes' but pastes NO command output and NO test run. Evidence: none provided. That gap is recorded explicitly.",
        "",
        "### Single-family acknowledgement",
        "Only one model family is available. So this is a single-family review from the start, and the verdict will be labeled accordingly — it cannot be a cross-family binding pass.",
        "",
        "### Fresh conversation opened?",
        "Yes. A brand-new conversation is opened; the original drafting thread is NOT reused, because that thread just claimed 'done' and is primed to defend it.",
        "",
        "### Adversarial reviewer prompt used",
        "\"You are an adversarial reviewer. Default to refuting this completion claim. Hunt for missing evidence. Tie every finding to a specific line or section. Do not be agreeable; if a claim lacks proof, say so.\"",
        "",
        "### Findings (each cites a line/section)",
        "- AC2 UNSUPPORTED. The pasted code shows the export function but NO test file and NO test run output. 'Added a test; everything passes' has no evidence behind it at the cited lines.",
        "- AC3 FAIL. The export maps over the rows with no empty-table branch, so an empty table would write a malformed (or empty) file rather than a header-only file — the cited loop has no guard.",
        "- AC1 PLAUSIBLE but unverified: the export function is present and looks correct, but with no run output it is asserted, not proven.",
        "",
        "### Verdict",
        "`single-family-only — cross-family binding gate NOT passed`. Reject as a completion claim: AC2 has no evidence and AC3 has a real defect. This is explicitly NOT recorded as a passed dual-guard.",
        "",
        "### Residual risk (what a same-family reviewer likely still missed) and who accepted it",
        "A same-family reviewer shares the drafter's blind spots, so it may have missed an issue a different model family would catch — for example a CSV-escaping bug (commas or quotes inside a cell) that neither the drafter nor this same-family reviewer flagged. The owner accepts this residual risk for now, on the record, pending a cross-family pass.",
        "",
        "### Required fixes (re-check in another fresh adversarial pass)",
        "1. Add the empty-table header-only branch. 2. Add the automated test and paste its fail-then-pass output. Re-review in a new adversarial conversation once both exist.",
        "",
        "### Upgrade path",
        "When a second, different model family becomes available, still run one cross-family binding pass — especially on the CSV-escaping risk a same-family review is most likely to share the blind spot on."
      ]
    },
    failures: [
      "The single-family pass is filed as a passed dual-guard, so the next session believes the cross-family binding gate cleared it when it never ran.",
      "The drafting thread reviews itself and its eagerness to please buries the objections a fresh adversarial conversation would have surfaced.",
      "The residual risk is left unnamed, so the record overstates how much assurance a one-family review actually provides."
    ]
  }
];

export const requiredWorkspaceDirs = [
  "profile",
  "context",
  "acceptance",
  "guard",
  "handoff",
  "harvest",
  "roles",
  "modes",
  "mechanisms",
  "prompts",
  "skills",
  "adapters",
  "examples",
  "cookbook",
  "state",
  "privacy"
];

export const requiredPromptFiles = promptDefinitions.map((prompt) => prompt.file);
export const requiredSkillIds = skillDefinitions.map((skill) => skill.id);
export const requiredAdapterIds = adapterDefinitions.map((adapter) => adapter.id);
export const requiredCaseIds = caseDefinitions.map((item) => item.id);
export const requiredMechanismIds = mechanismDefinitions.map((item) => item.id);
