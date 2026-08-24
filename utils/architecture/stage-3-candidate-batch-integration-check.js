"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { globSync } = require("glob");
const {
  DomainCandidateArtifactValidator,
} = require("./domain_batches/domain_candidate_artifact");
const {
  PATHS,
  buildArtifact,
  sourceFingerprints,
} = require("./generate-stage-3-candidate-batches");
const { StageThreeHistoricalAuditGuard } = require("./domain_audit/stage_three_historical_audit_guard");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const absolute = (relativePath) => path.resolve(PROJECT_ROOT, relativePath);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));

class StageThreeCandidateBatchIntegrationCheck {
  run() {
    const historicalGuard = new StageThreeHistoricalAuditGuard(PROJECT_ROOT);
    if (historicalGuard.isActive()) {
      this.#runHistorical(historicalGuard);
      return;
    }
    const protectedPaths = [
      "index.html",
      "architecture/migration/module_migration_manifest.json",
      "architecture/guards/migration_bridge_registry.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
    ];
    const protectedBefore = new Map(protectedPaths.map((relativePath) => [
      relativePath,
      fs.readFileSync(absolute(relativePath)),
    ]));
    const artifactBytes = fs.readFileSync(absolute(PATHS.output));
    const persisted = JSON.parse(artifactBytes.toString("utf8"));
    const generated = buildArtifact();
    const generatedBytes = Buffer.from(`${JSON.stringify(generated, null, 2)}\n`, "utf8");
    assert.deepEqual(generatedBytes, artifactBytes, "candidate artifact must be byte-stable");
    new DomainCandidateArtifactValidator().validate({
      artifact: persisted,
      audit: readJson(PATHS.audit),
      manifest: readJson(PATHS.manifest),
      expectedSourceFingerprints: sourceFingerprints(),
    });

    assert.equal(persisted.summary.domainModuleCount, 135);
    assert.equal(
      persisted.summary.assignedModuleCount + persisted.summary.deferredModuleCount,
      persisted.summary.domainModuleCount,
    );
    assert.equal(persisted.coverage.unassigned.length, 0);
    assert.equal(persisted.runtimeMigrationAllowed, false);
    assert(persisted.summary.eligibilityCounts.eligible > 0);
    assert(persisted.summary.eligibilityCounts["conditionally-eligible"] > 0);
    assert(persisted.summary.eligibilityCounts.deferred > 0);

    const audit = readJson(PATHS.audit);
    const batchByModule = new Map();
    for (const batch of persisted.batches) {
      for (const module of batch.modules) batchByModule.set(module.currentPath, batch);
    }
    const deferred = new Set(persisted.coverage.deferred);
    const partialState = audit.entries.filter((entry) => entry.stateOwnership.status === "partial");
    assert.equal(partialState.length, 53);
    assert(
      partialState.some((entry) => batchByModule.has(entry.currentPath)),
      "partial state observations must not be universal blockers",
    );
    const hotLoops = audit.entries.filter((entry) =>
      entry.performanceRisk.facts.hotLoopParticipation === "direct");
    assert.equal(hotLoops.length, 12);
    for (const entry of hotLoops) {
      if (deferred.has(entry.currentPath)) continue;
      const batch = batchByModule.get(entry.currentPath);
      assert(batch, `hot-loop module lacks assigned/deferred answer: ${entry.currentPath}`);
      const gate = batch.gates.performance.find((item) => item.module === entry.currentPath);
      assert(gate?.requiredProofs.includes("no-compatibility-lookup-in-hot-loop"));
    }
    const configConsumers = audit.entries.filter((entry) =>
      entry.configurationInput.facts.forbiddenDirectReads.length > 0);
    assert.equal(configConsumers.length, 8);
    for (const entry of configConsumers) {
      if (deferred.has(entry.currentPath)) continue;
      const batch = batchByModule.get(entry.currentPath);
      assert(batch.prerequisites.some((item) =>
        item.kind === "config-di" && item.module === entry.currentPath));
      assert.equal(
        batch.cumulativeRuntimeTopology.topologyRevalidation.requiredBeforeApprovedFreeze,
        true,
      );
    }
    const firstBatch = persisted.batches[0];
    assert.equal(firstBatch.compatibility.requiredTransitions.length, 9);
    assert.equal(firstBatch.cumulativeRuntimeTopology.stage2Targets.length, 9);
    assert(firstBatch.sideEffectReviews.some((review) => review.originatingStage === "stage-2"));

    const html = fs.readFileSync(absolute("index.html"), "utf8");
    const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["'][^>]*><\/script>/giu)];
    assert.equal(scripts.length, 424);
    assert.equal(scripts.some((match) => /\btype\s*=\s*["']module["']/iu.test(match[1])), false);
    assert.equal(html.includes("stage-3-compat-runtime"), false);

    for (const [relativePath, bytes] of protectedBefore) {
      assert.deepEqual(
        fs.readFileSync(absolute(relativePath)),
        bytes,
        `candidate planning must not mutate ${relativePath}`,
      );
    }
    const srcFiles = globSync("src/**/*.js", { cwd: PROJECT_ROOT, nodir: true });
    assert.equal(srcFiles.length, 433);
    const sha256 = crypto.createHash("sha256").update(artifactBytes).digest("hex");
    console.log(
      `Stage 3.0.5 candidate integration passed: ${persisted.batches.length} batches, ` +
        `${persisted.summary.assignedModuleCount} assigned, ` +
        `${persisted.summary.deferredModuleCount} deferred, 0 unassigned; ${sha256}.`,
    );
  }

  #runHistorical(historicalGuard) {
    const historical = historicalGuard.validate();
    const artifactBytes = fs.readFileSync(absolute(PATHS.output));
    const persisted = JSON.parse(artifactBytes.toString("utf8"));
    const audit = readJson(PATHS.audit);
    const frozenManifest = {
      modules: audit.entries.map((entry) => ({
        currentPath: entry.currentPath,
        architecture: { targetBoundary: "game-domain", roles: entry.roles },
      })),
    };
    const frozenFingerprints = Object.fromEntries(
      Object.entries(persisted.source).filter(([key]) =>
        key.endsWith("Path") || key.endsWith("Sha256")),
    );
    new DomainCandidateArtifactValidator().validate({
      artifact: persisted,
      audit,
      manifest: frozenManifest,
      expectedSourceFingerprints: frozenFingerprints,
    });
    assert.equal(persisted.summary.domainModuleCount, 135);
    assert.equal(persisted.coverage.unassigned.length, 0);
    assert.equal(persisted.runtimeMigrationAllowed, false);
    assert.equal(persisted.batches[0].compatibility.requiredTransitions.length, 9);
    assert.equal(persisted.batches[0].cumulativeRuntimeTopology.stage2Targets.length, 9);
    const sha256 = crypto.createHash("sha256").update(artifactBytes).digest("hex");
    assert.equal(sha256, historical.candidateSha256);
    console.log(
      `Stage 3.0.5 candidate integration passed as frozen planning evidence: ` +
        `${persisted.batches.length} batches, 135 modules, 0 unassigned; ${sha256}.`,
    );
  }
}

new StageThreeCandidateBatchIntegrationCheck().run();
