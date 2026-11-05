"use strict";

// TK-215 (incident I-9): a check whose async body never settles empties the event loop and Node exits with code 0, so the
// runner must not take the exit code alone as a pass: the last line of stdout has to say so.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CheckRunner, reportsCompletion } = require("../../run-checks.js");

(async () => {
  assert.equal(reportsCompletion("Asset load plan passed: validation rules\n"), true);
  assert.equal(reportsCompletion("step one\nCheck ok\n\n"), true, "the last non-empty line counts");
  assert.equal(reportsCompletion(""), false, "no output is not a pass");
  assert.equal(reportsCompletion("first part passed\nstep two\n"), false, "an earlier line does not count");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-check-runner-"));
  try {
    const fixture = (name, body) => {
      fs.writeFileSync(path.join(dir, name), body);
      return { id: name, title: name, file: name };
    };
    const runner = new CheckRunner({ projectRoot: dir, jobs: 1 });
    const hung = await runner.execute(fixture("hung.js",
      "(async () => { await new Promise(() => {}); console.log('fixture passed'); })();"));
    assert.equal(hung.status, 1, "a check that never settled fails although Node exits with 0");
    assert.match(hung.output, /did not report a pass/u, "the output says why");
    const passed = await runner.execute(fixture("passed.js", "console.log('fixture passed');"));
    assert.equal(passed.status, 0, "a finished check passes");
    const failed = await runner.execute(fixture("failed.js", "console.log('fixture passed'); process.exit(3);"));
    assert.equal(failed.status, 3, "the exit code of a failing check is kept");
    const warning = await runner.execute(fixture("warning.js", "console.log('fixture passed'); console.error('a warning');"));
    assert.equal(warning.status, 0, "stderr after the pass line does not hide it");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("Check runner passed: a hung check fails, the pass line is the last line of stdout, exit codes are kept.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
