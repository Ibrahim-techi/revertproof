import type { CheckCommandResult, RevertProofReport } from "../core/types";

export function renderMarkdownReport(report: RevertProofReport): string {
  const lines: string[] = [];

  lines.push("## Rollback Readiness Report");
  lines.push("");
  lines.push(`Decision: **${formatStatus(report.status)}**`);
  lines.push(`Risk level: **${formatRiskLevel(report.riskLevel)}**`);
  lines.push("");
  lines.push("| Verification | Result |");
  lines.push("| --- | --- |");
  lines.push(`| Forward validation | ${formatPassFail(report.forwardChecksPassed)} |`);
  lines.push(`| Synthetic rollback | ${formatPassFail(report.revertSucceeded)} |`);
  lines.push(`| Post-rollback validation | ${formatPassFail(report.revertChecksPassed)} |`);
  lines.push("");

  if (report.findings.length === 0) {
    lines.push("No rollback blockers or configured risk warnings were found.");
  } else {
    lines.push("### Findings");
    lines.push("");
    for (const finding of report.findings) {
      lines.push(
        `- **${formatSeverity(finding.severity)}: ${formatFindingCode(finding.code)}** - ${finding.message}`
      );
      if (finding.paths && finding.paths.length > 0) {
        lines.push(`  Paths: ${finding.paths.map((path) => `\`${path}\``).join(", ")}`);
      }
    }
  }

  if (report.riskCategories.length > 0) {
    lines.push("");
    lines.push("### Risk-Sensitive Paths");
    lines.push("");
    for (const category of report.riskCategories) {
      lines.push(
        `- **${formatCategory(category.category)}**: ${category.paths
          .map((path) => `\`${path}\``)
          .join(", ")}`
      );
    }
  }

  lines.push("");
  lines.push("### Reviewed Paths");
  lines.push("");
  if (report.changedPaths.length === 0) {
    lines.push("No non-ignored changed paths.");
  } else {
    for (const path of report.changedPaths) {
      lines.push(`- \`${path}\``);
    }
  }

  if (report.ignoredPaths.length > 0) {
    lines.push("");
    lines.push("Ignored by configuration:");
    for (const path of report.ignoredPaths) {
      lines.push(`- \`${path}\``);
    }
  }

  appendCommandSection(lines, "Forward Validation Commands", report.commandResults.forward);
  appendCommandSection(lines, "Post-Rollback Validation Commands", report.commandResults.revert);

  lines.push("");
  lines.push("<sub>Prepared by RevertProof.</sub>");
  return `${lines.join("\n")}\n`;
}

function formatStatus(status: string): string {
  switch (status) {
    case "revert-safe":
      return "Revert safe";
    case "revert-risky":
      return "Revert risky";
    case "not-revert-safe":
      return "Not revert safe";
    case "not-applicable":
      return "Not applicable";
    default:
      return status;
  }
}

function formatRiskLevel(riskLevel: string): string {
  switch (riskLevel) {
    case "none":
      return "None";
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    default:
      return riskLevel;
  }
}

function formatPassFail(passed: boolean): string {
  return passed ? "passed" : "failed";
}

function formatSeverity(severity: string): string {
  switch (severity) {
    case "error":
      return "Blocker";
    case "warning":
      return "Warning";
    case "info":
      return "Info";
    default:
      return severity;
  }
}

function formatFindingCode(code: string): string {
  if (code.startsWith("risk_path_")) {
    return `Risk-sensitive ${formatCategory(code.replace("risk_path_", ""))} change`;
  }

  if (code.startsWith("missing_rollback_note_")) {
    return `Missing ${formatCategory(code.replace("missing_rollback_note_", ""))} rollback note`;
  }

  switch (code) {
    case "merge_failed":
      return "Synthetic merge failed";
    case "forward_checks_failed":
      return "Forward validation failed";
    case "revert_failed":
      return "Synthetic rollback failed";
    case "revert_checks_failed":
      return "Post-rollback validation failed";
    case "dirty_after_revert":
      return "Worktree changed after rollback";
    default:
      return code
        .split("_")
        .filter(Boolean)
        .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
        .join(" ");
  }
}

function formatCategory(category: string): string {
  return category
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function appendCommandSection(
  lines: string[],
  title: string,
  results: CheckCommandResult[]
): void {
  if (results.length === 0) {
    return;
  }

  lines.push("");
  lines.push(`### ${title}`);
  lines.push("");
  lines.push("| Command | Exit | Duration |");
  lines.push("| --- | ---: | ---: |");

  for (const result of results) {
    lines.push(`| \`${escapePipes(result.command)}\` | ${result.exitCode} | ${result.durationMs}ms |`);
  }
}

function escapePipes(value: string): string {
  return value.replaceAll("|", "\\|");
}
