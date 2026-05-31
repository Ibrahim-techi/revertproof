import { minimatch } from "minimatch";
import { git } from "./git";

export async function listChangedPaths(
  cwd: string,
  base: string,
  head: string
): Promise<string[]> {
  const result = await git(cwd, ["diff", "--name-only", "-z", `${base}...${head}`]);
  return result.stdout.split("\0").filter(Boolean).sort();
}

export function filterIgnoredPaths(
  paths: string[],
  ignorePatterns: string[]
): { included: string[]; ignored: string[] } {
  const ignored: string[] = [];
  const included: string[] = [];

  for (const path of paths) {
    if (matchesAny(path, ignorePatterns)) {
      ignored.push(path);
    } else {
      included.push(path);
    }
  }

  return { included, ignored };
}

export function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) =>
    minimatch(path, pattern, {
      dot: true,
      nocase: process.platform === "win32"
    })
  );
}
