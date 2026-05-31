import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RevertProofReport } from "../core/types";
import { renderMarkdownReport } from "./markdown";

export interface WrittenReports {
  jsonPath: string;
  markdownPath: string;
}

export async function writeReports(
  report: RevertProofReport,
  outputDir: string
): Promise<WrittenReports> {
  await mkdir(outputDir, { recursive: true });

  const jsonPath = join(outputDir, "revertproof-report.json");
  const markdownPath = join(outputDir, "revertproof-report.md");

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdownReport(report), "utf8");

  return { jsonPath, markdownPath };
}
