"use strict";

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  BATCH_007_APPROVED_VIRTUAL_MODULES,
  StageThreeBatch007CandidateBuild,
} = require("./domain_batches/stage_three_batch_007_candidate_build");
const {
  StageThreeBatch007SourceBuildContractValidator,
} = require("./domain_batches/stage_three_batch_007_source_build_contract");
const {
  RepresentationOnlyNamedEsmTarget,
} = require("./domain_batches/stage_three_representation_target");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  prebuild: "architecture/migration/stage_3_batch_007_prebuild_contract.json",
  plan: "architecture/migration/stage_3_batch_007_execution_plan.json",
  matrix: "architecture/migration/stage_3_batch_007_test_matrix.json",
  output: "architecture/migration/stage_3_batch_007_source_build_validation.json",
  state: "architecture/migration/stage_3_execution_state.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  runtime: "architecture/migration/stage_3_compatibility_runtime.json",
  registry: "architecture/guards/migration_bridge_registry.json",
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  stageTwoPlan: "architecture/migration/stage_2_approved_batches.json",
  stageTwoState: "architecture/migration/stage_2_execution_state.json",
  index: "index.html",
});

class StageThreeBatch007SourceBuildApplication {
  async run() {
    const protectedBefore = this.#protectedSnapshot();
    const manifestBefore = this.#bytes(PATHS.manifest);
    const artifactBefore = fs.existsSync(this.#absolute(PATHS.output))
      ? this.#bytes(PATHS.output)
      : null;
    const prebuild = this.#json(PATHS.prebuild);
    new StageThreeBatchPrebuildContractValidator(BATCH_007_PREBUILD_PROFILE)
      .validate(prebuild);
    const state = this.#json(PATHS.state);
    this.#require(state.activeBatchId === prebuild.batchId, "batch 007 is not active");
    this.#require(state.activeBatchPhase === "prebuild", "batch 007 is not in prebuild phase");
    const targets = this.#projectTargets(prebuild);
    const existingTargets = targets.filter((record) =>
      fs.existsSync(this.#absolute(record.targetPath)));
    this.#require(existingTargets.length === 0 || existingTargets.length === targets.length,
      "partial target source set exists");
    const createdPaths = [];
    try {
      for (const target of targets) {
        const absolute = this.#absolute(target.targetPath);
        if (fs.existsSync(absolute)) {
          this.#require(this.#sha256(this.#bytes(target.targetPath)) === target.targetSha256,
            `persisted target differs: ${target.targetPath}`);
          continue;
        }
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, target.targetSource, "utf8");
        createdPaths.push(target.targetPath);
      }
      this.#reconcileManifest(prebuild);
      const candidateBuild = await new StageThreeBatch007CandidateBuild(PROJECT_ROOT).run({
        prebuild,
        approvedPlan: this.#json(PATHS.approvedPlan),
        executionState: state,
        runtimeContract: this.#json(PATHS.runtime),
        stageTwoApprovedPlan: this.#json(PATHS.stageTwoPlan),
        stageTwoExecutionState: this.#json(PATHS.stageTwoState),
      });
      const artifact = this.#artifact({ prebuild, targets, candidateBuild });
      new StageThreeBatch007SourceBuildContractValidator().validate(artifact);
      fs.writeFileSync(this.#absolute(PATHS.output), this.#serialize(artifact));
      this.#verifyProtectedUnchanged(protectedBefore);
      return Object.freeze({
        status: artifact.status,
        targetCount: targets.length,
        moduleCount: candidateBuild.moduleCount,
        activationCount: candidateBuild.activationCount,
      });
    } catch (error) {
      fs.writeFileSync(this.#absolute(PATHS.manifest), manifestBefore);
      for (const targetPath of createdPaths) {
        const absolute = this.#absolute(targetPath);
        if (fs.existsSync(absolute)) fs.rmSync(absolute, { force: true });
      }
      if (artifactBefore === null) {
        if (fs.existsSync(this.#absolute(PATHS.output))) {
          fs.rmSync(this.#absolute(PATHS.output), { force: true });
        }
      } else {
        fs.writeFileSync(this.#absolute(PATHS.output), artifactBefore);
      }
      throw error;
    }
  }

  #projectTargets(prebuild) {
    const activations = new Map(
      prebuild.preliminaryMetadata.plannedActivationPositions.map((record) => [
        record.sourceProvider,
        record,
      ]),
    );
    return prebuild.preliminaryMetadata.targets.map((record) => {
      const activation = activations.get(record.currentPath);
      this.#require(activation, `activation is missing: ${record.currentPath}`);
      return new RepresentationOnlyNamedEsmTarget().project({
        source: this.#bytes(record.currentPath).toString("utf8"),
        currentPath: record.currentPath,
        targetPath: record.targetPath,
        exportName: activation.exportName,
        sourceSha256: record.sourceSha256,
      });
    }).sort((left, right) => left.targetPath.localeCompare(right.targetPath));
  }

  #reconcileManifest(prebuild) {
    this.#runNode("utils/architecture/reconcile-migration-manifest.js");
    const manifest = this.#json(PATHS.manifest);
    const byPath = new Map(manifest.modules.map((record) => [record.currentPath, record]));
    for (const target of prebuild.preliminaryMetadata.targets) {
      const entry = byPath.get(target.targetPath);
      this.#require(entry, `Manifest target entry is missing: ${target.targetPath}`);
      entry.architecture = {
        migrationStatus: "migrating",
        roles: [...target.roles],
        targetBoundary: target.targetBoundary,
        targetPath: target.targetPath,
        migrationWave: 1,
      };
      entry.analysis.blockers = { status: "verified", items: [] };
    }
    fs.writeFileSync(this.#absolute(PATHS.manifest), this.#serialize(manifest));
    this.#runNode("utils/architecture/persist-migration-observations.js");
    const reconciled = this.#json(PATHS.manifest);
    const reconciledByPath = new Map(
      reconciled.modules.map((record) => [record.currentPath, record]),
    );
    for (const target of prebuild.preliminaryMetadata.targets) {
      const entry = reconciledByPath.get(target.targetPath);
      this.#require(entry?.architecture?.migrationStatus === "migrating",
        `Manifest target is not migrating: ${target.targetPath}`);
      this.#require(entry.observed.providers.status === "verified" &&
        entry.observed.consumers.status === "verified" &&
        entry.observed.environment.status === "verified" &&
        entry.analysis.dependencies.status === "verified",
      `Manifest observations are not verified: ${target.targetPath}`);
    }
  }

  #artifact({ prebuild, targets, candidateBuild }) {
    const manifest = this.#json(PATHS.manifest);
    return {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-source-build-validation",
      status: "candidate-build-verified",
      batchId: prebuild.batchId,
      sourceReleaseVersion: prebuild.sourceReleaseVersion,
      targetReleaseVersion: prebuild.targetReleaseVersion,
      evidence: {
        prebuildContract: this.#evidence(PATHS.prebuild),
        executionPlan: this.#evidence(PATHS.plan),
        testMatrix: this.#evidence(PATHS.matrix),
        executionState: this.#evidence(PATHS.state),
        manifestAfterTargetReconciliation: this.#evidence(PATHS.manifest),
        activeRuntimeContract: this.#evidence(PATHS.runtime),
        activeBridgeRegistry: this.#evidence(PATHS.registry),
        index: this.#evidence(PATHS.index),
      },
      sources: targets.map((record) => ({
        currentPath: record.currentPath,
        targetPath: record.targetPath,
        exportName: record.exportName,
        sourceSha256: record.sourceSha256,
        targetSha256: record.targetSha256,
        representation: record.validation.representation,
        importCount: record.validation.importCount,
        behaviorDelta: record.validation.behaviorDelta,
        stateOwnershipDelta: record.validation.stateOwnershipDelta,
        allocationDelta: record.validation.allocationDelta,
      })),
      manifestReconciliation: {
        moduleCount: manifest.modules.length,
        targetCount: targets.length,
        targetMigrationStatus: "migrating",
        observations: "mechanically-verified",
      },
      plannedTopology: structuredClone(prebuild.plannedTopology),
      candidateInfrastructure: {
        virtualBuildModulesAdded: [...BATCH_007_APPROVED_VIRTUAL_MODULES],
        classification: "build-helper",
        ownsGameState: false,
        globalAssignments: [],
        browserCapabilities: [],
        persistence: "candidate-contract-only-until-runtime-cutover",
      },
      candidateBuild,
      activeRuntimeLocks: {
        indexChanged: false,
        classicProvidersReplaced: false,
        runtimeContractChanged: false,
        bridgeRegistryChanged: false,
        validatedOutputChanged: false,
        activeProjectModuleCount: prebuild.activeTopology.counts.modules,
        activeActivationCount: prebuild.activeTopology.counts.activations,
        activeBridgeCount: prebuild.activeTopology.counts.bridges,
      },
      runtimeCutoverAllowed: false,
      nextGate: "stage-3.7.5-atomic-runtime-cutover",
      rollbackBoundary: "remove-six-targets-and-restore-pre-stage-3.7.4-manifest-only",
      verdict: "eligible-for-atomic-runtime-cutover",
    };
  }

  #protectedSnapshot() {
    return {
      state: this.#sha256(this.#bytes(PATHS.state)),
      runtime: this.#sha256(this.#bytes(PATHS.runtime)),
      registry: this.#sha256(this.#bytes(PATHS.registry)),
      index: this.#sha256(this.#bytes(PATHS.index)),
      classicSources: BATCH_007_PREBUILD_PROFILE.executionProfile.expectedTargets
        .map((record) => ({
          path: record.currentPath,
          sha256: this.#sha256(this.#bytes(record.currentPath)),
        })),
      activeOutput: this.#runtimeOutputEvidence(),
    };
  }

  #verifyProtectedUnchanged(before) {
    const after = this.#protectedSnapshot();
    this.#require(JSON.stringify(after) === JSON.stringify(before),
      "Stage 3.7.4 changed active runtime truth or classic providers");
  }

  #runtimeOutputEvidence() {
    const root = this.#absolute("dist/stage-3-compat-runtime");
    if (!fs.existsSync(root)) return [];
    const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const item = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(item) : [item];
      });
    return walk(root).map((absolutePath) => ({
      path: path.relative(PROJECT_ROOT, absolutePath).replaceAll("\\", "/"),
      sha256: this.#sha256(fs.readFileSync(absolutePath)),
    })).sort((left, right) => left.path.localeCompare(right.path));
  }

  #runNode(relativePath) {
    const result = spawnSync(process.execPath, [this.#absolute(relativePath)], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(
        `Stage 3.7.4 command failed: ${relativePath}\n${result.stdout}\n${result.stderr}`,
      );
    }
  }

  #evidence(relativePath) {
    return { path: relativePath, sha256: this.#sha256(this.#bytes(relativePath)) };
  }

  #json(relativePath) {
    return JSON.parse(this.#bytes(relativePath).toString("utf8"));
  }

  #bytes(relativePath) {
    return fs.readFileSync(this.#absolute(relativePath));
  }

  #absolute(relativePath) {
    const absolute = path.resolve(PROJECT_ROOT, relativePath);
    const relative = path.relative(PROJECT_ROOT, absolute).replaceAll("\\", "/");
    this.#require(relative === relativePath, `path escaped project root: ${relativePath}`);
    return absolute;
  }

  #serialize(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  #sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }

  #require(condition, message) {
    if (!condition) throw new Error(`Stage 3.7.4 source/build validation failed: ${message}`);
  }
}

if (require.main === module) {
  new StageThreeBatch007SourceBuildApplication().run().then((result) => {
    console.log(
      `Stage 3.7.4 verified: ${result.targetCount} ESM targets, ` +
      `${result.moduleCount} candidate modules, ${result.activationCount} candidate activations; ` +
      "active runtime unchanged.",
    );
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { StageThreeBatch007SourceBuildApplication };
