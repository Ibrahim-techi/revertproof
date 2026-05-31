import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export async function createTempWorkspace(prefix = "revertproof-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeTempWorkspace(path: string): Promise<void> {
  await rm(path, {
    recursive: true,
    force: true,
    maxRetries: 3
  });
}
