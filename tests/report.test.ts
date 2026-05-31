import { renderMarkdownReport } from "../src/report/markdown";
import type { RevertProofReport } from "../src/core/types";

describe("renderMarkdownReport", () => {
  it("renders status, findings, and command results", () => {
    const report: RevertProofReport = {
      status: "not-revert-safe",
      riskLevel: "high",
      mode: "required",
      commentMode: "always",
      base: "main",
      head: "feature",
      forwardChecksPassed: true,
      revertSucceeded: false,
      revertChecksPassed: false,
      revertConflicted: true,
      changedPaths: ["src/index.ts"],
      ignoredPaths: [],
      riskCategories: [],
      findings: [
        {
          code: "revert_failed",
          severity: "error",
          message: "The synthetic revert failed."
        }
      ],
      commandResults: {
        forward: [
          {
            command: "npm test",
            exitCode: 0,
            stdout: "",
            stderr: "",
            durationMs: 12
          }
        ],
        revert: []
      },
      generatedAt: "2026-01-01T00:00:00.000Z"
    };

    const markdown = renderMarkdownReport(report);

    expect(markdown).toContain("Status: **not-revert-safe**");
    expect(markdown).toContain("revert_failed");
    expect(markdown).toContain("npm test");
  });
});
