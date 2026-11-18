const assert = require("node:assert/strict");

// Spec 179 D10 (TK-370): the radiation's wear of the items with a condition, on the real catalog. One average full
// emission (radiation × seconds = the location's mean full dose) takes from each item a share of its condition rolled
// in the range of its quality (1 — 80…100, 10 — 20…40), less by its radiation immunity (rods and reels 0.5); it wears
// gradually, never below 0, with a new roll per emission from the session's seeded stream; nothing without radiation.
// The quality an item works with falls with its condition; condition 0 — broken: no cast with it, a broken gas mask does
// not protect. Fails before stage H: the wear modules do not exist and a worn item keeps its quality.
module.exports = async function checkEmissionWear() {
  const { ITEM_DB } = await import("../../../src/game/config/raw/items/item_database.js");
  const { ITEM_STAT_OVERRIDE_CONFIG } = await import("../../../src/game/config/raw/items/item_stat_overrides.js");
  const { CONFIG } = await import("../../../src/game/config/runtime/game_config.js");
  const { MAP_DB } = await import("../../../src/game/config/databases/location_catalog.js");
  const { ItemStatOverridePolicy } = await import("../../../src/game/domain/items/item_stat_override_policy.js");
  const { EffectiveItemStatsResolver } = await import("../../../src/game/domain/items/effective_item_stats_resolver.js");
  const { FlatInventoryItemRepository } = await import("../../../src/game/domain/inventory/flat_inventory_item_repository.js");
  const { InventoryItemLocation } = await import("../../../src/game/domain/inventory/inventory_item_location.js");
  const { SeededRng } = await import("../../../src/engine/random/seeded_rng.js");
  const { ItemRadiationWearPolicy } = await import("../../../src/game/domain/items/condition/item_radiation_wear_policy.js");
  const { isItemBroken, wornQuality } = await import("../../../src/game/domain/items/condition/item_condition_quality.js");
  const { meanFullEmissionDoseSec } = await import("../../../src/game/domain/weather/emission_dose.js");
  const { ApplyItemWearService } = await import("../../../src/game/application/inventory/apply_item_wear_service.js");
  const { EmissionWearExposure } = await import("../../../src/game/application/world/emission_wear_exposure.js");
  const { FishingReadinessPolicy } = await import("../../../src/game/domain/equipment/fishing_readiness_policy.js");
  const { EmissionExposure } = await import("../../../src/game/application/world/emission_exposure.js");
  const { EquipmentStatusSource } = await import("../../../src/game/application/world/equipment_status_source.js");

  const settings = CONFIG.emission.wear;
  const definitions = new Map(Object.values(ITEM_DB).flatMap((group) => Object.values(group)).map((item) => [item.id, item]));
  const resolver = new EffectiveItemStatsResolver({ overridePolicy: new ItemStatOverridePolicy({ config: ITEM_STAT_OVERRIDE_CONFIG }),
    qualityCurve: () => settings.qualityCurve });
  const hydrate = (raw) => {
    const definition = definitions.get(raw.itemId);
    return { ...definition, ...raw, effectiveStats: resolver.resolve({ definition, instanceState: raw }) };
  };

  // The quality a worn item works with (owner Q15); a new item is untouched.
  const rod = ITEM_DB.rods.rod_test_spin;
  const fresh = resolver.resolve({ definition: rod, instanceState: {} });
  assert.equal(fresh.quality, rod.gameplayStats.quality, "condition 100: the authored quality");
  assert.equal(fresh.baseQuality, undefined, "condition 100: no worn quality");
  const half = resolver.resolve({ definition: rod, instanceState: { statOverrides: { durability: 50 } } });
  assert.equal(half.baseQuality, rod.gameplayStats.quality);
  assert.equal(half.quality, 1 + (rod.gameplayStats.quality - 1) * 0.5, "condition 50: the quality halfway to 1");
  assert.equal(wornQuality(9, 0), 1, "condition 0: quality 1");
  assert.equal(rod.gameplayStats.radiationImmunity, 0.5, "rods are half immune (owner Q17)");
  assert.equal(ITEM_DB.reels.reel_test.gameplayStats.radiationImmunity, 0.5, "reels are half immune");
  assert.equal(ITEM_DB.gasMasks.gas_mask_basic.gameplayStats.durability, 100, "the gas mask has a condition (Q16)");

  // The range by quality and the loss.
  const policy = new ItemRadiationWearPolicy();
  assert.deepEqual(policy.range(1, settings), [80, 100]);
  assert.deepEqual(policy.range(10, settings), [20, 40]);
  assert.deepEqual(policy.range(5.5, settings), [50, 70], "linear between");
  assert.equal(policy.loss({ quality: 1, roll: 1, exposure: 1 }, settings), 100);
  assert.equal(policy.loss({ quality: 10, roll: 0, exposure: 0.5 }, settings), 10, "half an emission — half");
  assert.equal(policy.loss({ quality: 1, roll: 0, exposure: 1, immunity: 0.5 }, settings), 40, "immunity 0.5 halves");
  assert.equal(policy.loss({ quality: 1, roll: 0, exposure: 1 }, { ...settings, wearScale: 2 }), 160, "wearScale");

  // The location's mean full emission dose: duration × (peak + (1 − peak) / 2) × strength × (emissionPeak − base).
  const weather = MAP_DB.test.weather;
  const mean = (range) => (range[0] + range[1]) / 2;
  const peak = mean(weather.emission.peakShare);
  const dose = meanFullEmissionDoseSec(weather);
  assert.ok(Math.abs(dose - mean(weather.emission.durationSec) * (peak + (1 - peak) / 2) * mean(weather.emission.peakStrength) *
    (weather.radiation.emissionPeak - weather.radiation.base)) < 1e-9, `the mean dose (${dose} s)`);
  assert.equal(meanFullEmissionDoseSec({ emission: weather.emission, radiation: { base: 1, emissionPeak: 1 } }), Infinity,
    "an emission that adds no radiation wears nothing");

  // A real inventory: rod (6, immune 0.5), line (5), hook (1), gas mask (5), bread (no condition).
  const at = InventoryItemLocation.inventory();
  const world = (seed) => {
    const repository = new FlatInventoryItemRepository({ items: [
      { instanceId: "rod", itemId: "rod_test_spin", quantity: 1, location: at },
      { instanceId: "line", itemId: "line_test_1", quantity: 1, location: at },
      { instanceId: "hook", itemId: "hook_basic", quantity: 1, location: at },
      { instanceId: "mask", itemId: "gas_mask_basic", quantity: 1, location: at },
      { instanceId: "bread", itemId: "bread", quantity: 1, location: at },
    ] });
    const service = new ApplyItemWearService({ repository, hydrator: { hydrate } });
    let writes = 0;
    const inventory = { applyRadiationWear: (exposure, rollFor, wear) => { writes += 1; return service.apply(exposure, rollFor, wear); } };
    const exposure = new EmissionWearExposure({ inventory, getWeather: () => weather, getSettings: () => settings,
      rng: new SeededRng(`${seed}:wear`) });
    const condition = (id) => hydrate(repository.get(id)).effectiveStats.durability ?? null;
    const frames = (seconds, radiation) => { for (let index = 0; index < seconds; index += 1) exposure.update(1000, radiation); };
    return { repository, exposure, condition, frames, get writes() { return writes; } };
  };

  const calm = world(7);
  calm.frames(600, 0);
  assert.equal(calm.writes, 0, "no radiation: nothing is written");
  assert.equal(calm.condition("hook"), 100);

  // One average full emission's dose (radiation 1 for `dose` seconds), then the radiation ends and the rest is written.
  const run = world(7);
  run.frames(Math.round(dose / 2), 1);
  const halfway = { hook: run.condition("hook"), line: run.condition("line") };
  run.frames(Math.round(dose) - Math.round(dose / 2), 1);
  run.frames(10, 0);
  assert.ok(run.writes >= Math.floor(dose / settings.applyEverySec) && run.writes <= Math.ceil(dose / settings.applyEverySec) + 2,
    `written once every ${settings.applyEverySec} s (${run.writes} writes)`);
  const lost = (id) => 100 - run.condition(id);
  const within = (value, [min, max], message) => assert.ok(value >= min - 0.5 && value <= max + 0.5, `${message}: ${value}`);
  within(lost("hook"), [80, 100], "quality 1 loses 80–100 in one emission");
  within(lost("line"), policy.range(5, settings), "quality 5 loses its range");
  within(lost("mask"), policy.range(5, settings), "the gas mask wears like any quality 5 item");
  const rodRange = policy.range(rod.gameplayStats.quality, settings);
  within(lost("rod"), [rodRange[0] / 2, rodRange[1] / 2], "the rod's immunity halves its loss");
  assert.equal(run.condition("bread"), null, "an item without a condition does not wear");
  assert.ok(Math.abs((100 - halfway.hook) - lost("hook") / 2) < 3, "the wear is gradual: half the dose — about half");
  assert.ok(halfway.line < 100 && halfway.line > run.condition("line"));

  // The same seed — the same conditions; a later emission rolls anew.
  const again = world(7);
  again.frames(Math.round(dose), 1);
  again.frames(10, 0);
  assert.equal(again.condition("hook"), run.condition("hook"), "the session seed repeats the wear");
  const first = 100 - again.condition("line");
  const before = again.condition("line");
  again.frames(Math.round(dose), 1);
  again.frames(10, 0);
  assert.notEqual(before - again.condition("line"), first, "a new emission — a new roll");

  // Never below 0; condition 0 is broken.
  again.frames(Math.round(dose) * 3, 1);
  again.frames(10, 0);
  assert.equal(again.condition("hook"), 0, "the condition stops at 0");
  const brokenHook = hydrate(again.repository.get("hook"));
  assert.ok(isItemBroken(brokenHook), "condition 0 — broken");
  assert.equal(brokenHook.effectiveStats.quality, 1, "a broken item works at quality 1");
  assert.ok(!isItemBroken(hydrate(again.repository.get("bread"))), "an item without a condition never breaks");

  // A broken item in the cast's tackle forbids the cast (owner Q15).
  const items = {
    rod: hydrate({ instanceId: "rod", itemId: "rod_test_float", quantity: 1 }),
    line: hydrate({ instanceId: "line", itemId: "line_test_1", quantity: 1 }),
    tackle: hydrate({ instanceId: "tackle", itemId: "hook_basic", quantity: 1 }),
    hook: hydrate({ instanceId: "hook", itemId: "hook_basic", quantity: 1 }),
  };
  const readiness = new FishingReadinessPolicy({ itemReader: (id) => items[id] ?? null,
    assemblyReader: { getChild: () => null, listDescendants: (id) => (id === "tackle" ? [items.hook] : []) },
    capabilityResolver: { resolve: () => ({ supportsReel: false }) }, messages: { brokenTackle: "broken" } });
  const state = { rootInstanceIds: { rod: "rod", terminalLine: "line", tackle: "tackle" } };
  assert.equal(readiness.evaluateCast({ equipmentState: state }).canCast, true, "whole tackle casts");
  items.hook = hydrate({ instanceId: "hook", itemId: "hook_basic", quantity: 1, statOverrides: { durability: 0 } });
  const refused = readiness.evaluateCast({ equipmentState: state });
  assert.equal(refused.canCast, false, "a broken hook in the rig forbids the cast");
  assert.equal(refused.warningCode, "broken-tackle");
  assert.equal(refused.warning, "broken");
  items.hook = hydrate({ instanceId: "hook", itemId: "hook_basic", quantity: 1, statOverrides: { durability: 1 } });
  items.rod = hydrate({ instanceId: "rod", itemId: "rod_test_float", quantity: 1, statOverrides: { durability: 0 } });
  assert.equal(readiness.evaluateCast({ equipmentState: state }).warningCode, "broken-tackle", "a broken rod too");

  // A broken gas mask does not protect: no status, the cast stays blocked during an emission.
  const mask = (durability) => hydrate({ instanceId: "mask", itemId: "gas_mask_basic", quantity: 1,
    statOverrides: { durability } });
  const held = [];
  const statuses = { hold: (id, on) => held.push([id, on]), modifier: () => 1, has: () => false };
  let equipped = { gasMask: mask(30) };
  const source = new EquipmentStatusSource({ inventory: { getEquipped: () => equipped }, statuses, slots: { gasMask: "gasMask" } });
  assert.deepEqual(held.at(-1), ["gasMask", true], "a worn gas mask still protects");
  equipped = { gasMask: mask(0) };
  source.sync();
  assert.deepEqual(held.at(-1), ["gasMask", false], "a broken gas mask holds no status");
  const exposure = new EmissionExposure({ getEnvironment: () => ({ emission: { phase: "peak", intensity: 1 } }),
    getEquipped: () => equipped, statuses });
  assert.equal(exposure.hasGasMask(), false, "a broken gas mask is no gas mask");
  equipped = { gasMask: mask(1) };
  assert.equal(exposure.hasGasMask(), true);

  console.log("Emission wear passed: worn quality, ranges by quality and immunity, the location's mean dose; one " +
    "emission takes each item's range gradually, written every few seconds, seeded, rolled anew, never below 0; " +
    "broken tackle forbids the cast, a broken gas mask does not protect.");
};
