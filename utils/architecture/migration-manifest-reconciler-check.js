const assert = require("node:assert/strict");
const path = require("node:path");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const {
  CurrentAreaResolver,
} = require("./migration/current_area_resolver");
const {
  ManifestEntryFactory,
} = require("./migration/manifest_entry_factory");
const {
  MigrationManifestReconciler,
} = require("./migration/migration_manifest_reconciler");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const POLICY_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "module_architecture.json",
);

class MigrationManifestReconcilerCheck {
  constructor({ policy, reconciler }) {
    this.policy = policy;
    this.reconciler = reconciler;
  }

  run() {
    const reviewedArchitecture = {
      migrationStatus: "classified",
      roles: ["domain-contract"],
      targetBoundary: "engine",
      targetPath: null,
      migrationWave: null,
    };
    const reviewedAnalysis = {
      dependencies: {
        status: "verified",
        confirmed: [
          {
            symbol: "Dependency",
            mechanism: "identifier",
            accessRequirement: "required",
            executionPhase: "deferred",
            target: "src/new.js",
            resolution: "confirmed",
          },
        ],
        items: [
          {
            target: "src/new.js",
            symbols: ["Dependency"],
            resolution: "confirmed",
          },
        ],
        unresolved: [],
        ambiguous: [],
        issues: [],
      },
      blockers: {
        status: "verified",
        items: ["requires a reviewed adapter"],
      },
    };
    const reviewedObserved = {
      ...JSON.parse(
        JSON.stringify(this.policy.migrationManifest.initialObserved),
      ),
      consumers: {
        status: "verified",
        items: [
          {
            symbol: "Dependency",
            mechanism: "identifier",
            accessRequirement: "required",
            executionPhase: "deferred",
          },
        ],
        issues: [],
      },
    };
    const staleEntry = {
      currentPath: "src/stale.js",
      currentArea: "root",
      observed: { legacyLoadOrder: 3, ...reviewedObserved },
      architecture: reviewedArchitecture,
      analysis: reviewedAnalysis,
    };
    const manifest = this.reconciler.reconcile({
      existingManifest: {
        schemaVersion: this.policy.migrationManifest.schemaVersion,
        modules: [
          {
            currentPath: "src/reviewed.js",
            currentArea: "outdated-area",
            observed: { legacyLoadOrder: 7, ...reviewedObserved },
            architecture: reviewedArchitecture,
            analysis: reviewedAnalysis,
          },
          staleEntry,
        ],
      },
      sourceFiles: [
        { currentPath: "src/new.js" },
        { currentPath: "src/reviewed.js" },
      ],
      legacyScripts: [
        {
          currentPath: "src/reviewed.js",
          type: "classic",
          legacyLoadOrder: 1,
        },
      ],
    });

    const reviewed = manifest.modules.find(
      (entry) => entry.currentPath === "src/reviewed.js",
    );
    assert.deepEqual(reviewed.architecture, reviewedArchitecture);
    assert.deepEqual(reviewed.analysis, reviewedAnalysis);
    assert.deepEqual(reviewed.observed.consumers, reviewedObserved.consumers);
    assert.equal(reviewed.currentArea, "root");
    assert.equal(reviewed.observed.legacyLoadOrder, 1);

    const created = manifest.modules.find(
      (entry) => entry.currentPath === "src/new.js",
    );
    assert.deepEqual(
      created.architecture,
      this.policy.migrationManifest.initialArchitecture,
    );
    assert.deepEqual(
      created.analysis,
      this.policy.migrationManifest.initialAnalysis,
    );
    assert.deepEqual(
      created.observed.providers,
      this.policy.migrationManifest.initialObserved.providers,
    );
    assert.equal(created.observed.legacyLoadOrder, null);
    assert.ok(
      manifest.modules.some((entry) => entry.currentPath === "src/stale.js"),
      "A stale reviewed entry must remain visible for integrity validation",
    );
    assert.deepEqual(
      manifest.modules.map((entry) => entry.currentPath),
      ["src/new.js", "src/reviewed.js", "src/stale.js"],
    );
  }
}

const policy = ArchitecturePolicy.load(POLICY_PATH);
const currentAreaResolver = new CurrentAreaResolver({
  rootValue: policy.migrationManifest.currentArea.rootValue,
});
new MigrationManifestReconcilerCheck({
  policy,
  reconciler: new MigrationManifestReconciler({
    schemaVersion: policy.migrationManifest.schemaVersion,
    entryFactory: new ManifestEntryFactory({
      manifestPolicy: policy.migrationManifest,
      currentAreaResolver,
    }),
  }),
}).run();

console.log(
  "Migration manifest reconciler passed: reviewed metadata preserved and new entries conservative.",
);
