import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { ZodError } from "zod";
import { parseConfig } from "./schema";
import type { CommentMode, Mode, RevertProofConfig } from "../core/types";

export interface LoadConfigOptions {
  configPath?: string;
  modeOverride?: Mode;
  commentModeOverride?: CommentMode;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<RevertProofConfig> {
  const configPath = options.configPath ?? ".revertproof.yml";
  let raw: unknown = {};

  if (existsSync(configPath)) {
    const text = await readFile(configPath, "utf8");
    raw = parse(text) ?? {};
  }

  try {
    const config = parseConfig(raw);

    return {
      ...config,
      mode: options.modeOverride ?? config.mode,
      commentMode: options.commentModeOverride ?? config.commentMode
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
        .join("\n");
      throw new Error(`Invalid RevertProof config:\n${details}`);
    }

    throw error;
  }
}
