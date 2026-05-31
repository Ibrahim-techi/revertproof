import { parseConfig } from "../src/config/schema";

describe("parseConfig", () => {
  it("applies safe defaults", () => {
    const config = parseConfig({});

    expect(config.mode).toBe("advisory");
    expect(config.checks.forward).toEqual([]);
    expect(config.riskPaths.dependencies).toContain("package.json");
    expect(config.commentMode).toBe("failures-only");
  });

  it("maps snake_case YAML fields into runtime config fields", () => {
    const config = parseConfig({
      mode: "required",
      checks: {
        forward: ["npm test"],
        revert: ["npm test"]
      },
      require_rollback_notes_for: ["migrations"],
      rollback_note_patterns: ["rollback"],
      ignore_paths: ["docs/**"],
      comment_mode: "always"
    });

    expect(config.mode).toBe("required");
    expect(config.checks.forward).toEqual(["npm test"]);
    expect(config.requireRollbackNotesFor).toEqual(["migrations"]);
    expect(config.rollbackNotePatterns).toEqual(["rollback"]);
    expect(config.ignorePaths).toEqual(["docs/**"]);
    expect(config.commentMode).toBe("always");
  });

  it("rejects unknown config keys instead of silently ignoring typos", () => {
    expect(() =>
      parseConfig({
        checks: {
          forward: [],
          revert: []
        },
        checkz: []
      })
    ).toThrow();
  });

  it("rejects invalid command limits", () => {
    expect(() =>
      parseConfig({
        command_timeout_ms: 0
      })
    ).toThrow();

    expect(() =>
      parseConfig({
        max_log_bytes: -1
      })
    ).toThrow();
  });
});
