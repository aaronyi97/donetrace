# Security Policy

## Local-first boundary

The CLI does not call external AI APIs, upload user content, scan the whole disk, go online, or install hooks without consent.

One command runs code by design: `ai-collab run exec --task <id> --command "..."` executes the command **you** supply, in your own shell, **locally** (to record a real exit code) — exactly like a task runner. It never runs anything you did not pass it, and it still does not go online. The `run start` / `run finish` commands do **not** execute anything — they only record a command and exit code you report.

### Dangerous-command guard (`run exec`)

`run exec` adds a conservative, deliberately **narrow** safety check. A small set of well-known destructive command shapes trips a guard before anything runs:

- `rm -rf` / `rm -fr` (recursive force delete)
- `sudo ` (privilege escalation)
- a fork bomb (`:(){ ... }`)
- a network download piped straight into a shell (`curl ... | sh`, `wget ... | bash`)
- `dd ` (raw disk write) and `mkfs` (format a filesystem)
- a redirect into a `/dev/` device node (e.g. `> /dev/sda`; harmless sinks like `>/dev/null` are excluded)
- `chmod -R 777` (world-writable, recursive)
- a redirect (`>`/`>>`) into a **system path** (`/etc`, `/usr`, `/bin`, `/sbin`, `/boot`, `/lib`, …)

When a command matches:

- **On an interactive terminal**, the CLI prints the matched pattern(s) and the command, then asks `[y/N]`. The default is **N** — pressing Enter (or anything other than `y`/`yes`) declines, and **nothing is executed and nothing is recorded**.
- **Without an interactive terminal** (a script, CI, or an AI calling the CLI), the command is **refused** outright. Pass `--yes` (or `--force`) to run it anyway.

Ordinary commands are **rarely** affected — narrow false positives are possible, and `--yes` (or `--force`) always overrides. The guard ignores a danger word that is quoted as data (`echo 'rm -rf ...'`) or used as an argument rather than the command being run (`grep sudo file`), so common cases do not trip it; if no pattern matches, behavior is exactly as before. A knowingly-approved dangerous run is recorded with `dangerousConfirmed: true` so the ledger shows it was confirmed on purpose. The guard is intentionally narrow to avoid false alarms; it is a speed bump for the obviously-destructive case, **not** a sandbox — always read a command (especially an AI-suggested one) before running it.

## Reporting

Please report security issues **privately** — do not open a public issue or publish exploit details. Use either private channel:

- **GitHub Security Advisory** (preferred): open a draft advisory at
  https://github.com/aaronyi97/ai-collab-open-system/security/advisories/new
- **Email**: yi19970319@gmail.com (X/Twitter: https://x.com/AaronYiaazw)

Please allow a few days for an acknowledgement. This is a local-first tool with no
server and no telemetry, so most reports will concern the CLI's file writes,
packaging, or the privacy scanner.

## Sensitive material

Never include:

- Tokens, keys, cookies, or credentials.
- Local machine paths.
- Raw private conversations.
- Actual client material.
- Non-public automation or tool-routing details.
- Unredacted screenshots.

Run:

```bash
node scripts/privacy-scan.js
```
