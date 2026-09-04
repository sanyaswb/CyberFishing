const crypto = require("node:crypto");
const {
  verifyBatch007PostHydrationManifestEvidence,
} = require("./architecture/domain_batches/stage_three_batch_007_manifest_transition");
const fs = require("node:fs");
const path = require("node:path");
const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const Assertion = CheckAssertion.create(
  "Inventory-v2 production-shaped equipment hydration check",
);

class EquipmentHydrationRuntime extends SourceRuntime {
  constructor() {
    super({
      globals: {
        Rod: class Rod {
          constructor(
            _level,
            _power,
            _compensation,
            _type,
            _distance,
            _hasReel,
            options = {},
          ) {
            this.lengthMeters = Number(options.lengthMeters) || 2;
          }

          getLengthMeters() {
            return this.lengthMeters;
          }
        },
        Reel: class Reel {
          hasReel() {
            return true;
          }
        },
        Hook: class Hook {},
      },
    });
    this.loadMany([
      {
        path: "src/core/inventory/inventory_item_location.js",
        expose: ["InventoryItemLocationKind", "InventoryItemLocation"],
      },
      {
        path: "src/core/inventory/flat_inventory_item_repository.js",
        expose: ["FlatInventoryItemRepository"],
      },
      {
        path: "src/core/items/effective_item_stats_resolver.js",
        expose: ["EffectiveItemStatsResolver"],
      },
      {
        path: "src/application/inventory/inventory_v2_item_hydrator.js",
        expose: ["InventoryV2ItemHydrator"],
      },
      {
        path: "src/core/assemblies/item_assembly_reader.js",
        expose: ["ItemAssemblyReader"],
      },
      {
        path: "src/application/inventory/equipment_read_model_factory.js",
        expose: ["EquipmentReadModelFactory"],
      },
      {
        path: "src/core/casting_distance.js",
        expose: ["CastDistanceCalculator"],
      },
      {
        path: "src/core/line/line_spool_state.js",
        expose: ["LineSpoolState"],
      },
      {
        path: "src/systems/line_system.js",
        expose: ["LineSystem"],
      },
      {
        path: "src/app/fishing.js",
        expose: ["FightSessionFactory"],
      },
    ]);
  }
}

class ProductionShapedEquipmentFixture {
  constructor(runtime) {
    this.runtime = runtime;
    this.definitions = {
      rods: {
        rod: {
          id: "rod",
          itemType: "rod",
          variant: "feeder",
          gameplayStats: { lengthMeters: 3, maxLoadKg: 2 },
        },
      },
      reels: {
        reel: {
          id: "reel",
          itemType: "reel",
          variant: "spinning_reel",
          gameplayStats: {
            lineCapacityMeters: 20,
            maxLoadKg: 1,
            retrieveSpeedMetersPerSec: 0.8,
          },
        },
      },
      lines: {
        line: {
          id: "line",
          itemType: "fishing_line",
          gameplayStats: { lengthMeters: 10, maxLoadKg: 1 },
        },
        leader: {
          id: "leader",
          itemType: "leader_line",
          gameplayStats: { lengthMeters: 0.4, maxLoadKg: 1 },
        },
      },
      tackle: {
        rig: {
          id: "rig",
          itemType: "feeder_rig",
          gameplayStats: { hooksCount: 1 },
        },
        hook: {
          id: "hook",
          itemType: "hook",
          gameplayStats: { maxLoadKg: 1 },
        },
        bait: {
          id: "bait",
          itemType: "bait",
          gameplayStats: { biteMultiplier: 1 },
        },
      },
      chum: {
        chum: {
          id: "chum",
          itemType: "chum_mix",
          gameplayStats: { attractionMultiplier: 1 },
        },
        cargo: {
          id: "cargo",
          itemType: "chum_mix",
          gameplayStats: { attractionMultiplier: 2 },
        },
      },
      delivery: {
        boat: {
          id: "boat",
          itemType: "boat",
          gameplayStats: { sections: 1 },
        },
      },
    };
    this.rawItems = [
      this.#root("rod-instance", "rod"),
      this.#root("reel-instance", "reel"),
      this.#attached("line-instance", "line", "reel-instance", "line", 0),
      this.#root("leader-instance", "leader"),
      this.#root("rig-instance", "rig"),
      this.#attached("hook-instance", "hook", "rig-instance", "hook", 0),
      this.#attached("bait-instance", "bait", "hook-instance", "bait", 0),
      this.#attached("chum-instance", "chum", "rig-instance", "chum", 0),
      this.#root("boat-instance", "boat"),
      this.#attached("cargo-instance", "cargo", "boat-instance", "cargo", 0),
    ];
  }

  create() {
    const r = this.runtime;
    const repository = new r.FlatInventoryItemRepository({ items: this.rawItems });
    const effectiveStatsResolver = new r.EffectiveItemStatsResolver({
      overridePolicy: { normalize: ({ overrides }) => overrides || {} },
    });
    const hydrator = new r.InventoryV2ItemHydrator({
      itemDefinitionResolver: this.definitions,
      effectiveStatsResolver,
    });
    const assemblyReader = new r.ItemAssemblyReader({
      repository,
      stateRepository: { get: () => null },
      profileRegistry: {},
    });
    const factory = new r.EquipmentReadModelFactory({
      itemReader: (reference) => hydrator.hydrate(reference, repository),
      assemblyReader,
      capabilityResolver: { resolve: () => ({ supportsFeederRig: true }) },
    });
    const equipment = factory.create({
      rootInstanceIds: {
        rod: "rod-instance",
        reel: "reel-instance",
        terminalLine: "leader-instance",
        tackle: "rig-instance",
        delivery: "boat-instance",
      },
    });
    return { repository, hydrator, assemblyReader, equipment };
  }

  #root(instanceId, itemId) {
    return { instanceId, itemId, quantity: 1, location: { kind: "INVENTORY" } };
  }

  #attached(instanceId, itemId, parentInstanceId, slotId, slotIndex) {
    return {
      instanceId,
      itemId,
      quantity: 1,
      location: {
        kind: "ATTACHED",
        parentInstanceId,
        slotId,
        slotIndex,
      },
    };
  }
}

class ProductionShapedEquipmentHydrationCheck {
  constructor(runtime) {
    this.runtime = runtime;
  }

  run() {
    const { repository, hydrator, assemblyReader, equipment } =
      new ProductionShapedEquipmentFixture(this.runtime).create();
    const rawLine = repository.getChild("reel-instance", "line", 0);
    const readerLine = assemblyReader.getChild("reel-instance", "line", 0);

    Assertion.equal(
      readerLine,
      rawLine,
      "production ItemAssemblyReader preserves repository child identity",
    );
    Assertion.equal(
      Object.prototype.hasOwnProperty.call(rawLine, "effectiveStats"),
      false,
      "repository child is a raw persistence object",
    );
    Assertion.equal(
      hydrator.hydrate(rawLine, repository).effectiveStats.lengthMeters,
      10,
      "the canonical hydrator resolves child-line effective stats",
    );

    this.#assertCanonical(equipment.rod, "root rod");
    this.#assertCanonical(equipment.reel, "root reel");
    this.#assertCanonical(equipment.line, "reel child line");
    this.#assertCanonical(equipment.leader, "terminal leader");
    this.#assertCanonical(equipment.feederRig, "feeder root");
    this.#assertCanonical(equipment.hooks[0], "hook child");
    this.#assertCanonical(equipment.baits[0], "bait child");
    this.#assertCanonical(equipment.feederChum, "feeder chum child");
    this.#assertCanonical(equipment.delivery, "delivery root");
    this.#assertCanonical(equipment.deliveryChums[0], "delivery cargo child");

    Assertion.equal(
      equipment.line.effectiveStats.lengthMeters,
      10,
      "mounted line keeps its canonical effective length",
    );
    Assertion.equal(
      equipment.line.instanceId,
      rawLine.instanceId,
      "mounted line keeps repository instance identity",
    );

    const calculator = new this.runtime.CastDistanceCalculator({
      physics: { pixelsPerMeter: 50 },
    });
    Assertion.equal(
      calculator.getLineMeters(equipment.line),
      10,
      "cast-distance boundary reads canonical line length",
    );
    const session = new this.runtime.FightSessionFactory({
      config: {},
      rng: {},
      castDistanceCalculator: calculator,
    }).createEquipment(equipment);
    Assertion.equal(
      session.lineSystem.getState().totalLengthMeters,
      10,
      "FightSessionFactory carries canonical line length into LineSystem",
    );

    this.#checkCanonicalIdentityIsPreserved(equipment.rod);
    this.#checkFailClosedBoundary();
    this.#checkEvidence();
  }

  #checkCanonicalIdentityIsPreserved(canonicalRod) {
    const factory = new this.runtime.EquipmentReadModelFactory({
      itemReader: () => {
        throw new Error("already hydrated items must not be read again");
      },
      assemblyReader: { getChild: () => null },
      capabilityResolver: { resolve: () => ({ supportsFeederRig: false }) },
    });
    const equipment = factory.create({ rod: canonicalRod });
    Assertion.equal(
      equipment.rod,
      canonicalRod,
      "already hydrated items retain their canonical object identity",
    );
  }

  #checkFailClosedBoundary() {
    const factory = new this.runtime.EquipmentReadModelFactory({
      itemReader: (reference) =>
        typeof reference === "object"
          ? reference
          : { instanceId: reference, itemId: "raw" },
      assemblyReader: { getChild: () => null },
      capabilityResolver: { resolve: () => ({ supportsFeederRig: false }) },
    });
    Assertion.throws(
      () => factory.create({ rootInstanceIds: { rod: "raw-rod" } }),
      "projection fails closed when an injected reader returns raw state",
    );
  }

  #assertCanonical(item, label) {
    Assertion.that(item && typeof item === "object", `${label} exists`);
    Assertion.that(
      item.effectiveStats && typeof item.effectiveStats === "object",
      `${label} is canonically hydrated`,
    );
  }

  #checkEvidence() {
    const root = path.resolve(__dirname, "..");
    const evidence = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          "architecture/migration/evidence/stage_3_batch_007_equipment_hydration_repair.json",
        ),
        "utf8",
      ),
    );
    const sha256 = (relativePath) =>
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, relativePath)))
        .digest("hex");
    Assertion.equal(evidence.status, "verified", "repair evidence is reviewed");
    Assertion.equal(
      evidence.rootCause.classification,
      "raw-assembly-child-hydration-bypass",
      "evidence records the exact root cause",
    );
    Assertion.equal(
      sha256(evidence.rootCause.normalizationBoundary),
      evidence.evidence.normalizationBoundaryAfterSha256,
      "normalization boundary matches reviewed repair evidence",
    );
    const manifestBytes = fs.readFileSync(path.join(
      root,
      "architecture/migration/module_migration_manifest.json",
    ));
    verifyBatch007PostHydrationManifestEvidence(
      manifestBytes,
      evidence.evidence.manifestAfterSha256,
    );
  }
}

const runtime = new EquipmentHydrationRuntime().context;
new ProductionShapedEquipmentHydrationCheck(runtime).run();
console.log(
  "Inventory-v2 production-shaped equipment hydration checks passed.",
);
