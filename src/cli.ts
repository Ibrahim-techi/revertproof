#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { Command } from "commander";
import { loadConfig } from "./config/load-config";
import { runRevertProofCheck } from "./core/run-check";
import { shouldFail } from "./core/exit-policy";
import { resolveRepoRoot } from "./git/merge";
import type { CommentMode, Mode, RevertProofReport } from "./core/types";
import { renderMarkdownReport } from "./report/markdown";
import { writeReports } from "./report/json";

const program = new Command();

program
  .name("revertproof")
  .description("Prove whether a pull request can be safely reverted before it is merged.")
  .version("0.1.1");

program
  .command("check")
  .description("Run RevertProof against two refs.")
  .option("--base <ref>", "Base ref or SHA.", "origin/main")
  .option("--head <ref>", "Head ref or SHA.", "HEAD")
  .option("--repo <path>", "Repository path.", process.cwd())
  .option("--config <path>", "Config file path.", ".revertproof.yml")
  .option("--mode <mode>", "advisory or required.")
  .option("--comment-mode <mode>", "always, failures-only, or never.")
  .option("--pr-text <path>", "Optional file containing pull request title/body text.")
  .option("--output-dir <path>", "Directory for JSON and Markdown reports.", "revertproof-output")
  .action(async (options) => {
    const mode = parseMode(options.mode);
    const commentMode = parseCommentMode(options.commentMode);
    const repoDir = await resolveRepoRoot(resolve(String(options.repo)));
    const configPath = resolveConfigPath(repoDir, String(options.config));
    const config = await loadConfig({
      configPath,
      ...(mode === undefined ? {} : { modeOverride: mode }),
      ...(commentMode === undefined ? {} : { commentModeOverride: commentMode })
    });
    const prText =
      options.prText === undefined ? undefined : await readFile(String(options.prText), "utf8");

    const report = await runRevertProofCheck({
      repoDir,
      base: String(options.base),
      head: String(options.head),
      config,
      ...(prText === undefined ? {} : { prText })
    });

    const written = await writeReports(report, resolve(String(options.outputDir)));
    process.stdout.write(renderMarkdownReport(report));
    process.stdout.write(`\nJSON report: ${written.jsonPath}\n`);
    process.stdout.write(`Markdown report: ${written.markdownPath}\n`);

    if (shouldFail(report)) {
      process.exitCode = 1;
    }
  });

program
  .command("validate-config")
  .description("Validate a RevertProof config file.")
  .option("--config <path>", "Config file path.", ".revertproof.yml")
  .action(async (options) => {
    await loadConfig({ configPath: String(options.config) });
    process.stdout.write("RevertProof config is valid.\n");
  });

program
  .command("explain")
  .description("Render a Markdown explanation from a JSON report.")
  .argument("<report>", "Path to revertproof-report.json.")
  .action(async (reportPath) => {
    const raw = await readFile(String(reportPath), "utf8");
    const report = JSON.parse(raw) as RevertProofReport;
    process.stdout.write(renderMarkdownReport(report));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
});

function parseMode(value: unknown): Mode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "advisory" || value === "required") {
    return value;
  }
  throw new Error(`Invalid mode '${String(value)}'. Expected advisory or required.`);
}

function parseCommentMode(value: unknown): CommentMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "always" || value === "failures-only" || value === "never") {
    return value;
  }
  throw new Error(
    `Invalid comment mode '${String(value)}'. Expected always, failures-only, or never.`
  );
}

function resolveConfigPath(repoDir: string, configPath: string): string {
  return isAbsolute(configPath) ? configPath : resolve(repoDir, configPath);
}
