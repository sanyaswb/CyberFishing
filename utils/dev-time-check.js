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
assert.equal(button.disabled, false, "phase switching remains available without DEV acceleration");
control.advance(); assert.equal(clock.getRateMultiplier(), 1, "disabled acceleration cannot change the calendar rate");
config.debug.timeAccelerationEnabled = true;
control.update(clock.getHours());
assert.equal(button.disabled, false);
let expected = 12;
for (const multiplier of [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 1]) {
  expected = (expected + clock.getRateMultiplier()) % 24;
  now += 15000;
  assert.equal(clock.getHours(), expected);
  control.advance();
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
control.advance(); control.advance(); // ×2; click recognition has separate deterministic coverage.
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
assert.equal(button.disabled, false, "the phase command remains interactive");
assert.equal(clock.getHours(), hours, "disabling keeps reached time");
now += 15000; assert.equal(clock.getHours(), (hours + 1) % 24);

config.debug.timeAccelerationEnabled = true;
control.update(clock.getHours()); control.advance(); control.advance();
const handoff = control.suspend();
assert.equal(handoff.multiplier, 2); assert.equal(clock.getRateMultiplier(), 1);
const houseClock = composeGameTime({ storage, now: () => now, initialHours: 3, timeScale: 240 });
const houseDocument = new TestDocument();
const houseConfig = { debug: { timeScale: 240, timeAccelerationEnabled: handoff.enabled } };
const houseControl = composeDevTimeDisplay({ documentRef: houseDocument, mount: houseDocument.body, clock: houseClock, config: houseConfig });
houseControl.resume(handoff);
assert.equal(houseClock.getHours(), clock.getHours());
assert.equal(houseClock.getRateMultiplier(), 2);
houseControl.advance();
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
  // Spec 084: the House is a screen of the DEV page; the clock rate moves between time controls in memory.
  const doc = new TestDocument();
  const houseConfig = { debug: { timeScale: 240, timeAccelerationEnabled: true } };
  const calls = [];
  const control = (name, snapshot) => ({ resume: (value) => calls.push([`${name}.resume`, value?.multiplier ?? null]),
    suspend: () => { calls.push([`${name}.suspend`]); return snapshot; } });
  const gameControl = control("game", { enabled: true, multiplier: 2.5, timeScale: 240 });
  const houseControl = control("house", { enabled: true, multiplier: 4, timeScale: 240 });
  const services = { liveBait: { id: "session live bait" }, gameTime: { id: "session clock" } };
  let houseOptions, houseDisposals = 0, toggleMounts = 0;
  const source = new SourceRuntime({ moduleStubs: {
    "src/bootstrap/development/dev_time_composition.js": { composeDevTimeDisplay: (options) => {
      assert.equal(options.config, houseConfig); assert.equal(options.clock, services.gameTime); return houseControl; } },
  } });
  const { createDevHouseScreenFactory } = source.importModule("src/bootstrap/development/dev_house_screen_composition.js");
  const devTools = { mountScreenToggle: () => { toggleMounts++; return () => {}; } };
  const factory = createDevHouseScreenFactory({ documentTarget: doc, windowTarget: {}, uiSurface: {}, config: houseConfig,
    getSessionServices: () => services, getGameTimeControl: () => gameControl, getDevTools: () => devTools,
    loadHouseScreen: async () => ({ composeHouseScreen: (options) => {
      houseOptions = options;
      options.createTimeDisplay({ documentRef: doc, mount: doc.body, clock: options.gameTime });
      return { dispose: () => { houseDisposals++; } };
    } }) });
  let closes = 0;
  const screen = await factory({ close: () => { closes++; } });
  assert.equal(houseOptions.liveBait, services.liveBait, "the House screen reuses the session live bait");
  assert.equal(houseOptions.gameTime, services.gameTime, "the House screen reuses the session clock");
  houseOptions.onExit(); assert.equal(closes, 1, "the House return closes the screen");
  assert.equal(typeof houseOptions.mountHeaderControl(doc.body), "function"); assert.equal(toggleMounts, 1,
    "the House header gets a DevTools toggle");
  assert.deepEqual(calls, [["game.suspend"], ["house.resume", 2.5]], "the game's rate moves to the House clock control");
  calls.length = 0;
  screen.dispose();
  assert.deepEqual(calls, [["house.suspend"], ["game.resume", 4]], "closing returns the House rate to the game");
  assert.equal(houseDisposals, 1);
  const withoutTools = createDevHouseScreenFactory({ documentTarget: doc, windowTarget: {}, uiSurface: {}, config: houseConfig,
    getSessionServices: () => services, getGameTimeControl: () => null, getDevTools: () => null,
    loadHouseScreen: async () => ({ composeHouseScreen: (options) => { houseOptions = options; return { dispose() {} }; } }) });
  (await withoutTools({ close() {} })).dispose();
  assert.equal(houseOptions.mountHeaderControl(doc.body), null, "no DevTools, no header toggle");

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

checkHouseToolsComposition().then(() => console.log("DEV time passed: 1.5..5/reset, disabled/production isolation, continuous hours/phase, normal saved rate, House screen rate transfer/tools, compact navigation, tablet/orientation and bounded work."))
  .catch(error => { console.error(error); process.exitCode = 1; });
