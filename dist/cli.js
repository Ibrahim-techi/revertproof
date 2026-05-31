#!/usr/bin/env node
"use strict";

// src/cli.ts
var import_promises4 = require("fs/promises");
var import_node_path4 = require("path");
var import_commander = require("commander");

// src/config/load-config.ts
var import_node_fs = require("fs");
var import_promises = require("fs/promises");
var import_yaml = require("yaml");
var import_zod2 = require("zod");

// src/config/schema.ts
var import_zod = require("zod");
var rawConfigSchema = import_zod.z.object({
  mode: import_zod.z.enum(["advisory", "required"]).default("advisory"),
  checks: import_zod.z.object({
    forward: import_zod.z.array(import_zod.z.string()).default([]),
    revert: import_zod.z.array(import_zod.z.string()).default([])
  }).default({ forward: [], revert: [] }),
  risk_paths: import_zod.z.record(import_zod.z.string(), import_zod.z.array(import_zod.z.string())).default({
    migrations: ["db/migrations/**", "migrations/**"],
    workflows: [".github/workflows/**"],
    dependencies: [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock"
    ],
    release: ["CHANGELOG.md", "release/**"],
    public_api: ["src/**/index.ts", "src/**/public/**"]
  }),
  require_rollback_notes_for: import_zod.z.array(import_zod.z.string()).default([]),
  rollback_note_patterns: import_zod.z.array(import_zod.z.string()).default(["rollback", "revert plan", "backout", "migration down"]),
  ignore_paths: import_zod.z.array(import_zod.z.string()).default([]),
  comment_mode: import_zod.z.enum(["always", "failures-only", "never"]).default("failures-only"),
  command_timeout_ms: import_zod.z.number().int().positive().default(10 * 60 * 1e3),
  max_log_bytes: import_zod.z.number().int().positive().default(32e3)
}).strict();
function parseConfig(input) {
  const parsed = rawConfigSchema.parse(input ?? {});
  return {
    mode: parsed.mode,
    checks: parsed.checks,
    riskPaths: parsed.risk_paths,
    requireRollbackNotesFor: parsed.require_rollback_notes_for,
    rollbackNotePatterns: parsed.rollback_note_patterns,
    ignorePaths: parsed.ignore_paths,
    commentMode: parsed.comment_mode,
    commandTimeoutMs: parsed.command_timeout_ms,
    maxLogBytes: parsed.max_log_bytes
  };
}

// src/config/load-config.ts
async function loadConfig(options = {}) {
  const configPath = options.configPath ?? ".revertproof.yml";
  let raw = {};
  if ((0, import_node_fs.existsSync)(configPath)) {
    const text = await (0, import_promises.readFile)(configPath, "utf8");
    raw = (0, import_yaml.parse)(text) ?? {};
  }
  try {
    const config = parseConfig(raw);
    return {
      ...config,
      mode: options.modeOverride ?? config.mode,
      commentMode: options.commentModeOverride ?? config.commentMode
    };
  } catch (error) {
    if (error instanceof import_zod2.ZodError) {
      const details = error.issues.map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`).join("\n");
      throw new Error(`Invalid RevertProof config:
${details}`);
    }
    throw error;
  }
}

// src/core/git-simulator.ts
var import_node_path2 = require("path");

// src/git/worktree.ts
var import_promises2 = require("fs/promises");
var import_node_path = require("path");
var import_node_os = require("os");
async function createTempWorkspace(prefix = "revertproof-") {
  return (0, import_promises2.mkdtemp)((0, import_node_path.join)((0, import_node_os.tmpdir)(), prefix));
}
async function removeTempWorkspace(path) {
  await (0, import_promises2.rm)(path, {
    recursive: true,
    force: true,
    maxRetries: 3
  });
}

// src/utils/exec.ts
var import_node_child_process = require("child_process");
async function execFileSafe(command, args, options) {
  return runProcess(command, args, { ...options, shell: false });
}
async function execShellCommand(command, options) {
  const result = await runProcess(command, [], { ...options, shell: true });
  return {
    command,
    ...result
  };
}
function runProcess(command, args, options) {
  const started = Date.now();
  const maxOutputBytes = options.maxOutputBytes ?? 32e3;
  return new Promise((resolve2) => {
    const child = (0, import_node_child_process.spawn)(command, args, {
      cwd: options.cwd,
      env: process.env,
      shell: options.shell ?? false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = options.timeoutMs === void 0 ? void 0 : setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout = appendLimited(stdout, chunk.toString("utf8"), maxOutputBytes);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendLimited(stderr, chunk.toString("utf8"), maxOutputBytes);
    });
    child.on("error", (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve2({
        exitCode: 1,
        stdout,
        stderr: appendLimited(stderr, error.message, maxOutputBytes),
        durationMs: Date.now() - started
      });
    });
    child.on("close", (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve2({
        exitCode: timedOut ? 124 : code ?? 1,
        stdout,
        stderr: timedOut ? appendLimited(stderr, `
Command timed out after ${options.timeoutMs}ms.`, maxOutputBytes) : stderr,
        durationMs: Date.now() - started
      });
    });
  });
}
function appendLimited(current, next, maxBytes) {
  const combined = current + next;
  if (Buffer.byteLength(combined, "utf8") <= maxBytes) {
    return combined;
  }
  return combined.slice(Math.max(0, combined.length - maxBytes));
}

// src/git/git.ts
async function git(cwd, args, options = {}) {
  const result = await execFileSafe("git", args, {
    cwd,
    timeoutMs: 12e4,
    maxOutputBytes: 64e3
  });
  if (result.exitCode !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(" ")} failed:
${result.stderr || result.stdout}`);
  }
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr
  };
}
async function gitOutput(cwd, args) {
  const result = await git(cwd, args);
  return result.stdout.trim();
}

// src/git/merge.ts
async function resolveRepoRoot(cwd) {
  return gitOutput(cwd, ["rev-parse", "--show-toplevel"]);
}
async function cloneRepo(source, target) {
  await git(source, ["clone", "--no-hardlinks", source, target]);
}
async function prepareIdentity(cwd) {
  await git(cwd, ["config", "user.name", "RevertProof"]);
  await git(cwd, ["config", "user.email", "revertproof@example.invalid"]);
}
async function checkoutDetached(cwd, ref) {
  await git(cwd, ["checkout", "--detach", ref]);
}
async function mergeHead(cwd, head) {
  const result = await git(cwd, ["merge", "--no-ff", "--no-edit", head], {
    allowFailure: true
  });
  const output = `${result.stdout}${result.stderr}`;
  if (result.exitCode !== 0) {
    await git(cwd, ["merge", "--abort"], { allowFailure: true });
    return {
      succeeded: false,
      output
    };
  }
  return {
    succeeded: true,
    output,
    mergeSha: await gitOutput(cwd, ["rev-parse", "HEAD"])
  };
}
async function revertMerge(cwd, mergeSha) {
  const result = await git(cwd, ["revert", "-m", "1", "--no-edit", mergeSha], {
    allowFailure: true
  });
  return {
    succeeded: result.exitCode === 0,
    output: `${result.stdout}${result.stderr}`
  };
}

// src/git/revert.ts
async function listDirtyPaths(cwd) {
  const result = await git(cwd, ["status", "--porcelain=v1", "-z"]);
  return parsePorcelainStatus(result.stdout).sort();
}
function parsePorcelainStatus(output) {
  const entries = output.split("\0").filter(Boolean);
  const paths = [];
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

// src/core/git-simulator.ts
async function runGitSimulation(options) {
  const repoRoot = await resolveRepoRoot(options.repoDir);
  const baseSha = await gitOutput(repoRoot, ["rev-parse", options.base]);
  const headSha = await gitOutput(repoRoot, ["rev-parse", options.head]);
  const tempParent = await createTempWorkspace();
  const tempRepo = (0, import_node_path2.join)(tempParent, "repo");
  try {
    await cloneRepo(repoRoot, tempRepo);
    await prepareIdentity(tempRepo);
    await checkoutDetached(tempRepo, baseSha);
    const merge = await mergeHead(tempRepo, headSha);
    if (!merge.succeeded || !merge.mergeSha) {
      return {
        base: options.base,
        head: options.head,
        mergeSucceeded: false,
        mergeOutput: merge.output,
        forwardChecks: [],
        revertSucceeded: false,
        revertOutput: "",
        revertChecks: [],
        dirtyPathsAfterRevert: [],
        tempDir: tempRepo
      };
    }
    const forwardChecks = await runChecks(tempRepo, options.config.checks.forward, options.config);
    const revert = await revertMerge(tempRepo, merge.mergeSha);
    const revertChecks = revert.succeeded ? await runChecks(tempRepo, options.config.checks.revert, options.config) : [];
    const dirtyPathsAfterRevert = revert.succeeded ? await listDirtyPaths(tempRepo) : [];
    return {
      base: options.base,
      head: options.head,
      mergeSucceeded: true,
      mergeOutput: merge.output,
      syntheticMergeSha: merge.mergeSha,
      forwardChecks,
      revertSucceeded: revert.succeeded,
      revertOutput: revert.output,
      revertChecks,
      dirtyPathsAfterRevert,
      tempDir: tempRepo
    };
  } finally {
    if (!options.keepTemp) {
      await removeTempWorkspace(tempParent);
    }
  }
}
async function runChecks(cwd, commands, config) {
  const results = [];
  for (const command of commands) {
    results.push(
      await execShellCommand(command, {
        cwd,
        timeoutMs: config.commandTimeoutMs,
        maxOutputBytes: config.maxLogBytes
      })
    );
  }
  return results;
}

// src/git/diff.ts
var import_minimatch = require("minimatch");
async function listChangedPaths(cwd, base, head) {
  const result = await git(cwd, ["diff", "--name-only", "-z", `${base}...${head}`]);
  return result.stdout.split("\0").filter(Boolean).sort();
}
function filterIgnoredPaths(paths, ignorePatterns) {
  const ignored = [];
  const included = [];
  for (const path of paths) {
    if (matchesAny(path, ignorePatterns)) {
      ignored.push(path);
    } else {
      included.push(path);
    }
  }
  return { included, ignored };
}
function matchesAny(path, patterns) {
  return patterns.some(
    (pattern) => (0, import_minimatch.minimatch)(path, pattern, {
      dot: true,
      nocase: process.platform === "win32"
    })
  );
}

// src/risk/classify-paths.ts
function classifyRiskPaths(paths, config) {
  const categories = [];
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

// src/risk/rollback-notes.ts
function hasRollbackNote(text, patterns) {
  const normalized = text.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

// src/core/status.ts
function buildReport(options) {
  const findings = [];
  const forwardChecksPassed = allPassed(options.simulation.forwardChecks);
  const revertChecksPassed = allPassed(options.simulation.revertChecks);
  const revertConflicted = !options.simulation.revertSucceeded && /conflict|CONFLICT|could not apply|would be overwritten/i.test(options.simulation.revertOutput);
  if (!options.simulation.mergeSucceeded) {
    findings.push({
      code: "merge_failed",
      severity: "error",
      message: "The pull request could not be merged into the base ref in the simulation.",
      details: options.simulation.mergeOutput
    });
  }
  if (!forwardChecksPassed) {
    findings.push({
      code: "forward_checks_failed",
      severity: "error",
      message: "One or more forward checks failed after the synthetic merge."
    });
  }
  if (options.simulation.mergeSucceeded && !options.simulation.revertSucceeded) {
    findings.push({
      code: "revert_failed",
      severity: "error",
      message: "The synthetic revert failed.",
      details: options.simulation.revertOutput
    });
  }
  if (options.simulation.revertSucceeded && !revertChecksPassed) {
    findings.push({
      code: "revert_checks_failed",
      severity: "error",
      message: "One or more checks failed after the synthetic revert."
    });
  }
  if (options.simulation.dirtyPathsAfterRevert.length > 0) {
    findings.push({
      code: "dirty_after_revert",
      severity: "error",
      message: "The worktree was dirty after the synthetic revert.",
      paths: options.simulation.dirtyPathsAfterRevert
    });
  }
  for (const category of options.riskCategories) {
    findings.push({
      code: `risk_path_${category.category}`,
      severity: "warning",
      message: `Changed paths match the '${category.category}' risk category.`,
      paths: category.paths
    });
  }
  const prText = options.prText ?? "";
  for (const requiredCategory of options.config.requireRollbackNotesFor) {
    const category = options.riskCategories.find((item) => item.category === requiredCategory);
    if (category && !hasRollbackNote(prText, options.config.rollbackNotePatterns)) {
      findings.push({
        code: `missing_rollback_note_${requiredCategory}`,
        severity: "warning",
        message: `Changes in '${requiredCategory}' require rollback notes, but no rollback note was found.`,
        paths: category.paths
      });
    }
  }
  const status = computeStatus({
    changedPaths: options.changedPaths,
    mergeSucceeded: options.simulation.mergeSucceeded,
    forwardChecksPassed,
    revertSucceeded: options.simulation.revertSucceeded,
    revertChecksPassed,
    dirtyAfterRevert: options.simulation.dirtyPathsAfterRevert.length > 0,
    findings
  });
  return {
    status,
    riskLevel: computeRiskLevel(findings),
    mode: options.config.mode,
    commentMode: options.config.commentMode,
    base: options.base,
    head: options.head,
    forwardChecksPassed,
    revertSucceeded: options.simulation.revertSucceeded,
    revertChecksPassed,
    revertConflicted,
    changedPaths: options.changedPaths,
    ignoredPaths: options.ignoredPaths,
    riskCategories: options.riskCategories,
    findings,
    commandResults: {
      forward: options.simulation.forwardChecks,
      revert: options.simulation.revertChecks
    },
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function allPassed(results) {
  return results.every((result) => result.exitCode === 0);
}
function computeStatus(input) {
  if (input.changedPaths.length === 0) {
    return "not-applicable";
  }
  if (!input.mergeSucceeded || !input.forwardChecksPassed || !input.revertSucceeded || !input.revertChecksPassed || input.dirtyAfterRevert) {
    return "not-revert-safe";
  }
  if (input.findings.some((finding) => finding.severity === "warning")) {
    return "revert-risky";
  }
  return "revert-safe";
}
function computeRiskLevel(findings) {
  if (findings.some((finding) => finding.severity === "error")) {
    return "high";
  }
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  if (warnings >= 2) {
    return "medium";
  }
  if (warnings === 1) {
    return "low";
  }
  return "none";
}

// src/core/run-check.ts
async function runRevertProofCheck(options) {
  const repoRoot = await resolveRepoRoot(options.repoDir);
  const allChangedPaths = await listChangedPaths(repoRoot, options.base, options.head);
  const { included: changedPaths, ignored: ignoredPaths } = filterIgnoredPaths(
    allChangedPaths,
    options.config.ignorePaths
  );
  const riskCategories = classifyRiskPaths(changedPaths, options.config);
  const simulation = changedPaths.length === 0 ? buildSkippedSimulation(options.base, options.head) : await runGitSimulation({ ...options, repoDir: repoRoot });
  return buildReport({
    base: options.base,
    head: options.head,
    changedPaths,
    ignoredPaths,
    riskCategories,
    simulation,
    config: options.config,
    ...options.prText === void 0 ? {} : { prText: options.prText }
  });
}
function buildSkippedSimulation(base, head) {
  return {
    base,
    head,
    mergeSucceeded: true,
    mergeOutput: "",
    forwardChecks: [],
    revertSucceeded: true,
    revertOutput: "",
    revertChecks: [],
    dirtyPathsAfterRevert: [],
    tempDir: ""
  };
}

// src/core/exit-policy.ts
function shouldFail(report) {
  if (report.mode !== "required") {
    return false;
  }
  return report.status === "not-revert-safe";
}

// src/report/markdown.ts
function renderMarkdownReport(report) {
  const lines = [];
  lines.push("## RevertProof Report");
  lines.push("");
  lines.push(`Status: **${formatStatus(report.status)}**`);
  lines.push(`Risk: **${report.riskLevel}**`);
  lines.push("");
  lines.push("| Check | Result |");
  lines.push("| --- | --- |");
  lines.push(`| Forward checks | ${report.forwardChecksPassed ? "passed" : "failed"} |`);
  lines.push(`| Synthetic revert | ${report.revertSucceeded ? "passed" : "failed"} |`);
  lines.push(`| Revert checks | ${report.revertChecksPassed ? "passed" : "failed"} |`);
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("No findings.");
  } else {
    lines.push("### Findings");
    lines.push("");
    for (const finding of report.findings) {
      lines.push(`- **${finding.severity.toUpperCase()} ${finding.code}**: ${finding.message}`);
      if (finding.paths && finding.paths.length > 0) {
        lines.push(`  Paths: ${finding.paths.map((path) => `\`${path}\``).join(", ")}`);
      }
    }
  }
  if (report.riskCategories.length > 0) {
    lines.push("");
    lines.push("### Risk Categories");
    lines.push("");
    for (const category of report.riskCategories) {
      lines.push(`- **${category.category}**: ${category.paths.map((path) => `\`${path}\``).join(", ")}`);
    }
  }
  lines.push("");
  lines.push("### Changed Paths");
  lines.push("");
  if (report.changedPaths.length === 0) {
    lines.push("No non-ignored changed paths.");
  } else {
    for (const path of report.changedPaths) {
      lines.push(`- \`${path}\``);
    }
  }
  if (report.ignoredPaths.length > 0) {
    lines.push("");
    lines.push("Ignored paths:");
    for (const path of report.ignoredPaths) {
      lines.push(`- \`${path}\``);
    }
  }
  appendCommandSection(lines, "Forward Command Results", report.commandResults.forward);
  appendCommandSection(lines, "Revert Command Results", report.commandResults.revert);
  lines.push("");
  lines.push("<sub>Generated by RevertProof.</sub>");
  return `${lines.join("\n")}
`;
}
function formatStatus(status) {
  switch (status) {
    case "revert-safe":
      return "revert-safe";
    case "revert-risky":
      return "revert-risky";
    case "not-revert-safe":
      return "not-revert-safe";
    case "not-applicable":
      return "not-applicable";
    default:
      return status;
  }
}
function appendCommandSection(lines, title, results) {
  if (results.length === 0) {
    return;
  }
  lines.push("");
  lines.push(`### ${title}`);
  lines.push("");
  lines.push("| Command | Exit | Duration |");
  lines.push("| --- | ---: | ---: |");
  for (const result of results) {
    lines.push(`| \`${escapePipes(result.command)}\` | ${result.exitCode} | ${result.durationMs}ms |`);
  }
}
function escapePipes(value) {
  return value.replaceAll("|", "\\|");
}

// src/report/json.ts
var import_promises3 = require("fs/promises");
var import_node_path3 = require("path");
async function writeReports(report, outputDir) {
  await (0, import_promises3.mkdir)(outputDir, { recursive: true });
  const jsonPath = (0, import_node_path3.join)(outputDir, "revertproof-report.json");
  const markdownPath = (0, import_node_path3.join)(outputDir, "revertproof-report.md");
  await (0, import_promises3.writeFile)(jsonPath, `${JSON.stringify(report, null, 2)}
`, "utf8");
  await (0, import_promises3.writeFile)(markdownPath, renderMarkdownReport(report), "utf8");
  return { jsonPath, markdownPath };
}

// src/cli.ts
var program = new import_commander.Command();
program.name("revertproof").description("Prove whether a pull request can be safely reverted before it is merged.").version("0.1.0");
program.command("check").description("Run RevertProof against two refs.").option("--base <ref>", "Base ref or SHA.", "origin/main").option("--head <ref>", "Head ref or SHA.", "HEAD").option("--repo <path>", "Repository path.", process.cwd()).option("--config <path>", "Config file path.", ".revertproof.yml").option("--mode <mode>", "advisory or required.").option("--comment-mode <mode>", "always, failures-only, or never.").option("--pr-text <path>", "Optional file containing pull request title/body text.").option("--output-dir <path>", "Directory for JSON and Markdown reports.", "revertproof-output").action(async (options) => {
  const mode = parseMode(options.mode);
  const commentMode = parseCommentMode(options.commentMode);
  const repoDir = await resolveRepoRoot((0, import_node_path4.resolve)(String(options.repo)));
  const configPath = resolveConfigPath(repoDir, String(options.config));
  const config = await loadConfig({
    configPath,
    ...mode === void 0 ? {} : { modeOverride: mode },
    ...commentMode === void 0 ? {} : { commentModeOverride: commentMode }
  });
  const prText = options.prText === void 0 ? void 0 : await (0, import_promises4.readFile)(String(options.prText), "utf8");
  const report = await runRevertProofCheck({
    repoDir,
    base: String(options.base),
    head: String(options.head),
    config,
    ...prText === void 0 ? {} : { prText }
  });
  const written = await writeReports(report, (0, import_node_path4.resolve)(String(options.outputDir)));
  process.stdout.write(renderMarkdownReport(report));
  process.stdout.write(`
JSON report: ${written.jsonPath}
`);
  process.stdout.write(`Markdown report: ${written.markdownPath}
`);
  if (shouldFail(report)) {
    process.exitCode = 1;
  }
});
program.command("validate-config").description("Validate a RevertProof config file.").option("--config <path>", "Config file path.", ".revertproof.yml").action(async (options) => {
  await loadConfig({ configPath: String(options.config) });
  process.stdout.write("RevertProof config is valid.\n");
});
program.command("explain").description("Render a Markdown explanation from a JSON report.").argument("<report>", "Path to revertproof-report.json.").action(async (reportPath) => {
  const raw = await (0, import_promises4.readFile)(String(reportPath), "utf8");
  const report = JSON.parse(raw);
  process.stdout.write(renderMarkdownReport(report));
});
program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}
`);
  process.exitCode = 2;
});
function parseMode(value) {
  if (value === void 0) {
    return void 0;
  }
  if (value === "advisory" || value === "required") {
    return value;
  }
  throw new Error(`Invalid mode '${String(value)}'. Expected advisory or required.`);
}
function parseCommentMode(value) {
  if (value === void 0) {
    return void 0;
  }
  if (value === "always" || value === "failures-only" || value === "never") {
    return value;
  }
  throw new Error(
    `Invalid comment mode '${String(value)}'. Expected always, failures-only, or never.`
  );
}
function resolveConfigPath(repoDir, configPath) {
  return (0, import_node_path4.isAbsolute)(configPath) ? configPath : (0, import_node_path4.resolve)(repoDir, configPath);
}
//# sourceMappingURL=cli.js.map