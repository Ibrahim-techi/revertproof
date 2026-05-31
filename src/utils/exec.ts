import { spawn } from "node:child_process";
import type { CheckCommandResult } from "../core/types";

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ExecOptions {
  cwd: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  shell?: boolean;
}

export async function execFileSafe(
  command: string,
  args: string[],
  options: ExecOptions
): Promise<ExecResult> {
  return runProcess(command, args, { ...options, shell: false });
}

export async function execShellCommand(
  command: string,
  options: ExecOptions
): Promise<CheckCommandResult> {
  const result = await runProcess(command, [], { ...options, shell: true });

  return {
    command,
    ...result
  };
}

function runProcess(
  command: string,
  args: string[],
  options: ExecOptions
): Promise<ExecResult> {
  const started = Date.now();
  const maxOutputBytes = options.maxOutputBytes ?? 32_000;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      shell: options.shell ?? false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, options.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = appendLimited(stdout, chunk.toString("utf8"), maxOutputBytes);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendLimited(stderr, chunk.toString("utf8"), maxOutputBytes);
    });

    child.on("error", (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve({
        exitCode: 1,
        stdout,
        stderr: appendLimited(stderr, error.message, maxOutputBytes),
        durationMs: Date.now() - started
      });
    });

    child.on("close", (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      resolve({
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout,
        stderr: timedOut
          ? appendLimited(stderr, `\nCommand timed out after ${options.timeoutMs}ms.`, maxOutputBytes)
          : stderr,
        durationMs: Date.now() - started
      });
    });
  });
}

function appendLimited(current: string, next: string, maxBytes: number): string {
  const combined = current + next;
  if (Buffer.byteLength(combined, "utf8") <= maxBytes) {
    return combined;
  }

  return combined.slice(Math.max(0, combined.length - maxBytes));
}
