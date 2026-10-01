"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("../../domain_batches/controlled_metadata_transaction");
const { StageThreeReviewedEvaluationEffect } = require("../../domain_batches/stage_three_reviewed_evaluation_effect");
const { StageThreeGlobalExposureReview } = require("../../domain_batches/stage_three_global_exposure_review");
const { StageThreeBatchSourceObserver } = require("../../domain_batches/stage_three_batch_source_observer");
const { StageThreeReviewedTopLevelFunctions } = require("../../domain_batches/stage_three_reviewed_top_level_functions");
const { StageThreeReviewedFrozenDataConstants } = require("../../domain_batches/stage_three_reviewed_frozen_data_constants");
const { StageThreeReviewedLiteralConstants } = require("../../domain_batches/stage_three_reviewed_literal_constants");
const { RepresentationOnlyReviewedEsmTarget } = require("../../domain_batches/stage_three_reviewed_representation_target");
const { StageThreeApprovedPlanSource } = require("../../domain_batches/stage_three_approved_plan_source");
const { ModuleEvaluationEffectObserver } = require("../../../build/compat_runtime/cumulative_side_effect_gate");
const { serialize } = require("../../domain_batches/stage_three_live_preflight");
const { sha } = require("./planning");

const STATE = "architecture/migration/stage_3_execution_state.json";
const OBSERVABLE_ASSIGNMENT = location => [{ kind: "assignment", location, classification: "observable" }];

// The reviewed evaluation effect of one classic source: none, one exact legacy class exposure,
// private static literal Sets created during class definition (with an optional exposure), or
// top-level deeply frozen data tables (frozenDataConstants, batch 042).
function reviewedEffect(contract) {
  const exposure = contract.legacyExposure;
  if (contract.frozenDataConstants) {
    return { kind: "frozen-data-constants", bindings: contract.frozenDataConstants.bindings };
  }
  if (contract.privateStaticSets) {
    return { kind: "private-static-literal-sets", ...contract.privateStaticSets,
      exposure: exposure ? { symbol: exposure.symbol, location: exposure.location } : null };
  }
  if (!exposure) {
    return { kind: "effect-free",
      ...(contract.topLevelFunctions ? { topLevelFunctions: [...contract.topLevelFunctions] } : {}),
      ...(contract.literalConstants ? { literalConstants: [...contract.literalConstants] } : {}) };
  }
  const kinds = { "window-property": "guarded-window-class-exposure", "global-this-property": "global-this-class-exposure" };
  const kind = kinds[exposure.mechanism || "global-this-property"];
  assert(kind, `Unsupported legacy exposure mechanism: ${exposure.mechanism}`);
  return { kind, symbol: exposure.symbol, location: exposure.location };
}

// Stage 3.N.0 side-effect review: each classic source is effect-free or has exactly its reviewed
// class exposure, and every ESM target evaluates without effects except reviewed private static
// literal Sets. Other reviewer shapes (static tables, frozen constants, class families) are not
// supported here and fail explicitly.
class StageThreeSideEffectReview {
  constructor(root, definition) {
    this.root = path.resolve(root);
    this.definition = definition;
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  build() {
    const definition = this.definition;
    const PROFILE = definition.profile;
    const context = definition.context;
    for (const [source, contract] of Object.entries(PROFILE.reviewedContracts)) {
      for (const shape of ["frozenConstants", "frozenStaticFields", "classFamily", "numericTables"]) {
        assert(!contract[shape], `Unsupported reviewer shape ${shape} for ${source}: extend the shared side-effect review`);
      }
    }
    const state = this.json(STATE);
    const plan = new StageThreeApprovedPlanSource({ read: file => this.bytes(file) })
      .load(state, { adopting: PROFILE.executionProfile.continuationPlan });
    const approved = plan.document;
    const batch = approved.batches[context.completedBefore];
    assert.equal(batch.id, definition.id);
    assert.equal(batch.modules.length, PROFILE.executionProfile.expectedTargetCount);
    assert.equal(state.releaseVersion, context.fromRelease);
    assert.equal(state.activeBatchId, null);
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, context.completedBefore).map(item => item.id));
    const modules = batch.modules.map(module => {
      const reviewed = PROFILE.reviewedContracts[module.currentPath];
      assert(reviewed, `Missing reviewed contract: ${module.currentPath}`);
      const contract = reviewedEffect(reviewed);
      const source = this.bytes(module.currentPath).toString("utf8");
      const frozen = batch.sideEffectReviews.find(item => item.module === module.targetPath) || null;
      let review;
      if (contract.kind === "frozen-data-constants") {
        assert(frozen, `Missing frozen effect review: ${module.targetPath}`);
        review = new StageThreeReviewedFrozenDataConstants().review({ source, currentPath: module.currentPath,
          bindings: contract.bindings });
        assert.deepEqual(frozen.observations, review.freezeCallLocations.map(location =>
          ({ kind: "call", location, classification: "observable" })));
        assert.equal(frozen.status, "required-before-approved-freeze");
        assert.equal(frozen.requiredDecision, "approved-compatible-or-batch-deferred");
      } else if (contract.kind === "private-static-literal-sets") {
        assert(frozen, `Missing frozen effect review: ${module.targetPath}`);
        review = new StageThreeReviewedEvaluationEffect().privateStaticSets({ source, currentPath: module.currentPath,
          className: contract.className, bindings: contract.bindings, exposure: contract.exposure });
        assert.deepEqual(frozen.observations, [
          ...Object.values(contract.bindings).map(item =>
            ({ kind: "instantiation", location: item.location, classification: "observable" })),
          ...(contract.exposure ? OBSERVABLE_ASSIGNMENT(contract.exposure.location) : []),
        ]);
        assert.equal(frozen.status, "required-before-approved-freeze");
        assert.equal(frozen.requiredDecision, "approved-compatible-or-batch-deferred");
      } else if (contract.kind === "effect-free") {
        // A module without a frozen effect review must stay free of top-level effects; reviewed pure
        // function declarations are bindings, not effects.
        assert.equal(frozen, null);
        // Reviewed top-level literal constants (batch 045) are bindings as well.
        assert.deepEqual(new StageThreeBatchSourceObserver().observe(source, module.currentPath).topLevelEffects,
          [...new StageThreeReviewedTopLevelFunctions().review({ source, currentPath: module.currentPath,
            names: contract.topLevelFunctions || [] }),
          ...(contract.literalConstants ? new StageThreeReviewedLiteralConstants().review({ source,
            currentPath: module.currentPath, names: contract.literalConstants }) : [])].sort());
        review = { kind: "effect-free", currentPath: module.currentPath, sourceSha256: sha(source),
          ...(contract.topLevelFunctions ? { topLevelFunctions: contract.topLevelFunctions } : {}),
          ...(contract.literalConstants ? { literalConstants: contract.literalConstants } : {}) };
      } else {
        assert(frozen, `Missing frozen effect review: ${module.targetPath}`);
        review = contract.kind === "guarded-window-class-exposure"
          ? new StageThreeReviewedEvaluationEffect().windowExposure({ source,
            currentPath: module.currentPath, symbol: contract.symbol, location: contract.location })
          : new StageThreeGlobalExposureReview().review({ source,
            currentPath: module.currentPath, symbol: contract.symbol, location: contract.location });
        assert.deepEqual(frozen.observations, OBSERVABLE_ASSIGNMENT(contract.location));
        assert.equal(frozen.status, "required-before-approved-freeze");
        assert.equal(frozen.requiredDecision, "approved-compatible-or-batch-deferred");
      }
      assert.equal(review.sourceSha256, sha(source));
      return { currentPath: module.currentPath, targetPath: module.targetPath,
        sourceSha256: review.sourceSha256, contract, review,
        frozenEvidenceFingerprint: frozen?.evidenceFingerprint || null,
        frozenObservations: frozen?.observations || [],
        activations: batch.compatibility.newActivations.filter(item =>
          item.contract.sourceProvider === module.currentPath).map(item => item.contract),
      };
    });
    assert.equal(modules.reduce((sum, item) => sum + item.activations.length, 0),
      PROFILE.executionProfile.expectedActivationCount);
    assert.equal(modules.filter(item => item.contract.kind !== "effect-free").length, batch.sideEffectReviews.length);
    // The reviewed exposure is removed by the representation. Every ESM target evaluates without
    // effects, except the reviewed private static Set initializers and the top-level Object.freeze
    // calls of reviewed frozen data tables (approved-compatible).
    const imports = StageThreeApprovedPlanSource.reviewedImports(approved, [definition.id]);
    const project = module => {
      const moduleSource = this.bytes(module.currentPath).toString("utf8");
      const exports = PROFILE.executionProfile.expectedTargets
        .find(target => target.currentPath === module.currentPath).exports;
      const options = { source: moduleSource,
        currentPath: module.currentPath, targetPath: module.targetPath, exports,
        sourceSha256: sha(moduleSource), contract: PROFILE.reviewedContracts[module.currentPath],
        targetEvaluation: null, imports: imports[module.targetPath] || [] };
      // A reviewed evaluation effect is observed on the unpublished source to record it.
      const representation = new RepresentationOnlyReviewedEsmTarget();
      const targetSource = module.contract.kind === "private-static-literal-sets"
        ? representation.observationSource(options) : representation.project(options).targetSource;
      return new ModuleEvaluationEffectObserver().observe({ modulePath: module.targetPath, source: targetSource });
    };
    const withEffects = modules.filter(module => ["private-static-literal-sets", "frozen-data-constants"]
      .includes(module.contract.kind));
    const targetEvaluations = withEffects.map(module => {
      const observation = project(module);
      assert.equal(observation.classification, "needs-review");
      if (module.contract.kind === "frozen-data-constants") {
        // Each exported binding shifts by the `export ` token; nested freezes run inside the call.
        assert.equal((imports[module.targetPath] || []).length, 0);
        assert.deepEqual(observation.observations, Object.values(module.contract.bindings).map(item => {
          const [line, column] = item.location.split(":").map(Number);
          return { kind: "initializer-execution", classification: "needs-review",
            location: `${line}:${column + "export ".length}` };
        }).sort((left, right) => left.location.localeCompare(right.location)));
        return { module: module.targetPath, decision: "approved-compatible",
          evidenceFingerprint: observation.evidenceFingerprint, observations: observation.observations,
          exactEffect: `${module.review.freezeCallLocations.length} Object.freeze calls build ` +
            `${module.review.topLevelStatementCount} deeply frozen data tables from literals and earlier ` +
            "bindings of the same module; no external state read or global write" };
      }
      // The import header (one line per import plus a blank line) shifts target line numbers.
      const importLines = (imports[module.targetPath] || []).length;
      const shift = importLines === 0 ? 0 : importLines + 1;
      assert.deepEqual(observation.observations.map(item => [item.kind, item.location]),
        Object.values(module.contract.bindings).map(item => {
          const [line, column] = item.location.split(":").map(Number);
          return ["initializer-execution", `${line + shift}:${column}`];
        }));
      return { module: module.targetPath, decision: "approved-compatible",
        evidenceFingerprint: observation.evidenceFingerprint, observations: observation.observations,
        exactEffect: "one private static Set of string literals created during class definition; unreachable from outside the class; no external state read or global write" };
    }).sort((left, right) => left.module.localeCompare(right.module));
    const targetEffectFree = modules.filter(module => !withEffects.includes(module)).map(module => {
      const observation = project(module);
      assert.equal(observation.classification, "safe");
      assert.deepEqual(observation.observations, []);
      return { module: module.targetPath, classification: observation.classification,
        evidenceFingerprint: observation.evidenceFingerprint };
    }).sort((left, right) => left.module.localeCompare(right.module));
    return {
      schemaVersion: 1, kind: context.kind("side-effect-review"),
      batchId: definition.id, stage: context.step(0), status: "reviewed-compatible",
      sourceReleaseVersion: state.releaseVersion,
      inputs: [...plan.references, { path: STATE, sha256: sha(this.bytes(STATE)) }],
      modules, targetEvaluation: null,
      ...(targetEffectFree.length > 0 ? { targetEffectFree } : {}),
      ...(targetEvaluations.length > 0 ? { targetEvaluations } : {}),
      cutoverAllowedByThisReviewAlone: false,
      nextGate: `stage-${context.step(0)}-live-preflight-and-graph-audit`,
    };
  }

  run() {
    const output = this.definition.context.paths.sideEffectReview;
    const bytes = serialize(this.build());
    const target = path.join(this.root, output);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes, "Frozen effect review drift");
    else new ControlledMetadataTransaction({ projectRoot: this.root }).commit([{ relativePath: output, bytes }],
      () => assert.deepEqual(fs.readFileSync(target), bytes));
    return { path: output, sha256: sha(bytes) };
  }
}

module.exports = { StageThreeSideEffectReview, reviewedEffect };
