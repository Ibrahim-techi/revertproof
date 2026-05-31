import type {
  CheckCommandResult,
  Finding,
  GitSimulationResult,
  RevertProofConfig,
  RevertProofReport,
  RiskCategoryResult,
  RiskLevel,
  RevertProofStatus
} from "./types";
import { hasRollbackNote } from "../risk/rollback-notes";

export interface BuildReportOptions {
  base: string;
  head: string;
  changedPaths: string[];
  ignoredPaths: string[];
  riskCategories: RiskCategoryResult[];
  simulation: GitSimulationResult;
  config: RevertProofConfig;
  prText?: string;
}

export function buildReport(options: BuildReportOptions): RevertProofReport {
  const findings: Finding[] = [];
  const forwardChecksPassed = allPassed(options.simulation.forwardChecks);
  const revertChecksPassed = allPassed(options.simulation.revertChecks);
  const revertConflicted =
    !options.simulation.revertSucceeded &&
    /conflict|CONFLICT|could not apply|would be overwritten/i.test(options.simulation.revertOutput);

  if (!options.simulation.mergeSucceeded) {
    findings.push({
      code: "merge_failed",
      severity: "error",
      message: "The pull request could not be merged into the base ref in the simulation.",
      details: options.simulation.mergeOutput
    });
  }

  if (!forwardChecksPassed) {
    findings.push({
      code: "forward_checks_failed",
      severity: "error",
      message: "One or more forward validation commands failed after the synthetic merge."
    });
  }

  if (options.simulation.mergeSucceeded && !options.simulation.revertSucceeded) {
    findings.push({
      code: "revert_failed",
      severity: "error",
      message: "The synthetic rollback failed.",
      details: options.simulation.revertOutput
    });
  }

  if (options.simulation.revertSucceeded && !revertChecksPassed) {
    findings.push({
      code: "revert_checks_failed",
      severity: "error",
      message: "One or more validation commands failed after the synthetic rollback."
    });
  }

  if (options.simulation.dirtyPathsAfterRevert.length > 0) {
    findings.push({
      code: "dirty_after_revert",
      severity: "error",
      message: "The worktree changed after the synthetic rollback.",
      paths: options.simulation.dirtyPathsAfterRevert
    });
  }

  for (const category of options.riskCategories) {
    findings.push({
      code: `risk_path_${category.category}`,
      severity: "warning",
      message: `Changed paths match the '${category.category}' risk-sensitive category.`,
      paths: category.paths
    });
  }

  const prText = options.prText ?? "";
  for (const requiredCategory of options.config.requireRollbackNotesFor) {
    const category = options.riskCategories.find((item) => item.category === requiredCategory);
    if (category && !hasRollbackNote(prText, options.config.rollbackNotePatterns)) {
      findings.push({
        code: `missing_rollback_note_${requiredCategory}`,
        severity: "warning",
        message: `Changes in '${requiredCategory}' require rollback notes, but no rollback note was found.`,
        paths: category.paths
      });
    }
  }

  const status = computeStatus({
    changedPaths: options.changedPaths,
    mergeSucceeded: options.simulation.mergeSucceeded,
    forwardChecksPassed,
    revertSucceeded: options.simulation.revertSucceeded,
    revertChecksPassed,
    dirtyAfterRevert: options.simulation.dirtyPathsAfterRevert.length > 0,
    findings
  });

  return {
    status,
    riskLevel: computeRiskLevel(findings),
    mode: options.config.mode,
    commentMode: options.config.commentMode,
    base: options.base,
    head: options.head,
    forwardChecksPassed,
    revertSucceeded: options.simulation.revertSucceeded,
    revertChecksPassed,
    revertConflicted,
    changedPaths: options.changedPaths,
    ignoredPaths: options.ignoredPaths,
    riskCategories: options.riskCategories,
    findings,
    commandResults: {
      forward: options.simulation.forwardChecks,
      revert: options.simulation.revertChecks
    },
    generatedAt: new Date().toISOString()
  };
}

function allPassed(results: CheckCommandResult[]): boolean {
  return results.every((result) => result.exitCode === 0);
}

function computeStatus(input: {
  changedPaths: string[];
  mergeSucceeded: boolean;
  forwardChecksPassed: boolean;
  revertSucceeded: boolean;
  revertChecksPassed: boolean;
  dirtyAfterRevert: boolean;
  findings: Finding[];
}): RevertProofStatus {
  if (input.changedPaths.length === 0) {
    return "not-applicable";
  }

  if (
    !input.mergeSucceeded ||
    !input.forwardChecksPassed ||
    !input.revertSucceeded ||
    !input.revertChecksPassed ||
    input.dirtyAfterRevert
  ) {
    return "not-revert-safe";
  }

  if (input.findings.some((finding) => finding.severity === "warning")) {
    return "revert-risky";
  }

  return "revert-safe";
}

function computeRiskLevel(findings: Finding[]): RiskLevel {
  if (findings.some((finding) => finding.severity === "error")) {
    return "high";
  }

  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  if (warnings >= 2) {
    return "medium";
  }
  if (warnings === 1) {
    return "low";
  }

  return "none";
}
