import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getPullRequestContext } from "../src/github/context";

describe("getPullRequestContext", () => {
  const originalEventPath = process.env.GITHUB_EVENT_PATH;

  afterEach(() => {
    setEnv("GITHUB_EVENT_PATH", originalEventPath);
  });

  it("extracts pull request context from a GitHub event payload", async () => {
    const dir = await mkdtemp(join(tmpdir(), "revertproof-event-"));
    const eventPath = join(dir, "event.json");

    await writeFile(
      eventPath,
      JSON.stringify({
        repository: {
          name: "revertproof",
          owner: {
            login: "maintainer"
          }
        },
        pull_request: {
          number: 42,
          title: "Add rollback notes",
          body: "Rollback: remove the generated file.",
          base: {
            sha: "base-sha"
          },
          head: {
            sha: "head-sha"
          }
        }
      }),
      "utf8"
    );

    process.env.GITHUB_EVENT_PATH = eventPath;

    expect(getPullRequestContext()).toEqual({
      owner: "maintainer",
      repo: "revertproof",
      pullNumber: 42,
      baseRef: "base-sha",
      headRef: "head-sha",
      prText: "Add rollback notes\n\nRollback: remove the generated file."
    });

    await rm(dir, { recursive: true, force: true });
  });

  it("returns undefined outside a pull request event", () => {
    delete process.env.GITHUB_EVENT_PATH;

    expect(getPullRequestContext()).toBeUndefined();
  });
});

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
