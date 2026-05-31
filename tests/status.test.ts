import { parseConfig } from "../src/config/schema";
import { buildReport } from "../src/core/status";
import type { GitSimulationResult } from "../src/core/types";

const baseSimulation: GitSimulationResult = {
  base: "base",
  head: "head",
  mergeSucceeded: true,
  mergeOutput: "",
  syntheticMergeSha: "abc",
  forwardChecks: [],
  revertSucceeded: true,
  revertOutput: "",
  revertChecks: [],
  dirtyPathsAfterRevert: [],
  tempDir: "/tmp/revertproof"
};

describe("buildReport", () => {
  it("returns revert-safe when merge, revert, and checks pass", () => {
    const report = buildReport({
      base: "base",
      head: "head",
      changedPaths: ["src/index.ts"],
      ignoredPaths: [],
      riskCategories: [],
      simulation: baseSimulation,
      config: parseConfig({})
    });

    expect(report.status).toBe("revert-safe");
    expect(report.riskLevel).toBe("none");
  });

  it("returns not-revert-safe when revert checks fail", () => {
    const report = buildReport({
      base: "base",
      head: "head",
      changedPaths: ["src/index.ts"],
      ignoredPaths: [],
      riskCategories: [],
      simulation: {
        ...baseSimulation,
        revertChecks: [
          {
            command: "npm test",
            exitCode: 1,
            stdout: "",
            stderr: "failed",
            durationMs: 10
          }
        ]
      },
      config: parseConfig({})
    });

    expect(report.status).toBe("not-revert-safe");
    expect(report.riskLevel).toBe("high");
  });

  it("returns revert-risky when rollback notes are missing", () => {
    const config = parseConfig({
      require_rollback_notes_for: ["migrations"]
    });
    const report = buildReport({
      base: "base",
      head: "head",
      changedPaths: ["migrations/001.sql"],
      ignoredPaths: [],
      riskCategories: [
        {
          category: "migrations",
          patterns: ["migrations/**"],
          paths: ["migrations/001.sql"]
        }
      ],
      simulation: baseSimulation,
      config
    });

    expect(report.status).toBe("revert-risky");
    expect(report.findings.map((finding) => finding.code)).toContain(
      "missing_rollback_note_migrations"
    );
  });
});
