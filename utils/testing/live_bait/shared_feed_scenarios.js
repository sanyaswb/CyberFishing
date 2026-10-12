const assert = require("node:assert/strict");

module.exports = async function checkSharedFeed() {
  const { composeLiveBait } = await import("../../../src/bootstrap/production/live_bait_composition.js");
  const { LIVE_BAIT_CONFIG: config } = await import("../../../src/game/config/raw/live_bait/live_bait_config.js");
  const { KeepnetViewModel } = await import("../../../src/game/presentation/keepnet/keepnet_view_model.js");
  const { AquariumFishMotion } = await import("../../../src/game/presentation/house/aquarium_fish_motion.js");
  const { SeededRng } = await import("../../../src/engine/random/seeded_rng.js");
  const key = "fishing_game_player_live_bait_v1";
  const fishDb = [{ id: "crucian_stalker", name: "Crucian" }, { id: "minnow", name: "Minnow" }];
  const fish = { id: "crucian_stalker", weight: .1, imagePath: "assets/fish/a.webp", level: 1,
    rarity: { halfSteps: 2, maxHalfSteps: 12, unitsPerStar: 2 } };
  function fixture(overrides = {}) {
    let now = 1000;
    const values = new Map([["fishing_game_player_inventory_v2", JSON.stringify({ schemaVersion: 4, items: [], assemblies: [], equipment: {}, loadouts: [], settings: {} })]]), rng = new SeededRng(42);
    const create = () => composeLiveBait({ storage: { getItem: (id) => values.get(id) ?? null,
      setItem: (id, raw) => values.set(id, raw), removeItem: (id) => values.delete(id) }, clock: { nowMs: () => now }, rng, fishDb,
      config: { ...config, ...overrides } });
    return { values, create, tick: (ms) => now += ms, now: () => now };
  }
  const durations = [[30, 60, 90], [40, 80, 120, 240], [60, 120, 180, 600]].flat();
  assert.equal(Object.keys(config.aquariumFeeds).length, 11);
  let index = 0;
  for (const item of Object.values(config.aquariumFeeds)) {
    assert.equal(item.durationMs, durations[index++] * 60000);
    const f = fixture(), s = f.create();
    s.buyAquarium(); s.convertCatch(fish, "one"); s.buyFeed(item.id); s.feedAquarium(item.id);
    assert.equal(s.getView().aquarium.feed.durationMs, item.durationMs);
    s.convertCatch({ ...fish, id: "minnow" }, "two"); s.convertCatch(fish, "three");
    assert.equal(s.getView().aquarium.feed.durationMs, item.durationMs - 2 * item.extraFishPenaltyMs);
    assert.equal(s.getView().aquarium.feed.percentage, 100);
    f.tick(s.getView().aquarium.feed.durationMs);
    const bytes = f.values.get(key), projected = s.getView();
    assert.equal(projected.liveBaits.length, 3, "feed depletion itself never kills fish");
    assert.equal(projected.aquarium.feed.percentage, 0);
    assert.equal(projected.aquarium.starvation.remainingMs, item.starvationWindowMs);
    const deadlines = projected.liveBaits.map((entry) => entry.remainingMs);
    assert(deadlines.every((ms) => ms > 0 && ms <= item.starvationWindowMs));
    assert(new Set(deadlines).size > 1, "individual deadlines spread over the window");
    assert.deepEqual(s.getView(), projected, "display refresh cannot reroll");
    assert.equal(f.values.get(key), bytes, "display projection never writes");
    s.advance();
    const loaded = f.create();
    assert.deepEqual(loaded.getView(), projected, "reload retains every deadline");
    f.tick(Math.min(...deadlines)); loaded.advance();
    assert.equal(loaded.getView().liveBaits.length, 2, "one fish dies at its individual deadline");
    loaded.buyFeed(item.id); loaded.feedAquarium(item.id);
    assert.equal(loaded.getView().liveBaits.length, 2, "feeding cannot revive dead fish");
    assert(loaded.getView().liveBaits.every((entry) => entry.remainingMs === null));
    f.tick(loaded.getView().aquarium.feed.durationMs + item.starvationWindowMs); loaded.advance();
    assert.equal(loaded.getView().liveBaits.length, 0, "all unrescued fish die by the quality horizon");
  }
  const auto = fixture(), s = auto.create();
  s.buyAquarium(); s.convertCatch(fish, "auto"); s.selectAquariumFeed("aquarium_feed_premium_500");
  s.buyFeed("aquarium_feed_premium_500"); s.feedAquarium(); s.buyAutoFeeder(); s.buyFeed("aquarium_feed_premium_500");
  auto.tick(60000 * 60); s.advance();
  assert.equal(s.getView().feedStock, 0); assert.equal(s.getView().aquarium.feed.percentage, 100);
  assert.equal(s.getView().aquarium.starvation, null, "feeder acts before starvation");
  auto.tick(24 * 3600000);
  assert.deepEqual(s.getView(), auto.create().getView(), "long offline care equals reload");
  assert.equal(s.getView().liveBaits.length, 0);
  assert.equal(s.buyFeed("ordinary_groundbait").reason, "invalid_feed");
  assert.equal(s.buyFeed("__proto__").reason, "invalid_feed");
  assert.equal(s.selectAquariumFeed("constructor").reason, "invalid_feed");

  const stacks = fixture(), catches = stacks.create();
  catches.keepCatch({ ...fish, weight: .1 }, "heavy");
  catches.keepCatch({ ...fish, weight: .05, imagePath: "assets/fish/rare.webp", rarity: { ...fish.rarity, halfSteps: 8 } }, "rare");
  catches.keepCatch({ ...fish, weight: .08, imagePath: "assets/fish/rare-heavy.webp", rarity: { ...fish.rarity, halfSteps: 8 } }, "rare-heavy");
  catches.keepCatch({ ...fish, hasAnomaly: true, anomaly: "inside" }, "anomaly");
  catches.keepCatch({ ...fish, isUnique: true }, "unique");
  const model = new KeepnetViewModel().build(stacks.create().getView());
  assert.equal(model.groups.length, 3);
  assert.equal(model.groups.find((group) => group.id === "crucian_stalker").imagePath, "assets/fish/rare-heavy.webp");
  assert.equal(model.groups.find((group) => group.id === "crucian_stalker").count, 3);
  assert.equal(model.groups.find((group) => group.id === "fish:anomaly").count, 1);
  assert.equal(model.groups.find((group) => group.id === "fish:unique").count, 1);

  const legacy = fixture();
  legacy.values.set(key, JSON.stringify({ schemaVersion: 2, revision: 1, lastAppliedAtMs: 1000,
    fish: [{ id: "old", speciesId: fish.id, name: "Old", weightKg: .1, level: 1, imagePath: "", rarity: null,
      purpose: "live_bait", disposition: "aquarium", caughtAtMs: 1000, sampledLifetimeMs: 10000,
      remainingLifetimeMs: 5000, deathOrder: .5 }], resolvedCatchIds: { old: "live_bait" },
    aquarium: { owned: true, level: 1, feedBySpecies: { [fish.id]: 0 } },
    feedSupply: { portions: 2, autoFeederOwned: false, autoFeederEnabled: false }, selectedFishId: null }));
  const migrated = legacy.create();
  assert.equal(migrated.error, null); assert.equal(migrated.getView().feedStock, 2);
  assert.equal(migrated.getView().liveBaits[0].remainingMs, 5000);
  assert.equal(migrated.getView().liveBaits[0].isUnique, null);
  migrated.buyFeed(); assert.equal(JSON.parse(legacy.values.get(key)).schemaVersion, 4);
  legacy.tick(5000); migrated.advance(); assert.equal(migrated.getView().liveBaits.length, 0);

  const motion = new AquariumFishMotion({ config: config.visual, rng: new SeededRng(123) });
  motion.setBounds(400, 250); motion.setFish(Array.from({ length: 48 }, (_, i) => ({ id: String(i), imagePath: "" })));
  for (let i = 0; i < 1000; i++) motion.update(100);
  for (const entry of motion.fish) {
    const z = config.visual.zone;
    assert(entry.x - entry.drawSize / 2 >= z.x * 400 - 1e-9);
    assert(entry.x + entry.drawSize / 2 <= (z.x + z.width) * 400 + 1e-9);
    assert(entry.y - entry.drawSize / 2 >= z.y * 250 - 1e-9);
    assert(entry.y + entry.drawSize / 2 <= (z.y + z.height) * 250 + 1e-9);
  }
  assert.equal(motion.setConfig({ ...config.visual, zone: { x: 1, y: 0, width: 1, height: 1 } }), false);
};
