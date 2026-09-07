"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatch008SourceBuild, StageThreeBatch008SourceBuildValidator, PATHS } =
  require("./domain_batches/stage_three_batch_008_source_build");
const { readPendingTargetTransition, canonicalBytes } = require("./domain_batches/stage_three_pending_target_manifest");
const { RepresentationOnlyNamedEsmTarget } = require("./domain_batches/stage_three_representation_target");
const { StageThreeBatchCandidateBuild } = require("./domain_batches/stage_three_batch_candidate_build");
const { snapshot } = require("./stage-3-batch-008-source-build-integration-check");

const ROOT = path.resolve(__dirname, "../..");

class StageThreeBatch008SourceBuildFixtureCheck {
  async run() {
    this.sources();
    this.manifest();
    this.contract();
    await this.failures();
    console.log("Stage 3.8.4 negative fixtures passed: representation-only source, exact pending delta, " +
      "no speculative observations, topology/identity locks, rejected helpers, Vite/output failures and " +
      "every metadata transaction boundary restore exact prior bytes and clean staging.");
  }

  sources() {
    const artifact = this.json(PATHS.output);
    const projector = new RepresentationOnlyNamedEsmTarget();
    for (const target of artifact.sources) {
      const source = this.bytes(target.targetPath).toString("utf8");
      const classicSource = this.bytes(target.currentPath).toString("utf8");
      const input = { ...target, classicSource, source };
      projector.validate(input);
      for (const changed of [
        `import { CONFIG } from "../../config/config.js";\n${source}`,
        `import { Service } from "../../application/service.js";\n${source}`,
        `const cache = new Map();\n${source}`,
        source.replace("export class", "export default class"),
        source.replace("export class", "class"),
        `${source}\nglobalThis.Extra = 1;`,
        `${source}\n__CYBER_FISHING_COMPAT_RUNTIME__.modules;`,
        `${source}\nwindow.document;`,
        source.replace(/\breturn\b/u, "throw"),
      ]) assert.throws(() => projector.validate({ ...input, source: changed }),
        `Source delta escaped validation: ${target.targetPath}`);
    }
    assert.throws(() => new StageThreeBatchCandidateBuild({ projectRoot: ROOT }), /batch number/u);
    assert.throws(() => new StageThreeBatchCandidateBuild({ projectRoot: ROOT, batchNumber: "008" }), /helper delta/u);
  }

  manifest() {
    const transition = readPendingTargetTransition(ROOT);
    const current = this.bytes(PATHS.manifest);
    const restored = transition.reverse(current);
    assert.deepEqual(transition.add(restored), current);
    const paths = new Set(transition.records.map((entry) => entry.currentPath));
    const reject = (mutate) => {
      const document = JSON.parse(current);
      mutate(document, document.modules.filter((entry) => paths.has(entry.currentPath)));
      assert.throws(() => transition.reverse(canonicalBytes(document)));
    };
    reject((document, targets) => document.modules.splice(document.modules.indexOf(targets[0]), 1));
    reject((document, targets) => document.modules.push(structuredClone(targets[0])));
    reject((document, targets) => { targets[0].architecture.migrationStatus = "verified"; });
    reject((document, targets) => { targets[0].observed.providers.status = "verified"; });
    reject((document, targets) => { targets[0].analysis.dependencies.items.push({ target: targets[1].currentPath }); });
    reject((document, targets) => { targets[0].architecture.roles.push("dev-tool"); });
    reject((document) => { document.modules[0].currentArea = "tampered"; });
    reject((document) => { document.schemaVersion += 1; });
    assert.throws(() => transition.add(current), /exact prebuild/u);
  }

  contract() {
    const artifact = this.json(PATHS.output);
    const context = { prebuild: this.json(PATHS.prebuild), plan: this.json(PATHS.plan),
      runtimeContract: this.json(PATHS.runtime), pendingRecords: readPendingTargetTransition(ROOT).records };
    const validator = new StageThreeBatch008SourceBuildValidator();
    const immutable = validator.validate(artifact, context);
    assert.throws(() => { immutable.sources[0].targetPath = "other.js"; }, TypeError);
    for (const mutate of [
      (v) => v.sources.pop(),
      (v) => { v.sources[0].validation.allocationDelta = "changed"; },
      (v) => { v.candidateBuild.moduleCount -= 1; },
      (v) => v.candidateBuild.projectModules.push("src/core/legacy.js"),
      (v) => v.candidateBuild.activationOutputs.pop(),
      (v) => v.candidateBuild.virtualBuildModules.push("unknown-helper"),
      (v) => { v.candidateBuild.validation.identities[0].globalAbsentBeforeActivation = false; },
      (v) => { v.candidateBuild.validation.identities[0].legacyScriptIndex += 1; },
      (v) => { v.candidateBuild.validation.transportOwnsGameState = true; },
      (v) => { v.candidateBuild.validation.behaviorCases[0].outcome = "changed"; },
      (v) => { v.manifestTransition.addedRecords[0].observed.providers.status = "verified"; },
      (v) => { v.manifestTransition.observations = "verified"; },
      (v) => { v.activeRuntimeLocks.runtimeCutoverAllowed = true; },
      (v) => v.activeRuntimeLocks.projectModules.push("extra.js"),
    ]) {
      const changed = structuredClone(artifact);
      mutate(changed);
      assert.throws(() => validator.validate(changed, context));
    }
  }

  async failures() {
    const before = snapshot();
    const active = new (require("./domain_batches/stage_three_batch_008_cutover_history").Batch008CutoverHistory)(ROOT).active();
    let entered = false;
    await assert.rejects(new StageThreeBatch008SourceBuild(ROOT, {
      viteLoader: async () => { entered = true; throw new Error("injected Vite failure"); },
    }).prepare(), /injected Vite failure/u);
    assert(entered, "Failure fixture never reached Vite");
    assert.deepEqual(snapshot(), before);
    await assert.rejects(new StageThreeBatch008SourceBuild(ROOT, {
      verifyOutput: () => { throw new Error("injected built-output rejection"); },
    }).prepare(), /injected built-output rejection/u);
    assert.deepEqual(snapshot(), before);
    if (active) {
      await assert.rejects(new StageThreeBatch008SourceBuild(ROOT).run(), /read-only after cutover/u);
      assert.deepEqual(snapshot(), before);
      return; // Historical writer is locked; current transaction failures are tested by 3.8.5.
    }
    for (const [phase, count] of [["after-staging", 0], ["after-replacement", 1],
      ["after-replacement", 2], ["after-final-validation", 2]]) {
      let injected = false;
      await assert.rejects(new StageThreeBatch008SourceBuild(ROOT, {
        failureInjector: (event) => {
          if (event.phase === phase && event.count === count) {
            injected = true;
            throw new Error("injected metadata transaction failure");
          }
        },
      }).run(), /injected metadata transaction failure/u);
      assert(injected, `Transaction fixture never reached ${phase}/${count}`);
      assert.deepEqual(snapshot(), before, `${phase}/${count} damaged prior validated output/metadata`);
    }
  }

  bytes(relative) { return require("./domain_batches/stage_three_batch_008_cutover_history").historicalCutoverBytes(relative, fs.readFileSync(path.join(ROOT, relative))); }
  json(relative) { return JSON.parse(this.bytes(relative)); }
}

new StageThreeBatch008SourceBuildFixtureCheck().run()
  .catch((error) => { console.error(error); process.exitCode = 1; });
