#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findForbiddenPackFiles } from "./lib/forbidden-in-pack.js";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--workspace") {
      args.workspace = argv[index + 1];
      index += 1;
    } else if (flag === "--no-extras") {
      // Skip the side-effecting scan surfaces (adapters-install output + npm pack
      // file list). Lets the scanner run as a pure read-only pass over a target
      // directory in a strict sandbox, instead of crashing on EPERM.
      args.noExtras = true;
    } else if (flag === "--strict") {
      args.strict = true;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Maintainable denylist / bilingual allowlist (privacy-manifest.json).
// The scanner reads the manifest so the forbidden paths/terms and the sanctioned
// bilingual surface can be extended without editing scanner code. If the manifest
// is missing or malformed we fall back to safe built-in defaults and warn.
// ---------------------------------------------------------------------------
const DEFAULT_DENYLIST = {
  // Note: absolute home prefixes like the users/home roots are intentionally NOT
  // string literals here — the alwaysForbidden regexes already hard-block real
  // local paths everywhere, and putting them as plain strings would make this
  // scanner file flag itself. The manifest `paths` array is the extension point.
  //
  // Keep this list GENERIC (anyone-applies). `.claude/hooks` is the standard
  // Claude Code hooks directory that every Claude Code user has, so it is a safe
  // generic marker for "don't paste your own private hook contents". A
  // maintainer's OWN private dir names (a personal governance folder, a private
  // knowledge base) are NOT listed here — that would ship the maintainer's
  // private dir name in the public package. Users add their own via the
  // gitignored privacy-scan.local.json (see privacy-scan.local.json.example).
  paths: [".claude/hooks"],
  terms: [],
  chineseTerms: []
};
const DEFAULT_BILINGUAL = {
  sectionMarkers: ["中文"],
  lineAllow: [],
  // Whole-file sanctioned bilingual SOURCES (relative posix paths). A file listed
  // here is the product's intentional bilingual surface (e.g. the i18n message
  // catalog), so the Chinese-leak HEURISTIC (the unmarked-run check) does not flag
  // its localized strings. This is the manifest-driven extension point for "this
  // file is bilingual by design", parallel to how the scanner already treats its own
  // policy files. IMPORTANT: it ONLY relaxes the run heuristic — the hard token/key/
  // local-path/email rules AND the chineseTerms denylist still apply, so a real
  // secret or a denylisted private Chinese term in such a file STILL fails the scan.
  sanctionedFiles: [],
  zhKeyAllowed: true,
  contextWindow: 12,
  minRun: 4
};

// Optional, gitignored local override. A maintainer keeps their OWN private dir
// names / terms here instead of in the shipped manifest, so the public package
// never names them. When present, its arrays are appended onto the manifest's.
function loadLocalOverride() {
  const localPath = path.join(repoRoot, "privacy-scan.local.json");
  if (!existsSync(localPath)) return null;
  try {
    return JSON.parse(readFileSync(localPath, "utf8"));
  } catch (error) {
    console.warn(`privacy-scan: could not parse privacy-scan.local.json (${error.message}); ignoring local overrides.`);
    return null;
  }
}

// Merge denylist arrays from manifest + local override on top of the generic
// built-in defaults. Arrays are concatenated and de-duplicated so a user's local
// private markers extend (never replace) the shipped generic ones.
function mergeDenylist(base, ...overlays) {
  const merged = { paths: [...(base.paths ?? [])], terms: [...(base.terms ?? [])], chineseTerms: [...(base.chineseTerms ?? [])] };
  for (const overlay of overlays) {
    if (!overlay) continue;
    for (const key of ["paths", "terms", "chineseTerms"]) {
      if (Array.isArray(overlay[key])) merged[key].push(...overlay[key]);
    }
  }
  for (const key of ["paths", "terms", "chineseTerms"]) {
    merged[key] = [...new Set(merged[key].filter((entry) => typeof entry === "string" && entry.length > 0))];
  }
  return merged;
}

function loadManifest() {
  const localOverride = loadLocalOverride();
  const manifestPath = path.join(repoRoot, "privacy-manifest.json");
  if (!existsSync(manifestPath)) {
    console.warn("privacy-scan: privacy-manifest.json not found; using built-in denylist defaults.");
    return { denylist: mergeDenylist(DEFAULT_DENYLIST, localOverride), bilingual: DEFAULT_BILINGUAL, publicContacts: [] };
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return {
      denylist: mergeDenylist(DEFAULT_DENYLIST, manifest.scanDenylist ?? {}, localOverride),
      bilingual: { ...DEFAULT_BILINGUAL, ...(manifest.bilingual ?? {}) },
      publicContacts: Array.isArray(manifest.publicContacts) ? manifest.publicContacts : []
    };
  } catch (error) {
    console.warn(`privacy-scan: could not parse privacy-manifest.json (${error.message}); using built-in denylist defaults.`);
    return { denylist: mergeDenylist(DEFAULT_DENYLIST, localOverride), bilingual: DEFAULT_BILINGUAL, publicContacts: [] };
  }
}

const { denylist, bilingual, publicContacts } = loadManifest();
// EXACT-string allowlist for the email rule below. The scanner blocks EVERY email
// address EXCEPT one that exactly matches an entry here — a narrow, explainable
// exemption for the project's PUBLISHED public contact only (see manifest
// publicContacts), NOT a domain or category allowlist: a different address, even at
// the same domain, still fails. Lower-cased so the comparison is case-insensitive.
const publicContactEmails = new Set((publicContacts ?? []).map((entry) => String(entry).toLowerCase()));
// The set of private directory names to also block from the npm tarball: the
// scanner's path denylist (generic + manifest + local). Generic literals like
// `.claude/` already live in the shared pack rules; the extra dirs here cover a
// user's configured private dirs without baking their names into shipped code.
const configuredPrivateDirs = denylist.paths ?? [];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const sectionMarkerRegexes = (bilingual.sectionMarkers ?? []).map((marker) => new RegExp(escapeRegExp(marker)));
const lineAllowRegexes = (bilingual.lineAllow ?? []).map((pattern) => new RegExp(pattern));
// Normalize the whole-file sanctioned bilingual sources to a set of posix-relative
// paths for an exact match in scanFile.
const sanctionedBilingualFiles = new Set(
  (bilingual.sanctionedFiles ?? []).map((p) => String(p).split(path.sep).join("/"))
);
const cjkRun = new RegExp(`[\\u4e00-\\u9fff]{${Math.max(1, bilingual.minRun ?? 4)},}`);
const cjkAny = /[一-鿿]/;

function walk(root, files = []) {
  if (!existsSync(root)) return files;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if ([".git", "node_modules", ".DS_Store"].includes(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function isPolicyFile(file, root) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const name = path.basename(file).toLowerCase();
  if (relative === "scripts/privacy-scan.js") return true;
  // pack-check.js is a release-safety enforcement script: it legitimately
  // enumerates the forbidden-to-ship patterns (.env, governance dirs, key
  // material), so it is treated as a policy file like the scanner itself.
  if (relative === "scripts/pack-check.js") return true;
  // The shared forbidden-in-pack rule module likewise names the generic
  // forbidden patterns (.env, .claude, secrets, key material) as regex literals
  // by design. It does not bake in any maintainer-private dir names.
  if (relative === "scripts/lib/forbidden-in-pack.js") return true;
  if (relative === "privacy-manifest.json") return true;
  if (relative.startsWith(".aict/privacy/")) return true;
  if (relative.startsWith("docs/") && (
    name.includes("privacy") ||
    name.includes("boundary") ||
    name.includes("redaction") ||
    name.includes("mapping") ||
    name.includes("security") ||
    name.includes("manifest")
  )) {
    return true;
  }
  return false;
}

// A Chinese run on a given line is "sanctioned" (part of the intentional
// bilingual surface) if the line itself is allowlisted, is a localized `zh:`
// string, or sits inside a bilingual block opened by a section marker within the
// configured context window. Everything else (stray, unmarked Chinese) is treated
// as a likely paste of private material and fails the scan.
function buildSanctionedLineSet(lines) {
  const sanctioned = new Set();
  let blockUntil = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (sectionMarkerRegexes.some((re) => re.test(line))) {
      blockUntil = i + (bilingual.contextWindow ?? 12);
    }
    if (i <= blockUntil) sanctioned.add(i);
    if (lineAllowRegexes.some((re) => re.test(line))) sanctioned.add(i);
    if (bilingual.zhKeyAllowed && /(^|[^\w])zh\s*:/.test(line)) sanctioned.add(i);
  }
  return sanctioned;
}

function scanChinese(content, relative, isPolicy, isBilingualFile = false) {
  const errors = [];
  // Policy/manifest/boundary files legitimately enumerate the forbidden Chinese
  // terms and discuss the bilingual surface, so the whole Chinese pass is gated
  // the same way as the English privateBoundaryPatterns. A real leak lands in a
  // non-policy file (a doc, a template, a generated artifact), which is still
  // scanned in full.
  if (isPolicy) return errors;
  // Hard denylist of known private Chinese terms — forbidden anywhere outside
  // policy files, even on an otherwise-sanctioned bilingual line OR a whole-file
  // sanctioned bilingual source. This stays ENFORCED so a private term like
  // "真实客户" can never hide inside the i18n catalog either.
  for (const term of denylist.chineseTerms ?? []) {
    if (content.includes(term)) {
      errors.push(`${relative}: contains denylisted Chinese private term "${term}"`);
    }
  }

  // A whole-file sanctioned bilingual source (the i18n message catalog) is allowed
  // to be densely Chinese, so the unmarked-run HEURISTIC below would only produce
  // noise. We skip just that heuristic for these files — the denylist above (and the
  // token/key/path/email rules in scanFile) still apply.
  if (isBilingualFile) return errors;

  const lines = content.split(/\r?\n/);
  const sanctioned = buildSanctionedLineSet(lines);
  for (let i = 0; i < lines.length; i += 1) {
    if (!cjkAny.test(lines[i])) continue;
    if (sanctioned.has(i)) continue;
    if (cjkRun.test(lines[i])) {
      const sample = (lines[i].match(cjkRun) || [""])[0].slice(0, 24);
      errors.push(`${relative}:${i + 1}: contains unsanctioned Chinese text (possible private leak): "${sample}…"`);
    }
  }
  return errors;
}

function scanFile(file, root) {
  const content = readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  const errors = [];

  const alwaysForbidden = [
    [/\/Users\/[^/\s]+(?:\/[^\s`'")]+)?/g, "local machine path"],
    [/\/home\/[^/\s]+(?:\/[^\s`'")]+)?/g, "local machine path"],
    [/[A-Za-z]:\\Users\\[^\\\s]+(?:\\[^\s`'")]+)?/g, "local machine path"],
    // Home-directory path VARIANTS, parallel to the absolute /Users//home//C:\Users
    // rules above. These are still GENERIC, anyone-applies markers (env-var home
    // expansions and tilde home) — they name no specific private directory, so they
    // do not bake any maintainer dir name into the shipped scanner.
    //   POSIX env-var home expansion (dollar-HOME, optionally brace-wrapped).
    //   Example forms are not written literally here so the scanner does not flag
    //   its own comment; see tests/contract.test.js for the concrete fixtures.
    [/\$\{?HOME\}?\/[^\s`'")]+/g, "local machine path"],
    //   Windows env-var home expansion (percent-USERPROFILE-percent backslash ...).
    //   The percent signs are written as [%] char-classes so this regex literal does
    //   not match itself when the scanner scans its own source (same self-exemption
    //   technique as the escaped $HOME rule above); the matched input is identical.
    [/[%]USERPROFILE[%]\\[^\s`'")]+/gi, "local machine path"],
    //   Tilde home subtree (tilde-slash named-dir slash more). Deliberately NARROW:
    // it requires a NON-dot first segment plus a deeper level, so it flags a leaked
    // real home path (a personal docs/desktop subtree) but NOT a bare tilde-slash, a
    // single-segment tilde-slash-foo, or a standard dot tool/config dir (the npm log,
    // config, or ssh dotfile dirs). Those dotfile dirs are generic-and-benign (the
    // same stance as the Claude hooks dir); a maintainer's OWN private dir name is
    // matched instead via the manifest/local denylist.paths loop, never hard-coded
    // here. Concrete matchable examples live only in the test fixtures, never in
    // this scanned source.
    [/~\/(?!\.)[^/\s`'")]+\/[^\s`'")]+/g, "local machine path"],
    [/\bgh[pousr]_[A-Za-z0-9_]{20,}/g, "GitHub token"],
    [/\bgithub_pat_[A-Za-z0-9_]{30,}/g, "GitHub token"],
    [/\bxox[baprs]-[A-Za-z0-9-]{20,}/g, "Slack token"],
    [/\bBearer\s+[A-Za-z0-9._~+/=-]{24,}/gi, "Bearer token"],
    [/\bapiKey\s*[:=]\s*["'][^"']{16,}["']/g, "apiKey"],
    [/\b(?:api[_-]?key|token|secret)\s*[:=]\s*["'][^"']{12,}["']/gi, "API key / token / secret"],
    [/(?<![A-Za-z0-9_])(?:\+?\d{1,3}[\s.-])?(?:\(?\d{3}\)?[\s.-])\d{3}[\s.-]\d{4}(?![A-Za-z0-9_])/g, "phone number"],
    [/(?<![\d.\-])1[3-9]\d{9}(?![\d.\-])/g, "Chinese mobile number"],
    [/sk-[A-Za-z0-9_-]{20,}/g, "OpenAI-style secret key"],
    [/AKIA[0-9A-Z]{16}/g, "AWS access key"],
    [/AIza[0-9A-Za-z_-]{20,}/g, "Google API key"],
    [/-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g, "private key"],
    [/sessionid\s*[:=]\s*[A-Za-z0-9_.-]{12,}/gi, "session id"],
    [/password\s*[:=]\s*['"][^'"]{6,}['"]/gi, "literal password"],
    [/(?<![A-Za-z0-9])[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?![A-Za-z0-9])/g, "UUID-style session id"]
  ];

  for (const [regex, label] of alwaysForbidden) {
    if (regex.test(content)) errors.push(`${relative}: contains ${label}`);
  }

  // Email addresses: any address is a likely private leak EXCEPT one that EXACTLY
  // matches the project's published public contact (manifest publicContacts). A
  // different address — even at the same domain — still fails. This is what keeps a
  // legitimate "contact: <public email>" footer in README/SECURITY/package.json from
  // tripping the gate, without opening a domain or whole-category allowlist. Applied
  // unconditionally (policy files included), exactly like the other always-forbidden
  // patterns, so a non-public email cannot hide in a policy/boundary doc either.
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const leakedEmails = (content.match(emailRegex) || []).filter((addr) => !publicContactEmails.has(addr.toLowerCase()));
  if (leakedEmails.length > 0) {
    errors.push(`${relative}: contains email address (${leakedEmails[0]})`);
  }

  const policy = isPolicyFile(file, root);
  if (!policy) {
    // Manifest-driven literal path/term denylist (case-insensitive substring).
    // Policy/boundary docs are allowed to *name* forbidden paths/terms, so this is
    // gated the same way as privateBoundaryPatterns below.
    const lowerContent = content.toLowerCase();
    for (const needle of denylist.paths ?? []) {
      if (lowerContent.includes(needle.toLowerCase())) errors.push(`${relative}: contains denylisted path "${needle}"`);
    }
    for (const needle of denylist.terms ?? []) {
      if (lowerContent.includes(needle.toLowerCase())) errors.push(`${relative}: contains denylisted term "${needle}"`);
    }

    // Generic, anyone-applies boundary patterns. A maintainer's OWN private dir
    // names (a personal governance folder, a private knowledge base) are NOT
    // hard-coded here — that would ship those names in the public package. They
    // are matched instead via the manifest/local `denylist.paths` loop above, so
    // users configure their own in the gitignored privacy-scan.local.json.
    // `.claude/hooks` stays as a generic marker (the standard Claude Code hooks
    // dir that every Claude Code user has).
    const privateBoundaryPatterns = [
      [/\.claude\/hooks/gi, "Claude hooks dir"],
      [/(^|[^\w.-])\.env(?:$|[^\w.-])/g, "environment file"],
      [/\baccount[_ -]?id\s*[:=]\s*[A-Za-z0-9_.-]{8,}|\bacct_(?:live|prod|private)[A-Za-z0-9_.-]*/gi, "account identifier"],
      [/\breal customer\b|\bcustomer name\b|\bclient name\b/gi, "real customer"],
      [/\breal project\b|\bprivate project\b|\bsecret project\b/gi, "real project"],
      [/\breal conversation\b|\braw private conversation\b|\bprivate chat transcript\b/gi, "real conversation"],
      [/\bprivate hook\b/gi, "private hook"],
      [/\bprivate route\b|\binternal route\b|\bprivate routing rules\b/gi, "private route"],
      [/\b(?:internal\s+)?threshold\s*[:=]\s*[0-9.]+|\bcalibration thresholds?\b/gi, "internal threshold"],
      [/\b(?:internal\s+)?(?:scoring\s+)?weight\s*[:=]\s*[0-9.]+|\bjudgment weights?\b/gi, "internal weight"],
      [/\binternal session(?: id)?\s*[:=]\s*[A-Za-z0-9_.-]{12,}|\bsess_[A-Za-z0-9_.-]{12,}/gi, "internal session id"]
    ];
    for (const [regex, label] of privateBoundaryPatterns) {
      if (regex.test(content)) errors.push(`${relative}: contains ${label}`);
    }
  }

  const relativePosix = relative.split(path.sep).join("/");
  const isBilingualFile = sanctionedBilingualFiles.has(relativePosix);
  errors.push(...scanChinese(content, relative, policy, isBilingualFile));

  return errors;
}

// jsonl is included so the P1 run-layer ledgers (state/*.jsonl) are scanned for
// leaked emails / tokens / local paths just like every other shipped text file.
// Omitting it would let a real secret pasted into a ledger ship while the scan
// stays silently green.
const SCANNED_EXT = /\.(md|mdc|json|jsonl|js|txt|yml|yaml)$/;

function isScannable(file) {
  try {
    return statSync(file).isFile() && (SCANNED_EXT.test(file) || path.basename(file) === ".clinerules");
  } catch {
    return false;
  }
}

function scanDirectory(root, label) {
  const files = walk(root).filter(isScannable);
  const errors = files.flatMap((file) => scanFile(file, root));
  return { label, root, count: files.length, errors };
}

// ---------------------------------------------------------------------------
// Extra (side-effecting) scan surfaces. These run by default to harden release
// safety, but are skipped with --no-extras / when a target --workspace is given,
// so the core read-only scan still works in a strict sandbox.
// ---------------------------------------------------------------------------
function scanAdaptersInstallOutput() {
  // Actually run `adapters install` into a throwaway dir and scan what src/adapters.js
  // would write into a user's external repo.
  let tmp;
  try {
    tmp = mkdtempSync(path.join(tmpdir(), "aicos-privacy-adapters-"));
  } catch (error) {
    return { label: "adapters-install output", root: "(skipped)", count: 0, errors: [], skipped: `cannot create temp dir (${error.code || error.message}); pass --no-extras in a read-only sandbox` };
  }
  try {
    // --tool all so every adapter entrypoint's rendered content is scanned (the
    // default --tool auto would detect no tool in this empty temp dir and write
    // nothing, leaving this privacy surface empty).
    execFileSync(process.execPath, [path.join(repoRoot, "bin", "ai-collab.js"), "adapters", "install", "--target", tmp, "--force", "--tool", "all"], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "pipe"]
    });
    const result = scanDirectory(tmp, "adapters-install output");
    return result;
  } catch (error) {
    return { label: "adapters-install output", root: tmp, count: 0, errors: [`adapters install failed: ${error.message}`] };
  } finally {
    if (tmp) {
      try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }
}

function scanPackFileList() {
  // npm pack --dry-run --json lists exactly what would ship. Make sure no private
  // file (e.g. .env, a backup, a private config) sneaks into the tarball. The
  // forbidden-file rules live in scripts/lib/forbidden-in-pack.js so this scanner
  // and scripts/pack-check.js enforce one shared list (no drift).
  try {
    const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const [pack] = JSON.parse(output);
    const files = (pack.files ?? []).map((file) => file.path);
    // Also block any user-configured private dirs (from manifest/local denylist
    // paths) from the tarball, without naming them in the shared shipped module.
    const errors = findForbiddenPackFiles(files, configuredPrivateDirs).map(
      ({ label, file }) => `npm pack would ship ${label}: ${file}`
    );
    return { label: "npm pack file list", root: "(npm pack --dry-run)", count: files.length, errors };
  } catch (error) {
    return { label: "npm pack file list", root: "(npm pack --dry-run)", count: 0, errors: [], skipped: `npm pack unavailable (${error.code || "error"}); set npm_config_cache to a writable dir or pass --no-extras` };
  }
}

const args = parseArgs(process.argv.slice(2));

// --strict means "do not skip any scan surface". --no-extras explicitly skips the
// side-effecting surfaces (adapters-install output + npm pack file list). Asking
// for both at once is self-contradictory, so reject it instead of silently letting
// strict pass while real scan surfaces were dropped. (Previously --strict --no-extras
// exited 0 because the skipped extras were never recorded in `skipped`.)
if (args.strict && args.noExtras) {
  console.error(
    "Privacy scan (strict): --strict and --no-extras are contradictory. " +
      "--strict requires every scan surface to run, but --no-extras skips the " +
      "side-effecting surfaces (adapters-install output + npm pack file list). " +
      "Run strict in a writable environment without --no-extras, or drop --strict."
  );
  process.exit(1);
}

const targetWorkspace = args.workspace ? path.resolve(args.workspace) : repoRoot;
const scanningRepo = !args.workspace;

const surfaces = [];
// Source tree + generated .aict are both under repoRoot, so the single walk of
// repoRoot covers "source tree (src/ + scripts/)" and "generated .aict". When a
// --workspace is given we scan exactly that tree.
surfaces.push(scanDirectory(targetWorkspace, scanningRepo ? "source tree + committed .aict" : "workspace"));

// Side-effecting surfaces only when scanning the repo and not asked to skip them.
const runExtras = scanningRepo && !args.noExtras;
if (runExtras) {
  surfaces.push(scanAdaptersInstallOutput());
  surfaces.push(scanPackFileList());
}

const allErrors = surfaces.flatMap((surface) => surface.errors);
const skipped = surfaces.filter((surface) => surface.skipped);

if (allErrors.length > 0) {
  console.error(`Privacy scan failed:\n${allErrors.map((error) => `- ${error}`).join("\n")}`);
  if (skipped.length > 0) {
    console.error(`\nSkipped surfaces:\n${skipped.map((s) => `- ${s.label}: ${s.skipped}`).join("\n")}`);
  }
  process.exit(1);
}

if (args.strict && skipped.length > 0) {
  console.error(`Privacy scan (strict): required surfaces were skipped:\n${skipped.map((s) => `- ${s.label}: ${s.skipped}`).join("\n")}`);
  process.exit(1);
}

const summary = surfaces
  .map((surface) => `  - ${surface.label}: ${surface.skipped ? `skipped (${surface.skipped})` : `${surface.count} entr${surface.count === 1 ? "y" : "ies"} clean`}`)
  .join("\n");

console.log(`Privacy scan passed.
Root: ${targetWorkspace}
Surfaces:
${summary}
`);
