"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { TestDocument } = require("./testing/keepnet/test_document");
const { SourceRuntime } = require("./testing/core/source_runtime.js");

function houseDocument() {
  const documentRef = new TestDocument();
  const simpleMatch = (node, selector) => {
    const match = selector.match(/^(?:([a-z]+))?(?:\.([\w-]+))?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/);
    if (!match) throw new Error(`Unsupported house test selector: ${selector}`);
    const [, tag, className, name, value] = match;
    return (!tag || node.tagName === tag) && (!className || node.className.split(" ").includes(className)) &&
      (!name || (name === "hidden" ? node.hidden : node.getAttribute(name) !== null && (value === undefined || node.getAttribute(name) === value)));
  };
  const matches = (node, selector) => selector.split(",").some((entry) => {
    const parts = entry.trim().split(/\s+/);
    if (!simpleMatch(node, parts.pop())) return false;
    let ancestor = node.parentNode;
    while (parts.length) {
      const previous = parts.pop();
      while (ancestor && !simpleMatch(ancestor, previous)) ancestor = ancestor.parentNode;
      if (!ancestor) return false;
      ancestor = ancestor.parentNode;
    }
    return true;
  });
  const enhance = (node) => {
    node.classList.contains = (name) => node.className.split(" ").includes(name);
    node.classList.toggle = (name, force) => {
      const enabled = force === undefined ? !node.classList.contains(name) : force;
      node.classList[enabled ? "add" : "remove"](name);
      return enabled;
    };
    node.querySelectorAll = (selector) => documentRef.all((entry) => entry !== node && matches(entry, selector), node);
    node.querySelector = (selector) => node.querySelectorAll(selector)[0] || null;
    node.closest = (selector) => { for (let current = node; current; current = current.parentNode) if (matches(current, selector)) return current; return null; };
    node.scrollTo = (options) => node.lastScrollOptions = options;
    Object.defineProperty(node, "isConnected", { get: () => documentRef.body.contains(node) });
    return node;
  };
  const create = documentRef.createElement.bind(documentRef);
  documentRef.createElement = (tag) => enhance(create(tag));
  enhance(documentRef.body);
  documentRef.querySelectorAll = (selector) => documentRef.all((node) => matches(node, selector));
  documentRef.querySelector = (selector) => documentRef.querySelectorAll(selector)[0] || null;
  const html = fs.readFileSync("fisherman-house.html", "utf8").split(/<body[^>]*>/)[1].split("</body>")[0];
  const stack = [documentRef.body];
  for (const [, close, tag, attributes] of html.matchAll(/<(\/)?([a-z][a-z0-9-]*)([^>]*)>/g)) {
    if (close) { if (stack.at(-1).tagName === tag) stack.pop(); continue; }
    const node = documentRef.createElement(tag);
    for (const [, name, value] of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
      node.setAttribute(name, value ?? "");
      if (name === "class") node.className = value;
      if (name === "hidden") node.hidden = true;
      if (name.startsWith("data-")) node.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value ?? "";
    }
    stack.at(-1).appendChild(node);
    if (!["img", "input", "link", "meta", "br"].includes(tag)) stack.push(node);
  }
  return documentRef;
}

async function checkHousePresentation(HOUSE_CONFIG) {
  const { HouseView } = await import("../src/game/presentation/house/house_view.js");
  const { HOUSE_LABELS } = await import("../src/game/presentation/house/house_labels.js");
  assert.deepEqual([0, 1, 2, 4, 5, 11, 14, 21, 22, 25, 101, 112].map(HOUSE_LABELS.fishCount), ["0 риб", "1 риба", "2 риби", "4 риби", "5 риб",
    "11 риб", "14 риб", "21 риба", "22 риби", "25 риб", "101 риба", "112 риб"], "fish counters use Ukrainian plural forms");
  const { InventoryDomFactory } = await import("../src/platform/browser/dom/inventory_dom_factory.js");
  const { InventoryResourceMeterRenderer } = await import("../src/game/presentation/inventory/inventory_resource_meter_renderer.js");
  const { DegradationColorResolver } = await import("../src/game/presentation/styles/degradation_color_resolver.js");
  const { UiSheetHandleRenderer } = await import("../src/game/presentation/ui/ui_sheet_handle_renderer.js");
  const { SheetDismissController } = await import("../src/platform/browser/dom/sheet_dismiss_controller.js");
  const { SheetHeightController } = await import("../src/platform/browser/dom/sheet_height_controller.js");
  const { UiAutoSwitchRenderer } = await import("../src/game/presentation/ui/ui_auto_switch_renderer.js");
  const documentRef = houseDocument(), domFactory = new InventoryDomFactory(documentRef);
  let degradationColors = { range: { minimum: 0, maximum: 100 }, colorStops: [
    { position: 0, color: [255, 0, 0] }, { position: 100, color: [0, 255, 0] }] };
  const colorResolver = new DegradationColorResolver({ configProvider: () => degradationColors });
  const motionPreference = { matches: false };
  const timers = new Map(); let timerId = 0;
  const frames = new Map(); let frameId = 0;
  const flushFrames = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); };
  for (const panel of documentRef.querySelectorAll("[data-house-panel]")) {
    panel.querySelector(".house__sheet-content").scrollHeight = 480;
    panel.getBoundingClientRect = () => ({ height: Number.parseFloat(panel.style.getPropertyValue("--house-sheet-height")) || 481 });
  }
  const windowTarget = { addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: id => frames.delete(id),
    getComputedStyle: () => ({ maxHeight: "690px", borderTopWidth: "1px",
      getPropertyValue: name => ["--ui-sheet-handle-size", "--house-dock-collapsed-height"].includes(name) ? "44px" : "0px" }),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
    matchMedia: () => motionPreference };
  const actions = [];
  const createView = () => new HouseView({ documentRef, windowTarget,
    sheetHeights: new SheetHeightController({ windowTarget, durationMs: HOUSE_CONFIG.ui.sheetCloseDurationMs }),
    roomConfig: HOUSE_CONFIG.room, uiConfig: HOUSE_CONFIG.ui, returnTo: "index.html",
    perform: (...args) => actions.push(args), fishView: { show() {} }, feedPicker: { update() {}, close() {}, isOpen: false },
    resourceMeters: new InventoryResourceMeterRenderer({ domFactory, degradationColorResolver: colorResolver }),
    sheetHandleRenderer: new UiSheetHandleRenderer({ domFactory, dismissController: new SheetDismissController() }),
    sheetDismissLabel: "Dismiss sheet", autoSwitchRenderer: new UiAutoSwitchRenderer({ domFactory }), timeBlendMs: 1000, labels: HOUSE_LABELS });
  const view = createView();
  const header = documentRef.querySelector("[data-house-header]"), dock = documentRef.querySelector("[data-house-dock]");
  assert.equal(header.inert, true, "House starts with both gesture zones closed");
  assert.equal(dock.inert, false, "the default compact menu keeps its three icon buttons accessible");
  const hoverButton = documentRef.querySelector('[data-house-panel-button="room"]');
  const hoverHandle = documentRef.querySelector("[data-house-dock-handle-mount]").children[0];
  documentRef.body.classList.add("ui-surface--desktop-hover");
  dock.fire("pointerover", { target: hoverHandle, pointerType: "mouse" });
  assert(!dock.classList.contains("house__dock--hovered"), "the handle cannot initiate menu hover expansion");
  let hoverWrites = 0; const dockToggle = dock.classList.toggle;
  dock.classList.toggle = (...args) => { if (args[0] === "house__dock--hovered") hoverWrites++; return dockToggle(...args); };
  for (let move = 0; move < 100; move++) dock.fire("pointerover", { target: hoverButton, pointerType: "mouse" });
  assert(dock.classList.contains("house__dock--hovered")); assert.equal(hoverWrites, 1);
  dock.fire("pointerover", { target: dock, pointerType: "mouse" });
  dock.fire("pointerover", { target: hoverHandle, pointerType: "mouse" });
  assert(dock.classList.contains("house__dock--hovered"), "moving into a gap or handle preserves the expanded container height");
  dock.fire("pointerleave"); assert(!dock.classList.contains("house__dock--hovered"));
  dock.fire("pointerover", { target: hoverButton, pointerType: "touch" });
  assert(!dock.classList.contains("house__dock--hovered"), "touch does not acquire desktop hover state");
  documentRef.body.classList.remove("ui-surface--desktop-hover");
  dock.fire("pointerover", { target: hoverButton, pointerType: "mouse" });
  assert(!dock.classList.contains("house__dock--hovered"), "disabled adapter hover policy also covers mouse use on a hybrid device");
  const background = documentRef.querySelector('[data-house-background="day"]');
  documentRef.body.fire("click", { target: background });
  assert(header.classList.contains("house__header--visible") && dock.classList.contains("house__dock--expanded"));
  documentRef.body.fire("click", { target: background });
  assert(!header.classList.contains("house__header--visible") && !dock.classList.contains("house__dock--expanded"));
  view.handleSceneGesture(30);
  assert(header.classList.contains("house__header--visible") && !dock.classList.contains("house__dock--expanded"), "down opens the header");
  view.handleSceneGesture(-30);
  assert(!header.classList.contains("house__header--visible") && !dock.classList.contains("house__dock--expanded"), "the first upward gesture only closes the header");
  view.handleSceneGesture(-30);
  assert(!header.classList.contains("house__header--visible") && dock.classList.contains("house__dock--expanded"), "up opens the section menu");
  view.handleSceneGesture(30);
  assert(!header.classList.contains("house__header--visible") && !dock.classList.contains("house__dock--expanded"), "the first downward gesture only closes the menu");
  view.handleSceneGesture(30);
  assert(header.classList.contains("house__header--visible") && !dock.classList.contains("house__dock--expanded"), "the next downward gesture opens the header");
  view.handleSceneGesture(-30); view.handleSceneGesture(-30);
  const model = { aquarium: { count: 1, capacity: 5, owned: true, level: 1, maxLevel: 2,
      feed: { name: "Feed", quantity: 1, imagePath: "feed.svg", percentage: 50 }, autoFeeder: { owned: true, enabled: false } },
    liveBaits: [{ id: "fish-1", name: "Fish", weightLabel: "1 г", location: "aquarium", locationLabel: "Акваріум",
      selected: false, actionLabel: "Обрати", timerLabel: "00:00:05", canTransfer: false }], keepnet: [], deadCount: 0,
    levelLabel: "1", upgradeLevel: 2, upgradeCapacity: 6, upgradeLabel: "Покращити", feedStock: 5, nextFeedLabel: "Feed", autoStatus: "Вручну",
    autoToggleLabel: "Увімкнути", feedTimeLabel: "00:00:05", room: { level: 1, maxLevel: 5, nextDurationMs: 7200000,
      targetLevel: null, remainingMs: 0, eveningOpacity: 0, nightOpacity: 0 } };
  const scene = documentRef.querySelector(".house__scene");
  const phaseOpacity = (phase) => scene.style.getPropertyValue(`--house-${phase}`);
  let sceneWrites = 0;
  const writeSceneProperty = scene.style.setProperty;
  scene.style.setProperty = (...args) => { sceneWrites += 1; return writeSceneProperty(...args); };
  assert.equal(scene.style.getPropertyValue("--house-time-blend-duration"), "1000ms", "the blend lasts one refresh interval");
  view.render(model);
  assert.deepEqual(["day", "evening", "night"].map(phaseOpacity), ["1", "0", "0"]);
  assert(!scene.classList.contains("house__scene--time-blend"), "the first time-of-day reading appears without a fade");
  sceneWrites = 0; view.render(model);
  assert.equal(sceneWrites, 0, "an unchanged time-of-day reading writes nothing");
  for (const [evening, night, expected] of [[.5, 0, ["1", "0.5", "0"]], [1, 0, ["0", "1", "0"]],
    [1, .25, ["0", "1", "0.25"]], [1, 1, ["0", "0", "1"]], [0, 0, ["1", "0", "0"]]]) {
    model.room.eveningOpacity = evening; model.room.nightOpacity = night; view.render(model);
    assert.deepEqual(["day", "evening", "night"].map(phaseOpacity), expected, `house layers at ${evening}/${night}`);
  }
  assert(scene.classList.contains("house__scene--time-blend"), "later readings blend through the CSS transition");
  view.render(model);
  const meter = documentRef.querySelector("[data-house-feed-meter]").children[0];
  const capacityMeter = documentRef.querySelector("[data-house-capacity-meter]").children[0];
  const levelCounter = documentRef.querySelector("[data-house-aquarium-level-count]");
  const capacityCounter = documentRef.querySelector("[data-house-capacity]");
  assert(levelCounter.parentNode.classList.contains("inventory-parameter__header"));
  assert(capacityCounter.parentNode.classList.contains("inventory-parameter__header"), "both counts share a label/header row above their meter");
  const feedButton = documentRef.querySelector("[data-house-feed-toggle]");
  assert(feedButton.parentNode.classList.contains("house__feeding-row"));
  assert(feedButton.parentNode.parentNode.classList.contains("house__upgrade-card"), "feeding replaces reserve text inside the status card");
  assert.equal(documentRef.querySelector("[data-house-feed-stock]"), null);
  assert.equal(documentRef.querySelector("[data-house-slot-count]"), null);
  assert.equal(documentRef.querySelector("[data-house-upgrade-level]").textContent, "2");
  assert.equal(documentRef.querySelector("[data-house-upgrade-capacity]").textContent, "6");
  assert.equal(capacityMeter.getAttribute("aria-valuenow"), "20");
  assert.equal(capacityMeter.style.getPropertyValue("--inventory-resource-color"), "rgb(51, 204, 0)", "occupancy color reads remaining free capacity");
  for (const [count, capacity, expected] of [[5, 5, 100], [0, 0, 0], [1, 0, 100], [20, 5, 100], [0, 5, 0]]) {
    model.aquarium.count = count; model.aquarium.capacity = capacity; view.render(model);
    assert.equal(capacityMeter.getAttribute("aria-valuenow"), String(expected));
  }
  model.aquarium.count = 1; model.aquarium.capacity = 5; view.render(model);
  let capacityWrites = 0; const capacitySet = capacityMeter.style.setProperty;
  capacityMeter.style.setProperty = (...args) => { capacityWrites++; capacitySet(...args); };
  for (let tick = 0; tick < 120; tick++) view.render(model);
  assert.equal(capacityWrites, 0, "unchanged occupancy causes no meter CSS writes");
  const upgradeButton = documentRef.querySelector('[data-house-action="upgrade"]');
  model.upgradeAffordable = false; view.render(model);
  assert(upgradeButton.disabled && upgradeButton.classList.contains("inventory-action--danger"));
  model.upgradeAffordable = true; view.render(model);
  assert(!upgradeButton.disabled && upgradeButton.classList.contains("inventory-action--primary"));
  assert.equal(meter.getAttribute("role"), "meter");
  assert.equal(meter.getAttribute("aria-valuenow"), "50");
  assert.equal(meter.style.getPropertyValue("--inventory-resource-color"), "rgb(128, 128, 0)", "feed uses the injected shared degradation colors");
  const fishRow = documentRef.byClass("house__fish")[0], fishAction = documentRef.byClass("house__fish-action")[0];
  fishAction.focus();
  const fishList = documentRef.querySelector("[data-house-live-baits]"); fishList.scrollTop = 42;
  model.liveBaits[0].timerLabel = "00:00:04";
  model.liveBaits[0].selected = true;
  model.liveBaits[0].actionLabel = "Зняти";
  degradationColors = { ...degradationColors, colorStops: [{ position: 0, color: [0, 0, 255] }, { position: 100, color: [255, 255, 255] }] };
  view.render(model);
  assert.equal(documentRef.querySelector("[data-house-feed-meter]").children[0], meter);
  assert.equal(meter.style.getPropertyValue("--inventory-resource-color"), "rgb(128, 128, 255)", "live palette edits propagate");
  assert.equal(documentRef.byClass("house__fish")[0], fishRow);
  assert.equal(documentRef.byClass("house__fish-action")[0], fishAction);
  assert.equal(documentRef.activeElement, fishAction, "numeric ticks and selection preserve keyboard focus");
  assert.equal(fishList.scrollTop, 42);
  assert.equal(fishAction.dataset.houseAction, "deselect");
  for (const [value, expected] of [[-10, 0], [140, 100], [NaN, 0]]) {
    model.aquarium.feed.percentage = value; view.render(model);
    assert.equal(meter.style.getPropertyValue("--inventory-resource-percent"), `${expected}%`);
    assert.equal(meter.getAttribute("aria-valuenow"), String(expected));
  }
  assert.equal(documentRef.byClass("ui-sheet-handle").length, 4, "the compact menu and all sheets reuse the shared tap/swipe handle");
  assert.equal(documentRef.byClass("ui-modal-close").length, 0, "House sheets have no cross buttons");
  const autoInput = documentRef.byClass("inventory-toggle__input")[0];
  autoInput.checked = true; autoInput.fire("change");
  assert.deepEqual(actions.at(-1), ["toggleAutoFeeder"]);
  model.aquarium.autoFeeder.enabled = true; view.render(model);
  assert.equal(autoInput.checked, true);
  model.feedStock = 0; view.render(model);
  assert.equal(autoInput.disabled, true, "the automatic feeder is inactive without reserve feed");
  assert.equal(autoInput.checked, false, "an empty reserve does not display an active feeder");
  const actionCountWithoutStock = actions.length;
  autoInput.fire("change"); assert.equal(actions.length, actionCountWithoutStock, "disabled shared switches do not dispatch changes");
  model.feedStock = 5; view.render(model);
  const roomButton = documentRef.querySelector('[data-house-panel-button="room"]');
  roomButton.focus(); documentRef.body.fire("click", { target: roomButton });
  const roomPanel = documentRef.querySelector('[data-house-panel="room"]');
  assert.equal(roomPanel.hidden, false);
  assert(dock.classList.contains("house__dock--panel-open"), "opening a section collapses the other labels to miniature icons");
  assert.equal(documentRef.querySelector("[data-house-dock-handle-mount]").hidden, true, "an open sheet has one visible top handle");
  assert.equal(roomPanel.getAttribute("aria-modal"), "false", "the visible dock remains accessible");
  assert.equal(documentRef.activeElement, roomPanel.querySelector(".ui-sheet-handle"));
  documentRef.body.fire("keydown", { key: "Escape" });
  assert(roomPanel.classList.contains("house__sheet--closing"), "dismissal animates the sheet downward");
  flushFrames(); for (const callback of [...timers.values()]) callback(); timers.clear();
  assert.equal(roomPanel.hidden, true);
  assert.equal(documentRef.activeElement, roomButton);
  assert(!dock.classList.contains("house__dock--expanded") && !dock.classList.contains("house__dock--panel-open"));
  view.handleSceneGesture(-30);
  assert(dock.classList.contains("house__dock--expanded"), "one upward gesture expands all three names without a sheet");
  assert.equal(documentRef.querySelector("[data-house-scrim]").hidden, true);
  const aquariumButton = documentRef.querySelector('[data-house-panel-button="aquarium"]');
  const baitButton = documentRef.querySelector('[data-house-panel-button="bait"]');
  documentRef.body.fire("click", { target: aquariumButton });
  const aquariumPanel = documentRef.querySelector('[data-house-panel="aquarium"]');
  assert.equal(aquariumPanel.hidden, false);
  documentRef.body.fire("click", { target: baitButton });
  assert.equal(aquariumPanel.hidden, true);
  assert.equal(documentRef.querySelector('[data-house-panel="bait"]').hidden, false, "a miniature changes sections directly");
  assert.equal(documentRef.byClass("house__dock-button--selected").length, 1, "exactly the active section is highlighted");
  view.handleSceneGesture(30);
  assert(documentRef.querySelector('[data-house-panel="bait"]').classList.contains("house__sheet--closing"), "down on the backdrop closes the active sheet");
  flushFrames(); for (const callback of [...timers.values()]) callback(); timers.clear();
  assert.equal(documentRef.querySelector("[data-house-scrim]").hidden, true);
  assert.equal(dock.inert, false, "closing leaves the compact navigation accessible");
  const menuHandle = documentRef.querySelector("[data-house-dock-handle-mount]").children[0];
  menuHandle.fire("click", { detail: 0 }); assert(dock.classList.contains("house__dock--expanded"));
  menuHandle.fire("click", { detail: 0 }); assert(!dock.classList.contains("house__dock--expanded"));
  const roomTrack = documentRef.querySelector("[data-house-room-track]");
  assert.equal(roomTrack.lastScrollOptions.behavior, "smooth");
  motionPreference.matches = true;
  roomTrack.fire("keydown", { key: "ArrowRight" });
  assert.equal(roomTrack.lastScrollOptions.behavior, "auto", "room scrolling respects reduced motion");
  model.aquarium.feed = null; view.render(model);
  assert.equal(documentRef.querySelector("[data-house-feed-bar]").hidden, true);
  view.dispose();
  assert.equal(dock.listeners.get("pointerover").size, 0); assert.equal(dock.listeners.get("pointerleave").size, 0);
  assert.equal(documentRef.body.listeners.get("keydown").size, 0);
  assert.equal(documentRef.byClass("ui-sheet-handle").length, 0);
  assert.equal(documentRef.byClass("inventory-toggle").length, 0);
  assert.equal(documentRef.byClass("inventory-resource-meter").length, 0);
  assert.equal(documentRef.byClass("house__fish").length, 0);
  model.aquarium.feed = { name: "Feed", quantity: 1, imagePath: "feed.svg", percentage: 50 };
  const remounted = createView(); remounted.render(model);
  assert.equal(dock.listeners.get("pointerover").size, 1); assert.equal(dock.listeners.get("pointerleave").size, 1);
  assert.equal(documentRef.byClass("ui-sheet-handle").length, 4, "remount creates one handle for the compact menu and each sheet");
  assert.equal(documentRef.byClass("inventory-toggle").length, 1);
  assert.equal(documentRef.byClass("inventory-resource-meter").length, 2);
  assert.equal(documentRef.byClass("house__fish").length, 1);
  assert.equal(documentRef.body.listeners.get("click").size, 1);
  assert.equal(documentRef.body.listeners.get("keydown").size, 1);
  const actionCount = actions.length;
  documentRef.byClass("inventory-toggle__input")[0].fire("change");
  assert.equal(actions.length, actionCount + 1, "a remounted switch performs exactly once");
  remounted.dispose();
  const { HousePresenter } = await import("../src/game/presentation/house/house_presenter.js");
  let funds = 2, presented;
  const pricedState = { ...model, aquarium: { ...model.aquarium, level: 5, maxLevel: 10, capacity: 16, nextUpgradeCapacity: 18 },
    feedItems: [], prices: { upgrade: 5 } };
  const presenter = new HousePresenter({ liveBait: { getView: () => pricedState }, room: { getView: () => model.room },
    gameTime: { getHours: () => 12 }, labels: HOUSE_LABELS, getAvailableFunds: () => funds,
    view: { render: next => presented = next } });
  presenter.refresh(); assert.equal(presented.upgradeLabel, "Рівень 6 · Місткість 18");
  assert.equal(presented.upgradeLevel, 6); assert.equal(presented.upgradeCapacity, 18);
  assert.equal(presented.upgradeAffordable, false);
  funds = 5; presenter.refresh(); assert.equal(presented.upgradeAffordable, true);
  assert.equal(presented.canAutoFeed, false, "auto availability follows the selected feed's authoritative reserve");
}

async function checkSharedTimeOfDayLayers() {
  const { timeOfDayLayers } = await import("../src/game/presentation/time/time_of_day_layers.js");
  const { WorldRenderFrameBuilder } = await import("../src/game/presentation/rendering/world_render_frame_builder.js");
  const data = { loaded: true, dynamic: true, width: 10, height: 5, eveningOpacity: 0, nightOpacity: 0,
    assetIds: { day: "day", evening: "evening", night: "night" } };
  const builder = new WorldRenderFrameBuilder({ map: { getBackgroundRenderData: () => data },
    projector: { virtualToScreen: (x, y, out) => { out.x = x; out.y = y; return out; }, getScale: () => 1 },
    config: { canvas: {}, locations: {} }, canvasMetrics: { width: 10, height: 5 }, boatChumBuilder: { buildInto() {} }, locationId: "test" });
  const layers = { base: "", overlay: null, overlayOpacity: 0 };
  // The Canvas location and the House DOM compose the same phases: an opaque base and at most one blend.
  for (const [evening, night, expected] of [[0, 0, "day:1"], [.5, 0, "day:1 evening:0.5"], [1, 0, "evening:1"],
    [1, .25, "evening:1 night:0.25"], [1, 1, "night:1"]]) {
    timeOfDayLayers(evening, night, layers);
    assert.equal([`${layers.base}:1`, layers.overlay && `${layers.overlay}:${layers.overlayOpacity}`].filter(Boolean).join(" "), expected);
    const records = [];
    data.eveningOpacity = evening; data.nightOpacity = night;
    builder.buildInto({ target: { backgroundLayers: { acquire: () => { const record = {}; records.push(record); return record; } },
      clipRegions: {}, invalidCastMarker: {} }, invalidCastMarker: null, debugEnabled: false });
    assert.equal(records.map((record) => `${record.assetId}:${record.alpha}`).join(" "), expected, `map layers at ${evening}/${night}`);
  }
}

function checkHouseConfigUpdates() {
  const recorder = () => class {
    constructor(options) {
      this.options = options;
      return new Proxy(this, { get: (target, key) => key in target ? target[key] : () => () => {} });
    }
  };
  const listeners = new Map();
  const listen = (type, callback) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); };
  const unlisten = (type, callback) => listeners.get(type)?.delete(callback);
  const node = () => ({ classList: { add() {}, toggle() {} }, appendChild() {}, scrollWidth: 0, clientWidth: 0 });
  const documentTarget = { body: { children: [], appendChild() {} }, querySelector: node, querySelectorAll: () => [],
    addEventListener: listen, removeEventListener: unlisten };
  const windowTarget = { URLSearchParams, location: { search: "", origin: "https://game.example" }, localStorage: {},
    setInterval: () => 1, clearInterval() {}, addEventListener() {}, removeEventListener() {} };
  windowTarget.parent = windowTarget;
  const visualUpdates = [];
  const liveConfig = { liveBait: { visual: { gridSizePx: 10 }, careTickMs: 10000, displayTickMs: 1000 },
    input: { pointerThreshold: 10, mapPan: {} }, debug: {} };
  const stub = (name) => ({ [name]: recorder() });
  const runtime = new SourceRuntime({ moduleStubs: {
    "src/platform/browser/runtime/browser_startup_environment.js": { getBrowserStartupEnvironment: () => ({ documentTarget, windowTarget }) },
    "src/game/config/runtime/game_config.js": { CONFIG: liveConfig },
    "src/bootstrap/production/live_bait_composition.js": { composeLiveBait: () => ({ advance() {} }) },
    "src/bootstrap/production/game_time_composition.js": { composeGameTime: () => ({ getHours: () => 12, sync() {} }) },
    "src/platform/browser/ui/embedded_page_overlay.js": { EMBEDDED_PAGE_RETURN_MESSAGE: "return" },
    "src/game/presentation/house/aquarium_fish_view.js": { AquariumFishView: class {
      setConfig(config) { visualUpdates.push(config); return true; } dispose() {} } },
    "src/platform/browser/dom/ui_surface_adapter.js": { UiSurfaceAdapter: class { mountRoot = { appendChild() {} }; dispose() {} } },
    "src/platform/browser/dom/horizontal_scroll_controller.js": { HorizontalScrollController: class { attach() { return () => {}; } } },
    ...Object.fromEntries([
      ["src/platform/browser/time/browser_wall_clock.js", "BrowserWallClock"], ["src/game/presentation/house/house_presenter.js", "HousePresenter"],
      ["src/game/presentation/house/house_view.js", "HouseView"], ["src/game/application/house/room_upgrade_service.js", "RoomUpgradeService"],
      ["src/platform/browser/storage/room_progress_local_store.js", "RoomProgressLocalStore"], ["src/platform/browser/ui/time_display.js", "TimeDisplay"],
      ["src/game/presentation/house/aquarium_fish_motion.js", "AquariumFishMotion"], ["src/game/presentation/house/aquarium_feed_picker.js", "AquariumFeedPicker"],
      ["src/platform/browser/dom/inventory_dom_factory.js", "InventoryDomFactory"],
      ["src/game/presentation/inventory/inventory_resource_meter_renderer.js", "InventoryResourceMeterRenderer"],
      ["src/game/presentation/styles/degradation_color_resolver.js", "DegradationColorResolver"],
      ["src/game/presentation/ui/ui_auto_switch_renderer.js", "UiAutoSwitchRenderer"], ["src/game/presentation/ui/ui_sheet_handle_renderer.js", "UiSheetHandleRenderer"],
      ["src/platform/browser/dom/sheet_dismiss_controller.js", "SheetDismissController"], ["src/platform/browser/dom/sheet_height_controller.js", "SheetHeightController"],
      ["src/platform/browser/dom/hud_row_sizer.js", "HudRowSizer"], ["src/platform/browser/ui/fullscreen_control.js", "FullscreenControl"],
    ].map(([path, name]) => [path, stub(name)])),
  } });
  const { startFishermanHouse } = runtime.importModule("src/bootstrap/production/house_startup.js");
  const house = startFishermanHouse();
  const emit = (path) => { for (const callback of [...listeners.get("config-updated") || []]) callback({ detail: { path } }); };
  emit(["CONFIG", "liveBait", "visual", "showZone"]);
  assert.equal(visualUpdates.at(-1), liveConfig.liveBait.visual, "a DEV edit reaches the aquarium motion");
  liveConfig.liveBait.visual = { gridSizePx: 20 };
  emit(["CONFIG", "liveBait", "visual", "gridSizePx"]);
  assert.equal(visualUpdates.at(-1).gridSizePx, 20, "the motion reads the live resolved settings, not the startup snapshot");
  emit(["CONFIG"]); emit(["CONFIG", "liveBait"]);
  assert.equal(visualUpdates.length, 4, "reset/import of the whole config or liveBait also reapplies the visual settings");
  emit(["CONFIG", "liveBait", "careTickMs"]); emit(["CONFIG", "debug", "timeScale"]); emit(["ITEM_DB", "rods"]);
  assert.equal(visualUpdates.length, 4, "unrelated edits leave the swimming fish unchanged");
  house.dispose();
  assert.equal(listeners.get("config-updated").size, 0, "disposal removes the config listener");
}

async function checkAquariumCanvasResize() {
  const { AquariumFishView } = await import("../src/game/presentation/house/aquarium_fish_view.js");
  let rect = { width: 200, height: 100 }, writes = 0, transforms = 0, bounds = 0, resize;
  const size = { width: 300, height: 150 };
  const canvas = { getBoundingClientRect: () => rect, getContext: () => ({ setTransform() { transforms++; } }) };
  for (const key of ["width", "height"]) Object.defineProperty(canvas, key, { get: () => size[key], set: value => { writes++; size[key] = value; } });
  const view = new AquariumFishView({ canvas, windowTarget: { devicePixelRatio: 2 }, motion: { setBounds() { bounds++; } },
    createImage: () => ({}), observeResize: (target, callback) => { resize = callback; return { disconnect() {} }; }, style: {} });
  assert.deepEqual([size.width, size.height, writes, transforms, bounds], [400, 200, 2, 1, 1]);
  for (let index = 0; index < 100; index++) resize();
  assert.deepEqual([writes, transforms, bounds], [2, 1, 1], "unchanged observer deliveries never reset the aquarium bitmap");
  rect = { width: 210, height: 100 }; resize();
  assert.deepEqual([size.width, writes, bounds], [420, 4, 2], "a changed size resizes once");
  view.dispose();
}

async function main() {
  await checkAquariumCanvasResize();
  checkHouseConfigUpdates();
  await checkSharedTimeOfDayLayers();
  const { HOUSE_CONFIG } = await import("../src/game/config/raw/house/house_config.js");
  const { RoomUpgradeService } = await import("../src/game/application/house/room_upgrade_service.js");
  const { RoomProgressLocalStore } = await import("../src/platform/browser/storage/room_progress_local_store.js");
  const { composeGameTime } = await import("../src/bootstrap/production/game_time_composition.js");
  const { backgroundTimeBlend } = await import("../src/game/domain/time/background_time_blend.js");
  const { EnvironmentSystem } = await import("../src/game/application/world/environment_system.js");
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let now = 1000000;
  const nowFn = () => now;
  const clock = composeGameTime({ storage, now: nowFn, initialHours: 12, timeScale: 240 });
  assert.equal(clock.getHours(), 12);
  now += 60000;
  assert.equal(clock.getHours(), 16);
  assert.equal(composeGameTime({ storage, now: nowFn, initialHours: 3, timeScale: 1 }).getHours(), 16,
    "the house and location read the same persisted clock");
  now += 90000;
  assert.equal(clock.getHours(), 22);
  const blend = { evening: -1, night: -1 };
  assert.deepEqual(backgroundTimeBlend(12, blend), { evening: 0, night: 0 });
  assert.deepEqual(backgroundTimeBlend(18, blend), { evening: .5, night: 0 });
  assert.deepEqual(backgroundTimeBlend(20, blend), { evening: 1, night: .5 });
  assert.deepEqual(backgroundTimeBlend(22, blend), { evening: 1, night: 1 });
  assert.deepEqual(backgroundTimeBlend(6, blend), { evening: 1, night: .5 });
  assert.deepEqual(backgroundTimeBlend(8, blend), { evening: .5, night: 0 });
  const houseClock = composeGameTime({ storage, now: nowFn, initialHours: 12, timeScale: 240 });
  const env = new EnvironmentSystem({ weather: { chances: { rain: 0, fog: 0 }, updateIntervalMs: 1000 },
    environment: {} }, 12, { chance: () => false }, { timePhases: { day: { startHour: 9, endHour: 21 },
      night: { startHour: 21, endHour: 9 } } }, clock);
  env.update(16, 1);
  assert.equal(env.getSnapshot().time, 22, "world environment reads the shared clock");
  now += 3600000;
  houseClock.sync();
  assert.equal(houseClock.getHours(), 23, "a live time-scale edit propagates to the house clock");

  for (let level = 1; level <= HOUSE_CONFIG.room.maxLevel; level++) {
    const art = HOUSE_CONFIG.room.backgrounds[level];
    for (const phase of ["day", "evening", "night"]) assert(fs.existsSync(art[phase]), art[phase]);
  }
  assert(fs.existsSync(HOUSE_CONFIG.room.aquariumImage));
  assert(fs.existsSync(HOUSE_CONFIG.room.renovationImage));
  const store = new RoomProgressLocalStore(storage);
  let room = new RoomUpgradeService({ config: HOUSE_CONFIG.room, store, now: nowFn });
  assert.equal(room.getView().level, 1);
  const durations = [2, 8, 16, 48];
  for (let level = 2; level <= 5; level++) {
    assert.equal(room.start().ok, true);
    assert.equal(room.getView().targetLevel, level);
    assert.equal(room.start().reason, "already_upgrading");
    room = new RoomUpgradeService({ config: HOUSE_CONFIG.room, store, now: nowFn });
    assert.equal(room.getView().targetLevel, level, "renovation survives reload");
    assert.equal(room.getView().remainingMs, durations[level - 2] * 3600000);
    if (level % 2 === 0) {
      assert.equal(room.finish().ok, true, "free completion works");
    } else {
      now += durations[level - 2] * 3600000;
      assert.equal(room.getView().level, level, "elapsed renovation completes automatically");
    }
    assert.equal(room.getView().level, level);
    assert.equal(room.getView().targetLevel, null);
  }
  assert.equal(room.start().reason, "max_level");
  values.set("cyber_fishing_room_1_v1", "{bad");
  assert.equal(new RoomUpgradeService({ config: HOUSE_CONFIG.room, store, now: nowFn }).getView().level, 1);
  await checkHousePresentation(HOUSE_CONFIG);
  console.log("House passed: shared time/art/upgrades, shared feed colors and clamping, stable rows/focus, shared close/switch and sheet keyboard lifecycle.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
