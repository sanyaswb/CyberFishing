"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { readHouseMarkup } = require("../../testing/core/house_markup_source");
const path = require("node:path");
const { TestDocument } = require("../../testing/keepnet/test_document");

async function main() {
  const { UiCatalogDocumentScope } = await import("../../../src/dev/ui_catalog/ui_catalog_document_scope.js");
  const svg = {};
  const svgScope = new UiCatalogDocumentScope({ documentRef: { createElementNS(namespace, tag) {
    assert.equal(namespace, "http://www.w3.org/2000/svg"); assert.equal(tag, "svg"); return svg;
  } }, root: {}, windowTarget: {} });
  assert.equal(svgScope.createElementNS("http://www.w3.org/2000/svg", "svg"), svg,
    "the preview document forwards native namespace creation for production section icons");
  const { UiCatalogPage } = await import("../../../src/dev/ui_catalog/ui_catalog_page.js");
  const navigationDocument = new TestDocument();
  const returnLink = navigationDocument.createElement("a");
  returnLink.href = "dev.html";
  const navigationMount = navigationDocument.createElement("main");
  let returns = 0;
  const embeddedPage = new UiCatalogPage({ documentRef: navigationDocument, mountNode: navigationMount,
    definitions: [], returnLink, onReturn: () => returns++ });
  await embeddedPage.mount();
  assert.equal(returnLink.fire("click").prevented, true, "Embedded return must preserve the current DEV game document");
  assert.equal(returns, 1);
  embeddedPage.dispose(); embeddedPage.dispose();
  returnLink.fire("click");
  assert.equal(returns, 1, "Disposed catalog removes its return handler");
  const standalonePage = new UiCatalogPage({ documentRef: navigationDocument, mountNode: navigationMount,
    definitions: [], returnLink });
  assert.equal(returnLink.fire("click").prevented, false, "Standalone catalog uses the normal dev.html link");
  standalonePage.dispose();
  const imports = await Promise.all([
    import("../../../src/dev/ui_catalog/ui_catalog_definitions.js"),
    import("../../../src/dev/ui_catalog/ui_catalog_frame_scheduler.js"),
    import("../../../src/dev/ui_catalog/ui_catalog_inventory_fixture.js"),
    import("../../../src/dev/ui_catalog/ui_catalog_keepnet_fixture.js"),
    import("../../../src/dev/ui_catalog/ui_catalog_meters_example.js"),
    import("../../../src/game/presentation/inventory/inventory_action_type.js"),
    import("../../../src/game/presentation/inventory/inventory_resource_meter_renderer.js"),
    import("../../../src/game/presentation/inventory/inventory_resource_meter_resolver.js"),
    import("../../../src/game/presentation/styles/degradation_color_resolver.js"),
    import("../../../src/game/presentation/visual/degradation_color_config.js"),
    import("../../../src/game/presentation/keepnet/keepnet_view_model.js"),
    import("../../../src/platform/browser/dom/inventory_dom_factory.js"),
  ]);
  const [{ UI_CATALOG_DEFINITIONS }, { UiCatalogFrameScheduler }, { UiCatalogInventoryFixture },
    { UiCatalogKeepnetFixture }, { UiCatalogMetersExample }, { InventoryActionType }, { InventoryResourceMeterRenderer },
    { InventoryResourceMeterResolver }, { DegradationColorResolver }, { DEGRADATION_COLOR_CONFIG }, { KeepnetViewModel }, { InventoryDomFactory }] = imports;
  const families = new Set(UI_CATALOG_DEFINITIONS.flatMap((definition) => definition.families));
  for (const family of ["buttons", "icons", "switches", "meters", "indicators", "fields", "filters", "sorting", "slots", "cards", "dialogs", "tabs", "action-groups", "tooltips", "messages", "confirmations", "hud", "canvas", "inventory", "keepnet", "house", "aquarium"]) {
    assert(families.has(family), `FR-002 family missing: ${family}`);
  }
  assert.equal(new Set(UI_CATALOG_DEFINITIONS.map(({ id }) => id)).size, UI_CATALOG_DEFINITIONS.length);
  for (const definition of UI_CATALOG_DEFINITIONS) {
    assert(definition.states.some(([id]) => id === "normal"), definition.id);
    assert(definition.contract && definition.description, definition.id);
    for (const source of [...definition.sources, ...definition.styles]) assert(fs.existsSync(source), `${definition.id}: missing owner ${source}`);
  }
  const page = fs.readFileSync("ui-catalog.html", "utf8");
  assert(page.includes('id="uiCatalogReturn" href="dev.html"'), "catalog has an accessible return to DevTools");
  assert.equal((page.match(/<script\b/g) || []).length, 1);
  assert(page.includes('type="module" src="src/entrypoints/dev/ui_catalog.entry.js'));
  const bootstrap = fs.readFileSync("src/bootstrap/development/ui_catalog_bootstrap.js", "utf8");
  assert(!/localStorage|sessionStorage|setInterval|start(?:Game|DevelopmentGame|FishermanHouse)|composeLiveBait|RoomProgressLocalStore/.test(bootstrap), "catalog composition must not open storage/game/care services");
  assert(bootstrap.includes("root.innerHTML = HOUSE_SCREEN_MARKUP") && !bootstrap.includes("fisherman-house"),
    "house reuses the screen markup module without production composition (spec 084)");
  assert(bootstrap.includes("composeHouseView(") && bootstrap.includes("new AquariumFishView(") && bootstrap.includes("new AquariumFeedPicker("), "actual house views are exercised");
  for (const file of fs.readdirSync("src/dev/ui_catalog")) {
    const source = fs.readFileSync(path.join("src/dev/ui_catalog", file), "utf8");
    assert(!/localStorage|sessionStorage|setInterval/.test(source), `isolated example: ${file}`);
  }

  const scheduler = new UiCatalogFrameScheduler({ windowTarget: { devicePixelRatio: 2 } });
  let frames = 0;
  const tick = () => { frames++; scheduler.requestAnimationFrame(tick); };
  scheduler.requestAnimationFrame(tick);
  scheduler.flush();
  assert.equal(frames, 1, "recursive Aquarium frame remains queued, never loops");
  scheduler.flush(20);
  assert.equal(frames, 2, "only an explicit fixture event advances one frame");
  scheduler.dispose(); scheduler.flush(); assert.equal(frames, 2, "disposing releases queued frame");

  const rarityVisualResolver = { resolve: ({ tier }) => ({ cssColor: `rgb(${tier}, 0, 0)` }) };
  const inventory = new UiCatalogInventoryFixture({ actionTypes: InventoryActionType, rarityVisualResolver });
  const otherInventory = new UiCatalogInventoryFixture({ actionTypes: InventoryActionType, rarityVisualResolver });
  const item = inventory.getViewModel().inventory.items[0];
  inventory.setValue(1);
  assert.equal(inventory.getViewModel().inventory.items[0], item, "numeric fixture update preserves authoritative item identity");
  assert.equal(item.charge.percent, 1);
  assert.equal(otherInventory.getViewModel().inventory.items[0].charge.percent, 67, "fixture instances are isolated");
  inventory.dispatch({ type: InventoryActionType.AUTO_BAIT_CHANGE, enabled: false });
  assert.equal(inventory.getViewModel().settings.autoBait, false);
  assert.equal(otherInventory.getViewModel().settings.autoBait, true);
  inventory.reset("locked");
  assert(inventory.getViewModel().panel.loadout.mainSlots.some((slot) => slot.state === "locked"));
  inventory.reset("error");
  assert(inventory.dispatch({ type: InventoryActionType.CATEGORY_SELECT, categoryId: "bait" }).warning);
  inventory.reset("empty"); assert.equal(inventory.getViewModel().inventory.items.length, 0);

  const fixture = new UiCatalogKeepnetFixture();
  const otherKeepnet = new UiCatalogKeepnetFixture();
  const projection = new KeepnetViewModel();
  fixture.reset("reserved");
  const raw = fixture.getView();
  const complete = projection.build(raw);
  const filtered = projection.build(raw, { kind: "live_bait" });
  assert.equal(complete.count, 4);
  assert.equal(complete.reservedCount, 1);
  assert.equal(complete.capacityPercent, 5);
  assert.equal(filtered.capacityPercent, complete.capacityPercent, "filters do not change authoritative occupancy");
  const live = raw.liveBaits[0]; fixture.setValue(1);
  assert.equal(raw.liveBaits[0], live); assert.equal(live.remainingMs, 1000);
  fixture.releaseCatch(raw.keepnet[0].id); assert.equal(otherKeepnet.getView().keepnet.length, 3);
  fixture.reset("zero"); assert.equal(projection.build(fixture.getView()).capacityPercent, 100);
  fixture.reset("over"); assert.equal(projection.build(fixture.getView()).capacityPercent, 100);
  fixture.reset("empty"); assert.equal(projection.build(fixture.getView()).capacityPercent, 0);

  const documentRef = new TestDocument();
  const dom = new InventoryDomFactory(documentRef);
  const colors = new DegradationColorResolver({ configProvider: () => DEGRADATION_COLOR_CONFIG });
  const resourceMeterRenderer = new InventoryResourceMeterRenderer({ domFactory: dom, degradationColorResolver: colors });
  const resourceMeterResolver = new InventoryResourceMeterResolver();
  const host = dom.element("div");
  const example = new UiCatalogMetersExample({ domFactory: dom, resourceMeterRenderer, resourceMeterResolver, surface: { mountRoot: host }, status: dom.element("p") });
  example.setState("normal");
  for (const row of host.children) {
    const [, resource, condition, occupancy] = row.children;
    const color = resource.style.getPropertyValue("--inventory-resource-color");
    assert.equal(condition.style.getPropertyValue("--inventory-resource-color"), color);
    assert.equal(occupancy.style.getPropertyValue("--inventory-resource-color"), color, "same remaining resource/free capacity uses one production palette");
  }
  const last = host.children.at(-1); const resourceNode = last.children[1];
  example.setValue(-10);
  assert.equal(last.children[1], resourceNode, "reading update keeps production meter node");
  assert.equal(resourceNode.getAttribute("aria-valuenow"), "0");
  example.setValue(110); assert.equal(resourceNode.getAttribute("aria-valuenow"), "100");
  example.setState("missing"); assert(resourceNode.hidden, "missing reading is visibly unavailable");
  example.dispose(); assert.equal(host.children.length, 0);

  await checkHouseExample();

  // Importing the entry's composition is side-effect-free until startUiCatalog.
  await import("../../../src/bootstrap/development/ui_catalog_bootstrap.js");
  console.log("UI catalog passed: FR-002 coverage, production source/style reuse, isolated fixtures, reserved capacity, shared boundary colors, node identity, controlled frames and disposal.");
}

// Parse the actual production shell into the existing deterministic DOM double.
// The test never maintains a second house template or starts a browser session.
function productionHouseDocument() {
  const documentRef = new TestDocument();
  const create = documentRef.createElement.bind(documentRef);
  const match = (node, selector) => {
    if (selector.startsWith(".")) return node.classList.contains(selector.slice(1));
    const attribute = selector.match(/^(?:([a-z]+))?\[([^=\]]+)(?:="([^"]*)")?\]$/i);
    if (attribute) {
      const value = attribute[2] === "hidden" ? node.hidden ? "" : null : node.getAttribute(attribute[2]);
      return (!attribute[1] || node.tagName.toLowerCase() === attribute[1]) && value !== null &&
        (attribute[3] === undefined || value === attribute[3]);
    }
    return node.tagName.toLowerCase() === selector.toLowerCase();
  };
  const select = (root, selector) => {
    const alternatives = selector.split(",").map((part) => part.trim().split(/\s+/));
    return documentRef.all((node) => node !== root && alternatives.some((parts) => {
      if (!match(node, parts.at(-1))) return false;
      let ancestor = node.parentNode;
      for (let index = parts.length - 2; index >= 0; index--) {
        while (ancestor && !match(ancestor, parts[index])) ancestor = ancestor.parentNode;
        if (!ancestor) return false;
        ancestor = ancestor.parentNode;
      }
      return true;
    }), root);
  };
  const enhance = (node) => {
    Object.defineProperty(node, "isConnected", { get: () => documentRef.body.contains(node) });
    node.querySelectorAll = (selector) => select(node, selector);
    node.querySelector = (selector) => select(node, selector)[0] || null;
    node.closest = (selector) => {
      for (let current = node; current; current = current.parentNode) if (match(current, selector)) return current;
      return null;
    };
    node.scrollTo = ({ left }) => { node.scrollLeft = left; };
    node.offsetLeft = 0;
    node.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 180, right: 320, bottom: 180 });
    if (node.tagName.toLowerCase() === "canvas") {
      const context = {};
      for (const method of ["setTransform", "clearRect", "fillRect", "strokeRect", "save", "restore", "beginPath", "moveTo", "lineTo", "stroke", "rect", "clip", "translate", "scale", "drawImage", "ellipse", "fill"]) context[method] = () => {};
      node.getContext = () => context;
    }
    return node;
  };
  enhance(documentRef.body);
  documentRef.createElement = (tag) => enhance(create(tag.toUpperCase()));
  documentRef.querySelector = (selector) => documentRef.body.querySelector(selector);
  documentRef.querySelectorAll = (selector) => documentRef.body.querySelectorAll(selector);
  const source = readHouseMarkup();
  const stack = [documentRef.body];
  const voidTags = new Set(["img", "input", "br", "hr", "meta", "link"]);
  for (const token of source.matchAll(/<\/?[a-z][^>]*>/gi)) {
    if (token[0].startsWith("</")) { stack.pop(); continue; }
    const [, tag, attributeSource] = token[0].match(/^<([a-z][a-z0-9-]*)([^>]*)>/i);
    if (tag === "script") { stack.push(create("script")); continue; }
    const node = documentRef.createElement(tag);
    for (const [, name, value = ""] of attributeSource.matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)) {
      node.setAttribute(name, value);
      if (name === "class") node.className = value;
      else if (name === "hidden") node.hidden = true;
      else if (name.startsWith("data-")) node.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    stack.at(-1).append(node);
    if (!voidTags.has(tag) && !token[0].endsWith("/>")) stack.push(node);
  }
  return documentRef;
}

async function checkHouseExample() {
  const [{ composeHouseView }, { AquariumFeedPicker }, { AquariumFishView }, { AquariumFishMotion }, { UiCatalogHouseExample },
    { UiCatalogFrameScheduler }, { InventoryResourceMeterRenderer }, { InventoryDomFactory }, { UiCloseButtonRenderer },
    { UiAutoSwitchRenderer }, { DegradationColorResolver }, { DEGRADATION_COLOR_CONFIG }, { HOUSE_CONFIG }, { HOUSE_LABELS },
    { CONFIG }, { TimeDisplay }, { isUsableAquariumVisual }, { AQUARIUM_FISH_VIEW_STYLE }] = await Promise.all([
    import("../../../src/bootstrap/production/house_view_composition.js"), import("../../../src/game/presentation/house/aquarium_feed_picker.js"),
    import("../../../src/game/presentation/house/aquarium_fish_view.js"), import("../../../src/game/presentation/house/aquarium_fish_motion.js"),
    import("../../../src/dev/ui_catalog/ui_catalog_house_example.js"), import("../../../src/dev/ui_catalog/ui_catalog_frame_scheduler.js"),
    import("../../../src/game/presentation/inventory/inventory_resource_meter_renderer.js"), import("../../../src/platform/browser/dom/inventory_dom_factory.js"),
    import("../../../src/game/presentation/ui/ui_close_button_renderer.js"), import("../../../src/game/presentation/ui/ui_auto_switch_renderer.js"),
    import("../../../src/game/presentation/styles/degradation_color_resolver.js"), import("../../../src/game/presentation/visual/degradation_color_config.js"),
    import("../../../src/game/config/raw/house/house_config.js"), import("../../../src/game/presentation/house/house_labels.js"),
    import("../../../src/game/config/runtime/game_config.js"), import("../../../src/platform/browser/ui/time_display.js"),
    import("../../../src/game/config/validation/aquarium_visual_issues.js"), import("../../../src/game/presentation/house/aquarium_fish_view_style.js")]);
  const documentRef = productionHouseDocument();
  const dom = new InventoryDomFactory(documentRef);
  const listeners = new Map(), timers = new Map(); let timerId = 0, disconnected = 0;
  const sheetFrames = new Map(); let sheetFrameId = 0;
  for (const panel of documentRef.querySelectorAll("[data-house-panel]")) {
    panel.querySelector(".house__sheet-content").scrollHeight = 480;
    panel.getBoundingClientRect = () => ({ height: Number.parseFloat(panel.style.getPropertyValue("--house-sheet-height")) || 481 });
  }
  const windowTarget = { devicePixelRatio: 1, scrollY: 0,
    requestAnimationFrame: callback => { sheetFrames.set(++sheetFrameId, callback); return sheetFrameId; },
    cancelAnimationFrame: id => sheetFrames.delete(id),
    getComputedStyle: () => ({ maxHeight: "690px", borderTopWidth: "1px",
      getPropertyValue: name => ["--ui-sheet-handle-size", "--house-dock-collapsed-height"].includes(name) ? "44px" : "0px" }),
    addEventListener: (type, listener) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
    removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
    setTimeout: (callback) => { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout: (id) => timers.delete(id) };
  const scheduler = new UiCatalogFrameScheduler({ windowTarget });
  const fishView = new AquariumFishView({ canvas: documentRef.querySelector("[data-house-aquarium-fish]"), windowTarget: scheduler,
    motion: new AquariumFishMotion({ config: CONFIG.liveBait.visual, rng: { next: () => .5 }, isValidConfig: isUsableAquariumVisual }),
    style: AQUARIUM_FISH_VIEW_STYLE, createImage: () => ({ complete: false }),
    observeResize: () => ({ disconnect: () => { disconnected++; } }) });
  let example;
  const feedPicker = new AquariumFeedPicker({ documentRef, button: documentRef.querySelector("[data-house-feed-toggle]"),
    list: documentRef.querySelector("[data-house-feed-list]"), labels: HOUSE_LABELS.feedPicker,
    preview: documentRef.querySelector("[data-house-next-feed]"), hint: documentRef.querySelector("[data-house-feed-hint]"),
    onFeed: (id, quantity) => example.perform("feed", id, quantity) });
  const timeDisplay = new TimeDisplay({ documentRef, mount: documentRef.querySelector("[data-house-time-mount]") });
  const colors = new DegradationColorResolver({ configProvider: () => DEGRADATION_COLOR_CONFIG });
  const { FullscreenControl } = await import("../../../src/platform/browser/ui/fullscreen_control.js");
  const { UiSheetHandleRenderer } = await import("../../../src/game/presentation/ui/ui_sheet_handle_renderer.js");
  const { SheetDismissController } = await import("../../../src/platform/browser/dom/sheet_dismiss_controller.js");
  const { SheetHeightController } = await import("../../../src/platform/browser/dom/sheet_height_controller.js");
  const sheetHeights = new SheetHeightController({ windowTarget, durationMs: HOUSE_CONFIG.ui.sheetCloseDurationMs });
  documentRef.documentElement = { requestFullscreen: async () => {} };
  const fullscreenControl = new FullscreenControl({ documentRef,
    mountNode: documentRef.querySelector("[data-house-fullscreen-mount]"), label: "Fullscreen" });
  const view = composeHouseView({ documentRef, windowTarget, domFactory: dom, sheetHeights, perform: (action, id) => example.perform(action, id),
    roomConfig: HOUSE_CONFIG.room, uiConfig: HOUSE_CONFIG.ui,
    rootNode: documentRef.body, onReturn: () => {}, fishView, feedPicker, timeBlendMs: 1000, labels: HOUSE_LABELS,
    resourceMeters: new InventoryResourceMeterRenderer({ domFactory: dom, degradationColorResolver: colors }),
    sheetHandleRenderer: new UiSheetHandleRenderer({ domFactory: dom, dismissController: new SheetDismissController() }),
    autoSwitchRenderer: new UiAutoSwitchRenderer({ domFactory: dom }) });
  example = new UiCatalogHouseExample({ view, fishView, feedPicker, frameScheduler: scheduler,
    documentScope: { body: documentRef.body, dispose() {} }, roomConfig: HOUSE_CONFIG.room, timeDisplay, status: dom.element("p"), fullscreenControl,
    sheetHeights, aquariumCapacities: CONFIG.liveBait.capacities,
    feedCalculator: new (await import("../../../src/game/domain/live_bait/aquarium_care_calculator.js")).AquariumCareCalculator(CONFIG.liveBait),
    feedCatalog: CONFIG.liveBait.aquariumFeeds });
  example.setState("normal");
  const dock = documentRef.querySelector("[data-house-dock]");
  example.setState("menu-expanded");
  assert(dock.classList.contains("house__dock--expanded"), "catalog expansion uses the production menu state");
  assert.equal(documentRef.querySelector("[data-house-scrim]").hidden, true);
  example.setState("section-open");
  assert.equal(documentRef.querySelector('[data-house-panel="aquarium"]').hidden, false);
  assert(dock.classList.contains("house__dock--panel-open"), "catalog selected-state geometry comes from the production view");
  example.setState("menu-collapsed");
  assert(!dock.classList.contains("house__dock--expanded") && !dock.classList.contains("house__dock--panel-open"));
  assert.equal(dock.inert, false);
  example.setState("full");
  assert.equal(documentRef.querySelector("[data-house-capacity-meter]").children[0].getAttribute("aria-valuenow"), "100");
  example.setState("no-feed"); assert.equal(documentRef.byClass("inventory-toggle__input")[0].disabled, true);
  example.setState("unaffordable");
  assert(documentRef.querySelector('[data-house-action="upgrade"]').classList.contains("inventory-action--danger"));
  example.setState("normal");
  assert.equal(documentRef.querySelector("[data-house-capacity]").textContent, "1 / 5");
  assert.equal(documentRef.querySelector("[data-house-feed-toggle]").disabled, true, "67% uses the production half-time gate");
  const meter = documentRef.querySelector("[data-house-feed-meter]").children[0];
  assert.equal(meter.getAttribute("aria-valuenow"), "67");
  const feedImage = documentRef.querySelector("[data-house-feed-image]");
  const feedItemImage = documentRef.byClass("house__feed-item-image")[0];
  const fishRow = documentRef.byClass("house__fish")[0];
  example.setValue(1);
  assert.equal(documentRef.querySelector("[data-house-feed-image]"), feedImage);
  assert.equal(documentRef.byClass("house__feed-item-image")[0], feedItemImage);
  assert.equal(documentRef.byClass("house__fish")[0], fishRow);
  assert.equal(meter.getAttribute("aria-valuenow"), "1");
  assert.equal(meter.style.getPropertyValue("--inventory-resource-color"), colors.resolvePercent(1).cssColor);
  documentRef.querySelector("[data-house-feed-toggle]").click();
  const choose = documentRef.querySelector("[data-house-feed-list]").children[0]; choose.click();
  const load = documentRef.querySelector("[data-house-feed-toggle]");
  assert(!feedPicker.isOpen, "selecting a production row closes the list without consuming it");
  assert.equal(load.textContent, "Завантажити");
  assert.equal(choose.children[0].children[1].textContent, "12");
  documentRef.querySelector("[data-house-next-feed]").children[0].click();
  assert(feedPicker.isOpen, "the selected row reopens the same list");
  choose.click(); assert(!feedPicker.isOpen);
  load.click();
  assert(!feedPicker.isOpen);
  assert.equal(choose.children[0].children[1].textContent, "11");
  assert.equal(load.disabled, true, "loading resets the same production gate");
  assert.equal(documentRef.activeElement, documentRef.querySelector("[data-house-feed-hint]"));
  assert.equal(documentRef.byClass("house__feed-item-image")[0], feedItemImage);
  example.setState("renovating"); assert.equal(documentRef.querySelector("[data-house-renovation]").hidden, false);
  example.setState("unowned"); assert.equal(documentRef.querySelector("[data-house-aquarium-stage]").hidden, true);
  example.setState("error"); assert(documentRef.querySelector("[data-house-notice]").classList.contains("ui-hint--error"));
  example.dispose();
  assert.equal(disconnected, 1);
  assert.equal(timers.size, 0, "dispose clears actual HouseView announcement timer");
  assert.equal(listeners.get("scroll")?.size ?? 0, 0);
  assert.equal(documentRef.listeners.get("fullscreenchange")?.size, 0);
  assert.equal(documentRef.byClass("house__feed-dialog").length, 0);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
