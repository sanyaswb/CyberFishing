// Spec 151 (G-124): the boat spends its cargo at the drop, a drained boat drifts and comes back by the landing net or
// by mooring at the shore (in ground metres, no pixel thresholds), a launched boat survives a reload, and leaving the
// location loses it with its battery and cargo.
const assert = require("node:assert/strict");

async function load() {
  const [{ ChumService }, { ChumController }, { Net }, { WaterMetric }, { ITEM_DB }, { CONFIG },
    { FightPhysicsConfigAdapter }, { FISHING_MESSAGES }] = await Promise.all([
    import("../../../src/game/application/chum/chum_service.js"),
    import("../../../src/game/application/chum/chum_controller.js"),
    import("../../../src/game/domain/tackle/net.js"),
    import("../../../src/game/domain/locations/water_metric.js"),
    import("../../../src/game/config/raw/items/item_database.js"),
    import("../../../src/game/config/runtime/game_config.js"),
    import("../../../src/game/config/physics/fight_physics_config_adapter.js"),
    import("../../../src/game/presentation/fishing/fishing_messages.js"),
  ]);
  return { ChumService, ChumController, Net, WaterMetric, ITEM_DB, CONFIG, FightPhysicsConfigAdapter, FISHING_MESSAGES };
}

function createCache() {
  const data = new Map();
  return { data, get: (key, fallback) => data.has(key) ? JSON.parse(data.get(key)) : fallback,
    set: (key, value) => data.set(key, JSON.stringify(value)) };
}

async function run() {
  const m = await load();
  const metric = new m.WaterMetric({ pixelsPerMeter: 50, shoreY: 2000, topY: 0 });
  // The boat and net as the catalog defines them (the boat's level-3 speed, its mooring distance; the net's reach).
  const boatItem = { instanceId: "boat-root", effectiveStats: { ...m.ITEM_DB.deliveryMethods.boat_lvl3.gameplayStats } };
  const net = new m.Net(m.ITEM_DB.nets.net_basic.gameplayStats,
    new m.FightPhysicsConfigAdapter(m.CONFIG).getDistanceConfig());
  const mix = { radius: 150, targetFishes: ["carp"], rampUpTimeMs: 1, peakDurationMs: 1, totalBonusTimeMs: 2,
    minBonusDurationHours: 1, maxBonus: 2, minBonus: 1.2 };
  const chumConfig = { baits: { mix: { id: "mix", effectiveStats: mix } } };
  const water = (x, y) => (x >= 0 && x <= 4000 && y >= 0 && y <= 2000 ? {} : null);
  const noObstacle = () => false;
  const toShore = { current: { speedPxPerSec: 150, direction: { x: 0, y: 1 } } };

  function compose(cache = createCache()) {
    const power = { charged: true };
    const spent = [];
    const lost = [];
    const returned = [];
    const service = new m.ChumService("lake", chumConfig, () => metric, {
      cache, now: () => 0, rng: { next: () => 0.5 }, gameTime: { getGameMs: () => 0 },
      devicePower: { consume: () => ({ hasBattery: true, percent: power.charged ? 100 : 0, empty: !power.charged }) },
      consumeBoatChum: (slotIndex) => { spent.push(slotIndex); return true; },
      onBoatLost: (event) => lost.push(event.rootInstanceId),
      onBoatReturned: (event) => returned.push(event.rootInstanceId),
      findBoatItem: (rootInstanceId) => (rootInstanceId === boatItem.instanceId ? boatItem : null),
    });
    const step = (frames, env = null) => {
      for (let frame = 0; frame < frames; frame += 1) service.updateBoats(16, water, noObstacle, 40, env, metric);
    };
    return { service, power, spent, lost, returned, step, cache };
  }

  // D5: the cargo slot is spent when the bunker opens, not at the click.
  {
    const { service, spent, step } = compose();
    const boat = service.spawnIdleBoat(1000, 1950, boatItem, "battery");
    service.deployBait(1000, 1500, "mix", boat, 2);
    assert.deepEqual(spent, [], "a target spends nothing");
    let frames = 0;
    while (service.getZones().length === 0 && frames < 3000) { step(1); frames += 1; }
    assert.deepEqual(spent, [2], "the bunker opening spends the target's cargo slot");
    assert.equal(service.getZones().length, 1, "and starts the spot");
  }

  // A drained boat drifts; the net takes it back inside its reach, its cargo stays in the bunkers.
  const controllerFor = (service) => new m.ChumController({
    messages: m.FISHING_MESSAGES, inventory: { getEquipped: () => ({ delivery: boatItem, deliveryChums: [] }) },
    chum: service, projector: { screenToVirtual: (x, y, out = {}) => Object.assign(out, { x, y }) },
    inventoryUI: { showWarning() {} }, fishing: {}, location: {}, clock: { now: 0 }, config: {}, rng: { next: () => 0.5 },
    getViewportSize: () => ({ width: 800, height: 600 }), panViewport() {}, depthUI: { hide() {} },
    getDynamicBounds: () => ({ left: 0, right: 4000, top: 0, bottom: 2000 }), getWaterMetric: () => metric,
    getRodVirtualPos: () => ({ x: 1000, y: 2000 }), checkWater: water, markInvalidCast() {}, canPlayerCast: () => true,
    getGameStateName: () => "scouting", devicePower: { read: () => ({ empty: false }) },
    createUi: () => ({ setState() {}, dispose() {} }),
  });
  {
    const { service, power, spent, returned, step } = compose();
    const controller = controllerFor(service);
    const boat = service.spawnIdleBoat(1000, 1950, boatItem, "battery");
    service.deployBait(1000, 300, "mix", boat, 0);
    step(200);
    power.charged = false;
    step(1);
    assert.equal(boat.state, "drifting", "an empty battery: the boat loses control");
    assert.equal(controller.getBoatInNetReach(net, metric), null, "far away it is out of the net's reach");
    assert.equal(controller.recoverBoatWithNet(net, metric), false);
    let frames = 0;
    while (!controller.getBoatInNetReach(net, metric) && frames < 5000) { step(1, toShore); frames += 1; }
    const reachMeters = net.getReachMeters();
    assert(metric.metersFromShore(boat.pos.y) <= reachMeters + 1e-6, "the net reaches it at its own length in metres");
    assert(metric.metersFromShore(boat.pos.y) > reachMeters - 0.2, "and not before");
    assert.equal(controller.getBoatInNetReach(new m.Net({ active: false }), metric), null, "without a net: no pick-up");
    assert.equal(controller.recoverBoatWithNet(net, metric), true);
    assert.equal(service.getBoats().length, 0, "the net takes the boat back");
    assert.deepEqual(spent, [], "its undropped cargo stays in the bunkers");
    assert.deepEqual(returned, [], "a boat with full bunkers starts no auto refill");
  }

  // D4/D8: without a net it comes back only by mooring at the player's shore (catalog mooringMeters).
  {
    const { service, power, step } = compose();
    const boat = service.spawnIdleBoat(1000, 1950, boatItem, "battery");
    service.deployBait(1000, 300, "mix", boat, 0);
    step(200);
    power.charged = false;
    step(1);
    const mooring = boatItem.effectiveStats.recovery.mooringMeters;
    let frames = 0;
    let lastMeters = Infinity;
    while (service.getBoats().length > 0 && frames < 8000) { lastMeters = metric.metersFromShore(boat.pos.y); step(1, toShore); frames += 1; }
    assert.equal(service.getBoats().length, 0, "the current brings it to the shore and it moors");
    assert(lastMeters > mooring - 0.1 && lastMeters <= mooring + 0.1, "it moors at its mooring distance");
    const still = service.spawnIdleBoat(1000, 1950, boatItem, "battery");
    service.deployBait(1000, 300, "mix", still, 0);
    step(200);
    power.charged = false;
    step(600);
    assert.equal(still.state, "drifting");
    assert.equal(service.getBoats().length, 1, "without a current it stays on the water");
  }

  // D2/D6: a launched boat survives a reload; D1: leaving the location loses it with its battery and cargo.
  {
    const cache = createCache();
    const first = compose(cache);
    const boat = first.service.spawnIdleBoat(1000, 1950, boatItem, "battery");
    first.service.deployBait(1000, 600, "mix", boat, 1);
    first.step(100);
    first.service.saveBoats();
    assert.deepEqual(first.service.rootInstanceIdsAway(), ["boat-root"], "the boat on the water is reported away");
    const second = compose(cache);
    const [restored] = second.service.getBoats();
    assert(restored, "the reload restores the boat");
    assert.deepEqual([restored.pos.x, restored.pos.y, restored.state, restored.drop.slotIndex, restored.batteryInstanceId],
      [boat.pos.x, boat.pos.y, boat.state, 1, "battery"], "where it was, on its way, with its cargo slot and battery");
    second.service.loseBoats();
    assert.deepEqual(second.lost, ["boat-root"], "leaving the location loses the boat item (with battery and cargo)");
    assert.deepEqual(second.service.getBoats(), []);
    assert.deepEqual(compose(cache).service.getBoats(), [], "and it is gone after the next reload too");
    const unknown = createCache();
    unknown.set("chum_boats_lake", JSON.parse(cache.data.get("chum_boats_lake") || "[]").concat([{
      ...boat.toSnapshot(), rootInstanceId: "sold-boat", batteryInstanceId: null }]));
    assert.deepEqual(compose(unknown).service.getBoats(), [], "a saved boat the player no longer has is not restored");
  }

  // GameWorld gives the boat the map's water, not the visible screen (lockZoneXToScreen narrows only the camera).
  {
    const { GameWorld } = await import("../../../src/game/application/world/game_world.js");
    let boatWater = null;
    const cell = { isCastable: true, hasCollision: false };
    const world = new GameWorld({
      map: { update() {}, getCastableBoundsVirtual: () => ({ left: 0, right: 4000, top: 0, bottom: 2000 }),
        getCellAtVirtualPos: () => cell, isCastableAt: () => true, hasCollisionAt: () => false },
      projector: { screenToVirtual: (x, y, out) => Object.assign(out, { x, y }) },
      env: { update() {}, getSnapshot: () => ({ time: 12 }) },
      chum: { update() {}, updateBoats(dt, checkPhysics) { boatWater = checkPhysics; } },
      location: {}, canvasMetrics: { width: 400, height: 400 }, clock: { realNow: 0 },
      locationConfig: { ...m.CONFIG.locations, lockZoneXToScreen: true, cellSize: 40 },
      waterMetricSource: { current: () => metric },
    });
    world.update(16, 1);
    assert.equal(world.getDynamicBounds().right, 400, "the screen-locked gameplay bounds end at the screen");
    assert.equal(boatWater(1500, 1000), cell, "the boat still has water beyond the visible screen");
    assert.equal(boatWater(4100, 1000), null, "but not beyond the map's water");
  }

  // The boat moves on the map's water: drifting past the visible screen does not stop it.
  {
    const { service, power, step } = compose();
    const boat = service.spawnIdleBoat(100, 1950, boatItem, "battery");
    service.deployBait(100, 1000, "mix", boat, 0);
    step(100);
    power.charged = false;
    const sideways = { current: { speedPxPerSec: 150, direction: { x: 1, y: 0 } } };
    const startX = boat.pos.x;
    step(600, sideways);
    assert(boat.pos.x > startX + 500, "a drifting boat keeps drifting across the water");
  }
}

run().then(() => {
  console.log("bait-boat-recovery-check passed: cargo spent at the drop, drained boat drifts, net pick-up at its reach " +
    "in metres (none without a net), mooring at the catalog distance, reload restores the trip, leaving loses it.");
}).catch((error) => {
  console.error("bait-boat-recovery-check failed:", error);
  process.exit(1);
});
