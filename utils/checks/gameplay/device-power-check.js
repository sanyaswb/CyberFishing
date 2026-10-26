"use strict";

// Spec 143: one power system for devices. A battery item holds the charge; the bait boat consumes the battery in its
// slot by state (moving, waiting at a third, idle/drifting at 0, level factors); consumption runs on the caller's
// monotonic step (never the wall clock), is clamped per step, written every 5 s / when a battery runs out / on flush,
// never raises a charge, and the lower charge wins when another tab saved one. One-time grants apply once.
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const runtime = new SourceRuntime();
const { ITEM_DB } = runtime.importModule("src/game/config/raw/items/item_database.js");
const { ITEM_PROGRESSION_CONFIG } = runtime.importModule("src/game/config/items/item_progression_config.js");
const { BoatPowerRatePolicy } = runtime.importModule("src/game/domain/rules/boat_power_rate_policy.js");
const { DevicePowerPolicy } = runtime.importModule("src/game/domain/items/power/device_power_policy.js");
const { DevicePowerService } = runtime.importModule("src/game/application/power/device_power_service.js");
const { ApplyBatteryDrainService } = runtime.importModule("src/game/application/inventory/apply_battery_drain_service.js");
const { ItemBoundedMetricResolver } = runtime.importModule("src/game/domain/items/metrics/item_bounded_metric_resolver.js");
const { FlatInventoryItemRepository } = runtime.importModule("src/game/domain/inventory/flat_inventory_item_repository.js");
const { InventoryItemLocation } = runtime.importModule("src/game/domain/inventory/inventory_item_location.js");
const { InventoryGrantLedger } = runtime.importModule("src/game/domain/inventory/inventory_grant_ledger.js");
const { InventoryOneTimeGrantService } = runtime.importModule("src/game/application/inventory/inventory_one_time_grant_service.js");
const { InventoryStateStore } = runtime.importModule("src/game/application/inventory/persistence/inventory_state_store.js");
const { ChumService } = runtime.importModule("src/game/application/chum/chum_service.js");

const near = (actual, expected, tolerance, message) =>
  assert(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

// Catalog numbers (D-P1..D-P3): a 3600-unit battery; level 1 moving 12 units/s = 300 s, waiting a third.
const battery = ITEM_DB.batteries.battery_basic;
const boatStats = ITEM_DB.deliveryMethods.boat_lvl3.gameplayStats;
assert.equal(battery.gameplayStats.capacityUnits, 3600, "the ordinary battery holds 3600 units (1 hour at 1 unit/s)");
const rate = new BoatPowerRatePolicy();
const atLevel = (level) => ({ ...boatStats, upgradeLevel: level });
for (const [level, movingSeconds, waitingSeconds] of [[1, 300, 900], [2, 450, 1350], [3, 600, 1800]]) {
  near(3600 / rate.unitsPerSecond("deploying", atLevel(level)), movingSeconds, 1e-9, `level ${level} moving time`);
  near(3600 / rate.unitsPerSecond("returning", atLevel(level)), movingSeconds, 1e-9, `level ${level} returning time`);
  near(3600 / rate.unitsPerSecond("waiting", atLevel(level)), waitingSeconds, 1e-9, `level ${level} waiting time`);
  for (const state of ["idle", "drifting", "finished"]) {
    assert.equal(rate.unitsPerSecond(state, atLevel(level)), 0, `level ${level} ${state} consumes nothing (D-P6)`);
  }
}

const policy = new DevicePowerPolicy();
assert.equal(policy.drain(50, 3600, 360), 40);
assert.equal(policy.drain(50, 3600, -100), 50, "negative consumption never raises a charge");
assert.equal(policy.drain(5, 3600, 3600), 0, "charge stops at 0");

// Real battery storage: repository + the charge capability + the drain service.
function batteryInventory(items) {
  const repository = new FlatInventoryItemRepository({ items });
  const hydrator = { hydrate: (raw) => ({ ...ITEM_DB.batteries[raw.itemId], ...raw,
    effectiveStats: { ...ITEM_DB.batteries[raw.itemId].gameplayStats } }) };
  const chargeResolver = new ItemBoundedMetricResolver({ capabilityId: "charge",
    profileProvider: (item) => ITEM_PROGRESSION_CONFIG.groups[item?.progressionProfile?.groupId]?.charge,
    descriptorFactory: (values) => values });
  const drain = new ApplyBatteryDrainService({ repository, hydrator, chargeResolver });
  let writes = 0;
  return {
    repository,
    get writes() { return writes; },
    port: {
      attachedBattery: (deviceId) => repository.getChild(deviceId, "battery", 0),
      readBattery: (id) => drain.read(id),
      drainBattery: (id, units) => { writes += 1; return drain.drain(id, units); },
    },
  };
}
const inventory = batteryInventory([
  { instanceId: "boat", itemId: "battery_basic", quantity: 1, location: InventoryItemLocation.inventory() },
  { instanceId: "bat-1", itemId: "battery_basic", quantity: 1, location: InventoryItemLocation.attached("boat", "battery") },
  { instanceId: "bat-2", itemId: "battery_basic", quantity: 1, chargeState: { percent: 50 },
    location: InventoryItemLocation.inventory() },
]);
const config = { maxStepSeconds: 1, saveIntervalSeconds: 5 };
const power = new DevicePowerService({ batteries: inventory.port, config: () => config });
assert.equal(power.batteryOf("boat"), "bat-1", "the battery in the device's slot");
assert.equal(power.batteryOf("bat-2"), null);
assert.deepEqual({ ...power.read("bat-2") }, { hasBattery: true, percent: 50, empty: false });
assert.deepEqual({ ...power.read(null) }, { hasBattery: false, percent: 0, empty: true }, "no battery reads empty");

// No wall clock: the whole run fails if the source realm reads Date.now().
const SourceDate = vm.runInContext("Date", runtime.context);
const realNow = SourceDate.now;
SourceDate.now = () => { throw new Error("device power must not read the wall clock"); };
try {
  const levelOne = rate.unitsPerSecond("deploying", atLevel(1));
  let seconds = 0;
  let reading = power.read("bat-1");
  const reused = reading;
  while (!reading.empty && seconds < 400) {
    reading = power.consume({ deviceId: "boat", batteryInstanceId: "bat-1", unitsPerSecond: levelOne, seconds: 0.016 });
    seconds += 0.016;
  }
  assert.equal(reading, reused, "one reused reading object per battery");
  // The saved charge keeps hundredths of a percent (0.36 units), so 60 writes may move the end by a fraction of a second.
  near(seconds, 300, 0.25, "a full battery moves a level-1 boat for 300 s");
  assert.equal(inventory.repository.get("bat-1").chargeState.percent, 0, "the empty battery is written at once");
  near(inventory.writes, 60, 1, "consumption is written every 5 s");
  assert.equal(power.consume({ deviceId: "boat", batteryInstanceId: "bat-1", unitsPerSecond: 12, seconds: 1 }).empty, true,
    "an empty battery stays empty");

  // A sleep/wake gap or a wall-clock jump is one clamped step.
  const before = power.read("bat-2").percent;
  power.consume({ deviceId: "radio", batteryInstanceId: "bat-2", unitsPerSecond: 1, seconds: 3600 });
  near(before - power.read("bat-2").percent, 100 / 3600, 1e-9, "one step counts at most maxStepSeconds");

  // A reload loses at most the pending interval; flush() (page hidden) loses nothing.
  for (let step = 0; step < 7; step += 1) {
    power.consume({ deviceId: "radio", batteryInstanceId: "bat-2", unitsPerSecond: 1, seconds: 1 });
  }
  const pendingPercent = power.read("bat-2").percent;
  const storedBeforeFlush = inventory.repository.get("bat-2").chargeState.percent;
  assert(storedBeforeFlush - pendingPercent <= 5 * 100 / 3600 + 0.01, "at most 5 s are pending");
  power.flush();
  near(inventory.repository.get("bat-2").chargeState.percent, pendingPercent, 0.01, "flush writes the pending consumption");
} finally {
  SourceDate.now = realNow;
}
const ledger = power.getLedger();
near(ledger.find((entry) => entry.batteryInstanceId === "bat-1").units, 3600, 3, "the ledger holds what the battery gave, nothing after it was empty");
assert.equal(ledger.find((entry) => entry.batteryInstanceId === "bat-2").deviceId, "radio");

// Two tabs: the lower charge already saved for a battery wins.
const cacheData = new Map();
const cache = { get: (key, fallback) => cacheData.has(key) ? JSON.parse(cacheData.get(key)) : fallback,
  set: (key, value) => cacheData.set(key, JSON.stringify(value)) };
const store = new InventoryStateStore({ cache, itemSnapshotMapper: { toSnapshots: (items) => items } });
const item = (instanceId, percent) => ({ instanceId, itemId: "battery_basic", quantity: 1,
  location: { kind: "INVENTORY" }, ...(percent === null ? {} : { chargeState: { percent } }) });
store.save({ items: [item("a", 30), item("b", 80)] });
const merged = store.save({ items: [item("a", 60), item("b", 20), item("c", null)] });
assert.deepEqual([...merged.items.map((entry) => entry.chargeState?.percent ?? null)], [30, 20, null],
  "the lower charge wins per battery; other items are untouched");
store.save({ items: [item("a", null)] });
assert.equal(store.load().items[0].chargeState.percent, 30, "a missing chargeState (full) never overwrites a lower one");

// One-time grants: applied once, or only marked when the item is already held.
const transaction = { runAtomic: (operation) => operation() };
const grantRepository = new FlatInventoryItemRepository({ items: [] });
const ledgerOfGrants = new InventoryGrantLedger([]);
let ids = 0;
const grants = new InventoryOneTimeGrantService({ ledger: ledgerOfGrants, repository: grantRepository, transaction,
  definitionLookup: (itemId) => ITEM_DB.batteries[itemId] || null, instanceIdFactory: () => `granted-${++ids}` });
const firstBattery = [{ id: "spec143-first-battery", itemId: "battery_basic", quantity: 1 }];
assert.equal(grants.apply(firstBattery).length, 1);
assert.equal(grants.apply(firstBattery).length, 0, "a marked grant is not applied again");
grantRepository.remove("granted-1");
assert.equal(grants.apply(firstBattery).length, 0, "a spent or removed item is not granted again");
assert.deepEqual([...ledgerOfGrants.snapshot()], ["spec143-first-battery"]);
const heldRepository = new FlatInventoryItemRepository({ items: [item("held", null)] });
const heldLedger = new InventoryGrantLedger([]);
const heldResult = new InventoryOneTimeGrantService({ ledger: heldLedger, repository: heldRepository, transaction,
  definitionLookup: (itemId) => ITEM_DB.batteries[itemId] || null, instanceIdFactory: () => "unused" }).apply(firstBattery);
assert.equal(heldResult[0].instanceId, null, "an inventory that already holds a battery is only marked");
assert.equal(heldRepository.size, 1);

// The boat runs on its battery: it drifts when the battery is empty and its bar follows the battery.
const boatInventory = batteryInventory([
  { instanceId: "boat-root", itemId: "battery_basic", quantity: 1, location: InventoryItemLocation.inventory() },
  { instanceId: "boat-battery", itemId: "battery_basic", quantity: 1, chargeState: { percent: 1 },
    location: InventoryItemLocation.attached("boat-root", "battery") },
]);
const boatPower = new DevicePowerService({ batteries: boatInventory.port, config: () => config });
assert.throws(() => new ChumService("power-test", { baits: {} }, () => null, { cache }), /requires devicePower/u);
const chum = new ChumService("power-test", { baits: {} }, () => null, { cache, devicePower: boatPower });
const boat = chum.spawnIdleBoat(500, 500, { instanceId: "boat-root", effectiveStats: { ...boatStats, upgradeLevel: 1,
  manualControl: true, sections: 1 } }, "boat-battery");
chum.updateBoats(1000, () => ({}), () => null, 10, null);
assert.equal(boatPower.read("boat-battery").percent, 1, "an idle (aimed, not launched) boat consumes nothing");
boat.setTarget(500, -10000); // far enough to keep moving until the battery is empty
let frames = 0;
while (boat.state !== "drifting" && frames < 1000) {
  chum.updateBoats(100, () => ({}), () => null, 10, null);
  frames += 1;
}
assert.equal(boat.state, "drifting", "an empty battery stops the boat");
near(frames * 0.1, 36 / 12, 0.2, "1 % of 3600 units lasts 3 s at 12 units/s");
assert.equal(boat.powerRatio, 0);
assert.equal(boatInventory.repository.get("boat-battery").chargeState.percent, 0);

// TK-095: the boat's thumbnail shows the inserted battery as its charge bar, not as an attachment cell.
const { InventoryItemTreeViewFactory } = runtime.importModule("src/game/presentation/inventory/inventory_item_tree_view_factory.js");
const { AssemblyProfileRegistry } = runtime.importModule("src/game/domain/assemblies/assembly_profile_registry.js");
const { ITEM_ASSEMBLY_PROFILE_CONFIG } = runtime.importModule("src/game/config/raw/inventory/item_assembly_profiles.js");
const definitions = { boat_lvl3: ITEM_DB.deliveryMethods.boat_lvl3, battery_basic: battery };
const thumbRepository = new FlatInventoryItemRepository({ items: [
  { instanceId: "thumb-boat", itemId: "boat_lvl3", quantity: 1, location: InventoryItemLocation.inventory() },
  { instanceId: "thumb-battery", itemId: "battery_basic", quantity: 1, chargeState: { percent: 40 },
    location: InventoryItemLocation.attached("thumb-boat", "battery") },
] });
const thumbnails = new InventoryItemTreeViewFactory({ repository: thumbRepository, assemblyStates: { get: () => null },
  profileRegistry: new AssemblyProfileRegistry(ITEM_ASSEMBLY_PROFILE_CONFIG, { itemDefinitionResolver: (id) => definitions[id] }),
  hydrate: (raw) => ({ ...definitions[raw.itemId], ...raw, effectiveStats: { ...definitions[raw.itemId].gameplayStats } }),
  deviceChargeProvider: (item) => {
    if (item?.itemType === "battery") return { current: item.chargeState?.percent ?? 100, maximum: 100 };
    const child = thumbRepository.getChild(item.instanceId, "battery", 0);
    return child ? { current: child.chargeState?.percent ?? 100, maximum: 100 } : null;
  } });
const boatThumb = thumbnails.create("thumb-boat");
assert(boatThumb.attachments.every((attachment) => attachment.kind !== "battery"), "no battery cell in the boat thumbnail");
assert(boatThumb.attachments.some((attachment) => attachment.kind === "cargo"), "other sockets keep their cells");
assert.equal(boatThumb.charge.percent, 40, "the boat thumbnail shows its battery's charge");
thumbRepository.setLocation("thumb-battery", InventoryItemLocation.inventory());
assert.equal(thumbnails.create("thumb-boat").charge, undefined, "without a battery the boat has no charge bar");

// TK-102: battery parameters have one charge meter (resource:energy, not a duplicated bar), and displayStats "Ємність" reflects live remaining capacity.
const { InventoryItemParametersResolver } = runtime.importModule("src/game/presentation/inventory/inventory_item_parameters_resolver.js");
const { InventoryResourceMeterResolver } = runtime.importModule("src/game/presentation/inventory/inventory_resource_meter_resolver.js");
const { InventoryRuntimeDisplayStatsResolver } = runtime.importModule("src/game/application/inventory/inventory_runtime_display_stats_resolver.js");
const { InventoryItemViewFactory } = runtime.importModule("src/game/presentation/inventory/inventory_item_view_factory.js");
const { ItemDatabase } = runtime.importModule("src/game/application/inventory/item_database.js");

const itemDbInstance = new ItemDatabase(ITEM_DB);
const batteryChargeResolver = new ItemBoundedMetricResolver({
  capabilityId: "charge",
  profileProvider: (item) => ITEM_PROGRESSION_CONFIG.groups[item?.progressionProfile?.groupId]?.charge,
  descriptorFactory: (values) => values,
});
const batteryViewFactory = new InventoryItemViewFactory({
  itemDatabase: itemDbInstance,
  progressionResolver: { resolve: () => ({}) },
  conditionResolver: { resolve: () => null },
  freshnessResolver: { resolve: () => null },
  chargeResolver: batteryChargeResolver,
  baitEffectivenessCatalogResolver: { resolve: () => null },
  effectiveRarityResolver: { resolve: () => null },
  displayStatsResolver: new InventoryRuntimeDisplayStatsResolver(),
  effectiveStatsResolver: { resolve: ({ definition }) => ({ ...definition.gameplayStats }) },
  runtimeContextProvider: () => ({}),
});

const batFull = batteryViewFactory.create({ instanceId: "bat-f", itemId: "battery_basic", chargeState: { percent: 100 } });
assert.equal(batFull.displayStats["Ємність"], "3600", "full battery capacity is 3600");
const batHalf = batteryViewFactory.create({ instanceId: "bat-h", itemId: "battery_basic", chargeState: { percent: 50 } });
assert.equal(batHalf.displayStats["Ємність"], "1800", "50% battery capacity drops to 1800");
const batZero = batteryViewFactory.create({ instanceId: "bat-z", itemId: "battery_basic", chargeState: { percent: 0 } });
assert.equal(batZero.displayStats["Ємність"], "0", "empty battery capacity drops to 0");

const paramResolver = new InventoryItemParametersResolver({ resourceMeterResolver: new InventoryResourceMeterResolver() });
const batParams = paramResolver.resolve(batHalf);
assert.equal(batParams.filter((p) => p.label === "Заряд").length, 1, "battery parameters have exactly one charge meter (no duplicate bar)");
assert.equal(batParams.find((p) => p.label === "Заряд")?.id, "resource:energy", "the charge parameter is resource:energy");
assert.equal(batParams.find((p) => p.label === "Ємність")?.value, "1800", "the capacity parameter reflects 1800 remaining units");

// TK-102: live battery view with deviceChargeProvider (e.g. while draining in radio or boat)
const liveThumbBattery = thumbnails.create("thumb-battery");
assert.equal(liveThumbBattery.charge.percent, 40, "battery gets live charge from provider");
assert.equal(liveThumbBattery.displayStats["Ємність"], "1440", "live battery capacity reflects 40% of 3600 = 1440 units");

// TK-102 & TK-103: item-parameters.css and resource-meters.css unified meter design rules
const paramsCss = runtime.read("src/game/presentation/styles/inventory/item-parameters.css");
assert(!/#e8f7f8|#83a2aa|#0a1114/u.test(paramsCss), "item-parameters.css uses design tokens instead of legacy hardcoded colors");
assert(paramsCss.includes("prefers-reduced-motion"), "item-parameters.css supports prefers-reduced-motion");
assert(paramsCss.includes(".inventory-parameter .inventory-resource-meter__track"), "item-parameters.css unifies resource meter track styling with parameter bars");

const resourceMetersCss = runtime.read("src/game/presentation/styles/inventory/resource-meters.css");
assert(resourceMetersCss.includes(".inventory-resource-meter--parameter .inventory-resource-meter__track"), "resource-meters.css defines parameter meter track styling");
assert(resourceMetersCss.includes("--ui-radius-control"), "resource-meters.css applies control border-radius token to parameter meter tracks");
assert(resourceMetersCss.includes("prefers-reduced-motion"), "resource-meters.css supports prefers-reduced-motion");

console.log("Device power passed: catalog boat rates (5/7.5/10 min moving, a third waiting, 0 idle/drifting), drain never "
  + "rises or goes below 0, 300 s per battery on 16 ms steps without the wall clock, writes every 5 s and at empty, "
  + "clamped steps, flush on hide, ledger, lower charge across tabs, one-time grants once, boat drifts on an empty "
  + "battery and idle boats consume nothing; the boat thumbnail shows the battery as its charge bar, not a cell; "
  + "TK-102/TK-103: battery parameters have one charge meter, dynamic remaining capacity and unified parameter scale styles.");
