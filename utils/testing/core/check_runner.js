const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { CheckInputFingerprints, CheckSeal, CheckSealStore, TRACER } = require("./check_seal");
const { HistoryBase, BASE } = require("./history_base");

class CheckProcessExecutor {
  constructor({ projectRoot, nodePath = process.execPath } = {}) {
    this.projectRoot = projectRoot;
    this.nodePath = nodePath;
  }

  run(check, { env = null, root = this.projectRoot } = {}) {
    const startedAt = Date.now();
    const result = spawnSync(
      this.nodePath,
      [path.join(root, check.file), ...(check.args || [])],
      { cwd: root, stdio: "inherit", ...(env ? { env } : {}) },
    );
    return {
      check,
      durationMs: Date.now() - startedAt,
      error: result.error || null,
      status: result.status ?? 1,
    };
  }

  // Runs one check with captured output (used by the parallel runner).
  runCaptured(check, { env = null, root = this.projectRoot } = {}) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const child = spawn(this.nodePath, [path.join(root, check.file), ...(check.args || [])],
        { cwd: root, ...(env ? { env } : {}) });
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      child.on("error", (error) => resolve({ check, durationMs: Date.now() - startedAt, error, status: 1, output }));
      child.on("close", (status) => resolve({ check, durationMs: Date.now() - startedAt, error: null,
        status: status ?? 1, output }));
    });
  }
}

// Seals passing checks by their traced inputs and skips a check whose seal still holds.
// mode "use": sealed checks are skipped; "reseal": every check runs and is sealed again.
// History-only checks of batches up to the history base run in the reconstructed base release.
class SealingCheckExecutor {
  constructor({ projectRoot, executor = new CheckProcessExecutor({ projectRoot }), mode = "use",
    store = new CheckSealStore(projectRoot) } = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.executor = executor;
    this.mode = mode;
    this.store = store;
    this.fingerprints = new Map();
    this.gitCache = new Map();
    this.basePromise = null;
  }

  async rootFor(check) {
    if (!HistoryBase.covers(check)) return { root: this.projectRoot, scope: "live" };
    if (!this.basePromise) this.basePromise = new HistoryBase(this.projectRoot).prepare();
    return { root: await this.basePromise, scope: `history-base-${BASE.release}` };
  }

  fingerprintsFor(root) {
    if (!this.fingerprints.has(root)) this.fingerprints.set(root, new CheckInputFingerprints(root));
    return this.fingerprints.get(root);
  }

  git(args) {
    const key = JSON.stringify(args);
    if (!this.gitCache.has(key)) {
      const result = spawnSync(process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git", args,
        { cwd: this.projectRoot });
      this.gitCache.set(key, crypto.createHash("sha256").update(result.stdout || "").digest("hex"));
    }
    return this.gitCache.get(key);
  }

  scoped(check, scope) { return { ...check, args: [...(check.args || [])], scope }; }

  // Returns null when the check is sealed, or the reason it must run.
  async reason(check) {
    const { root, scope } = await this.rootFor(check);
    if (this.mode === "reseal") return { reason: "reseal requested", root, scope };
    const seal = this.store.load(check);
    const reason = seal && seal.scope !== scope ? "execution scope changed" : CheckSeal.invalidation({ root,
      check: this.scoped(check, scope), seal, fingerprints: this.fingerprintsFor(root), git: args => this.git(args) });
    return { reason, root, scope, seal };
  }

  traceEnvironment(root) {
    const trace = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cyber-check-trace-")), "trace.jsonl");
    fs.writeFileSync(trace, "");
    const options = process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : "";
    return { trace, env: { ...process.env, NODE_OPTIONS: `${options}--require ${JSON.stringify(TRACER)}`,
      CYBER_CHECK_TRACE: trace, CYBER_CHECK_ROOT: root } };
  }

  record(check, { root, scope }, result, trace) {
    const text = fs.readFileSync(trace, "utf8");
    // Files this check wrote may have changed; their fingerprints are recomputed.
    this.fingerprints.delete(root);
    if (result.status === 0 && !result.error) {
      this.store.save(check, { ...CheckSeal.build({ root, check: this.scoped(check, scope), trace: text,
        fingerprints: this.fingerprintsFor(root), durationMs: result.durationMs }), scope });
    } else {
      this.store.remove(check);
    }
    fs.rmSync(path.dirname(trace), { recursive: true, force: true });
  }

  async execute(check, { captured }) {
    const decision = await this.reason(check);
    if (decision.reason === null) {
      return { check, durationMs: 0, error: null, status: 0, sealed: true,
        output: `[sealed] ${decision.scope}: inputs unchanged since ${decision.seal.sealedAt} (${decision.seal.inputs.length} inputs)\n` };
    }
    const { trace, env } = this.traceEnvironment(decision.root);
    const header = `[run] ${decision.scope}: ${decision.reason}\n`;
    if (!captured) process.stdout.write(header);
    const result = captured
      ? await this.executor.runCaptured(check, { env, root: decision.root })
      : this.executor.run(check, { env, root: decision.root });
    this.record(check, decision, result, trace);
    return { ...result, sealed: false, output: captured ? header + result.output : header };
  }

  // Paths a check read and wrote in its last sealed run (unknown when never sealed).
  footprint(check) {
    const seal = this.store.load(check);
    if (!seal) return null;
    return { scope: seal.scope, reads: seal.inputs.map((input) => input.path), writes: seal.writes };
  }
}

class CheckSuiteRunner {
  constructor({ executor }) {
    this.executor = executor;
  }

  run(checks) {
    if (this.executor instanceof SealingCheckExecutor) return this.#runSealed(checks);
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

  async #runSealed(checks) {
    const startedAt = Date.now();
    const results = [];
    for (const check of checks) {
      console.log(`\n[check] ${check.title}`);
      const result = await this.executor.execute(check, { captured: false });
      if (result.sealed) process.stdout.write(result.output);
      results.push(result);
      if (result.error) throw result.error;
      if (result.status !== 0) {
        process.exitCode = result.status;
        return results;
      }
    }
    const sealed = results.filter((result) => result.sealed).length;
    console.log(`\nPassed ${results.length} checks in ${((Date.now() - startedAt) / 1000).toFixed(2)}s.` +
      ` (${results.length - sealed} executed, ${sealed} sealed)`);
    return results;
  }
}

// Runs unsealed checks in parallel. Two checks conflict when one wrote a path the other read or
// wrote in its last sealed run (same execution scope); a check with no known footprint runs alone.
// Failed checks are retried once sequentially, so an unforeseen conflict never becomes a result.
class ParallelCheckSuiteRunner {
  constructor({ executor, jobs = 4 }) {
    this.executor = executor;
    this.jobs = jobs;
  }

  static conflicts(left, right) {
    if (!left || !right) return true;
    if (left.scope !== right.scope) return false;
    const touches = (writes, paths) => writes.some((write) => paths.some((item) =>
      item === write || item.startsWith(`${write}/`) || write.startsWith(`${item}/`)));
    return touches(left.writes, [...right.reads, ...right.writes]) || touches(right.writes, left.reads);
  }

  async run(checks) {
    const startedAt = Date.now();
    const results = new Map();
    const pending = [];
    for (const check of checks) {
      const decision = await this.executor.reason(check);
      if (decision.reason === null) {
        results.set(check.id, { check, sealed: true, status: 0 });
      } else {
        pending.push({ check, footprint: this.executor.footprint(check) });
      }
    }
    console.log(`[parallel] ${checks.length - pending.length} sealed, ${pending.length} to execute with ${this.jobs} jobs`);
    const running = new Map();
    const failed = [];
    await new Promise((resolve) => {
      const launch = () => {
        if (pending.length === 0 && running.size === 0) { resolve(); return; }
        for (let index = 0; index < pending.length && running.size < this.jobs; index++) {
          const candidate = pending[index];
          const blocked = [...running.values()].some((item) =>
            ParallelCheckSuiteRunner.conflicts(item.footprint, candidate.footprint));
          if (blocked) continue;
          pending.splice(index--, 1);
          running.set(candidate.check.id, candidate);
          this.executor.execute(candidate.check, { captured: true }).then((result) => {
            running.delete(candidate.check.id);
            console.log(`\n[check] ${candidate.check.title} (${(result.durationMs / 1000).toFixed(1)}s)`);
            process.stdout.write(result.output);
            if (result.status !== 0 || result.error) failed.push(candidate.check);
            else results.set(candidate.check.id, result);
            launch();
          });
        }
      };
      launch();
    });
    for (const check of failed) {
      console.log(`\n[retry sequentially] ${check.title}`);
      const result = await this.executor.execute(check, { captured: false });
      results.set(check.id, result);
    }
    const ordered = checks.map((check) => results.get(check.id));
    const failures = ordered.filter((result) => result.status !== 0);
    if (failures.length > 0) {
      for (const result of failures) console.log(`FAILED: ${result.check.title}`);
      process.exitCode = 1;
      return ordered;
    }
    const sealed = ordered.filter((result) => result.sealed).length;
    console.log(`\nPassed ${ordered.length} checks in ${((Date.now() - startedAt) / 1000).toFixed(2)}s.` +
      ` (${ordered.length - sealed} executed, ${sealed} sealed, ${this.jobs} jobs)`);
    return ordered;
  }
}

module.exports = { CheckProcessExecutor, CheckSuiteRunner, ParallelCheckSuiteRunner, SealingCheckExecutor };
