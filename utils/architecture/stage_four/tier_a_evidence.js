"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StageThreeHotLoopSourceReview } = require("../review_queue/hot_loop_source_review");

const PROBE = path.join(__dirname, "class_trace_probe.js");
const EVIDENCE_DIRECTORY = "architecture/migration/stage_4/evidence";
const EVIDENCE_KIND = "cyber-fishing-stage-4-tier-a-evidence";
// Tier B (public-API parity) uses the same member review and method traces as tier A.
const KINDS = Object.freeze(["api-parity", "hot-loop", "save-round-trip"]);
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const withoutLocation = (items) => items.map(({ location, ...item }) => item);
// A scenario that never calls the class has one form, whether or not the class was resolvable in its context (a
// migrated class becomes visible through the cumulative-runtime exports of contexts that never use it).
const exercised = (scenarios) => Object.fromEntries(Object.entries(scenarios).map(([scenario, trace]) =>
  [scenario, Object.values(trace.calls).some((calls) => calls > 0) ? trace : { sha256: null, calls: {}, deltaTime: {} }]));

// Tier A evidence of one Stage 4 cluster (working rule 4). `capture` runs before apply and writes the baseline:
// per traced class, the static member review (body SHA-256, allocation sites, free identifiers, wall-clock,
// realm and typeof reads) and the ordered argument/result trace of every public method across the scenario
// checks, run twice to prove the trace is deterministic. `compare` runs on the applied tree: member bodies,
// allocations, time/realm/typeof reads and every scenario trace must be identical; free identifiers may only
// lose the symbols the record imports (classic globals become module bindings).
class StageFourTierAEvidence {
  constructor({ root, record, kind, classes, scenarios, sourceReview = new StageThreeHotLoopSourceReview() }) {
    assert(KINDS.includes(kind), `evidence kind must be one of ${KINDS.join(", ")}`);
    assert(classes.length > 0 && scenarios.length > 0, "classes and scenarios are required");
    this.root = path.resolve(root);
    this.record = record;
    this.kind = kind;
    this.classes = [...classes].sort();
    this.scenarios = [...scenarios];
    this.sourceReview = sourceReview;
    this.file = `${EVIDENCE_DIRECTORY}/${record.id}_${kind}.json`;
  }

  capture() {
    assert.equal(this.record.output, null, `cluster ${this.record.id} is already applied: capture runs before apply`);
    assert(!fs.existsSync(path.join(this.root, this.file)), `${this.file} exists (historical evidence is immutable)`);
    const evidence = this.#build("currentPath");
    assert.deepEqual(this.#build("currentPath").classes, evidence.classes, "scenario traces are not deterministic");
    for (const [name, item] of Object.entries(evidence.classes)) {
      assert(Object.values(item.scenarios).some((trace) => Object.values(trace.calls).some((calls) => calls > 0)),
        `${name}: no scenario exercises the class`);
    }
    fs.mkdirSync(path.join(this.root, EVIDENCE_DIRECTORY), { recursive: true });
    fs.writeFileSync(path.join(this.root, this.file), canonical(evidence));
    return evidence;
  }

  compare() {
    const baseline = JSON.parse(fs.readFileSync(path.join(this.root, this.file), "utf8"));
    assert.equal(baseline.kind, EVIDENCE_KIND);
    assert.deepEqual({ cluster: baseline.cluster, evidenceKind: baseline.evidenceKind, scenarios: baseline.scenarios },
      { cluster: this.record.id, evidenceKind: this.kind, scenarios: this.scenarios }, "evidence command differs");
    const current = this.#build(this.record.output ? "targetPath" : "currentPath");
    const imported = new Set(this.record.modules.flatMap((module) => (module.imports || []).map((item) => item.symbol)));
    const differences = [];
    for (const name of this.classes) {
      const before = baseline.classes[name];
      const after = current.classes[name];
      for (const key of ["members", "allocationTotals", "wallClockReads", "realmLookups", "scenarios"]) {
        const [left, right] = key === "scenarios" ? [exercised(before[key]), exercised(after[key])] : [before[key], after[key]];
        if (JSON.stringify(left) !== JSON.stringify(right)) differences.push(`${name}.${key}`);
      }
      // Free identifiers and typeof lookups of free identifiers may only lose the record's imported symbols.
      for (const key of ["freeIdentifiers", "typeofLookups"]) {
        if (!StageFourTierAEvidence.onlyLosesImports(before[key], after[key], imported)) differences.push(`${name}.${key}`);
      }
    }
    assert.deepEqual(differences, [], `tier A evidence differs from ${this.file}`);
    return { file: this.file, classes: this.classes.length,
      traces: Object.fromEntries(this.classes.map((name) => [name, current.classes[name].scenarios])) };
  }

  static onlyLosesImports(before, after, imported) {
    const remaining = new Set(after.map((item) => JSON.stringify(item)));
    const added = [...remaining].filter((item) => !before.some((old) => JSON.stringify(old) === item));
    const removed = before.filter((item) => !remaining.has(JSON.stringify(item)));
    return added.length === 0 && removed.every((item) => imported.has(item.name));
  }

  #build(location) {
    const sources = new Map();
    for (const module of this.record.modules) {
      const file = module[location];
      const source = fs.readFileSync(path.join(this.root, file), "utf8");
      const sourceType = location === "targetPath" ? "module" : "script";
      for (const name of this.classes) {
        if (sources.has(name)) continue;
        try {
          sources.set(name, this.sourceReview.review({ source, currentPath: file, className: name, sourceType,
            classScope: sourceType === "script" }));
        } catch (error) {
          if (!(error instanceof assert.AssertionError)) throw error;
        }
      }
    }
    const traces = Object.fromEntries(this.scenarios.map((scenario) => [scenario, this.#trace(scenario)]));
    const classes = Object.fromEntries(this.classes.map((name) => {
      const review = sources.get(name);
      assert(review, `class ${name} is not declared by a cluster module`);
      return [name, {
        sourcePath: review.currentPath,
        members: review.members,
        allocationTotals: review.allocationTotals,
        freeIdentifiers: withoutLocation(review.freeIdentifiers),
        wallClockReads: withoutLocation(review.wallClockReads),
        realmLookups: withoutLocation(review.realmLookups),
        typeofLookups: withoutLocation(review.typeofLookups),
        scenarios: exercised(Object.fromEntries(this.scenarios.map((scenario) => {
          const trace = traces[scenario][name] || { methods: {}, sha256: null };
          return [scenario, { sha256: trace.sha256,
            calls: Object.fromEntries(Object.entries(trace.methods).map(([method, stats]) => [method, stats.calls])),
            deltaTime: Object.fromEntries(Object.entries(trace.methods).filter(([, stats]) => stats.dtMin !== null)
              .map(([method, stats]) => [method, { minSeconds: stats.dtMin, maxSeconds: stats.dtMax }])) }];
        }))),
      }];
    }));
    return { schemaVersion: 1, kind: EVIDENCE_KIND, cluster: this.record.id, evidenceKind: this.kind,
      scenarios: this.scenarios, classes };
  }

  #trace(scenario) {
    const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cyber-class-trace-"));
    const output = path.join(directory, "trace.json");
    try {
      const result = spawnSync(process.execPath, ["--require", PROBE, scenario], { cwd: this.root, encoding: "utf8",
        env: { ...process.env, CYBER_CLASS_TRACE_OUTPUT: output, CYBER_CLASS_TRACE_CLASSES: JSON.stringify(this.classes) },
        maxBuffer: 64 * 1024 * 1024 });
      assert.equal(result.status, 0, `${scenario} failed under the trace probe:\n${result.stderr || result.stdout}`);
      return JSON.parse(fs.readFileSync(output, "utf8"));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}

module.exports = { EVIDENCE_DIRECTORY, EVIDENCE_KIND, StageFourTierAEvidence };
