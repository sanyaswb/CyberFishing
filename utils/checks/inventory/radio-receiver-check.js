"use strict";

// Spec 142: the field radio receiver. Stage 1: a catalog item worn in its own auxiliary slot ("radio"), running on the
// battery in its own battery slot (spec 143), opened in the item editor like any assembly, its thumbnail showing the
// battery's charge; saves keep it, saves without the slot load with it empty. The auxiliary wells scroll along the
// axis their layout declares (HorizontalScrollController.resolveAxis).
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const runtime = new SourceRuntime();
const { ITEM_DB } = runtime.importModule("src/game/config/raw/items/item_database.js");
const { ItemDatabase } = runtime.importModule("src/game/application/inventory/item_database.js");
const { ITEM_STAT_OVERRIDE_CONFIG } = runtime.importModule("src/game/config/raw/items/item_stat_overrides.js");
const { ItemStatOverridePolicy } = runtime.importModule("src/game/domain/items/item_stat_override_policy.js");
const { EffectiveItemStatsResolver } = runtime.importModule("src/game/domain/items/effective_item_stats_resolver.js");
const { ITEM_ASSEMBLY_PROFILE_CONFIG } = runtime.importModule("src/game/config/raw/inventory/item_assembly_profiles.js");
const { InventoryCompositionRoot } = runtime.importModule("src/bootstrap/production/inventory_composition_root.js");
const { InventoryActionType } = runtime.importModule("src/game/presentation/inventory/inventory_action_type.js");
const { EQUIPMENT_SLOT_CONFIG } = runtime.importModule("src/game/domain/equipment/equipment_slot_catalog.js");
const { HorizontalScrollController } = runtime.importModule("src/platform/browser/dom/horizontal_scroll_controller.js");

const radio = ITEM_DB.devices.radio_receiver_basic;
assert.equal(radio.itemType, "radio");
assert.equal(radio.iconUrl, "assets/items/radio/radio-receiver.webp", "the radio shows the owner's art");
assert.equal(radio.gameplayStats.batteryUse.unitsPerSecond, 1, "1 unit/s: an ordinary battery plays 1 hour (D-P5)");
assert.equal(EQUIPMENT_SLOT_CONFIG.radio.group, "auxiliary");
assert.deepEqual([...EQUIPMENT_SLOT_CONFIG.radio.acceptTypes], ["radio"]);

const overridePolicy = new ItemStatOverridePolicy({ config: ITEM_STAT_OVERRIDE_CONFIG });
function compose(initialSnapshot, cacheData = new Map()) {
  const cache = { get: (key, fallback) => cacheData.has(key) ? JSON.parse(cacheData.get(key)) : fallback,
    set: (key, value) => cacheData.set(key, JSON.stringify(value)) };
  let sequence = 0;
  return { cacheData, inventory: InventoryCompositionRoot.compose({
    cache,
    initialSnapshot,
    itemDefinitionResolver: new ItemDatabase(ITEM_DB),
    itemStatOverridePolicy: overridePolicy,
    effectiveStatsResolver: new EffectiveItemStatsResolver({ overridePolicy }),
    assemblyProfileConfig: ITEM_ASSEMBLY_PROFILE_CONFIG,
    instanceIdFactory: () => `generated-${++sequence}`,
    now: () => 0,
  }) };
}
const item = (instanceId, itemId) => ({ instanceId, itemId, quantity: 1, location: { kind: "INVENTORY" } });
const { inventory, cacheData } = compose({ schemaVersion: 4, items: [item("radio", "radio_receiver_basic"),
  item("battery", "battery_basic")], assemblies: [], equipment: {}, loadouts: [], settings: {} });
const dispatch = (action) => inventory.facade.dispatch(action);

assert.equal(inventory.gameplayBridge.getEquipped().radio, null, "a save without the radio slot has it empty");
// The player's path: tap the empty radio well, then the radio; an assembly with an empty socket opens its editor, where
// the battery fills the battery socket, and «Спорядити» puts the radio on.
dispatch({ type: InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, slotId: "radio" });
dispatch({ type: InventoryActionType.INVENTORY_ITEM_ACTIVATE, instanceId: "radio" });
let view = inventory.facade.getViewModel();
assert.equal(view.panel.mode, "assembly", "the radio with an empty battery socket opens in its editor");
const editingRoot = view.panel.assembly.root?.instanceId;
assert.equal(editingRoot, "radio");
assert.equal(dispatch({ type: InventoryActionType.INVENTORY_ITEM_ACTIVATE, instanceId: "battery" }).success, true,
  "the battery fills the radio's battery socket");
if (!inventory.equipmentState.getRootInstanceId("radio")) {
  assert.equal(dispatch({ type: InventoryActionType.ASSEMBLY_EQUIP, rootInstanceId: editingRoot }).success, true);
}
const root = inventory.equipmentState.getRootInstanceId("radio");
assert(root, "the radio is equipped in its auxiliary slot");
assert.equal(inventory.gameplayBridge.getEquipped().radio.itemId, "radio_receiver_basic");
assert.equal(inventory.gameplayBridge.getEquipped().radioBattery?.itemId, "battery_basic",
  "the battery sits in the radio's battery slot");
assert.equal(inventory.gameplayBridge.attachedBattery(root)?.itemId, "battery_basic",
  "the power port finds the radio's battery");

// The editor opens on the radio like any equipped assembly: image, the battery socket.
dispatch({ type: InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, slotId: "radio" });
const editor = inventory.facade.getViewModel();
assert.equal(editor.panel.mode, "assembly", "a tap on the radio opens its editor");
assert.equal(editor.panel.assembly.root?.itemId, "radio_receiver_basic");
assert.equal(editor.panel.assembly.root?.iconUrl, "assets/items/radio/radio-receiver.webp", "the editor shows the radio's art");
const sockets = JSON.stringify(editor.panel.assembly);
assert(sockets.includes("\"battery\""), "the editor offers the battery socket");

// The radio's thumbnail shows the battery's charge as a bar, without a battery cell (TK-095).
inventory.gameplayBridge.setDeviceChargeProvider((device) => {
  const battery = inventory.gameplayBridge.attachedBattery(device?.instanceId);
  return battery ? { current: 70, maximum: 100 } : null;
});
dispatch({ type: InventoryActionType.ASSEMBLY_BACK, rootInstanceId: root });
const radioWell = JSON.parse(JSON.stringify(inventory.facade.getViewModel().panel.loadout)).auxiliarySlots
  .find((slot) => slot.slotId === "radio");
assert(radioWell?.item, "the radio fills its auxiliary well");
assert.equal(radioWell.item.charge?.percent, 70, "the radio's thumbnail shows its battery's charge");
assert(!(radioWell.item.attachments || []).some((entry) => entry.kind === "battery"), "no battery cell on the radio");

// The save keeps the radio and its battery.
const saved = JSON.parse(cacheData.get("player_inventory_v2"));
assert.equal(saved.equipment.radio, root);
const reloaded = compose(null, new Map(cacheData)).inventory;
assert.equal(reloaded.gameplayBridge.getEquipped().radioBattery?.itemId, "battery_basic", "a reload keeps the radio set");

// The auxiliary wells: one controller scrolls a row along x and a column along y, read per gesture.
let axis = "x";
const scroller = new HorizontalScrollController({ resolveAxis: () => axis });
const listeners = {};
const element = { scrollLeft: 0, scrollTop: 0, scrollWidth: 400, clientWidth: 200, scrollHeight: 500, clientHeight: 250,
  classList: { add() {}, remove() {} }, addEventListener: (type, handler) => { listeners[type] = handler; },
  removeEventListener() {}, setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {} };
scroller.attach(element);
const drag = (dx, dy) => {
  listeners.pointerdown({ pointerId: 1, isPrimary: true, button: 0, pointerType: "mouse", clientX: 100, clientY: 100 });
  listeners.pointermove({ pointerId: 1, clientX: 100 + dx, clientY: 100 + dy, preventDefault() {} });
  listeners.pointerup({ pointerId: 1, type: "pointerup" });
};
drag(-60, 0);
assert.equal(element.scrollLeft, 60, "the row scrolls horizontally");
axis = "y";
drag(0, -80);
assert.equal(element.scrollTop, 80, "the same wells in a column scroll vertically");
assert.equal(element.scrollLeft, 60, "a column drag leaves the row offset alone");

// ---- Stage 2: stations, region, preferences, the service, the stream player, the controls and the HUD indicator ----
const { RadioStationFilter } = runtime.importModule("src/game/domain/radio/radio_station_filter.js");
const { BrowserRegionResolver } = runtime.importModule("src/platform/browser/radio/browser_region_resolver.js");
const { RadioBrowserStationSource } = runtime.importModule("src/platform/browser/radio/radio_browser_station_source.js");
const { RadioPreferencesLocalStore } = runtime.importModule("src/platform/browser/storage/radio_preferences_local_store.js");
const { RadioReceiverService } = runtime.importModule("src/game/application/radio/radio_receiver_service.js");
const { RadioStreamPlayer } = runtime.importModule("src/platform/browser/audio/radio_stream_player.js");
const { SharedAudioContextProvider } = runtime.importModule("src/platform/browser/audio/shared_audio_context_provider.js");
const { RadioControlsRenderer } = runtime.importModule("src/game/presentation/radio/radio_controls_renderer.js");
const { RADIO_LABELS } = runtime.importModule("src/game/presentation/radio/radio_labels.js");
const { RadioHudIndicator } = runtime.importModule("src/platform/browser/ui/radio_hud_indicator.js");
const { InventoryDomFactory } = runtime.importModule("src/platform/browser/dom/inventory_dom_factory.js");
const { TestDocument } = require("../../testing/keepnet/test_document");
const plain = (value) => JSON.parse(JSON.stringify(value));

const station = (id, url, extra = {}) => ({ stationuuid: id, name: "Station " + id, url_resolved: url, codec: "MP3",
  bitrate: 128, hls: 0, countrycode: "UA", ...extra });
const rawStations = [station("a", "https://a.example/live"), station("b", "http://b.example/live"),
  station("c", "https://c.example/live.m3u8"), station("d", "https://d.example/live", { hls: 1 }),
  station("e", "https://e.example/live", { codec: "OGG" }), station("f", "https://f.example/live"),
  station("a", "https://a.example/live"), station("g", "", { url: "https://g.example/list.pls" })];
const stationFilter = new RadioStationFilter();
assert.deepEqual(plain(stationFilter.filter(rawStations, { codecs: ["MP3", "AAC"], secureOnly: true })).map((entry) => entry.id),
  ["a", "f"], "an https page keeps https url_resolved streams, no HLS, listed codecs, no duplicates");
assert.deepEqual(plain(stationFilter.filter(rawStations, { codecs: ["MP3"], secureOnly: false })).map((entry) => entry.id),
  ["a", "b", "f"], "a local http page also plays http streams");

const zones = { timeZoneCountries: { "Europe/Kyiv": "UA" }, defaultCountry: "PL" };
assert.equal(new BrowserRegionResolver({ navigatorRef: { languages: ["uk-UA"] }, timeZone: () => "", config: () => zones })
  .resolve(), "UA", "the language region comes first");
assert.equal(new BrowserRegionResolver({ navigatorRef: { languages: ["uk"] }, timeZone: () => "Europe/Kyiv",
  config: () => zones }).resolve(), "UA", "then the time zone");
assert.equal(new BrowserRegionResolver({ navigatorRef: { languages: ["en"] }, timeZone: () => "Mars/Base",
  config: () => zones }).resolve(), "PL", "then the configured default");

function scheduler() {
  let now = 0; let next = 0; const jobs = new Map();
  return { setTimeout: (callback, ms) => { const id = ++next; jobs.set(id, { callback, at: now + ms }); return id; },
    clearTimeout: (id) => jobs.delete(id), get pending() { return jobs.size; },
    advance(ms) { now += ms; for (const [id, job] of [...jobs]) if (job.at <= now) { jobs.delete(id); job.callback(); } } };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
const byClass = (root, name) => {
  const found = [];
  const walk = (node) => { if (String(node.className).split(" ").includes(name)) found.push(node); node.children.forEach(walk); };
  walk(root);
  return found;
};

async function stageTwo() {
  // Mirrors: the first failing server gives way to the next; the response is a JSON list.
  const requested = [];
  const source = new RadioBrowserStationSource({ config: () => ({ apiServers: ["https://one.example", "https://two.example/"],
    stationLimit: 5, requestTimeoutMs: 100 }), scheduler: scheduler(), createAbortController: () => ({ signal: {}, abort() {} }),
    fetchRef: async (url) => {
      requested.push(url);
      if (url.startsWith("https://one")) throw new Error("down");
      return { ok: true, json: async () => [station("x", "https://x.example/live")] };
    } });
  assert.equal((await source.listStations("ua")).length, 1);
  const query = "/json/stations/bycountrycodeexact/UA?hidebroken=true&order=votes&reverse=true&limit=5";
  assert.deepEqual(requested, ["https://one.example" + query, "https://two.example" + query],
    "mirrors in order with the country's stations by votes");
  let aborted = 0;
  const timers = scheduler();
  const slow = new RadioBrowserStationSource({ config: () => ({ apiServers: ["https://slow.example"], requestTimeoutMs: 100 }),
    scheduler: timers, createAbortController: () => ({ signal: {}, abort() { aborted += 1; } }),
    fetchRef: () => new Promise(() => {}) });
  slow.listCountries();
  timers.advance(100);
  assert.equal(aborted, 1, "a mirror that does not answer in time is aborted");

  // Preferences: validated, merged, never the power.
  const prefData = new Map();
  const prefs = new RadioPreferencesLocalStore({ cache: {
    get: (key, fallback) => prefData.has(key) ? JSON.parse(prefData.get(key)) : fallback,
    set: (key, value) => prefData.set(key, JSON.stringify(value)) } });
  prefs.save({ country: "DE", volume: 3, powered: true, ducking: false });
  assert.deepEqual(plain(prefs.load()), { country: "DE", volume: 1, ducking: false }, "preferences are validated, power is never kept");

  // The service over fakes.
  const equippedState = { radio: { instanceId: "r" }, radioBattery: { instanceId: "b" } };
  let charge = 100;
  const played = [];
  let stops = 0;
  const lists = { UA: [station("u1", "https://u1.example/live"), station("u2", "https://u2.example/live")],
    DE: [station("d1", "https://d1.example/live")], PL: [] };
  const service = new RadioReceiverService({ equipment: { getEquipped: () => equippedState },
    power: { read: () => ({ empty: charge <= 0 }) },
    stations: { listStations: async (code) => lists[code] || [], listCountries: async () => [
      { iso_3166_1: "UA", name: "Ukraine", stationcount: 2 }, { iso_3166_1: "DE", name: "Germany", stationcount: 1 }] },
    player: { play: (url) => played.push(url), stop: () => { stops += 1; }, setVolume() {} },
    preferences: new RadioPreferencesLocalStore({ cache: { get: () => null, set() {} } }),
    region: { resolve: () => "UA" }, config: () => ({ codecs: ["MP3"], defaultVolume: 0.5 }), secureOnly: true });
  assert.equal(service.getStatus().status, "off");
  assert.equal(service.getStatus().country, "UA", "the first country is the browser's region (D1)");
  charge = 0; service.powerOn();
  assert.equal(service.getStatus().status, "no-battery", "an empty battery refuses power");
  charge = 100; service.powerOn(); await settle();
  assert.deepEqual(played, ["https://u1.example/live"], "power plays the country's first station");
  service.handlePlayerState("playing", { effects: true });
  assert.equal(service.getStatus().status, "playing");
  service.handlePlayerState("failed");
  assert.equal(played.at(-1), "https://u2.example/live", "a station that does not start gives way to the next");
  service.handlePlayerState("failed");
  assert.equal(service.getStatus().status, "no-stations", "when every station failed the radio says so");
  service.next();
  assert.equal(played.at(-1), "https://u1.example/live", "next wraps around");
  service.handlePlayerState("playing", { effects: false });
  assert.equal(service.getStatus().status, "no-effect", "a stream without CORS plays without effects");
  service.setCountry("DE"); await settle();
  assert.equal(played.at(-1), "https://d1.example/live", "another country loads its stations");
  service.setVolume(0.8);
  assert.equal(service.getStatus().volume, 0.8);
  service.setPageHidden(true);
  assert(stops > 0, "a hidden page stops the stream by default");
  const beforeShow = played.length;
  service.setPageHidden(false);
  assert.equal(played.length, beforeShow + 1, "the stream resumes when the page is visible");
  service.setPreference("playInBackground", true);
  const stopsBefore = stops;
  service.setPageHidden(true);
  assert.equal(stops, stopsBefore, "playInBackground keeps playing in a hidden page");
  service.setPageHidden(false);
  assert.deepEqual(plain(await service.listCountries()).map((entry) => entry.code), ["UA", "DE"]);
  equippedState.radio = null; service.update();
  assert.equal(service.getStatus().powered, false, "taking the radio off turns it off");
  assert.equal(service.getStatus().equipped, false);
  equippedState.radio = { instanceId: "r" }; service.update();
  service.powerOn(); await settle(); charge = 0; service.update();
  assert.equal(service.getStatus().status, "no-battery", "an empty battery turns a playing radio off");
  charge = 100; service.setCountry("PL"); service.powerOn(); await settle();
  assert.equal(service.getStatus().status, "no-stations", "a country without stations says so");

  // The stream player over fake Web Audio that keeps the browser contract: a stream without CORS fails to load with
  // crossOrigin "anonymous"; an element connected to Web Audio cannot be connected again or go back to native output.
  const streams = { "https://cors.example": { cors: true }, "https://nocors.example": { cors: false },
    "https://dead.example": { dead: true } };
  const elements = [];
  class FakeAudio {
    constructor() { this.listeners = {}; this.volume = 1; this.crossOrigin = null; this.connected = false; elements.push(this); }
    addEventListener(type, handler) { (this.listeners[type] ||= new Set()).add(handler); }
    removeEventListener(type, handler) { this.listeners[type]?.delete(handler); }
    emit(type) { for (const handler of [...(this.listeners[type] || [])]) handler({}); }
    play() {
      const entry = streams[this.src] || {};
      this.outcome = entry.dead ? "silent" : this.crossOrigin === "anonymous" && !entry.cors ? "error" : "playing";
      return Promise.resolve();
    }
    settle() { if (this.outcome === "error") this.emit("error"); else if (this.outcome === "playing") this.emit("playing"); }
    pause() {}
    load() {}
    removeAttribute(key) { if (key === "src") this.src = ""; }
  }
  class FakeNode {
    constructor() { this.to = []; this.gain = { value: 1 }; }
    connect(node) { this.to.push(node); }
    disconnect() { this.to = []; }
  }
  const context = { state: "running", destination: new FakeNode(), createGain: () => new FakeNode(),
    createMediaElementSource: (element) => {
      if (element.connected) throw new Error("already connected");
      element.connected = true;
      const node = new FakeNode(); node.element = element; return node;
    }, resume: async () => {} };
  let contextsMade = 0;
  const audioContexts = new SharedAudioContextProvider({ windowRef: { AudioContext: function AudioContext() {
    contextsMade += 1; return context; } } });
  assert.equal(audioContexts.peek(), null, "no audio context before the power gesture");
  const states = [];
  const playerTimers = scheduler();
  const stream = new RadioStreamPlayer({ documentRef: { createElement: () => new FakeAudio() }, audioContexts,
    scheduler: playerTimers, config: () => ({ startTimeoutMs: 5000 }), onState: (state, info) => states.push([state, info.effects]) });
  stream.setVolume(0.5);
  stream.play("https://cors.example");
  assert.equal(contextsMade, 1, "the first play (in the gesture) makes the context");
  elements.at(-1).settle();
  assert.deepEqual(states.at(-1), ["playing", true], "a CORS stream plays through Web Audio");
  assert.equal(elements.at(-1).crossOrigin, "anonymous");
  assert.equal(stream.input.to[0].gain.value, 0.5, "volume is the output gain");
  stream.play("https://nocors.example");
  const first = elements.at(-1);
  first.settle();
  const fallback = elements.at(-1);
  assert.notEqual(fallback, first, "the no-CORS fallback is a new element");
  assert.equal(fallback.crossOrigin, null);
  assert.equal(fallback.connected, false, "the fallback stays on the native output");
  fallback.settle();
  assert.deepEqual(states.at(-1), ["playing", false], "it plays without effects");
  assert.equal(fallback.volume, 0.5, "the fallback's volume is the element's");
  stream.play("https://dead.example");
  playerTimers.advance(5000);
  playerTimers.advance(5000);
  assert.deepEqual(states.at(-1), ["failed", undefined], "a silent stream fails after both attempts time out");
  stream.stop();
  assert.equal(playerTimers.pending, 0, "stop clears the timers");
  assert(elements.every((element) => Object.values(element.listeners).every((set) => set.size === 0)),
    "stop and every attempt remove their listeners");

  // The editor controls drive the service; status updates write in place, station names as text.
  const doc = new TestDocument();
  const dom = new InventoryDomFactory(doc, { glyphMetrics: {} });
  const calls = [];
  let listener = null;
  const status = { status: "off", powered: false, equipped: true, station: null, country: "UA", stationCount: 2,
    volume: 0.4, retroMode: true, ducking: true, playInBackground: false };
  const port = { getStatus: () => status, subscribe: (handler) => { listener = handler; return () => { listener = null; }; },
    togglePower: () => calls.push("power"), next: () => calls.push("next"), previous: () => calls.push("previous"),
    setCountry: (code) => calls.push("country:" + code), setVolume: (value) => calls.push("volume:" + value),
    setPreference: (key, value) => calls.push(key + ":" + value),
    listCountries: async () => [{ code: "UA", name: "Ukraine" }, { code: "DE", name: "Germany" }] };
  const controls = new RadioControlsRenderer({ domFactory: dom, radio: port, labels: RADIO_LABELS });
  assert.equal(controls.supports({ itemType: "radio" }), true);
  assert.equal(controls.supports({ itemType: "boat" }), false);
  const block = controls.render();
  await settle();
  const [powerButton] = byClass(block, "radio-controls__button--power");
  powerButton.click();
  byClass(block, "radio-controls__button")[2].click();
  const [select] = byClass(block, "radio-controls__select");
  assert.equal(select.children.length, 2, "the country selector lists the countries");
  select.value = "DE"; select.fire("change");
  const [volume] = byClass(block, "radio-controls__volume");
  assert.equal(volume.value, "40");
  volume.value = "70"; volume.fire("input");
  const ducking = byClass(block, "radio-controls__switch-input")[1];
  ducking.checked = false; ducking.fire("change");
  assert.deepEqual(calls, ["power", "next", "country:DE", "volume:0.7", "ducking:false"], "every control calls the radio");
  Object.assign(status, { status: "playing", powered: true, station: { name: "Station <b>X</b>", bitrate: 128 } });
  listener(status);
  assert.equal(byClass(block, "radio-controls__station")[0].textContent, "Station <b>X</b>", "names are text, never markup");
  assert.equal(byClass(block, "radio-controls__status")[0].textContent, RADIO_LABELS.status.playing);
  assert.equal(powerButton.textContent, RADIO_LABELS.powerOff);
  controls.render();
  assert(listener, "a new render keeps one subscription");
  controls.dispose();
  assert.equal(listener, null, "dispose unsubscribes");

  // The HUD indicator: shown while a radio is worn, state modifiers, a tap opens the editor.
  let opened = 0;
  let indicatorListener = null;
  const indicatorStatus = { ...status, equipped: false, powered: false, status: "off" };
  const indicator = new RadioHudIndicator({ documentRef: doc, mountNode: doc.body, labels: RADIO_LABELS,
    radio: { getStatus: () => indicatorStatus, subscribe: (handler) => { indicatorListener = handler; return () => {}; } },
    onActivate: () => { opened += 1; } });
  const [button] = byClass(doc.body, "hud-indicator");
  assert.equal(button.hidden, true, "hidden without a radio");
  indicatorListener({ ...indicatorStatus, equipped: true, powered: true, status: "playing" });
  assert.equal(button.hidden, false);
  assert(button.classList.contains("hud-indicator--playing"));
  indicatorListener({ ...indicatorStatus, equipped: true, status: "no-battery" });
  assert(button.classList.contains("hud-indicator--empty") && !button.classList.contains("hud-indicator--playing"));
  button.click();
  assert.equal(opened, 1, "a tap opens the radio's editor");
  indicator.dispose();
}

stageTwo().then(() => console.log("Radio receiver stage 2 passed: station filter (url_resolved, https page, HLS, codecs, "
  + "duplicates), region (language, time zone, default), mirrors and request timeout, validated preferences without power, "
  + "the service (battery gate, stations, skip, no-stations, next, no-effect, country, volume, hidden page, background, "
  + "unequip, empty battery), the stream player (context in the gesture, Web Audio for CORS, a new native element "
  + "without CORS, timeouts, cleanup), the editor controls and the HUD indicator."))
  .catch((error) => { console.error(error); process.exitCode = 1; });

console.log("Radio receiver passed: catalog item with art and 1 unit/s, its own auxiliary slot (empty in old saves), "
  + "equip, battery in its own slot found by the power port, editor with the battery socket, thumbnail charge bar "
  + "without a battery cell, save and reload, and the auxiliary wells scrolling along x in a row and y in a column.");
