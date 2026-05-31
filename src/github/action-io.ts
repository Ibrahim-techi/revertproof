import { appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export function getInput(name: string): string {
  return (process.env[`INPUT_${name.replaceAll(" ", "_").toUpperCase()}`] ?? "").trim();
}

export async function setOutput(name: string, value: string): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    process.stdout.write(`${name}=${value}\n`);
    return;
  }

  const delimiter = `revertproof_${randomUUID()}`;
  await appendFile(outputPath, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, "utf8");
}

export function warning(message: string): void {
  process.stderr.write(`::warning::${escapeCommand(message)}\n`);
}

export function setFailed(message: string): void {
  process.exitCode = 1;
  process.stderr.write(`::error::${escapeCommand(message)}\n`);
}

function escapeCommand(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}
