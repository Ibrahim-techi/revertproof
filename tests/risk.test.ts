import { parseConfig } from "../src/config/schema";
import { classifyRiskPaths } from "../src/risk/classify-paths";
import { hasRollbackNote } from "../src/risk/rollback-notes";

describe("risk classification", () => {
  it("classifies changed paths into configured risk categories", () => {
    const config = parseConfig({});
    const categories = classifyRiskPaths(
      ["src/index.ts", ".github/workflows/ci.yml", "package-lock.json"],
      config
    );

    expect(categories.map((category) => category.category)).toEqual([
      "workflows",
      "dependencies",
      "public_api"
    ]);
  });

  it("detects rollback notes case-insensitively", () => {
    expect(hasRollbackNote("Rollback: revert the migration with down.sql", ["rollback"])).toBe(
      true
    );
  });
});
