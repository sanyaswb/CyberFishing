"use strict";
const assert = require("node:assert/strict");

async function main() {
  await require("../../testing/live_bait/feed_loading_scenarios")();
  await require("../../testing/live_bait/keepnet_lifecycle_scenarios")();
  await require("../../testing/live_bait/shared_feed_scenarios")();
  await require("../../testing/live_bait/inventory_feed_scenarios")();
  await require("../../testing/live_bait/feed_picker_scenarios")();
  const { composeLiveBait } = await import("../../../src/bootstrap/production/live_bait_composition.js");
  const { LIVE_BAIT_CONFIG } = await import("../../../src/game/config/raw/live_bait/live_bait_config.js");
  const { LiveBaitMotionAdapter } = await import("../../../src/game/application/live_bait/live_bait_motion_adapter.js");
  const { LiveBaitMotionProfileResolver } = await import("../../../src/game/domain/live_bait/live_bait_motion_profile_resolver.js");
  const { LiveBaitSnapshotStore } = await import("../../../src/game/application/live_bait/live_bait_snapshot_store.js");
  const { LiveBaitLocalStore } = await import("../../../src/platform/browser/storage/live_bait_local_store.js");
  const { ConfigSchemaValidator } = await import("../../../src/game/config/validation/config_schema_validator.js");
  const { CONFIG } = await import("../../../src/game/config/runtime/game_config.js");
  const { FISH_DB } = await import("../../../src/game/config/databases/fish_database.js");
  const { ITEM_DB } = await import("../../../src/game/config/databases/item_catalog.js");
  const { KeepnetViewModel } = await import("../../../src/game/presentation/keepnet/keepnet_view_model.js");
  let now = 1000;
  const values = new Map([["fishing_game_player_inventory_v2", JSON.stringify({ schemaVersion: 4, items: [], assemblies: [], equipment: {}, loadouts: [], settings: {} })]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const clock = { nowMs: () => now };
  const rng = { next: () => 0 };
  const fishDb = [
    { id: "crucian_stalker", name: "Crucian" },
    { id: "minnow", name: "Minnow" },
  ];
  const create = (config = LIVE_BAIT_CONFIG) => composeLiveBait({ storage, clock, rng, fishDb, config });
  const service = create();
  assert.equal(service.canConvert({ id: "crucian_stalker", weight: .100 }), true);
  assert.equal(service.canConvert({ id: "crucian_stalker", weight: .101 }), false);
  assert.equal(service.canConvert({ id: "minnow", weight: .05 }), true);
  assert.equal(service.canConvert({ id: "crucian_stalker", weight: NaN }), false);
  const fish = { id: "crucian_stalker", weight: .1, level: 1, name: "Crucian" };
  assert.equal(service.resolveCatch("one", fish, "live_bait").ok, true);
  assert.equal(service.resolveCatch("one", fish, "claim").reason, "already_resolved");
  assert.equal(service.getView().liveBaits[0].location, "keepnet");
  assert.equal(service.getView().liveBaits[0].remainingMs, LIVE_BAIT_CONFIG.lifetimeMinMs);
  assert.equal(service.selectBait("one").ok, true);
  assert.equal(service.beginLiveBaitCast("one", { compatible: true, free: true, hookCount: 2 }).ok, false);
  assert.equal(service.beginLiveBaitCast("one", { compatible: true, free: true, hookCount: 1 }).ok, true);
  assert.equal(service.getSelectedBait().fishId, "one");
  assert.equal(service.selectBait(null).reason, "hook_busy");
  assert.equal(service.endLiveBaitCast("one").ok, true);
  assert.equal(service.beginLiveBaitCast("one", { compatible: true, free: true, hookCount: 1 }).ok, true);
  assert.equal(service.settleBaitLoss("one").ok, true);
  assert.equal(service.settleBaitLoss("one").ok, false);
  assert.equal(service.getSelectedBait(), null);
  assert.equal(service.resolveCatch("too-heavy", { ...fish, weight: .101 }, "live_bait").ok, false);
  assert.equal(service.resolveCatch("released", fish, "release").ok, true);
  assert.equal(service.getView().keepnet.length, 0);
  // Spec 162: a kept fish that suits live bait becomes one at once; a heavier one stays a catch.
  assert.equal(service.resolveCatch("claim", fish, "claim").ok, true);
  assert.equal(service.getView().keepnet.length, 0, "a kept fish that suits live bait is not a catch");
  assert.equal(service.getView().liveBaits[0].id, "claim");
  assert.equal(service.getView().liveBaits[0].location, "keepnet", "auto live bait stays in the keepnet");
  assert.equal(service.resolveCatch("heavy", { ...fish, weight: .5 }, "claim").ok, true);
  assert.equal(service.getView().keepnet.length, 1, "a heavier fish stays a catch");
  const keepnetModel = new KeepnetViewModel().build(service.getView(), { kind: "live_bait",
    speciesId: "crucian_stalker" });
  assert.equal(keepnetModel.filtered.length, 1);
  assert.equal(keepnetModel.filtered[0].id, "claim");
  assert.equal(new KeepnetViewModel().build(service.getView(), { kind: "catch" }).filtered.length, 1);
  now += LIVE_BAIT_CONFIG.lifetimeMinMs;
  assert.equal(service.advance().ok, true);
  assert.equal(service.getView().deadCount, 1);
  assert.equal(create().getView().deadCount, 1, "reload does not revive or reroll");
  assert.equal(service.selectBait("claim").ok, false);

  checkSuccessionAndMigration({ composeLiveBait, LIVE_BAIT_CONFIG, fishDb });

  const aquarium = create();
  assert.equal(aquarium.buyAquarium().ok, true);
  for (let i = 0; i < LIVE_BAIT_CONFIG.capacities.length; i++) {
    assert.equal(aquarium.getView().aquarium.capacity, LIVE_BAIT_CONFIG.capacities[i]);
    if (i < LIVE_BAIT_CONFIG.capacities.length - 1) assert.equal(aquarium.upgradeAquarium().ok, true);
  }
  assert.equal(aquarium.upgradeAquarium().reason, "max_level");
  assert.equal(aquarium.buyFeed().ok, true);
  assert.equal(aquarium.getView().feedStock, 1);
  assert.equal(aquarium.convertCatch(fish, "a").ok, true);
  assert.equal(aquarium.getView().liveBaits.find((item) => item.id === "a").location, "aquarium");
  assert.equal(aquarium.feedAquarium().ok, true);
  assert.equal(aquarium.getView().aquarium.feed.percentage, 100);
  assert.equal(aquarium.getView().feedStock, 0);
  now += LIVE_BAIT_CONFIG.aquariumFeeds[LIVE_BAIT_CONFIG.defaultFeedId].durationMs / 2;
  assert.equal(aquarium.advance().ok, true);
  assert(Math.abs(aquarium.getView().aquarium.feed.percentage - 50) < .001);
  assert.equal(aquarium.getView().liveBaits.find((item) => item.id === "a").remainingMs, null);
  aquarium.buyFeed();
  aquarium.feedAquarium();
  assert.equal(aquarium.getView().aquarium.feed.percentage, 100);
  aquarium.buyAutoFeeder();
  aquarium.buyFeed();
  now += aquarium.getView().aquarium.feed.remainingMs;
  aquarium.advance();
  assert.equal(aquarium.getView().feedStock, 0, "auto feeder consumes finite stock");
  assert.equal(aquarium.getView().aquarium.feed.percentage, 100);
  now += LIVE_BAIT_CONFIG.aquariumFeeds[LIVE_BAIT_CONFIG.defaultFeedId].durationMs + LIVE_BAIT_CONFIG.aquariumFeeds[LIVE_BAIT_CONFIG.defaultFeedId].starvationWindowMs;
  aquarium.advance();
  assert.equal(aquarium.getView().liveBaits.some((item) => item.id === "a"), false, "starvation eventually kills");

  const motionState = { weight: 1, speedMultiplier: 1, forceMultiplier: 1,
    minTime: 10000, maxTime: 10000 };
  const sourcePhysics = { movementProfile: { baseSpeed: 2, radialRange: [1, 1], lateralRange: [1, 1] },
    behaviorProfile: { behaviors: { idle: motionState, rest: motionState,
      swim: motionState, lastDash: motionState } } };
  const resolvedPhysics = new LiveBaitMotionProfileResolver([
    { id: "crucian_stalker", physics: sourcePhysics },
  ]).resolve("crucian_stalker");
  assert.deepEqual(Object.keys(resolvedPhysics.behaviorProfile.behaviors), ["swim"]);
  assert.equal(LIVE_BAIT_CONFIG.motionMultiplier, .5);
  const impulses = [];
  const baselineImpulses = [];
  const adapter = new LiveBaitMotionAdapter({ physics: resolvedPhysics,
    multiplier: LIVE_BAIT_CONFIG.motionMultiplier, rng });
  const baselineAdapter = new LiveBaitMotionAdapter({ physics: resolvedPhysics, multiplier: 1, rng });
  for (let index = 0; index < 4; index++) {
    const sample = adapter.update(1000, { applyForce: (vector) => impulses.push({ x: vector.x, y: vector.y }) });
    baselineAdapter.update(1000, { applyForce: (vector) => baselineImpulses.push({ x: vector.x, y: vector.y }) });
    assert.equal(sample.name, "swim");
    assert(Math.abs(impulses[index].x - baselineImpulses[index].x * .5) < 1e-9);
    assert(Math.abs(impulses[index].y - baselineImpulses[index].y * .5) < 1e-9);
  }
  const invalidConfig = { ...CONFIG, liveBait: { ...LIVE_BAIT_CONFIG, motionMultiplier: 1.2,
    lifetimeMinMs: LIVE_BAIT_CONFIG.lifetimeMaxMs + 1 } };
  const configIssues = new ConfigSchemaValidator({ config: invalidConfig, fishDb: FISH_DB,
    itemDb: ITEM_DB, mapDb: CONFIG.locations.map }).validate().errors;
  assert(configIssues.some((issue) => issue.path === "CONFIG.liveBait.motionMultiplier"));
  assert(configIssues.some((issue) => issue.path.includes("CONFIG.liveBait.lifetimeMinMs")));
  const mismatchedItems = { ...ITEM_DB, baits: { ...ITEM_DB.baits,
    live_crucian: null } };
  const catalogIssues = new ConfigSchemaValidator({ config: CONFIG, fishDb: FISH_DB,
    itemDb: mismatchedItems, mapDb: CONFIG.locations.map }).validate().errors;
  assert(catalogIssues.some((issue) => issue.path === "CONFIG.liveBait.baitId"));

  const stale = create();
  const stalePeer = create();
  assert.equal(stale.buyFeed().ok, true);
  assert.equal(stalePeer.buyFeed().ok, true, "a second page refreshes before its command");
  assert.equal(stalePeer.getView().feedStock, stale.getView().feedStock, "both pages read the same authoritative inventory stock");
  const firstWriter = new LiveBaitSnapshotStore(new LiveBaitLocalStore(storage));
  const secondWriter = new LiveBaitSnapshotStore(new LiveBaitLocalStore(storage));
  const firstState = firstWriter.load(now, fishDb, LIVE_BAIT_CONFIG).state;
  const secondState = secondWriter.load(now, fishDb, LIVE_BAIT_CONFIG).state;
  assert.equal(firstWriter.save(firstState).ok, true);
  assert.equal(secondWriter.save(secondState).reason, "stale_revision", "a real write race reports conflict");
  const original = values.get("fishing_game_player_live_bait_v1");
  values.set("fishing_game_player_live_bait_v1", "{corrupt");
  const corrupt = create();
  assert.equal(corrupt.getView().error, "corrupt_snapshot");
  assert.equal(values.get("fishing_game_player_live_bait_v1"), "{corrupt", "corrupt bytes remain recoverable");
  const invalid = JSON.parse(original);
  invalid.feedSupply.autoFeederEnabled = "yes";
  const invalidBytes = JSON.stringify(invalid);
  values.set("fishing_game_player_live_bait_v1", invalidBytes);
  assert.equal(create().getView().error, "invalid_snapshot");
  assert.equal(values.get("fishing_game_player_live_bait_v1"), invalidBytes, "invalid bytes remain recoverable");
  values.set("fishing_game_player_live_bait_v1", original);
  console.log("Live bait passed: eligibility, exactly-once disposition, one-hook lifecycle, save conflicts, time/death, aquarium levels/feed/auto care, input and swim-only half-speed motion.");
}

// Spec 162: the chosen live bait is followed by the same species' live bait with the least life left (used up, dead or
// released); saved catches that suit live bait become live baits on load.
function checkSuccessionAndMigration({ composeLiveBait, LIVE_BAIT_CONFIG, fishDb }) {
  let now = 5000;
  const values = new Map([["fishing_game_player_inventory_v2", JSON.stringify({ schemaVersion: 4, items: [], assemblies: [], equipment: {}, loadouts: [], settings: {} })]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const rolls = [];
  const rng = { next: () => rolls.shift() ?? 0 };
  const create = (config = LIVE_BAIT_CONFIG) => composeLiveBait({ storage, clock: { nowMs: () => now }, rng, fishDb, config });
  const service = create();
  const crucian = { id: "crucian_stalker", weight: .05, level: 1, name: "Crucian" };
  const minnow = { id: "minnow", weight: .04, level: 1, name: "Minnow" };
  const keep = (id, fish, roll) => { rolls.length = 0; rolls.push(roll); assert.equal(service.resolveCatch(id, fish, "claim").ok, true); };
  keep("long", crucian, 0.9);
  keep("short", crucian, 0.1);
  keep("other", minnow, 0);
  keep("minnow-2", minnow, 0.5);
  const life = (id) => service.getView().liveBaits.find((entry) => entry.id === id).remainingMs;
  assert(life("other") < life("short") && life("short") < life("long"));
  assert.equal(service.selectBait("long").ok, true);
  assert.equal(service.beginLiveBaitCast("long", { compatible: true, free: true, hookCount: 1 }).ok, true);
  assert.equal(service.settleBaitLoss("long").ok, true);
  assert.equal(service.getSelectedBait().fishId, "short", "a used-up bait is followed by its species' bait with the least life");
  assert.equal(service.releaseBait("short").ok, true);
  assert.equal(service.getSelectedBait(), null, "no live bait of the species is left: the choice clears");
  assert.equal(service.selectBait("other").ok, true);
  now += life("other");
  assert.equal(service.advance().ok, true);
  assert.equal(service.getSelectedBait().fishId, "minnow-2", "a dead bait is followed by its species' next bait");

  // Migration: a catch kept under an older rule (here a lighter limit) becomes a live bait when loaded.
  values.delete("fishing_game_live_bait_v1");
  for (const key of [...values.keys()]) if (key !== "fishing_game_player_inventory_v2") values.delete(key);
  const old = create({ ...LIVE_BAIT_CONFIG, maxWeightKg: 0.01 });
  assert.equal(old.resolveCatch("stored", crucian, "claim").ok, true);
  assert.equal(old.getView().keepnet.length, 1);
  const reloaded = create();
  assert.equal(reloaded.getView().keepnet.length, 0, "a stored catch that suits live bait is converted on load");
  assert.equal(reloaded.getView().liveBaits.find((entry) => entry.id === "stored").location, "keepnet");
  assert.equal(create().getView().liveBaits.length, 1, "the conversion is saved once");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
