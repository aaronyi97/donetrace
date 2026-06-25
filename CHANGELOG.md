# Changelog

This project is **published to npm** as `ai-collab-open-system`, and the global `ai-collab` command
is live. See [Release Status](./README.md#release-status) for the four-state ladder it moved through.

## 0.1.0 — 2026-06-25 (published to npm)

Status: published to npm as `ai-collab-open-system@0.1.0`; the global `ai-collab` command installs via
`npm install -g ai-collab-open-system` and every documented command works as written. Source is on
GitHub `main` with CI green.

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
