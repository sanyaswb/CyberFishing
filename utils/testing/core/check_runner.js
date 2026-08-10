const path = require("node:path");
const { spawnSync } = require("node:child_process");

class CheckProcessExecutor {
  constructor({ projectRoot, nodePath = process.execPath } = {}) {
    this.projectRoot = projectRoot;
    this.nodePath = nodePath;
  }

  run(check) {
    const startedAt = Date.now();
    const result = spawnSync(
      this.nodePath,
      [path.join(this.projectRoot, check.file)],
      { cwd: this.projectRoot, stdio: "inherit" },
    );
    return {
      check,
      durationMs: Date.now() - startedAt,
      error: result.error || null,
      status: result.status ?? 1,
    };
  }
}

class CheckSuiteRunner {
  constructor({ executor }) {
    this.executor = executor;
  }

  run(checks) {
    const startedAt = Date.now();
    const results = [];

    for (const check of checks) {
      console.log(`\n[check] ${check.title}`);
      const result = this.executor.run(check);
      results.push(result);
      if (result.error) throw result.error;
      if (result.status !== 0) {
        process.exitCode = result.status;
        return results;
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log(`\nPassed ${results.length} checks in ${(durationMs / 1000).toFixed(2)}s.`);
    return results;
  }
}

module.exports = { CheckProcessExecutor, CheckSuiteRunner };
