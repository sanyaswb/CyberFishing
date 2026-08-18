const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const Assertion = CheckAssertion.create("Item state hardening check");

class ItemStateHardeningRuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    runtime.loadMany([
      "src/config/items/item_stat_override_config.js",
      "src/core/items/item_stat_override_policy.js",
      "src/core/items/effective_item_stats_resolver.js",
      "src/application/inventory/inventory_v2_item_hydrator.js",
      "src/core/items/freshness/item_freshness_state_policy.js",
      "src/infrastructure/storage/inventory_item_snapshot_mapper.js",
      "src/infrastructure/storage/legacy_item_state_migration.js",
      "src/infrastructure/storage/inventory_v2_state_store.js",
      "src/infrastructure/storage/inventory_v2_snapshot_migration.js",
      "src/infrastructure/storage/inventory_v2_snapshot_factory.js",
    ]).expose({
      OverridePolicy: "ItemStatOverridePolicy",
      EffectiveStatsResolver: "EffectiveItemStatsResolver",
      Hydrator: "InventoryV2ItemHydrator",
      SnapshotMapper: "InventoryItemSnapshotMapper",
      LegacyMigration: "LegacyItemStateMigration",
      SnapshotMigration: "InventoryV2SnapshotMigration",
      StateStore: "InventoryV2StateStore",
      SnapshotFactory: "InventoryV2SnapshotFactory",
    });
    return runtime.context;
  }
}

class ItemStateHardeningCheck {
  #runtime;
  #definitions;

  constructor(runtime) {
    this.#runtime = runtime;
    this.#definitions = {
      line: {
        id: "line",
        name: "Canonical line",
        itemType: "fishing_line",
        variant: "monofilament",
        rarityProfile: {
          mode: "authored",
          tier: 2,
          maxTier: 5,
          isUnique: false,
        },
        progressionProfile: { groupId: "line.fishing" },
        gameplayStats: {
          lengthMeters: 25,
          maxLoadKg: 1,
          durability: 100,
          quality: 5,
        },
      },
      rod: {
        id: "rod",
        name: "Canonical rod",
        itemType: "rod",
        variant: "spinning",
        gameplayStats: {
          lengthMeters: 2.4,
          maxLoadKg: 1,
          equipmentPowerLevel: 4,
          durability: 100,
        },
      },
    };
  }

  run() {
    this.#checkOverrideSchema();
    this.#checkDefinitionOwnedHydration();
    this.#checkStrictSnapshotDto();
    this.#checkNarrowLegacyMigration();
    this.#checkCanonicalSchemaNormalization();
    this.#checkSnapshotFactoryBoundary();
    this.#checkStateStoreBoundary();
  }

  #checkOverrideSchema() {
    Assertion.throws(
      () => new this.#runtime.OverridePolicy({
        config: {
          stats: {
            invalid: { valueType: "mystery", operations: ["set"] },
          },
        },
      }),
      "invalid override schema fails during composition",
    );
    const resolver = new this.#runtime.EffectiveStatsResolver();
    const resolved = resolver.resolve({
      definition: this.#definitions.line,
      instanceState: {
        statOverrides: {
          lengthMeters: 12,
          durability: 80,
          quality: 8,
        },
      },
    });
    Assertion.equal(resolved.lengthMeters, 12, "mutable line length is applied");
    Assertion.equal(resolved.durability, 80, "mutable durability is applied");
    Assertion.equal(resolved.quality, 8, "mutable instance quality is applied");
    Assertion.equal(resolved.maxLoadKg, 1, "authored balance remains definition-owned");
    Assertion.that(
      Object.isFrozen(resolved),
      "effective item stats remain immutable",
    );

    Assertion.throws(
      () => resolver.resolve({
        definition: this.#definitions.line,
        instanceState: { statOverrides: { maxloadKg: 999 } },
      }),
      "misspelled override is rejected",
    );
    Assertion.throws(
      () => resolver.resolve({
        definition: this.#definitions.line,
        instanceState: { statOverrides: { ghostStat: 123 } },
      }),
      "unknown override is rejected",
    );
    Assertion.throws(
      () => resolver.resolve({
        definition: this.#definitions.line,
        instanceState: { statOverrides: { maxLoadKg: 999 } },
      }),
      "immutable authored stat is rejected",
    );
    Assertion.throws(
      () => resolver.resolve({
        definition: this.#definitions.rod,
        instanceState: { statOverrides: { lengthMeters: 5 } },
      }),
      "line-length state cannot override rod definition length",
    );
  }

  #checkDefinitionOwnedHydration() {
    const hydrator = new this.#runtime.Hydrator({
      itemDefinitionResolver: (itemId) => this.#definitions[itemId] || null,
    });
    const hydrated = hydrator.hydrate({
      instanceId: "line-instance",
      itemId: "line",
      itemType: "lure",
      variant: "spinner",
      name: "Forged name",
      progressionProfile: { groupId: "forged.group" },
      quantity: 1,
      location: { kind: "INVENTORY" },
      statOverrides: { lengthMeters: 12 },
    });
    Assertion.equal(hydrated.itemType, "fishing_line", "definition owns itemType");
    Assertion.equal(hydrated.variant, "monofilament", "definition owns variant");
    Assertion.equal(hydrated.name, "Canonical line", "definition metadata wins");
    Assertion.equal(
      hydrated.progressionProfile.groupId,
      "line.fishing",
      "runtime cannot replace progression metadata",
    );
    Assertion.equal(
      hydrated.effectiveStats.lengthMeters,
      12,
      "hydration still applies a legal instance fact",
    );
  }

  #checkStrictSnapshotDto() {
    const mapper = this.#mapper();
    const snapshot = mapper.toSnapshot({
      instanceId: "line-instance",
      itemId: "line",
      quantity: 1,
      location: { kind: "INVENTORY" },
      itemType: "lure",
      variant: "spinner",
      name: "Forged name",
      gameplayStats: { maxLoadKg: 999 },
      engineStats: { maxLoadKg: 999 },
      effectiveStats: { maxLoadKg: 999 },
      progression: { rating: { percent: 100 } },
      displayStats: { forged: true },
      statOverrides: { lengthMeters: 12 },
      recipe: "test-recipe",
    });
    Assertion.deepEqual(
      Object.keys(snapshot).sort(),
      [
        "instanceId",
        "itemId",
        "location",
        "quantity",
        "recipe",
        "statOverrides",
      ].sort(),
      "snapshot contains only whitelisted instance facts",
    );
    Assertion.equal(
      snapshot.statOverrides.lengthMeters,
      12,
      "snapshot preserves a legal mutable stat",
    );
    Assertion.throws(
      () => mapper.toSnapshot({
        instanceId: "invalid-line",
        itemId: "line",
        quantity: 1,
        location: { kind: "INVENTORY" },
        statOverrides: { ghostStat: 123 },
      }),
      "persistence rejects invalid overrides",
    );
  }

  #checkNarrowLegacyMigration() {
    const warnings = [];
    const migration = new this.#runtime.LegacyMigration();
    const migrated = migration.migrate(
      {
        instanceId: "legacy-rod",
        itemId: "rod",
        itemType: "bait",
        variant: "natural",
        quantity: 1,
        location: { kind: "INVENTORY" },
        maxLoadKg: 3,
        engineStats: {
          maxLoadKg: 3,
          equipmentPowerLevel: 9,
        },
        statOverrides: {
          maxLoadKg: 3,
          equipmentPowerLevel: 9,
          durability: 72,
        },
      },
      this.#definitions.rod,
      { warnings },
    );
    Assertion.deepEqual(
      migrated.statOverrides,
      { durability: 72 },
      "legacy migration keeps only confirmed mutable instance state",
    );
    Assertion.that(
      !("itemType" in migrated) && !("variant" in migrated),
      "legacy classification is not copied into runtime state",
    );
    Assertion.that(
      warnings.length > 0,
      "discarded legacy classification and balance produce diagnostics",
    );
  }

  #checkSnapshotFactoryBoundary() {
    const mapper = this.#mapper();
    const factory = new this.#runtime.SnapshotFactory({
      repository: {
        list: () => [{
          instanceId: "line-instance",
          itemId: "line",
          quantity: 1,
          location: { kind: "INVENTORY" },
          itemType: "forged",
          effectiveStats: { lengthMeters: 999 },
          statOverrides: { lengthMeters: 12 },
        }],
      },
      assemblyStates: { toSnapshot: () => [] },
      equipmentState: { snapshot: () => ({}) },
      loadouts: { toSnapshot: () => [] },
      settings: { snapshot: () => ({}) },
      refillMemory: { snapshot: () => ({}) },
      itemSnapshotMapper: mapper,
    });
    const snapshot = factory.create();
    Assertion.that(
      !("itemType" in snapshot.items[0]) &&
        !("effectiveStats" in snapshot.items[0]),
      "snapshot factory cannot bypass the strict item DTO",
    );
  }

  #checkCanonicalSchemaNormalization() {
    const migration = new this.#runtime.SnapshotMigration({
      itemDefinitionResolver: (itemId) => this.#definitions[itemId] || null,
      targetSchemaVersion: 4,
    });
    const result = migration.migrate({
      schemaVersion: 4,
      items: [{
        instanceId: "quality-line",
        itemId: "line",
        quantity: 1,
        location: { kind: "INVENTORY" },
        itemType: "forged",
        statOverrides: { quality: 8, lengthMeters: 20 },
      }],
      assemblies: [],
      equipment: {},
      loadouts: [],
      settings: {},
    });
    Assertion.deepEqual(
      result.snapshot.items[0].statOverrides,
      { quality: 8, lengthMeters: 20 },
      "current-schema normalization preserves valid canonical overrides",
    );
    Assertion.that(
      !("itemType" in result.snapshot.items[0]),
      "current-schema normalization still strips definition classification",
    );
  }

  #checkStateStoreBoundary() {
    const values = new Map();
    const cache = {
      get(key, fallback) {
        return values.has(key) ? values.get(key) : fallback;
      },
      set(key, value) {
        values.set(key, value);
      },
    };
    const store = new this.#runtime.StateStore({
      cache,
      itemSnapshotMapper: this.#mapper(),
    });
    const saved = store.save({
      items: [{
        instanceId: "stored-line",
        itemId: "line",
        quantity: 1,
        location: { kind: "INVENTORY" },
        itemType: "forged",
        progression: { rating: { percent: 100 } },
        statOverrides: { lengthMeters: 10 },
      }],
      assemblies: [],
      equipment: {},
      loadouts: [],
      settings: {},
    });
    Assertion.that(
      !("itemType" in saved.items[0]) && !("progression" in saved.items[0]),
      "state store reapplies the strict item DTO at the final persistence boundary",
    );
  }

  #mapper() {
    return new this.#runtime.SnapshotMapper({
      itemDefinitionResolver: (itemId) => this.#definitions[itemId] || null,
    });
  }
}

const runtime = new ItemStateHardeningRuntimeLoader().load();
new ItemStateHardeningCheck(runtime).run();
console.log("Item state hardening checks passed.");
