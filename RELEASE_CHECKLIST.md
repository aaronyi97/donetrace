# Release Checklist

Use this before labeling a commit as a public release candidate, and to move it through the
release states. The four states are defined in [README Release Status](./README.md#release-status):
**local candidate → publishable candidate → GitHub source release → npm package**.

Current state of `main`: **npm package** (published to npm as `ai-collab-open-system@0.1.0`; the
global `ai-collab` command is live). All automated gates are green (`npm test`, `npm run check` —
contract + privacy + pack — and `npm pack --dry-run`), the source is on GitHub with CI green, and
the package is installable from npm. The boxes below are kept as the reusable release procedure
(and re-verification points) for the next version.

## Required local checks

- [ ] `npm ci` (reproducible install from the committed `package-lock.json`)
- [ ] `npm test`
- [ ] `npm run check` (test + contract + privacy + pack)
- [ ] `npm pack --dry-run`

## Fresh-tarball install smoke

Mirrors the CI `Tarball install smoke` job. The point is to prove the *packed artifact* installs
and the *installed* `ai-collab` bin runs — not just that the source tree runs.

- [ ] `npm pack` to produce `ai-collab-open-system-<version>.tgz`.
- [ ] In a clean temp dir, `npm init -y` then `npm install <path-to-tgz>`.
- [ ] Confirm `node_modules/.bin/ai-collab` exists and resolves to the package bin.
- [ ] Run the installed bin (e.g. `./node_modules/.bin/ai-collab ...`), each must exit 0:
  - [ ] `ai-collab init --target <dir> --force`
  - [ ] `ai-collab guide`
  - [ ] `ai-collab demo`
  - [ ] `ai-collab check --workspace <dir>/.aict`
- [ ] (The documented user path is the global `ai-collab <cmd>` after `npm install -g
      ai-collab-open-system`; from a clone, `node bin/ai-collab.js <cmd>` is the same entry, and CI
      smoke-tests both the installed bin and the source entry.)

## Product surface

- [ ] README first screen shows messy input -> structured result.
- [ ] README Release Status section states the honest current state (npm package reached), and the
      global `ai-collab` / `npm install` mentions match the published reality.
- [ ] Generated `.aict/START_HERE.md` supports both 10-minute experience and 60-minute setup.
- [ ] The flagship case includes `raw-input`, `baseline-output`, `system-run`, `artifacts`, `comparison`, and `next-step`.
- [ ] Other cases contain enough detail to run and review, not one-line filler.
- [ ] Prompt and skill similarity tests pass.

## Safety and honesty

- [ ] `--force` backs up existing `.aict` content before replacement.
- [ ] Adapter files are called adapter guidance, not deep integration.
- [ ] No claim says the CLI automatically understands a user's real business.
- [ ] No doc states an unreached release step as already done, and no doc claims ahead of reality
      (the docs describe each release state only once it has actually been reached).
- [ ] CHANGELOG shows the current version's real status (published to npm) with a release date that matches the actual publish.
- [ ] No private source material, local personal paths, tokens, email addresses, customer data, or private governance content are present.
- [ ] Privacy scan passes on the source tree and generated workspace.
- [ ] **Maintainer ran the privacy scan with their LOCAL override active.** The shipped `privacy-manifest.json` deliberately contains only generic, anyone-applies markers — it does NOT list this maintainer's own private directory names (e.g. a personal governance folder or knowledge base), because the manifest itself is published and listing them would leak the very names we are protecting. Those names live ONLY in the gitignored `privacy-scan.local.json` (copy `privacy-scan.local.json.example`, fill in the real folder names under `paths`). Before publishing, confirm that file exists and run `npm run privacy:scan` once with it in place, so any stray reference to your private dirs is caught and blocked from the tarball. Verify (and re-confirm after the run) that `privacy-scan.local.json` is still gitignored and is NOT staged/committed — it must never ship.

## From GitHub source release to npm package

These are the steps (and their state gates) that take this repo from earliest build all the way to
a published **npm package**. Each step is also a re-verification point. Steps 1–3 are done for
`0.1.0` (the package is published); re-run this same procedure for the next version.

1. **local candidate → publishable candidate** (done)
   - [x] All "Required local checks", "Fresh-tarball install smoke", and "Safety and honesty" boxes above are green.
   - [x] Decide the version. If it changes, update `version` in `package.json` and `package-lock.json`, and add a dated CHANGELOG entry.
   - [x] Working tree clean; no stray `*.tgz` or `*.aict-backup-*` / `.aict.backup-*` artifacts tracked (they are gitignored).
2. **publishable candidate → GitHub source release** (done)
   - [x] `git push` the release commit to the public GitHub repo.
   - [x] Confirm CI is green on the pushed commit (matrix + tarball install smoke + CLI smoke).
   - [x] `git tag v<version>` and `git push --tags` (or create a GitHub Release for the tag).
3. **GitHub source release → npm package** (done)
   - [x] Confirm npm auth (`npm whoami`) and that the `name`/`version` are publishable (not already taken/published).
   - [x] `npm publish` (consider `npm publish --dry-run` first; the package is public, Apache-2.0).
   - [x] Post-publish: in a clean dir, `npm install -g ai-collab-open-system` (the package name) and verify the global `ai-collab init/guide/demo/check` command all work.
   - [x] README/CHANGELOG statements about the global `ai-collab` command and `npm install` are now literally true; the Release Status table marks **npm package** reached and the CHANGELOG carries the release date.
