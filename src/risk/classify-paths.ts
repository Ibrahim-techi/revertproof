import { matchesAny } from "../git/diff";
import type { RevertProofConfig, RiskCategoryResult } from "../core/types";

export function classifyRiskPaths(
  paths: string[],
  config: RevertProofConfig
): RiskCategoryResult[] {
  const categories: RiskCategoryResult[] = [];

  for (const [category, patterns] of Object.entries(config.riskPaths)) {
    const matched = paths.filter((path) => matchesAny(path, patterns));
    if (matched.length > 0) {
      categories.push({
        category,
        patterns,
        paths: matched
      });
    }
  }

  return categories;
}
