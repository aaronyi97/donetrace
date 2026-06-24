# Changelog

This project's source is on GitHub with CI green, but it is **not published to npm**. The version
below is prepared and unpublished; see [Release Status](./README.md#release-status) for the
four-state ladder.

## 0.1.0 — Unreleased (GitHub source on `main`, CI green)

Status: source pushed to GitHub on `main` with CI green; **not git-tagged and not published to
npm**. No release date is claimed because no npm release has happened. The date here will be
filled in only when the package is actually published.

- Hardened CI: Node 18/20/22 matrix running `npm ci`, `npm run check`, `npm pack`, a fresh-tarball
  install smoke test (install the packed artifact into a clean dir and run the installed `ai-collab`
  bin), and a CLI smoke (init/guide/demo/check), so CI blocks "installs but does not run" and broken
  CLI commands.
- Rebuilt the generated prompt and skill library as distinct capability packages.
- Added a flagship synthetic case showing messy input, baseline raw AI output, six-layer intervention, artifacts, comparison, and next step.
- Hardened CLI first-run behavior: real `ai-collab` commands, `init --dry-run`, required `--target`, required `--workspace`, JSON output, and bin-entry tests.
- Changed `--force` behavior to back up existing `.aict` content before replacement.
- Added adapter guidance installer for Codex, Claude Code, Cursor, GitHub Copilot, Cline, and Windsurf.
- Added privacy scanner coverage for common token, email, and local-path leaks.
- Added CI, issue templates, PR template, release checklist, and packed-package checks.
