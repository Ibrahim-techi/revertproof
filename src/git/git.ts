import { execFileSafe } from "../utils/exec";

export interface GitResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function git(
  cwd: string,
  args: string[],
  options: { allowFailure?: boolean } = {}
): Promise<GitResult> {
  const result = await execFileSafe("git", args, {
    cwd,
    timeoutMs: 120_000,
    maxOutputBytes: 64_000
  });

  if (result.exitCode !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }

  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

export async function gitOutput(cwd: string, args: string[]): Promise<string> {
  const result = await git(cwd, args);
  return result.stdout.trim();
}
