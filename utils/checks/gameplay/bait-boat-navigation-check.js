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

function trip(m, map, target, { fps = 60, seconds = 60, planned = true } = {}) {
  const planner = new m.BoatRoutePlanner({ getRevision: () => map.revision, getCellSize: () => CELL,
    getBounds: () => ({ left: 0, top: 0, right: W, bottom: H }), isWater: (x, y) => !!map.water(x, y) });
  const service = new m.ChumService("nav", { baits: { mix: { id: "mix", effectiveStats: { radius: 100,
    targetFishes: [], rampUpTimeMs: 1, peakDurationMs: 1, totalBonusTimeMs: 2, minBonusDurationHours: 1, maxBonus: 2,
    minBonus: 1 } } } }, () => null, { cache: { get: (key, fallback) => fallback, set() {} }, now: () => 0, rng: { next: () => 0.5 }, gameTime: { getGameMs: () => 0 },
    devicePower: { consume: () => ({ hasBattery: true, percent: 100, empty: false }) },
    routePlanner: planned ? planner : null });
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

  // The same trip at 30, 60 and 144 Hz.
  const open = createMap();
  const paths = [30, 60, 144].map((fps) => trip(m, open, far, { fps }));
  for (const result of paths) assert(result.homeAt !== null, "every frame rate completes the trip");
  const times = paths.map((result) => result.dropAt);
  assert(Math.max(...times) - Math.min(...times) < 0.3, `drop time does not depend on the frame rate (${times})`);
}

run().then(() => {
  console.log("bait-boat-navigation-check passed: U trap, land peninsula and long wall reached without ramming, " +
    "fallback gives up safely, unreachable water refused, map edits replanned, frame-rate independent motion.");
}).catch((error) => {
  console.error("bait-boat-navigation-check failed:", error);
  process.exit(1);
});
