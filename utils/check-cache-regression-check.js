"use strict";

// Cache v2 regression scenarios: real executions of the production runner, seal, tracer and report
// components in temporary fixture projects.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { CheckCatalog } = require("./testing/core/check_catalog");
const { CheckSuiteRunner, SealingCheckExecutor } = require("./testing/core/check_runner");
const { CheckSealStore, TOOLING } = require("./testing/core/check_seal");
const { AcceptanceReportValidator, CheckRunReport } = require("./testing/core/check_report");

const GIT = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";
const DATA_POLICY = { policy: "snapshot", inputPaths: ["data"], environmentKeys: [] };

class FixtureProject {
  constructor() {
    this.root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cyber-cache-fixture-")));
    this.log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cyber-cache-log-")), "events.log");
    this.write("package.json", "{\"name\":\"fixture\",\"version\":\"1.0.0\"}\n");
    this.write("package-lock.json", "{\"lockfileVersion\":3}\n");
    this.write(".gitignore", "node_modules/\n");
    this.write("node_modules/dep/index.js", "module.exports = { value: 1 };\n");
    this.write("utils/helper.js", "module.exports = { expected: \"a\" };\n");
    this.store = new CheckSealStore(this.root);
  }

  file(relative) { return path.join(this.root, ...relative.split("/")); }

  write(relative, content) {
    fs.mkdirSync(path.dirname(this.file(relative)), { recursive: true });
    fs.writeFileSync(this.file(relative), content);
  }

  // A check script; the body runs with `fs`, `path`, `root` and `log(label)` in scope.
  check(id, body) {
    this.write(`checks/${id}-check.js`, [
      "\"use strict\";",
      "const fs = require(\"node:fs\");",
      "const path = require(\"node:path\");",
      "const root = process.cwd();",
      `const log = label => fs.appendFileSync(${JSON.stringify(this.log)}, \`\${label} ${id} \${Date.now()}\\n\`);`,
      body,
      "",
    ].join("\n"));
    return { id, title: id, file: `checks/${id}-check.js`, suites: ["fixture"] };
  }

  async run(definitions, { mode = "use", jobs = 1, report = null } = {}) {
    const catalog = new CheckCatalog(definitions);
    const executor = new SealingCheckExecutor({ projectRoot: this.root, mode });
    const runReport = report && new CheckRunReport({ projectRoot: this.root, mode: report, argv: ["--fixture"], jobs,
      catalog: catalog.list(), file: path.join(path.dirname(this.log), "report.json") });
    const exitCode = process.exitCode;
    const log = console.log;
    const write = process.stdout.write;
    console.log = () => {};
    process.stdout.write = () => true;
    let results;
    try {
      results = await new CheckSuiteRunner({ executor, jobs, report: runReport }).run(catalog.list());
    } finally {
      console.log = log;
      process.stdout.write = write;
    }
    const failed = process.exitCode === 1;
    process.exitCode = exitCode;
    return { results, failed, catalog, report: runReport && JSON.parse(fs.readFileSync(runReport.file, "utf8")) };
  }

  async one(definition, options) {
    const { results, failed } = await this.run([definition], options);
    return { ...results[0], runFailed: failed };
  }

  git(...args) {
    const result = spawnSync(GIT, ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid",
      "-c", "core.autocrlf=false", ...args], { cwd: this.root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }

  remove() {
    fs.rmSync(this.root, { recursive: true, force: true });
    fs.rmSync(path.dirname(this.log), { recursive: true, force: true });
  }
}

const scenarios = [];
const scenario = (name, action) => scenarios.push({ name, action });
const executed = result => assert.equal(result.cached, false, "expected an execution");
const cached = result => assert.equal(result.cached, true, `expected a cached PASS: ${result.output}`);

scenario("1. unchanged reviewed inputs reuse an eligible PASS", async project => {
  project.write("data/a.txt", "a");
  const check = { ...project.check("read", "if (fs.readFileSync(path.join(root, \"data/a.txt\"), \"utf8\") !== \"a\") process.exit(1);"),
    cache: DATA_POLICY };
  const first = await project.one(check);
  executed(first);
  assert.equal(first.sealed, true, first.output);
  cached(await project.one(check));
});

scenario("2. a normal content read invalidates after a content change", async project => {
  project.write("data/a.txt", "a");
  const check = { ...project.check("read", "if (fs.readFileSync(path.join(root, \"data/a.txt\"), \"utf8\") !== \"a\") process.exit(1);"),
    cache: DATA_POLICY };
  await project.one(check);
  project.write("data/a.txt", "b");
  const second = await project.one(check);
  executed(second);
  assert.equal(second.status, 1);
});

scenario("3. file size and stat metadata changes cannot reuse the old PASS", async project => {
  project.write("data/size.txt", "1");
  const check = { ...project.check("stat", "if (fs.statSync(path.join(root, \"data/size.txt\")).size !== 1) process.exit(1);"),
    cache: DATA_POLICY };
  assert.equal((await project.one(check)).sealed, true);
  project.write("data/size.txt", "12345");
  const grown = await project.one(check);
  executed(grown);
  assert.equal(grown.status, 1, "the real check fails once the file grows");
  project.write("data/size.txt", "1");
  assert.equal((await project.one(check)).sealed, true);
  // Metadata only (same bytes): the recorded stat observation no longer holds.
  const later = new Date(Date.now() + 60_000);
  fs.utimesSync(project.file("data/size.txt"), later, later);
  const touched = await project.one(check);
  executed(touched);
  assert.equal(touched.status, 0);
});

scenario("4. root and recursive directory changes invalidate", async project => {
  project.write("data/nested/a.txt", "a");
  project.write("notes.txt", "n");
  const root = { ...project.check("root", [
    "const names = fs.readdirSync(root).filter(name => name !== \"node_modules\").sort().join(\",\");",
    "if (names !== \".gitignore,checks,data,notes.txt,package-lock.json,package.json,utils\") process.exit(1);",
  ].join("\n")), cache: DATA_POLICY };
  assert.equal((await project.one(root)).sealed, true);
  cached(await project.one(root));
  project.write("unexpected.txt", "x");
  const added = await project.one(root);
  executed(added);
  assert.equal(added.status, 1, "the real check fails with the unexpected root file");
  fs.rmSync(project.file("unexpected.txt"));
  assert.equal((await project.one(root)).sealed, true);
  fs.rmSync(project.file("notes.txt"));
  const removed = await project.one(root);
  executed(removed);
  assert.equal(removed.status, 1, "the real check fails without the removed root file");
  const recursive = { ...project.check("recursive", [
    "const entries = fs.readdirSync(path.join(root, \"data\"), { recursive: true }).map(name => name.replaceAll(\"\\\\\", \"/\")).sort();",
    "if (entries.join(\",\") !== \"nested,nested/a.txt\") process.exit(1);",
  ].join("\n")), cache: DATA_POLICY };
  assert.equal((await project.one(recursive)).sealed, true);
  cached(await project.one(recursive));
  project.write("data/nested/deeper/b.txt", "b");
  const deeper = await project.one(recursive);
  executed(deeper);
  assert.equal(deeper.status, 1);
});

scenario("5. read-then-write checks stay non-cacheable and observe initial input changes", async project => {
  project.write("data/state.txt", "0");
  const check = { ...project.check("counter", [
    "const file = path.join(root, \"data/state.txt\");",
    "const value = Number(fs.readFileSync(file, \"utf8\"));",
    "if (value > 5) process.exit(1);",
    "fs.writeFileSync(file, String(value + 1));",
  ].join("\n")), cache: DATA_POLICY };
  const first = await project.one(check);
  assert.equal(first.status, 0);
  assert.equal(first.sealed, false);
  assert(first.cacheReasons.some(reason => reason.startsWith("writes project paths")), first.cacheReasons.join("; "));
  project.write("data/state.txt", "9");
  const second = await project.one(check);
  executed(second);
  assert.equal(second.status, 1, "the changed initial input is observed");
});

scenario("6. check code, helper, args, policy, runner, environment and dependencies invalidate", async project => {
  project.write("data/a.txt", "a");
  const body = [
    "const helper = require(\"../utils/helper.js\");",
    "const dep = require(\"dep\");",
    "if (fs.readFileSync(path.join(root, \"data/a.txt\"), \"utf8\") !== helper.expected || dep.value !== 1) process.exit(1);",
  ].join("\n");
  const base = { ...project.check("deps", body),
    cache: { policy: "snapshot", inputPaths: ["data"], environmentKeys: ["CYBER_CACHE_FIXTURE_MODE"] } };
  const reseal = async (definition = base) => assert.equal((await project.one(definition)).sealed, true);
  const invalidated = async (definition, reason) => {
    const result = await project.one(definition);
    executed(result);
    assert.match(result.output, reason);
    return result;
  };
  await reseal();
  project.check("deps", `${body}\n// changed`);
  await invalidated(base, /read changed: checks\/deps-check\.js/u);
  project.write("utils/helper.js", "module.exports = { expected: \"a\" }; // changed\n");
  await invalidated(base, /read changed: utils\/helper\.js/u);
  await invalidated({ ...base, args: ["--extra"] }, /check definition or scope changed/u);
  await reseal();
  await invalidated({ ...base, cache: { ...base.cache, environmentKeys: [] } }, /check definition or scope changed/u);
  await reseal();
  const seal = project.store.load(base);
  project.store.save(base, { ...seal, environment: { ...seal.environment,
    tooling: { ...seal.environment.tooling, "utils/testing/core/check_runner.js": "0".repeat(64) } } });
  await invalidated(base, /environment changed: tooling/u);
  process.env.CYBER_CACHE_FIXTURE_MODE = "changed";
  try {
    await invalidated(base, /environment changed: variables/u);
  } finally {
    delete process.env.CYBER_CACHE_FIXTURE_MODE;
  }
  await reseal();
  project.write("node_modules/dep/index.js", "module.exports = { value: 1 }; // reinstalled\n");
  await invalidated(base, /read changed: node_modules\/dep\/index\.js/u);
  project.write("package-lock.json", "{\"lockfileVersion\":3,\"changed\":true}\n");
  await invalidated(base, /environment changed: lockfileSha256/u);
});

scenario("7. a source change during execution yields neither a seal nor an acceptance PASS", async project => {
  project.write("data/a.txt", "a");
  const check = { ...project.check("slow", [
    "fs.readFileSync(path.join(root, \"data/a.txt\"));",
    "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);",
  ].join("\n")), cache: DATA_POLICY };
  project.git("init", "-q");
  project.git("add", "-A");
  project.git("commit", "-q", "-m", "fixture");
  const edit = setTimeout(() => project.write("data/a.txt", "changed during execution"), 500);
  const { results, failed, report, catalog } = await project.run([check], { mode: "reseal", report: "acceptance" });
  clearTimeout(edit);
  assert.equal(results[0].sealed, false);
  assert(results[0].cacheReasons.some(reason => /changed during execution/u.test(reason)), results[0].cacheReasons.join("; "));
  assert.equal(report.source.unchanged, false);
  assert.equal(failed, true, "source drift fails the acceptance run");
  assert.throws(() => new AcceptanceReportValidator({ projectRoot: project.root, catalog: catalog.list() }).assertValid(report),
    /source drift during the run/u);
});

scenario("8. version 1, corrupt seals and unsupported observations execute", async project => {
  project.write("data/a.txt", "a");
  const check = { ...project.check("read", "fs.readFileSync(path.join(root, \"data/a.txt\"));"), cache: DATA_POLICY };
  const sealed = await project.one(check);
  assert.equal(sealed.sealed, true);
  const seal = project.store.load(check);
  project.store.save(check, { ...seal, environment: { ...seal.environment, schema: 1 } });
  assert.match((await project.one(check)).output, /seal schema is not 2/u);
  fs.writeFileSync(project.store.file(check), "{ corrupt");
  assert.match((await project.one(check)).output, /no seal/u);
  const shell = { ...project.check("shell", "require(\"node:child_process\").execSync(\"echo fixture\");"), cache: DATA_POLICY };
  const first = await project.one(shell);
  assert.equal(first.status, 0);
  assert.equal(first.sealed, false);
  assert(first.cacheReasons.some(reason => reason.startsWith("unsupported execSync")), first.cacheReasons.join("; "));
  executed(await project.one(shell));
  const git = { ...project.check("git", "require(\"node:child_process\").spawnSync(" +
    `${JSON.stringify(GIT)}, [\"rev-parse\", \"--verify\", \"refs/heads/absent\"], { cwd: root });`), cache: DATA_POLICY };
  const failedGit = await project.one(git);
  assert.equal(failedGit.sealed, false);
  assert(failedGit.cacheReasons.some(reason => /git .* is not certifiable/u.test(reason)), failedGit.cacheReasons.join("; "));
});

scenario("9. a failed execution removes its seal; a later PASS cannot hide it", async project => {
  project.write("data/a.txt", "a");
  project.write("data/mode.txt", "pass");
  const check = { ...project.check("mode", "if (fs.readFileSync(path.join(root, \"data/mode.txt\"), \"utf8\") !== \"pass\") process.exit(3);"),
    cache: DATA_POLICY };
  assert.equal((await project.one(check)).sealed, true);
  project.write("data/mode.txt", "fail");
  const failed = await project.one(check);
  assert.equal(failed.status, 3);
  assert.equal(failed.runFailed, true);
  assert.equal(project.store.load(check), null, "the failure removed the seal");
  project.write("data/mode.txt", "pass");
  const again = await project.one(check);
  executed(again);
  assert.match(again.output, /no seal/u);
});

scenario("10. acceptance rejects cached, missing, duplicate, stale-catalog and drifted reports", async project => {
  project.write("data/a.txt", "a");
  const first = { ...project.check("first", "fs.readFileSync(path.join(root, \"data/a.txt\"));"), cache: DATA_POLICY };
  const second = project.check("second", "");
  project.git("init", "-q");
  project.git("add", "-A");
  project.git("commit", "-q", "-m", "fixture");
  const { report, catalog, failed } = await project.run([first, second], { mode: "reseal", report: "acceptance" });
  assert.equal(failed, false);
  const validator = new AcceptanceReportValidator({ projectRoot: project.root, catalog: catalog.list() });
  validator.assertValid(report);
  const rejects = (mutate, pattern) => {
    const copy = JSON.parse(JSON.stringify(report));
    mutate(copy);
    assert.throws(() => validator.assertValid(copy), pattern);
  };
  rejects(copy => {
    Object.assign(copy.checks[0], { status: "cached", executed: false, exitCode: null });
    copy.totals.cached = 1;
    copy.totals.executed = 1;
    copy.totals.passed = 1;
  }, /first is cached \(not executed\)/u);
  rejects(copy => { copy.checks.pop(); }, /reported checks differ/u);
  rejects(copy => { copy.checks.push(copy.checks[0]); }, /duplicate check ids/u);
  rejects(copy => { copy.mode = "development"; }, /mode is development/u);
  const { report: development } = await project.run([first, second], { mode: "use", report: "development" });
  assert.equal(development.totals.cached, 1);
  assert.throws(() => validator.assertValid(development), /mode is development/u);
  // A release gate may reuse only reviewed history replays; every other check executes.
  const gateModes = { modes: ["release-gate"] };
  assert.throws(() => validator.assertValid({ ...development, mode: "release-gate" }, gateModes),
    /first is cached \(not executed\)/u);
  // A history-only replay newer than the history base runs in the fixture tree itself.
  const replay = { ...first, id: "stage-3-batch-999-replay", suites: ["history"] };
  const replayCatalog = new CheckCatalog([replay, second]).list();
  await project.run([replay, second], { mode: "use", report: "release-gate" });
  const { report: gate } = await project.run([replay, second], { mode: "use", report: "release-gate" });
  assert.deepEqual([gate.totals.cached, gate.totals.executed], [1, 1]);
  new AcceptanceReportValidator({ projectRoot: project.root, catalog: replayCatalog }).assertValid(gate, gateModes);
  assert.throws(() => new AcceptanceReportValidator({ projectRoot: project.root, catalog: replayCatalog }).assertValid(gate),
    /mode is release-gate, not acceptance/u);
  const grown = new AcceptanceReportValidator({ projectRoot: project.root,
    catalog: new CheckCatalog([first, second, { ...second, id: "third" }]).list() });
  assert.throws(() => grown.assertValid(report), /stale catalog/u);
  project.write("data/a.txt", "drift");
  assert.throws(() => validator.assertValid(report), /the working tree differs from the tested source/u);
});

scenario("11. conflicting checks are serialized and a failed parallel run stays failed", async project => {
  project.write("data/a.txt", "a");
  const counter = path.join(path.dirname(project.log), "flaky.count");
  const slow = "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);";
  const definitions = [
    { ...project.check("reader-a", `log("start"); ${slow} log("end");`), isolation: "read-only" },
    { ...project.check("writer", `log("start"); ${slow} fs.mkdirSync(path.join(root, "out"), { recursive: true });` +
      ` fs.writeFileSync(path.join(root, "out/x.txt"), "x"); log("end");`) },
    { ...project.check("reader-b", `log("start"); ${slow} log("end");`), isolation: "read-only" },
    { ...project.check("flaky", [
      `const counter = ${JSON.stringify(counter)};`,
      "const count = fs.existsSync(counter) ? Number(fs.readFileSync(counter, \"utf8\")) : 0;",
      "fs.writeFileSync(counter, String(count + 1));",
      "if (count === 0) process.exit(1);",
    ].join("\n")), isolation: "read-only", cache: DATA_POLICY },
    { ...project.check("undeclared", "fs.writeFileSync(path.join(root, \"data/side-effect.txt\"), \"x\");"), isolation: "read-only" },
  ];
  const { results, failed } = await project.run(definitions, { mode: "use", jobs: 4 });
  const events = fs.readFileSync(project.log, "utf8").trim().split("\n").map(line => line.split(" "));
  const span = id => events.filter(event => event[1] === id).map(event => Number(event[2]));
  const [writerStart, writerEnd] = span("writer");
  for (const id of ["reader-a", "reader-b"]) {
    const [start, end] = span(id);
    assert(end <= writerStart || start >= writerEnd, `${id} overlapped the exclusive writer`);
  }
  const flaky = results.find(result => result.check.id === "flaky");
  assert.equal(flaky.status, 1, "the parallel failure stands");
  assert.equal(flaky.diagnosticRetry.status, 0, "the diagnostic retry passed");
  assert.equal(project.store.load(flaky.check), null, "a diagnostic retry never seals");
  const undeclared = results.find(result => result.check.id === "undeclared");
  assert.deepEqual(undeclared.isolationViolations, ["write data/side-effect.txt"]);
  assert.equal(failed, true);
});

scenario("12. history reconstruction scope and tooling changes invalidate historical entries", async project => {
  for (const file of ["utils/testing/core/history_base.js", "utils/architecture/stage_three_batches/lifecycle/historical_workspace.js",
    "utils/testing/core/check_input_tracer.js", "utils/testing/core/check_seal.js", "utils/testing/core/check_runner.js"]) {
    assert(TOOLING.includes(file), `${file} is part of the tooling identity`);
  }
  project.write("data/a.txt", "a");
  const check = { ...project.check("replay", "fs.readFileSync(path.join(root, \"data/a.txt\"));"), cache: DATA_POLICY };
  assert.equal((await project.one(check)).sealed, true);
  const seal = project.store.load(check);
  project.store.save(check, { ...seal, identity: { ...seal.identity, scope: "history-base-0.24.63" } });
  assert.match((await project.one(check)).output, /check definition or scope changed/u);
  const current = project.store.load(check);
  project.store.save(check, { ...current, environment: { ...current.environment,
    tooling: { ...current.environment.tooling, "utils/testing/core/history_base.js": "0".repeat(64) } } });
  assert.match((await project.one(check)).output, /environment changed: tooling/u);
  // The reconstructed data tree is a reviewed input: any change to it invalidates the replay.
  project.write("data/reconstructed.json", "{}");
  assert.match((await project.one(check)).output, /reviewed input changed: data/u);
});

scenario("13. a path read as A, then B, then A again yields no seal", async project => {
  project.write("data/a.txt", "a");
  // The check and the scenario coordinate through marker files in the temporary directory, which the
  // tracer does not record; the reviewed input returns to its first bytes before the check ends.
  const signal = path.join(path.dirname(project.log), "signal-");
  const check = { ...project.check("revisit", [
    `const signal = ${JSON.stringify(signal)};`,
    "const waitFor = name => { const deadline = Date.now() + 20000;",
    "  while (!fs.existsSync(signal + name)) {",
    "    if (Date.now() > deadline) throw new Error(`timeout ${name}`);",
    "    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);",
    "  } };",
    "const read = () => fs.readFileSync(path.join(root, \"data/a.txt\"), \"utf8\");",
    "if (read() !== \"a\") process.exit(1);",
    "fs.writeFileSync(signal + \"read1\", \"\");",
    "waitFor(\"changed\");",
    "if (read() !== \"b\") process.exit(1);",
    "fs.writeFileSync(signal + \"read2\", \"\");",
    "waitFor(\"reverted\");",
    "if (read() !== \"a\") process.exit(1);",
  ].join("\n")), cache: DATA_POLICY };
  const steps = [["read1", "b", "changed"], ["read2", "a", "reverted"]];
  const poll = setInterval(() => {
    const [marker, content, answer] = steps[0] || [];
    if (!marker || !fs.existsSync(signal + marker)) return;
    project.write("data/a.txt", content);
    fs.writeFileSync(signal + answer, "");
    steps.shift();
  }, 20);
  let result;
  try {
    result = await project.one(check, { mode: "reseal" });
  } finally {
    clearInterval(poll);
  }
  assert.equal(steps.length, 0, "both input changes happened during the execution");
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.readFileSync(project.file("data/a.txt"), "utf8"), "a", "the input ends with its first bytes");
  assert.equal(result.sealed, false, "a revisited value must not be sealed");
  assert(result.cacheReasons.some(reason => /read data\/a\.txt changed during execution/u.test(reason)),
    result.cacheReasons.join("; "));
  assert.equal(fs.existsSync(project.store.file(check)), false, "no seal was stored");
});

scenario("14. a trace past its limit yields no seal and the check still executes", async project => {
  for (let index = 0; index < 40; index += 1) project.write(`data/file-${index}.txt`, `content ${index}`);
  const check = { ...project.check("wide", [
    "for (let index = 0; index < 40; index += 1) fs.readFileSync(path.join(root, `data/file-${index}.txt`));",
  ].join("\n")), cache: DATA_POLICY };
  const previous = process.env.CYBER_CHECK_TRACE_LIMIT_BYTES;
  process.env.CYBER_CHECK_TRACE_LIMIT_BYTES = "2000";
  let limited;
  try {
    limited = await project.one(check);
  } finally {
    if (previous === undefined) delete process.env.CYBER_CHECK_TRACE_LIMIT_BYTES;
    else process.env.CYBER_CHECK_TRACE_LIMIT_BYTES = previous;
  }
  assert.equal(limited.status, 0, limited.output);
  executed(limited);
  assert.equal(limited.sealed, false, "a truncated trace must not be sealed");
  assert(limited.cacheReasons.some(reason => /unsupported trace \(trace limit\)/u.test(reason)), limited.cacheReasons.join("; "));
  // The environment can only lower the limit: without it the same check seals.
  const full = await project.one(check);
  assert.equal(full.sealed, true, full.output);
});

(async () => {
  for (const { name, action } of scenarios) {
    const project = new FixtureProject();
    try {
      await action(project);
    } catch (error) {
      error.message = `${name}: ${error.message}`;
      throw error;
    } finally {
      project.remove();
    }
  }
  console.log(`Check cache regression passed: ${scenarios.length} scenarios (positive control, stat/root/recursive/read-write ` +
    "false hits, identity, drift, schema, failure, acceptance report, isolation, history invalidation, revisited " +
    "values and trace limit).");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
