// Spec 152 (G-125): chum spots live by monotonic game time, appear only when the chum reaches the water, merge drops
// of one chum with an averaged age, get overfed by frequent drops, and saves from before spec 152 migrate.
const assert = require("node:assert/strict");

const HOUR = 3600000;

async function load() {
  const [{ ChumService }, { BaitBoat }, { GameTimeClock }, { ITEM_DB }, { ItemDatabase }, { EffectiveItemStatsResolver },
    { ItemStatOverridePolicy }, { CONFIG }, { WaterMetric }] = await Promise.all([
    import("../../../src/game/application/chum/chum_service.js"),
    import("../../../src/game/application/chum/bait_boat.js"),
    import("../../../src/game/domain/time/game_time_clock.js"),
    import("../../../src/game/config/raw/items/item_database.js"),
    import("../../../src/game/application/inventory/item_database.js"),
    import("../../../src/game/domain/items/effective_item_stats_resolver.js"),
    import("../../../src/game/domain/items/item_stat_override_policy.js"),
    import("../../../src/game/config/runtime/game_config.js"),
    import("../../../src/game/domain/locations/water_metric.js"),
  ]);
  // The chum catalog exactly as GameCompositionRoot composes it (#composeChumConfig: definition + effectiveStats).
  const items = new ItemDatabase(ITEM_DB);
  const resolver = new EffectiveItemStatsResolver({
    overridePolicy: new ItemStatOverridePolicy({ config: CONFIG.itemStatOverrides }) });
  const project = (id) => {
    const definition = items.getItemData(id);
    return { ...definition, effectiveStats: resolver.resolve({ definition }) };
  };
  const metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 2000, topY: 0 });
  return { ChumService, BaitBoat, GameTimeClock, project, metric };
}

function createCache() {
  const data = new Map();
  return { data, get: (key, fallback) => data.has(key) ? JSON.parse(data.get(key)) : fallback,
    set: (key, value) => data.set(key, JSON.stringify(value)) };
}

const POWER = { consume: () => ({ hasBattery: true, percent: 100, empty: false }) };

async function run() {
  const { ChumService, BaitBoat, GameTimeClock, project, metric } = await load();
  const carp = project("carp_mix_basic");
  const stats = carp.effectiveStats;
  const other = { id: "other_mix", effectiveStats: { ...stats, targetFishes: ["pike"], feed: undefined } };
  const chumConfig = { baits: { carp_mix_basic: carp, other_mix: other } };

  let realNow = 0;
  const clock = new GameTimeClock({ anchorHours: 12, anchorMs: 0, timeScale: 240, now: () => realNow });
  const cache = createCache();
  const service = new ChumService("spot-test", chumConfig, () => metric,
    { cache, now: () => realNow, rng: { next: () => 0.5 }, gameTime: clock, devicePower: POWER });
  const spotAt = (x, y) => service.getZones().find((zone) => zone.covers(x, y, metric));
  const advanceGameHours = (hours) => { realNow += hours * HOUR / (240 * clock.getRateMultiplier()); service.update(); };

  // B4: the real catalog's chum gives a finite bonus that follows its curve and expires.
  service.deployBait(500, 1000, "carp_mix_basic");
  const spot = spotAt(500, 1000);
  advanceGameHours(stats.rampUpTimeMs / HOUR);
  assert.equal(service.getChumDataAt(500, 1000).bonus, stats.maxBonus, "the catalog chum peaks after its ramp-up");
  assert.deepEqual(service.getChumDataAt(500, 1000).targets, stats.targetFishes);

  // Game time, not real time: the DEV acceleration ages the spot faster in real time, as the clock runs.
  clock.setRateMultiplier(4);
  advanceGameHours(stats.totalBonusTimeMs / HOUR - stats.rampUpTimeMs / HOUR);
  assert.equal(spot.currentBonus, stats.minBonus, "after the bonus time the spot keeps its minimum");
  clock.setRateMultiplier(1);

  // A DEV phase jump forward is elapsed game time (spec 152 D1).
  const hours = clock.getHours();
  clock.setHours((hours + stats.minBonusDurationHours - 1) % 24);
  service.update();
  assert.equal(service.getZones().length, 1, "one hour before expiry the spot is still there");
  advanceGameHours(1);
  assert.equal(service.getZones().length, 0, "the spot expires by game time and leaves the save");
  assert.deepEqual(JSON.parse(cache.data.get("chum_active_spot-test")), []);

  // Same chum: one spot, averaged age and centre; another chum stays separate (spec 152 D3/D5).
  service.deployBait(1000, 1000, "carp_mix_basic");
  const first = service.getZones()[0];
  const firstDrop = first.meanDropGameMs;
  advanceGameHours(4);
  service.deployBait(1020, 1000, "carp_mix_basic");
  assert(!first.isSameSpot("other_mix", first.x, first.y, metric), "another chum never joins this spot");
  service.deployBait(1000, 1600, "other_mix");
  assert.equal(service.getZones().length, 2, "drops of one chum merge, another chum is its own spot");
  assert.equal(first.drops, 2);
  assert.equal(first.x, 1010, "the spot's centre is the drops' average");
  assert.equal(first.meanDropGameMs, firstDrop + 2 * HOUR, "the spot's age is the average of its drops");

  // Overfeeding: frequent drops push the feed above comfort and the bonus falls toward overfedMultiplier.
  const feed = stats.feed;
  const before = first.currentBonus;
  service.deployBait(1010, 1000, "carp_mix_basic");
  service.deployBait(1010, 1000, "carp_mix_basic");
  service.update();
  assert(first.feedAt(clock.getGameMs()) > feed.comfortLoad, "four drops in four hours overfeed");
  assert(first.currentBonus < before, "an overfed spot gives less than before");
  service.deployBait(1010, 1000, "carp_mix_basic");
  service.update();
  assert.equal(first.currentBonus, feed.overfedMultiplier, "at maxLoad the spot reaches the overfed multiplier");
  const fish = service.getChumDataAt(1010, 1000);
  assert(fish.bonus < 1 && fish.targets.includes("crucian_stalker"), "the overfed bonus below 1 reaches the bite");
  advanceGameHours((first.feedAt(clock.getGameMs()) - feed.comfortLoad) / feed.eatenPerHour + 0.01);
  assert(first.currentBonus > feed.overfedMultiplier && first.feedAt(clock.getGameMs()) <= feed.comfortLoad,
    "the fish eat the feed and the spot recovers");

  // A boat leaves no spot until its bunker opens (spec 152 D2).
  const boatCache = createCache();
  const boats = new ChumService("boat-test", chumConfig, () => metric,
    { cache: boatCache, now: () => realNow, rng: { next: () => 0.5 }, gameTime: clock, devicePower: POWER });
  const boat = boats.spawnIdleBoat(500, 1900, { effectiveStats: { sections: 3, manualControl: false,
    statsByLevel: { 1: { speedPxPerSec: 400 } } } });
  boats.deployBait(500, 1500, "carp_mix_basic", boat);
  assert.equal(boats.getZones().length, 0, "the boat's target is not a spot");
  assert.equal(boatCache.data.get("chum_active_boat-test"), undefined, "nothing undelivered is saved");
  let frames = 0;
  while (boats.getZones().length === 0 && frames < 2000) {
    boats.updateBoats(16, () => ({}), () => false, 40, null, metric);
    frames += 1;
  }
  assert.equal(boats.getZones().length, 1, "the spot appears when the bunker opens");
  assert(Math.hypot(boats.getZones()[0].x - 500, boats.getZones()[0].y - 1500) < 15, "at the boat's drop point");

  // Saves from before spec 152: delivered zones keep their age in game time, undelivered ones are dropped.
  const legacy = createCache();
  realNow = 10 * HOUR;
  legacy.set("chum_active_legacy", [
    { id: "a", x: 1, y: 1, baitId: "carp_mix_basic", deployRealTimeMs: realNow - 60000, isDelivered: true },
    { id: "b", x: 2, y: 2, baitId: "carp_mix_basic", deployRealTimeMs: realNow, isDelivered: false },
  ]);
  const migrated = new ChumService("legacy", chumConfig, () => metric, { cache: legacy, now: () => realNow,
    gameTime: clock, legacyTimeScale: 240, devicePower: POWER });
  assert.deepEqual(migrated.getZones().map((zone) => zone.id), ["a"]);
  assert.equal(clock.getGameMs() - migrated.getZones()[0].meanDropGameMs, 60000 * 240,
    "a migrated zone keeps its age at the legacy time scale");

  // The clock's game time is monotonic and saved with it.
  let saved = null;
  const persisted = new GameTimeClock({ anchorHours: 20, anchorMs: 0, timeScale: 60, now: () => 0,
    save: (value) => { saved = value; } });
  const start = persisted.getGameMs();
  persisted.setHours(1);
  assert.equal(persisted.getGameMs() - start, 5 * HOUR, "a jump from 20:00 to 01:00 is five game hours forward");
  assert.equal(new GameTimeClock({ ...saved, now: () => 0 }).getGameMs(), persisted.getGameMs(), "reload keeps it");
  assert.equal(new GameTimeClock({ anchorHours: 6, anchorMs: 0, timeScale: 1, now: () => 0 }).getGameMs(), 6 * HOUR,
    "a save from before spec 152 starts the count at its hour");

  service.dispose(); boats.dispose(); migrated.dispose();
}

run().then(() => {
  console.log("chum-spot-check passed: catalog chum curve and expiry by game time (DEV acceleration, phase jumps), " +
    "merge with averaged age and centre, separate chums, overfeeding and recovery, boat drop only at the bunker, " +
    "legacy migration, monotonic saved clock.");
}).catch((error) => {
  console.error("chum-spot-check failed:", error);
  process.exit(1);
});
