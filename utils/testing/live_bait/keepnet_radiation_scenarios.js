const assert = require("node:assert/strict");

// Spec 179 D8 (TK-369): the radiation dose of the keepnet and the hook. A frame adds radiation × seconds; the save gets it
// when the closest fish would die or once a careTickMs. A live bait dies after liveBaitSec of full radiation (in the
// keepnet and on the hook), another fish after secPerKg × weight^weightExponent, a unique fish never; the keepnet's
// conditional level keeps out its share; removeRadiationDead decides whether a dead catch still shows; a v6 save loads
// with dose 0. Fails before the radiation dose: KeepnetRadiationExposure and applyRadiation do not exist.
module.exports = async function checkKeepnetRadiation() {
  const { composeLiveBait } = await import("../../../src/bootstrap/production/live_bait_composition.js");
  const { LIVE_BAIT_CONFIG } = await import("../../../src/game/config/raw/live_bait/live_bait_config.js");
  const { KeepnetRadiationExposure } = await import("../../../src/game/application/live_bait/keepnet_radiation_exposure.js");
  const key = "fishing_game_player_live_bait_v1";
  const fishDb = [{ id: "crucian_stalker", name: "Crucian" }];
  const rarity = { isResolved: true, halfSteps: 3, maxHalfSteps: 12, unitsPerStar: 2 };
  const fish = (weight, extra = {}) => ({ id: "crucian_stalker", name: "Crucian", weight, level: 1, imagePath: "", rarity, ...extra });
  function fixture(keepnet = {}) {
    let now = 1000;
    const values = new Map([["fishing_game_player_inventory_v2", JSON.stringify({ schemaVersion: 4, items: [], assemblies: [],
      equipment: {}, loadouts: [], settings: {} })]]);
    const storage = { getItem: (id) => values.get(id) ?? null, setItem: (id, value) => values.set(id, value),
      removeItem: (id) => values.delete(id) };
    const config = { ...LIVE_BAIT_CONFIG, keepnet: { ...LIVE_BAIT_CONFIG.keepnet, ...keepnet } };
    const service = composeLiveBait({ storage, fishDb, config, rng: { next: () => .25 }, clock: { nowMs: () => now } });
    const exposure = new KeepnetRadiationExposure({ liveBait: service, config });
    const saved = () => JSON.parse(values.get(key));
    const doseOf = (id) => saved().fish.find((entry) => entry.id === id).radiationDose;
    const dispositionOf = (id) => saved().fish.find((entry) => entry.id === id).disposition;
    // Frames of one second; the page clock moves with them (the live bait's own lifetime is 30+ minutes).
    const frames = (count, radiation) => {
      let applied = 0;
      for (let index = 0; index < count; index += 1) { now += 1000; if (exposure.update(1000, radiation)) applied += 1; }
      return applied;
    };
    return { values, config, service, exposure, saved, doseOf, dispositionOf, frames };
  }

  const world = fixture();
  const { service } = world;
  service.keepCatch(fish(.3), "small");
  service.keepCatch(fish(1), "big");
  service.keepCatch(fish(.3, { hasAnomaly: true, anomaly: "inside", isUnique: true }), "unique");
  service.keepCatch(fish(.08), "bait-net");
  service.keepCatch(fish(.09), "bait-hook");
  assert.equal(world.saved().schemaVersion, 7, "the live bait save is schema 7");
  assert.equal(service.selectBait("bait-hook").ok, true);
  assert.equal(service.beginLiveBaitCast("bait-hook", { compatible: true, free: true, hookCount: 1 }).ok, true);
  assert.equal(world.dispositionOf("bait-hook"), "hook");
  assert.equal(world.doseOf("small"), 0, "a new fish has no dose");

  // No radiation, nothing gathered: a frame does nothing and writes nothing.
  const revision = world.saved().revision;
  assert.equal(world.frames(30, 0), 0);
  assert.equal(world.saved().revision, revision, "without radiation the save is not written");
  assert.equal(service.radiationHeadroomSec(), LIVE_BAIT_CONFIG.keepnet.radiationTolerance.liveBaitSec,
    "the live bait is the closest to death");

  // Full radiation: two seconds gather in memory; the third reaches the live bait's 3 s and is saved at once.
  assert.equal(world.frames(2, 1), 0, "a dose under every tolerance waits for the care tick");
  assert.equal(world.doseOf("small"), 0, "the gathered dose is not saved every frame");
  assert.equal(world.frames(1, 1), 1, "the live baits' tolerance reached — the dose is applied");
  assert.equal(world.dispositionOf("bait-net"), "dead", "a live bait in the keepnet dies of radiation in seconds");
  assert.equal(world.dispositionOf("bait-hook"), "dead", "a live bait on the hook dies too");
  assert.equal(service.getSelectedBait(), null, "the dead hook bait is no longer the chosen one");
  assert.equal(world.doseOf("small"), 3);
  assert.equal(world.doseOf("unique"), 0, "a unique fish takes no dose");
  assert.equal(world.dispositionOf("small"), "keepnet");

  // 0.3 kg: 120 × 0.3^0.8 ≈ 45.8 s; 1 kg: 120 s.
  const smallTolerance = 120 * Math.pow(.3, .8);
  assert.ok(Math.abs(service.radiationHeadroomSec() - (smallTolerance - 3)) < 1e-9, "the headroom is the small fish's");
  world.frames(42, 1);
  assert.equal(world.dispositionOf("small"), "keepnet", "45 s of radiation: the 0.3 kg fish still lives");
  world.frames(1, 1);
  assert.equal(world.dispositionOf("small"), "dead", "the 0.3 kg fish dies at its tolerance");
  assert.equal(world.dispositionOf("big"), "keepnet", "the 1 kg fish lives longer");
  assert.ok(world.doseOf("big") >= 45 && world.doseOf("big") < 120);
  world.frames(80, 1);
  assert.equal(world.dispositionOf("big"), "dead", "the 1 kg fish dies after 120 s");
  assert.equal(world.dispositionOf("unique"), "keepnet", "the unique fish never dies of radiation");
  assert.equal(service.radiationHeadroomSec(), Infinity, "only the unique fish is left: nothing can die");

  // removeRadiationDead: on (default) — the dead catches leave the keepnet; off — they show dead and can be thrown away.
  assert.deepEqual(service.getView().keepnet.map((entry) => entry.id), ["unique"]);
  world.config.keepnet.removeRadiationDead = false;
  const shown = service.getView().keepnet;
  assert.deepEqual(shown.map((entry) => [entry.id, entry.dead === true]).sort(),
    [["big", true], ["small", true], ["unique", false]], "off: dead catches stay, marked dead");
  assert.equal(service.releaseCatch("small").ok, true, "a dead catch can be thrown away");
  assert.equal(world.dispositionOf("small"), "released");

  // The keepnet's conditional level keeps out its share of the dose (level 6 — 50 %).
  const shielded = fixture({ level: 6 });
  shielded.service.keepCatch(fish(1), "shielded");
  shielded.frames(10, 1);
  assert.ok(Math.abs(shielded.doseOf("shielded") - 5) < 1e-9, "level 6: ten seconds give five");
  const fullShield = fixture({ radiationShieldByLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] });
  fullShield.service.keepCatch(fish(.08), "safe");
  assert.equal(fullShield.service.radiationHeadroomSec(), Infinity, "a shield of 1 keeps every fish");

  // Half radiation gathers half the dose; once the radiation stops, the gathered rest still reaches the save.
  const half = fixture();
  half.service.keepCatch(fish(2), "half");
  half.frames(4, .5);
  half.frames(10, 0);
  assert.ok(Math.abs(half.doseOf("half") - 2) < 1e-9, "four seconds at 50 % are two of full radiation");

  // A schema 6 save (before the dose) loads, its fish with dose 0.
  const legacy = fixture();
  legacy.service.keepCatch(fish(1), "old");
  const old = legacy.saved();
  old.schemaVersion = 6;
  for (const entry of old.fish) delete entry.radiationDose;
  legacy.values.set(key, JSON.stringify(old));
  const reloaded = composeLiveBait({ storage: { getItem: (id) => legacy.values.get(id) ?? null,
    setItem: (id, value) => legacy.values.set(id, value), removeItem: (id) => legacy.values.delete(id) },
  fishDb, config: legacy.config, rng: { next: () => .25 }, clock: { nowMs: () => 999999 } });
  assert.equal(reloaded.error, null, "a schema 6 save still loads");
  assert.equal(reloaded.applyRadiation(1).ok, true);
  assert.equal(legacy.saved().schemaVersion, 7);
  assert.equal(legacy.saved().fish.find((entry) => entry.id === "old").radiationDose, 1, "the old fish started at 0");
  const corrupt = legacy.saved();
  corrupt.fish[0].radiationDose = -1;
  legacy.values.set(key, JSON.stringify(corrupt));
  assert.equal(composeLiveBait({ storage: { getItem: (id) => legacy.values.get(id) ?? null, setItem() {}, removeItem() {} },
    fishDb, config: legacy.config, rng: { next: () => .25 }, clock: { nowMs: () => 999999 } }).error, "invalid_snapshot",
  "a negative dose is a corrupt save");

  console.log("Keepnet radiation passed: a frame gathers, the save gets the dose at a death or a care tick; live baits " +
    "(keepnet and hook) die in 3 s, 0.3 kg at ~46 s, 1 kg at 120 s, the unique fish never; the level's shield; dead " +
    "catches leave or stay marked; schema 6 → 7 with dose 0.");
};
