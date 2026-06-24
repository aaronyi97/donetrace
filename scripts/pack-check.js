#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findForbiddenPackFiles } from "./lib/forbidden-in-pack.js";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

// Private dir names to also block from the tarball, sourced exactly like the
// privacy scanner: generic markers live in the shared forbidden-in-pack rules,
// while a maintainer's OWN private dir names come from the (shipped, generic)
// manifest denylist plus an optional gitignored local override — never baked
// into the shared shipped module. Keeps both gates aligned with no drift.
function readJsonIfPresent(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function resolveConfiguredPrivateDirs() {
  const manifest = readJsonIfPresent(path.join(repoRoot, "privacy-manifest.json"));
  const local = readJsonIfPresent(path.join(repoRoot, "privacy-scan.local.json"));
  const dirs = [
    ...(manifest?.scanDenylist?.paths ?? []),
    ...(local?.paths ?? [])
  ];
  return [...new Set(dirs.filter((entry) => typeof entry === "string" && entry.length > 0))];
}

const configuredPrivateDirs = resolveConfiguredPrivateDirs();

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--cache") {
      args.cache = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function fail(errors) {
  console.error(`Pack check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

// `npm pack` wants to write logs to npm's cache dir (~/.npm/_logs by default). In a
// strict read-only sandbox that is not writable and npm dies with a cryptic ENOENT
// mkdir on the log dir. Point npm at a writable cache: an explicit --cache, an
// existing npm_config_cache, or a fresh temp dir we create. If even the temp dir is
// unwritable, surface a clear hint instead of the raw EPERM.
function resolveCache(args) {
  if (args.cache) return { cache: path.resolve(args.cache), created: false };
  if (process.env.npm_config_cache) return { cache: process.env.npm_config_cache, created: false };
  try {
    return { cache: mkdtempSync(path.join(tmpdir(), "aicos-npm-cache-")), created: true };
  } catch (error) {
    return { cache: null, error };
  }
}

const args = parseArgs(process.argv.slice(2));
const { cache, error: cacheError } = resolveCache(args);

if (!cache) {
  fail([
    `cannot create a writable npm cache (${cacheError?.code || cacheError?.message}).`,
    `In a read-only sandbox, point npm at a writable dir and re-run:`,
    `  node scripts/pack-check.js --cache <writable-dir>`,
    `  (or: npm_config_cache=<writable-dir> node scripts/pack-check.js)`
  ]);
}

let output;
try {
  output = execFileSync("npm", ["pack", "--dry-run", "--json", "--cache", cache], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, npm_config_cache: cache }
  });
} catch (error) {
  fail([
    `npm pack --dry-run failed (${error.code || "error"}).`,
    `If this is an EPERM/ENOENT writing npm logs in a read-only sandbox, pass a writable cache:`,
    `  node scripts/pack-check.js --cache <writable-dir>`,
    error.stderr ? `npm said: ${String(error.stderr).trim().split("\n").slice(-3).join(" | ")}` : `(${error.message})`
  ]);
}

const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));
const errors = [];

for (const required of [
  "README.md",
  "START_HERE.md",
  "PRODUCT_CONTRACT.md",
  "CHANGELOG.md",
  "RELEASE_CHECKLIST.md",
  "privacy-manifest.json",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "bin/ai-collab.js",
  "src/cli.js",
  "scripts/validate-contract.js",
  "docs/WHY_THIS_EXISTS.md",
  "docs/PUBLIC_MAPPING.md",
  "docs/open-system/00-start-here.md",
  ".aict/START_HERE.md",
  ".aict/adapters/SHARED_CORE_CONTRACT.md",
  ".aict/examples/ai-coding-long-task/CASE.md",
  ".aict/mechanisms/dual-guard/README.md",
  ".aict/roles/README.md",
  ".aict/modes/README.md",
  ".aict/cookbook/README.md",
  ".aict/state/CURRENT_STATE.md",
  ".aict/state/tasks.jsonl",
  ".aict/state/evidence.jsonl",
  ".aict/state/runs.jsonl",
  ".aict/state/receipts.jsonl",
  ".aict/state/learning-ledger.jsonl",
  ".aict/privacy/PRIVACY.md"
]) {
  if (!files.has(required)) errors.push(`package missing ${required}`);
}

// Defense in depth: the privacy scanner also checks the pack file list, but keep a
// hard block here so a private file can never ship even if the scanner is skipped.
// The forbidden-file rules (including .git/ and node_modules/) live in the shared
// scripts/lib/forbidden-in-pack.js so this gate and the privacy scanner never drift.
for (const { label, file } of findForbiddenPackFiles([...files], configuredPrivateDirs)) {
  errors.push(`package would ship ${label}: ${file}`);
}

if (pack.size <= 0 || pack.unpackedSize <= 0) {
  errors.push("package size metadata is empty");
}

if (errors.length > 0) {
  fail(errors);
}

console.log(`Pack check passed.
Files packed: ${pack.entryCount}
Package: ${pack.filename}
Cache: ${cache}
`);
