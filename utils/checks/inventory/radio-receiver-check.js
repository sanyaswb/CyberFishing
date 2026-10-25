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
  const effectsCalls = [];
  let stops = 0;
  const lists = { UA: [station("u1", "https://u1.example/live"), station("u2", "https://u2.example/live")],
    DE: [station("d1", "https://d1.example/live")], PL: [] };
  const service = new RadioReceiverService({ equipment: { getEquipped: () => equippedState },
    power: { read: () => ({ empty: charge <= 0 }) },
    stations: { listStations: async (code) => lists[code] || [], listCountries: async () => [
      { iso_3166_1: "UA", name: "Ukraine", stationcount: 2 }, { iso_3166_1: "DE", name: "Germany", stationcount: 1 }] },
    player: { play: (url) => played.push(url), stop: () => { stops += 1; }, setVolume() {}, setGainScale() {},
      setStreamMuted() {}, refreshEffects: () => effectsCalls.push("refresh") },
    weather: { getSnapshot: () => ({}) }, noise: { update() {}, burst() {}, stop() {} }, rng: { next: () => 0.99 },
    scheduler: scheduler(),
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
    constructor() {
      this.to = [];
      this.gain = { value: 1, targets: [], setTargetAtTime(value, at, constant) { this.targets.push([value, at, constant]); } };
    }
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
  assert.equal(stream.output.gain.value, 0.5, "volume is the output gain");
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
    volume: 0.4, ducking: true, playInBackground: false };
  const port = { getStatus: () => status, subscribe: (handler) => { listener = handler; return () => { listener = null; }; },
    togglePower: () => calls.push("power"), next: () => calls.push("next"), previous: () => calls.push("previous"),
    setCountry: (code) => calls.push("country:" + code), setVolume: (value) => calls.push("volume:" + value),
    setPreference: (key, value) => calls.push(key + ":" + value),
    listCountries: async () => [{ code: "UA", name: "Ukraine" }, { code: "DE", name: "Germany" }] };
  const controls = new RadioControlsRenderer({ domFactory: dom, radio: port, labels: RADIO_LABELS });
  // TK-096: the block is a flex item of the scrolling editor; without flex: none (inventory-panel's min-height 0) it
  // shrank and the editor tabs' panel covered its buttons. The DOM double has no layout, so the CSS contract guards it.
  const controlsCss = runtime.read("src/game/presentation/styles/inventory/radio-controls.css").replace(/\s+/gu, " ");
  assert(/\.radio-controls \{[^}]*flex: none;/u.test(controlsCss), "the radio controls keep their height in the editor");
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
  const switchInputs = byClass(block, "radio-controls__switch-input");
  assert.equal(switchInputs.length, 2, "the player's switches are ducking and background only, no sound effect");
  const ducking = switchInputs[0];
  ducking.checked = false; ducking.fire("change");
  assert.deepEqual(calls, ["power", "next", "country:DE", "volume:0.7", "ducking:false"], "every control calls the radio");
  Object.assign(status, { status: "playing", powered: true, station: { name: "Station <b>X</b>", bitrate: 128 } });
  listener(status);
  assert.equal(byClass(block, "radio-controls__station")[0].textContent, "Station <b>X</b>", "names are text, never markup");
  assert.equal(byClass(block, "radio-controls__status")[0].textContent, RADIO_LABELS.status.playing);
  listener({ ...status, signal: 0.5 });
  assert.equal(byClass(block, "radio-controls__status")[0].textContent,
    RADIO_LABELS.status.playing + " · " + RADIO_LABELS.weakSignal, "a weak signal is said in the status");
  listener(status);
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
  indicatorListener({ ...indicatorStatus, equipped: true, powered: true, status: "playing", signal: 0.4 });
  assert(button.classList.contains("hud-indicator--weak"), "a weak signal shows as the broken wave");
  indicatorListener({ ...indicatorStatus, equipped: true, status: "no-battery" });
  assert(button.classList.contains("hud-indicator--empty") && !button.classList.contains("hud-indicator--playing"));
  button.click();
  assert.equal(opened, 1, "a tap opens the radio's editor");
  indicator.dispose();
}

// ---- Stage 3: the walkie-talkie rack ----
const { WalkieTalkieRack } = runtime.importModule("src/platform/browser/audio/walkie_talkie_rack.js");
async function stageThree() {
  const curve = WalkieTalkieRack.curve(18, 1001);
  assert.equal(curve.length, 1001);
  assert(Math.abs(curve[500]) < 1e-6, "the S-curve passes through zero");
  assert(Math.abs(curve[0] + curve[1000]) < 1e-6, "it is odd-symmetric");
  for (let index = 1; index < curve.length; index += 1) assert(curve[index] >= curve[index - 1], "and monotonic");
  assert(Math.abs(curve[1000] - WalkieTalkieRack.peak(18)) < 1e-6);
  assert(Math.abs(WalkieTalkieRack.peak(18) - 0.3467) < 0.001, "k = 18 peaks near 0.35, so the effect needs make-up gain");
  assert.equal(WalkieTalkieRack.curve(18).length, 44100, "the curve has 44100 points (ToR 4.2)");

  // A fake Web Audio that records the graph and AudioParam writes.
  const made = [];
  const param = (value = 0) => ({ value, targets: [], setTargetAtTime(v, at, c) { this.targets.push([v, at, c]); } });
  const node = (kind) => {
    const entry = { kind, to: [], connect(target) { this.to.push(target); }, disconnect() { this.to = []; },
      gain: param(1), frequency: param(), Q: param(), delayTime: param(), started: 0, stopped: 0,
      start() { this.started += 1; }, stop() { this.stopped += 1; } };
    made.push(entry);
    return entry;
  };
  const context = { currentTime: 2, sampleRate: 1000, createBiquadFilter: () => node("biquad"),
    createWaveShaper: () => node("shaper"), createGain: () => node("gain"), createDelay: () => node("delay"),
    createOscillator: () => node("oscillator"), createBufferSource: () => node("source"),
    createBuffer: (channels, length) => { const data = new Float32Array(length); return { length, getChannelData: () => data }; } };

  // The walkie-talkie stage: order, settings, make-up gain, ramped mix, live edits, disabled = dry.
  const walkie = new WalkieTalkieRack().build(context);
  const walkieSettings = { enabled: true, mix: 1, highpassHz: 500, lowpassHz: 3000, peakHz: 1800, peakGainDb: 8, peakQ: 2.5,
    drive: 18, oversample: "4x", outputGain: 1 };
  walkie.update(walkieSettings, 0.03);
  const [input, output, dry, wet, highpass, lowpass, peaking, shaper, makeup] = made.slice(0, 9);
  assert.deepEqual([highpass.type, lowpass.type, peaking.type], ["highpass", "lowpass", "peaking"]);
  assert.deepEqual([highpass.frequency.value, lowpass.frequency.value, peaking.frequency.value, peaking.gain.value,
    peaking.Q.value], [500, 3000, 1800, 8, 2.5], "the filters follow CONFIG.radio.effects.walkieTalkie");
  assert.equal(shaper.oversample, "4x");
  assert(Math.abs(makeup.gain.value - 1 / WalkieTalkieRack.peak(18)) < 1e-9, "make-up gain keeps it as loud as dry");
  assert(input.to.includes(dry) && input.to.includes(highpass) && highpass.to.includes(lowpass) && lowpass.to.includes(peaking)
    && peaking.to.includes(shaper) && shaper.to.includes(makeup) && makeup.to.includes(wet), "the wet chain in order");
  assert(dry.to.includes(output) && wet.to.includes(output));
  assert.deepEqual([wet.gain.value, dry.gain.value], [1, 0], "an enabled stage starts wet");
  walkie.update({ ...walkieSettings, lowpassHz: 2500, outputGain: 0.5 }, 0.03);
  assert.equal(lowpass.frequency.value, 2500, "a live edit applies");
  assert(Math.abs(makeup.gain.value - 0.5 / WalkieTalkieRack.peak(18)) < 1e-9, "outputGain scales the make-up gain");
  walkie.update({ ...walkieSettings, enabled: false }, 0.03);
  assert.deepEqual([...wet.gain.targets.at(-1)], [0, 2, 0.03], "disabling ramps the wet gain out");
  assert.deepEqual([...dry.gain.targets.at(-1)], [1, 2, 0.03], "and the dry gain in, without a click");
  const targetCount = wet.gain.targets.length;
  walkie.update({ ...walkieSettings, enabled: false }, 0.03);
  assert.equal(wet.gain.targets.length, targetCount, "unchanged settings write nothing");
  walkie.dispose();
  assert(made.slice(0, 9).every((entry) => entry.to.length === 0), "dispose disconnects the stage");

  // The vinyl stage: wow/flutter on the delay, warm tone, surface sounds, live edits and disabling.
  made.length = 0;
  const { VinylRack } = runtime.importModule("src/platform/browser/audio/vinyl_rack.js");
  let draw = 0;
  const vinyl = new VinylRack({ rng: { next: () => { draw = (draw + 0.37) % 1; return draw; } } }).build(context);
  const vinylSettings = { enabled: true, mix: 1, highpassHz: 35, warmthHz: 150, warmthGainDb: 2.5, lowpassHz: 9000,
    drive: 3, outputGain: 1, baseDelayMs: 6, wowHz: 0.55, wowDepthMs: 1.2, flutterHz: 6.5, flutterDepthMs: 0.15,
    crackleRate: 6, crackleLevel: 0.12, crackleToneHz: 2500, popRate: 0.25, popLevel: 0.35, hissLevel: 0.006,
    rumbleHz: 30, rumbleLevel: 0.02 };
  vinyl.update(vinylSettings, 0.03);
  const byKind = (kind) => made.filter((entry) => entry.kind === kind);
  const [delay] = byKind("delay");
  const [wow, flutter] = byKind("oscillator");
  assert.equal(delay.delayTime.value, 0.006, "the record plays through a short delay");
  assert.deepEqual([wow.frequency.value, flutter.frequency.value], [0.55, 6.5], "wow and flutter rates");
  const wowDepth = made.find((entry) => wow.to.includes(entry));
  const flutterDepth = made.find((entry) => flutter.to.includes(entry));
  assert(wowDepth.to.includes(delay.delayTime) && flutterDepth.to.includes(delay.delayTime), "both sway the delay time");
  assert(Math.abs(wowDepth.gain.value - 0.0012) < 1e-12 && Math.abs(flutterDepth.gain.value - 0.00015) < 1e-12,
    "by their depths in seconds");
  assert(wow.started === 1 && flutter.started === 1, "the oscillators run");
  const filters = byKind("biquad");
  assert.deepEqual(filters.slice(0, 3).map((entry) => [entry.type, entry.frequency.value]),
    [["highpass", 35], ["lowshelf", 150], ["lowpass", 9000]], "rumble filter, warmth, old top end");
  assert.equal(filters[1].gain.value, 2.5, "the warm low shelf");
  const sources = byKind("source");
  assert.equal(sources.length, 4, "hiss, rumble, crackle and pops loop");
  assert(sources.every((source) => source.loop === true && source.started === 1));
  const crackleBuffer = sources[2].buffer.getChannelData(0);
  assert(crackleBuffer.some((sample) => sample !== 0), "the crackle buffer holds clicks");
  vinyl.update({ ...vinylSettings, crackleRate: 6, wowDepthMs: 2 }, 0.03);
  assert.equal(byKind("source").length, 4, "an unchanged click density keeps its buffer");
  assert(Math.abs(wowDepth.gain.value - 0.002) < 1e-12, "a live wow edit applies");
  vinyl.update({ ...vinylSettings, wowDepthMs: 2, crackleRate: 12 }, 0.03);
  assert.equal(byKind("source").length, 5, "a new crackle density rebuilds only that buffer");
  assert.equal(sources[2].stopped, 1, "and stops the old one");
  const vinylWet = made[3];
  vinyl.update({ ...vinylSettings, wowDepthMs: 2, crackleRate: 12, enabled: false }, 0.03);
  assert.deepEqual([...vinylWet.gain.targets.at(-1)], [0, 2, 0.03], "a disabled record passes the sound dry (and silent surface)");
  vinyl.dispose();
  assert(wow.stopped === 1 && byKind("source").every((source) => source.to.length === 0), "dispose stops and disconnects");

  // The chain: input -> vinyl -> walkie-talkie -> output, both read from CONFIG.radio.effects live.
  made.length = 0;
  const { RadioEffectsChain } = runtime.importModule("src/platform/browser/audio/radio_effects_chain.js");
  const effectsConfig = { rampSeconds: 0.05, vinyl: { ...vinylSettings, enabled: false }, walkieTalkie: { ...walkieSettings } };
  const chain = new RadioEffectsChain({ config: () => effectsConfig, rng: { next: () => 0.5 } });
  const chainIn = node("in");
  const chainOut = node("out");
  chain.attach(context, chainIn, chainOut);
  const stageInputs = made.filter((entry) => entry.kind === "gain" && chainIn.to.includes(entry));
  assert.equal(stageInputs.length, 1, "the chain input feeds the vinyl stage");
  assert(made.some((entry) => entry.to.includes(chainOut)), "the walkie-talkie stage feeds the output");
  effectsConfig.vinyl.enabled = true;
  chain.update();
  assert(made.some((entry) => entry.gain.targets.some(([value, , constant]) => value === 1 && constant === 0.05)),
    "enabling the record in the configuration ramps it in on the next update");
  chain.dispose();

  // The player re-reads the effects; the service never lets the player choose them.
  let refreshed = 0;
  const service = new RadioReceiverService({ equipment: { getEquipped: () => ({}) }, power: { read: () => ({ empty: true }) },
    stations: { listStations: async () => [], listCountries: async () => [] },
    player: { play() {}, stop() {}, setVolume() {}, setGainScale() {}, setStreamMuted() {}, refreshEffects: () => { refreshed += 1; } },
    weather: { getSnapshot: () => ({}) }, noise: { update() {}, burst() {}, stop() {} }, rng: { next: () => 0.99 },
    scheduler: scheduler(),
    preferences: new RadioPreferencesLocalStore({ cache: { get: () => ({ retroMode: false }), set() {} } }),
    region: { resolve: () => "UA" }, config: () => ({}), secureOnly: true });
  service.setPreference("retroMode", false);
  assert.equal(service.getStatus().retroMode, undefined, "the player has no sound-effect preference");
  assert.equal(refreshed, 0);
}

// ---- Stage 4: consumption, reception, dropouts, rain noise ----
const vm = require("node:vm");
const { RadioSignalModel } = runtime.importModule("src/game/domain/radio/radio_signal_model.js");
const { DevicePowerService } = runtime.importModule("src/game/application/power/device_power_service.js");
const { MonotonicIntervalTicker } = runtime.importModule("src/platform/browser/time/monotonic_interval_ticker.js");
async function stageFour() {
  const signalSettings = { lowChargePercent: 25, baseNoise: 0.01, maxNoise: 0.3, rainNoise: 0.12, rainMultMax: 2.5,
    maxCrackle: 6, rainCrackle: 2, dropoutMax: 0.5, maxVolumeSag: 0.35 };
  const model = new RadioSignalModel();
  const full = { ...model.read({ chargePercent: 80 }, signalSettings) };
  assert.deepEqual([full.quality, full.noiseGain, full.crackleRate, full.dropoutChancePerSecond, full.volumeSag],
    [1, 0.01, 0, 0, 0], "a charged battery does not touch reception");
  const half = { ...model.read({ chargePercent: 12.5 }, signalSettings) };
  assert.equal(half.quality, 0.5, "below the threshold quality follows the charge");
  assert(Math.abs(half.noiseGain - 0.16) < 1e-9 && Math.abs(half.dropoutChancePerSecond - 0.125) < 1e-9 &&
    Math.abs(half.volumeSag - 0.175) < 1e-9, "noise, dropouts (w²) and sag grow as it fades");
  const rain = { ...model.read({ chargePercent: 80, isRaining: true, rainMult: 2.5 }, signalSettings) };
  assert(Math.abs(rain.noiseGain - 0.13) < 1e-9 && rain.crackleRate === 2, "full rain adds its noise and crackle");
  assert.equal(model.read({ chargePercent: 80, isRaining: false, rainMult: 2.5 }, signalSettings).rain, 0);

  // The real power service over a battery port; the radio consumes 1 unit/s: one ordinary battery = 1 hour.
  const stored = new Map([["bat", { percent: 100, capacityUnits: 3600 }]]);
  const powerService = new DevicePowerService({ config: () => ({ maxStepSeconds: 1, maxBackgroundStepSeconds: 65,
    saveIntervalSeconds: 5 }), batteries: { attachedBattery: () => ({ instanceId: "bat" }),
    readBattery: (id) => stored.get(id) || null,
    drainBattery: (id, units) => { const entry = stored.get(id);
      entry.percent = Math.max(0, entry.percent - units / entry.capacityUnits * 100); return { ...entry }; } } });
  const radioItem = { instanceId: "radio-1", effectiveStats: { batteryUse: { unitsPerSecond: 1 } } };
  const equipment = { radio: radioItem, radioBattery: { instanceId: "bat" } };
  const gains = []; const mutes = []; const noiseCalls = []; const bursts = []; let noiseStops = 0;
  let next = 0.99;
  const timers = scheduler();
  let weather = { isRaining: false, wind: { rainMult: 1 } };
  const service = new RadioReceiverService({ equipment: { getEquipped: () => equipment }, power: powerService,
    stations: { listStations: async () => [station("s", "https://s.example/live")], listCountries: async () => [] },
    player: { play() {}, stop() {}, setVolume() {}, refreshEffects() {}, setGainScale: (value) => gains.push(value),
      setStreamMuted: (muted) => mutes.push(muted) },
    preferences: new RadioPreferencesLocalStore({ cache: { get: () => null, set() {} } }), region: { resolve: () => "UA" },
    config: () => ({ codecs: ["MP3"], signal: { ...signalSettings, dropoutMs: [200, 200] } }), secureOnly: true,
    weather: { getSnapshot: () => weather },
    noise: { update: (level, rate) => noiseCalls.push([level, rate]), burst: (s) => bursts.push(s), stop: () => { noiseStops += 1; } },
    rng: { next: () => next }, scheduler: timers });
  const SourceDate = vm.runInContext("Date", runtime.context);
  const realNow = SourceDate.now;
  SourceDate.now = () => { throw new Error("the radio's consumption must not read the wall clock"); };
  try {
    service.powerOn(); await settle();
    service.handlePlayerState("playing", { effects: true });
    service.tick(60);
    assert(Math.abs(stored.get("bat").percent + (powerService.read("bat").percent - stored.get("bat").percent) - (100 - 100 / 3600)) < 1e-9,
      "a visible page counts one clamped second per tick, whatever the gap");
    service.setPreference("playInBackground", false);
    service.setPageHidden(true);
    const beforeHidden = powerService.read("bat").percent;
    service.tick(60);
    assert.equal(powerService.read("bat").percent, beforeHidden, "a stopped radio in a hidden page consumes nothing");
    service.setPreference("playInBackground", true);
    service.tick(600);
    assert(Math.abs(beforeHidden - powerService.read("bat").percent - 65 * 100 / 3600) < 1e-9,
      "background play counts the throttled timer's real gap, at most 65 s");
    service.setPageHidden(false);
    let seconds = 66;
    while (service.getStatus().powered && seconds < 4000) { service.tick(1); seconds += 1; }
    assert(Math.abs(seconds - 3600) <= 2, "one ordinary battery plays the radio for 1 hour: " + seconds);
    assert.equal(service.getStatus().status, "no-battery", "an empty battery turns the radio off");
    assert(noiseStops > 0, "and silences its noise");
  } finally {
    SourceDate.now = realNow;
  }

  // A weak battery: sag, noise, a dropout from the radio's RNG, rain.
  stored.get("bat").percent = 12.5;
  service.powerOn(); await settle();
  service.handlePlayerState("playing", { effects: true });
  next = 0;
  weather = { isRaining: true, wind: { rainMult: 2.5 } };
  service.tick(1);
  assert(Math.abs(gains.at(-1) - (1 - 0.35 * (1 - (12.5 - 1 / 36) / 25))) < 1e-3, "the volume sags with the weak battery");
  assert(noiseCalls.at(-1)[0] > 0.13 && noiseCalls.at(-1)[1] > 2, "noise and crackle from the battery and the rain");
  assert.equal(mutes.at(-1), true, "a dropout silences the station");
  assert(Math.abs(bursts.at(-1) - 0.2) < 1e-9, "with a crackle burst for its length");
  assert(service.getStatus().signal < 1, "the status reports the weak signal");
  timers.advance(200);
  assert.equal(mutes.at(-1), false, "the station returns after the dropout");
  service.powerOff();

  // The ticker reports the monotonic gap.
  let current = 1000;
  const ticks = [];
  let intervalHandler = null;
  const ticker = new MonotonicIntervalTicker({ windowRef: { setInterval: (handler) => { intervalHandler = handler; return 7; },
    clearInterval: () => { intervalHandler = null; } }, intervalMs: 1000, now: () => current, onTick: (s) => ticks.push(s) });
  current = 61000; intervalHandler();
  assert.deepEqual(ticks, [60], "the ticker reports the real elapsed seconds");
  ticker.dispose();
  assert.equal(intervalHandler, null);
}

// ---- Stage 5: ducking on a bite, the DevTools section ----
const { RadioDevSection } = runtime.importModule("src/dev/tools/radio_dev_section.js");
async function stageFive() {
  const gains = [];
  const service = new RadioReceiverService({ equipment: { getEquipped: () => ({}) }, power: { read: () => ({ empty: true }) },
    stations: { listStations: async () => [], listCountries: async () => [] },
    player: { play() {}, stop() {}, setVolume() {}, refreshEffects() {}, setStreamMuted() {},
      setGainScale: (value) => gains.push(value) },
    preferences: new RadioPreferencesLocalStore({ cache: { get: () => null, set() {} } }), region: { resolve: () => "UA" },
    config: () => ({ ducking: { enabled: true, duckGain: 0.25 } }), secureOnly: true,
    weather: { getSnapshot: () => ({}) }, noise: { update() {}, burst() {}, stop() {} }, rng: { next: () => 0.99 },
    scheduler: scheduler() });
  service.setBiting(true);
  assert.equal(gains.at(-1), 0.25, "a bite ducks the radio to duckGain");
  service.setBiting(false);
  assert.equal(gains.at(-1), 1, "and the bite's end brings it back");
  service.setPreference("ducking", false);
  service.setBiting(true);
  assert.equal(gains.at(-1), 1, "with «Тихіше при кльові» off a bite changes nothing");
  service.setPreference("ducking", true);
  assert.equal(gains.at(-1), 0.25, "turning it on during a bite ducks at once");
  service.setBiting(true);
  const count = gains.length;
  service.setBiting(true);
  assert.equal(gains.length, count, "an unchanged bite state writes nothing");

  // The player eases the gain scale (no click) once Web Audio runs.
  const targets = [];
  const context = { state: "running", currentTime: 4, destination: { connect() {} },
    createGain: () => ({ connect() {}, disconnect() {}, gain: { value: 1, setTargetAtTime: (v, at, c) => targets.push([v, at, c]) } }) };
  const player = new RadioStreamPlayer({ documentRef: { createElement: () => ({}) },
    audioContexts: new SharedAudioContextProvider({ windowRef: { AudioContext: function AudioContext() { return context; } } }),
    scheduler: scheduler(), config: () => ({ ducking: { rampSeconds: 0.15 } }), onState() {} });
  player.input;
  player.setVolume(0.8);
  player.setGainScale(0.25);
  assert.deepEqual([...targets.at(-1)], [0.2, 4, 0.15], "ducking eases the output gain over rampSeconds");

  // The DevTools section: status rows and discharge buttons through the given port.
  const rows = [];
  const buttons = new Map();
  const discharged = [];
  const switches = new Map();
  const ui = { createInfoRow: (label, value) => rows.push([label, value]),
    createButtonRow: (label, parent, onClick) => buttons.set(label, onClick),
    createSwitcherRow: (label, value, parent, onChange, path) => switches.set(path.join("."), { value, onChange }) };
  const radioConfig = { tickMs: 1000, effects: { vinyl: { enabled: false, wowHz: 0.5 }, walkieTalkie: { enabled: true, drive: 18 } },
    signal: { enabled: true, baseNoise: 0.01 } };
  const trees = [];
  const writes = [];
  const downloads = [];
  const section = new RadioDevSection({ ui, radio: { getStatus: () => ({ powered: true, status: "playing", station: { name: "S" },
    country: "UA", stationCount: 3, signal: 0.5 }), batteryPercent: () => 42, discharge: (target) => discharged.push(target) },
  config: () => radioConfig, createSection: (label) => ({ label, replaceChildren() {} }),
  renderConfigTree: (value, parent, path, options) => trees.push({ path: path.join("."), options }),
  setConfig: (path, value) => {
    writes.push([path.join("."), value]);
    let target = radioConfig;
    for (const part of path.slice(2, -1)) target = target[part];
    target[path.at(-1)] = value;
  },
  files: { download: (name, text) => downloads.push([name, JSON.parse(text)]), hashText: async (text) => "hash:" + text.length },
  gameVersion: "0.48.4", now: () => new Date(2026, 9, 25, 21, 5) });
  section.render({});
  assert(trees.some((tree) => tree.path === "CONFIG.radio.signal"), "the signal's interference is a sound part with its parameters");
  assert.equal(trees.find((tree) => tree.path === "CONFIG.radio").options.visibilityPolicy.isVisible(["CONFIG", "radio", "signal"]),
    false, "and is not repeated in the rest of CONFIG.radio");
  await section.exportSettings();
  assert.equal(downloads[0][0], "radio-sound-v0.48.4-20261025-2105.json", "the export file is named by version and time");
  assert.equal(downloads[0][1].format, "cyber-fishing-radio-sound");
  assert.deepEqual(downloads[0][1].settings.signal, { baseNoise: 0.01, enabled: true }, "it carries the live settings");
  assert(String(downloads[0][1].baseHash).startsWith("hash:"), "with the code's hash for the conflict check");
  assert(buttons.has("⬇ Експорт налаштувань звуку (npm run apply:radio)"), "DevTools offers the export");
  assert(rows.some(([label, value]) => label === "заряд батарейки" && value === "42.0%"));
  buttons.get("Розрядити до 5%")();
  assert.deepEqual(discharged, [5], "the DEV buttons discharge through the port");
  const treePaths = () => trees.map((tree) => tree.path);
  assert(treePaths().includes("CONFIG.radio.effects.walkieTalkie"), "an enabled effect shows its parameters");
  assert(!treePaths().includes("CONFIG.radio.effects.vinyl"), "a disabled effect hides its parameters");
  const effectTree = trees.find((tree) => tree.path === "CONFIG.radio.effects.walkieTalkie");
  assert.equal(effectTree.options.visibilityPolicy.isVisible(["CONFIG", "radio", "effects", "walkieTalkie", "enabled"]), false,
    "the enabled flag is the switch, not a parameter row");
  const rest = trees.find((tree) => tree.path === "CONFIG.radio");
  assert.equal(rest.options.visibilityPolicy.isVisible(["CONFIG", "radio", "effects"]), false, "the effects are not repeated");
  trees.length = 0;
  switches.get("RADIO.effects.vinyl.enabled").onChange(true);
  assert.deepEqual(writes, [["CONFIG.radio.effects.vinyl.enabled", true]], "the switch writes the live configuration");
  assert(treePaths().includes("CONFIG.radio.effects.vinyl"), "turning it on shows its parameters");
}

// ---- TK-098: DEV sliders for the enabled effects' main parameters ----
const { RadioEffectTuning } = runtime.importModule("src/dev/radio/radio_effect_tuning.js");
async function tuningSliders() {
  const radio = { effects: { vinyl: { enabled: true, crackleLevel: 0.12, popLevel: 0.35, hissLevel: 0.006, wowDepthMs: 1.2,
    warmthGainDb: 2.5, mix: 1 }, walkieTalkie: { enabled: false, drive: 18 } },
  signal: { enabled: false, baseNoise: 0.01, rainNoise: 0.12, maxNoise: 0.3, dropoutMax: 0.5, lowChargePercent: 25 } };
  const sets = [];
  const writeConfig = (path, value) => {
    sets.push([path.join("."), value]);
    let target = radio;
    for (const part of path.slice(2, -1)) target = target[part];
    target[path.at(-1)] = value;
  };
  const tuning = new RadioEffectTuning({ config: () => radio, configRuntime: { set: writeConfig } });
  assert.deepEqual(plain(tuning.groups()), [{ group: "vinyl", label: "Платівка", enabled: true },
    { group: "walkieTalkie", label: "Рація", enabled: false }, { group: "signal", label: "Перешкоди сигналу", enabled: false },
    { group: "onlyEffectStations", label: "Лише станції з ефектом", enabled: false }],
    "a switch per sound part: vinyl, walkie-talkie, the signal's interference");
  assert.deepEqual(plain(tuning.list()).map((entry) => entry.key),
    ["crackleLevel", "popLevel", "hissLevel", "wowDepthMs", "warmthGainDb", "mix"], "only the enabled part's main parameters");
  tuning.set("vinyl", "crackleLevel", 0.3);
  tuning.set("vinyl", "secretKey", 1);
  tuning.setEnabled("signal", true);
  assert.deepEqual(sets, [["CONFIG.radio.effects.vinyl.crackleLevel", 0.3], ["CONFIG.radio.signal.enabled", true]],
    "writes go to the live config, known keys only, the signal under CONFIG.radio.signal");
  assert(plain(tuning.list()).some((entry) => entry.effect === "signal" && entry.key === "dropoutMax"),
    "the interference's sliders appear once it is on");
  tuning.setEnabled("signal", false);

  const doc = new TestDocument();
  const dom = new InventoryDomFactory(doc, { glyphMetrics: {} });
  let listener = null;
  const status = { status: "off", powered: false, equipped: true, station: null, country: "UA", stationCount: 0, volume: 0.5,
    ducking: true, playInBackground: false };
  const port = { getStatus: () => status, subscribe: (handler) => { listener = handler; return () => {}; },
    togglePower() {}, next() {}, previous() {}, setCountry() {}, setVolume() {}, setPreference() {}, listCountries: async () => [] };
  const production = new RadioControlsRenderer({ domFactory: dom, radio: port, labels: RADIO_LABELS }).render();
  assert.equal(byClass(production, "radio-controls__tuning").length, 0, "production has no sound switches or sliders");
  const block = new RadioControlsRenderer({ domFactory: dom, radio: port, labels: RADIO_LABELS, tuning }).render();
  const switches = byClass(block, "radio-controls__tuning-switch");
  assert.deepEqual(switches.map((input) => input.checked), [true, false, false, false],
    "DEV shows the three part switches and «only stations with the effect»");
  const sliders = byClass(block, "radio-controls__slider");
  assert.equal(sliders.length, 6, "one slider per main parameter of the enabled part");
  assert.equal(sliders[0].value, "0.3");
  sliders[0].value = "0.2"; sliders[0].fire("input");
  assert.equal(radio.effects.vinyl.crackleLevel, 0.2, "a slider tunes the live parameter");
  assert.equal(byClass(block, "radio-controls__tuning-value")[0].textContent, "0.2");
  switches[0].checked = false; switches[0].fire("change");
  assert.equal(radio.effects.vinyl.enabled, false, "the window's switch turns the record off in the live config");
  assert.equal(byClass(block, "radio-controls__slider").length, 0, "and its sliders go at once");
  byClass(block, "radio-controls__tuning-switch")[2].checked = true;
  byClass(block, "radio-controls__tuning-switch")[2].fire("change");
  assert.equal(radio.signal.enabled, true, "the interference switch");
  assert.equal(byClass(block, "radio-controls__slider").length, 5, "the interference's sliders");
  radio.signal.enabled = false;
  radio.effects.walkieTalkie.enabled = true;
  listener(status);
  assert.deepEqual(byClass(block, "radio-controls__slider").map((slider) => slider.max), ["40", "6000", "1200", "1"],
    "switching the parts in DevTools changes the window on the next update");

  // TK-100: the DEV switch writes the plain flag.
  tuning.setEnabled("onlyEffectStations", true);
  assert.deepEqual(sets.at(-1), ["CONFIG.radio.onlyEffectStations", true], "«only stations with the effect» is a plain flag");
  assert(!plain(tuning.list()).some((entry) => entry.effect === "onlyEffectStations"), "with no sliders");

  // TK-100: stations remembered by whether they played with the effects; known ones first, native ones last or skipped.
  const memory = new Map();
  const memoryCache = { get: (key, fallback) => memory.has(key) ? JSON.parse(memory.get(key)) : fallback,
    set: (key, value) => memory.set(key, JSON.stringify(value)) };
  const store = new RadioPreferencesLocalStore({ cache: memoryCache });
  const played = [];
  const radioConfig = { codecs: ["MP3"], onlyEffectStations: false };
  const makeService = () => new RadioReceiverService({ equipment: { getEquipped: () => ({ radio: { instanceId: "r" },
    radioBattery: { instanceId: "b" } }) }, power: { read: () => ({ empty: false }) },
    stations: { listStations: async () => [station("a", "https://a.example/live"), station("b", "https://b.example/live"),
      station("c", "https://c.example/live")], listCountries: async () => [] },
    player: { play: (url) => played.push(url.slice(8, 9)), stop() {}, setVolume() {}, setGainScale() {}, setStreamMuted() {},
      refreshEffects() {} }, preferences: store, region: { resolve: () => "UA" }, config: () => radioConfig, secureOnly: true,
    weather: { getSnapshot: () => ({}) }, noise: { update() {}, burst() {}, stop() {} }, rng: { next: () => 0.99 },
    scheduler: scheduler() });
  let receiver = makeService();
  receiver.powerOn(); await settle();
  receiver.handlePlayerState("playing", { effects: false });
  receiver.next();
  receiver.handlePlayerState("playing", { effects: true });
  assert.deepEqual(plain(store.loadStationEffects()), { a: false, b: true }, "both outcomes are remembered");
  played.length = 0;
  store.save({ stationId: "missing" });
  receiver = makeService();
  receiver.powerOn(); await settle();
  assert.equal(played[0], "b", "a station known to play with the effects comes first");
  receiver.next(); receiver.next();
  assert.equal(played.at(-1), "a", "an untried one next, a native-only one last");
  radioConfig.onlyEffectStations = true;
  played.length = 0;
  receiver = makeService();
  receiver.powerOn(); await settle();
  assert.equal(receiver.getStatus().stationCount, 2, "with onlyEffectStations known native stations are dropped");
  receiver.next();
  receiver.handlePlayerState("playing", { effects: false });
  assert.equal(receiver.getStatus().status === "no-effect", false, "an untried station without CORS is skipped at once");
  assert.equal(store.loadStationEffects().c, false, "and remembered");
  for (let index = 0; index < 505; index += 1) store.saveStationEffect(`s${index}`, true);
  const remembered = Object.keys(store.loadStationEffects());
  assert.equal(remembered.length, 500, "the memory keeps at most 500 stations");
  assert.equal(remembered.at(-1), "s504", "the newest last, the oldest dropped");

  // TK-101: filled auxiliary wells first, so a worn radio is never behind empty ones in the scrolling block.
  const { InventoryLoadoutPanelRenderer } = runtime.importModule("src/game/presentation/inventory/inventory_loadout_panel_renderer.js");
  const panelDoc = new TestDocument();
  const panelDom = new InventoryDomFactory(panelDoc, { glyphMetrics: {} });
  const panel = new InventoryLoadoutPanelRenderer({ domFactory: panelDom, resourceMeterRenderer: { create: () => panelDom.element("div") },
    getEquippedLongPressDurationMs: () => 500, itemRenderer: { renderSlot: (slot) => {
      const well = panelDom.element("div", "well"); well.dataset.slotId = slot.slotId; return well; } } });
  const auxiliary = (slotId, item = null) => ({ slotId, item });
  const shell = panel.render({ mainSlots: [], auxiliarySlots: [auxiliary("handChum"), auxiliary("net", { id: "net" }),
    auxiliary("delivery"), auxiliary("gasMask"), auxiliary("radio", { id: "radio" })] });
  assert.deepEqual(byClass(shell, "well").map((well) => well.dataset.slotId), ["net", "radio", "handChum", "delivery", "gasMask"],
    "worn items first in slot order, empty wells after");

  // The signal model with the interference off: a clean signal.
  const clean = { ...new RadioSignalModel().read({ chargePercent: 5, isRaining: true, rainMult: 2.5 },
    { enabled: false, lowChargePercent: 25, baseNoise: 0.01, maxNoise: 0.3, rainNoise: 0.12, maxCrackle: 6, rainCrackle: 2,
      dropoutMax: 0.5, maxVolumeSag: 0.35 }) };
  assert.deepEqual([clean.quality, clean.noiseGain, clean.crackleRate, clean.dropoutChancePerSecond, clean.volumeSag],
    [1, 0, 0, 0, 0], "signal.enabled false: no hiss, crackle, dropouts or sag, even with an empty battery in the rain");
}

stageTwo().then(stageThree).then(stageFour).then(stageFive).then(tuningSliders).then(() => console.log("Radio receiver "
  + "TK-098 passed: DEV tuning lists only enabled effects, writes known keys to the live config, sliders in the editor, "
  + "rebuilt when the enabled set changes, none in production.")).then(() => console.log("Radio receiver stage 5 passed: ducking "
  + "on a bite with its switch and recovery, eased gain, the DevTools section.")).then(() => console.log("Radio receiver stage 4 passed: reception model (charge "
  + "threshold, w and w² terms, rain), 1 hour per battery at 1 unit/s without the wall clock, clamped visible steps, no "
  + "consumption when stopped in a hidden page, 65 s background steps, off at empty with silence, sag, noise, a dropout "
  + "and its end, the monotonic ticker.")).then(() => console.log("Radio receiver stage 3 and TK-097 passed: S-curve (zero, odd, "
  + "monotonic, 44100 points, peak 0.35); walkie-talkie stage (order, settings, make-up and output gain, live edits, ramped "
  + "disable, unchanged writes nothing, dispose); vinyl stage (wow/flutter on the delay, warm tone, four looped surface "
  + "sounds, live edits, density rebuilds only its buffer, disable, dispose); the chain vinyl -> walkie-talkie from the "
  + "live config; no player sound control.")).then(() => console.log("Radio receiver stage 2 passed: station filter (url_resolved, https page, HLS, codecs, "
  + "duplicates), region (language, time zone, default), mirrors and request timeout, validated preferences without power, "
  + "the service (battery gate, stations, skip, no-stations, next, no-effect, country, volume, hidden page, background, "
  + "unequip, empty battery), the stream player (context in the gesture, Web Audio for CORS, a new native element "
  + "without CORS, timeouts, cleanup), the editor controls and the HUD indicator."))
  .catch((error) => { console.error(error); process.exitCode = 1; });

console.log("Radio receiver passed: catalog item with art and 1 unit/s, its own auxiliary slot (empty in old saves), "
  + "equip, battery in its own slot found by the power port, editor with the battery socket, thumbnail charge bar "
  + "without a battery cell, save and reload, and the auxiliary wells scrolling along x in a row and y in a column.");
