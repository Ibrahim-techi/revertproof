import { shouldComment, shouldFail } from "../src/core/exit-policy";
import type { RevertProofReport } from "../src/core/types";

const baseReport: RevertProofReport = {
  status: "revert-safe",
  riskLevel: "none",
  mode: "advisory",
  commentMode: "failures-only",
  base: "main",
  head: "feature",
  forwardChecksPassed: true,
  revertSucceeded: true,
  revertChecksPassed: true,
  revertConflicted: false,
  changedPaths: ["src/index.ts"],
  ignoredPaths: [],
  riskCategories: [],
  findings: [],
  commandResults: {
    forward: [],
    revert: []
  },
  generatedAt: "2026-01-01T00:00:00.000Z"
};

describe("exit policy", () => {
  it("does not fail advisory reports", () => {
    expect(
      shouldFail({
        ...baseReport,
        status: "not-revert-safe",
        mode: "advisory"
      })
    ).toBe(false);
  });

  it("fails required reports only when not revert safe", () => {
    expect(
      shouldFail({
        ...baseReport,
        status: "not-revert-safe",
        mode: "required"
      })
    ).toBe(true);

    expect(
      shouldFail({
        ...baseReport,
        status: "revert-risky",
        mode: "required"
      })
    ).toBe(false);
  });

  it("comments on failures-only mode only when attention is needed", () => {
    expect(shouldComment(baseReport)).toBe(false);
    expect(
      shouldComment({
        ...baseReport,
        status: "revert-risky"
      })
    ).toBe(true);
  });
});
