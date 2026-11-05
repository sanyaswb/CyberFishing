"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { CHECK_DEFINITIONS } = require("./testing/suites/check_manifest");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PASS_LINE = /\b(?:passed?|ok)\b/iu;

// An async check that never settles empties the event loop and Node exits with 0 without running the rest of its body
// (incident I-9), so a pass needs both exit code 0 and a last stdout line that says so.
function reportsCompletion(stdout) {
  const lines = stdout.split(/\r?\n/u).filter((line) => line.trim());
  return lines.length > 0 && PASS_LINE.test(lines.at(-1));
}

// Registry of stable scenario IDs; discover checks recursively to reject orphaned tests.
class CheckCatalog {
  constructor(definitions, projectRoot) {
    this.checks = Object.freeze(definitions.map((definition) => Object.freeze({ ...definition })));
    this.#validate(projectRoot);
  }

  listSuites() {
    return [...new Set(this.checks.flatMap((check) => check.suites))].sort();
  }

  select({ check, suite }) {
    if (check) {
      const found = this.checks.find((item) => item.id === check);
      if (!found) throw new Error(`Unknown check: ${check}`);
      return [found];
    }
    const checks = suite === "all" ? this.checks : this.checks.filter((item) => item.suites.includes(suite));
    if (checks.length === 0) throw new Error(`Unknown or empty check suite: ${suite}`);
    return checks;
  }

  #validate(projectRoot) {
    const ids = new Set();
    const files = new Set();
    for (const check of this.checks) {
      if (!check.id || !check.title || !check.file) throw new Error("Every check requires id, title and file");
      if (ids.has(check.id)) throw new Error(`Duplicate check id: ${check.id}`);
      if (files.has(check.file)) throw new Error(`Duplicate check file: ${check.file}`);
      if (!fs.existsSync(path.join(projectRoot, check.file))) throw new Error(`Check file does not exist: ${check.file}`);
      ids.add(check.id);
      files.add(check.file);
    }
    // A registered but untracked check passes locally and fails on every clean checkout (v0.45.26..v0.45.43).
    const tracked = spawnSync("git", ["ls-files", "-z", "--", ...files], { cwd: projectRoot, encoding: "utf8" });
    if (tracked.status === 0) {
      const trackedFiles = new Set(tracked.stdout.split("\0"));
      for (const file of files) {
        if (!trackedFiles.has(file)) throw new Error(`Check file is not tracked by Git (stage it): ${file}`);
      }
    }
    const utilsRoot = path.join(projectRoot, "utils");
    const candidates = [
      ...fs.readdirSync(utilsRoot).map(name => `utils/${name}`),
      ...fs.readdirSync(path.join(utilsRoot, "checks"), { recursive: true })
        .map(name => `utils/checks/${name.replaceAll("\\", "/")}`),
    ];
    for (const file of candidates) {
      if ((file.endsWith("-check.js") || file.endsWith("/check-js.js")) && !files.has(file)) {
        throw new Error(`Check is missing from the manifest: ${file}`);
      }
    }
  }
}

// Runs each check in its own Node process; up to `jobs` at once, output printed in catalog order.
class CheckRunner {
  constructor({ projectRoot, jobs }) {
    this.projectRoot = projectRoot;
    this.jobs = jobs;
  }

  async run(checks) {
    const startedAt = Date.now();
    const results = new Array(checks.length);
    let next = 0;
    let printed = 0;
    const flush = () => {
      while (printed < checks.length && results[printed]) {
        const result = results[printed++];
        console.log(`\n[check] ${result.check.title} (${(result.durationMs / 1000).toFixed(1)}s)`);
        process.stdout.write(result.output);
      }
    };
    const worker = async () => {
      while (next < checks.length) {
        const index = next++;
        results[index] = await this.execute(checks[index]);
        flush();
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.jobs, checks.length) }, worker));
    const failures = results.filter((result) => result.status !== 0);
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(2);
    for (const result of failures) console.log(`FAILED: ${result.check.title}`);
    if (failures.length > 0) {
      console.log(`\nFailed ${failures.length} of ${results.length} checks in ${seconds}s.`);
      process.exitCode = 1;
    } else {
      console.log(`\nPassed ${results.length} checks in ${seconds}s.`);
    }
  }

  execute(check) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(this.projectRoot, check.file)], { cwd: this.projectRoot });
      const chunks = [];
      const stdoutChunks = [];
      child.stdout.on("data", (chunk) => { chunks.push(chunk); stdoutChunks.push(chunk); });
      child.stderr.on("data", (chunk) => chunks.push(chunk));
      const finish = (status, note = "") => resolve({ check, status, durationMs: Date.now() - startedAt,
        output: Buffer.concat(chunks).toString() + note });
      child.on("error", (error) => finish(1, `${error.stack}\n`));
      child.on("close", (status) => {
        if (status === 0 && !reportsCompletion(Buffer.concat(stdoutChunks).toString())) {
          finish(1, "Exit code 0, but the check did not report a pass on its last line: it hung or ended early (incident I-9).\n");
        } else finish(status ?? 1);
      });
    });
  }
}

function readOption(argv, option) {
  const index = argv.indexOf(option);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

// node utils/run-checks.js [--list | --check ID | --suite NAME] [--jobs N]
async function main(argv) {
  const catalog = new CheckCatalog(CHECK_DEFINITIONS, PROJECT_ROOT);
  if (argv.includes("--list")) {
    console.log(`Suites: all, ${catalog.listSuites().join(", ")}`);
    for (const check of catalog.checks) console.log(`${check.id.padEnd(34)} ${check.title}`);
    return;
  }
  const jobs = Number(readOption(argv, "--jobs") ?? 4);
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error("--jobs requires a positive integer");
  const checks = catalog.select({ check: readOption(argv, "--check"), suite: readOption(argv, "--suite") ?? "all" });
  await new CheckRunner({ projectRoot: PROJECT_ROOT, jobs }).run(checks);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { CheckRunner, reportsCompletion };
