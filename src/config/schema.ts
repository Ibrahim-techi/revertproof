import { z } from "zod";
import type { CommentMode, Mode, RevertProofConfig } from "../core/types";

const rawConfigSchema = z
  .object({
    mode: z.enum(["advisory", "required"]).default("advisory"),
    checks: z
      .object({
        forward: z.array(z.string()).default([]),
        revert: z.array(z.string()).default([])
      })
      .default({ forward: [], revert: [] }),
    risk_paths: z.record(z.string(), z.array(z.string())).default({
      migrations: ["db/migrations/**", "migrations/**"],
      workflows: [".github/workflows/**"],
      dependencies: [
        "package.json",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock"
      ],
      release: ["CHANGELOG.md", "release/**"],
      public_api: ["src/**/index.ts", "src/**/public/**"]
    }),
    require_rollback_notes_for: z.array(z.string()).default([]),
    rollback_note_patterns: z
      .array(z.string())
      .default(["rollback", "revert plan", "backout", "migration down"]),
    ignore_paths: z.array(z.string()).default([]),
    comment_mode: z.enum(["always", "failures-only", "never"]).default("failures-only"),
    command_timeout_ms: z.number().int().positive().default(10 * 60 * 1000),
    max_log_bytes: z.number().int().positive().default(32_000)
  })
  .strict();

export type RawConfig = z.input<typeof rawConfigSchema>;

export function parseConfig(input: unknown): RevertProofConfig {
  const parsed = rawConfigSchema.parse(input ?? {});

  return {
    mode: parsed.mode as Mode,
    checks: parsed.checks,
    riskPaths: parsed.risk_paths,
    requireRollbackNotesFor: parsed.require_rollback_notes_for,
    rollbackNotePatterns: parsed.rollback_note_patterns,
    ignorePaths: parsed.ignore_paths,
    commentMode: parsed.comment_mode as CommentMode,
    commandTimeoutMs: parsed.command_timeout_ms,
    maxLogBytes: parsed.max_log_bytes
  };
}
