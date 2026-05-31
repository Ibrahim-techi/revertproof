import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { parseConfig } from "../src/config/schema";
import { runRevertProofCheck } from "../src/core/run-check";

describe("runRevertProofCheck integration", () => {
  it("reports revert-safe for a simple reversible change", async () => {
    const repo = await createRepo();
    await writeFile(join(repo, "app.txt"), "base\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "app.txt"), "feature\n", "utf8");
    await git(repo, "commit", "-am", "feature");

    const report = await runRevertProofCheck({
      repoDir: repo,
      base: "main",
      head: "feature",
      config: parseConfig({})
    });

    expect(report.status).toBe("revert-safe");
    await cleanup(repo);
  });

  it("reports not-revert-safe when revert checks fail", async () => {
    const repo = await createRepo();
    await writeFile(join(repo, "state.txt"), "old\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "state.txt"), "new\n", "utf8");
    await git(repo, "commit", "-am", "feature");

    const report = await runRevertProofCheck({
      repoDir: repo,
      base: "main",
      head: "feature",
      config: parseConfig({
        checks: {
          forward: [nodeCheck("state.txt", "new")],
          revert: [nodeCheck("state.txt", "new")]
        }
      })
    });

    expect(report.status).toBe("not-revert-safe");
    expect(report.findings.map((finding) => finding.code)).toContain("revert_checks_failed");
    await cleanup(repo);
  });

  it("reports not-revert-safe when forward checks fail", async () => {
    const repo = await createRepo();
    await writeFile(join(repo, "state.txt"), "old\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "state.txt"), "new\n", "utf8");
    await git(repo, "commit", "-am", "feature");

    const report = await runRevertProofCheck({
      repoDir: repo,
      base: "main",
      head: "feature",
      config: parseConfig({
        checks: {
          forward: [nodeCheck("state.txt", "impossible")],
          revert: []
        }
      })
    });

    expect(report.status).toBe("not-revert-safe");
    expect(report.findings.map((finding) => finding.code)).toContain("forward_checks_failed");
    await cleanup(repo);
  });

  it("preserves changed path names that contain spaces", async () => {
    const repo = await createRepo();
    await mkdir(join(repo, "docs"), { recursive: true });
    await writeFile(join(repo, "docs", "guide file.md"), "base\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "docs", "guide file.md"), "feature\n", "utf8");
    await git(repo, "commit", "-am", "docs update");

    const report = await runRevertProofCheck({
      repoDir: repo,
      base: "main",
      head: "feature",
      config: parseConfig({})
    });

    expect(report.status).toBe("revert-safe");
    expect(report.changedPaths).toEqual(["docs/guide file.md"]);
    await cleanup(repo);
  });

  it("works when repoDir points at a subdirectory inside the repository", async () => {
    const repo = await createRepo();
    await mkdir(join(repo, "src", "lib"), { recursive: true });
    await writeFile(join(repo, "src", "lib", "feature.ts"), "base\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "src", "lib", "feature.ts"), "feature\n", "utf8");
    await git(repo, "commit", "-am", "feature");

    const report = await runRevertProofCheck({
      repoDir: join(repo, "src", "lib"),
      base: "main",
      head: "feature",
      config: parseConfig({
        ignore_paths: ["src/**"],
        checks: {
          forward: [`node -e "process.exit(1)"`],
          revert: [`node -e "process.exit(1)"`]
        }
      })
    });

    expect(report.status).toBe("not-applicable");
    expect(report.ignoredPaths).toEqual(["src/lib/feature.ts"]);
    expect(report.commandResults.forward).toEqual([]);
    expect(report.commandResults.revert).toEqual([]);
    await cleanup(repo);
  });

  it("reports dirty_after_revert when checks modify tracked files after revert", async () => {
    const repo = await createRepo();
    await writeFile(join(repo, "state.txt"), "old\n", "utf8");
    await writeFile(join(repo, "generated file.txt"), "clean\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "state.txt"), "new\n", "utf8");
    await git(repo, "commit", "-am", "feature");

    const report = await runRevertProofCheck({
      repoDir: repo,
      base: "main",
      head: "feature",
      config: parseConfig({
        checks: {
          forward: [],
          revert: [`node -e "require('fs').writeFileSync('generated file.txt','dirty\\n')"`]
        }
      })
    });

    expect(report.status).toBe("not-revert-safe");
    expect(report.findings.map((finding) => finding.code)).toContain("dirty_after_revert");
    expect(report.findings.find((finding) => finding.code === "dirty_after_revert")?.paths).toEqual(
      ["generated file.txt"]
    );
    await cleanup(repo);
  });

  it("reports not-revert-safe when the synthetic merge conflicts", async () => {
    const repo = await createRepo();
    await writeFile(join(repo, "app.txt"), "base\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "app.txt"), "feature\n", "utf8");
    await git(repo, "commit", "-am", "feature");
    await git(repo, "checkout", "main");
    await writeFile(join(repo, "app.txt"), "main\n", "utf8");
    await git(repo, "commit", "-am", "main update");

    const report = await runRevertProofCheck({
      repoDir: repo,
      base: "main",
      head: "feature",
      config: parseConfig({
        checks: {
          forward: [nodeCheck("app.txt", "feature")],
          revert: [nodeCheck("app.txt", "main")]
        }
      })
    });

    expect(report.status).toBe("not-revert-safe");
    expect(report.findings.map((finding) => finding.code)).toContain("merge_failed");
    expect(report.findings.map((finding) => finding.code)).not.toContain("revert_failed");
    expect(report.commandResults.forward).toEqual([]);
    expect(report.commandResults.revert).toEqual([]);
    await cleanup(repo);
  });

  it("reports revert-risky for migrations without rollback notes", async () => {
    const repo = await createRepo();
    await mkdir(join(repo, "migrations"), { recursive: true });
    await writeFile(join(repo, "migrations", ".gitkeep"), "", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "migrations", "001.sql"), "create table users(id int);\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "add migration");

    const report = await runRevertProofCheck({
      repoDir: repo,
      base: "main",
      head: "feature",
      config: parseConfig({
        require_rollback_notes_for: ["migrations"]
      })
    });

    expect(report.status).toBe("revert-risky");
    expect(report.riskCategories.map((category) => category.category)).toContain("migrations");
    await cleanup(repo);
  });

  it("accepts rollback notes for configured risk categories", async () => {
    const repo = await createRepo();
    await mkdir(join(repo, "migrations"), { recursive: true });
    await writeFile(join(repo, "migrations", ".gitkeep"), "", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "migrations", "001.sql"), "create table users(id int);\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "add migration");

    const report = await runRevertProofCheck({
      repoDir: repo,
      base: "main",
      head: "feature",
      prText: "Rollback: apply the migration down script before reverting.",
      config: parseConfig({
        require_rollback_notes_for: ["migrations"]
      })
    });

    expect(report.status).toBe("revert-risky");
    expect(report.findings.map((finding) => finding.code)).not.toContain(
      "missing_rollback_note_migrations"
    );
    await cleanup(repo);
  });

  it("reports not-applicable when all paths are ignored without running configured commands", async () => {
    const repo = await createRepo();
    await mkdir(join(repo, "docs"), { recursive: true });
    await writeFile(join(repo, "docs", "guide.md"), "base\n", "utf8");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "base");
    await git(repo, "checkout", "-b", "feature");
    await writeFile(join(repo, "docs", "guide.md"), "feature\n", "utf8");
    await git(repo, "commit", "-am", "docs");

    const report = await runRevertProofCheck({
      repoDir: repo,
      base: "main",
      head: "feature",
      config: parseConfig({
        ignore_paths: ["docs/**"],
        checks: {
          forward: [`node -e "process.exit(1)"`],
          revert: [`node -e "process.exit(1)"`]
        }
      })
    });

    expect(report.status).toBe("not-applicable");
    expect(report.ignoredPaths).toEqual(["docs/guide.md"]);
    expect(report.findings).toEqual([]);
    expect(report.commandResults.forward).toEqual([]);
    expect(report.commandResults.revert).toEqual([]);
    await cleanup(repo);
  });
});

async function createRepo(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "revertproof-test-"));
  await git(repo, "init", "-b", "main");
  await git(repo, "config", "user.name", "Test User");
  await git(repo, "config", "user.email", "test@example.invalid");
  return repo;
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  execFileSync("git", args, {
    cwd,
    stdio: "pipe",
    windowsHide: true
  });
}

async function cleanup(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true, maxRetries: 3 });
}

function nodeCheck(file: string, expected: string): string {
  return `node -e "const fs=require('fs');process.exit(fs.readFileSync('${file}','utf8').trim()==='${expected}'?0:1)"`;
}
