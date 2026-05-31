import type { RevertProofReport } from "./types";

export function shouldFail(report: RevertProofReport): boolean {
  if (report.mode !== "required") {
    return false;
  }

  return report.status === "not-revert-safe";
}

export function shouldComment(report: RevertProofReport): boolean {
  if (report.commentMode === "never") {
    return false;
  }

  if (report.commentMode === "always") {
    return true;
  }

  return report.status !== "revert-safe" && report.status !== "not-applicable";
}
