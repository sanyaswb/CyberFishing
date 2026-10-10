const path = require("node:path");
const { CheckAssertion } = require("./testing/core/check_assertion");
const { NativeEsmTestLoader } = require("./testing/runtime/native_esm_test_loader");
const vm = require("node:vm");

const Assertion = CheckAssertion.create(
  "Inventory production-shaped equipment hydration check",
);

class EquipmentHydrationRuntime {
  constructor() {
    this.context = vm.createContext({
      console,
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
    });
    this.loader = new NativeEsmTestLoader({ projectRoot: path.resolve(__dirname, ".."), context: this.context });

    const load = (file, names) => {
      this.loader.load(file, names);
      for (const name of names) {
        this[name] = this.context[name];
      }
    };

    load("src/game/domain/inventory/inventory_item_location.js", ["InventoryItemLocationKind", "InventoryItemLocation"]);
    load("src/game/domain/inventory/flat_inventory_item_repository.js", ["FlatInventoryItemRepository"]);
    load("src/game/domain/items/effective_item_stats_resolver.js", ["EffectiveItemStatsResolver"]);
    load("src/game/application/inventory/inventory_item_hydrator.js", ["InventoryItemHydrator"]);
    load("src/game/domain/assemblies/item_assembly_reader.js", ["ItemAssemblyReader"]);
    load("src/game/application/inventory/equipment_read_model_factory.js", ["EquipmentReadModelFactory"]);
    load("src/game/domain/casting/distance_unit_converter.js", ["DistanceUnitConverter"]);
    load("src/game/domain/casting/cast_distance_calculator.js", ["CastDistanceCalculator"]);
    load("src/game/domain/fishing/line_spool_state.js", ["LineSpoolState"]);
    load("src/game/domain/fishing/line_system.js", ["LineSystem"]);
    load("src/game/config/physics/fight_physics_config_adapter.js", ["FightPhysicsConfigAdapter"]);
    load("src/game/application/fishing/fight_session_factory.js", ["FightSessionFactory"]);
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
    const hydrator = new r.InventoryItemHydrator({
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
    // Production composition always gives the session factory its physics adapter.
    const fightConfig = { physics: { pixelsPerMeter: 50 } };
    fightConfig.fightPhysicsConfig = new this.runtime.FightPhysicsConfigAdapter(fightConfig);
    const session = new this.runtime.FightSessionFactory({
      config: fightConfig,
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
  }

  #checkCanonicalIdentityIsPreserved(canonicalRod) {
    const factory = new this.runtime.EquipmentReadModelFactory({
      itemReader: () => {
        throw new Error("already hydrated items must not be read again");
      },
      // An empty assembly: the full reader contract with no children, state or capacity.
      assemblyReader: { getChild: () => null, getChildren: () => [], getAssemblyState: () => null, getSlotCapacity: () => null },
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
      // An empty assembly: the full reader contract with no children, state or capacity.
      assemblyReader: { getChild: () => null, getChildren: () => [], getAssemblyState: () => null, getSlotCapacity: () => null },
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
}

const runtime = new EquipmentHydrationRuntime().context;
new ProductionShapedEquipmentHydrationCheck(runtime).run();
console.log(
  "Inventory production-shaped equipment hydration checks passed.",
);
