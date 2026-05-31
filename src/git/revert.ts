import { git } from "./git";

export async function listDirtyPaths(cwd: string): Promise<string[]> {
  const result = await git(cwd, ["status", "--porcelain=v1", "-z"]);

  return parsePorcelainStatus(result.stdout).sort();
}

function parsePorcelainStatus(output: string): string[] {
  const entries = output.split("\0").filter(Boolean);
  const paths: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? "";
    const status = entry.slice(0, 2);
    const path = entry.slice(3);

    if (path.length > 0) {
      paths.push(path);
    }

    if (status.includes("R") || status.includes("C")) {
      index += 1;
    }
  }

  return paths;
}
