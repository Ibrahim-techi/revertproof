#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const tsupCli = join(process.cwd(), "node_modules", "tsup", "dist", "cli-default.js");
const nccCli = join(process.cwd(), "node_modules", "@vercel", "ncc", "dist", "ncc", "cli.js");

rmSync("dist", { recursive: true, force: true });

run(process.execPath, [
  tsupCli,
  "src/cli.ts",
  "--format",
  "cjs",
  "--target",
  "node20",
  "--sourcemap",
  "--out-dir",
  "dist"
]);

run(process.execPath, [
  nccCli,
  "build",
  "src/action.ts",
  "--out",
  "dist/action-bundle",
  "--license",
  "action-licenses.txt"
]);

copyFileSync(join("dist", "action-bundle", "index.js"), join("dist", "action.js"));
copyFileSync(
  join("dist", "action-bundle", "action-licenses.txt"),
  join("dist", "action-licenses.txt")
);
rmSync(join("dist", "action-bundle"), { recursive: true, force: true });

function run(command, args) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    windowsHide: true
  });
}
