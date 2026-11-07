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
  await checkInventoryStacks({ composeLiveBait, LIVE_BAIT_CONFIG, fishDb });
  await checkHookController({ composeLiveBait, LIVE_BAIT_CONFIG, fishDb });

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

// Spec 162 stage 2: «На живця» on an empty single hook chooses at once; over a bait it waits (green) for «Замінити»,
// which takes the bait off and chooses the live bait; nothing while the tackle is in the water; one hook only.
async function checkHookController({ composeLiveBait, LIVE_BAIT_CONFIG, fishDb }) {
  const { LiveBaitHookController } = await import("../../../src/game/application/live_bait/live_bait_hook_controller.js");
  const values = new Map([["fishing_game_player_inventory_v2", JSON.stringify({ schemaVersion: 4, items: [], assemblies: [], equipment: {}, loadouts: [], settings: {} })]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const liveBait = composeLiveBait({ storage, clock: { nowMs: () => 1000 }, rng: { next: () => 0.5 }, fishDb, config: LIVE_BAIT_CONFIG });
  assert.equal(liveBait.resolveCatch("fry", { id: "crucian_stalker", weight: .05, level: 1, name: "Fry", imagePath: "img/fry.webp" }, "claim").ok, true);
  const equipped = { hooks: [{ instanceId: "hook" }], baits: [{ instanceId: "worm" }] };
  const removed = [];
  const redraws = [];
  // Like the real inventory, removing the bait redraws at once, in the middle of confirm() (TK-233, incidents I-14).
  let hook = null;
  const inventory = { isLocked: false, getEquipped: () => equipped,
    removeHookBait: (id) => { removed.push(id); equipped.baits = [null];
      redraws.push([hook.pendingFishId, hook.preview()]); return { success: true }; } };
  hook = new LiveBaitHookController({ inventory, liveBait, iconAssetOf: (path) => `id:${path}` });
  let changes = 0;
  hook.onChange(() => changes++);
  equipped.hooks = [{ instanceId: "a" }, { instanceId: "b" }];
  assert.equal(hook.choose("fry").reason, "single_hook_required", "a live bait goes only on one hook");
  equipped.hooks = [{ instanceId: "hook" }];
  inventory.isLocked = true;
  assert.equal(hook.choose("fry").reason, "tackle_in_water", "no replacement while the tackle is in the water");
  inventory.isLocked = false;
  assert.deepEqual(hook.choose("fry"), { ok: true, pending: true }, "over a bait the live bait waits for «Замінити»");
  assert(hook.pendingFishId === "fry" && hook.preview() === null && liveBait.getSelectedBait() === null);
  inventory.isLocked = true;
  assert.equal(hook.confirm().reason, "tackle_in_water");
  inventory.isLocked = false;
  assert.equal(hook.confirm().ok, true);
  assert.deepEqual(removed, ["worm"], "«Замінити» returns the bait to the backpack");
  assert.deepEqual(redraws, [["fry", null]], "the redraw inside confirm() sees a waiting live bait and no chosen one yet");
  assert.equal(liveBait.getSelectedBait().fishId, "fry");
  assert.deepEqual(hook.preview(), { fishId: "fry", name: "Fry", iconAsset: "id:img/fry.webp", reserve: 0 },
    "the live bait's picture for the cell; no other live bait of its species in reserve");
  assert.equal(hook.clear().ok, true);
  assert.equal(hook.preview(), null);
  assert.equal(hook.choose("fry").ok, true, "an empty single hook takes the live bait at once");
  assert(hook.pendingFishId === null && liveBait.getSelectedBait().fishId === "fry" && removed.length === 1);
  assert(changes >= 4, "views are told about every change");
}

// Spec 163 stage 1: the backpack shows a stack per species (keepnet + aquarium live baits, least life first, life share
// without numbers); the fish stay in the keepnet; the chosen one cannot be released; a used-up, dead or released bait
// shrinks the stack and its last one removes the species; the choice survives a reload (schema 6).
async function checkInventoryStacks({ composeLiveBait, LIVE_BAIT_CONFIG, fishDb }) {
  const { LiveBaitStackView } = await import("../../../src/game/application/live_bait/live_bait_stack_view.js");
  let now = 9000;
  const values = new Map([["fishing_game_player_inventory_v2", JSON.stringify({ schemaVersion: 4, items: [], assemblies: [], equipment: {}, loadouts: [], settings: {} })]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const rolls = [];
  const create = () => composeLiveBait({ storage, clock: { nowMs: () => now }, rng: { next: () => rolls.shift() ?? 0 }, fishDb, config: LIVE_BAIT_CONFIG });
  const service = create();
  const crucian = { id: "crucian_stalker", weight: .05, level: 1, name: "Crucian", imagePath: "img/crucian.webp" };
  const minnow = { id: "minnow", weight: .04, level: 1, name: "Minnow" };
  const keep = (id, fish, roll) => { rolls.length = 0; rolls.push(roll); assert.equal(service.resolveCatch(id, fish, "claim").ok, true); };
  keep("c-long", crucian, 0.9); keep("c-mid", crucian, 0.5); keep("c-short", crucian, 0.1); keep("m", minnow, 0.5);
  assert.deepEqual(service.getInventoryStacks(), [], "nothing is shown before «В інвентар»");
  assert.equal(service.showSpeciesInInventory("crucian_stalker").ok, true);
  assert.equal(service.showSpeciesInInventory("crucian_stalker").reason, "already_shown");
  assert.equal(service.showSpeciesInInventory("perch_radioactive").reason, "bait_unavailable", "a species without live baits has no stack");
  let [stack] = service.getInventoryStacks();
  assert.equal(service.getInventoryStacks().length, 1, "one stack per shown species");
  assert(stack.speciesId === "crucian_stalker" && stack.count === 3 && stack.name === "Crucian" && stack.imagePath === "img/crucian.webp");
  assert.deepEqual(stack.fish.map((fish) => fish.id), ["c-short", "c-mid", "c-long"], "least life first, as the successor is picked");
  assert(stack.fish.every((fish) => fish.lifeShare > 0 && fish.lifeShare <= 1), "a life share for the scale without numbers");
  const view = service.getView();
  assert(view.liveBaits.filter((fish) => fish.inInventory).length === 3 && !view.liveBaits.find((fish) => fish.id === "m").inInventory);
  assert.equal(view.liveBaits.filter((fish) => fish.location === "keepnet").length, 4, "D3: the stack is a view, the fish stay in the keepnet");
  const saved = JSON.parse(values.get("fishing_game_player_live_bait_v1"));
  assert(saved.schemaVersion === 6 && saved.inventorySpeciesIds.join() === "crucian_stalker", "saved as schema 6");
  assert.equal(create().getInventoryStacks()[0].count, 3, "the stack survives a reload");
  assert.equal(service.selectBait("c-mid").ok, true);
  assert.equal(service.releaseBait("c-mid").reason, "bait_selected", "D1: the chosen live bait cannot be released");
  assert.equal(service.releaseBait("c-long").reason, "bait_in_inventory", "TK-244: a species in the backpack cannot be released");
  assert.equal(service.hideSpeciesFromInventory("crucian_stalker").ok, true);
  assert.equal(service.releaseBait("c-long").ok, true, "back in the keepnet, another live bait can be released again");
  assert.equal(service.showSpeciesInInventory("crucian_stalker").ok, true);
  assert.equal(service.getInventoryStacks()[0].count, 2, "a released live bait leaves the stack");
  now += service.getView().liveBaits.find((fish) => fish.id === "c-short").remainingMs;
  assert.equal(service.advance().ok, true);
  [stack] = service.getInventoryStacks();
  assert.deepEqual(stack.fish.map((fish) => fish.id), ["c-mid"], "D5: a dead live bait leaves the stack (10 -> 9)");
  assert.equal(service.beginLiveBaitCast("c-mid", { compatible: true, free: true, hookCount: 1 }).ok, true);
  assert.deepEqual(service.getInventoryStacks(), [], "the bait on the hook is in use, not in the stack");
  assert.equal(service.settleBaitLoss("c-mid").ok, true);
  assert.equal(JSON.parse(values.get("fishing_game_player_live_bait_v1")).inventorySpeciesIds.length, 0,
    "D5: the species' last live bait used up removes its stack");
  assert.equal(service.showSpeciesInInventory("minnow").ok, true);
  // Stage 2: the inventory's view of the stacks: card ids, the fish art's asset ids, «В садок».
  const stackView = new LiveBaitStackView({ liveBait: service, iconAssetOf: (path) => path ? `id:${path}` : null });
  const [minnowStack] = stackView.stacks();
  assert(minnowStack.id === "live-stack:minnow" && minnowStack.count === 1 && minnowStack.iconAsset === null &&
    minnowStack.fish[0].id === "m" && minnowStack.fish[0].lifeShare > 0);
  assert.equal(stackView.hide("minnow").ok, true, "D6: «В садок» removes the stack");
  assert.equal(service.showSpeciesInInventory("minnow").ok, true);
  assert.equal(service.hideSpeciesFromInventory("minnow").ok, true);
  assert.equal(service.hideSpeciesFromInventory("minnow").reason, "not_shown");
  assert.equal(service.getView().liveBaits.find((fish) => fish.id === "m").location, "keepnet", "the fish stays in the keepnet");
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
  assert.equal(service.countSelectedReserve(), 0, "TK-234: no chosen live bait, no reserve");
  assert.equal(service.selectBait("long").ok, true);
  assert.equal(service.countSelectedReserve(), 1, "TK-234: the reserve counts its species only, not the chosen one");
  assert.equal(service.beginLiveBaitCast("long", { compatible: true, free: true, hookCount: 1 }).ok, true);
  assert.equal(service.countSelectedReserve(), 1, "TK-234: the live bait on the hook keeps its reserve");
  assert.equal(service.settleBaitLoss("long").ok, true);
  assert.equal(service.getSelectedBait().fishId, "short", "a used-up bait is followed by its species' bait with the least life");
  assert.equal(service.countSelectedReserve(), 0, "TK-234: a used-up live bait leaves the reserve");
  assert.equal(service.releaseBait("short").reason, "bait_selected", "spec 163 D1: the chosen live bait cannot be released");
  assert.equal(service.beginLiveBaitCast("short", { compatible: true, free: true, hookCount: 1 }).ok, true);
  assert.equal(service.settleBaitLoss("short").ok, true);
  assert.equal(service.getSelectedBait(), null, "no live bait of the species is left: the choice clears");
  assert.equal(service.selectBait("other").ok, true);
  assert.equal(service.countSelectedReserve(), 1);
  now += life("other");
  assert.equal(service.advance().ok, true);
  assert.equal(service.getSelectedBait().fishId, "minnow-2", "a dead bait is followed by its species' next bait");
  assert.equal(service.countSelectedReserve(), 0, "TK-234: a dead live bait is not in the reserve");

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
