"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");

const TACKLE = "src/entities/tackle.js";
const WORLD = "src/world/world.js";
const REPOSITORY = "src/core/inventory/flat_inventory_item_repository.js";
const COMPOSITION = "src/application/inventory/inventory_v2_composition_root.js";
const MIGRATION = "src/infrastructure/storage/inventory_v2_legacy_migration.js";
const INVENTORY = "src/systems/inventory_system.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";
const INDEX = "index.html";

const NET_FALLBACK = "    if (typeof DistanceUnitConverter !== \"undefined\") {\n" +
  "      return new DistanceUnitConverter(resolvedPhysics);\n    }\n\n" +
  "    const pixelsPerMeter = Math.max(\n      1,\n      Number(resolvedPhysics.pixelsPerMeter) || 50,\n    );\n" +
  "    return {\n      metersToPixels: (meters) => {\n        const value = Number(meters);\n" +
  "        return Number.isFinite(value) ? value * pixelsPerMeter : 0;\n      },\n    };\n";

// Review queue 049 (hot-loop evidence, decision framework items 3 and 4): three Domain sources of batch 049
// fail the static hot-loop proofs on facts that are not frame logic.
// - Net kept a `typeof DistanceUnitConverter` availability fallback. The converter is a completed-prefix
//   export whose activation always loads before tackle.js, so the inline fallback converter is dead; it
//   is replaced by the converter it always used (like the CastDistanceCalculator fallback of task 024).
// - LocationMap.update reads the wall clock (`new Date()`) for the time of day when no game time is given,
//   and FlatInventoryItemRepository reads it (`Date.now()`) for a fallback instance id when no id factory
//   is injected. The clock moves to composition: bootstrap passes `() => new Date()` and the inventory
//   system passes `() => Date.now()` through the inventory composition root (closures created once). The
//   deferred Stage 4–7 "clock/instance-id injection (repository)" task is pulled forward for the clock only.
module.exports = Object.freeze({
  sequence: 33,
  slug: "hot-loop-clock-injection-and-net-converter",
  afterBatch: "048",
  backlogTaskId: "stage-3.22.prerequisite.hot-loop-equivalence-evidence",
  intent: "Remove Net's dead typeof DistanceUnitConverter fallback and inject the wall clock into LocationMap (time of day) and FlatInventoryItemRepository (fallback instance id) from composition, so the batch 049 hot-loop sources read no availability check and no wall clock; behaviour is unchanged.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: TACKLE, replacements: Object.freeze([
      Object.freeze([NET_FALLBACK, "    return new DistanceUnitConverter(resolvedPhysics);\n"]),
    ]) }),
    Object.freeze({ path: WORLD, replacements: Object.freeze([
      Object.freeze(["  #rng;\n\n  constructor(locationId, locationsConfig, rng = null, resources = null) {\n",
        "  #rng;\n  #currentDate;\n\n  // The wall clock (time of day without game time) is injected by composition.\n" +
        "  constructor(locationId, locationsConfig, rng = null, resources = null, currentDate = null) {\n"]),
      Object.freeze(["    this.#rng = rng || { next: () => Math.random() };\n    this.#config = JSON.parse(",
        "    this.#rng = rng || { next: () => Math.random() };\n    this.#currentDate = currentDate;\n    this.#config = JSON.parse("]),
      Object.freeze(["        const now = new Date();\n", "        const now = this.#currentDate();\n"]),
    ]) }),
    Object.freeze({ path: BOOTSTRAP, replacements: Object.freeze([
      Object.freeze(["      map: new LocationMap(\n        locId,\n        this.#config.locations,\n        rng,\n        locationResources,\n      ),\n",
        "      map: new LocationMap(\n        locId,\n        this.#config.locations,\n        rng,\n        locationResources,\n" +
        "        () => new Date(),\n      ),\n"]),
    ]) }),
    Object.freeze({ path: REPOSITORY, replacements: Object.freeze([
      Object.freeze(["  #fallbackSequence = 0;\n\n  constructor({\n    items = [],\n    instanceIdFactory = null,\n" +
        "    reservationPolicy = null,\n  } = {}) {\n    this.#instanceIdFactory = instanceIdFactory;\n",
        "  #fallbackSequence = 0;\n  #now;\n\n  // The wall clock of the fallback instance id is injected by composition.\n" +
        "  constructor({\n    items = [],\n    instanceIdFactory = null,\n    reservationPolicy = null,\n    now = null,\n" +
        "  } = {}) {\n    this.#instanceIdFactory = instanceIdFactory;\n    this.#now = now;\n"]),
      Object.freeze(["${Date.now().toString(36)}", "${this.#now().toString(36)}"]),
    ]) }),
    Object.freeze({ path: COMPOSITION, replacements: Object.freeze([
      Object.freeze(["    instanceIdFactory = null,\n    boatChargeProvider = null,\n",
        "    instanceIdFactory = null,\n    now = null,\n    boatChargeProvider = null,\n"]),
      Object.freeze(["      itemSnapshotMapper,\n      instanceIdFactory,\n      itemStateMigration,\n      effectiveStatsResolver,\n    });\n" +
        "    const snapshot = resolvedState.snapshot;\n",
        "      itemSnapshotMapper,\n      instanceIdFactory,\n      now,\n      itemStateMigration,\n      effectiveStatsResolver,\n" +
        "    });\n    const snapshot = resolvedState.snapshot;\n"]),
      Object.freeze(["      items: snapshot.items,\n      instanceIdFactory,\n      reservationPolicy,\n    });\n",
        "      items: snapshot.items,\n      instanceIdFactory,\n      reservationPolicy,\n      now,\n    });\n"]),
      Object.freeze(["    itemSnapshotMapper,\n    instanceIdFactory,\n    itemStateMigration,\n    effectiveStatsResolver,\n  }) {\n",
        "    itemSnapshotMapper,\n    instanceIdFactory,\n    now,\n    itemStateMigration,\n    effectiveStatsResolver,\n  }) {\n"]),
      Object.freeze(["      itemSnapshotMapper,\n      instanceIdFactory,\n      itemStateMigration,\n      effectiveStatsResolver,\n    }).migrate({",
        "      itemSnapshotMapper,\n      instanceIdFactory,\n      now,\n      itemStateMigration,\n      effectiveStatsResolver,\n" +
        "    }).migrate({"]),
    ]) }),
    Object.freeze({ path: MIGRATION, replacements: Object.freeze([
      Object.freeze(["  #itemSnapshotMapper;\n\n  constructor({\n    itemDefinitionResolver,\n    instanceIdFactory = null,\n",
        "  #itemSnapshotMapper;\n  #now;\n\n  constructor({\n    itemDefinitionResolver,\n    instanceIdFactory = null,\n" +
        "    now = null,\n"]),
      Object.freeze(["    this.#instanceIdFactory = instanceIdFactory;\n    this.#itemStateMigration = itemStateMigration;\n",
        "    this.#instanceIdFactory = instanceIdFactory;\n    this.#now = now;\n    this.#itemStateMigration = itemStateMigration;\n"]),
      Object.freeze(["      instanceIdFactory: this.#instanceIdFactory,\n    });\n",
        "      instanceIdFactory: this.#instanceIdFactory,\n      now: this.#now,\n    });\n"]),
    ]) }),
    Object.freeze({ path: INVENTORY, replacements: Object.freeze([
      Object.freeze(["        return this.#makeId(prefix);\n      },\n      loadValueProvider:",
        "        return this.#makeId(prefix);\n      },\n      now: () => Date.now(),\n      loadValueProvider:"]),
    ]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  parity({ read, before, after }) {
    const runtime = read(RUNTIME);
    const world = (files, extra = {}) => {
      const context = vm.createContext({ console: { log() {}, warn() {}, error() {} }, ...extra });
      vm.runInContext(runtime, context, { filename: RUNTIME });
      const modules = context.__CYBER_FISHING_COMPAT_RUNTIME__.modules;
      for (const exports of Object.values(modules)) {
        for (const [name, value] of Object.entries(exports)) if (!(name in context)) context[name] = value;
      }
      for (const [file, source] of files) vm.runInContext(source, context, { filename: file });
      return context;
    };
    // Net: the converter is always loaded before tackle.js, and reach is identical with the fallback gone.
    const scripts = [...read(INDEX).matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/giu)]
      .map(match => match[1].split("?")[0]);
    const converterAt = scripts.findIndex(file => /distanceunitconverter|distance_unit_converter/u.test(file));
    assert(converterAt >= 0 && converterAt < scripts.indexOf(TACKLE), "DistanceUnitConverter loads before tackle.js");
    const net = source => vm.runInContext(`(() => {
      const facts = [];
      for (const physics of [null, {}, { pixelsPerMeter: 40 }, { pixelsPerMeter: 0 }, { pixelsPerMeter: "x" }]) {
        for (const config of [null, { active: true, lengthMeters: 3 }, { active: true, reachMeters: "2" }, { length: -1 }]) {
          const net = new Net(config, physics);
          facts.push([net.getReachMeters(), net.getReachPixels(), net.virtualReach, net.getTriggerVirtualY(500)]);
        }
      }
      return JSON.stringify(facts);
    })()`, world([[TACKLE, source]]));
    assert(before(TACKLE).includes("typeof DistanceUnitConverter") && !after(TACKLE).includes("typeof DistanceUnitConverter"));
    const netFacts = net(before(TACKLE));
    assert.equal(net(after(TACKLE)), netFacts, "Net reach changed");
    // LocationMap: time of day from the clock; before reads a fixed Date, after receives the same clock.
    const FixedDate = class extends Date { constructor(...args) { super(...(args.length ? args : [2026, 9, 1, 18, 30])); } };
    const map = (source, injected) => vm.runInContext(`(() => {
      const config = { map: { lake: { zones: { castable: [], collisions: [], snags: [] }, depthBounds: { min: 1, max: 5 } } },
        baseResolution: { width: 100, height: 60 }, cellSize: 10 };
      const facts = [];
      for (const hours of [null, 6, 12, 18, 20, 23]) {
        const map = new LocationMap("lake", config, { next: () => 0.5 }, { background: { dynamic: true }, loaded: true },
          ${injected ? "() => new Date()" : "undefined"});
        map.update(16, hours);
        facts.push(map.getBackgroundRenderData());
      }
      return JSON.stringify(facts);
    })()`, world([[WORLD, source]], { Date: FixedDate }));
    const mapFacts = map(before(WORLD), false);
    assert.equal(map(after(WORLD), true), mapFacts, "LocationMap time of day changed");
    // FlatInventoryItemRepository: the fallback instance id reads the injected clock.
    const repository = (source, injected) => vm.runInContext(`(() => {
      const repository = new FlatInventoryItemRepository({ items: [{ instanceId: "worm", itemId: "worm", quantity: 3,
        location: InventoryItemLocation.inventory() }]${injected ? ", now: () => Date.now()" : ""} });
      const first = repository.splitOne("worm");
      const second = repository.splitOne("worm");
      return JSON.stringify([first, second, repository.toSnapshot()]);
    })()`, world([[REPOSITORY, source]], { Date: class extends Date { static now() { return 1790000000000; } } }));
    const repositoryFacts = repository(before(REPOSITORY), false);
    assert.equal(repository(after(REPOSITORY), true), repositoryFacts, "fallback instance id changed");
    // Every production construction passes the clock.
    assert(after(BOOTSTRAP).includes("locationResources,\n        () => new Date(),") ||
      after(BOOTSTRAP).includes("locationResources,\r\n        () => new Date(),"));
    assert(after(INVENTORY).includes("now: () => Date.now(),"));
    return { netCases: JSON.parse(netFacts).length, mapCases: JSON.parse(mapFacts).length,
      repositoryCases: JSON.parse(repositoryFacts).length };
  },
});
