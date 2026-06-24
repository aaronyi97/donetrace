#!/usr/bin/env node
import { mkdtempSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorkspace } from "../src/workspace.js";
import { validateWorkspace } from "../src/validate.js";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--workspace") {
      args.workspace = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function fail(errors) {
  console.error(`Contract check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

function checkRoot(repoRoot) {
  const errors = [];
  for (const file of ["README.md", "PRODUCT_CONTRACT.md", "package.json", "privacy-manifest.json"]) {
    if (!existsSync(path.join(repoRoot, file))) errors.push(`missing root file ${file}`);
  }

  for (const file of [
    "00-start-here.md",
    "01-ai-collaboration-os.md",
    "02-six-layer-architecture.md",
    "03-role-system.md",
    "04-core-mechanisms.md",
    "05-failure-patterns.md",
    "06-how-to-adapt-to-your-workflow.md"
  ]) {
    if (!existsSync(path.join(repoRoot, "docs", "open-system", file))) {
      errors.push(`missing open-system doc ${file}`);
    }
  }
  if (!existsSync(path.join(repoRoot, "docs", "PUBLIC_MAPPING.md"))) {
    errors.push("missing docs/PUBLIC_MAPPING.md");
  }
  if (!existsSync(path.join(repoRoot, "docs", "WHY_THIS_EXISTS.md"))) {
    errors.push("missing docs/WHY_THIS_EXISTS.md");
  }

  if (existsSync(path.join(repoRoot, "README.md"))) {
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    const firstScreen = readme.slice(0, 1800);
    if (!/open-source personal AI collaboration workspace/i.test(firstScreen)) {
      errors.push("README first screen must position the open-source personal AI collaboration workspace");
    }
    if (!/START_HERE\.md/.test(firstScreen)) {
      errors.push("README first screen must point to START_HERE.md");
    }
    if (/doctor|diagnos/i.test(firstScreen)) {
      errors.push("README first screen must not lead with diagnosis or doctor framing");
    }
  }

  if (existsSync(path.join(repoRoot, "START_HERE.md"))) {
    const startHere = readFileSync(path.join(repoRoot, "START_HERE.md"), "utf8");
    for (const phrase of ["10 minutes", "30 minutes", "60 minutes"]) {
      if (!new RegExp(phrase, "i").test(startHere)) {
        errors.push(`root START_HERE.md missing ${phrase}`);
      }
    }
  }

  return errors;
}

function listFiles(root, base = root, files = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) listFiles(fullPath, base, files);
    else if (entry.isFile()) files.push(path.relative(base, fullPath).split(path.sep).join("/"));
  }
  return files.sort();
}

function compareGeneratedWorkspace(generatedWorkspace, committedWorkspace) {
  const errors = [];
  if (!existsSync(committedWorkspace) || !statSync(committedWorkspace).isDirectory()) {
    return [`missing committed workspace ${committedWorkspace}`];
  }

  const generatedFiles = listFiles(generatedWorkspace);
  const committedFiles = listFiles(committedWorkspace);
  const generatedSet = new Set(generatedFiles);
  const committedSet = new Set(committedFiles);

  for (const file of generatedFiles) {
    if (!committedSet.has(file)) errors.push(`committed .aict missing generated file ${file}`);
  }
  for (const file of committedFiles) {
    if (!generatedSet.has(file)) errors.push(`committed .aict has non-generated file ${file}`);
  }
  for (const file of generatedFiles.filter((item) => committedSet.has(item))) {
    const generated = readFileSync(path.join(generatedWorkspace, file), "utf8");
    const committed = readFileSync(path.join(committedWorkspace, file), "utf8");
    if (generated !== committed) errors.push(`committed .aict differs from generator for ${file}`);
  }
  return errors;
}

// Generate a fresh workspace into a writable temp dir so we can diff it against
// the committed .aict. In a strict read-only sandbox the temp dir is not writable;
// rather than crash with a cryptic mkdtemp EPERM/ENOENT we fall back to validating
// the committed .aict in place (or an explicit --workspace) and tell the caller how
// to get the full generate-and-compare check back.
function makeGeneratedWorkspace() {
  try {
    return createWorkspace(mkdtempSync(path.join(tmpdir(), "aicos-contract-")), { force: true }).workspaceRoot;
  } catch (error) {
    if (["EPERM", "EACCES", "EROFS", "ENOENT"].includes(error.code)) {
      console.warn(
        `Contract check: cannot create a temp workspace (${error.message}).\n` +
        `Falling back to validating the committed .aict in place — the generate-and-compare check is skipped.\n` +
        `To run the full check in a read-only sandbox, generate a workspace in a writable dir first and pass it:\n` +
        `  node bin/ai-collab.js init --target <writable-dir> --force\n` +
        `  node scripts/validate-contract.js --workspace <writable-dir>/.aict`
      );
      return null;
    }
    throw error;
  }
}

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const args = parseArgs(process.argv.slice(2));
const generatedWorkspace = args.workspace ? null : makeGeneratedWorkspace();
const workspaces = args.workspace
  ? [path.resolve(args.workspace)]
  : [
      generatedWorkspace,
      path.join(repoRoot, ".aict")
    ].filter((workspace) => workspace && existsSync(workspace));

const rootErrors = checkRoot(repoRoot);
const workspaceResults = workspaces.map((workspace) => ({ workspace, result: validateWorkspace(workspace) }));
const errors = [
  ...rootErrors,
  ...(generatedWorkspace ? compareGeneratedWorkspace(generatedWorkspace, path.join(repoRoot, ".aict")) : []),
  ...workspaceResults.flatMap(({ workspace, result }) =>
    result.errors.map((error) => `${workspace}: ${error}`)
  )
];

if (errors.length > 0) {
  fail(errors);
}

console.log(`Contract check passed.
Workspaces: ${workspaces.join(", ")}
Checks: ${workspaceResults.reduce((total, item) => total + item.result.checks, 0) + 4}
`);
