export type Mode = "advisory" | "required";
export type CommentMode = "always" | "failures-only" | "never";

export type RevertProofStatus =
  | "revert-safe"
  | "revert-risky"
  | "not-revert-safe"
  | "not-applicable";

export type RiskLevel = "none" | "low" | "medium" | "high";
export type FindingSeverity = "info" | "warning" | "error";

export interface ChecksConfig {
  forward: string[];
  revert: string[];
}

export interface RevertProofConfig {
  mode: Mode;
  checks: ChecksConfig;
  riskPaths: Record<string, string[]>;
  requireRollbackNotesFor: string[];
  rollbackNotePatterns: string[];
  ignorePaths: string[];
  commentMode: CommentMode;
  commandTimeoutMs: number;
  maxLogBytes: number;
}

export interface CheckCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface Finding {
  code: string;
  severity: FindingSeverity;
  message: string;
  paths?: string[];
  details?: string;
}

export interface RiskCategoryResult {
  category: string;
  patterns: string[];
  paths: string[];
}

export interface GitSimulationResult {
  base: string;
  head: string;
  mergeSucceeded: boolean;
  mergeOutput: string;
  syntheticMergeSha?: string;
  forwardChecks: CheckCommandResult[];
  revertSucceeded: boolean;
  revertOutput: string;
  revertChecks: CheckCommandResult[];
  dirtyPathsAfterRevert: string[];
  tempDir: string;
}

export interface RevertProofReport {
  status: RevertProofStatus;
  riskLevel: RiskLevel;
  mode: Mode;
  commentMode: CommentMode;
  base: string;
  head: string;
  forwardChecksPassed: boolean;
  revertSucceeded: boolean;
  revertChecksPassed: boolean;
  revertConflicted: boolean;
  changedPaths: string[];
  ignoredPaths: string[];
  riskCategories: RiskCategoryResult[];
  findings: Finding[];
  commandResults: {
    forward: CheckCommandResult[];
    revert: CheckCommandResult[];
  };
  generatedAt: string;
}

export interface CheckOptions {
  repoDir: string;
  base: string;
  head: string;
  config: RevertProofConfig;
}
