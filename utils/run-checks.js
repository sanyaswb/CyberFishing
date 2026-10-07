"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { CHECK_DEFINITIONS } = require("./testing/suites/check_manifest");

const PROJECT_ROOT = path.resolve(__dirname, "..");

// Registry of checks; every utils/*-check.js file must be registered exactly once.
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
      if (!fs.existsSync(path.join(projectRoot, check.file))) throw new Error(`Check file does not exist: ${check.file}`);
      ids.add(check.id);
      files.add(check.file);
    }
    for (const name of fs.readdirSync(path.join(projectRoot, "utils"))) {
      if (name.endsWith("-check.js") && !files.has(`utils/${name}`)) {
        throw new Error(`Check is missing from the manifest: utils/${name}`);
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
        results[index] = await this.#execute(checks[index]);
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

  #execute(check) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(this.projectRoot, check.file)], { cwd: this.projectRoot });
      const chunks = [];
      child.stdout.on("data", (chunk) => chunks.push(chunk));
      child.stderr.on("data", (chunk) => chunks.push(chunk));
      const finish = (status, error = null) => resolve({ check, status, durationMs: Date.now() - startedAt,
        output: Buffer.concat(chunks).toString() + (error ? `${error.stack}\n` : "") });
      child.on("error", (error) => finish(1, error));
      child.on("close", (status) => finish(status ?? 1));
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

main(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
