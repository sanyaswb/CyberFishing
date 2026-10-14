"use strict";
const assert = require("node:assert/strict");

async function main() {
  await require("./testing/live_bait/feed_loading_scenarios")();
  await require("./testing/live_bait/keepnet_lifecycle_scenarios")();
  await require("./testing/live_bait/shared_feed_scenarios")();
  await require("./testing/live_bait/inventory_feed_scenarios")();
  await require("./testing/live_bait/feed_picker_scenarios")();
  const { composeLiveBait } = await import("../src/bootstrap/production/live_bait_composition.js");
  const { LIVE_BAIT_CONFIG } = await import("../src/game/config/raw/live_bait/live_bait_config.js");
  const { LiveBaitMotionAdapter } = await import("../src/game/application/live_bait/live_bait_motion_adapter.js");
  const { LiveBaitMotionProfileResolver } = await import("../src/game/domain/live_bait/live_bait_motion_profile_resolver.js");
  const { LiveBaitSnapshotStore } = await import("../src/game/application/live_bait/live_bait_snapshot_store.js");
  const { LiveBaitLocalStore } = await import("../src/platform/browser/storage/live_bait_local_store.js");
  const { ConfigSchemaValidator } = await import("../src/game/config/validation/config_schema_validator.js");
  const { CONFIG } = await import("../src/game/config/runtime/game_config.js");
  const { FISH_DB } = await import("../src/game/config/databases/fish_database.js");
  const { ITEM_DB } = await import("../src/game/config/databases/item_catalog.js");
  const { KeepnetViewModel } = await import("../src/game/presentation/keepnet/keepnet_view_model.js");
  const { VictoryLayoutResolver } = await import("../src/game/presentation/screens/victory_layout_resolver.js");
  const { VictoryActionGestureResolver } = await import("../src/game/presentation/input/victory_action_gesture_resolver.js");
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
  assert.equal(service.resolveCatch("claim", fish, "claim").ok, true);
  assert.equal(service.getView().keepnet.length, 1);
  assert.equal(service.convertStoredCatch("claim").ok, true);
  assert.equal(service.getView().liveBaits[0].id, "claim");
  const keepnetModel = new KeepnetViewModel().build(service.getView(), { kind: "live_bait",
    speciesId: "crucian_stalker" });
  assert.equal(keepnetModel.filtered.length, 1);
  assert.equal(keepnetModel.filtered[0].id, "claim");
  assert.equal(new KeepnetViewModel().build(service.getView(), { kind: "catch" }).filtered.length, 0);
  now += LIVE_BAIT_CONFIG.lifetimeMinMs;
  assert.equal(service.advance().ok, true);
  assert.equal(service.getView().deadCount, 1);
  assert.equal(create().getView().deadCount, 1, "reload does not revive or reroll");
  assert.equal(service.selectBait("claim").ok, false);

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

  const layout = new VictoryLayoutResolver();
  const actions = layout.resolve({ width: 800, height: 900, config: {}, canLiveBait: true });
  assert(actions.liveBait.width > 0);
  const center = { x: actions.liveBait.x + actions.liveBait.width / 2,
    y: actions.liveBait.y + actions.liveBait.height / 2 };
  assert.equal(new VictoryActionGestureResolver().resolve({ input: { pointerReleased: true,
    pointerGestureId: 2, pointerStart: center, pointerRelease: center }, entryGestureId: 1, actions }), "live_bait");
  assert.equal(new VictoryActionGestureResolver().resolve({ input: { pointerReleased: true,
    pointerGestureId: 1, pointerStart: center, pointerRelease: center }, entryGestureId: 1, actions }), null);
  assert.equal(layout.resolve({ width: 800, height: 900, config: {}, canLiveBait: false }).liveBait.width, 0);

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

main().catch((error) => { console.error(error); process.exitCode = 1; });
