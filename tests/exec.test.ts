import { tmpdir } from "node:os";
import { execShellCommand } from "../src/utils/exec";

describe("execShellCommand", () => {
  it("returns exit code 124 when a command times out", async () => {
    const result = await execShellCommand(
      `${quotedNode()} -e "setTimeout(() => {}, 1000)"`,
      {
        cwd: tmpdir(),
        timeoutMs: 50,
        maxOutputBytes: 1_000
      }
    );

    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain("Command timed out after 50ms");
  });

  it("keeps command output bounded", async () => {
    const result = await execShellCommand(`${quotedNode()} -e "console.log('x'.repeat(200))"`, {
      cwd: tmpdir(),
      timeoutMs: 5_000,
      maxOutputBytes: 32
    });

    expect(result.exitCode).toBe(0);
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(32);
    expect(result.stdout).toContain("x");
  });
});

function quotedNode(): string {
  return JSON.stringify(process.execPath);
}
