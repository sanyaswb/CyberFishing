"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PendingTargetManifestTransition } = require("./stage_three_pending_target_manifest");
const { ActivationShimRenderer } = require("../../build/compat_runtime/activation_shim");
const { PATHS } = require("./stage_three_live_preflight");
const { serialize } = require("./stage_three_batch_014_planning");

class Batch014CandidateWorkspace {
  constructor() {
    this.parent = fs.realpathSync(os.tmpdir());
    this.root = fs.mkdtempSync(path.join(this.parent, "cyber-batch014-candidate-"));
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

  prepare(app, prebuild, projections, sideEffectReview) {
    const runtime = app.json(PATHS.runtimeContract);
    const approved = app.json(PATHS.approvedPlan);
    const future = { ...runtime, sideEffectReviews: [
      ...runtime.sideEffectReviews, sideEffectReview,
    ], activationPositions: [
      ...runtime.activationPositions, ...prebuild.preliminaryMetadata.plannedActivationPositions,
    ].sort((a, b) => a.id.localeCompare(b.id)) };
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
    const pending = new PendingTargetManifestTransition({
      policy: app.json("architecture/module_architecture.json"), prebuild,
      approvedBatch: approved.batches.find(batch => batch.id === prebuild.batchId),
    });
    const manifest = pending.add(app.bytes(PATHS.manifest));
    assert.deepEqual(pending.reverse(manifest), app.bytes(PATHS.manifest));
    this.write(PATHS.manifest, manifest);
    this.write(PATHS.runtimeContract, serialize(future));
    const registry = app.json(PATHS.bridgeRegistry);
    this.write(PATHS.bridgeRegistry, serialize({ ...registry, bridges: [
      ...registry.bridges, ...prebuild.preliminaryMetadata.plannedBridges,
    ].sort((a, b) => a.id.localeCompare(b.id)) }));
    this.write(PATHS.executionState, serialize({
      ...app.json(PATHS.executionState), activeBatchPhase: "runtime-active",
    }));
    this.write(PATHS.approvedPlan, app.bytes(PATHS.approvedPlan));
    const html = app.read(PATHS.index);
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
    assert(path.basename(resolved).startsWith("cyber-batch014-candidate-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

module.exports = { Batch014CandidateWorkspace };
