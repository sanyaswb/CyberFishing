"use strict";
const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime.js");
const { TestDocument } = require("./testing/keepnet/test_document.js");
const { composeGameTime } = require("../src/bootstrap/production/game_time_composition.js");
const { composeDevTimeDisplay } = require("../src/bootstrap/development/dev_time_composition.js");
const { TimeDisplay } = require("../src/platform/browser/ui/time_display.js");
const { EnvironmentSystem } = require("../src/game/application/world/environment_system.js");
const { backgroundTimeBlend } = require("../src/game/domain/time/background_time_blend.js");

const values = new Map();
let writes = 0, now = 1000000;
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { writes++; values.set(key, value); } };
const clock = composeGameTime({ storage, now: () => now, initialHours: 12, timeScale: 240 });
const config = { debug: { timeScale: 240, timeAccelerationEnabled: false } };
const documentRef = new TestDocument();
const mount = documentRef.createElement("div");
const root = documentRef.createElement("div"); root.append(mount); documentRef.body.append(root);
const control = composeDevTimeDisplay({ documentRef, mount, clock, config, uiSurface: { mountRoot: mount } });
const button = documentRef.byClass("time-display")[0];
assert.equal(button.tagName, "button");
assert.equal(button.disabled, true);
button.click(); assert.equal(clock.getRateMultiplier(), 1, "disabled acceleration cannot change the calendar rate");
config.debug.timeAccelerationEnabled = true;
control.update(clock.getHours());
assert.equal(button.disabled, false);
let expected = 12;
for (const multiplier of [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 1]) {
  expected = (expected + clock.getRateMultiplier()) % 24;
  now += 15000;
  assert.equal(clock.getHours(), expected);
  button.click();
  assert.equal(clock.getRateMultiplier(), multiplier);
  assert.equal(clock.getHours(), expected, "rate changes settle elapsed time without a jump");
  const prefix = documentRef.byClass("time-display__speed")[0];
  assert.equal(prefix.hidden, multiplier === 1);
  assert.equal(prefix.textContent, multiplier === 1 ? "" : `⏩ ×${multiplier}`);
  assert.equal(root.classList.contains("ui-surface--time-accelerated"), multiplier > 1);
  assert.equal(JSON.parse(values.get("cyber_fishing_game_time_v1")).timeScale, 240, "DEV factors never become the persisted base rate");
}

const env = new EnvironmentSystem({ weather: { chances: { rain: 0, fog: 0 }, updateIntervalMs: 1000 }, environment: {} },
  12, { chance: () => false }, { timePhases: { day: { startHour: 9, endHour: 21 }, night: { startHour: 21, endHour: 9 } } }, clock);
button.click(); button.click(); // ×2
now += 15000;
env.update(16, 240);
let hours = clock.getHours();
assert.equal(env.getSnapshot().time, hours, "day/night uses the same accelerated clock as the display");
assert.equal(env.getSnapshot().phase, hours >= 21 || hours < 9 ? "night" : "day");
const blend = backgroundTimeBlend(hours, { evening: 0, night: 0 });
assert(blend.night >= 0 && blend.night <= 1);
now += 30000; env.update(16, 240);
assert.equal(env.getSnapshot().time, 21); assert.equal(env.getSnapshot().phase, "night");
assert.equal(backgroundTimeBlend(clock.getHours(), blend).night, 1);
now += 90000; env.update(16, 240);
assert.equal(env.getSnapshot().time, 9); assert.equal(env.getSnapshot().phase, "day");
assert.equal(backgroundTimeBlend(clock.getHours(), blend).night, 0);
hours = clock.getHours();
control.update(hours);
let classWrites = 0, attributeWrites = 0;
const toggle = button.classList.toggle, setAttribute = button.setAttribute.bind(button);
button.classList.toggle = (...args) => { classWrites++; return toggle(...args); };
button.setAttribute = (...args) => { attributeWrites++; return setAttribute(...args); };
const priorWrites = writes;
for (let frame = 0; frame < 120; frame++) control.update(hours);
assert.equal(writes, priorWrites); assert.equal(classWrites, 0); assert.equal(attributeWrites, 0);
config.debug.timeAccelerationEnabled = false;
control.update(clock.getHours());
assert.equal(clock.getRateMultiplier(), 1);
assert.equal(button.disabled, true);
assert.equal(clock.getHours(), hours, "disabling keeps reached time");
now += 15000; assert.equal(clock.getHours(), (hours + 1) % 24);

config.debug.timeAccelerationEnabled = true;
control.update(clock.getHours()); button.click(); button.click();
const handoff = control.suspend();
assert.equal(handoff.multiplier, 2); assert.equal(clock.getRateMultiplier(), 1);
const houseClock = composeGameTime({ storage, now: () => now, initialHours: 3, timeScale: 240 });
const houseDocument = new TestDocument();
const houseConfig = { debug: { timeScale: 240, timeAccelerationEnabled: handoff.enabled } };
const houseControl = composeDevTimeDisplay({ documentRef: houseDocument, mount: houseDocument.body, clock: houseClock, config: houseConfig });
houseControl.resume(handoff);
assert.equal(houseClock.getHours(), clock.getHours());
assert.equal(houseClock.getRateMultiplier(), 2);
houseDocument.byClass("time-display")[0].click();
now += 15000;
const reachedHouseHours = houseClock.getHours();
const returned = houseControl.suspend();
control.resume(returned);
assert.equal(clock.getHours(), reachedHouseHours, "return synchronizes House progress before resuming the location");
assert.equal(clock.getRateMultiplier(), 2.5);
const productionClock = composeGameTime({ storage, now: () => now, initialHours: 12, timeScale: 240 });
const passive = new TimeDisplay({ documentRef: new TestDocument() });
assert.equal(passive.container.tagName, "div");
assert.equal(productionClock.getRateMultiplier(), 1, "production never inherits the DEV multiplier");
const productionHours = productionClock.getHours();
now += 15000;
assert.equal(productionClock.getHours(), (productionHours + 1) % 24);
const savedBeforeInactiveDispose = writes;
houseControl.dispose();
assert.equal(writes, savedBeforeInactiveDispose, "a returned House must not overwrite the active location clock during cleanup");
const currentHours = clock.getHours();
control.dispose(); control.dispose(); passive.dispose();
assert.equal(JSON.parse(values.get("cyber_fishing_game_time_v1")).anchorHours, currentHours);
const beforeDisposedClick = clock.getRateMultiplier(); button.click();
assert.equal(clock.getRateMultiplier(), beforeDisposedClick, "disposed click handler cannot change time");
assert.equal(JSON.parse(values.get("cyber_fishing_game_time_v1")).version, 1);
async function checkHouseToolsComposition() {
  const doc = new TestDocument();
  const shell = new TestDocument();
  shell.body.append(shell.createElement("header"), shell.createElement("main"), shell.createElement("SCRIPT"));
  shell.title = "House fixture";
  const cloned = [];
  doc.importNode = node => { cloned.push(node.tagName); return doc.createElement(node.tagName); };
  doc.readyState = "complete";
  const listeners = new Map(), messages = [];
  let fetchSignal;
  const windowTarget = {
    location: { search: "?page=house&returnTo=dev.html&embedded=1", origin: "https://game.example" },
    parent: { location: { origin: "https://game.example" }, postMessage: (data, origin) => messages.push({ data, origin }) },
    URLSearchParams, AbortController,
    DOMParser: class { parseFromString() { return shell; } },
    fetch: async (url, options) => { assert.equal(url, "fisherman-house.html"); fetchSignal = options.signal; return { ok: true, text: async () => "house shell" }; },
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
  };
  const houseConfig = { debug: { timeScale: 240, timeAccelerationEnabled: false }, rarity: {}, locations: { map: {} } };
  let houseOptions, toolsOptions, houseDisposals = 0, resumed;
  const fakeControl = { resume: snapshot => { resumed = snapshot; }, suspend: () => ({ enabled: true, multiplier: 3, timeScale: 240 }) };
  const uiSurface = { mountRoot: { parentNode: root }, portalRoot: doc.body };
  const source = new SourceRuntime({ moduleStubs: {
    "src/platform/browser/runtime/browser_startup_environment.js": { getBrowserStartupEnvironment: () => ({ documentTarget: doc, windowTarget }) },
    "src/game/config/runtime/game_config.js": { CONFIG: houseConfig },
    "src/bootstrap/production/game_config_composition.js": { createProductionConfigContext: () => ({
      set(path, value) { houseConfig.debug[path.split(".").at(-1)] = value; },
    }) },
    "src/bootstrap/production/house_startup.js": { startFishermanHouse: options => {
      houseOptions = options;
      options.createTimeDisplay({ documentRef: doc, mount: doc.body, clock: {}, uiSurface });
      options.createDevTools({ uiSurface, returnToGame() {} });
      return { dispose() { houseDisposals++; } };
    } },
    "src/bootstrap/development/dev_time_composition.js": { composeDevTimeDisplay: () => fakeControl },
    "src/dev/tools/dev_tools.js": { DevTools: class { constructor(config, sync, options) {
      assert.equal(config, houseConfig); assert.equal(typeof sync.synchronize, "function"); toolsOptions = options;
    } } },
  } });
  const { startDevelopmentHouse } = source.importModule("src/bootstrap/development/development_house_startup.js");
  const house = await startDevelopmentHouse();
  assert.deepEqual(cloned, ["header", "main"], "DEV reuses production House markup without running its entry script");
  assert.equal(doc.body.className, "house house--dev");
  assert.equal(typeof toolsOptions.openGame, "function");
  assert.equal(typeof toolsOptions.openUiCatalog, "function");
  assert.equal(typeof toolsOptions.configValidation.report, "function", "House DevTools validate edits like the location page");
  assert(toolsOptions.catalogs.items.builds.debug_float_build, "House DevTools use the DEV item catalog");
  assert.equal(messages[0].data.type, "cyber-fishing:dev-house-ready");
  assert.equal(messages[0].origin, windowTarget.location.origin);
  houseOptions.onPreviewData({ debugTime: { enabled: true, multiplier: 2.5, timeScale: 480 } });
  assert.equal(houseConfig.debug.timeAccelerationEnabled, true);
  assert.equal(houseConfig.debug.timeScale, 480);
  assert.equal(resumed.multiplier, 2.5);
  assert.equal(houseOptions.onReturnData().debugTime.multiplier, 3);
  toolsOptions.openUiCatalog(); toolsOptions.openUiCatalog();
  assert.equal(doc.byClass("embedded-page-overlay").length, 1);
  house.dispose(); house.dispose();
  assert.equal(houseDisposals, 1);
  assert.equal(fetchSignal.aborted, true);
  assert.equal(doc.byClass("embedded-page-overlay").length, 0);
  assert.equal([...listeners.values()].reduce((count, entries) => count + entries.size, 0), 0);
  let finishFetch;
  windowTarget.fetch = () => new Promise(resolve => { finishFetch = resolve; });
  const pending = startDevelopmentHouse();
  for (const disposePending of [...listeners.get("pagehide")]) disposePending();
  finishFetch({ ok: true, text: async () => "house shell" });
  await pending;
  assert.equal(cloned.length, 2, "pagehide during template loading must not mount late House controls");
  assert.equal(houseDisposals, 1);
  assert.equal([...listeners.values()].reduce((count, entries) => count + entries.size, 0), 0);

  const uiDocument = new TestDocument();
  const runtime = new SourceRuntime({ globals: { document: uiDocument } });
  const { DevToolsUI } = runtime.importModule("src/dev/tools/dev_tools_ui.js");
  const ui = Object.create(DevToolsUI.prototype);
  let opened = 0;
  ui.createNavigation([["Catalog", () => opened++]], uiDocument.body);
  const row = uiDocument.byClass("devtools__row--navigation")[0];
  const navigationButton = row.children[0];
  assert.equal(navigationButton.type, "button"); navigationButton.click(); assert.equal(opened, 1);
}

checkHouseToolsComposition().then(() => console.log("DEV time passed: 1.5..5/reset, disabled/production isolation, continuous hours/phase, normal saved rate, House handoff/tools/template lifecycle, compact navigation, tablet/orientation and bounded work."))
  .catch(error => { console.error(error); process.exitCode = 1; });
