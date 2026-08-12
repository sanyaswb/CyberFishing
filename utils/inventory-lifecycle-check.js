const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { CheckAssertion } = require("./testing/core/check_assertion");

const ROOT = path.resolve(__dirname, "..");
const Assertion = CheckAssertion.create("Inventory lifecycle check");

class MemoryCacheManager {
  static values = new Map();
  static writes = [];

  static set(key, value) {
    this.values.set(key, this.#clone(value));
    this.writes.push(key);
  }

  static get(key, defaultValue = null) {
    return this.values.has(key) ? this.#clone(this.values.get(key)) : defaultValue;
  }

  static reset() {
    this.values.clear();
    this.writes.length = 0;
  }

  static resetWrites() {
    this.writes.length = 0;
  }

  static #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class InventoryEventProbe {
  inventoryChangedCount = 0;

  emit(type) {
    if (type === "inventory-changed") this.inventoryChangedCount++;
  }

  on() {
    return () => {};
  }

  clear() {}

  reset() {
    this.inventoryChangedCount = 0;
  }
}

class InventoryRuntimeLoader {
  load() {
    const context = vm.createContext({
      CacheManager: MemoryCacheManager,
      ReelRetrieveSpeedCalculator: class {
        calculate({ baseSpeedMetersPerSec = 0 } = {}) {
          return baseSpeedMetersPerSec;
        }
      },
      console,
    });

    this.#loadSlotConfig(context);
    this.#loadClass(
      context,
      "src/core/line/line_allocation_policy.js",
      "LineAllocationPolicy",
    );
    this.#loadClass(
      context,
      "src/core/line/line_inventory_controller.js",
      "LineInventoryController",
    );
    this.#loadClass(
      context,
      "src/core/items/rarity/item_rarity_descriptor.js",
      "ItemRarityDescriptor",
    );
    this.#loadClass(
      context,
      "src/core/items/rarity/item_rarity_strategy.js",
      "ItemRarityStrategy",
    );
    this.#loadClass(
      context,
      "src/core/items/rarity/authored_item_rarity_strategy.js",
      "AuthoredItemRarityStrategy",
    );
    this.#loadClass(
      context,
      "src/core/items/rarity/item_rarity_strategy_registry.js",
      "ItemRarityStrategyRegistry",
    );
    this.#loadClass(
      context,
      "src/core/items/rarity/item_rarity_resolver.js",
      "ItemRarityResolver",
    );
    this.#loadClass(
      context,
      "src/core/inventory/inventory_item_stacking_policy.js",
      "InventoryItemStackingPolicy",
    );
    this.#loadClass(
      context,
      "src/core/items/effective_item_stats_resolver.js",
      "EffectiveItemStatsResolver",
    );
    this.#loadClass(
      context,
      "src/systems/inventory_item_factory.js",
      "InventoryItemFactory",
    );
    this.#loadClass(context, "src/systems/inventory_system.js", "InventoryManager");
    return context.InventoryManager;
  }

  #loadSlotConfig(context) {
    const source = this.#read("src/config/config.js");
    const match = source.match(/const SLOT_CONFIG = [\s\S]*?\n};/);
    Assertion.that(match, "SLOT_CONFIG can be loaded for integration checks");
    vm.runInContext(`${match[0]}\nglobalThis.SLOT_CONFIG = SLOT_CONFIG;`, context);
  }

  #loadClass(context, relativePath, className) {
    const source = this.#read(relativePath);
    vm.runInContext(
      `${source}\nglobalThis.${className} = ${className};`,
      context,
      { filename: relativePath },
    );
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  }
}

class InventoryFixtureFactory {
  #InventoryManager;

  constructor(InventoryManager) {
    this.#InventoryManager = InventoryManager;
  }

  createFloatBuildFixture({ resetCache = true } = {}) {
    return this.#createFixture({
      resetCache,
      inventory: [
        this.#box("build-a", "Build A"),
        this.#item("rod-a", "rod_float", "build-a"),
        this.#line("line-a", "build-a", 25),
      ],
    });
  }

  createReelBuildFixture() {
    return this.#createFixture({
      inventory: [
        this.#box("build-a", "Build A"),
        this.#item("rod-spin", "rod_spin", "build-a"),
        this.#item("rod-float", "rod_float", null),
        this.#item("reel-a", "reel", "build-a"),
        this.#line("line-a", "build-a", 25),
      ],
    });
  }

  createTwoBuildFixture() {
    return this.#createFixture({
      inventory: [
        this.#box("build-a", "Build A"),
        this.#item("rod-a", "rod_float", "build-a"),
        this.#line("line-a", "build-a", 25),
        this.#box("build-b", "Build B"),
        this.#item("rod-b", "rod_float", "build-b"),
        this.#line("line-b", "build-b", 25),
      ],
    });
  }

  createFallbackFixture() {
    return this.#createFixture({
      inventory: [
        this.#box("build-a", "Build A"),
        this.#box("build-b", "Build B"),
        this.#item("rod-a", "rod_float", "build-a"),
        this.#line("line-a-fallback", "build-a", 15),
        this.#line("line-b-source", "build-b", 15),
        {
          ...this.#line("line-a-segment", "build-a", 10),
          detachedLineSegment: true,
          sourceLineItemId: "line",
          sourceLineInstanceId: "line-b-source",
        },
      ],
      equipment: {
        rodId: "rod-a",
        lineId: "line-a-segment",
      },
    });
  }

  createLegacyRigMigrationFixture() {
    return this.#createFixture({
      inventory: [
        this.#item("legacy-feeder-rig", "feeder_rig", null),
        this.#item("legacy-sinker", "sinker_light", null),
      ],
      equipment: {
        sinkerId: "legacy-feeder-rig",
      },
    });
  }

  #createFixture({ inventory, equipment = {}, resetCache = true }) {
    if (resetCache) MemoryCacheManager.reset();
    const events = new InventoryEventProbe();
    const manager = new this.#InventoryManager(
      this.#createItemDatabase(),
      { inventory, equipment },
      events,
      this.#createCastDistanceCalculator(),
      null,
      { getReelConfig: () => ({}) },
    );
    return { manager, events };
  }

  #createItemDatabase() {
    return {
      rods: {
        rod_float: {
          id: "rod_float",
          name: "Float rod",
          itemType: "rod",
          variant: "float",
          rarityProfile: this.#ordinaryRarity(),
          gameplayStats: {
            lengthMeters: 5,
            hasReel: false,
            maxHooks: 1,
            capabilities: ["float", "hook"],
          },
        },
        rod_spin: {
          id: "rod_spin",
          name: "Spinning rod",
          itemType: "rod",
          variant: "spinning",
          rarityProfile: this.#ordinaryRarity(),
          gameplayStats: {
            lengthMeters: 3,
            hasReel: true,
            maxHooks: 1,
            capabilities: ["reel", "lure"],
          },
        },
      },
      reels: {
        reel: {
          id: "reel",
          name: "Reel",
          itemType: "reel",
          variant: "spinning_reel",
          rarityProfile: this.#ordinaryRarity(),
          gameplayStats: {
            requiresTag: "reel",
            lineCapacityMeters: 10,
          },
        },
      },
      lines: {
        line: {
          id: "line",
          name: "Line",
          itemType: "fishing_line",
          rarityProfile: this.#ordinaryRarity(),
          gameplayStats: {
            lengthMeters: 25,
            maxLoadKg: 1,
            diameterMm: 0.22,
            durability: 100,
          },
        },
      },
      tackle: {
        feeder_rig: {
          id: "feeder_rig",
          name: "Feeder rig",
          itemType: "feeder_rig",
          rarityProfile: this.#ordinaryRarity(),
          gameplayStats: {
            requiresTag: "feeder_rig",
            capabilities: ["hook", "bait", "chum_mix"],
          },
        },
      },
      system: {
        sys_build_box: {
          id: "sys_build_box",
          name: "Build box",
          itemType: "build_box",
          rarityProfile: null,
          gameplayStats: {},
        },
      },
      builds: {},
    };
  }

  #ordinaryRarity() {
    return {
      mode: "authored",
      tier: 1,
      maxTier: 5,
      isUnique: false,
    };
  }

  #createCastDistanceCalculator() {
    return {
      getBuildCastPowerCoefficient: () => 1,
      describe: (equipment) => {
        const lineLengthMeters = Number(
          equipment?.line?.effectiveStats?.lengthMeters,
        ) || 0;
        return {
          pixelsPerMeter: 10,
          lineLengthMeters,
          effectiveDistanceMeters: lineLengthMeters,
          effectiveDistancePx: lineLengthMeters * 10,
          maxDistancePx: lineLengthMeters * 10,
        };
      },
    };
  }

  #box(instanceId, buildName) {
    return {
      instanceId,
      itemId: "sys_build_box",
      quantity: 1,
      buildName,
      itemType: "build_box",
    };
  }

  #item(instanceId, itemId, buildId) {
    return { instanceId, itemId, buildId, quantity: 1 };
  }

  #line(instanceId, buildId, lengthMeters) {
    return {
      ...this.#item(instanceId, "line", buildId),
      statOverrides: { lengthMeters },
    };
  }
}

class InventoryLifecycleCheckSuite {
  #fixtures;

  constructor(fixtures) {
    this.#fixtures = fixtures;
  }

  run() {
    this.#checkDirectLineUnequip();
    this.#checkRodCascade();
    this.#checkReelCascade();
    this.#checkRodTypeReplacement();
    this.#checkEquippedLineReplacement();
    this.#checkBuildSwitchTransaction();
    this.#checkActiveBuildDisassembly();
    this.#checkBuildAwareFallback();
    this.#checkRealLineLoss();
    this.#checkCacheReload();
    this.#checkRepeatedCycles();
    this.#checkLegacyRigMigration();
  }

  #checkDirectLineUnequip() {
    const fixture = this.#fixtures.createFloatBuildFixture();
    this.#equipFloatLine(fixture.manager);
    this.#assertAllocatedLine(fixture.manager, "build-a");
    this.#resetCommitProbe(fixture.events);

    fixture.manager.unequipItem("line");

    this.#assertSingleLine(fixture.manager, "build-a", 25);
    this.#assertSingleCommit(fixture.events, "direct line unequip");
  }

  #checkRodCascade() {
    const fixture = this.#fixtures.createFloatBuildFixture();
    this.#equipFloatLine(fixture.manager);
    this.#resetCommitProbe(fixture.events);

    fixture.manager.unequipItem("rod");

    this.#assertSingleLine(fixture.manager, "build-a", 25);
    Assertion.equal(fixture.manager.getEquipped().line, null, "rod cascade clears line");
    this.#assertSingleCommit(fixture.events, "rod cascade");
  }

  #checkReelCascade() {
    const fixture = this.#fixtures.createReelBuildFixture();
    Assertion.that(fixture.manager.equipItem("rod", "rod-spin"), "spinning rod equips");
    Assertion.that(fixture.manager.equipItem("reel", "reel-a"), "reel equips");
    Assertion.that(fixture.manager.equipItem("line", "line-a"), "reel line equips");
    this.#resetCommitProbe(fixture.events);

    fixture.manager.unequipItem("reel");

    this.#assertSingleLine(fixture.manager, "build-a", 25);
    this.#assertSingleCommit(fixture.events, "reel cascade");
  }

  #checkRodTypeReplacement() {
    const fixture = this.#fixtures.createReelBuildFixture();
    Assertion.that(fixture.manager.equipItem("rod", "rod-spin"), "spinning rod equips");
    Assertion.that(fixture.manager.equipItem("reel", "reel-a"), "reel equips");
    Assertion.that(fixture.manager.equipItem("line", "line-a"), "reel line equips");
    this.#resetCommitProbe(fixture.events);

    Assertion.that(
      fixture.manager.equipItem("rod", "rod-float"),
      "different rod type equips",
    );

    this.#assertSingleLine(fixture.manager, "build-a", 25);
    Assertion.equal(fixture.manager.getEquipped().line, null, "rod replacement clears line");
    this.#assertSingleCommit(fixture.events, "rod type replacement");
  }

  #checkBuildSwitchTransaction() {
    const fixture = this.#fixtures.createTwoBuildFixture();
    fixture.manager.equipBuild("build-a");
    this.#assertAllocatedLine(fixture.manager, "build-a");
    this.#resetCommitProbe(fixture.events);

    fixture.manager.equipBuild("build-b");

    this.#assertSingleLine(fixture.manager, "build-a", 25);
    this.#assertAllocatedLine(fixture.manager, "build-b");
    Assertion.equal(
      fixture.manager.getEquipped().line?.buildId,
      "build-b",
      "build switch equips only the new build line",
    );
    this.#assertSingleCommit(fixture.events, "build switch");
  }

  #checkEquippedLineReplacement() {
    const fixture = this.#fixtures.createTwoBuildFixture();
    fixture.manager.equipBuild("build-a");
    this.#resetCommitProbe(fixture.events);

    Assertion.that(
      fixture.manager.equipItem("line", "line-b"),
      "a different build line can replace the equipped line",
    );

    this.#assertSingleLine(fixture.manager, "build-a", 25);
    this.#assertAllocatedLine(fixture.manager, "build-b");
    Assertion.equal(
      fixture.manager.getEquipped().line?.buildId,
      "build-b",
      "line replacement equips the selected build context",
    );
    this.#assertSingleCommit(fixture.events, "equipped line replacement");
  }

  #checkBuildAwareFallback() {
    const fixture = this.#fixtures.createFallbackFixture();
    this.#resetCommitProbe(fixture.events);

    fixture.manager.unequipItem("rod");

    this.#assertSingleLine(fixture.manager, "build-a", 25);
    this.#assertSingleLine(fixture.manager, "build-b", 15);
    this.#assertSingleCommit(fixture.events, "build-aware fallback");
  }

  #checkActiveBuildDisassembly() {
    const fixture = this.#fixtures.createFloatBuildFixture();
    fixture.manager.equipBuild("build-a");
    this.#assertAllocatedLine(fixture.manager, "build-a");
    this.#resetCommitProbe(fixture.events);

    fixture.manager.disassembleBuild("build-a");

    const lines = fixture.manager
      .getInventoryItems()
      .filter((item) => item.itemId === "line");
    Assertion.equal(lines.length, 1, "disassembled build has one general line");
    Assertion.equal(lines[0].buildId, undefined, "disassembled line leaves build context");
    Assertion.equal(
      lines[0].statOverrides?.lengthMeters,
      25,
      "disassembled line preserves length",
    );
    Assertion.equal(
      fixture.manager.getEquipped().line,
      null,
      "disassembling an active build clears its line slot",
    );
    this.#assertSingleCommit(fixture.events, "active build disassembly");
  }

  #checkRealLineLoss() {
    const fixture = this.#fixtures.createFloatBuildFixture();
    this.#equipFloatLine(fixture.manager);
    Assertion.that(fixture.manager.breakEquippedLine(1), "line loss is applied");

    fixture.manager.unequipItem("rod");

    this.#assertSingleLine(fixture.manager, "build-a", 24);
  }

  #checkCacheReload() {
    const first = this.#fixtures.createFloatBuildFixture();
    this.#equipFloatLine(first.manager);
    const second = this.#fixtures.createFloatBuildFixture({ resetCache: false });
    this.#resetCommitProbe(second.events);

    second.manager.unequipItem("rod");

    this.#assertSingleLine(second.manager, "build-a", 25);
    this.#assertSingleCommit(second.events, "cache reload cascade");
  }

  #checkRepeatedCycles() {
    const fixture = this.#fixtures.createFloatBuildFixture();
    for (let i = 0; i < 10; i++) {
      Assertion.that(fixture.manager.equipItem("rod", "rod-a"), `cycle ${i + 1} rod equips`);
      const line = this.#lineItems(fixture.manager, "build-a")[0];
      Assertion.that(
        fixture.manager.equipItem("line", line.instanceId),
        `cycle ${i + 1} line equips`,
      );
      fixture.manager.unequipItem("rod");
      this.#assertSingleLine(fixture.manager, "build-a", 25);
    }
  }

  #checkLegacyRigMigration() {
    const fixture = this.#fixtures.createLegacyRigMigrationFixture();
    const equipped = fixture.manager.getEquipped();

    Assertion.equal(
      equipped.feederRig?.instanceId,
      "legacy-feeder-rig",
      "legacy feeder rig moves from sinkerId to feederRigId",
    );
    Assertion.that(
      !Object.prototype.hasOwnProperty.call(equipped, "sinker"),
      "hydrated equipment no longer exposes a sinker slot",
    );
    Assertion.that(
      !fixture.manager
        .getInventoryItems()
        .some((item) => item.itemId === "sinker_light"),
      "deprecated standalone sinker is removed during inventory migration",
    );
  }

  #equipFloatLine(manager) {
    Assertion.that(manager.equipItem("rod", "rod-a"), "float rod equips");
    Assertion.that(manager.equipItem("line", "line-a"), "float line equips");
  }

  #assertAllocatedLine(manager, buildId) {
    const lines = this.#lineItems(manager, buildId);
    Assertion.equal(lines.length, 2, `${buildId} has spool and equipped segment`);
    const segment = lines.find((item) => item.detachedLineSegment);
    const spool = lines.find((item) => !item.detachedLineSegment);
    Assertion.equal(
      segment?.statOverrides?.lengthMeters,
      10,
      `${buildId} segment is 10m`,
    );
    Assertion.equal(
      spool?.statOverrides?.lengthMeters,
      15,
      `${buildId} spool remainder is 15m`,
    );
    Assertion.equal(segment?.buildId, buildId, `${buildId} segment preserves buildId`);
  }

  #assertSingleLine(manager, buildId, lengthMeters) {
    const lines = this.#lineItems(manager, buildId);
    Assertion.equal(lines.length, 1, `${buildId} has one line instance`);
    Assertion.equal(
      lines[0].statOverrides?.lengthMeters,
      lengthMeters,
      `${buildId} line length is preserved`,
    );
    Assertion.equal(
      Boolean(lines[0].detachedLineSegment),
      false,
      `${buildId} has no detached segment`,
    );
  }

  #lineItems(manager, buildId) {
    return manager
      .getInventoryItems()
      .filter((item) => item.itemId === "line" && item.buildId === buildId);
  }

  #resetCommitProbe(events) {
    events.reset();
    MemoryCacheManager.resetWrites();
  }

  #assertSingleCommit(events, operation) {
    Assertion.equal(events.inventoryChangedCount, 1, `${operation} emits one event`);
    Assertion.equal(MemoryCacheManager.writes.length, 2, `${operation} saves once`);
    Assertion.that(
      MemoryCacheManager.writes.includes("player_inventory") &&
        MemoryCacheManager.writes.includes("player_equipment"),
      `${operation} saves inventory and equipment`,
    );
  }
}

const InventoryManager = new InventoryRuntimeLoader().load();
const fixtures = new InventoryFixtureFactory(InventoryManager);
new InventoryLifecycleCheckSuite(fixtures).run();
console.log("Inventory lifecycle checks passed.");
