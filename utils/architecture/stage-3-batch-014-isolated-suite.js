"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

class Batch014IsolatedSuite {
  run(root = path.resolve(__dirname, "../.."), suite = "all", startIndex = 0) {
    const parent = fs.realpathSync(os.tmpdir());
    const temporary = fs.mkdtempSync(path.join(parent, "cyber-batch014-suite-"));
    const junction = path.join(temporary, "node_modules");
    try {
      fs.cpSync(root, temporary, { recursive: true, filter: source => {
        const relative = path.relative(root, source).replaceAll("\\", "/");
        return relative !== "node_modules" && !relative.startsWith("node_modules/");
      } });
      fs.symlinkSync(path.join(root, "node_modules"), junction, "junction");
      const env = { ...process.env, GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: temporary };
      const args = startIndex > 0 ? ["-e",
        `const {CHECK_DEFINITIONS}=require('./utils/testing/suites/check_manifest');` +
        `const {CheckProcessExecutor,CheckSuiteRunner}=require('./utils/testing/core/check_runner');` +
        `new CheckSuiteRunner({executor:new CheckProcessExecutor({projectRoot:process.cwd()})})` +
        `.run(CHECK_DEFINITIONS.slice(${startIndex}));`]
        : ["utils/run-checks.js", "--suite", suite];
      const result = spawnSync(process.execPath, args,
        { cwd: temporary, env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
      const output = `${result.stdout || ""}${result.stderr || ""}`;
      const summary = output.match(/Passed (\d+) checks in ([\d.]+)s\./u);
      if (result.status !== 0) {
        const lines = output.split(/\r?\n/u);
        console.error(lines.slice(-90).join("\n"));
        throw new Error(`Isolated ${suite} suite failed after ${lines.filter(line => line.startsWith("[check]")).length} checks`);
      }
      assert(summary, "Suite returned without a pass summary");
      console.log(`Isolated ${suite} suite PASS: ${summary[1]} checks in ${summary[2]}s.`);
      return { suite, passed: Number(summary[1]), seconds: Number(summary[2]) };
    } finally {
      if (fs.existsSync(junction)) fs.unlinkSync(junction);
      const resolved = fs.realpathSync(temporary);
      assert.equal(path.dirname(resolved), parent);
      assert(path.basename(resolved).startsWith("cyber-batch014-suite-"));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  try { new Batch014IsolatedSuite().run(undefined, process.argv[2] || "all",
    Number(process.argv[3] || 0)); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch014IsolatedSuite };
