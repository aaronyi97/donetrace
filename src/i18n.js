// === i18n (bilingual EN/ZH, honesty-faithful) ===============================
//
// This module makes the CLI speak the user's language WITHOUT softening a single
// honesty marker. English is the CANONICAL source of truth: every key has an `en`
// value (the exact wording the CLI shipped with), and the Chinese (`zh`) value is a
// FAITHFUL, NON-SOFTENED translation. Where a string carries a trust caveat
// (unverified / self-declared / proposed / pending / not signed off), the Chinese
// keeps that caveat verbatim — it is a red line that an "unverified" claim is never
// rendered as "done/verified/saved" in any language.
//
// Three pure exports:
//   resolveLocale({ langFlag, env }) -> 'en' | 'zh'  (the precedence ladder)
//   t(key, params, locale)           -> the localized string ({name} interpolated)
//   MESSAGES                         -> the catalog (en canonical, zh faithful)
//
// Fallback chain in t(): zh missing -> en -> the key itself. So a not-yet-translated
// key degrades to English (never an empty line, never a crash), and a typo'd key
// surfaces as its own name rather than blank — visible, debuggable, never silent.

// --- Locale resolution ------------------------------------------------------
//
// Precedence (highest first), per the product contract:
//   1. an explicit --lang <en|zh> flag (the user said so on THIS run)
//   2. the AI_COLLAB_LANG env var (a per-shell / CI override)
//   3. the OS locale: LC_ALL > LC_MESSAGES > LANG (POSIX precedence); a value whose
//      language part starts with "zh" -> 'zh'
//   4. default 'en' (English is the canonical fallback)
// Pure: it reads only its arguments (env is passed in, never process.env directly),
// so it is trivially testable for every branch.
export function resolveLocale({ langFlag, env = {} } = {}) {
  // 1) Explicit flag wins outright. Only the two supported values are honored; any
  //    other value (a typo) falls through to the next source rather than throwing,
  //    so a mistyped --lang never hard-fails a command (it just is not applied).
  if (langFlag === "en" || langFlag === "zh") return langFlag;

  // 2) AI_COLLAB_LANG env override. Same two-value contract as the flag.
  const envLang = typeof env.AI_COLLAB_LANG === "string" ? env.AI_COLLAB_LANG.trim().toLowerCase() : "";
  if (envLang === "en" || envLang === "zh") return envLang;

  // 3) OS locale, POSIX precedence LC_ALL > LC_MESSAGES > LANG. We look at the
  //    language part (before any "_"/"." ) and only special-case "zh" -> 'zh';
  //    everything else (and an empty/"C"/"POSIX" locale) leaves us at the default.
  const osLocale =
    firstNonEmpty(env.LC_ALL) ??
    firstNonEmpty(env.LC_MESSAGES) ??
    firstNonEmpty(env.LANG);
  if (typeof osLocale === "string") {
    const lang = osLocale.toLowerCase();
    if (lang.startsWith("zh")) return "zh";
  }

  // 4) Default: English (canonical).
  return "en";
}

// Return the trimmed string if it is a non-empty string, else undefined — so the
// ?? ladder in resolveLocale falls through empty env vars (LC_ALL="" must NOT win).
function firstNonEmpty(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// --- Interpolation ----------------------------------------------------------
//
// Replace {name} placeholders with params.name. A param that is undefined/null is
// rendered as the empty string (so a missing param never prints the literal "{name}"
// nor "undefined"); a placeholder with no matching param is left intact so the gap
// is visible rather than silently swallowed. Pure string transform.
function interpolate(template, params) {
  if (typeof template !== "string") return template;
  if (!params || typeof params !== "object") return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) => {
    if (Object.prototype.hasOwnProperty.call(params, name)) {
      const value = params[name];
      return value === undefined || value === null ? "" : String(value);
    }
    return whole; // unknown placeholder: leave as-is (visible, not swallowed)
  });
}

// --- t(): the lookup + fallback + interpolation -----------------------------
//
// Resolve `key` in the requested locale, falling back zh -> en -> key, then
// interpolate {params}. `locale` defaults to 'en' so a caller that forgets to thread
// it still gets the canonical English (never a crash, never an empty string).
export function t(key, params = {}, locale = "en") {
  const lang = locale === "zh" ? "zh" : "en";
  const table = MESSAGES[lang] || {};
  let template = table[key];
  if (template === undefined && lang !== "en") {
    // zh miss -> English canonical.
    template = MESSAGES.en[key];
  }
  if (template === undefined) {
    // Still missing -> the key itself (visible + debuggable, never empty/blank).
    return key;
  }
  return interpolate(template, params);
}

// --- The catalog ------------------------------------------------------------
//
// Organized by dotted key. en = canonical (verbatim from the shipped CLI so English
// output is byte-identical and the existing English test assertions keep passing).
// zh = faithful translation; honesty caveats are preserved word-for-word per the
// authoritative glossary, NEVER softened into "done/verified/saved".
export const MESSAGES = {
  en: {
    // ---- shared / cross-cutting ----
    "common.networkNotUsed": "Network: not used.",
    "common.untitled": "(untitled)",

    // ---- guard-level plain language (the honesty ladder, in one clause each) ----
    "level.L0": "summary only — not enough evidence to pass",
    "level.L1": "evidence too thin to pass yet — add a real run/output",
    "level.L2": "single-tool check — accept only with eyes-open risk",
    "level.L2_5": "same tool, different model — still single-family, accept with risk",
    "level.L3": "cross-family pass — re-checked by a different model family (self-declared)",
    "level.L4": "strongest local pass — cross-family review plus a reconciled rerun",
    // The self-declared marker, surfaced verbatim wherever a cross-family receipt shows.
    "marker.selfDeclaredCrossFamily": "self-declared cross-family, unverified",

    // ---- welcome (the proactive onboarding intro the CLI prints VERBATIM) ----
    // This is HARD-PRINTED, fixed copy: the AI installs the pack, then runs `welcome`
    // and shows the user this output as-is, so the intro is guaranteed to appear in
    // full instead of being re-summarized (and possibly garbled) by the model. The
    // English is the canonical source; the zh twin is the Owner-locked 4th draft.
    // Honesty contract: the privacy line is faithful — it does NOT claim "zero data
    // leaves your machine". The tool itself is offline and uploads nothing, but the
    // ONE optional "let me scan your recent work" step is the AI reading your work and
    // passing it through its provider the same as any normal chat, so we say so plainly
    // rather than over-claiming privacy.
    "welcome.intro":
      "✅ Your AI collaboration pack is installed\n" +
      "\n" +
      "You just gave your AI tool (Claude Code / Cursor / Codex, etc.) a local collaboration\n" +
      "framework — think of it as scaffolding for the AI, so it works more reliably, gets to\n" +
      "know you, and does not start from scratch every time.\n" +
      "The tool itself does not go online and uploads nothing; your material stays on your\n" +
      "machine. The one exception is when you ask me to \"take a look at your work\": that one\n" +
      "step is me, the AI, reading it and passing it through my provider the same way our\n" +
      "normal chat already does — the tool itself sends nothing.\n" +
      "\n" +
      "[Six layers of ability added to your AI]\n" +
      "  Profile   Builds a local profile of you that gets to know you the more you use it.\n" +
      "  Context   Gives every task its own file, so work carries across conversations.\n" +
      "  Acceptance Pins down \"what counts as done\" before any work starts, so the AI does not drift.\n" +
      "  Guard     Demands evidence before saying \"done\", and can pull in a second AI to re-check.\n" +
      "  Handoff   Switch tools or conversations without re-explaining the background.\n" +
      "  Harvest   Captures the lessons worth keeping, so you can reuse them next time.\n" +
      "\n" +
      "[What you will actually notice change]\n" +
      "  · The AI no longer just says \"done\" when it is not — it has to prove it with evidence.\n" +
      "  · Important decisions get a dual-guard re-check; it is not one AI's word alone.\n" +
      "  · Switch conversations or tools, and the background is not lost.\n" +
      "  · When you are stuck, it helps you untangle your thinking.\n" +
      "\n" +
      "[Stuck on something? Just say the keyword and the AI switches to the matching mode]\n" +
      "  Say \"collision mode\"  → the AI argues your view and pokes at logic holes, to make a fuzzy idea clear\n" +
      "  Say \"scan blind spots\" → the AI takes an outside view to find the dead angles you cannot see\n" +
      "  Say \"red team\"        → the AI deliberately attacks the weaknesses in your plan\n" +
      "  (There is also dual-guard re-check, root-cause analysis, and more — just ask when you need them)\n" +
      "\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "Before you dive into work — take 30 seconds and let me show you, first-hand, what it can do for you.\n" +
      "I will take a look at your recent work right now and point out, on the spot:\n" +
      "  · Which tasks you thought were \"done\" actually left no verification evidence (the easiest trap to fall into)\n" +
      "  · The high-risk tasks you recently touched, and which helper roles (red team / dual guard) should vet them\n" +
      "  · A working-habits profile read from your actual work (you confirm or correct it — no form to fill in)\n" +
      "  · The lessons from this round worth saving\n" +
      "You do not have to do anything — just reply \"go ahead\" and I will start. Try it once and you will see where it earns its keep. Want me to take a look right now?",

    // ---- init (writing) ----
    "init.created.title": "DoneTrace workspace created.",
    "init.created.body":
      "Workspace: {workspaceRoot}\n" +
      "START_HERE.md: {startHere}\n" +
      "Files written: {files}\n" +
      "{backupLine}{network}\n" +
      "Why this works: AI productivity is a product, not a sum — this adds the factors beyond raw model capability (profile, context, acceptance, guard, handoff, harvest). See docs/WHY_THIS_EXISTS.md.\n" +
      "This created the workspace files only — your AI will NOT open up on its own yet. To make your AI load these rules and guide you, run the one-command on-ramp: ai-collab first-run --target . --tool <claude|codex|cursor|...> — it installs the rules into your AI's always-on instructions (CLAUDE.md / AGENTS.md / Cursor rules) and prints the single line to send your AI. Prefer a read-only baseline of your own work first? Run: ai-collab bootstrap --yes (a local report; nothing is written or sent anywhere).\n" +
      "Next: open {walkthroughYourTask} and run one full loop on your own real task (or open {walkthrough} to watch the flow on a prepared example first).",
    "init.backupLine": "Backup: {backupPath}\n",
    // dry-run preview
    "init.dryRun.title": "Dry run. No files written.",
    "init.dryRun.body":
      "Workspace: {workspaceRoot}\n" +
      "Files planned: {files}\n" +
      "Existing workspace: {existing}\n" +
      "{defaultTargetLine}{network}",
    "init.dryRun.existing.yes": "yes",
    "init.dryRun.existing.no": "no",
    "init.dryRun.defaultTargetLine":
      "Target not given; previewed the default {target}. To write, run: ai-collab init --target <dir>\n",

    // ---- status ----
    "status.title": "Workspace status",
    "status.state": "State: {stateDir}",
    "status.tasks": "Tasks: {count}  [{breakdown}]{seedNote}",
    "status.evidence": "Evidence: {count}{seedNote}",
    "status.runs": "Runs: {count}  [{breakdown}]{seedNote}",
    "status.receipts": "Receipts: {count}  [{breakdown}]{seedNote}",
    "status.learning": "Learning candidates: {count}",
    "status.yourTasks": "Your tasks:",
    "status.seedNote.tasks": "  (includes {count} example seed{plural} — delete it and add your own)",
    "status.seedNote.generic": "  (includes {count} example seed{plural})",
    "status.taskLine.head": "  - {id}  {title}  [{status}]{seedTag}",
    "status.taskLine.seedTag": "  [example seed]",
    // The honesty-bearing task status label (a "done" with no accepted review). The
    // ledger model emits the English canonical (a stable data field); this key is the
    // render-time translation, faithful — "author-marked, unverified" is NOT softened.
    "status.display.authorMarkedDone": "done — author-marked, unverified",
    "status.taskLine.receipt": "      receipt {id}: {verdict} · {level} · {status}{acceptedBy}{unverified}{plainNote}",
    "status.taskLine.receipt.acceptedBy": " by {who}",
    "status.taskLine.receipt.unverified": " (self-declared cross-family, unverified)",
    "status.taskLine.receipt.plainNote": "\n        ({level}: {plain})",
    "status.taskLine.receipt.none": "      receipt: (none yet)",
    "status.taskLine.counts": "      evidence: {evidence} · runs: {runs}",
    "status.handoffLine": "Handoff drafts: {count} (latest: {latest}) — review before handing off",
    "status.carryLine": "Carrying forward the preference you confirmed: {content}",
    "status.harvestLine": "Most recent harvest lesson you kept: {content}",
    "status.mostRecentActivity": "Most recent activity: {latest}",
    "status.noActivity": "(no activity yet)",
    "status.nextStep.withCommand": "Next step: {text}\n  {command}",
    "status.nextStep.textOnly": "Next step: {text}",
    // status next-step messages (text + command threaded by the command builder)
    "status.next.noOwnWork.text": "No work of your own yet — see where you stand on your recent work, or start a task.",
    "status.next.noEvidence.text": "Task {id} has no evidence yet — run its command and record the real result.",
    "status.next.noReceipt.text": "Task {id} has evidence but no receipt — file the guard verdict.",
    "status.next.pending.text": "Receipt {receiptId} on task {taskId} is pending your sign-off — accept it (or add a cross-family review to reach L3).",
    "status.next.missingHandoff.text": "Your work is recorded but there is no handoff draft — generate one so the next session/tool can resume.",
    "status.next.keepLesson.text": "You have a proposed lesson ({id}) — keep it so it carries forward.",
    "status.next.allClear.text": "All your tasks are evidenced, signed off, and handed off — nothing outstanding. Start a new task when ready.",

    // ---- bootstrap report ----
    "bootstrap.report.title": "Your AI collaboration baseline (from your own recent work)",
    "bootstrap.report.scanned": "Scanned locally: {repoRoot}",
    "bootstrap.report.readonly": "Read-only. Nothing left this machine.",
    // empty / seed-only honesty block
    "bootstrap.empty.line1": "You don’t have any of your own work recorded yet — only the shipped example.",
    "bootstrap.empty.line2": "So there is nothing of yours to report on. To get a real baseline:",
    "bootstrap.empty.step1": "  1. Run one real task through the loop (see `guide`).",
    "bootstrap.empty.step2": "  2. Re-run `bootstrap` and it will report on YOUR work.",
    "bootstrap.empty.note": "(The example seed is intentionally excluded — it is not your result.)",
    // PROFILE card (DETERMINISTIC clues only — NO semantic verdict). Every line is a
    // fact from the local scan; the footer states the honesty contract: these are
    // clues for the user's OWN ai to confirm, not a conclusion bootstrap reached.
    "bootstrap.profile.title": "PROFILE CLUES — signals from your setup (not conclusions)",
    "bootstrap.profile.tools": "  Detected you using: {tools}.",
    "bootstrap.profile.multiTool": "    (more than one tool configured — a cross-tool collaboration signal.)",
    "bootstrap.profile.noTools": "  No AI instruction files detected here yet.",
    "bootstrap.profile.fileTypes": "  Recently changed file types: {names}.",
    "bootstrap.profile.testScript": "  Your package.json has a test script.",
    "bootstrap.profile.footer": "  These are clues, not conclusions. Your AI will use them to confirm your full working-habits profile with you.",
    // ROLES card (DETERMINISTIC keyword match -> existing role packages). It states a
    // FACT (a high-risk WORD appears) + a fixed mapping to a role; it never decides the
    // work IS risky — the user's ai does. Role labels carry a plain-language simile.
    "bootstrap.roles.title": "ROLES TO CONSIDER — from high-risk keywords in your work",
    "bootstrap.roles.none": "  No high-risk keywords matched in your recent work. (A keyword scan only — not a verdict that the work is low-risk; ask your AI if a task still needs a guard role.)",
    "bootstrap.roles.intro": "  {count} high-risk signal{plural} found (keyword matches — your AI confirms whether they truly apply):",
    "bootstrap.roles.item": "  - “{subject}” contains the keyword “{keyword}” → consider {roles}.",
    "bootstrap.roles.roleJoin": " + ",
    "bootstrap.roles.role.red-team": "red-team (someone whose whole job is to poke holes)",
    "bootstrap.roles.role.dual-guard": "dual-guard (a second, different AI double-checks it)",
    "bootstrap.roles.role.scout-review-controller": "scout-review-controller (SCOUT — gathers the outside facts first)",
    // VERIFY card
    "bootstrap.verify.title": "VERIFY — which “done” you can’t trust yet",
    "bootstrap.verify.allClear1": "  Nothing is over-claimed right now. No completion is being shown as done",
    "bootstrap.verify.allClear2": "  without the evidence to back it.",
    "bootstrap.verify.count": "  {count} completion claim{plural} cannot be trusted as done yet:",
    "bootstrap.verify.item": "  - {taskId} “{title}”: {reason}",
    "bootstrap.verify.detail": "      detail: receipt {id} = {verdict} · {level} · {status}{marker}",
    // VERIFY reason codes
    "bootstrap.verify.reason.pending_receipt": "a review exists but is still pending — not accepted",
    "bootstrap.verify.reason.pass_with_risk_unaccepted": "passed only with a noted risk that no one has signed off on yet",
    "bootstrap.verify.reason.self_declared_cross_family": "self-declared cross-family review — the tool cannot verify the other model actually checked it",
    "bootstrap.verify.reason.author_marked_done": "marked done by the author with no accepted review behind it",
    // RESUME card
    "bootstrap.resume.title": "RESUME — where you are, what’s missing",
    "bootstrap.resume.noActive": "  No open or in-progress tasks of your own right now.",
    "bootstrap.resume.count": "  {count} task{plural} still in progress:",
    "bootstrap.resume.item": "  - {id} “{title}” [{status}]",
    "bootstrap.resume.missingHandoff": "  No handoff note yet — the next session would start from zero. Run `handoff create`.",
    "bootstrap.resume.reTouch": "  You keep re-touching the same files across recent commits: {names}.",
    "bootstrap.resume.reTouchNote": "    (a possible “said done, still patching” signal — worth a closer look.)",
    "bootstrap.resume.uncommitted": "  You have uncommitted changes in flight.",
    // HARVEST card
    "bootstrap.harvest.title": "HARVEST — what you can carry forward",
    "bootstrap.harvest.none1": "  Nothing confirmed to carry forward yet. Confirm a lesson with `learning confirm`",
    "bootstrap.harvest.none2": "  and it will show up here.",
    "bootstrap.harvest.candidate": "  - {detail} (proposed — nothing is saved automatically).",
    "bootstrap.harvest.confirmedHead": "  Confirmed learnings:",
    "bootstrap.harvest.confirmedItem": "  - ({type}) {content}",
    // HARVEST candidate details
    "bootstrap.harvest.detail.confirmed_learnings_ready": "{count} confirmed learning{plural} you can carry into your next task",
    "bootstrap.harvest.detail.verified_done_tasks": "{count} task{plural} reached a verified (accepted) result — a pattern worth reusing",
    // bootstrap Next step lines
    "bootstrap.next.pending.text": "Next: receipt {receiptId} (task {taskId}) is pending — accept it after you’ve checked it, or raise it with a cross-family review.",
    "bootstrap.next.pending.cmd": "  ai-collab receipt accept --id {receiptId} --owner you",
    "bootstrap.next.selfCross.text": "Next: receipt {receiptId} on task {taskId} is a self-declared cross-family pass the tool can’t verify — re-run it yourself to back it with a recorded run.",
    "bootstrap.next.selfCross.cmd": "  ai-collab run exec --task {taskId} --command \"...\"",
    "bootstrap.next.authorDone.text": "Next: task {taskId} is marked done with no accepted review — add evidence and file a receipt so it is actually backed.",
    "bootstrap.next.authorDone.cmd": "  ai-collab receipt create --task {taskId} --verdict pass_with_risk --review-mode self --evidence <id>",
    "bootstrap.next.missingHandoff.text": "Next: generate a handoff draft so the next session/tool resumes without re-explaining.",
    "bootstrap.next.missingHandoff.cmd": "  ai-collab handoff create",
    "bootstrap.next.keepLesson.text": "Next: keep the lesson you proposed ({id}) so it carries into your next task.",
    "bootstrap.next.keepLesson.cmd": "  ai-collab learning confirm --id {id}",
    "bootstrap.next.allClear.text": "Next: keep running real tasks through the loop; re-run `bootstrap` anytime for an updated baseline.",
    // Roles hint, APPENDED after the primary next step when high-risk keywords matched
    // (it never replaces the verify action). Advisory: points at existing role packages.
    "bootstrap.next.roles.text": "Also: high-risk keywords showed up in your work — consider bringing in {roles} before you call it done.",
    // consent preview
    "bootstrap.consent.head": "bootstrap will read — locally, read-only — to build your baseline:",
    "bootstrap.consent.repo": "  - your repo structure under {repoRoot} (file names, package.json scripts)",
    "bootstrap.consent.git": "  - your recent git history (git log / git diff --stat) in this repo",
    "bootstrap.consent.ledger": "  - your .aict ledger (tasks, runs, evidence, receipts, learnings)",
    "bootstrap.consent.ai": "  - your AI instruction files (CLAUDE.md / AGENTS.md / .cursorrules / …)",
    "bootstrap.consent.promise": "It does NOT call any external model, makes no guess, and sends nothing anywhere.",
    "bootstrap.consent.rerun": "Re-run with --yes to confirm and see your baseline:",
    "bootstrap.consent.cmd": "  ai-collab bootstrap --yes",
    // Only shown when the user opted in by naming a dialogue/log file (the connector
    // is OFF by default). The honesty caveat — local, deterministic, redacted — rides
    // along so the extra high-privacy read is never silent.
    "bootstrap.consent.dialogue": "  - the local chat/log export(s) you named: {files} (read locally, redacted, deterministic — never sent anywhere)",

    // --- bootstrap --send-to-model (the ONE external-model path) -------------
    // Consent preview (shown BEFORE any send): exactly what will leave the machine.
    "send.preview.head": "About to send to an external model — here is EXACTLY what would go out:",
    "send.preview.model": "  model: {model}  (the prompt is delivered on stdin, never on the command line)",
    "send.preview.count": "  {count} redacted snippet{plural} from your local scan",
    "send.preview.redacted": "  every snippet is REDACTED (secrets / tokens / emails / local paths masked) and the whole payload is re-checked before it leaves",
    "send.preview.sources": "  from: {files}",
    "send.preview.promise": "Nothing else (no raw files, no ledger, no repo contents) is sent. This is the only feature that contacts a model off this machine.",
    // Confirmation (interactive TTY). Default-deny: only an explicit y/yes proceeds.
    "send.confirm.prompt": "Send these redacted snippets to the model? [y/N] ",
    // Non-interactive refusal (no TTY and no --yes): nothing was sent.
    "send.refusedNonTty": "Refused: a send needs your confirmation. Re-run with --yes to confirm in a non-interactive shell. Nothing was sent.",
    // The user declined at the prompt.
    "send.declined": "Declined — nothing was sent. Showing your local result only.",
    // The LLM candidate block: clearly labelled lowest-trust, proposed, unverified.
    "send.candidates.head": "From the external model — {count} suggestion{plural} (NOT part of your verified results):",
    "send.candidates.caveat": "  ⚠ AI suggestion · low confidence · unverified · proposed only — confirm each one yourself before trusting or saving it. Nothing here was written anywhere.",
    "send.candidates.item": "  - [{kind}] {summary}",
    "send.candidates.basis": "      basis: {basis}",
    "send.candidates.kind.false_completion": "claimed done · unverified",
    "send.candidates.kind.profile_candidate": "possible standing preference",
    "send.candidates.kind.context_gap": "possible missing context",
    "send.candidates.kind.harvest_candidate": "possible reusable lesson",
    // Graceful-degrade lines (the model was not used / not reachable).
    "send.degraded.no_redacted_snippets": "No external send: there were no redacted snippets to send (provide a chat/log export with --dialogue/--logs first). Your local result above stands.",
    "send.degraded.consent_required_non_tty": "No external send: confirmation was required and not given (--yes in a non-interactive shell). Your local result above stands.",
    "send.degraded.declined": "No external send: you declined. Your local result above stands.",
    "send.degraded.generic": "The external model could not be used ({reason}) — falling back to your local result above. Nothing was fabricated. (model: {model})",
    // --dry-run-send: print the exact redacted payload, send nothing.
    "send.dryRun.head": "--dry-run-send: the EXACT redacted payload that WOULD be sent (nothing was sent, no model was called):",
    "send.dryRun.note": "Review it below. Every sensitive value is masked; the prompt would travel on stdin to the model.",

    // ---- dialogue scan (the LOCAL half of semantic scanning) ----
    // Transparency header (red line #5): printed at the top of the report when a local
    // dialogue/log export was read. Names the files + line counts + flagged-snippet
    // total, then a stand-alone "all local, nothing sent" promise line.
    "bootstrap.dialogue.head": "Read {count} local export{plural} you provided ({files}) — {snippets} snippet(s) flagged.",
    "bootstrap.dialogue.localPromise": "These were read locally only, redacted before display, and NOTHING was sent anywhere.",
    "bootstrap.dialogue.skippedHead": "Some files you named could not be read (skipped, not fatal):",
    "bootstrap.dialogue.skipped.not_found": "  - skipped {path} (not found)",
    "bootstrap.dialogue.skipped.unreadable": "  - skipped {path} (unreadable)",
    "bootstrap.dialogue.skipped.not_a_file": "  - skipped {path} (not a file)",
    "bootstrap.dialogue.skipped.too_large": "  - skipped {path} (too large)",
    "bootstrap.dialogue.skipped.unsupported_type": "  - skipped {path} (unsupported type — use .txt/.json/.md/.log)",
    // VERIFY card, dialogue block: a clearly separated header + per-claim line. The
    // wording "claimed in dialogue · not verified" is the honesty contract and is
    // never softened; the snippet is already redacted.
    "bootstrap.verify.dialogueHead": "  From your chat (claimed in dialogue · not verified — NOT shown as done): {count} completion claim{plural} the ledger does not back:",
    "bootstrap.verify.dialogueItem": "  - {path}:{line} — “{snippet}”",
    // HARVEST card, dialogue block: a separated header + per-candidate line. Proposed
    // only; nothing is saved.
    "bootstrap.harvest.dialogueHead": "  From your chat (proposed — nothing saved): a standing preference you may want to record:",
    "bootstrap.harvest.dialogueItem": "  - you repeated this correction {count}× → propose a profile preference: “{snippet}”",
    // Next-step branch when the only completion signal is a chat claim (no ledger gap):
    // turn it into a real tracked task so the "done" stops being just words.
    "bootstrap.next.dialogueClaim.text": "Next: your chat claims something is done that the ledger does not back — turn it into a tracked task + recorded run so the “done” is real.",
    "bootstrap.next.dialogueClaim.cmd": "  ai-collab task create --title \"...\"",

    // ---- common errors (the most-hit failure paths) ----
    "error.missingOption": "Missing --{name}.",
    "error.missingTarget": "Missing --target. Run: ai-collab init --target <dir>",
    "error.noWorkspace":
      "No .aict workspace found at {where}. The run-layer commands operate an existing workspace. " +
      "Create one first: ai-collab init --target <dir> (writes <dir>/.aict), then run from <dir> or pass --workspace <dir>/.aict.",
    "error.noWorkspace.currentDir": "the current directory",
    "error.taskNotFound.update": "Task {id} not found. Update only an existing task (run: ai-collab task create ...).",
    "error.taskNotFound.evidence": "Task {id} not found. Add evidence only to an existing task (run: ai-collab task create ...).",
    "error.taskNotFound.runStart": "Task {id} not found. Start a run only for an existing task.",
    "error.taskNotFound.runExec": "Task {id} not found. Run a command only for an existing task.",
    "error.taskNotFound.receipt": "Task {id} not found. Create a receipt only for an existing task.",
    "error.taskNotFound.handoff": "Task {id} not found. Create a handoff draft for an existing task, or omit --task to cover the whole workspace.",
    "error.taskNotFound.learning": "Task {id} not found. Bind a learning row only to an existing task (or omit --task).",
    "error.doneNoEvidence": "Task {id} cannot be marked \"done\" with no evidence. Add evidence first (ai-collab evidence add --task {id} ...), or use blocked/partial/unverified.",
    "error.taskStatusInvalid": "--status must be one of: {allowed} (got \"{got}\").",
    "warn.doneNoReceipt": "Warning: task {id} marked done without an accepted receipt; this shows as author-marked, unverified — add evidence + a receipt to verify.",

    // ---- run exec dangerous-command guard (B6a-1) ----
    // A conservative, NARROW guard: only well-known destructive shapes trip it
    // (so ordinary commands are rarely blocked — narrow false positives possible,
    // --yes overrides). On a TTY it asks y/N (default N).
    // Without a TTY it REFUSES unless --yes/--force is passed. Nothing is executed
    // or recorded on a refusal.
    "danger.header": "DANGEROUS COMMAND — this matches a known destructive pattern.",
    "danger.matched": "  matched: {patterns}",
    "danger.command": "  command: {command}",
    "danger.prompt": "Run it anyway? [y/N] ",
    "danger.declined": "Refused: dangerous command not run (you answered no). Nothing recorded.",
    "danger.refusedNonTty": "Refused: this command matches a known destructive pattern ({patterns}) and there is no interactive terminal to confirm. Re-run with --yes (or --force) to run it anyway. Nothing recorded.",

    // ---- --help levels (the full L0-L4 reference; honesty caveats verbatim) ----
    "help.levels": `Guard levels (L0-L4)

Plain version: a guard level grades the EVIDENCE behind a "done", and caps how strong a
verdict it can earn. The more — and the more INDEPENDENT — the evidence, the higher the
level. A single tool, reviewing its own work, tops out at L2 ("pass with risk"); a clean
"pass" needs a second, DIFFERENT model family to re-check it (L3); the strongest local pass
(L4) also needs that reviewer to actually re-run the command and have it match a recorded run.
You never type the level in — the CLI computes it from the evidence you cite.

The level is COMPUTED by the CLI from your --review-mode + the evidence cited — it
is NOT something you declare. --claimed-level (a.k.a. the legacy --guard-level) is
only used to warn you if you claimed more than the evidence supports; the recorded
level is always the computed one.
  L0   summary only             -> insufficient_evidence only
  L1   artifact, no real run    -> cannot pass
  L2   single-tool OR same-family sub-agent (advisory) -> at most pass_with_risk
  L2.5 same tool, different model (weak L3)            -> at most pass_with_risk
  L3   cross-family review (self-declared)             -> may pass, marked unverified
  L4   cross-family review AND a reviewer rerun reconciled to a recorded run exec -> strongest local pass
How the level is earned: review-mode sets a ceiling (self/same_family_subagent -> L2,
same_tool_other_model -> L2.5, cross_family -> L3, cross_family_rerun -> L4) and the
evidence caps it (a cross_family_guard row enables L3; L4 needs BOTH that cross_family_guard
row AND a rerun row that REFERENCES a RECONCILED recorded run exec — same task, finished,
executed:true, matching exitCode + command + outputSha256. A reconciled rerun on its OWN is
single-tool run evidence — only L2).
The real level is the LOWER of the two — so opening your OWN same-family sub-agent can
never reach L3 no matter what you claim, and a cross-family claim with no reconciled
rerun tops out at "L3 (self-declared cross-family, unverified)". A reconciled rerun with no
cross-family review is just the author re-running their own command — it stays L2, never L4.
IMPORTANT — family honesty: the model family on a cross_family_guard row is SELF-DECLARED.
This tool runs locally and CANNOT verify it, so an L3 is shown as "self-declared cross-family,
unverified". L4 is harder — it must reference a RECORDED run exec (runs.jsonl) whose exitCode +
command + outputSha256 reconcile — but it is still a LOCAL-trust pass: a single user can choose
and run a local command (and a hand-edited ledger can set any field), so L4 means "backed by a
recorded, output-matched local run", NOT cryptographic verification. (None of these fields are
anti-forgery proof; they record who/what claimed what.)

Network: not used.
`,

    // ---- --help (the main term-light reference). Command SYNTAX stays verbatim in
    //      both languages (it is what the user types); prose is faithfully translated.
    "help.main": `DoneTrace

Installed from npm — the global ai-collab command is available everywhere. (From a source clone, the same commands run as node bin/ai-collab.js <command>.)

New here? These commands cover most of what you need (plain-language first):
  first-run  The recommended on-ramp: creates your workspace, installs the rules into your AI's always-on instructions, and prints the one line to send your AI so it starts guiding you. Start here.
  init       Create your workspace ONLY — one folder of plain files you keep, with NO AI rules installed (so your AI will not open up on its own; run first-run for that).
  bootstrap  Look at your OWN recent work and print a read-only "where you stand" report. It is the read-only scan the first-run walkthrough uses; you can also run it yourself anytime for the same baseline.
  status     Show what is open, what is done, and one suggested next step. Run this any time to get your bearings.
Full command list is below. Guard levels (L0-L4) and the cross-family theory live at the very end — run "ai-collab --help levels" to read just that.

Usage:
  ai-collab first-run --target <dir> --tool <claude|codex|cursor|copilot|cline|windsurf|all>   # recommended: creates workspace + installs AI rules + prints the line to send your AI
  ai-collab init --target <dir> [--dry-run] [--force]   # workspace files ONLY (no AI rules; the AI will not open up on its own)
  ai-collab welcome [--lang <en|zh>]   # print the fixed onboarding intro your AI shows you after install
  ai-collab guide
  ai-collab demo
  ai-collab bootstrap [--workspace <dir>] [--report-only] [--json] [--yes] [--dialogue <path[,path]>] [--logs <path[,path]>]
  ai-collab check --workspace <dir>
  ai-collab adapters install --target <dir> [--tool <list>] [--enable-hooks] [--dry-run] [--force]

  Run layer (operate the loop on real tasks; all take --workspace <dir>; without it they
  use ./.aict here, and refuse with init guidance if no workspace exists yet — never write a stray ./state):
  ai-collab task create --title "..."
  ai-collab task update --task <id> --status <open|done|blocked|partial|unverified>
  ai-collab evidence add --task <id> --kind <k> --summary "..." [--detail "..."]
     kind rerun also needs:             --command "<cmd>" --exit <code> --output "<captured output>" [--run <runId>] [--runner "<name>"]
                                        (--run links to a recorded run in runs.jsonl; REQUIRED for the rerun to reach L4 —
                                         the run must be a finished run exec for the same task and agree on exitCode + command + output)
     kind cross_family_guard also needs: at least one of --reviewer "<who>" / --family "<model-family>" / --ref "<source>"
  ai-collab run start --task <id> [--command "..."]   # RECORD a run you report (does not execute)
  ai-collab run finish --task <id> --exit <code>      # RECORD the exit code you report
  ai-collab run exec --task <id> --command "..." [--cwd <dir>] [--clean-env]   # ACTUALLY run it locally + record the REAL exit (executed:true)
     Runs in the workspace's project root by default (NOT your current shell directory); --cwd <dir> overrides it. The
     directory it ran in is recorded on the run and printed, so the evidence shows exactly where the command executed.
     Safety: 'run exec' runs a real shell command locally — read the command first, especially if an AI suggested it.
     A NARROW set of known-destructive shapes (rm -rf, sudo, fork bombs, curl|sh, dd, mkfs, > /dev/, chmod -R 777, redirects
     into system paths) trips a guard: on an interactive terminal it asks y/N (default N); with no terminal it REFUSES unless
     you pass --yes (or --force). Ordinary commands are rarely affected (narrow false positives possible; a
     danger word quoted as data or used as an argument is ignored; --yes overrides), and a refusal records nothing.
     --clean-env runs the command with a MINIMAL environment (PATH/HOME + locale/temp basics only) instead of inheriting
     your full environment, so a suggested command cannot read your API keys/tokens. Default (no flag) inherits the full
     environment, unchanged. Whether the run was clean-env is recorded on the run (cleanEnv) and printed.
  ai-collab receipt create --task <id> --verdict <pass|reject|insufficient_evidence|pass_with_risk> [--review-mode <self|same_family_subagent|same_tool_other_model|cross_family|cross_family_rerun>] [--claimed-level <L0|L1|L2|L2.5|L3|L4>] [--evidence <id,id>] [--rerun <id,id>]
  ai-collab receipt accept --id <receiptId> --owner [name]
  ai-collab learning add --type <harvest|profile> --content "..." [--task <id>]
  ai-collab learning confirm --id <id>        # keep it as written
  ai-collab learning edit --id <id> --content "..."   # reword and keep
  ai-collab learning drop --id <id>           # discard it
  ai-collab status [--workspace <dir>] [--json]
  ai-collab handoff create [--task <id>] [--workspace <dir>] [--json]
     Generate a DRAFT handoff note from the ledger (.aict/handoff/handoff-*.md) so the next session/tool resumes
     without re-explaining. Only tasks with an ACCEPTED receipt are listed as Done; pass_with_risk / pending /
     unverified work goes under Unverified. The draft is a starting point to review and complete, not a finished handoff.
  ai-collab capability detect [--project <dir>] [--tools <list>] [--families <list>] [--subagents] [--can-switch-model] [--can-rerun] [--no-new-conversation] [--json]

  bootstrap: the read-only scan engine the first-run walkthrough uses. When you send
  your AI the trigger line that first-run prints (Walk me through the ai-collab
  first run.), the guided walkthrough runs this in its scan step to look at your
  recent work; you can also run it yourself anytime for the same read-only
  baseline. It reads your OWN recent work --
  your repo structure, your recent git history (read-only), your .aict ledger, and
  your AI instruction files -- and prints one plain "AI collaboration baseline" with
  five cards: PROFILE CLUES (signals from your setup -- detected tools,
  recently changed file types -- as clues for your AI to confirm with you, never a
  conclusion bootstrap reached), VERIFY (which "done"s cannot be trusted yet -- pending, risk-not-
  signed-off, or self-declared cross-family reviews -- recomputed by the same honest
  rules as status/handoff, never shown as done), RESUME (your in-progress tasks, a
  missing handoff, files you keep re-touching), ROLES (high-risk KEYWORDS scanned in your work
  mapped to existing helper roles like red-team / dual-guard -- a fact that a risk
  word appears, with your AI confirming whether it truly applies, never a risk
  verdict), and HARVEST (confirmed lessons you
  can carry forward). It is DETERMINISTIC and local: no external model, no guessing,
  nothing leaves your machine, and it WRITES NOTHING (report-only). It prints the
  scan scope first and needs --yes to proceed (--yes skips that confirmation for
  scripts). An empty/example-only workspace honestly says "no data of your own yet".
  Optional, OFF by default: --dialogue <path> / --logs <path> read a LOCAL chat/log
  export YOU name (comma-separate several) and add deterministic, redacted findings —
  a chat "done" the ledger does not back is listed "claimed in dialogue · not
  verified" (never shown done), and a correction you repeated becomes a PROPOSED
  profile candidate (nothing saved). Still local, still no model, still no network.

  Guard levels (L0-L4) grade the evidence behind a "done" and cap the verdict it may earn.
  In one line: more / more-independent evidence -> a higher level -> a stronger pass; a single
  tool tops out at L2 (pass_with_risk), and a plain "pass" needs an L3+ cross-family review.
  The level is COMPUTED by the CLI from your evidence — you never declare it (--claimed-level,
  a.k.a. the legacy --guard-level, only warns when you claim more than the evidence supports).
  For the full L0-L4 ladder, how each level is earned, and the family-honesty caveats, run:
    ai-collab --help levels
  A pass_with_risk receipt is created "pending" and needs "receipt accept --owner [name]" to be accepted.
  Owner acceptance records a local human sign-off (actor + timestamp) — a collaboration audit trail, not a cryptographic signature.

  Capability detect: a DIFFERENT question from a receipt's guard level. A receipt says what THIS task EARNED;
  "capability detect" says how high your SETUP could EVER score — your ceiling. It probes the project for tool
  markers (.claude/, .codex/, .cursor/, AGENTS.md, …) and takes self-report flags (--tools / --families /
  --subagents / --can-switch-model / --can-rerun) because the CLI cannot see which AI you installed. The
  load-bearing judge is the number of DISTINCT model families you can bring, NOT tool count: two same-family
  tools share blind spots (still L2); a SECOND, different family is the gate to a clean pass (L3); re-running the
  commands yourself on top of that reaches L4. It then prints the single most valuable step to raise the ceiling.
  CEILING is not ACHIEVED: the ceiling is the most your tools could support; each task still has to earn its level
  with the evidence it cites. Project signals are INFERENCE, not proof (a marker file does not pin a model family),
  so confirm with --tools / --families.

  Learning ledger: capture what a task taught you, so the next task starts ahead. "learning add" proposes one
  lesson (--type harvest) or one standing preference (--type profile); it lands as "proposed" until you keep it
  (learning confirm), reword and keep it (learning edit), or discard it (learning drop). Only confirmed/edited
  rows graduate into your long-term profile — nothing on the AI's say-so alone. Keep it to at most one harvest +
  one profile per task. "status" then echoes back the ONE preference you most recently confirmed, so it feels
  like the tool is learning how you work without you maintaining a system.

  --tool selects which AI tools get an instruction file. Values: cursor, codex,
  claude, copilot, cline, windsurf, all, auto (comma-separated for several).
  Default auto installs only tools detected in the target; if none are detected
  it writes nothing and asks you to pass --tool. Use --tool all for all six.

  Three adaptation tiers, least to most invasive:
    1. rules  (default, always safe) -- the per-tool instruction file --tool writes.
    2. skills (optional)             -- the reusable ability cards in .aict/skills/
                                        (created by init), loaded into a tool on demand.
    3. hooks  (opt-in, off by default) -- --enable-hooks adds two project-LOCAL Claude
                                        Code hooks: a Stop hook that reminds you to
                                        capture a receipt at a completion claim, and a
                                        one-time SessionStart hook that asks the AI to
                                        begin onboarding on your first session here.
                                        Never a global hook; the install lists every
                                        file first and is removable. --tool claude only.

First experience (recommended):
  first-run --target . --tool <claude|codex|cursor|...> -> send your AI the printed trigger line ->
  run one full loop on your own real task (open .aict/walkthroughs/10-minute-your-task.md;
  want to watch the flow on a prepared example first? open .aict/walkthroughs/10-minute.md instead)

Run now:
  ai-collab first-run --target . --tool claude   # recommended: build workspace + install AI rules + print trigger line
  ai-collab init --target ./my-ai-workspace      # secondary: workspace files ONLY (no AI rules; your AI will not open up on its own)
  ai-collab init --dry-run                        # preview the workspace files only, writes nothing

Network: not used.
`
  },

  zh: {
    // ---- shared / cross-cutting ----
    "common.networkNotUsed": "网络：未使用。",
    "common.untitled": "（无标题）",

    // ---- guard-level plain language (honesty ladder — faithful, not softened) ----
    "level.L0": "仅有摘要——证据不足以通过",
    "level.L1": "证据太薄·不算通过——请补一次真实运行/输出",
    "level.L2": "单工具自查·只能睁眼接受风险",
    "level.L2_5": "同工具换模型·弱跨族——仍是单一家族，接受需带风险",
    "level.L3": "跨族复核·但家族系自报——由另一模型家族复查（自报）",
    "level.L4": "本地最强·真执行并已对账复核——跨族复核外加一次已对账的重跑",
    "marker.selfDeclaredCrossFamily": "自报跨族·未经验证",

    // ---- welcome (主动引导介绍——CLI 原样硬打印 · Owner 锁定第四稿一字不改) ----
    "welcome.intro":
      "✅ 协作升级包已装好\n" +
      "\n" +
      "你刚给你的 AI 工具(Claude Code / Cursor / Codex 等)装了一套本地协作框架——\n" +
      "相当于给 AI 配了套\"脚手架\",让它更靠谱、更懂你,而不是每次从零开始。\n" +
      "工具本身不联网、不上传,你的资料只留在本地;只有你让我\"扫一眼你的活\"那一下,\n" +
      "是我这个 AI 来读、跟你平时聊天一样过一下服务商——工具自己不传任何东西。\n" +
      "\n" +
      "【给你的 AI 加了六层能力】\n" +
      "  画像   给你建立一份本地的个人画像,越用越懂你\n" +
      "  上下文  给每一个任务建立档案,跨对话也能接着干\n" +
      "  验收   动手前先讲清\"做成什么样才算完成\",免得 AI 理解偏\n" +
      "  守卫   说\"做完了\"前先拿证据,还能拉第二个 AI 复核\n" +
      "  交接   换工具/换对话不用重讲背景\n" +
      "  收割   把有价值的经验沉淀下来,下次复用\n" +
      "\n" +
      "【你会明显感觉到的变化】\n" +
      "  · AI 不再嘴上\"搞定了\"实际没做完——必须拿证据自证\n" +
      "  · 重要决策有双守卫复核,不是一个 AI 说了算\n" +
      "  · 换对话/换工具,背景不丢\n" +
      "  · 卡壳时能帮你理清思路\n" +
      "\n" +
      "【想不通时,直接说关键词,AI 切到对应模式帮你想】\n" +
      "  说\"碰撞模式\"   → AI 跟你对撞观点、挑逻辑漏洞,把模糊想法聊清楚\n" +
      "  说\"扫描盲区\"   → AI 从外部视角找你没看到的死角\n" +
      "  说\"红队\"      → AI 专挑你方案的毛病\n" +
      "  (还有双守卫复核、根因分析等,需要时说一声)\n" +
      "\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "先别急着干活——现在花 30 秒,我带你亲眼看看它能帮你什么。\n" +
      "我这就扫一眼你最近的活,当场给你指出:\n" +
      "  · 哪些你以为\"做完\"的活,其实没留验证证据(最容易踩的坑)\n" +
      "  · 你最近碰的高风险任务,该拉哪些帮手角色(红队/双守卫)把关\n" +
      "  · 从你的活里看出的工作习惯画像(你确认或改,不用填表)\n" +
      "  · 这次值得存下来的经验\n" +
      "你什么都不用做,回我一句\"扫吧\"我就开始,试完你就知道它值在哪——现在就让我扫一眼吗?",

    // ---- init (writing) ----
    "init.created.title": "AI 协作开放系统工作区已创建。",
    "init.created.body":
      "工作区：{workspaceRoot}\n" +
      "START_HERE.md：{startHere}\n" +
      "已写入文件：{files}\n" +
      "{backupLine}{network}\n" +
      "为什么有效：AI 生产力是乘积而非加总——本系统补上原始模型能力之外的各项因子（画像、上下文、验收、守卫、交接、收割）。详见 docs/WHY_THIS_EXISTS.md。\n" +
      "这一步只生成了工作区文件——你的 AI 还不会自己主动开口。要让你的 AI 真正加载这些规则并引导你，请运行一条命令：ai-collab first-run --target . --tool <claude|codex|cursor|...> ——它会把规则装进你 AI 的常驻指令（CLAUDE.md / AGENTS.md / Cursor 规则），并打印出你要发给 AI 的那一句话。想先要一份你自己工作的只读基线？运行：ai-collab bootstrap --yes（本地报告，不写入、不外发）。\n" +
      "下一步：打开 {walkthroughYourTask}，在你自己的一个真实任务上跑完整一圈（或先打开 {walkthrough} 看预置示例的流程）。",
    "init.backupLine": "备份：{backupPath}\n",
    "init.dryRun.title": "试运行。未写入任何文件。",
    "init.dryRun.body":
      "工作区：{workspaceRoot}\n" +
      "计划写入文件：{files}\n" +
      "已存在工作区：{existing}\n" +
      "{defaultTargetLine}{network}",
    "init.dryRun.existing.yes": "是",
    "init.dryRun.existing.no": "否",
    "init.dryRun.defaultTargetLine":
      "未给定 --target；已对默认目标 {target} 做预览。若要写入，请运行：ai-collab init --target <dir>\n",

    // ---- status ----
    "status.title": "工作区状态",
    "status.state": "状态目录：{stateDir}",
    "status.tasks": "任务：{count}  [{breakdown}]{seedNote}",
    "status.evidence": "证据：{count}{seedNote}",
    "status.runs": "运行：{count}  [{breakdown}]{seedNote}",
    "status.receipts": "回执：{count}  [{breakdown}]{seedNote}",
    "status.learning": "待定学习项：{count}",
    "status.yourTasks": "你的任务：",
    "status.seedNote.tasks": "  （含 {count} 个示例种子——删掉它，换成你自己的）",
    "status.seedNote.generic": "  （含 {count} 个示例种子）",
    "status.taskLine.head": "  - {id}  {title}  [{status}]{seedTag}",
    "status.taskLine.seedTag": "  [示例种子]",
    "status.display.authorMarkedDone": "完成——作者自标·未经验证",
    "status.taskLine.receipt": "      回执 {id}：{verdict} · {level} · {status}{acceptedBy}{unverified}{plainNote}",
    "status.taskLine.receipt.acceptedBy": " 由 {who} 签收",
    "status.taskLine.receipt.unverified": "（自报跨族·未经验证）",
    "status.taskLine.receipt.plainNote": "\n        （{level}：{plain}）",
    "status.taskLine.receipt.none": "      回执：（暂无）",
    "status.taskLine.counts": "      证据：{evidence} · 运行：{runs}",
    "status.handoffLine": "交接草稿：{count} 份（最新：{latest}）——交接前请先复核",
    "status.carryLine": "正在带上你已确认的偏好：{content}",
    "status.harvestLine": "你最近保留的收割心得：{content}",
    "status.mostRecentActivity": "最近活动：{latest}",
    "status.noActivity": "（暂无活动）",
    "status.nextStep.withCommand": "下一步：{text}\n  {command}",
    "status.nextStep.textOnly": "下一步：{text}",
    "status.next.noOwnWork.text": "你还没有自己的工作——先看看你最近的工作处在什么位置，或新建一个任务。",
    "status.next.noEvidence.text": "任务 {id} 还没有任何证据——运行它的命令并记录真实结果。",
    "status.next.noReceipt.text": "任务 {id} 有证据但没有回执——把守卫判定登记下来。",
    "status.next.pending.text": "任务 {taskId} 上的回执 {receiptId} 正等你签字——签收它（或加一次跨族复核以达到 L3）。",
    "status.next.missingHandoff.text": "你的工作已记录，但还没有交接草稿——生成一份，好让下一个会话/工具接得上。",
    "status.next.keepLesson.text": "你有一条候选心得（{id}）——保留它，让它带得下去。",
    "status.next.allClear.text": "你的所有任务都已有证据、已签字、已交接——没有未结项。准备好就开新任务。",

    // ---- bootstrap report ----
    "bootstrap.report.title": "你的 AI 协作基线（来自你自己最近的工作）",
    "bootstrap.report.scanned": "本地扫描：{repoRoot}",
    "bootstrap.report.readonly": "只读。没有任何东西离开过这台机器。",
    "bootstrap.empty.line1": "你还没有记录任何自己的工作——目前只有内置示例。",
    "bootstrap.empty.line2": "所以没有属于你的内容可报告。要得到真实基线：",
    "bootstrap.empty.step1": "  1. 在循环里跑一个真实任务（见 `guide`）。",
    "bootstrap.empty.step2": "  2. 重新运行 `bootstrap`，它就会报告你自己的工作。",
    "bootstrap.empty.note": "（示例种子被刻意排除——那不是你的成果。）",
    // PROFILE 卡（仅确定性线索——不下语义结论）。每一行都是本地扫描得到的事实；
    // 末尾固定一句说明诚实边界：这些是线索、交给你自己的 AI 去和你确认，不是 bootstrap 下的结论。
    "bootstrap.profile.title": "画像线索——来自你的配置的信号（不是结论）",
    "bootstrap.profile.tools": "  检测到你在用：{tools}。",
    "bootstrap.profile.multiTool": "    （配置了不止一个工具——一个跨工具协作的信号。）",
    "bootstrap.profile.noTools": "  这里还没检测到任何 AI 指令文件。",
    "bootstrap.profile.fileTypes": "  最近改动的文件类型：{names}。",
    "bootstrap.profile.testScript": "  你的 package.json 里有 test 脚本。",
    "bootstrap.profile.footer": "  这些是线索，不是结论。你的 AI 会据此跟你确认完整的工作习惯画像。",
    // ROLES 卡（确定性关键词匹配 -> 已有的角色包）。它陈述一个事实（出现了高风险词）
    // 加一个固定映射到角色；它从不判定这活就是有风险——那是你自己 AI 的事。角色名带大白话比喻。
    "bootstrap.roles.title": "可以考虑的角色——来自你工作里的高风险关键词",
    "bootstrap.roles.none": "  你最近的工作里没命中高风险关键词。（只是关键词扫描——不代表活就低风险；拿不准就问你的 AI 要不要上守卫角色。）",
    "bootstrap.roles.intro": "  发现 {count} 个高风险信号（这些是关键词命中——是否真的适用由你的 AI 确认）：",
    "bootstrap.roles.item": "  - “{subject}” 命中关键词 “{keyword}” → 建议 {roles}。",
    "bootstrap.roles.roleJoin": " + ",
    "bootstrap.roles.role.red-team": "red-team（红队——专门挑刺、找漏洞的人）",
    "bootstrap.roles.role.dual-guard": "dual-guard（双守卫——另一个不同的 AI 再复核一遍）",
    "bootstrap.roles.role.scout-review-controller": "scout-review-controller（SCOUT 取证——先把外部事实查清楚）",
    "bootstrap.verify.title": "VERIFY——哪些『完成』暂时还不能信",
    "bootstrap.verify.allClear1": "  目前没有任何过度声明。没有哪个『完成』在缺少证据的情况下",
    "bootstrap.verify.allClear2": "  被当作已完成展示。",
    "bootstrap.verify.count": "  {count} 个『完成』声明暂时还不能当作已完成：",
    "bootstrap.verify.item": "  - {taskId} “{title}”：{reason}",
    "bootstrap.verify.detail": "      明细：回执 {id} = {verdict} · {level} · {status}{marker}",
    "bootstrap.verify.reason.pending_receipt": "已有复核但仍在待定——尚未签收",
    "bootstrap.verify.reason.pass_with_risk_unaccepted": "只是带着一个尚无人签字确认的风险通过",
    "bootstrap.verify.reason.self_declared_cross_family": "自报的跨族复核——本工具无法验证另一个模型是否真的检查过",
    "bootstrap.verify.reason.author_marked_done": "作者自行标记完成·背后没有已签收的复核",
    "bootstrap.resume.title": "RESUME——你在哪里、还缺什么",
    "bootstrap.resume.noActive": "  目前没有你自己处于打开或进行中的任务。",
    "bootstrap.resume.count": "  {count} 个任务仍在进行中：",
    "bootstrap.resume.item": "  - {id} “{title}” [{status}]",
    "bootstrap.resume.missingHandoff": "  还没有交接说明——下一个会话将从零开始。运行 `handoff create`。",
    "bootstrap.resume.reTouch": "  你在最近的提交里反复改动同一批文件：{names}。",
    "bootstrap.resume.reTouchNote": "    （可能是『说完成了、还在打补丁』的信号——值得细看。）",
    "bootstrap.resume.uncommitted": "  你有未提交的改动正在进行中。",
    "bootstrap.harvest.title": "HARVEST——你可以带走什么",
    "bootstrap.harvest.none1": "  暂时没有已确认可带走的内容。用 `learning confirm` 确认一条心得，",
    "bootstrap.harvest.none2": "  它就会出现在这里。",
    "bootstrap.harvest.candidate": "  - {detail}（候选——不会自动保存任何东西）。",
    "bootstrap.harvest.confirmedHead": "  已确认的学习项：",
    "bootstrap.harvest.confirmedItem": "  - （{type}）{content}",
    "bootstrap.harvest.detail.confirmed_learnings_ready": "{count} 条已确认的学习项，可带入你的下一个任务",
    "bootstrap.harvest.detail.verified_done_tasks": "{count} 个任务达成了已验证（已签收）的结果——一个值得复用的模式",
    "bootstrap.next.pending.text": "下一步：回执 {receiptId}（任务 {taskId}）处于待定——你核对过后签收它，或用一次跨族复核来抬高它。",
    "bootstrap.next.pending.cmd": "  ai-collab receipt accept --id {receiptId} --owner you",
    "bootstrap.next.selfCross.text": "下一步：任务 {taskId} 上的回执 {receiptId} 是一次本工具无法验证的自报跨族通过——你自己重跑一遍，用一次已记录的运行来支撑它。",
    "bootstrap.next.selfCross.cmd": "  ai-collab run exec --task {taskId} --command \"...\"",
    "bootstrap.next.authorDone.text": "下一步：任务 {taskId} 被标记为完成但没有已签收的复核——补上证据并登记一份回执，让这个『完成』真正有支撑。",
    "bootstrap.next.authorDone.cmd": "  ai-collab receipt create --task {taskId} --verdict pass_with_risk --review-mode self --evidence <id>",
    "bootstrap.next.missingHandoff.text": "下一步：生成一份交接草稿，好让下一个会话/工具无需从头解释就能接上。",
    "bootstrap.next.missingHandoff.cmd": "  ai-collab handoff create",
    "bootstrap.next.keepLesson.text": "下一步：保留你提出的这条心得（{id}），让它带入你的下一个任务。",
    "bootstrap.next.keepLesson.cmd": "  ai-collab learning confirm --id {id}",
    "bootstrap.next.allClear.text": "下一步：继续在循环里跑真实任务；随时重新运行 `bootstrap` 获取更新后的基线。",
    // 角色提示，在主下一步之后追加（高风险关键词命中时；它不替代 verify 动作）。建议性：指向已有的角色包。
    "bootstrap.next.roles.text": "另外：你的工作里出现了高风险关键词——在你说『做完了』之前，考虑请上 {roles}。",
    "bootstrap.consent.head": "bootstrap 将——在本地、只读地——读取以下内容来构建你的基线：",
    "bootstrap.consent.repo": "  - 你在 {repoRoot} 下的仓库结构（文件名、package.json 脚本）",
    "bootstrap.consent.git": "  - 本仓库里你最近的 git 历史（git log / git diff --stat）",
    "bootstrap.consent.ledger": "  - 你的 .aict 账本（任务、运行、证据、回执、学习项）",
    "bootstrap.consent.ai": "  - 你的 AI 指令文件（CLAUDE.md / AGENTS.md / .cursorrules / …）",
    "bootstrap.consent.promise": "它不会调用任何外部模型，不做任何猜测，也不会把任何东西发送到任何地方。",
    "bootstrap.consent.rerun": "加上 --yes 重新运行以确认并查看你的基线：",
    "bootstrap.consent.cmd": "  ai-collab bootstrap --yes",
    // 仅在用户通过指定对话/日志文件主动开启时显示（连接器默认关闭）。诚实
    // 提示——本地、确定性、已去敏——一并带上，让这次额外的高隐私读取绝不静默。
    "bootstrap.consent.dialogue": "  - 你指定的本地对话/日志导出：{files}（本地读取、已去敏、确定性——绝不发送到任何地方）",

    // --- bootstrap --send-to-model（唯一会外发的路径）-----------------------
    // 同意预览（发送前展示）：到底有什么会离开这台机器。
    "send.preview.head": "即将发送给外部模型——以下就是会发出去的全部内容：",
    "send.preview.model": "  模型：{model} （提示通过 stdin 传入，绝不放在命令行上）",
    "send.preview.count": "  来自你本地扫描的 {count} 条已去敏片段",
    "send.preview.redacted": "  每条片段都已去敏（密钥 / 令牌 / 邮箱 / 本地路径已遮蔽），且整个负载在离开前会再核查一遍",
    "send.preview.sources": "  来自：{files}",
    "send.preview.promise": "除此之外什么都不发（不发原始文件、不发账本、不发仓库内容）。这是唯一一个会联系本机之外模型的功能。",
    // 确认（交互式 TTY）。默认拒绝：只有明确输入 y/yes 才继续。
    "send.confirm.prompt": "把这些已去敏的片段发给模型吗？[y/N] ",
    // 非交互式拒绝（无 TTY 且无 --yes）：什么都没发。
    "send.refusedNonTty": "已拒绝：发送需要你确认。在非交互式 shell 里请用 --yes 重新运行以确认。什么都没发。",
    // 用户在提示处拒绝。
    "send.declined": "已拒绝——什么都没发。只显示你的本地结果。",
    // LLM 候选块：明确标注为最低置信、仅建议、未验证。
    "send.candidates.head": "来自外部模型——{count} 条建议（不属于你已验证的结果）：",
    "send.candidates.caveat": "  ⚠ AI 建议 · 低置信 · 未验证 · 仅为建议——在信任或保存之前请逐条自行确认。这里的任何内容都没有被写入任何地方。",
    "send.candidates.item": "  - [{kind}] {summary}",
    "send.candidates.basis": "      依据：{basis}",
    "send.candidates.kind.false_completion": "声称已完成 · 未验证",
    "send.candidates.kind.profile_candidate": "可能的长期偏好",
    "send.candidates.kind.context_gap": "可能缺失的上下文",
    "send.candidates.kind.harvest_candidate": "可能可复用的心得",
    // 优雅降级行（模型未被使用 / 不可达）。
    "send.degraded.no_redacted_snippets": "未外发：没有可发送的已去敏片段（请先用 --dialogue/--logs 提供对话/日志导出）。上面你的本地结果仍然有效。",
    "send.degraded.consent_required_non_tty": "未外发：需要确认但未给出（在非交互式 shell 里需要 --yes）。上面你的本地结果仍然有效。",
    "send.degraded.declined": "未外发：你拒绝了。上面你的本地结果仍然有效。",
    "send.degraded.generic": "外部模型无法使用（{reason}）——回退到上面你的本地结果。没有任何东西被编造。（模型：{model}）",
    // --dry-run-send：打印将要发送的确切去敏负载，什么都不发。
    "send.dryRun.head": "--dry-run-send：将要发送的确切去敏负载（什么都没发，没有调用任何模型）：",
    "send.dryRun.note": "在下方审阅。每个敏感值都已遮蔽；提示会通过 stdin 传给模型。",

    // ---- 对话扫描（语义扫描的本地半）----
    // 透明性头部（红线 #5）：当读取了本地对话/日志导出时，打印在报告顶部。
    // 列出文件 + 行数 + 命中片段总数，然后单独一行「全本地、未外发」承诺。
    "bootstrap.dialogue.head": "读取了你提供的 {count} 个本地导出（{files}）——命中 {snippets} 条片段。",
    "bootstrap.dialogue.localPromise": "这些只在本地读取，显示前已去敏，且没有任何东西被发送到任何地方。",
    "bootstrap.dialogue.skippedHead": "你指定的部分文件无法读取（已跳过，不影响其余）：",
    "bootstrap.dialogue.skipped.not_found": "  - 已跳过 {path}（未找到）",
    "bootstrap.dialogue.skipped.unreadable": "  - 已跳过 {path}（不可读）",
    "bootstrap.dialogue.skipped.not_a_file": "  - 已跳过 {path}（不是文件）",
    "bootstrap.dialogue.skipped.too_large": "  - 已跳过 {path}（太大）",
    "bootstrap.dialogue.skipped.unsupported_type": "  - 已跳过 {path}（不支持的类型——请用 .txt/.json/.md/.log）",
    // VERIFY 卡 · 对话块：清晰分隔的头部 + 每条声明一行。措辞「来自对话的
    // 声明 · 未验证」是诚实契约，绝不软化；片段已去敏。
    "bootstrap.verify.dialogueHead": "  来自你的聊天（来自对话的声明 · 未验证——不显示为已完成）：账本无法支撑的 {count} 条『完成』声明：",
    "bootstrap.verify.dialogueItem": "  - {path}:{line} —— “{snippet}”",
    // HARVEST 卡 · 对话块：分隔的头部 + 每条候选一行。仅候选；不保存任何东西。
    "bootstrap.harvest.dialogueHead": "  来自你的聊天（候选——不保存任何东西）：一个你可能想记录的长期偏好：",
    "bootstrap.harvest.dialogueItem": "  - 你重复了这条纠正 {count} 次 → 建议记入一条 profile 偏好：“{snippet}”",
    // 当唯一的『完成』信号来自聊天（账本没有对应缺口）时的下一步：把它变成
    // 一个真实被跟踪的任务，让这个『完成』不再只是嘴上说说。
    "bootstrap.next.dialogueClaim.text": "下一步：你的聊天声称某件事已完成，但账本无法支撑——把它变成一个被跟踪的任务 + 一次已记录的运行，让这个『完成』成为真的。",
    "bootstrap.next.dialogueClaim.cmd": "  ai-collab task create --title \"...\"",

    // ---- common errors ----
    "error.missingOption": "缺少 --{name}。",
    "error.missingTarget": "缺少 --target。运行：ai-collab init --target <dir>",
    "error.noWorkspace":
      "在 {where} 未找到 .aict 工作区。运行层命令操作的是一个已存在的工作区。" +
      "请先创建一个：ai-collab init --target <dir>（会写入 <dir>/.aict），然后从 <dir> 运行，或传 --workspace <dir>/.aict。",
    "error.noWorkspace.currentDir": "当前目录",
    "error.taskNotFound.update": "未找到任务 {id}。只能更新已存在的任务（运行：ai-collab task create ...）。",
    "error.taskNotFound.evidence": "未找到任务 {id}。只能给已存在的任务添加证据（运行：ai-collab task create ...）。",
    "error.taskNotFound.runStart": "未找到任务 {id}。只能为已存在的任务开始一次运行。",
    "error.taskNotFound.runExec": "未找到任务 {id}。只能为已存在的任务运行命令。",
    "error.taskNotFound.receipt": "未找到任务 {id}。只能为已存在的任务创建回执。",
    "error.taskNotFound.handoff": "未找到任务 {id}。请为一个已存在的任务创建交接草稿，或省略 --task 以覆盖整个工作区。",
    "error.taskNotFound.learning": "未找到任务 {id}。只能把学习项绑定到已存在的任务（或省略 --task）。",
    "error.doneNoEvidence": "任务 {id} 在没有证据的情况下不能被标记为“done”。请先添加证据（ai-collab evidence add --task {id} ...），或改用 blocked/partial/unverified。",
    "error.taskStatusInvalid": "--status 必须是以下之一：{allowed}（收到 \"{got}\"）。",
    "warn.doneNoReceipt": "警告：任务 {id} 在没有已签收回执的情况下被标记为完成；这会显示为作者自标·未经验证——请补上证据和一份回执来验证。",

    // ---- run exec 危险命令护栏（B6a-1）----
    // 一道保守、收窄的护栏：只有公认的破坏性写法才会触发（普通命令很少被拦——可能有少量误报，--yes 可覆盖）。
    // 有交互终端时问 y/N（默认 N）；没有交互终端时直接拒绝，除非带上 --yes/--force。
    // 一旦拒绝，命令既不执行也不记账。
    "danger.header": "危险命令——这条命中了一个已知的破坏性模式。",
    "danger.matched": "  命中：{patterns}",
    "danger.command": "  命令：{command}",
    "danger.prompt": "仍然运行它？[y/N] ",
    "danger.declined": "已拒绝：危险命令未运行（你回答了否）。未记录任何内容。",
    "danger.refusedNonTty": "已拒绝：这条命令命中了一个已知的破坏性模式（{patterns}），且当前没有交互终端可供确认。请带上 --yes（或 --force）重新运行以强制执行。未记录任何内容。",

    // ---- --help levels（完整 L0-L4 参考；诚实限定词忠实保留，绝不软化）----
    "help.levels": `守卫等级（L0-L4）

大白话：守卫等级评的是一个『完成』背后的证据，并据此给该证据所能挣得的判定设上限。证据越多、
越独立，等级越高。单一工具自查自己的工作，最高只到 L2（『带风险通过』）；一个干净的『pass』
需要第二个、不同的模型家族来复查它（L3）；本地最强的通过（L4）还需要那个复查者真的把命令重跑一遍，
并与一次已记录的运行对得上。等级你从不手动填——CLI 会根据你引用的证据计算出来。

等级由 CLI 根据你的 --review-mode + 所引用的证据计算得出——不是你声明的。
--claimed-level（即旧的 --guard-level）只用于在你声明的等级超过证据所能支撑时向你发出警告；
被记录下来的等级永远是计算出来的那个。
  L0   仅有摘要                     -> 只能是 insufficient_evidence
  L1   有产物，但无真实运行         -> 不能通过
  L2   单工具 或 同族子代理（建议性）-> 最多 pass_with_risk
  L2.5 同工具、不同模型（弱 L3）     -> 最多 pass_with_risk
  L3   跨族复核（自报）             -> 可以通过，但标记为未经验证
  L4   跨族复核 且 复查者的重跑与一次已记录的 run exec 对账一致 -> 本地最强通过
等级如何挣得：review-mode 设定一个上限（self/same_family_subagent -> L2，
same_tool_other_model -> L2.5，cross_family -> L3，cross_family_rerun -> L4），
而证据为其封顶（一行 cross_family_guard 启用 L3；L4 同时需要那行 cross_family_guard
以及一行引用了已对账的已记录 run exec 的 rerun——同一任务、已完成、executed:true、
exitCode + command + outputSha256 都匹配。一次已对账的重跑单凭它自己只是单工具的运行证据——只到 L2）。
真实等级取两者中较低的那个——所以开你自己的同族子代理，无论你声明什么都永远到不了 L3；
而一个没有已对账重跑的跨族声明，最高只到『L3（自报跨族·未经验证）』。一次没有跨族复核的已对账重跑，
只不过是作者自己又把命令跑了一遍——它停在 L2，永远不会是 L4。
重要——家族诚实：cross_family_guard 那一行上的模型家族是自报的。本工具在本地运行，无法验证它，
所以一个 L3 会被显示为『自报跨族·未经验证』。L4 更难——它必须引用一次已记录的 run exec（runs.jsonl），
其 exitCode + command + outputSha256 都对账一致——但它仍然是一个本地信任级别的通过：单个用户可以自己挑选
并运行一条本地命令（而手工编辑过的账本可以把任何字段设成任意值），所以 L4 的含义是『有一次已记录、
输出已匹配的本地运行作为支撑』，而非密码学意义上的验证。（这些字段没有一个是防伪证明；它们只记录谁/什么声明了什么。）

网络：未使用。
`,

    // ---- --help（主参考·术语轻量）。命令语法在两种语言里都按原样保留（那是用户要敲的内容）；
    //      散文部分忠实翻译，诚实限定词一律不软化。
    "help.main": `AI 协作开放系统

已从 npm 安装——全局 ai-collab 命令在任何地方都可用。（若从源码克隆，等价命令是 node bin/ai-collab.js <command>。）

新来的？这些命令覆盖了你大部分所需（大白话优先）：
  first-run  推荐的入口：创建你的工作区、把规则装进你 AI 的常驻指令、并打印你要发给 AI 的那一句话，好让它开始引导你。从这里开始。
  init       只创建你的工作区——一个你自己保留的、装着纯文本文件的文件夹，但不装任何 AI 规则（所以你的 AI 不会自己开口引导你；要那样请跑 first-run）。
  bootstrap  查看你自己最近的工作，并打印一份只读的「你处在什么位置」报告。它就是 first-run 引导里「扫描」那一步用到的只读扫描；你也可以随时自己运行它，得到同样的只读基线。
  status     显示哪些是打开的、哪些已完成，以及一条建议的下一步。任何时候运行它来摸清方位。
完整命令列表在下方。守卫等级（L0-L4）和跨族理论放在最末尾——运行 "ai-collab --help levels" 只看那部分。

用法：
  ai-collab first-run --target <dir> --tool <claude|codex|cursor|copilot|cline|windsurf|all>   # 推荐：创建工作区 + 装 AI 规则 + 打印你要发给 AI 的那句话
  ai-collab init --target <dir> [--dry-run] [--force]   # 只创建工作区文件（不装 AI 规则；AI 不会自己开口）
  ai-collab welcome [--lang <en|zh>]   # 打印安装后 AI 给你看的那段固定新手介绍
  ai-collab guide
  ai-collab demo
  ai-collab bootstrap [--workspace <dir>] [--report-only] [--json] [--yes] [--dialogue <path[,path]>] [--logs <path[,path]>]
  ai-collab check --workspace <dir>
  ai-collab adapters install --target <dir> [--tool <list>] [--enable-hooks] [--dry-run] [--force]

  运行层（在真实任务上操作这套循环；全部接受 --workspace <dir>；不给它时
  就用这里的 ./.aict，若还没有工作区则以 init 指引拒绝——绝不写出一个游离的 ./state）：
  ai-collab task create --title "..."
  ai-collab task update --task <id> --status <open|done|blocked|partial|unverified>
  ai-collab evidence add --task <id> --kind <k> --summary "..." [--detail "..."]
     kind 为 rerun 时还需要：            --command "<cmd>" --exit <code> --output "<captured output>" [--run <runId>] [--runner "<name>"]
                                        （--run 链接到 runs.jsonl 里一次已记录的运行；rerun 要达到 L4 时必需——
                                         该运行必须是同一任务的一次已完成 run exec，且 exitCode + command + output 都一致）
     kind 为 cross_family_guard 时还需要：--reviewer "<who>" / --family "<model-family>" / --ref "<source>" 至少其一
  ai-collab run start --task <id> [--command "..."]   # 记录一次你上报的运行（不执行）
  ai-collab run finish --task <id> --exit <code>      # 记录你上报的退出码
  ai-collab run exec --task <id> --command "..." [--cwd <dir>] [--clean-env]   # 真的在本地运行它 + 记录真实退出码（executed:true）
     默认在工作区的项目根目录运行（不是你当前的 shell 目录）；--cwd <dir> 可覆盖。它实际
     运行所在的目录会被记录在该运行上并打印出来，所以证据会显示命令究竟在哪里执行。
     安全：'run exec' 会在本地运行一条真实的 shell 命令——先读懂这条命令，尤其是当它由 AI 建议时。
     一组收窄的已知破坏性写法（rm -rf、sudo、fork 炸弹、curl|sh、dd、mkfs、> /dev/、chmod -R 777、重定向到系统路径）
     会触发护栏：有交互终端时问 y/N（默认 N）；没有终端时直接拒绝，除非带上 --yes（或 --force）。普通命令很少受影响
     （可能有少量误报；被引号当作数据、或作为参数而非命令本身的危险词会被忽略；--yes 可覆盖），一旦拒绝则不记录任何内容。
     --clean-env 用一个最小环境（只有 PATH/HOME + 语言环境/临时目录这些基础项）来运行命令，而不是继承
     你的完整环境，这样一条被建议的命令就读不到你的 API 密钥/令牌。默认（不加该标志）继承完整
     环境，行为不变。该运行是否为 clean-env 会被记录在运行上（cleanEnv）并打印。
  ai-collab receipt create --task <id> --verdict <pass|reject|insufficient_evidence|pass_with_risk> [--review-mode <self|same_family_subagent|same_tool_other_model|cross_family|cross_family_rerun>] [--claimed-level <L0|L1|L2|L2.5|L3|L4>] [--evidence <id,id>] [--rerun <id,id>]
  ai-collab receipt accept --id <receiptId> --owner [name]
  ai-collab learning add --type <harvest|profile> --content "..." [--task <id>]
  ai-collab learning confirm --id <id>        # 原样保留它
  ai-collab learning edit --id <id> --content "..."   # 改写后保留
  ai-collab learning drop --id <id>           # 丢弃它
  ai-collab status [--workspace <dir>] [--json]
  ai-collab handoff create [--task <id>] [--workspace <dir>] [--json]
     从账本生成一份交接草稿（.aict/handoff/handoff-*.md），好让下一个会话/工具无需从头解释就能接上。
     只有带着一份已签收回执的任务才会被列为 Done；pass_with_risk / pending /
     未经验证的工作会归到 Unverified 之下。这份草稿是一个供你复核并补全的起点，不是一份已完成的交接。
  ai-collab capability detect [--project <dir>] [--tools <list>] [--families <list>] [--subagents] [--can-switch-model] [--can-rerun] [--no-new-conversation] [--json]

  bootstrap：first-run 引导用到的只读扫描引擎。当你把 first-run 打印的那句触发语
  （"Walk me through the ai-collab first run."）发给你的 AI 时，引导式 walkthrough 会在它的扫描那一步
  跑这个命令来查看你最近的工作；你也可以随时自己运行它，
  得到同样的只读基线。它读取你自己最近的工作——
  你的仓库结构、你最近的 git 历史（只读）、你的 .aict 账本，以及
  你的 AI 指令文件——并打印一份朴素的「AI 协作基线」，含
  五张卡：PROFILE CLUES（画像线索——来自你配置的信号，比如
  检测到的工具、最近改动的文件类型——是交给你自己 AI 去跟你确认的线索，
  不是 bootstrap 下的结论），VERIFY（哪些『完成』暂时还不能信——待定的、风险尚未
  签字的，或自报的跨族复核——按与 status/handoff 相同的诚实
  规则重新计算，绝不被显示为已完成），RESUME（你进行中的任务、一份
  缺失的交接、你反复改动的文件），ROLES（把你工作里扫到的高风险关键词
  映射到已有的协助角色，比如 red-team / dual-guard——它只陈述「出现了风险词」
  这个事实、是否真的适用由你的 AI 确认，绝不下风险判定），以及 HARVEST（你可以带走的
  已确认心得）。它是确定性的、
  本地的：不调用外部模型、不做猜测，
  没有任何东西离开你的机器，而且它什么都不写（只读报告）。它会先
  打印扫描范围并需要 --yes 才继续（--yes 为脚本场景跳过那次确认）。
  一个空的/仅有示例的工作区会诚实地说「你还没有属于自己的数据」。
  可选、默认关闭：--dialogue <路径> / --logs <路径> 只读取你自己指定的
  本地对话/日志导出（多个用逗号分隔），并加入确定性、已去敏的发现——
  账本无法支撑的聊天「完成」会被列为「来自对话的声明 · 未验证」（绝不显示成
  已完成），你反复做出的纠正会成为一个「候选」profile（不保存任何东西）。
  仍然本地、仍然不调模型、仍然不联网。

  守卫等级（L0-L4）评定一个『完成』背后的证据，并据此为它所能挣得的判定封顶。
  一句话：更多/更独立的证据 -> 更高的等级 -> 更强的通过；单一
  工具最高只到 L2（pass_with_risk），而一个干净的『pass』需要一次 L3+ 的跨族复核。
  等级由 CLI 根据你的证据计算得出——你从不声明它（--claimed-level，
  即旧的 --guard-level，只在你声明的等级超过证据所能支撑时发出警告）。
  完整的 L0-L4 阶梯、每个等级如何挣得，以及家族诚实方面的限定，请运行：
    ai-collab --help levels
  一份 pass_with_risk 回执被创建为「pending」，需要 "receipt accept --owner [name]" 才能被签收。
  Owner 签收记录的是一次本地的人类签字（行为人 + 时间戳）——一条协作审计轨迹，而非密码学签名。

  Capability detect：与一份回执的守卫等级是不同的问题。回执说的是这个任务挣得了什么；
  "capability detect" 说的是你的配置最高可能拿到多少分——你的天花板。它探测项目里的工具
  标记（.claude/、.codex/、.cursor/、AGENTS.md…），并接收自报标志（--tools / --families /
  --subagents / --can-switch-model / --can-rerun），因为 CLI 看不见你装了哪个 AI。
  起决定作用的裁判是你能带来的不同模型家族的数量，而非工具数量：两个同族
  工具共享盲点（仍是 L2）；第二个、不同的家族才是通往干净通过（L3）的门槛；在此之上你自己
  再把命令重跑一遍才到 L4。然后它会打印出抬高天花板最有价值的那一步。
  天花板不等于已达成：天花板是你的工具最多能支撑到的程度；每个任务仍然要用它所引用的
  证据去挣得自己的等级。项目信号是推断，不是证明（一个标记文件并不能锁定一个模型家族），
  所以请用 --tools / --families 来确认。

  学习账本：记下一个任务教会你的东西，好让下一个任务起步更靠前。"learning add" 提出一条
  心得（--type harvest）或一条长期偏好（--type profile）；它落为「proposed」直到你保留它
  （learning confirm）、改写并保留它（learning edit），或丢弃它（learning drop）。只有已确认/已改写的
  行才会毕业进入你的长期画像——没有任何东西仅凭 AI 一面之词就生效。每个任务最多保留一条 harvest +
  一条 profile。然后 "status" 会回显你最近确认的那一条偏好，让你感觉这个
  工具在学习你怎么工作，而你无需维护一套系统。

  --tool 选择哪些 AI 工具会拿到一个指令文件。取值：cursor、codex、
  claude、copilot、cline、windsurf、all、auto（多个用逗号分隔）。
  默认 auto 只为在目标里检测到的工具安装；若一个都没检测到，
  它什么都不写并要求你传 --tool。用 --tool all 安装全部六个。

  三个适配档位，从最不侵入到最侵入：
    1. rules （默认，永远安全）-- --tool 写入的每工具指令文件。
    2. skills（可选）          -- .aict/skills/ 里可复用的能力卡
                                  （由 init 创建），按需加载进一个工具。
    3. hooks （可选，默认关闭）-- --enable-hooks 添加两个仅限本项目的 Claude
                                  Code 钩子：一个 Stop 钩子在出现完成声明时
                                  提醒你记录回执；一个一次性 SessionStart 钩子
                                  在你首次进入会话时让 AI 主动开始引导。绝不是
                                  全局钩子；安装时会先列出每个文件，且可移除。
                                  只对 --tool claude 生效。

首次体验（推荐）：
  first-run --target . --tool <claude|codex|cursor|...> -> 把打印出来的那句话发给你的 AI ->
  在你自己的一个真实任务上跑完整一圈（打开 .aict/walkthroughs/10-minute-your-task.md；
  想先在一个预置示例上看看流程？改为打开 .aict/walkthroughs/10-minute.md）

立即运行：
  ai-collab first-run --target . --tool claude   # 推荐：建工作区 + 装 AI 规则 + 打印触发语
  ai-collab init --target ./my-ai-workspace      # 次选：仅工作区文件（不装 AI 规则；你的 AI 不会自己主动开口）
  ai-collab init --dry-run                        # 仅预览工作区文件，不写入任何东西

网络：未使用。
`
  }
};
