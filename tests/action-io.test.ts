import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getInput, setOutput } from "../src/github/action-io";

describe("action-io", () => {
  const originalMode = process.env["INPUT_MODE"];
  const originalBaseRef = process.env["INPUT_BASE-REF"];
  const originalGithubOutput = process.env.GITHUB_OUTPUT;

  afterEach(() => {
    setEnv("INPUT_MODE", originalMode);
    setEnv("INPUT_BASE-REF", originalBaseRef);
    setEnv("GITHUB_OUTPUT", originalGithubOutput);
  });

  it("reads GitHub Action inputs from environment variables", () => {
    process.env["INPUT_MODE"] = " required ";
    process.env["INPUT_BASE-REF"] = "main";

    expect(getInput("mode")).toBe("required");
    expect(getInput("base-ref")).toBe("main");
  });

  it("writes multiline-safe outputs to GITHUB_OUTPUT", async () => {
    const dir = await mkdtemp(join(tmpdir(), "revertproof-output-"));
    const outputPath = join(dir, "github-output.txt");
    process.env.GITHUB_OUTPUT = outputPath;

    await setOutput("status", "revert-safe");

    const output = await readFile(outputPath, "utf8");
    expect(output).toContain("status<<");
    expect(output).toContain("revert-safe");

    await rm(dir, { recursive: true, force: true });
  });
});

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
