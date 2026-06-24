# Known Limitations

Honest, known boundaries of this tool. These are real and documented on purpose — the
whole point of the project is to not pretend a "done" (or a tool) is more than it is, and
that honesty applies to the tool itself. Nothing here is a secret failure mode; each entry
says what the limit is, when it can bite, and what catches or works around it.

## Concurrent writes and duplicate ids — now mitigated by a file lock

**What it is.** Each ledger id (`t1`, `e2`, `c1`, `r1`, …) is allocated by reading the
existing rows, taking the highest numeric suffix, and returning the next one (`nextId` in
`src/ledger.js`). That is a *read-then-write*: the new id is decided from what is on disk at
read time, then appended. Historically, if two writes ran **at the same moment** against the
**same workspace** (e.g. two CLI processes, or two AI tools driving the same `.aict/` in
parallel), both could read the same highest id and then both append the same next one —
producing two rows with the same id in one ledger.

**Mitigation (file lock).** The id-allocation path is now serialized with a short on-disk
mutex. `withLedgerLock(stateDir, fn)` in `src/ledger.js` creates a lock file with
`openSync(lockPath, 'wx')` (the `O_EXCL` "create only, fail if it exists" flag), so exactly
one process holds it at a time; a loser retries with a small backoff (~25 ms) up to a ~5 s
timeout, and a **stale** lock left by a crashed process is reclaimed once it is older than
~10 s so the ledgers can never wedge permanently. The whole *read → compute next id → append*
(and run finish's *read-all → patch → rewrite*) happens **inside** the lock, with the ledger
re-read after the lock is held, so concurrent writers each see every row the others already
committed and cannot mint the same id. Verified by a test that spawns 15 truly-parallel
`task create`s and asserts zero duplicate ids (`tests/contract.test.js`, "B6a-2"); with the
lock disabled the same test reliably fails, which is how we know the lock — not luck — is
doing the work.

**Residual edge.** This is a best-effort local lock, not a distributed transaction. The
stale-lock reclamation window means a process paused (e.g. swapped out / suspended) for longer
than ~10 s while mid-write could in theory have its lock stolen — vanishingly unlikely for the
sub-millisecond ledger writes here, but not a hard mathematical guarantee. Networked or
case-insensitive filesystems with unusual `O_EXCL` semantics are likewise out of scope.

**What still catches anything that slips through.** The integrity check remains the backstop.
`node bin/ai-collab.js check --workspace <dir>/.aict` (also run by `npm run check`) validates
per-ledger id integrity and fails loudly with, for example:

```text
Contract check failed:
- ledger tasks.jsonl has duplicate id "t1"
```

So even in the residual edge, a duplicate cannot silently corrupt your trust trail: the next
`check` surfaces it with a pointable file + id. (The guard-level and acceptance logic also
recompute from evidence rather than trusting a stored field, so a duplicated row cannot quietly
upgrade a result.)

**How to recover.** If `check` ever reports a duplicate id, open the named `.jsonl` ledger
(plain JSON-lines, one record per line) and remove or renumber the offending duplicate row,
then re-run `check` to confirm it is clean. The ledgers remain plain, hand-inspectable files;
the lock is a thin coordination layer around the id allocation, not an opaque database.
