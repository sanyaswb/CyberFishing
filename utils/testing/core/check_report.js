"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { CheckSeal, canonical } = require("./check_seal");

// Machine-readable evidence of one check run, produced by the runner itself. Acceptance reports
// (mode "acceptance") must execute the complete catalog without any cached result.
const REPORT_KIND = "cyber-fishing-check-run-report";
const REPORT_SCHEMA = 1;
const GIT = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";
// Local-only files that are never part of the project (never committed, not check inputs).
const LOCAL_ONLY = Object.freeze([/^CLAUDE\.md$/u, /^\.claude\//u]);
const sha = value => crypto.createHash("sha256").update(value).digest("hex");

// Fingerprint of the working tree: every tracked and untracked, non-ignored file (uncommitted
// changes included), by path and bytes.
class SourceSnapshot {
  static of(root) {
    const listed = spawnSync(GIT, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root });
    if (listed.status !== 0) throw new Error(`git ls-files failed: ${String(listed.stderr)}`);
    const files = [...new Set(String(listed.stdout).split("\0").filter(Boolean))]
      .filter(file => !LOCAL_ONLY.some(pattern => pattern.test(file))).sort();
    const lines = files.map(file => {
      const absolute = path.join(root, file);
      return `${file}\0${fs.existsSync(absolute) ? sha(fs.readFileSync(absolute)) : "deleted"}`;
    });
    const commit = spawnSync(GIT, ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
    return { commit: String(commit.stdout).trim(), files: files.length, sha256: sha(lines.join("\n")) };
  }
}

// The catalog identity: every definition, including cache and isolation policies.
const catalogSha256 = checks => sha(canonical(checks.map(check => CheckSeal.identity(check, null))));

class CheckRunReport {
  constructor({ projectRoot, mode, argv, jobs, catalog, file }) {
    this.projectRoot = path.resolve(projectRoot);
    this.catalogChecks = catalog;
    this.file = file;
    this.mode = mode;
    this.argv = [...argv];
    this.jobs = jobs;
    this.checks = [];
  }

  begin(selected) {
    const catalog = this.catalogChecks;
    this.startedAt = new Date().toISOString();
    this.runId = `${this.startedAt.replace(/[:.]/gu, "-")}-${process.pid}`;
    this.selected = selected.map(check => check.id);
    this.catalogIds = catalog.map(check => check.id);
    this.catalog = catalogSha256(catalog);
    this.source = SourceSnapshot.of(this.projectRoot);
  }

  add(result) {
    this.checks.push({
      id: result.check.id,
      scope: result.scope,
      status: result.cached ? "cached" : result.status === 0 && !result.error ? "passed" : "failed",
      executed: !result.cached,
      exitCode: result.cached ? null : result.status,
      durationMs: result.durationMs,
      outputSha256: result.cached ? null : sha(result.output || ""),
      ...(result.cached ? { sealedAt: result.sealedAt } : {}),
      cache: result.cached ? { reused: true } : { sealed: result.sealed === true, reasons: result.cacheReasons || [] },
      ...(result.isolationViolations?.length ? { isolationViolations: result.isolationViolations } : {}),
      ...(result.diagnosticRetry ? { diagnosticRetry: result.diagnosticRetry } : {}),
    });
  }

  finish() {
    const after = SourceSnapshot.of(this.projectRoot);
    const order = new Map(this.selected.map((id, index) => [id, index]));
    const checks = [...this.checks].sort((left, right) => order.get(left.id) - order.get(right.id));
    return {
      kind: REPORT_KIND,
      schemaVersion: REPORT_SCHEMA,
      runId: this.runId,
      mode: this.mode,
      command: ["node", "utils/run-checks.js", ...this.argv],
      jobs: this.jobs,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      source: { commit: this.source.commit, files: this.source.files, before: this.source.sha256, after: after.sha256,
        unchanged: after.sha256 === this.source.sha256 },
      catalog: { sha256: this.catalog, checks: this.catalogIds.length },
      selected: this.selected,
      environment: { node: process.version, platform: process.platform, arch: process.arch, host: os.hostname(),
        tooling: CheckSeal.tooling() },
      checks,
      totals: {
        selected: this.selected.length,
        executed: checks.filter(item => item.executed).length,
        cached: checks.filter(item => item.status === "cached").length,
        passed: checks.filter(item => item.status === "passed").length,
        failed: checks.filter(item => item.status === "failed").length,
        isolationViolations: checks.filter(item => item.isolationViolations).length,
      },
    };
  }

  write(report) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`);
    fs.renameSync(temporary, this.file);
  }
}

// Validates a gate report against the current tree and catalog; throws with every violated
// requirement. "acceptance": every check executed. "release-gate": only history replays with a
// reviewed snapshot policy may be cached; every other check executed.
class AcceptanceReportValidator {
  constructor({ projectRoot, catalog }) {
    this.projectRoot = path.resolve(projectRoot);
    this.catalog = catalog;
  }

  problems(report, { modes = ["acceptance"] } = {}) {
    const problems = [];
    const require = (condition, message) => { if (!condition) problems.push(message); };
    require(report && report.kind === REPORT_KIND && report.schemaVersion === REPORT_SCHEMA, "not a check run report v1");
    if (problems.length) return problems;
    require(modes.includes(report.mode), `mode is ${report.mode}, not ${modes.join(" or ")}`);
    const ids = this.catalog.map(check => check.id);
    const byId = new Map(this.catalog.map(check => [check.id, check]));
    const reusable = id => report.mode === "release-gate" && byId.get(id)?.cache.policy === "snapshot" &&
      canonical(byId.get(id).suites) === canonical(["history"]);
    require(canonical(report.selected) === canonical(ids), "selected checks are not the complete current catalog");
    const reported = report.checks.map(item => item.id);
    require(new Set(reported).size === reported.length, "duplicate check ids");
    require(canonical(reported) === canonical(ids), "reported checks differ from the current catalog");
    require(report.catalog?.sha256 === catalogSha256(this.catalog), "stale catalog");
    require(canonical(report.environment?.tooling) === canonical(CheckSeal.tooling()), "runner tooling changed since the run");
    for (const item of report.checks) {
      const reused = item.status === "cached" && item.executed === false && reusable(item.id);
      require(reused || (item.executed === true && item.status === "passed" && item.exitCode === 0),
        `${item.id} is ${item.status}${item.executed ? "" : " (not executed)"}`);
      require(!item.isolationViolations, `${item.id} violated its isolation contract`);
    }
    const totals = report.totals || {};
    const cached = report.checks.filter(item => item.status === "cached").length;
    require(totals.cached === (report.mode === "acceptance" ? 0 : cached) && totals.failed === 0 &&
      totals.isolationViolations === 0 && totals.executed === ids.length - totals.cached &&
      totals.passed === totals.executed, "totals are not a complete pass");
    require(report.source?.unchanged === true && report.source.before === report.source.after, "source drift during the run");
    const current = SourceSnapshot.of(this.projectRoot);
    require(report.source?.before === current.sha256, "the working tree differs from the tested source");
    require(report.source?.commit === current.commit, "HEAD differs from the tested commit");
    return problems;
  }

  assertValid(report, options) {
    const problems = this.problems(report, options);
    if (problems.length) throw new Error(`Check run report rejected:\n- ${problems.join("\n- ")}`);
    return report;
  }
}

module.exports = { AcceptanceReportValidator, CheckRunReport, SourceSnapshot, REPORT_KIND, REPORT_SCHEMA, catalogSha256 };
