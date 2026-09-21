"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { serialize, PATHS } = require("./stage_three_batch_009_planning");
const { PendingTargetManifestTransition } = require("./stage_three_pending_target_manifest");
const { ActivationShimRenderer } = require("../../build/compat_runtime/activation_shim");
const { StageThreeRuntimeScriptAliasResolver } = require("../migration/stage_three_runtime_script_alias_resolver");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");

// Disposable candidate files. This class has no write API for the real checkout.
class Batch009CandidateWorkspace {
  constructor() {
    this.parent = fs.realpathSync(os.tmpdir());
    this.root = fs.mkdtempSync(path.join(this.parent, "cyber-batch009-candidate-"));
    Object.defineProperty(this, "allocatedRoot", { value: this.root, writable: false });
  }
  write(relative, bytes) {
    assert.equal(this.root, this.allocatedRoot, "Candidate root changed");
    assert(!path.isAbsolute(relative) && !relative.includes("\\") && !relative.split("/").some(p => ["", ".", ".."].includes(p)));
    const target = path.resolve(this.root, relative);
    assert.equal(path.relative(this.root, target).replaceAll("\\", "/"), relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  prepare(app, prebuild, projections) {
    const runtime = app.json(PATHS.runtimeContract), approved = app.json(PATHS.approvedPlan);
    const future = { ...runtime, activationPositions: [...runtime.activationPositions,
      ...prebuild.preliminaryMetadata.plannedActivationPositions].sort((a, b) => a.id.localeCompare(b.id)) };
    for (const source of prebuild.activeTopology.projectModules) this.write(source, app.bytes(source));
    for (const m of projections) this.write(m.targetPath, m.targetSource);
    const renderer = new ActivationShimRenderer();
    for (const a of future.activationPositions) this.write(a.sourceProvider, renderer.render(a, runtime.transport.symbol));
    const pending = new PendingTargetManifestTransition({ policy: app.json("architecture/module_architecture.json"), prebuild,
      approvedBatch: approved.batches.find(b => b.id === prebuild.batchId) });
    const manifest = pending.add(app.bytes(PATHS.manifest));
    assert.deepEqual(pending.reverse(manifest), app.bytes(PATHS.manifest));
    this.write(PATHS.manifest, manifest);
    this.write(PATHS.runtimeContract, serialize(future));
    this.write(PATHS.bridgeRegistry, serialize({ ...app.json(PATHS.bridgeRegistry), bridges: [
      ...app.json(PATHS.bridgeRegistry).bridges, ...prebuild.preliminaryMetadata.plannedBridges].sort((a, b) => a.id.localeCompare(b.id)) }));
    this.write(PATHS.executionState, serialize({ ...JSON.parse(fs.readFileSync(path.join(app.root, PATHS.executionState))), activeBatchPhase: "runtime-active" }));
    this.write(PATHS.approvedPlan, app.bytes(PATHS.approvedPlan));
    const html = this.relocate(app.read("index.html"), future, prebuild.runtimeRelocation.afterLogicalPosition);
    this.write("index.html", html);
    // Deliberately non-empty prior output: every success/failure must preserve it.
    this.write("dist/stage-3-compat-runtime/previous-validated-output.txt", "previous validated output sentinel\n");
    return { future, manifest, html };
  }
  relocate(html, contract, position) {
    const runtimePath = contract.output.directory + contract.output.runtimeFile;
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/giu)];
    const matches = tags.filter(t => t[1].split(/[?#]/u)[0] === runtimePath);
    assert.equal(matches.length, 1, "Expected one existing cumulative runtime tag");
    const runtimeTag = matches[0][0];
    assert(!/\b(?:async|defer|type)\s*(?:=|>)/iu.test(runtimeTag));
    const aliases = new StageThreeRuntimeScriptAliasResolver().resolve(contract);
    const reader = new LegacyScriptOrderReader("unused", { scriptAliases: aliases });
    const baseline = reader.parse(html), target = baseline.find(s => s.legacyLoadOrder === position);
    assert(target, "Approved earliest logical position missing");
    const targetTag = tags.find(t => t[1] === target.source)[0];
    const candidate = html.replace(runtimeTag, "").replace(targetTag, `${runtimeTag}\n    ${targetTag}`);
    assert.deepEqual(reader.parse(candidate), baseline, "Relocation changed logical script topology");
    assert.equal([...candidate.matchAll(/<script\b/giu)].length, tags.length);
    assert(candidate.indexOf(runtimeTag) < candidate.indexOf(targetTag));
    assert.equal(candidate.slice(candidate.indexOf(runtimeTag) + runtimeTag.length, candidate.indexOf(targetTag)).trim(), "");
    return candidate;
  }
  cleanup() {
    assert.equal(this.root, this.allocatedRoot, "Cleanup target differs from exact allocated workspace");
    const resolved = fs.realpathSync(this.root);
    assert.equal(resolved, this.root);
    assert.equal(path.dirname(resolved), this.parent);
    assert(path.basename(resolved).startsWith("cyber-batch009-candidate-"));
    assert.notEqual(resolved, this.parent);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
module.exports = { Batch009CandidateWorkspace };
