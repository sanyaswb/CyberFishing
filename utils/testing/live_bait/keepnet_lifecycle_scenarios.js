const assert = require("node:assert/strict");

module.exports = async function checkKeepnetLifecycle() {
  const { composeLiveBait } = await import("../../../src/bootstrap/production/live_bait_composition.js");
  const { LIVE_BAIT_CONFIG } = await import("../../../src/game/config/raw/live_bait/live_bait_config.js");
  const key = "fishing_game_player_live_bait_v1";
  const fishDb = [{ id: "crucian_stalker", name: "Crucian" }];
  const fish = { id: "crucian_stalker", name: "Crucian", weight: .1, level: 1,
    imagePath: "assets/fish/crucian_stalker/standart/crucian_stalker--1.webp",
    rarity: { isResolved: true, halfSteps: 3, maxHalfSteps: 12, unitsPerStar: 2 } };
  function fixture(overrides = {}) {
    let now = 1000;
    const values = new Map([["fishing_game_player_inventory_v2", JSON.stringify({ schemaVersion: 4, items: [], assemblies: [], equipment: {}, loadouts: [], settings: {} })]]);
    const storage = { getItem: (id) => values.get(id) ?? null, setItem: (id, value) => values.set(id, value), removeItem: (id) => values.delete(id) };
    const create = () => composeLiveBait({ storage, fishDb, config: { ...LIVE_BAIT_CONFIG, ...overrides },
      rng: { next: () => .25 }, clock: { nowMs: () => now } });
    return { values, create, tick: (ms) => { now += ms; } };
  }
  const metadata = fixture();
  const service = metadata.create();
  service.keepCatch(fish, "catch");
  assert.equal(service.getView().keepnet[0].rarity.halfSteps, 3, "caught rarity must survive retention");
  service.convertStoredCatch("catch");
  let bait = metadata.create().getView().liveBaits[0];
  assert.equal(bait.imagePath, fish.imagePath, "converted live bait keeps its exact artwork");
  assert.equal(bait.rarity.halfSteps, 3, "live bait retains rarity after reload");
  bait.rarity.halfSteps = 12;
  assert.equal(service.getView().liveBaits[0].rarity.halfSteps, 3, "read models cannot mutate stored rarity");
  const old = JSON.parse(metadata.values.get(key));
  old.schemaVersion = 1; old.fish[0].rarity = "";
  old.aquarium.feedBySpecies = {}; delete old.aquarium.feed; delete old.aquarium.starvation;
  old.feedSupply.portions = 0; delete old.feedSupply.stock; delete old.feedSupply.selectedFeedId;
  old.fish[0].deathOrder = .25;
  metadata.values.set(key, JSON.stringify(old));
  const migrated = metadata.create();
  assert.equal(migrated.error, null, "schema 1 saves still load");
  assert.equal(migrated.getView().liveBaits[0].rarity, null, "lost historical rarity is explicitly unknown");
  migrated.buyFeed();
  assert.equal(JSON.parse(metadata.values.get(key)).schemaVersion, 5);
  const corrupt = JSON.parse(metadata.values.get(key));
  corrupt.fish[0].rarity = { halfSteps: 50, maxHalfSteps: 12, unitsPerStar: 2 };
  const corruptBytes = JSON.stringify(corrupt);
  metadata.values.set(key, corruptBytes);
  assert.equal(metadata.create().error, "invalid_snapshot");
  assert.equal(metadata.values.get(key), corruptBytes);

  const expiry = fixture({ lifetimeMinMs: 1000, lifetimeMaxMs: 1000 });
  const expiring = expiry.create();
  expiring.convertCatch(fish, "expires"); expiring.selectBait("expires");
  expiry.tick(1000);
  assert.equal(expiring.getSelectedBait(), null, "expired bait cannot attract fish between care ticks");
  assert.equal(expiring.getView().liveBaits.length, 0, "expired bait disappears on the display tick");
  assert.equal(expiring.beginLiveBaitCast("expires", { compatible: true, free: true, hookCount: 1 }).reason, "bait_unavailable");
  assert.equal(JSON.parse(expiry.values.get(key)).fish[0].disposition, "dead", "rejected command still persists elapsed care");

  const capacity = fixture({ keepnetCapacity: 1 });
  const crowded = capacity.create();
  crowded.convertCatch(fish, "hooked"); crowded.selectBait("hooked");
  const hook = { compatible: true, free: true, hookCount: 1 };
  assert.equal(crowded.beginLiveBaitCast("hooked", hook).ok, true);
  assert.equal(crowded.keepCatch(fish, "overflow").reason, "keepnet_full", "hook reserves a return slot");
  assert.equal(crowded.getView().keepnetReservedCount, 1);
  assert.equal(crowded.endLiveBaitCast("hooked").ok, true);
  crowded.buyAquarium(); crowded.transferToAquarium("hooked"); crowded.keepCatch(fish, "fills");
  assert.equal(crowded.beginLiveBaitCast("hooked", hook).reason, "keepnet_full", "aquarium bait also needs a return slot");

  const protection = fixture({ capacities: [1], lifetimeMinMs: 1000, lifetimeMaxMs: 1000 });
  const mixed = protection.create();
  mixed.buyAquarium(); mixed.convertCatch(fish, "protected"); mixed.buyFeed(); mixed.feedAquarium();
  const overflow = mixed.convertCatch(fish, "outside");
  assert.equal(overflow.notice, "aquarium_full");
  assert.equal(overflow.disposition, "keepnet");
  assert.equal(overflow.fishId, "outside");
  protection.tick(1000);
  assert.deepEqual(mixed.getView().liveBaits.map((entry) => entry.id), ["protected"], "aquarium feed cannot protect keepnet fish of the same species");

  const automatic = fixture({ minimumFeedMs: 1,
    aquariumFeeds: { ...LIVE_BAIT_CONFIG.aquariumFeeds, [LIVE_BAIT_CONFIG.defaultFeedId]: {
      ...LIVE_BAIT_CONFIG.aquariumFeeds[LIVE_BAIT_CONFIG.defaultFeedId], durationMs: 10000 } }, autoFeedTriggerFraction: .5,
    lifetimeMinMs: 1000, lifetimeMaxMs: 1000 });
  const fed = automatic.create();
  fed.buyAquarium(); fed.convertCatch(fish, "fed"); fed.buyFeed(); fed.feedAquarium(); fed.buyAutoFeeder(); fed.buyFeed();
  automatic.tick(6000);
  const bytesBeforeView = automatic.values.get(key);
  assert.equal(fed.getView().feedStock, 0, "read model projects automatic feeding between care ticks");
  assert.equal(fed.getView().aquarium.feed.remainingMs, 14000, "feeder fires at five seconds and adds ten seconds to the five-second remainder");
  assert.equal(fed.getView().aquarium.feed.durationMs, 15000);
  assert.equal(automatic.values.get(key), bytesBeforeView, "view projection never writes storage");
  fed.advance();
  assert.equal(fed.getView().aquarium.feed.remainingMs, 14000);

  const recovery = fixture({ lifetimeMinMs: 1000, lifetimeMaxMs: 1000 });
  const interrupted = recovery.create();
  interrupted.convertCatch(fish, "interrupted"); interrupted.selectBait("interrupted");
  interrupted.beginLiveBaitCast("interrupted", hook); recovery.tick(250);
  const house = recovery.create();
  assert.equal(house.getSelectedBait().disposition, "hook", "visiting house must not cancel an active cast");
  const restarted = recovery.create();
  assert.equal(restarted.recoverInterruptedCast().ok, true);
  assert.equal(restarted.getView().liveBaits[0].location, "keepnet");
  assert.equal(restarted.getView().liveBaits[0].remainingMs, 750, "reload recovers identity without resetting life");
  restarted.beginLiveBaitCast("interrupted", hook); recovery.tick(1000);
  const deadOnReload = recovery.create(); deadOnReload.recoverInterruptedCast();
  assert.equal(deadOnReload.getView().liveBaits.length, 0, "recovery cannot revive expired hook bait");

  const repeated = fixture();
  let cycle = repeated.create();
  for (let index = 0; index < 100; index++) {
    const id = `repeat-${index}`;
    assert.equal(cycle.canConvert({ ...fish, weight: .1 }), true);
    assert.equal(cycle.canConvert({ ...fish, weight: .101 }), false);
    assert.equal(cycle.convertCatch({ ...fish, weight: .101 }, `invalid-${index}`).reason, "bait_ineligible");
    assert.equal(cycle.convertCatch(fish, id).ok, true);
    assert.equal(cycle.convertCatch(fish, id).reason, "already_resolved");
    assert.equal(cycle.selectBait(id).ok, true);
    assert.equal(cycle.beginLiveBaitCast(id, hook).ok, true);
    assert.equal(cycle.settleBaitLoss(id).ok, true);
    assert.equal(cycle.settleBaitLoss(id).reason, "already_consumed");
    cycle = repeated.create();
    assert.equal(cycle.getView().liveBaits.length, 0);
  }
  assert.equal(JSON.parse(repeated.values.get(key)).fish.length, 100);
  const absence = fixture();
  const offline = absence.create();
  offline.buyAquarium(); offline.convertCatch(fish, "offline"); offline.buyFeed(); offline.feedAquarium();
  absence.tick(24 * 60 * 60 * 1000);
  const beforeReload = offline.getView();
  const afterReload = absence.create().getView();
  assert.deepEqual(afterReload, beforeReload, "24-hour absence matches reload to less than a display tick");
  assert.equal(afterReload.aquarium.feed.percentage, 0);
  assert.equal(afterReload.liveBaits.length, 0, "24-hour absence exhausts simple protection and starvation window");
};
