"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  DomainCandidatePolicyValidator,
  DomainModuleEligibilityPolicy,
} = require("./domain_batches/domain_candidate_policy");
const {
  DomainCandidateArtifactValidator,
} = require("./domain_batches/domain_candidate_artifact");
const {
  DomainCandidateClusterSelector,
} = require("./domain_batches/domain_candidate_cluster_selector");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const read = (relativePath) => JSON.parse(fs.readFileSync(
  path.join(PROJECT_ROOT, relativePath),
  "utf8",
));
const POLICY = read("architecture/migration/stage_3_candidate_policy.json");
const AUDIT = read("architecture/migration/stage_3_domain_audit.json");
const MANIFEST = read("architecture/migration/module_migration_manifest.json");
const ARTIFACT = read("architecture/migration/stage_3_candidate_batches.json");
const FROZEN_MANIFEST = {
  modules: AUDIT.entries.map((entry) => ({
    currentPath: entry.currentPath,
    architecture: { targetBoundary: "game-domain", roles: entry.roles },
  })),
};
const FROZEN_FINGERPRINTS = Object.fromEntries(
  Object.entries(ARTIFACT.source).filter(([key]) =>
    key.endsWith("Path") || key.endsWith("Sha256")),
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeCandidateBatchFixtureCheck {
  run() {
    let cases = 0;
    const check = (callback) => {
      callback();
      cases += 1;
    };
    const policy = new DomainModuleEligibilityPolicy(
      new DomainCandidatePolicyValidator().validate(POLICY),
    );

    check(() => {
      const entry = AUDIT.entries.find((item) =>
        item.currentPath === "src/application/inventory/refill_compatible_signature_policy.js");
      const decision = policy.classify(entry);
      assert.equal(decision.status, "conditionally-eligible");
      assert(decision.reasonCodes.includes("partial-state-review"));
      assert(!decision.reasonCodes.includes("mixed-responsibility-requires-decomposition"));
    });

    check(() => {
      const entry = AUDIT.entries.find((item) => item.currentPath === "src/world/world.js");
      const decision = policy.classify(entry);
      assert.equal(decision.status, "deferred");
      assert(decision.reasonCodes.includes("dev-production-coupling"));
      assert(decision.prerequisites.some((item) =>
        item.action === "remove-development-runtime-dependency"));
    });

    check(() => {
      const entry = AUDIT.entries.find((item) =>
        item.currentPath === "src/core/equipment/rod_capability_resolver.js");
      assert.equal(policy.classify(entry).status, "eligible");
    });

    check(() => {
      const entry = AUDIT.entries.find((item) =>
        item.currentPath === "src/core/fishing/tackle_stress_accumulator.js");
      const decision = policy.classify(entry);
      assert.equal(decision.status, "conditionally-eligible");
      assert(decision.reasonCodes.includes("hot-loop-performance-gate"));
    });

    check(() => {
      const entry = AUDIT.entries.find((item) =>
        item.currentPath === "src/core/fishing/fish_fight_direction_resolver.js");
      const decision = policy.classify(entry);
      assert.equal(decision.status, "conditionally-eligible");
      assert(decision.reasonCodes.includes("boundary-extraction-prerequisite"));
      assert(decision.prerequisites.some((item) => item.kind === "boundary-extraction"));
    });

    check(() => {
      const createModule = (name, consumer) => ({
        currentPath: `src/legacy/${name}.js`,
        targetPath: `src/game/domain/items/${name}.js`,
        targetArea: "items",
        dependencyAudit: {
          facts: {
            dependencyDepth: 0,
            internalDependencies: [],
            topLevelEffects: [],
            reverseConsumers: consumer
              ? [{ source: consumer, sourceBoundary: "game-application", symbols: [name] }]
              : [],
            scc: {
              id: `scc-${name}`,
              members: [`src/legacy/${name}.js`],
              cyclic: false,
            },
          },
        },
        performanceRisk: { facts: { hotLoopParticipation: "none" } },
        configurationInput: { facts: { forbiddenDirectReads: [] } },
        stateOwnership: { status: "verified" },
      });
      const modules = [
        createModule("Alpha", "src/app/shared_consumer.js"),
        createModule("Beta", "src/app/shared_consumer.js"),
        createModule("Gamma", null),
      ];
      const decisions = new Map(modules.map((module) => [module.currentPath, {
        currentPath: module.currentPath,
        status: "eligible",
        reasonCodes: [],
        prerequisites: [],
      }]));
      const selection = new DomainCandidateClusterSelector(POLICY).select({
        modules,
        decisions,
      });
      assert.equal(selection.batches.length, 2);
      assert(selection.batches.some((batch) => batch.modulePaths.length === 2));
      assert(selection.batches.some((batch) =>
        batch.modulePaths.length === 1 && batch.modulePaths[0].endsWith("Gamma.js")));
    });

    check(() => {
      const validated = new DomainCandidateArtifactValidator().validate({
        artifact: ARTIFACT,
        audit: AUDIT,
        manifest: FROZEN_MANIFEST,
        expectedSourceFingerprints: FROZEN_FINGERPRINTS,
      });
      assert.equal(validated.runtimeMigrationAllowed, false);
      assert.equal(validated.coverage.unassigned.length, 0);
    });

    check(() => {
      const invalid = clone(ARTIFACT);
      invalid.runtimeMigrationAllowed = true;
      assert.throws(
        () => this.#validate(invalid),
        /must not allow runtime migration/,
      );
    });

    check(() => {
      const invalid = clone(ARTIFACT);
      invalid.coverage.deferred.push(invalid.coverage.assigned[0]);
      invalid.coverage.deferred.sort();
      assert.throws(
        () => this.#validate(invalid),
        /must not overlap|exactly assigned or deferred/,
      );
    });

    check(() => {
      const invalid = clone(ARTIFACT);
      invalid.batches[0].modules[0].stateOwnershipInvariant.after.authoritativeOwners.push(
        "SyntheticSecondOwner",
      );
      assert.throws(
        () => this.#validate(invalid),
        /changes authoritative state owners/,
      );
    });

    check(() => {
      const invalid = clone(ARTIFACT);
      const batch = invalid.batches.find((item) => item.gates.performance.length > 0);
      batch.gates.performance[0].requiredProofs = ["behavior-equivalence"];
      assert.throws(
        () => this.#validate(invalid),
        /hot-loop acceptance is incomplete/,
      );
    });

    check(() => {
      const invalid = clone(ARTIFACT);
      invalid.batches[0].compatibility.requiredTransitions.pop();
      assert.throws(
        () => this.#validate(invalid),
        /transition every identity-sensitive Stage 2 exposure/,
      );
    });

    check(() => {
      const invalid = clone(ARTIFACT);
      invalid.source.domainAuditSha256 = "0".repeat(64);
      assert.throws(
        () => this.#validate(invalid),
        /candidate source is stale: domainAuditSha256/,
      );
    });

    check(() => {
      const invalid = clone(ARTIFACT);
      const batch = invalid.batches.find((item) => item.sideEffectReviews.length > 0);
      batch.sideEffectReviews[0].status = "approved-without-review";
      assert.throws(
        () => this.#validate(invalid),
        /side-effect review contract is invalid/,
      );
    });

    console.log(`Stage 3 candidate batch fixtures passed (${cases} cases).`);
  }

  #validate(artifact) {
    return new DomainCandidateArtifactValidator().validate({
      artifact,
      audit: AUDIT,
      manifest: FROZEN_MANIFEST,
      expectedSourceFingerprints: FROZEN_FINGERPRINTS,
    });
  }
}

new StageThreeCandidateBatchFixtureCheck().run();
