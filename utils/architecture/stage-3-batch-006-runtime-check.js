"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const estraverse = require("estraverse");
const {
  StageThreeCompatibilityBuildApplication,
} = require("../build/build_stage_3_compat_runtime");
const {
  CumulativeRuntimeBundleValidator,
} = require("../build/compat_runtime/cumulative_runtime_builder");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");
const {
  StageThreeBatch006FocusedTestMatrixCheck,
} = require("./stage-3-batch-006-focused-test-matrix-check");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-3.candidate-006-fishing-e48e70d8";

class StageThreeBatch006RuntimeCheck {
  async run() {
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const approved = this.#json("architecture/migration/stage_3_approved_batches.json");
    const contract = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const executionPlan = this.#json(
      "architecture/migration/stage_3_batch_006_execution_plan.json",
    );
    const batch = approved.batches.find((record) => record.id === BATCH_ID);
    assert(batch);
    const completed = state.completedBatchIds.includes(BATCH_ID);
    assert.equal(completed || state.activeBatchId === BATCH_ID, true);
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, completed ? 6 : 5)
      .map((record) => record.id));
    if (completed) {
      const nextBatchOpen = state.activeBatchId === approved.batches[6]?.id &&
        ["prebuild", "runtime-active"].includes(state.activeBatchPhase);
      assert.equal(
        (state.activeBatchId === null && state.activeBatchPhase === undefined) || nextBatchOpen,
        true,
      );
    } else {
      assert.equal(state.activeBatchPhase, "runtime-active");
    }
    const selectedCount = state.completedBatchIds.length +
      (state.activeBatchId && state.activeBatchPhase === "runtime-active" ? 1 : 0);
    const selectedBatch = approved.batches[selectedCount - 1];
    assert.equal(contract.activationPositions.length,
      selectedBatch.compatibility.cumulativeActivationIds.length);
    assert.equal(contract.plannedActivationPositions, undefined);
    this.#verifyRepresentationOnly(executionPlan);

    const expectedModules = [
      ...selectedBatch.cumulativeRuntimeTopology.stage2Targets,
      ...selectedBatch.cumulativeRuntimeTopology.stage3Targets,
      ...contract.approvedInfrastructureModules,
    ].sort();
    const report = await new StageThreeCompatibilityBuildApplication({
      projectRoot: PROJECT_ROOT,
    }).run();
    assert.equal(report.status, "built");
    assert.equal(report.moduleCount, expectedModules.length);
    assert.equal(report.activationCount,
      selectedBatch.compatibility.cumulativeActivationIds.length);
    assert.deepEqual(report.selectedBatchIds, approved.batches.slice(0, selectedCount)
      .map((record) => record.id));
    const runtime = report.outputs.find((record) =>
      record.kind === "cumulative-runtime");
    assert(runtime);
    assert.deepEqual(runtime.projectModules, expectedModules);
    assert.equal(new Set(runtime.projectModules).size, expectedModules.length);
    assert.deepEqual(runtime.virtualBuildModules,
      [...new Set(runtime.virtualBuildModules)].sort());
    assert(runtime.virtualBuildModules.every((moduleId) =>
      contract.approvedVirtualModules.includes(moduleId)));
    assert(runtime.virtualBuildModules.every((moduleId) =>
      !runtime.projectModules.includes(moduleId)));
    this.#verifyClassicBundle(runtime.path, expectedModules);
    this.#verifyActivations(contract, batch);
    this.#verifyScriptTopology(contract);
    await this.#verifyFailurePreservesOutput(contract);
    new StageThreeBatch006FocusedTestMatrixCheck().run();
    console.log(
      `Stage 3.6.6 runtime evidence passed inside the current ${expectedModules.length}-module cumulative graph, ` +
        `${report.activationCount} activations, unique module identities, exact bundled-module report, ` +
        "classic IIFE output and atomic failure preservation verified.",
    );
  }

  #verifyClassicBundle(relativePath, expectedModules) {
    const code = this.#read(relativePath);
    const tree = espree.parse(code, { ecmaVersion: "latest", sourceType: "script" });
    const moduleSyntax = [];
    const globals = [];
    estraverse.traverse(tree, {
      fallback: "iteration",
      enter(node) {
        if (["ImportDeclaration", "ExportNamedDeclaration", "ExportDefaultDeclaration", "ExportAllDeclaration"].includes(node.type)) {
          moduleSyntax.push(node.type);
        }
        if (
          node.type === "AssignmentExpression" &&
          node.left?.type === "MemberExpression" &&
          !node.left.computed &&
          node.left.object?.type === "Identifier" &&
          node.left.object.name === "globalThis"
        ) {
          globals.push(node.left.property.name);
        }
      },
    });
    assert.deepEqual(moduleSyntax, []);
    assert.deepEqual(globals, ["__CYBER_FISHING_COMPAT_RUNTIME__"]);
    new CumulativeRuntimeBundleValidator().validate({
      code,
      actualModules: expectedModules,
      approvedModules: expectedModules,
    });
  }

  #verifyRepresentationOnly(plan) {
    assert.equal(plan.scope.modules.length, 6);
    for (const module of plan.scope.modules) {
      assert.equal(module.exports.length, 1);
      const exportName = module.exports[0];
      const target = this.#read(module.targetPath);
      const marker = `export class ${exportName}`;
      assert.equal(target.split(marker).length - 1, 1);
      const restoredClassic = target.replace(marker, `class ${exportName}`);
      assert.equal(this.#sha256(Buffer.from(restoredClassic, "utf8")),
        module.sourceSha256);
      const tree = espree.parse(target, {
        ecmaVersion: "latest",
        sourceType: "module",
      });
      assert.equal(tree.body.filter((node) =>
        node.type === "ExportNamedDeclaration").length, 1);
      assert.equal(tree.body.some((node) =>
        node.type === "ImportDeclaration" ||
        node.type === "ExportDefaultDeclaration" ||
        node.type === "ExportAllDeclaration"), false);
      assert.equal(target.includes("__CYBER_FISHING_COMPAT_RUNTIME__"), false);
      assert.equal(/\b(?:document|window|localStorage|Audio|CanvasRenderingContext2D)\b/u
        .test(target), false);
    }
  }

  #verifyActivations(contract, batch) {
    const ownerActivations = contract.activationPositions.filter((record) =>
      record.owner === BATCH_ID);
    assert.equal(ownerActivations.length, 6);
    assert.deepEqual(ownerActivations.map((record) => record.id).sort(),
      batch.compatibility.newActivations.map((record) => record.contract.id).sort());
    for (const activation of ownerActivations) {
      const shim = this.#read(`${contract.output.directory}${activation.shimFile}`);
      assert.equal(this.#read(activation.sourceProvider), shim);
      const tree = espree.parse(shim, { ecmaVersion: "latest", sourceType: "script" });
      assert.equal(tree.body.length, 1);
      assert.equal(tree.body[0].type, "ExpressionStatement");
      assert.equal(shim.includes("import "), false);
      assert.equal(shim.includes("export "), false);
      assert.equal(shim.includes("function"), false);
      assert.equal(shim.includes("new "), false);
    }
  }

  #verifyScriptTopology(contract) {
    const html = this.#read("index.html");
    const scripts = [...html.matchAll(
      /<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu,
    )];
    const moduleScripts = scripts.filter((match) =>
      /\btype=["']module["']/iu.test(match[1]));
    const runtimePath = `${contract.output.directory}${contract.output.runtimeFile}`;
    assert.equal(scripts.filter((match) =>
      match[2].split("?")[0] === runtimePath).length, 1);
    assert.equal(scripts.filter((match) =>
      match[2].includes("dist/legacy-bridges/")).length, 0);
    assert.equal(moduleScripts.length, 0);
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logical = new LegacyScriptOrderReader(
      path.join(PROJECT_ROOT, "index.html"),
      { scriptAliases: aliases },
    ).read();
    assert.equal(logical.length, 424);
    assert.equal(scripts.length, 426);
  }

  async #verifyFailurePreservesOutput(contract) {
    const outputRoot = path.join(PROJECT_ROOT, contract.output.directory);
    const before = this.#treeFingerprint(outputRoot);
    const failing = new StageThreeCompatibilityBuildApplication({
      projectRoot: PROJECT_ROOT,
      viteLoader: async () => ({
        build: async () => {
          throw new Error("fixture-build-failure");
        },
      }),
    });
    await assert.rejects(() => failing.run(), /fixture-build-failure/u);
    assert.equal(this.#treeFingerprint(outputRoot), before);
    const dist = path.join(PROJECT_ROOT, "dist");
    assert.equal(fs.readdirSync(dist).some((name) =>
      name.startsWith(".stage-3-compat-runtime-stage-")), false);
  }

  #treeFingerprint(root) {
    const records = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else records.push({
          path: path.relative(root, absolute).replaceAll("\\", "/"),
          sha256: this.#sha256(fs.readFileSync(absolute)),
        });
      }
    };
    walk(root);
    records.sort((left, right) => left.path.localeCompare(right.path));
    return this.#sha256(Buffer.from(JSON.stringify(records), "utf8"));
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

new StageThreeBatch006RuntimeCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
