"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PendingTargetManifestTransition } = require("../../domain_batches/stage_three_pending_target_manifest");
const { ActivationShimRenderer } = require("../../../build/compat_runtime/activation_shim");
const { ActivationRetirementProjection, RetiredActivationPlaceholder } =
  require("../../../build/compat_runtime/activation_retirement");
const { PATHS } = require("../../domain_batches/stage_three_live_preflight");
const { serialize } = require("./planning");
const { StageThreeApprovedPlanSource } = require("../../domain_batches/stage_three_approved_plan_source");

// Isolated temporary project copy in which the candidate target sources and metadata are built.
class StageThreeCandidateWorkspace {
  constructor(context) {
    this.prefix = context.tempPrefix("candidate");
    this.parent = fs.realpathSync(os.tmpdir());
    this.root = fs.mkdtempSync(path.join(this.parent, this.prefix));
    Object.defineProperty(this, "allocatedRoot", { value: this.root });
  }

  write(relative, bytes) {
    assert.equal(this.root, this.allocatedRoot);
    assert(!path.isAbsolute(relative) && !relative.includes("\\") &&
      relative.split("/").every(part => part && part !== "." && part !== ".."));
    const target = path.resolve(this.root, relative);
    assert.equal(path.relative(this.root, target).replaceAll("\\", "/"), relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }

  prepare(app, prebuild, projections, sideEffectReviews) {
    const runtime = app.json(PATHS.runtimeContract);
    const state = app.json(PATHS.executionState);
    const plan = new StageThreeApprovedPlanSource({ read: file => app.bytes(file) }).load(state);
    const approved = plan.document;
    const retiredActivations = retiredActivationsOf(runtime, prebuild);
    const retirement = new ActivationRetirementProjection();
    const future = retirement.contract({ ...runtime, sideEffectReviews: [
      ...runtime.sideEffectReviews, ...sideEffectReviews,
    ], activationPositions: [
      ...runtime.activationPositions, ...prebuild.preliminaryMetadata.plannedActivationPositions,
    ].sort((a, b) => a.id.localeCompare(b.id)) }, retiredActivations, prebuild.batchId);
    for (const source of prebuild.activeTopology.projectModules) this.write(source, app.bytes(source));
    for (const projection of projections) this.write(projection.targetPath, projection.targetSource);
    const renderer = new ActivationShimRenderer();
    const byProvider = new Map();
    for (const activation of future.activationPositions) {
      const shims = byProvider.get(activation.sourceProvider) || [];
      shims.push(renderer.render(activation, runtime.transport.symbol));
      byProvider.set(activation.sourceProvider, shims);
    }
    for (const [provider, shims] of byProvider) {
      this.write(provider, shims.join(""));
    }
    // A shared source keeps the shims of its active activations written above.
    const shared = ActivationRetirementProjection.sharedSources(runtime, retiredActivations);
    for (const { sourceProvider, activations } of RetiredActivationPlaceholder.byProvider(retiredActivations)) {
      if (!shared.has(sourceProvider)) this.write(sourceProvider, new RetiredActivationPlaceholder().renderProvider(activations));
    }
    const pending = new PendingTargetManifestTransition({
      policy: app.json("architecture/module_architecture.json"), prebuild,
      approvedBatch: approved.batches.find(batch => batch.id === prebuild.batchId),
    });
    const manifest = pending.add(app.bytes(PATHS.manifest));
    assert.deepEqual(pending.reverse(manifest), app.bytes(PATHS.manifest));
    this.write(PATHS.manifest, manifest);
    this.write(PATHS.runtimeContract, serialize(future));
    const registry = app.json(PATHS.bridgeRegistry);
    const retired = new Set(prebuild.plannedDelta.retiredBridgeIds || []);
    this.write(PATHS.bridgeRegistry, serialize({ ...registry, bridges: [
      ...registry.bridges.filter(record => !retired.has(record.id)), ...prebuild.preliminaryMetadata.plannedBridges,
    ].sort((a, b) => a.id.localeCompare(b.id)) }));
    this.write(PATHS.executionState, serialize({
      ...app.json(PATHS.executionState), activeBatchPhase: "runtime-active",
    }));
    this.write(PATHS.approvedPlan, app.bytes(PATHS.approvedPlan));
    for (const reference of plan.references) this.write(reference.path, app.bytes(reference.path));
    const html = retirement.index(app.read(PATHS.index), runtime.output.directory, retiredActivations, shared);
    assert.equal((html.match(/compat_runtime\.iife\.js/gu) || []).length, 1);
    this.write(PATHS.index, html);
    this.write("dist/stage-3-compat-runtime/previous-validated-output.txt", "previous validated output sentinel\n");
    return { future, manifest, html };
  }

  cleanup() {
    assert.equal(this.root, this.allocatedRoot);
    const resolved = fs.realpathSync(this.root);
    assert.equal(resolved, this.root);
    assert.equal(path.dirname(resolved), this.parent);
    assert(path.basename(resolved).startsWith(this.prefix));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

// The active activation contracts this batch retires, in prebuild order.
function retiredActivationsOf(runtime, prebuild) {
  return (prebuild.plannedDelta.retiredActivationIds || []).map(id => {
    const activation = runtime.activationPositions.find(item => item.id === id);
    assert(activation, `Retired activation is not active: ${id}`);
    return activation;
  });
}

module.exports = { StageThreeCandidateWorkspace, retiredActivationsOf };
