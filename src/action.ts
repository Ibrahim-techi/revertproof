import { loadConfig } from "./config/load-config";
import { shouldComment, shouldFail } from "./core/exit-policy";
import { runRevertProofCheck } from "./core/run-check";
import type { CommentMode, Mode } from "./core/types";
import { getInput, setFailed, setOutput, warning } from "./github/action-io";
import { getPullRequestContext } from "./github/context";
import { upsertPullRequestComment } from "./github/comments";
import { renderMarkdownReport } from "./report/markdown";
import { writeReports } from "./report/json";

async function main(): Promise<void> {
  const pullRequest = getPullRequestContext();
  const mode = parseMode(getInput("mode") || undefined);
  const commentMode = parseCommentMode(getInput("comment-mode") || undefined);
  const config = await loadConfig({
    configPath: getInput("config") || ".revertproof.yml",
    ...(mode === undefined ? {} : { modeOverride: mode }),
    ...(commentMode === undefined ? {} : { commentModeOverride: commentMode })
  });

  const base = getInput("base-ref") || pullRequest?.baseRef;
  const head = getInput("head-ref") || pullRequest?.headRef;

  if (!base || !head) {
    throw new Error("RevertProof requires base/head refs or a pull_request event.");
  }

  const report = await runRevertProofCheck({
    repoDir: process.cwd(),
    base,
    head,
    config,
    ...(pullRequest?.prText === undefined ? {} : { prText: pullRequest.prText })
  });

  const written = await writeReports(report, "revertproof-output");
  await setOutput("status", report.status);
  await setOutput("risk_level", report.riskLevel);
  await setOutput("report_json_path", written.jsonPath);
  await setOutput("report_markdown_path", written.markdownPath);
  await setOutput("revert_conflicted", String(report.revertConflicted));
  await setOutput("forward_checks_passed", String(report.forwardChecksPassed));
  await setOutput("revert_checks_passed", String(report.revertChecksPassed));

  await maybeComment(report, pullRequest);

  if (shouldFail(report)) {
    setFailed(`RevertProof status is ${report.status}.`);
  }
}

async function maybeComment(
  report: Awaited<ReturnType<typeof runRevertProofCheck>>,
  pullRequest: ReturnType<typeof getPullRequestContext>
): Promise<void> {
  if (!pullRequest || !shouldComment(report)) {
    return;
  }

  const token = getInput("github-token") || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    warning("Skipping PR comment because no github-token was provided.");
    return;
  }

  try {
    await upsertPullRequestComment({
      token,
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      pullNumber: pullRequest.pullNumber,
      body: renderMarkdownReport(report)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warning(`Failed to write PR comment: ${message}`);
  }
}

function parseMode(value: string | undefined): Mode | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "advisory" || value === "required") {
    return value;
  }
  throw new Error(`Invalid mode '${value}'. Expected advisory or required.`);
}

function parseCommentMode(value: string | undefined): CommentMode | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "always" || value === "failures-only" || value === "never") {
    return value;
  }
  throw new Error(`Invalid comment-mode '${value}'. Expected always, failures-only, or never.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  setFailed(message);
});
