const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { CheckCachePolicy, CheckObservationValues, CheckSeal, CheckSealStore, TRACER } = require("./check_seal");

class CheckProcessExecutor {
  constructor({ projectRoot, nodePath = process.execPath } = {}) {
    this.projectRoot = projectRoot;
    this.nodePath = nodePath;
  }

  // Runs one check and captures its output; with live, the output is also streamed as it arrives.
  run(check, { env = null, root = this.projectRoot, live = false } = {}) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const child = spawn(this.nodePath, [path.join(root, check.file), ...(check.args || [])],
        { cwd: root, ...(env ? { env } : {}) });
      const chunks = [];
      const collect = (stream) => (chunk) => {
        chunks.push(chunk);
        if (live) stream.write(chunk);
      };
      child.stdout.on("data", collect(process.stdout));
      child.stderr.on("data", collect(process.stderr));
      child.on("error", (error) => resolve({ check, durationMs: Date.now() - startedAt, error, status: 1,
        output: Buffer.concat(chunks).toString() }));
      child.on("close", (status) => resolve({ check, durationMs: Date.now() - startedAt, error: null,
        status: status ?? 1, output: Buffer.concat(chunks).toString() }));
    });
  }
}

// Executes checks under the input tracer and decides cache reuse (seal schema 2).
// mode "use": an eligible seal that still holds is reused; "reseal": every check executes and is
// sealed again when eligible; "none": every check executes and no seal is used or created.
// A failed execution always removes the check's seal. Archived history checks run at their tags.
class SealingCheckExecutor {
  constructor({ projectRoot, executor = new CheckProcessExecutor({ projectRoot }), mode = "use",
    store = new CheckSealStore(projectRoot) } = {}) {
    if (!["use", "reseal", "none"].includes(mode)) throw new Error(`Unknown seal mode: ${mode}`);
    this.projectRoot = path.resolve(projectRoot);
    this.executor = executor;
    this.mode = mode;
    this.store = store;
    this.values = new Map();
  }

  async prepare() {}

  location() { return { root: this.projectRoot, scope: "live" }; }

  valuesFor(root) {
    if (!this.values.has(root)) this.values.set(root, new CheckObservationValues(root));
    return this.values.get(root);
  }

  // Memoized observation values are discarded after any execution that wrote or did something
  // the tracer cannot follow.
  invalidate() {
    for (const values of this.values.values()) values.invalidate();
  }

  // Evaluated when the check is scheduled: { reason: null, seal } for a reusable PASS.
  decide(check) {
    const { root, scope } = this.location(check);
    if (this.mode === "reseal") return { root, scope, reason: "reseal requested" };
    if (this.mode === "none") return { root, scope, reason: "seals disabled" };
    const seal = this.store.load(check);
    const reason = CheckSeal.invalidation({ check, scope, root, seal, values: this.valuesFor(root) });
    return { root, scope, reason, seal };
  }

  cached(check, decision) {
    return { check, scope: decision.scope, cached: true, status: 0, error: null, durationMs: 0,
      sealedAt: decision.seal.sealedAt,
      output: `[cached] ${decision.scope}: seal of ${decision.seal.sealedAt} holds ` +
        `(${decision.seal.observations.length} observations, ${Object.keys(decision.seal.snapshot).length} reviewed inputs)\n` };
  }

  traceEnvironment(root) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-check-trace-"));
    const trace = path.join(directory, "trace.jsonl");
    fs.writeFileSync(trace, "");
    const options = process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : "";
    return { directory, trace, env: { ...process.env, NODE_OPTIONS: `${options}--require ${JSON.stringify(TRACER)}`,
      CYBER_CHECK_TRACE: trace, CYBER_CHECK_ROOT: root } };
  }

  // Isolation contract of a read-only check: no project writes and nothing the tracer cannot follow
  // except reads of external paths.
  static isolationViolations(check, events) {
    if (check.isolation !== "read-only") return [];
    const violations = [];
    for (const event of events) {
      if (event.kind === "write") violations.push(`write ${event.path}`);
      if (event.kind === "unsupported" && !(event.reason === "external path" && !event.mutating)) {
        violations.push(`unsupported ${event.op}${event.path ? ` ${event.path}` : ""}${event.reason ? ` (${event.reason})` : ""}`);
      }
    }
    return [...new Set(violations)];
  }

  async execute(check, decision, { live = false, seal = true } = {}) {
    const { root, scope } = decision;
    const policy = CheckCachePolicy.of(check);
    const snapshotBefore = CheckSeal.snapshot(policy, new CheckObservationValues(root));
    const { directory, trace, env } = this.traceEnvironment(root);
    const header = `[run] ${scope}: ${decision.reason}\n`;
    if (live) process.stdout.write(header);
    let result;
    let events;
    try {
      result = await this.executor.run(check, { env, root, live });
      events = CheckSeal.events(fs.readFileSync(trace, "utf8"));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
    const passed = result.status === 0 && !result.error;
    const after = new CheckObservationValues(root);
    const evaluation = passed
      ? CheckSeal.evaluate({ check, scope, root, events, values: after, snapshotBefore,
        snapshotAfter: CheckSeal.snapshot(policy, after), durationMs: result.durationMs })
      : { eligible: false, reasons: ["execution failed"], writes: [] };
    let sealed = false;
    if (passed && evaluation.eligible && this.mode !== "none" && seal) {
      this.store.save(check, evaluation.seal);
      sealed = true;
    } else if (!passed || (this.mode !== "none" && seal)) {
      this.store.remove(check);
    }
    if (events.some((event) => event.kind === "write" || event.kind === "unsupported")) this.invalidate();
    const isolationViolations = SealingCheckExecutor.isolationViolations(check, events);
    const reasons = evaluation.eligible && !sealed ? [seal ? "seals disabled" : "diagnostic retries never seal"]
      : evaluation.reasons || [];
    const cacheNote = sealed ? "[sealed]\n" : `[not sealed] ${reasons.slice(0, 3).join("; ")}` +
      `${reasons.length > 3 ? ` (+${reasons.length - 3} more)` : ""}\n`;
    const violationNote = isolationViolations.length
      ? `[isolation violated] ${isolationViolations.slice(0, 5).join("; ")}\n` : "";
    if (live) process.stdout.write(cacheNote + violationNote);
    return { ...result, scope, cached: false, sealed, cacheReasons: reasons, isolationViolations,
      trace: { writes: evaluation.writes || [], unsupported: events.filter((event) => event.kind === "unsupported") },
      output: `${header}${result.output}${cacheNote}${violationNote}` };
  }
}

// Runs checks in catalog order. Read-only checks run in up to `jobs` parallel processes; any other
// check runs alone. A cached PASS is revalidated when its check is scheduled. A failed parallel
// execution stays failed; its sequential diagnostic retry is reported separately.
class CheckSuiteRunner {
  constructor({ executor, jobs = 1, report = null, acceptance = false }) {
    this.executor = executor;
    this.jobs = jobs;
    this.report = report;
    this.acceptance = acceptance;
  }

  print(result, live) {
    if (!live) {
      console.log(`\n[check] ${result.check.title} (${(result.durationMs / 1000).toFixed(1)}s)`);
      process.stdout.write(result.output);
    } else if (result.cached) {
      process.stdout.write(result.output);
    }
  }

  async run(checks) {
    const startedAt = Date.now();
    this.report?.begin(checks);
    await this.executor.prepare(checks);
    const results = new Map();
    const running = new Set();
    const live = this.jobs === 1 || checks.length === 1;
    const drain = async () => { while (running.size > 0) await Promise.race(running); };
    for (const check of checks) {
      const exclusive = live || check.isolation !== "read-only";
      if (exclusive) await drain();
      while (running.size >= this.jobs) await Promise.race(running);
      if (live) console.log(`\n[check] ${check.title}`);
      const decision = this.executor.decide(check);
      if (decision.reason === null) {
        const result = this.executor.cached(check, decision);
        results.set(check.id, result);
        this.print(result, live);
        continue;
      }
      const task = this.executor.execute(check, decision, { live })
        .catch((error) => ({ check, scope: decision.scope, cached: false, status: 1, error, durationMs: 0,
          cacheReasons: ["runner error"], output: `[runner error] ${error.stack}
` }))
        .then((result) => {
          results.set(check.id, { ...result, parallel: !exclusive });
          this.print(result, live);
          running.delete(task);
        });
      running.add(task);
      if (exclusive) await drain();
    }
    await drain();
    const ordered = checks.map((check) => results.get(check.id));
    for (const result of ordered.filter((item) => item.parallel && item.status !== 0)) {
      console.log(`\n[diagnostic retry, the failure stands] ${result.check.title}`);
      const retry = await this.executor.execute(result.check, { ...this.executor.location(result.check),
        reason: "diagnostic retry of a failed parallel execution (never sealed)" }, { live: true, seal: false });
      result.diagnosticRetry = { status: retry.status, durationMs: retry.durationMs };
    }
    const failures = ordered.filter((result) => result.status !== 0 || result.error);
    const violations = ordered.filter((result) => result.isolationViolations?.length);
    const cached = ordered.filter((result) => result.cached).length;
    const report = this.report ? this.#finishReport(ordered) : null;
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(2);
    const counts = `${ordered.length - cached} executed, ${cached} cached, ${this.jobs} jobs`;
    for (const result of failures) console.log(`FAILED: ${result.check.title}`);
    for (const result of violations) console.log(`ISOLATION VIOLATED: ${result.check.title}`);
    if (report && !report.source.unchanged) console.log("SOURCE DRIFT: the working tree changed during the run");
    if (failures.length > 0 || violations.length > 0 || (report && !report.source.unchanged)) {
      console.log(`\nFailed ${failures.length} of ${ordered.length} checks in ${seconds}s (${counts}).`);
      process.exitCode = 1;
    } else {
      console.log(`\nPassed ${ordered.length} checks in ${seconds}s (${counts}).`);
    }
    return ordered;
  }

  #finishReport(ordered) {
    for (const result of ordered) this.report.add(result);
    const report = this.report.finish();
    this.report.write(report);
    console.log(`[report] ${report.mode}: ${this.report.file}`);
    return report;
  }
}

module.exports = { CheckProcessExecutor, CheckSuiteRunner, SealingCheckExecutor };
