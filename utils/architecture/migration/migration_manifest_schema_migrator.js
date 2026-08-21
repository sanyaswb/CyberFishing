class MigrationManifestV1ToV2Migration {
  constructor({ definition, manifestPolicy }) {
    this.definition = definition;
    this.manifestPolicy = manifestPolicy;
  }

  get fromVersion() {
    return this.definition.fromVersion;
  }

  get toVersion() {
    return this.definition.toVersion;
  }

  migrate(manifest) {
    return {
      ...this.#clone(manifest),
      schemaVersion: this.toVersion,
      modules: manifest.modules.map((entry) => this.#migrateEntry(entry)),
    };
  }

  #migrateEntry(entry) {
    this.#assertPendingLegacyDependencies(entry);
    return {
      ...this.#clone(entry),
      observed: {
        ...this.#clone(entry.observed),
        ...this.#clone(this.manifestPolicy.initialObserved),
      },
      architecture: this.#clone(entry.architecture),
      analysis: {
        ...this.#clone(entry.analysis),
        dependencies: this.#v2Dependencies(),
        blockers: this.#clone(entry.analysis?.blockers),
      },
    };
  }

  #assertPendingLegacyDependencies(entry) {
    const dependencies = entry.analysis?.dependencies;
    if (
      dependencies?.status === this.definition.preconditions.dependencyStatus &&
      Array.isArray(dependencies.items) &&
      dependencies.items.length === 0
    ) {
      return;
    }
    throw new Error(
      `Cannot migrate ${entry.currentPath} from manifest v1 to v2: ` +
        "legacy dependencies must be pending with an empty items array; " +
        "reviewed v1 data requires an explicit manual migration.",
    );
  }

  #v2Dependencies() {
    const dependencies = this.#clone(
      this.manifestPolicy.initialAnalysis.dependencies,
    );
    delete dependencies.confirmed;
    return dependencies;
  }

  #clone(value) {
    return value === undefined
      ? undefined
      : JSON.parse(JSON.stringify(value));
  }
}

class MigrationManifestV2ToV3Migration {
  constructor(definition) {
    this.definition = definition;
  }

  get fromVersion() {
    return this.definition.fromVersion;
  }

  get toVersion() {
    return this.definition.toVersion;
  }

  migrate(manifest) {
    for (const entry of manifest.modules) {
      this.#assertPendingProviders(entry);
    }
    return {
      ...this.#clone(manifest),
      schemaVersion: this.toVersion,
    };
  }

  #assertPendingProviders(entry) {
    const providers = entry.observed?.providers;
    if (
      providers?.status === this.definition.preconditions.providerStatus &&
      Array.isArray(providers.items) &&
      providers.items.length === 0 &&
      Array.isArray(providers.issues) &&
      providers.issues.length === 0
    ) {
      return;
    }
    throw new Error(
      `Cannot migrate ${entry.currentPath} from manifest v2 to v3: ` +
        "providers must be pending with empty items and issues; reviewed v2 " +
        "provider data requires an explicit manual availability migration.",
    );
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class MigrationManifestV3ToV4Migration {
  constructor(definition) {
    this.definition = definition;
  }

  get fromVersion() {
    return this.definition.fromVersion;
  }

  get toVersion() {
    return this.definition.toVersion;
  }

  migrate(manifest) {
    for (const entry of manifest.modules) {
      this.#assertPendingConsumers(entry);
    }
    return {
      ...this.#clone(manifest),
      schemaVersion: this.toVersion,
    };
  }

  #assertPendingConsumers(entry) {
    const consumers = entry.observed?.consumers;
    if (
      consumers?.status === this.definition.preconditions.consumerStatus &&
      Array.isArray(consumers.items) &&
      consumers.items.length === 0 &&
      Array.isArray(consumers.issues) &&
      consumers.issues.length === 0
    ) {
      return;
    }
    throw new Error(
      `Cannot migrate ${entry.currentPath} from manifest v3 to v4: ` +
        "consumers must be pending with empty items and issues; reviewed v3 " +
        "consumer data requires an explicit manual semantics migration.",
    );
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class MigrationManifestV4ToV5Migration {
  constructor(definition) {
    this.definition = definition;
  }

  get fromVersion() {
    return this.definition.fromVersion;
  }

  get toVersion() {
    return this.definition.toVersion;
  }

  migrate(manifest) {
    return {
      ...this.#clone(manifest),
      schemaVersion: this.toVersion,
      modules: manifest.modules.map((entry) => this.#migrateEntry(entry)),
    };
  }

  #migrateEntry(entry) {
    this.#assertPendingDependencies(entry);
    const dependencies = entry.analysis.dependencies;
    return {
      ...this.#clone(entry),
      analysis: {
        ...this.#clone(entry.analysis),
        dependencies: {
          status: dependencies.status,
          confirmed: [],
          items: this.#clone(dependencies.items),
          unresolved: this.#clone(dependencies.unresolved),
          ambiguous: this.#clone(dependencies.ambiguous),
          issues: this.#clone(dependencies.issues),
        },
      },
    };
  }

  #assertPendingDependencies(entry) {
    const dependencies = entry.analysis?.dependencies;
    if (
      dependencies?.status === this.definition.preconditions.dependencyStatus &&
      dependencies.confirmed === undefined &&
      this.#isEmpty(dependencies.items) &&
      this.#isEmpty(dependencies.unresolved) &&
      this.#isEmpty(dependencies.ambiguous) &&
      this.#isEmpty(dependencies.issues)
    ) {
      return;
    }
    throw new Error(
      `Cannot migrate ${entry.currentPath} from manifest v4 to v5: ` +
        "dependencies must be pending and unresolved; reviewed v4 resolution " +
        "data requires an explicit manual provenance migration.",
    );
  }

  #isEmpty(value) {
    return Array.isArray(value) && value.length === 0;
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class MigrationManifestSchemaMigrator {
  constructor({ targetVersion, migrations }) {
    this.targetVersion = targetVersion;
    this.migrations = new Map(
      migrations.map((migration) => [migration.fromVersion, migration]),
    );
  }

  migrate(manifest) {
    if (!manifest) return null;
    if (!Number.isInteger(manifest.schemaVersion)) {
      throw new Error("Migration manifest requires an integer schemaVersion");
    }
    if (manifest.schemaVersion > this.targetVersion) {
      throw new Error(
        `Cannot migrate future manifest schema v${manifest.schemaVersion}; ` +
          `supported target is v${this.targetVersion}.`,
      );
    }

    let migrated = manifest;
    while (migrated.schemaVersion < this.targetVersion) {
      const migration = this.migrations.get(migrated.schemaVersion);
      if (!migration) {
        throw new Error(
          `No migration path from manifest schema v${migrated.schemaVersion} ` +
            `to v${this.targetVersion}.`,
        );
      }
      migrated = migration.migrate(migrated);
    }
    return migrated;
  }
}

function createMigrationManifestSchemaMigrator(manifestPolicy) {
  const v1ToV2Definition = manifestPolicy.schemaMigrations.find(
    (migration) =>
      migration.fromVersion === 1 && migration.toVersion === 2,
  );
  if (!v1ToV2Definition) {
    throw new Error("Manifest policy is missing the v1 to v2 schema migration");
  }
  const v2ToV3Definition = manifestPolicy.schemaMigrations.find(
    (migration) =>
      migration.fromVersion === 2 && migration.toVersion === 3,
  );
  if (!v2ToV3Definition) {
    throw new Error("Manifest policy is missing the v2 to v3 schema migration");
  }
  const v3ToV4Definition = manifestPolicy.schemaMigrations.find(
    (migration) =>
      migration.fromVersion === 3 && migration.toVersion === 4,
  );
  if (!v3ToV4Definition) {
    throw new Error("Manifest policy is missing the v3 to v4 schema migration");
  }
  const v4ToV5Definition = manifestPolicy.schemaMigrations.find(
    (migration) =>
      migration.fromVersion === 4 && migration.toVersion === 5,
  );
  if (!v4ToV5Definition) {
    throw new Error("Manifest policy is missing the v4 to v5 schema migration");
  }
  return new MigrationManifestSchemaMigrator({
    targetVersion: manifestPolicy.schemaVersion,
    migrations: [
      new MigrationManifestV1ToV2Migration({
        definition: v1ToV2Definition,
        manifestPolicy,
      }),
      new MigrationManifestV2ToV3Migration(v2ToV3Definition),
      new MigrationManifestV3ToV4Migration(v3ToV4Definition),
      new MigrationManifestV4ToV5Migration(v4ToV5Definition),
    ],
  });
}

module.exports = {
  MigrationManifestSchemaMigrator,
  MigrationManifestV1ToV2Migration,
  MigrationManifestV2ToV3Migration,
  MigrationManifestV3ToV4Migration,
  MigrationManifestV4ToV5Migration,
  createMigrationManifestSchemaMigrator,
};
