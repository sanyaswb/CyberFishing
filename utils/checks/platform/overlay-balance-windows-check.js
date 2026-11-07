"use strict";

// Spec 168 (TK-254): the overlay windows ACTIVE FISH / ACTIVE ROD. Slider limits; the fish form on the real FISH_DB (the
// hooked fish in the fight, «Записати у вид», the Fixed Catch species outside it); the rod form on the real ITEM_DB and
// the fight's rod rules; the panel builds once per form and later only writes values, never over the control being
// dragged; the windows ask for live data only while on; the tool window shell.
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { TestDocument } = require("../../testing/keepnet/test_document.js");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT_DIR, file)).href);
const rowsOf = (form) => {
  const rows = [];
  const collect = (section) => { rows.push(...section.rows); section.sections.forEach(collect); };
  form.sections.forEach(collect);
  return rows;
};
const rowAt = (form, dotted) => rowsOf(form).find((row) => row.path.join(".") === dotted);

async function checkSchema(schema) {
  assert.deepEqual({ ...schema.limitsFor("forceMultiplier", 1.2) }, { min: 0, max: 5, step: 0.05 });
  assert.equal(schema.limitsFor("forceMultiplier", 7.3).max, 8, "a value above the known limit widens the slider");
  assert.deepEqual({ ...schema.limitsFor("dirChangeMinMs", 500) }, { min: 0, max: 10000, step: 50 }, "durations by suffix");
  assert.deepEqual({ ...schema.limitsFor("radialRange", -0.3) }, { min: -1, max: 1, step: 0.05 }, "direction ranges");
  assert.deepEqual({ ...schema.limitsFor("unknownGain", 3) }, { min: 0, max: 6, step: 0.05 }, "unknown keys reach twice the value");
  assert.equal(schema.limitsFor("unknownOffset", -4).min, -8, "a negative unknown value gets a symmetric slider");
  assert.equal(schema.weightLimits(0.8).max, 2, "the fish weight slider reaches twice the weight");
}

async function checkFishContent(schema) {
  const { ActiveFishWindowContent } = await importSource("src/dev/overlay/windows/active_fish_window_content.js");
  const { FISH_DB } = await importSource("src/game/config/databases/fish_database.js");
  const { FishPhysicsProfile } = await importSource("src/game/domain/fish/fish_physics_profile.js");
  const fishes = structuredClone(FISH_DB);
  const index = fishes.findIndex((fish) => fish.id === "crucian_stalker");
  const { CONFIG } = await importSource("src/game/config/runtime/game_config.js");
  const config = { debug: { fixedCatch: { enabled: false, fishId: "crucian_stalker" } }, stamina: structuredClone(CONFIG.stamina) };
  const edits = [];
  const content = new ActiveFishWindowContent({ config, baseConfig: structuredClone(config), fishes, schema,
    updateConfig: (editPath, value) => edits.push([editPath, value]) });

  assert.equal(content.build(null).key, "none", "without a fish and Fixed Catch the window says so");
  assert.match(content.build(null).note, /Fixed Catch/u);

  const hooked = { id: "crucian_stalker", name: "Карась", weight: 0.8, level: 3, maxLevel: 6, hasAnomaly: false,
    physics: FishPhysicsProfile.toRuntimeConfig({ ...fishes[index].physics, levelBasePower: 1.4 }) };
  const form = content.build({ hookedFish: hooked, fishState: "dash", fishActiveKg: 1.234, fishOppositionKg: 0.5 });
  const titles = form.sections.map((section) => section.title);
  assert.deepEqual(titles, ["Рівень і вага", "Сила", "Витривалість", "Рух", "Поведінка",
    "Правила витривалості (усі риби, CONFIG.stamina)"], "the fish's sections");
  // TK-254.1: every stamina value the fight reads, with its effective default when the species has none.
  const staminaRows = form.sections[2].rows.map((row) => `${row.label}=${row.value}`);
  assert.deepEqual(staminaRows, ["baseStamina=1000", "staminaRatioFromEndurance=0.1", "staminaBossMultiplier=1.5",
    "minStaminaActivityMultiplier=0.75", "exhaustedSpeedRatio=0.25"], "the stamina section has every stamina value");
  const drain = rowAt(form, "CONFIG.stamina.mechanics.drain.baseDrainPerSecond");
  assert.deepEqual([drain.value, drain.base], [100, 100], "the stamina rules of every fight are editable");
  assert.equal(rowAt(form, "CONFIG.stamina.mechanics.drain.enabled").kind, "boolean");
  const live = content.build({ hookedFish: hooked, fishConditionPhase: "stamina", currentStamina: 75, fishConditionMaxStamina: 150,
    currentExhaustion: 1500, fishConditionMaxEndurance: 1500 }).readouts.map((readout) => `${readout.label}=${readout.value}`);
  assert.ok(live.includes("стаміна=75 / 150 (50%)") && live.includes("фаза=stamina"), "stamina is read live");
  assert.deepEqual(form.sections[4].sections.map((section) => section.title), ["idle", "rest", "swim", "dash", "lastDash"],
    "one sub-section per behaviour state");
  const dash = rowAt(form, "HOOKED_FISH.physics.behaviorProfile.behaviors.dash.forceMultiplier");
  assert.deepEqual([dash.kind, dash.value, dash.base], ["number", 1.2, 1.2], "a behaviour number with its species base");
  assert.ok(rowAt(form, "HOOKED_FISH.physics.movementProfile.radialRange.0"), "range pairs are two sliders");
  assert.equal(rowAt(form, "HOOKED_FISH.hasAnomaly").kind, "boolean");
  assert.ok(!rowAt(form, "HOOKED_FISH.physics.basePower"), "runtime aliases are not shown twice");
  assert.match(form.readouts.map((readout) => `${readout.label}=${readout.value}`).join(";"), /стан=dash;сила зараз=1\.23 кг/u);
  assert.deepEqual(form.actions.map((action) => action.id), ["save"]);
  assert.equal(content.build({ hookedFish: hooked }).key, form.key, "the same fish keeps its form (values update in place)");
  assert.notEqual(content.build({ hookedFish: { ...hooked } }).key, form.key, "another hooked fish rebuilds the form");

  content.build({ hookedFish: hooked });
  content.change(["HOOKED_FISH", "physics", "behaviorProfile", "behaviors", "dash", "forceMultiplier"], 2.5);
  content.change(["HOOKED_FISH", "physics", "forceProfile", "levelBasePower"], 3);
  content.change(["HOOKED_FISH", "weight"], 1.1);
  assert.equal(edits.length, 3, "every change goes through updateConfig");
  assert.match(content.build({ hookedFish: hooked }).note, /ще не записано у вид/u);
  content.action("save");
  assert.deepEqual(edits.slice(3), [[["FISH_DB", index, "physics", "behaviorProfile", "behaviors", "dash", "forceMultiplier"], 2.5]],
    "«Записати у вид» writes the fish's physics changes into the species, not its weight or level power");
  assert.match(content.build({ hookedFish: hooked }).note, /Записано у вид: 1/u);

  config.debug.fixedCatch.enabled = true;
  const species = content.build({});
  assert.match(species.key, /^species:crucian_stalker/u, "outside the fight: the Fixed Catch species");
  const speciesRow = rowAt(species, `FISH_DB.${index}.physics.staminaProfile.baseStamina`);
  assert.deepEqual([speciesRow.value, speciesRow.base], [1000, 1000], "species rows edit FISH_DB and remember the start value");
  assert.deepEqual(species.actions, []);
}

// TK-254.1: a balance edit of the hooked fish reaches its stamina and endurance limits in the fight; the current values
// keep their share, the phase stays.
async function checkStaminaLimits() {
  const { FishCondition } = await importSource("src/game/domain/fish/fish_condition.js");
  const { FightService } = await importSource("src/game/application/fishing/fight_service.js");
  const { CONFIG } = await importSource("src/game/config/runtime/game_config.js");
  const physics = (baseStamina) => ({ staminaProfile: { baseStamina } });
  const condition = new FishCondition(3, 0.8, CONFIG.stamina.fish, physics(1000), {});
  assert.equal(condition.maxEndurance, 1000 + 800 * 3);
  assert.equal(condition.maxStamina, 340);
  condition.applyStaminaDamage(170);
  condition.updateLimits(3, 0.8, CONFIG.stamina.fish, { staminaProfile: { baseStamina: 2000, staminaRatioFromEndurance: 0.5 } }, {});
  assert.deepEqual([condition.maxStamina, condition.currentStamina, condition.phase], [2200, 1100, "stamina"],
    "new limits, the same share of stamina");

  const stamina = structuredClone(CONFIG.stamina);
  const fishCondition = new FishCondition(1, 1, stamina.fish, physics(500), {});
  const session = { fishCondition, fish: { updateRuntimeStats() {} }, tensionMeter: {}, fightPhysicsSystem: {} };
  const service = new FightService({ config: { stamina, fightPhysicsConfig: null }, rng: {}, devFlags: { isEnabled: () => false },
    fightSessionFactory: { create: () => session }, forceService: {}, catchResolver: {} });
  const fishData = { level: 1, weight: 1, physics: physics(500) };
  service.startFight(fishData, {});
  assert.equal(fishCondition.maxEndurance, 1500);
  fishData.physics = physics(2500);
  service.syncFishRuntime(fishData);
  assert.equal(fishCondition.maxEndurance, 3500, "a stamina edit of the hooked fish changes its endurance in the fight");
  stamina.fish.staminaRatioFromEndurance = 0.2;
  service.refreshStaminaLimits();
  assert.equal(fishCondition.maxStamina, 700, "an edit of CONFIG.stamina.fish reaches the fish being fought");
}

async function checkRodContent(schema) {
  const { ActiveRodWindowContent } = await importSource("src/dev/overlay/windows/active_rod_window_content.js");
  const { ITEM_DB } = await importSource("src/game/config/raw/items/item_database.js");
  const { FIGHT_PHYSICS_CONFIG } = await importSource("src/game/config/raw/physics/fight_physics.js");
  const items = structuredClone({ rods: ITEM_DB.rods });
  const config = { physics: { fight: structuredClone(FIGHT_PHYSICS_CONFIG) } };
  const edits = [];
  const content = new ActiveRodWindowContent({ config, baseConfig: structuredClone(config), items, schema,
    updateConfig: (editPath, value) => edits.push([editPath, value]) });
  const empty = content.build({ eq: {} });
  assert.deepEqual(empty.sections.map((section) => section.id), ["rod.rodHold", "rod.rodStroke", "rod.rodControl"],
    "without a rod the fight's rod rules stay editable");
  const form = content.build({ eq: { rod: { itemId: "rod_test_spin", effectiveStats: { maxLoadKg: 0.9, holdTensionRatio: 1 } } } });
  assert.equal(form.sections[0].title, "Вудилище: Тестовий Спінінг");
  const load = rowAt(form, "ITEM_DB.rods.rod_test_spin.gameplayStats.maxLoadKg");
  assert.deepEqual([load.value, load.base, load.limits.max], [1, 1, 50], "the rod item's stats with their start values");
  assert.ok(!rowAt(form, "ITEM_DB.rods.rod_test_spin.gameplayStats.durability"), "the item's condition is not a balance value");
  assert.ok(rowsOf(form).some((row) => row.path.slice(0, 4).join(".") === "CONFIG.physics.fight.rodControl"),
    "the rod control rules are in the window");
  assert.match(form.readouts[1].value, /0\.9 кг/u, "the rod's effective load is read live");
  content.change(["ITEM_DB", "rods", "rod_test_spin", "gameplayStats", "maxLoadKg"], 2);
  assert.deepEqual(edits, [[["ITEM_DB", "rods", "rod_test_spin", "gameplayStats", "maxLoadKg"], 2]]);
}

async function checkPanel() {
  const { BalanceControlPanel } = await importSource("src/dev/overlay/windows/balance_control_panel.js");
  const document = new TestDocument();
  const changes = [];
  const actions = [];
  const opened = {};
  const panel = new BalanceControlPanel({ documentTarget: document, onChange: (editPath, value) => changes.push([editPath.join("."), value]),
    onAction: (id) => actions.push(id), sectionState: { isOpen: (id) => opened[id] === true, setOpen: (id, open) => { opened[id] = open; } } });
  const form = (value, key = "k1") => ({ key, readouts: [{ label: "стан", value: value > 1 ? "dash" : "idle" }], note: "n", actions: [{ id: "save", label: "S" }],
    sections: [{ id: "a", title: "A", sections: [], rows: [
      { path: ["X", "power"], label: "power", kind: "number", value, base: 1, limits: { min: 0, max: 5, step: 0.05 } },
      { path: ["X", "on"], label: "on", kind: "boolean", value: true }] }] });
  const host = document.createElement("div");
  panel.render(form(1), host);
  const slider = findClass(host, "debug-overlay__slider");
  const number = findClass(host, "debug-overlay__number");
  const toggle = findClass(host, "debug-overlay__switch");
  assert.equal(slider.type, "range");
  assert.deepEqual([slider.getAttribute("min"), slider.getAttribute("max"), slider.getAttribute("step"), slider.value], ["0", "5", "0.05", "1"]);
  slider.value = "2.5";
  slider.fire("input");
  assert.deepEqual(changes, [["X.power", 2.5]], "moving the slider changes the value");
  assert.equal(number.value, "2.5", "the number field follows the slider");
  number.value = "7";
  number.fire("change");
  assert.deepEqual(changes.at(-1), ["X.power", 7], "the number field takes values beyond the slider");
  findClass(host, "debug-overlay__reset").fire("click");
  assert.deepEqual(changes.at(-1), ["X.power", 1], "↺ returns the base value");
  toggle.checked = false;
  toggle.fire("change");
  assert.deepEqual(changes.at(-1), ["X.on", false]);
  findClass(host, "debug-overlay__tab").fire("click");
  assert.deepEqual(actions, ["save"]);

  panel.render(form(3), host);
  assert.equal(findClass(host, "debug-overlay__slider"), slider, "the same form key keeps the DOM");
  assert.equal(slider.value, "3", "and writes the new value");
  assert.equal(findClass(host, "debug-overlay__value").textContent, "dash", "read-only lines update in place");
  slider.fire("pointerdown");
  panel.render(form(4), host);
  assert.equal(slider.value, "3", "a slider being dragged is not overwritten");
  slider.fire("pointerup");
  panel.render(form(4), host);
  assert.equal(slider.value, "4");
  const details = findClass(host, "debug-overlay__details");
  details.open = true;
  details.fire("toggle");
  assert.deepEqual(opened, { a: true }, "a section's open state is remembered");
  panel.render(form(4, "k2"), host);
  assert.notEqual(findClass(host, "debug-overlay__slider"), slider, "another form key rebuilds");
  assert.equal(findClass(host, "debug-overlay__details").open, true, "a rebuilt section reopens as remembered");
  panel.dispose();
  assert.equal(host.children.length, 0);
}

function findClass(root, name) {
  if (String(root.className).split(" ").includes(name)) return root;
  for (const child of root.children) {
    const found = findClass(child, name);
    if (found) return found;
  }
  return null;
}

async function checkWindows() {
  const { FightBalanceWindows } = await importSource("src/dev/overlay/windows/fight_balance_windows.js");
  const { OverlayToolWindow } = await importSource("src/dev/overlay/windows/overlay_tool_window.js");
  const document = new TestDocument();
  const enabled = { activeFish: false, activeRod: false };
  const timers = [];
  const createUpdateLoop = (callback) => { const loop = { callback, started: 0, stopped: 0, start() { this.started++; },
    stop() { this.stopped++; } }; timers.push(loop); return loop; };
  const stored = {};
  const cache = { get: (key) => stored[key] ?? null, set: (key, value) => { stored[key] = structuredClone(value); } };
  const drags = [];
  const toolWindow = (id, modifier) => new OverlayToolWindow({ documentTarget: document, mountNode: document.body, title: id, modifier,
    createScaleControls: () => ({ create: () => document.createElement("div") }),
    createDragController: (element) => { const drag = { element, attached: 0, detached: 0, attach() { this.attached++; },
      detach() { this.detached++; }, clampToViewport() {} }; drags.push(drag); return drag; } });
  const seen = [];
  const content = (name) => ({ build: (data) => { seen.push([name, data]); return { key: name, readouts: [], note: "", actions: [], sections: [] }; },
    change() {}, action() {} });
  const fishWindow = toolWindow("fish", "debug-overlay--active-fish");
  const windows = new FightBalanceWindows({ documentTarget: document, createUpdateLoop, settingsStore: { isEnabled: (key) => enabled[key] },
    cache, windows: [{ key: "activeFish", window: fishWindow, content: content("fish") },
      { key: "activeRod", window: toolWindow("rod", "debug-overlay--active-rod"), content: content("rod") }] });
  windows.start();
  assert.equal(timers[0].started, 1, "the windows refresh on the overlay's update loop");
  assert.equal(windows.isLiveDataRequested(), false, "switched off: no live data asked for");
  assert.equal(drags.length, 0, "a window is created only when first shown");
  enabled.activeFish = true;
  assert.equal(windows.isLiveDataRequested(), true, "a window on asks for the live data (R17)");
  document.fire("debug-live-update", { detail: { hookedFish: { id: "f" } } });
  timers[0].callback();
  assert.deepEqual(seen, [["fish", { hookedFish: { id: "f" } }]], "only the window that is on reads the live data");
  assert.equal(fishWindow.visible, true);
  const container = document.byClass("debug-overlay--active-fish")[0];
  assert.equal(container.className, "debug-overlay debug-overlay--tool debug-overlay--active-fish");
  assert.equal(drags[0].attached, 1, "the window drags like the overlay window");
  enabled.activeFish = false;
  timers[0].callback();
  assert.equal(fishWindow.visible, false, "switching off hides the window");
  windows.dispose();
  assert.equal(timers[0].stopped, 1, "dispose stops the update loop");
  assert.equal(document.listeners.get("debug-live-update")?.size ?? 0, 0, "dispose removes the live data listener");
  assert.equal(drags[0].detached, 1);
  assert.equal(document.byClass("debug-overlay--active-fish").length, 0, "dispose removes the window");
}

(async () => {
  const { FightBalanceParameterSchema } = await importSource("src/dev/overlay/windows/fight_balance_parameter_schema.js");
  const schema = new FightBalanceParameterSchema();
  await checkSchema(schema);
  await checkFishContent(schema);
  await checkStaminaLimits();
  await checkRodContent(schema);
  await checkPanel();
  await checkWindows();
  console.log("Overlay balance windows passed: slider limits, fish form (hooked fish, save to species, Fixed Catch species), "
    + "rod form (item stats, fight rod rules), panel (built once, values in place, dragged slider kept, sections remembered), "
    + "live data only while a window is on, window shell and disposal.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
