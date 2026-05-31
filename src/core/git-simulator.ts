import { join } from "node:path";
import type { CheckCommandResult, GitSimulationResult, RevertProofConfig } from "./types";
import { createTempWorkspace, removeTempWorkspace } from "../git/worktree";
import {
  checkoutDetached,
  cloneRepo,
  mergeHead,
  prepareIdentity,
  resolveRepoRoot,
  revertMerge
} from "../git/merge";
import { gitOutput } from "../git/git";
import { listDirtyPaths } from "../git/revert";
import { execShellCommand } from "../utils/exec";

export interface RunGitSimulationOptions {
  repoDir: string;
  base: string;
  head: string;
  config: RevertProofConfig;
  keepTemp?: boolean;
}

export async function runGitSimulation(
  options: RunGitSimulationOptions
): Promise<GitSimulationResult> {
  const repoRoot = await resolveRepoRoot(options.repoDir);
  const baseSha = await gitOutput(repoRoot, ["rev-parse", options.base]);
  const headSha = await gitOutput(repoRoot, ["rev-parse", options.head]);
  const tempParent = await createTempWorkspace();
  const tempRepo = join(tempParent, "repo");

  try {
    await cloneRepo(repoRoot, tempRepo);
    await prepareIdentity(tempRepo);
    await checkoutDetached(tempRepo, baseSha);

    const merge = await mergeHead(tempRepo, headSha);
    if (!merge.succeeded || !merge.mergeSha) {
      return {
        base: options.base,
        head: options.head,
        mergeSucceeded: false,
        mergeOutput: merge.output,
        forwardChecks: [],
        revertSucceeded: false,
        revertOutput: "",
        revertChecks: [],
        dirtyPathsAfterRevert: [],
        tempDir: tempRepo
      };
    }

    const forwardChecks = await runChecks(tempRepo, options.config.checks.forward, options.config);
    const revert = await revertMerge(tempRepo, merge.mergeSha);
    const revertChecks = revert.succeeded
      ? await runChecks(tempRepo, options.config.checks.revert, options.config)
      : [];
    const dirtyPathsAfterRevert = revert.succeeded ? await listDirtyPaths(tempRepo) : [];

    return {
      base: options.base,
      head: options.head,
      mergeSucceeded: true,
      mergeOutput: merge.output,
      syntheticMergeSha: merge.mergeSha,
      forwardChecks,
      revertSucceeded: revert.succeeded,
      revertOutput: revert.output,
      revertChecks,
      dirtyPathsAfterRevert,
      tempDir: tempRepo
    };
  } finally {
    if (!options.keepTemp) {
      await removeTempWorkspace(tempParent);
    }
  }
}

async function runChecks(
  cwd: string,
  commands: string[],
  config: RevertProofConfig
): Promise<CheckCommandResult[]> {
  const results: CheckCommandResult[] = [];

  for (const command of commands) {
    results.push(
      await execShellCommand(command, {
        cwd,
        timeoutMs: config.commandTimeoutMs,
        maxOutputBytes: config.maxLogBytes
      })
    );
  }

  return results;
}
