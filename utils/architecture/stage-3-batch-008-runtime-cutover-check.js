"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { StageThreeBatch008AtomicCutover, validateCutoverArtifact, OUTPUT } = require("./domain_batches/stage_three_batch_008_cutover");
const { Batch008CutoverHistory } = require("./domain_batches/stage_three_batch_008_cutover_history");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { StageThreeCompatibilityBuildApplication } = require("../build/build_stage_3_compat_runtime");
const { ClassicClassLoader, DomainBehaviorParityHarness } = require("./domain_batches/stage_three_batch_focused_harness");
const { BATCH_008_EXECUTABLE_CASES } = require("./domain_batches/stage_three_batch_008_behavior_cases");
const { BATCH_007_EXECUTABLE_CASES } = require("./domain_batches/stage_three_batch_007_behavior_cases");
const { snapshot } = require("./stage-3-batch-008-source-build-integration-check");
const ROOT = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(ROOT, file));
const json = (file) => JSON.parse(read(file));

async function run() {
  const before = snapshot();
  const artifact = json(OUTPUT);
  const prebuild = json("architecture/migration/stage_3_batch_008_prebuild_contract.json");
  const sourceBuild = json("architecture/migration/stage_3_batch_008_source_build_validation.json");
  validateCutoverArtifact(artifact, prebuild, sourceBuild);
  const replay = await new StageThreeBatch008AtomicCutover(ROOT).prepare({ replay: true });
  assert.deepEqual(canonicalBytes(replay.artifact), read(OUTPUT), "Cutover no longer reproduces from frozen inputs");
  for (const item of replay.writes) {
    const { beforeBatch008Observations, MANIFEST } = require("./domain_batches/stage_three_batch_008_observation_transition");
    const { beforeBatch008Release } = require("./domain_batches/stage_three_batch_008_release_transition");
    const bytes = item.relativePath === MANIFEST ? beforeBatch008Observations(read(MANIFEST), ROOT) :
      beforeBatch008Release(item.relativePath, read(item.relativePath), ROOT);
    assert.deepEqual(bytes, item.bytes, `Actual cutover delta differs: ${item.relativePath}`);
  }
  const report = await new StageThreeCompatibilityBuildApplication({ projectRoot: ROOT }).run();
  assert.equal(report.moduleCount, artifact.topology.counts.modules);
  assert.equal(report.activationCount, artifact.topology.counts.activations);
  const built = report.outputs.find((item) => item.kind === "cumulative-runtime");
  assert.equal(built.sha256, artifact.build.runtimeSha256);
  assert.deepEqual(built.projectModules, artifact.topology.projectModules);
  assert.deepEqual(built.virtualBuildModules, artifact.build.virtualBuildModules);
  const expectedOutputs = report.outputs.map((item) => item.path).sort();
  const runtime = json("architecture/migration/stage_3_compatibility_runtime.json");
  const actualOutputs = fs.readdirSync(path.join(ROOT, runtime.output.directory), { recursive: true, withFileTypes: true })
    .filter((item) => item.isFile()).map((item) => path.relative(ROOT, path.join(item.parentPath, item.name)).replaceAll("\\", "/")).sort();
  assert.deepEqual(actualOutputs, expectedOutputs, "Unexpected/missing live runtime output");
  const context = vm.createContext({});
  vm.runInContext(read(built.path).toString("utf8"), context, { timeout: 5000 });
  const transport = context[runtime.transport.symbol];
  assert.deepEqual(Object.keys(transport.modules).sort(), artifact.topology.projectModules);
  const activations = [...runtime.activationPositions].sort((a, b) => a.legacyScriptIndex - b.legacyScriptIndex || a.id.localeCompare(b.id));
  for (const item of activations) assert.equal(context[item.legacySymbol], undefined, "Early global exposure");
  for (const activation of activations) {
    assert.equal(context[activation.legacySymbol], undefined);
    vm.runInContext(read(`${runtime.output.directory}${activation.shimFile}`).toString("utf8"), context);
    assert.equal(context[activation.legacySymbol], transport.modules[activation.targetModule][activation.exportName]);
  }
  let cases = 0;
  for (const [batch, catalog] of [["007", BATCH_007_EXECUTABLE_CASES], ["008", BATCH_008_EXECUTABLE_CASES]]) {
    const proof = json(`architecture/migration/stage_3_batch_${batch}_source_build_validation.json`);
    for (const source of proof.sources) {
      const target = read(source.targetPath);
      assert.equal(fingerprint(target), source.targetSha256);
      const classic = target.toString("utf8").replace(`export class ${source.exportName}`, `class ${source.exportName}`);
      assert.equal(fingerprint(Buffer.from(classic)), source.sourceSha256);
      cases += new DomainBehaviorParityHarness().run({ exportName: source.exportName,
        classicClass: new ClassicClassLoader().load(classic, source.exportName, source.currentPath),
        esmClass: transport.modules[source.targetPath][source.exportName], cases: catalog[source.exportName] }).length;
    }
  }
  await assert.rejects(new StageThreeBatch008AtomicCutover(ROOT).run(), /read-only/u);
  assert.deepEqual(snapshot(), before, "Runtime verification changed repository bytes");
  console.log(`Stage 3.8.5 PASS: ${report.moduleCount}/${report.activationCount}/${artifact.topology.counts.bridges}; ` +
    `${cases} batch-007+008 behavior regressions on actual live bundle; exact shims, full topology and pending facts; release unchanged.`);
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
