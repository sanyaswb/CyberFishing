"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatchContext } = require("./batch_context");

const DEFINITIONS = path.resolve(__dirname, "../definitions");

// One continuation batch = a reviewed profile plus executable behavior cases (and optional
// fixtures). The definition validates that every batch-derived name in the profile agrees with the
// shared context, so no lifecycle code needs per-batch constants.
class StageThreeBatchDefinition {
  constructor({ number, profile, behavior, fixtures = {} }) {
    this.context = new StageThreeBatchContext(number);
    this.profile = profile.PREFLIGHT_PROFILE;
    this.execution = this.profile.executionProfile;
    this.release = profile.RELEASE;
    // Known-debt records this batch resolves (reviewed ids; empty when none).
    this.resolvedDebtIds = Object.freeze([...(profile.RESOLVED_DEBT_IDS || [])].sort());
    this.cases = behavior.EXECUTABLE_CASES;
    this.matrix = behavior.MATRIX;
    this.fixtures = fixtures;
    this.#validate();
    Object.freeze(this);
  }

  get id() { return this.execution.batchId; }

  #validate() {
    const context = this.context;
    const execution = this.execution;
    assert.equal(execution.batchNumber, context.number, "Profile batch number differs from its definition");
    assert.equal(execution.auditStageLabel, context.label(0));
    assert.equal(execution.executionStageLabel, context.label(1));
    assert.equal(execution.focusedStageId, `stage-${context.step(2)}`);
    assert.equal(execution.prebuildStageId, `stage-${context.step(3)}`);
    assert.equal(execution.sourceReleaseVersion, context.fromRelease);
    assert.equal(execution.targetReleaseVersion, context.toRelease);
    assert.equal(execution.auditPath, context.paths.audit);
    assert.equal(execution.executionPlanPath, context.paths.executionPlan);
    assert.equal(execution.testMatrixPath, context.paths.testMatrix);
    assert.equal(this.profile.sideEffectEvidence.path, context.paths.sideEffectReview);
    assert.equal(this.profile.stageLabel, context.label(0));
    assert.equal(execution.informationalDocumentsExcluded, true,
      "Continuation batches from 025 on exclude informational documents from release metadata");
    for (const field of ["title", "codename", "summary"]) {
      assert.equal(typeof this.release?.[field], "string", `release.${field} is required`);
    }
    assert(Array.isArray(this.release.notes) && this.release.notes.length > 0, "release.notes are required");
    assert(Array.isArray(this.release.changelog) && this.release.changelog.length > 0,
      "release.changelog is required");
    assert.equal(typeof this.release.smokeContext, "string", "release.smokeContext is required");
    for (const target of execution.expectedTargets) {
      for (const symbol of target.exports) {
        const cases = this.cases[symbol];
        assert(cases && Object.keys(cases).length > 0, `Missing behavior cases: ${symbol}`);
        assert.deepEqual(Object.keys(cases).sort(), [...this.matrix.behaviorCases[symbol]].sort(),
          `Matrix cases differ from executable cases: ${symbol}`);
      }
    }
    assert.deepEqual(Object.keys(this.cases).sort(),
      execution.expectedTargets.flatMap(target => target.exports).sort(), "Cases name an unknown export");
    assert(Array.isArray(this.matrix.compatibilityCases) && this.matrix.compatibilityCases.length > 0);
  }
}

class StageThreeBatchRegistry {
  static numbers() {
    if (!fs.existsSync(DEFINITIONS)) return [];
    return fs.readdirSync(DEFINITIONS, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^\d{3}$/u.test(entry.name))
      .map(entry => entry.name).sort();
  }

  static has(number) { return StageThreeBatchRegistry.numbers().includes(number); }

  static load(number) {
    assert(StageThreeBatchRegistry.has(number), `No shared batch definition: ${number}`);
    const directory = path.join(DEFINITIONS, number);
    const fixturesFile = path.join(directory, "fixtures.js");
    return new StageThreeBatchDefinition({
      number,
      profile: require(path.join(directory, "profile.js")),
      behavior: require(path.join(directory, "behavior_cases.js")),
      fixtures: fs.existsSync(fixturesFile) ? require(fixturesFile) : {},
    });
  }
}

module.exports = { StageThreeBatchDefinition, StageThreeBatchRegistry };
