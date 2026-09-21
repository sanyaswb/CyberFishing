"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { StageThreeBatch008LiveValidation, StageThreeBatch008LiveValidationContract, OUTPUT } =
  require("./domain_batches/stage_three_batch_008_live_validation");
const { EagerClassModuleEvaluationProbe } = require("./domain_batches/eager_class_module_evaluation_probe");
const { CumulativeLiveActivationProbe } = require("./domain_batches/cumulative_live_activation_probe");
const { StageThreeBatch008StateProbe } = require("./domain_batches/stage_three_batch_008_state_probe");
const { RepresentationEquivalenceGuard } = require("./domain_batches/stage_three_batch_focused_harness");
const { snapshot } = require("./stage-3-batch-008-source-build-integration-check");

const root = path.resolve(__dirname, "../..");
const read = (file) => new (require("./domain_batches/stage_three_batch_009_cutover_history").Batch009CutoverHistory)(root)
  .before(file,fs.readFileSync(path.join(root,file)));
const json = (file) => JSON.parse(read(file));
const before = snapshot();
const observed = new StageThreeBatch008LiveValidation(root).run();
const validator = new StageThreeBatch008LiveValidationContract();
validator.validate(json(OUTPUT), observed);
let negatives = 0;
const reject = (action, pattern) => { assert.throws(action, pattern); negatives += 1; };
const altered = (mutate) => {
  const invalid = structuredClone(observed);
  mutate(invalid);
  reject(() => validator.validate(invalid, observed), /independently replayed/);
};
for (const mutate of [
  (item) => item.schemaVersion = 2,
  (item) => item.lifecycle.batchCompleted = true,
  (item) => item.lifecycle.activeBatchPhase = "prebuild",
  (item) => item.releaseVersion = "0.24.45",
  (item) => item.evaluation.modules[0].moduleEvaluationCount = 2,
  (item) => item.evaluation.modules[0].classInitializationCount = 0,
  (item) => item.evaluation.modules.pop(),
  (item) => item.runtime.projectModules.push("src/game/future.js"),
  (item) => item.runtime.activationTiming[0].globalAbsentBeforeActivation = false,
  (item) => item.runtime.activationTiming[0].legacyScriptIndex += 1,
  (item) => item.runtime.activationTiming[0].globalExactAfterActivation = false,
  (item) => item.state.lineSpool.ownerIdentityPreserved = false,
  (item) => item.state.actualLineSystem.spoolConstructions = 2,
  (item) => item.state.tracker.frozenResult = false,
  (item) => item.state.policy.freshResultPerCall = false,
  (item) => item.performance.modules[0].additionalMigrationAllocationSites = 1,
  (item) => item.performance.transportReadsDuringBehaviorStateAndConsumers = 1,
  (item) => item.consumers.pop(),
  (item) => item.behavior.cases.pop(),
  (item) => item.evidence[0].sha256 = "0".repeat(64),
  (item) => item.unreviewedClaim = true,
]) altered(mutate);
reject(() => observed.state.lineSpool.owner = "another-owner", TypeError);
reject(() => observed.evidence.push({}), TypeError);

const runtime = json("architecture/migration/stage_3_compatibility_runtime.json");
const sourceBuild = json("architecture/migration/stage_3_batch_008_source_build_validation.json");
const runtimePath = `${runtime.output.directory}${runtime.output.runtimeFile}`;
const code = read(runtimePath).toString("utf8");
const probe = new EagerClassModuleEvaluationProbe();
reject(() => probe.run(code, runtime.transport.symbol, sourceBuild.sources, { executions: 2 }), /more\/less than once/);
reject(() => probe.run(code, runtime.transport.symbol, sourceBuild.sources, { executions: 0 }), /more\/less than once/);
reject(() => probe.run(code, runtime.transport.symbol, [...sourceBuild.sources, sourceBuild.sources[0]]), /share a probe binding/);
reject(() => probe.run(code.replace('"src/game/domain/fishing/line_spool_state.js":',
  '"src/game/domain/fishing/unapproved.js":'), runtime.transport.symbol, sourceBuild.sources), /Non-unique module record/);
reject(() => probe.run(code.replace("var LineSpoolState = class {", "var LineSpoolState = function() {"),
  runtime.transport.symbol, sourceBuild.sources));

const activationInput = { code, runtime, index: read("index.html").toString("utf8"), read,
  projectModules: observed.runtime.projectModules };
reject(() => new CumulativeLiveActivationProbe().run({ ...activationInput,
  code: `${code}\nglobalThis.LineSpoolState = globalThis.${runtime.transport.symbol}.modules["src/game/domain/fishing/line_spool_state.js"].LineSpoolState;` }), /Early transport dependency/);
const wrongPosition = structuredClone(runtime);
wrongPosition.activationPositions.find((item) => item.exportName === "LineSpoolState").legacyScriptIndex += 1;
reject(() => new CumulativeLiveActivationProbe().run({ ...activationInput, runtime: wrongPosition }), /moved logical position/);
const duplicate = structuredClone(runtime);
duplicate.activationPositions.push(duplicate.activationPositions[0]);
reject(() => new CumulativeLiveActivationProbe().run({ ...activationInput, runtime: duplicate }), /Duplicate activation ID/);
reject(() => new CumulativeLiveActivationProbe().run({ ...activationInput,
  read: (file) => file.endsWith("090_linespoolstate.js") ? Buffer.from("globalThis.LineSpoolState = class Fake {};") : read(file) }));

const source = sourceBuild.sources.find((item) => item.exportName === "LineSpoolState");
const target = read(source.targetPath).toString("utf8");
const classic = target.replace("export class", "class");
const representation = (candidateSource) => new RepresentationEquivalenceGuard().validate({
  classicSource: classic, candidateSource, exportName: source.exportName, transportSymbol: runtime.transport.symbol });
reject(() => representation(target.replace("release(meters) {", "release(meters) { const extra = {};")), /beyond ExportNamedDeclaration/);
reject(() => representation(`${target}\nvoid globalThis.${runtime.transport.symbol};`), /beyond ExportNamedDeclaration/);
const context = vm.createContext({});
vm.runInContext(code, context);
const modules = context[runtime.transport.symbol].modules;
const types = Object.fromEntries(sourceBuild.sources.map((item) => [item.exportName, modules[item.targetPath][item.exportName]]));
const probeState = new StageThreeBatch008StateProbe();
class BrokenSpool extends types.LineSpoolState { recover() { return 0; } }
reject(() => probeState.run({ ...types, LineSpoolState: BrokenSpool }));
class CachedTracker extends types.RodStrokeDistanceTracker {
  calculate(input) { return this.cache || (this.cache = super.calculate(input)); }
}
reject(() => probeState.run({ ...types, RodStrokeDistanceTracker: CachedTracker }), /fresh result identity/);
class FrozenPolicy extends types.ReelHoldLoadPolicy { evaluate(input) { return Object.freeze(super.evaluate(input)); } }
reject(() => probeState.run({ ...types, ReelHoldLoadPolicy: FrozenPolicy }));
const staleStatePath = "architecture/migration/stage_3_execution_state.json";
reject(() => new StageThreeBatch008LiveValidation(root, { read: (file) => file === staleStatePath
  ? Buffer.from(JSON.stringify({ ...json(file), activeBatchPhase: "prebuild" })) : read(file) }).run());
assert.deepEqual(snapshot(), before, "Fixture probes mutated protected repository files");
console.log(`Stage 3.8.6 fixtures PASS: ${negatives} negative cases; actual duplicate/missing evaluations, timing, ` +
  "state and allocation mutations rejected; immutable exact evidence; no production writes.");
