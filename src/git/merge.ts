import { git, gitOutput } from "./git";

export async function resolveRepoRoot(cwd: string): Promise<string> {
  return gitOutput(cwd, ["rev-parse", "--show-toplevel"]);
}

export async function cloneRepo(source: string, target: string): Promise<void> {
  await git(source, ["clone", "--no-hardlinks", source, target]);
}

export async function prepareIdentity(cwd: string): Promise<void> {
  await git(cwd, ["config", "user.name", "RevertProof"]);
  await git(cwd, ["config", "user.email", "revertproof@example.invalid"]);
}

export async function checkoutDetached(cwd: string, ref: string): Promise<void> {
  await git(cwd, ["checkout", "--detach", ref]);
}

export async function mergeHead(
  cwd: string,
  head: string
): Promise<{ succeeded: boolean; output: string; mergeSha?: string }> {
  const result = await git(cwd, ["merge", "--no-ff", "--no-edit", head], {
    allowFailure: true
  });

  const output = `${result.stdout}${result.stderr}`;
  if (result.exitCode !== 0) {
    await git(cwd, ["merge", "--abort"], { allowFailure: true });
    return {
      succeeded: false,
      output
    };
  }

  return {
    succeeded: true,
    output,
    mergeSha: await gitOutput(cwd, ["rev-parse", "HEAD"])
  };
}

export async function revertMerge(
  cwd: string,
  mergeSha: string
): Promise<{ succeeded: boolean; output: string }> {
  const result = await git(cwd, ["revert", "-m", "1", "--no-edit", mergeSha], {
    allowFailure: true
  });

  return {
    succeeded: result.exitCode === 0,
    output: `${result.stdout}${result.stderr}`
  };
}
