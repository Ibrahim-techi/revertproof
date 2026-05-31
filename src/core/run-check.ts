import type { CheckOptions, GitSimulationResult, RevertProofReport } from "./types";
import { runGitSimulation } from "./git-simulator";
import { filterIgnoredPaths, listChangedPaths } from "../git/diff";
import { resolveRepoRoot } from "../git/merge";
import { classifyRiskPaths } from "../risk/classify-paths";
import { buildReport } from "./status";

export interface RunCheckOptions extends CheckOptions {
  prText?: string;
}

export async function runRevertProofCheck(
  options: RunCheckOptions
): Promise<RevertProofReport> {
  const repoRoot = await resolveRepoRoot(options.repoDir);
  const allChangedPaths = await listChangedPaths(repoRoot, options.base, options.head);
  const { included: changedPaths, ignored: ignoredPaths } = filterIgnoredPaths(
    allChangedPaths,
    options.config.ignorePaths
  );
  const riskCategories = classifyRiskPaths(changedPaths, options.config);
  const simulation =
    changedPaths.length === 0
      ? buildSkippedSimulation(options.base, options.head)
      : await runGitSimulation({ ...options, repoDir: repoRoot });

  return buildReport({
    base: options.base,
    head: options.head,
    changedPaths,
    ignoredPaths,
    riskCategories,
    simulation,
    config: options.config,
    ...(options.prText === undefined ? {} : { prText: options.prText })
  });
}

function buildSkippedSimulation(base: string, head: string): GitSimulationResult {
  return {
    base,
    head,
    mergeSucceeded: true,
    mergeOutput: "",
    forwardChecks: [],
    revertSucceeded: true,
    revertOutput: "",
    revertChecks: [],
    dirtyPathsAfterRevert: [],
    tempDir: ""
  };
}
