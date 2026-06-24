// Single source of truth for the "must never ship in the npm tarball" rules.
//
// Both scripts/privacy-scan.js (which scans `npm pack --dry-run` output as one of
// its surfaces) and scripts/pack-check.js (the standalone release-safety gate)
// enforce this list. Keeping it in one module prevents the two copies from
// drifting apart — a divergence would mean one gate blocks a private file while
// the other silently ships it.
//
// Each entry is [RegExp, humanLabel]. The regex is tested against a pack file
// path (POSIX-style, as npm reports it). `.git/` and `node_modules/` are included
// here as regexes so a single shared list fully covers the forbidden surface.
//
// Only GENERIC, anyone-applies markers live here as literals (a `.env`, a
// `.claude/` config dir, a backup file, a secret/key). A maintainer's OWN private
// directory names are NOT hard-coded here (that would ship the maintainer's
// private dir name inside the public package). Instead, callers pass their own
// private dir names via `extraPrivateDirs` — sourced from a gitignored local
// config (see privacy-scan.local.json.example) — so the protection stays
// configurable while the shipped code stays generic.

export const FORBIDDEN_IN_PACK = [
  [/(^|\/)\.env(\.|$)/i, ".env file"],
  [/(^|\/)\.claude(\/|$)/i, "private Claude config dir"],
  [/\.aict-backup-/i, "adapter backup file"],
  [/\.aict\.backup-/i, "workspace backup file"],
  [/(^|\/)(secrets?|credentials?)(\.|\/|$)/i, "secrets/credentials file"],
  [/\.(pem|key|p12|pfx)$/i, "private key material"],
  [/(^|\/)node_modules\//i, "node_modules"],
  [/(^|\/)\.git\//i, ".git internals"]
];

// Build a pack rule that blocks a user-configured private directory (matched as a
// path segment, the same way the literal rules above match `.claude/`). The dir
// name is escaped so it is treated literally, not as a regex.
function privateDirRule(dir) {
  const safe = String(dir).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [new RegExp(`(^|/)${safe}(/|$)`, "i"), `configured private dir (${dir})`];
}

// Return the list of "{label}: {file}" violations for a set of pack file paths.
// `extraPrivateDirs` lets a caller add their own private dir names (from a local,
// gitignored config) without those names ever being baked into this shipped file.
export function findForbiddenPackFiles(files, extraPrivateDirs = []) {
  const rules = [
    ...FORBIDDEN_IN_PACK,
    ...(extraPrivateDirs ?? []).filter(Boolean).map(privateDirRule)
  ];
  const violations = [];
  for (const file of files) {
    for (const [regex, label] of rules) {
      if (regex.test(file)) violations.push({ file, label });
    }
  }
  return violations;
}
