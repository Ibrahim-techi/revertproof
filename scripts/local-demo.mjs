#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(projectRoot, "dist", "cli.js");
const demoRoot = mkdtempSync(join(tmpdir(), "revertproof-local-demo-"));

if (!existsSync(cliPath)) {
  run("npm", ["run", "build"], projectRoot);
}

const safeRepo = createRepo("safe-pr");
writeFeatureChange(safeRepo, "app.txt", "base\n", "feature\n");
writeFileSync(
  join(safeRepo, ".revertproof.yml"),
  `checks:
  forward:
    - node -e "const fs=require('fs');process.exit(fs.readFileSync('app.txt','utf8').includes('feature')?0:1)"
  revert:
    - node -e "const fs=require('fs');process.exit(fs.readFileSync('app.txt','utf8').includes('base')?0:1)"
`,
  "utf8"
);

const unsafeRepo = createRepo("unsafe-pr");
writeFeatureChange(unsafeRepo, "state.txt", "old\n", "new\n");
writeFileSync(
  join(unsafeRepo, ".revertproof.yml"),
  `checks:
  forward: []
  revert:
    - node -e "process.exit(1)"
`,
  "utf8"
);

const safe = runRevertProof(safeRepo, false);
const unsafe = runRevertProof(unsafeRepo, true);

process.stdout.write(`RevertProof local demo

Demo workspace:
${demoRoot}

1. Safe PR simulation
   Repo: ${safeRepo}
   Status: ${safe.report.status}
   Exit code: ${safe.exitCode}
   Report: ${join(safeRepo, "revertproof-output", "revertproof-report.md")}

2. Unsafe PR simulation
   Repo: ${unsafeRepo}
   Status: ${unsafe.report.status}
   Exit code: ${unsafe.exitCode}
   Report: ${join(unsafeRepo, "revertproof-output", "revertproof-report.md")}

Meaning:
- revert-safe means the PR merged, checks passed, the synthetic revert worked, and revert checks passed.
- not-revert-safe means RevertProof found a rollback problem before the PR reaches production.
`);

function createRepo(name) {
  const repo = join(demoRoot, name);
  mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.name", "RevertProof Demo"]);
  git(repo, ["config", "user.email", "demo@example.invalid"]);
  return repo;
}

function writeFeatureChange(repo, fileName, baseContent, featureContent) {
  writeFileSync(join(repo, fileName), baseContent, "utf8");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "base"]);
  git(repo, ["checkout", "-b", "feature"]);
  writeFileSync(join(repo, fileName), featureContent, "utf8");
  git(repo, ["commit", "-am", "feature"]);
}

function runRevertProof(repo, required) {
  const args = [
    cliPath,
    "check",
    "--repo",
    repo,
    "--base",
    "main",
    "--head",
    "feature",
    "--config",
    ".revertproof.yml",
    "--output-dir",
    join(repo, "revertproof-output")
  ];

  if (required) {
    args.push("--mode", "required");
  }

  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true
  });
  const reportPath = join(repo, "revertproof-output", "revertproof-report.json");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));

  return {
    exitCode: result.status ?? 1,
    report
  };
}

function git(cwd, args) {
  run("git", ["-C", cwd, ...args], cwd);
}

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: "ignore",
    windowsHide: true
  });
}
