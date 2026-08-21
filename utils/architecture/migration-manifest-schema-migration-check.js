const assert = require("node:assert/strict");
const path = require("node:path");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const {
  createMigrationManifestSchemaMigrator,
} = require("./migration/migration_manifest_schema_migrator");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const POLICY_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "module_architecture.json",
);

class MigrationManifestSchemaMigrationCheck {
  constructor({ policy, migrator }) {
    this.policy = policy;
    this.migrator = migrator;
  }

  run() {
    const architecture = {
      migrationStatus: "legacy",
      roles: [],
      targetBoundary: null,
      targetPath: null,
      migrationWave: null,
    };
    const blockers = {
      status: "verified",
      items: ["reviewed blocker remains authoritative"],
    };
    const v1 = {
      schemaVersion: 1,
      modules: [
        {
          currentPath: "src/fixture.js",
          currentArea: "root",
          observed: { legacyLoadOrder: 17 },
          architecture,
          analysis: {
            dependencies: { status: "pending", items: [] },
            blockers,
          },
        },
      ],
    };

    const v5 = this.migrator.migrate(v1);
    const entry = v5.modules[0];
    assert.equal(v5.schemaVersion, 5);
    assert.equal(entry.currentPath, "src/fixture.js");
    assert.equal(entry.currentArea, "root");
    assert.equal(entry.observed.legacyLoadOrder, 17);
    assert.deepEqual(entry.architecture, architecture);
    assert.deepEqual(entry.analysis.blockers, blockers);
    assert.deepEqual(
      entry.observed.providers,
      this.policy.migrationManifest.initialObserved.providers,
    );
    assert.deepEqual(
      entry.observed.consumers,
      this.policy.migrationManifest.initialObserved.consumers,
    );
    assert.deepEqual(
      entry.observed.environment,
      this.policy.migrationManifest.initialObserved.environment,
    );
    assert.deepEqual(
      entry.analysis.dependencies,
      this.policy.migrationManifest.initialAnalysis.dependencies,
    );
    assert.equal(entry.analysis.dependencies.status, "pending");
    assert.deepEqual(entry.analysis.dependencies.confirmed, []);
    assert.deepEqual(entry.analysis.dependencies.items, []);

    assert.deepEqual(this.migrator.migrate(v5), v5);
    this.#assertReviewedV1DependenciesRequireManualMigration(v1);
    this.#assertReviewedV2ProvidersRequireManualMigration(v5);
    this.#assertReviewedV3NonConsumerMetadataIsPreserved(v5);
    this.#assertReviewedV3ConsumersRequireManualMigration(v5);
    this.#assertV4ObservationsArePreserved(v5);
    this.#assertReviewedV4DependenciesRequireManualMigration(v5);
    assert.throws(
      () => this.migrator.migrate({ schemaVersion: 0, modules: [] }),
      /No migration path/,
    );
    assert.throws(
      () => this.migrator.migrate({ schemaVersion: 6, modules: [] }),
      /future manifest schema/,
    );
  }

  #assertReviewedV1DependenciesRequireManualMigration(v1) {
    const reviewed = JSON.parse(JSON.stringify(v1));
    reviewed.modules[0].analysis.dependencies = {
      status: "verified",
      items: ["src/legacy_dependency.js"],
    };
    assert.throws(
      () => this.migrator.migrate(reviewed),
      /reviewed v1 data requires an explicit manual migration/,
    );
  }

  #assertReviewedV2ProvidersRequireManualMigration(v5) {
    const reviewed = JSON.parse(JSON.stringify(v5));
    reviewed.schemaVersion = 2;
    reviewed.modules[0].observed.providers = {
      status: "verified",
      items: [
        {
          symbol: "Fixture",
          mechanism: "global-lexical",
        },
      ],
      issues: [],
    };
    assert.throws(
      () => this.migrator.migrate(reviewed),
      /manual availability migration/,
    );
  }

  #assertReviewedV3ConsumersRequireManualMigration(v5) {
    const reviewed = JSON.parse(JSON.stringify(v5));
    reviewed.schemaVersion = 3;
    reviewed.modules[0].observed.consumers = {
      status: "verified",
      items: [
        {
          symbol: "Fixture",
          mechanism: "identifier",
          requirement: "required",
          evaluation: "eager",
        },
      ],
      issues: [],
    };
    assert.throws(
      () => this.migrator.migrate(reviewed),
      /manual semantics migration/,
    );
  }

  #assertReviewedV3NonConsumerMetadataIsPreserved(v5) {
    const v3 = JSON.parse(JSON.stringify(v5));
    v3.schemaVersion = 3;
    delete v3.modules[0].analysis.dependencies.confirmed;
    v3.modules[0].observed.providers = {
      status: "verified",
      items: [
        {
          symbol: "ReviewedProvider",
          mechanism: "global-lexical",
          availability: "program-init",
        },
      ],
      issues: [],
    };
    v3.modules[0].observed.environment = {
      status: "verified",
      builtins: ["Math"],
      browserApis: [],
      dynamicConstructs: [],
      issues: [],
    };
    const migrated = this.migrator.migrate(v3);
    assert.equal(migrated.schemaVersion, 5);
    assert.deepEqual(migrated.modules[0].observed.providers, v3.modules[0].observed.providers);
    assert.deepEqual(migrated.modules[0].observed.environment, v3.modules[0].observed.environment);
  }

  #assertV4ObservationsArePreserved(v5) {
    const v4 = JSON.parse(JSON.stringify(v5));
    v4.schemaVersion = 4;
    delete v4.modules[0].analysis.dependencies.confirmed;
    v4.modules[0].observed.providers = {
      status: "verified",
      items: [
        {
          symbol: "ReviewedProvider",
          mechanism: "global-lexical",
          availability: "program-init",
        },
      ],
      issues: [],
    };
    const observed = JSON.parse(JSON.stringify(v4.modules[0].observed));
    const architecture = JSON.parse(JSON.stringify(v4.modules[0].architecture));
    const blockers = JSON.parse(JSON.stringify(v4.modules[0].analysis.blockers));
    const migrated = this.migrator.migrate(v4);
    assert.equal(migrated.schemaVersion, 5);
    assert.deepEqual(migrated.modules[0].observed, observed);
    assert.deepEqual(migrated.modules[0].architecture, architecture);
    assert.deepEqual(migrated.modules[0].analysis.blockers, blockers);
    assert.deepEqual(migrated.modules[0].analysis.dependencies.confirmed, []);
  }

  #assertReviewedV4DependenciesRequireManualMigration(v5) {
    const reviewed = JSON.parse(JSON.stringify(v5));
    reviewed.schemaVersion = 4;
    delete reviewed.modules[0].analysis.dependencies.confirmed;
    reviewed.modules[0].analysis.dependencies.status = "verified";
    assert.throws(
      () => this.migrator.migrate(reviewed),
      /manual provenance migration/,
    );
  }
}

const policy = ArchitecturePolicy.load(POLICY_PATH);
new MigrationManifestSchemaMigrationCheck({
  policy,
  migrator: createMigrationManifestSchemaMigrator(policy.migrationManifest),
}).run();

console.log(
  "Migration manifest schema migration passed: v1 → v2 → v3 → v4 → v5 is explicit, conservative, and metadata-preserving.",
);
