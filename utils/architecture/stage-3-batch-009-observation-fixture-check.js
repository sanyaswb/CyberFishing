"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Batch009ObservationApplication } = require("./domain_batches/stage_three_batch_009_observation_application");
const { Batch009ObservationReconciliation, Batch009ObservationContract } = require("./domain_batches/stage_three_batch_009_observation_reconciliation");
const { Batch009ObservationManifestTransition, MANIFEST, OUTPUT } = require("./domain_batches/stage_three_batch_009_observation_transition");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { canonicalBytes } = require("./domain_batches/stage_three_pending_target_manifest");

async function run() {
const application = new Batch009ObservationApplication(path.resolve(__dirname, "../.."));
const protectedBefore = application.protectedSnapshot();
const prepared = await application.prepare();
const builder = new Batch009ObservationReconciliation();
const immutableInputs = canonicalBytes(prepared.inputs);
const positive = builder.build(prepared.inputs);
assert.deepEqual(canonicalBytes(prepared.inputs), immutableInputs, "Projector mutated its inputs");
const { prebuild, cutover, runtime } = prepared.inputs;
const transition = new Batch009ObservationManifestTransition({ prebuild, cutover, runtime });
assert.deepEqual(transition.reverse(canonicalBytes(prepared.manifest), prepared.artifact), canonicalBytes(prepared.inputs.before));
assert.equal(prepared.artifact.releaseClosureAuthorized, false);
assert.equal(prepared.artifact.guardedConsumers.length, 0, "No guarded consumer may be invented");
let failures = 0;
const reject = (action) => { assert.throws(action); failures += 1; };
const sourcePath = prebuild.preliminaryMetadata.targets[0].currentPath;
const targetPath = prebuild.preliminaryMetadata.targets[0].targetPath;
const source = (data) => data.observed.modules.find((item) => item.currentPath === sourcePath);
const target = (data) => data.observed.modules.find((item) => item.currentPath === targetPath);
const corrupt = (mutate) => {
  const input = structuredClone(prepared.inputs);
  mutate(input);
  reject(() => builder.build(input));
};
for (const mutate of [
  (data) => data.state.activeBatchId = null,
  (data) => data.state.activeBatchPhase = "prebuild",
  (data) => data.state.releaseVersion = "0.24.46",
  (data) => data.state.completedBatchIds.push(data.state.activeBatchId),
  (data) => data.observed.modules.pop(),
  (data) => data.observed.modules.reverse(),
  (data) => target(data).architecture.targetBoundary = "platform",
  (data) => target(data).architecture.targetPath = "src/unapproved.js",
  (data) => target(data).architecture.roles = ["dev-tool"],
  (data) => target(data).architecture.migrationWave += 1,
  (data) => target(data).analysis.blockers.items.push("invented-blocker"),
  (data) => target(data).observed.providers.status = "pending",
  (data) => target(data).observed.consumers.status = "partial",
  (data) => target(data).observed.providers.items.push({ symbol: "Extra", mechanism: "global-lexical", availability: "program-init" }),
  (data) => target(data).observed.environment.browserApis.push("document"),
  (data) => target(data).observed.environment.builtins.push("UnknownRuntime"),
  (data) => target(data).observed.environment.dynamicConstructs.push("eval"),
  (data) => target(data).analysis.dependencies.unresolved.push({ symbol: "CONFIG" }),
  (data) => source(data).architecture.roles = ["domain-behavior"],
  (data) => source(data).observed.legacyLoadOrder += 1,
  (data) => source(data).observed.providers.items[0].symbol = "NewGlobal",
  (data) => source(data).observed.providers.items[0].mechanism = "window-property",
  (data) => source(data).observed.providers.items[0].availability = "deferred",
  (data) => source(data).observed.consumers.items[0].accessRequirement = "guarded",
  (data) => source(data).analysis.dependencies.confirmed.push({ symbol: runtime.transport.symbol, target: targetPath }),
  (data) => data.observed.modules.find((item) => item.currentPath === "src/systems/fight_physics_system.js")
    .analysis.dependencies.confirmed.find((item) => item.symbol === "RodStrokeDistanceTracker").accessRequirement = "required",
  (data) => data.observed.modules.find((item) => item.currentPath === "src/systems/line_system.js")
    .analysis.dependencies.items.push({ target: "src/unreviewed.js", symbols: ["Unreviewed"], resolution: "confirmed" }),
  (data) => data.registry.bridges.pop(),
  (data) => data.registry.bridges.push(data.registry.bridges[0]),
  (data) => data.registry.bridges.find((item) => item.owner === prebuild.batchId).source = "src/extra_consumer.js",
  (data) => data.runtime.activationPositions.pop(),
  (data) => data.baseline.providers = data.baseline.providers.filter((item) => item.currentPath !== sourcePath),
  (data) => data.esm[0].observations.push({ mechanism: "dynamic-import", resolutionStatus: "dynamic-unresolved" }),
  (data) => data.esm[0].exports[0].kind = "default",
  (data) => data.esm[0].status = "failed",
  (data) => data.esm[0].externalIdentifiers.push("document"),
]) corrupt(mutate);

const contract = new Batch009ObservationContract(prebuild);
contract.validate(prepared.artifact, prepared.artifact);
for (const mutate of [
  (item) => item.status = "failed",
  (item) => item.releaseClosureAuthorized = true,
  (item) => item.lifecycle.batchCompleted = true,
  (item) => item.evidence[0].sha256 = "0".repeat(64),
  (item) => item.guards.failureCount = 1,
  (item) => item.removalDependencies.pop(),
  (item) => item.guardedConsumers = [{ source: "invented" }],
  (item) => item.metadataTransition.targets.pop(),
  (item) => item.transportUnresolved.createsProjectDependencyEdge = true,
]) {
  const artifact = structuredClone(prepared.artifact); mutate(artifact);
  reject(() => contract.validate(artifact, prepared.artifact));
}
for (const mutate of [
  (item) => item.manifestTransition.afterSha256 = "0".repeat(64),
  (item) => item.manifestTransition.records.pop(),
  (item) => item.manifestTransition.records[0].before.analysis.blockers.items.push("extra"),
  (item) => item.manifestTransition.records[0].afterSha256 = "0".repeat(64),
]) {
  const artifact = structuredClone(prepared.artifact); mutate(artifact);
  reject(() => transition.reverse(canonicalBytes(prepared.manifest), artifact));
}
reject(() => { positive.facts.metadataTransition = {}; });
reject(() => { prepared.artifact.totals.modules = 1; });

// Real two-file writes in an isolated temporary directory, never in the project.
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-009-observations-"));
try {
  const parent = path.join(fixtureRoot, "architecture/migration");
  fs.mkdirSync(parent, { recursive: true });
  const original = canonicalBytes(prepared.inputs.before);
  fs.writeFileSync(path.join(fixtureRoot, MANIFEST), original, { flag: "wx" });
  const writes = [{ relativePath: MANIFEST, bytes: canonicalBytes(prepared.manifest) },
    { relativePath: OUTPUT, bytes: canonicalBytes(prepared.artifact) }];
  for (const [phase, count] of [["after-staging", 0], ["after-replacement", 1], ["after-replacement", 2], ["after-final-validation", 2]]) {
    reject(() => new ControlledMetadataTransaction({ projectRoot: fixtureRoot,
      failureInjector: (event) => { if (event.phase === phase && event.count === count) throw new Error("injected"); } })
      .commit(writes, () => {
        assert.deepEqual(transition.reverse(fs.readFileSync(path.join(fixtureRoot, MANIFEST)),
          JSON.parse(fs.readFileSync(path.join(fixtureRoot, OUTPUT)))), original);
      }));
    assert.deepEqual(fs.readFileSync(path.join(fixtureRoot, MANIFEST)), original);
    assert.equal(fs.existsSync(path.join(fixtureRoot, OUTPUT)), false);
    assert.deepEqual(fs.readdirSync(parent), [path.basename(MANIFEST)], "Transaction leaked staging/backup files");
  }
  new ControlledMetadataTransaction({ projectRoot: fixtureRoot }).commit(writes, () => {
    assert.deepEqual(fs.readFileSync(path.join(fixtureRoot, MANIFEST)), writes[0].bytes);
    assert.deepEqual(fs.readFileSync(path.join(fixtureRoot, OUTPUT)), writes[1].bytes);
  });
} finally {
  const resolved = path.resolve(fixtureRoot);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert(path.basename(resolved).startsWith("cyber-fishing-009-observations-"));
  assert.notEqual(resolved, application.root);
  fs.rmSync(resolved, { recursive: true, force: true });
}
assert.deepEqual(application.protectedSnapshot(), protectedBefore, "Fixtures changed project bytes");
console.log(`Stage 3.9.7 fixtures PASS: ${failures} invalid input/evidence/transaction cases rejected; ` +
  "all four two-file rollback boundaries preserve exact bytes; immutable facts and frozen decisions.");
}
if (require.main === module) run().catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { run };
