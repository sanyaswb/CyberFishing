// Spec 154 (G-127): the bait boat plans its legs on the current map and follows them; obstacles and land do not trap
// it, unreachable water is refused, a changed map is planned anew, no progress gives up safely, and the motion does
// not depend on the frame rate.
const assert = require("node:assert/strict");

const CELL = 40;
const W = 4000;
const H = 2000;
const SHORE = { x: 2000, y: 1950 };

async function load() {
  const [{ ChumService }, { BoatRoutePlanner }, { ITEM_DB }] = await Promise.all([
    import("../../../src/game/application/chum/chum_service.js"),
    import("../../../src/game/application/chum/boat_route_planner.js"),
    import("../../../src/game/config/raw/items/item_database.js"),
  ]);
  return { ChumService, BoatRoutePlanner, boatItem: { instanceId: "boat",
    effectiveStats: { ...ITEM_DB.deliveryMethods.boat_lvl3.gameplayStats } } };
}

// Land and obstacle cells as rectangles; `revision` changes when the map is edited.
function createMap(blocks = [], land = []) {
  const map = { blocks, land, revision: 1 };
  const inside = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  map.water = (x, y) => (x < 0 || x > W || y < 0 || y > H || map.land.some((r) => inside(x, y, r)) ||
    map.blocks.some((r) => inside(x, y, r)) ? null : {});
  map.sensor = (x, y) => map.blocks.some((r) => inside(x, y, r));
  return map;
}

function trip(m, map, target, { fps = 60, seconds = 60, planned = true, inertial = false } = {}) {
  const planner = new m.BoatRoutePlanner({ getRevision: () => map.revision, getCellSize: () => CELL,
    getBounds: () => ({ left: 0, top: 0, right: W, bottom: H }), isWater: (x, y) => !!map.water(x, y) });
  const service = new m.ChumService("nav", { baits: { mix: { id: "mix", effectiveStats: { radius: 100,
    targetFishes: [], rampUpTimeMs: 1, peakDurationMs: 1, totalBonusTimeMs: 2, minBonusDurationHours: 1, maxBonus: 2,
    minBonus: 1 } } } }, () => null, { cache: { get: (key, fallback) => fallback, set() {} }, now: () => 0, rng: { next: () => 0.5 }, gameTime: { getGameMs: () => 0 },
    devicePower: { consume: () => ({ hasBattery: true, percent: 100, empty: false }) },
    routePlanner: planned ? planner : null, isInertialMotion: () => inertial });
  const boat = service.spawnIdleBoat(SHORE.x, SHORE.y, m.boatItem, "battery");
  boat.immersionTimer = 0;
  const result = { reachable: service.isReachableByBoat(boat, target.x, target.y), dropAt: null, homeAt: null,
    reversals: 0, path: 0, boat, service };
  if (!result.reachable && planned) return result;
  service.deployBait(target.x, target.y, "mix", boat, 0);
  const dt = 1000 / fps;
  let previous = boat.avoidanceState;
  let x = boat.pos.x, y = boat.pos.y;
  for (let t = dt; t <= seconds * 1000; t += dt) {
    service.updateBoats(dt, map.water, map.sensor, CELL, null, null);
    result.path += Math.hypot(boat.pos.x - x, boat.pos.y - y);
    x = boat.pos.x; y = boat.pos.y;
    if (boat.avoidanceState !== previous && boat.avoidanceState === "reversing") result.reversals += 1;
    previous = boat.avoidanceState;
    if (result.dropAt === null && service.getZones().length > 0) result.dropAt = t / 1000;
    if (service.getBoats().length === 0) { result.homeAt = t / 1000; break; }
  }
  return result;
}

async function run() {
  const m = await load();
  const far = { x: 2000, y: 700 };

  // Obstacles and land that trapped the reactive boat: the planned boat reaches the target and comes home.
  const traps = {
    "a U-shaped obstacle opening toward the boat": createMap([{ x: 1800, y: 1100, w: 400, h: 40 },
      { x: 1800, y: 1100, w: 40, h: 300 }, { x: 2160, y: 1100, w: 40, h: 300 }]),
    "a land peninsula (invisible to the rays)": createMap([], [{ x: 1700, y: 1200, w: 500, h: 80 }]),
    "a 1200 px wall": createMap([{ x: 1400, y: 1200, w: 1200, h: 40 }]),
  };
  for (const [name, map] of Object.entries(traps)) {
    const result = trip(m, map, far);
    assert(result.dropAt !== null && result.dropAt < 12, `${name}: drops in time (${result.dropAt})`);
    assert(result.homeAt !== null && result.homeAt < 24, `${name}: comes home (${result.homeAt})`);
    assert(result.reversals <= 1, `${name}: no ramming (${result.reversals} reversals)`);
  }
  const fallback = trip(m, traps["a U-shaped obstacle opening toward the boat"], far, { planned: false });
  assert(fallback.homeAt !== null, "without a route the progress watch gives up the trip and the boat comes home");
  assert.equal(fallback.service.getZones().length, 0, "a given-up target drops nothing");

  // Q1: water the boat cannot reach is refused.
  const lake = createMap([], [{ x: 1500, y: 300, w: 1000, h: 40 }, { x: 1500, y: 700, w: 1000, h: 40 },
    { x: 1500, y: 300, w: 40, h: 440 }, { x: 2460, y: 300, w: 40, h: 440 }]);
  assert.equal(trip(m, lake, { x: 2000, y: 500 }).reachable, false, "an enclosed lake is unreachable");
  assert.equal(trip(m, lake, { x: 1000, y: 1000 }).reachable, true, "open water is reachable");

  // D1: the route is planned on the map as it is when the leg starts.
  const changing = createMap();
  const before = trip(m, changing, far, { seconds: 0.02 });
  assert(before.boat.route.length <= 1, "open water: a straight route");
  changing.blocks.push({ x: 1600, y: 1200, w: 800, h: 40 });
  changing.revision += 1;
  const after = trip(m, changing, far, { seconds: 0.02 });
  assert(after.boat.route.length > 1, "after a map edit the next leg goes around the new obstacle");

  // Spec 154 C: the inertial test preset reaches the same targets without ramming, only later.
  for (const [name, map] of Object.entries(traps)) {
    const result = trip(m, map, far, { inertial: true });
    assert(result.dropAt !== null && result.dropAt < 16, `inertial, ${name}: drops (${result.dropAt})`);
    assert(result.homeAt !== null && result.homeAt < 32, `inertial, ${name}: comes home (${result.homeAt})`);
    assert(result.reversals <= 1, `inertial, ${name}: no ramming`);
  }
  const agile = trip(m, createMap(), far);
  const heavy = trip(m, createMap(), far, { inertial: true });
  assert(heavy.dropAt > agile.dropAt + 1, "the inertial hull takes longer to get going");
  const inertialTimes = [30, 144].map((fps) => trip(m, createMap(), far, { fps, inertial: true }).dropAt);
  assert(Math.abs(inertialTimes[0] - inertialTimes[1]) < 0.4, `inertial motion is frame-rate independent (${inertialTimes})`);

  // TK-161: on the real test location (perspective water, a fine-masked obstacle) a drop 1-2 px above the obstacle
  // goes home along its route at once: far route points are not skipped and the boat turns on the spot.
  await checkReturnBesideObstacle(m);

  // The same trip at 30, 60 and 144 Hz.
  const open = createMap();
  const paths = [30, 60, 144].map((fps) => trip(m, open, far, { fps }));
  for (const result of paths) assert(result.homeAt !== null, "every frame rate completes the trip");
  const times = paths.map((result) => result.dropAt);
  assert(Math.max(...times) - Math.min(...times) < 0.3, `drop time does not depend on the frame rate (${times})`);
}

async function checkReturnBesideObstacle(m) {
  const [{ LocationMap }, { LocationWaterMetricResolver }, { LocationWaterMetricSource }, { CONFIG }] = await Promise.all([
    import("../../../src/game/domain/locations/location_map.js"),
    import("../../../src/game/domain/locations/location_water_metric_resolver.js"),
    import("../../../src/game/domain/locations/location_water_metric_source.js"),
    import("../../../src/game/config/runtime/game_config.js"),
  ]);
  const locations = CONFIG.locations;
  const map = new LocationMap("test", locations, { next: () => 0.5 }, {}, { next: () => 0.5 });
  const metric = new LocationWaterMetricSource({ map, getLocations: () => locations,
    resolver: new LocationWaterMetricResolver({ pixelsPerMeter: 50, logger: { warn() {}, error() {}, info() {} } }) }).current();
  assert.equal(metric.isUniform, false, "the test location has perspective water");
  const cell = locations.cellSize;
  const bounds = { ...map.getCastableBoundsVirtual(cell) };
  const isWater = (x, y) => !!map.getCellAtVirtualPos(x, y, cell) && map.isCastableAt(x, y);
  const water = (x, y) => (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom || !isWater(x, y) ? null : {});
  // The cause: a route point counted as reached within a share of the ground plane's cell, which far away is stretched
  // vertically only, so a point 75 map px beside a far boat was skipped and the boat headed straight for home.
  {
    const { BaitBoatGroundPlaneScope } = await import("../../../src/game/application/chum/bait_boat_ground_plane_scope.js");
    const { BaitBoat } = await import("../../../src/game/application/chum/bait_boat.js");
    const farBoat = new BaitBoat(2075, 600, m.boatItem);
    farBoat.immersionTimer = 0;
    farBoat.setTarget(2070, 1110, null, true);
    farBoat.setRoute([{ x: 2150, y: 590 }, { x: 2070, y: 1110 }]);
    const scope = new BaitBoatGroundPlaneScope();
    const plane = scope.enter({ metric, boat: farBoat, checkPhysics: () => ({}), checkSensor: () => false, cellSize: cell });
    try { farBoat.update(16, plane.checkPhysics, plane.checkSensor, plane.cellSize, null); } finally { scope.exit(); }
    assert.equal(farBoat.route.length, 2, "a route point 75 px beside a boat on far water is not skipped");
  }
  const obstacle = locations.map.test.zones.collisions[0];
  const top = obstacle.y * cell;
  for (const [startX, targetX, targetY] of [[2060, 2060, top - 2], [2060, 2010, top - 1], [2300, 2060, top - 1]]) {
    const planner = new m.BoatRoutePlanner({ getRevision: () => map.getRevision(), getCellSize: () => cell,
      getBounds: () => map.getCastableBoundsVirtual(cell), isWater });
    const service = new m.ChumService("tk161", { baits: { mix: { id: "mix", effectiveStats: { radius: 50, targetFishes: [],
      rampUpTimeMs: 1, peakDurationMs: 1, totalBonusTimeMs: 2, minBonusDurationHours: 1, maxBonus: 2, minBonus: 1 } } } },
      () => metric, { cache: { get: (key, fallback) => fallback, set() {} }, gameTime: { getGameMs: () => 0 },
        devicePower: { consume: () => ({ percent: 100, empty: false }) }, routePlanner: planner });
    const boat = service.spawnIdleBoat(startX, bounds.bottom - 70, m.boatItem, "battery");
    boat.immersionTimer = 0;
    service.deployBait(targetX, targetY, "mix", boat, 0);
    let returnStart = null, reversals = 0, previous = boat.avoidanceState, home = null;
    for (let t = 16; t <= 30000; t += 16) {
      service.updateBoats(16, water, (x, y) => map.hasCollisionAt(x, y), cell, null, metric);
      if (returnStart === null && boat.state === "returning") returnStart = t;
      if (boat.avoidanceState !== previous && boat.avoidanceState === "reversing") reversals += 1;
      previous = boat.avoidanceState;
      if (service.getBoats().length === 0) { home = t; break; }
    }
    const label = `drop at (${targetX}, ${targetY}) beside the obstacle`;
    assert(service.getZones().length === 1, `${label}: dropped`);
    assert(home !== null && home - returnStart < 9000, `${label}: home along the route (${home && (home - returnStart)} ms)`);
    assert.equal(reversals, 0, `${label}: no ramming`);
  }
}

run().then(() => {
  console.log("bait-boat-navigation-check passed: U trap, land peninsula and long wall reached without ramming, " +
    "fallback gives up safely, unreachable water refused, map edits replanned, frame-rate independent motion.");
}).catch((error) => {
  console.error("bait-boat-navigation-check failed:", error);
  process.exit(1);
});
