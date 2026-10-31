"use strict";

const assert = require("node:assert/strict");
const { GlyphInkMetrics } = require("../../../src/platform/browser/dom/glyph_ink_metrics.js");
const { TestDocument } = require("../../testing/keepnet/test_document.js");
const { InventoryDomFactory } = require("../../../src/platform/browser/dom/inventory_dom_factory.js");
const { UiCloseButtonRenderer } = require("../../../src/game/presentation/ui/ui_close_button_renderer.js");
const { UiAutoSwitchRenderer } = require("../../../src/game/presentation/ui/ui_auto_switch_renderer.js");
const { InventoryResourceMeterRenderer } = require("../../../src/game/presentation/inventory/inventory_resource_meter_renderer.js");
const { HoldCharges } = require("../../../src/platform/browser/ui/hold_charges.js");
const { InventoryItemParametersRenderer } = require("../../../src/game/presentation/inventory/inventory_item_parameters_renderer.js");

const { AssetRegistry } = require("../../../src/engine/assets/asset_registry.js");
const { ASSET_REGISTRY } = require("../../../src/game/config/generated/asset_registry.js");
const assets = new AssetRegistry(ASSET_REGISTRY);
const documentRef = new TestDocument();
const domFactory = new InventoryDomFactory(documentRef, { assets });
// The float and landing net share one transparent toolbar group. Closed depth
// content is removed from interaction, rather than masking a tall game region.
{
  const { GameToolbar } = require("../../../src/platform/browser/ui/game_toolbar.js");
  const { DepthSelector } = require("../../../src/platform/browser/ui/depth_selector.js");
  const { GameControls } = require("../../../src/platform/browser/ui/game_controls.js");
  const { HUD_LABELS } = require("../../../src/game/presentation/hud/hud_labels.js");
  const toolbar = new GameToolbar({ documentRef, mountNode: documentRef.body });
  const depth = new DepthSelector({ documentRef, mountNode: toolbar.depthMountNode, domFactory,
    labels: HUD_LABELS, iconImages: { F: "items.floats.float-day" } });
  const controls = new GameControls({}, null, { documentRef, labels: HUD_LABELS,
    toolbarMountNode: toolbar.element, netMountNode: toolbar.tackleMountNode });
  depth.show(10, 2, () => {}); depth.setIcon("F");
  const root = documentRef.byClass("depth-selector")[0];
  const icon = documentRef.byClass("depth-selector__icon")[0];
  const panel = documentRef.byClass("depth-selector__panel")[0];
  const net = documentRef.byClass("game-toolbar-button--net")[0];
  const image = icon.children[0];
  assert.equal(root.parentNode, toolbar.depthMountNode);
  assert.equal(toolbar.depthMountNode.parentNode, toolbar.tackleMountNode);
  assert.notEqual(toolbar.selectorMountNode, toolbar.tackleMountNode, "selector layout is independent of the tackle actions");
  assert.equal(toolbar.selectorMountNode.parentNode, toolbar.element, "the shared toolbar owns both mounts");
  assert.equal(net.parentNode, toolbar.tackleMountNode);
  assert(panel.hidden && panel.inert);
  assert.notEqual(root.style.pointerEvents, "all", "the depth root has no solid input override");
  assert.equal(image.src, "assets/items/floats/float-day.webp");
  for (let i = 0; i < 120; i++) depth.setIcon("F");
  assert.equal(icon.children[0], image, "unchanged equipped float retains the optimized image node");
  assert.equal(image.draggable, false);
  assert.equal((documentRef.listeners.get("pointermove") || new Set()).size, 0,
    "the moved float needs no global pointermove workaround");
  depth.open();
  const rail = documentRef.byClass("depth-selector__track")[0];
  let boundsReads = 0;
  rail.getBoundingClientRect = () => { boundsReads++; return { left: 0, width: 100 }; };
  root.getAnimations = () => [{ transitionProperty: "width", playState: "running" }];
  rail.fire("pointerdown", { pointerId: 9, button: 0, clientX: 50 });
  assert.equal(boundsReads, 0, "a drag must not cache moving bounds during expansion");
  root.getAnimations = () => [];
  rail.fire("pointerdown", { pointerId: 9, button: 0, clientX: 50 });
  assert.equal(boundsReads, 1, "the settled slider accepts a drag");
  depth.close();
  depth.dispose(); controls.dispose(); toolbar.dispose();
  assert.equal([...root.listeners.values()].reduce((count, listeners) => count + listeners.size, 0), 0);
}
const closeButtons = new UiCloseButtonRenderer({ domFactory });
let closed = 0;
const close = closeButtons.create({ label: "Close example", className: "example__close", onClose: () => closed++ });
assert.equal(close.type, "button");
assert.equal(close.getAttribute("aria-label"), "Close example");
assert(close.classList.contains("ui-modal-close") && close.classList.contains("example__close"));
close.click(); assert.equal(closed, 1);
closeButtons.dispose(close); close.click(); assert.equal(closed, 1, "disposed close cannot call its old host");
assert.equal(close.listeners.get("click").size, 0);

const switches = new UiAutoSwitchRenderer({ domFactory });
let selected = null;
const toggle = switches.create({ id: "automatic", name: "Bait", modeLabel: "Automatic bait",
  placeholderAsset: "ui.inventory.bait", stock: 17, onChange: value => { selected = value; } });
documentRef.body.append(toggle);
const input = documentRef.byClass("inventory-toggle__input")[0];
const image = documentRef.byClass("inventory-toggle__placeholder")[0];
const count = documentRef.byClass("inventory-toggle__count")[0];
assert.equal(input.getAttribute("role"), "switch");
assert.equal(documentRef.byClass("inventory-toggle__thumb")[0].textContent, "A");
input.checked = true; input.fire("change"); assert.equal(selected, true);
switches.update(toggle, { checked: false, disabled: true, stock: 8 });
assert(!input.checked && input.disabled && toggle.classList.contains("inventory-toggle--disabled"));
assert.equal(count.textContent, "0", "manual mode counts equipped portions rather than backpack stock");
assert.equal(documentRef.byClass("inventory-toggle__placeholder")[0], image, "stock updates retain artwork identity");
assert(input.getAttribute("aria-label").includes("Споряджено: 0"));
switches.dispose(toggle); input.checked = false; input.fire("change"); assert.equal(selected, true);
assert.equal(input.listeners.get("change").size, 0);

let baitSlot = null;
const picker = switches.create({ name: "Bait", modeLabel: "Automatic bait",
  checked: true, stock: 102,
  placeholderAsset: "ui.inventory.bait", onSlotActivate: index => { baitSlot = index; },
  slots: [12, 80, 10].map((stock, index) => ({ available: true, highlighted: index === 0,
    stock, item: { name: "Bait " + index, icon: "B" } })) });
documentRef.body.append(picker);
const pickerButtons = picker.children[0].children;
assert.equal(pickerButtons.length, 3, "the owner's v2 sketch exposes each of the three bait slots");
assert.deepEqual([...pickerButtons].map(button => button.children[1].textContent), ["12", "80", "10"],
  "every equipped bait shows its exact matching reserve below its artwork");
assert.equal(pickerButtons[0].children[0].children[0].textContent, "B", "an equipped item's artwork replaces its category placeholder");
assert(pickerButtons[0].children[0].children[0].classList.contains("inventory-toggle__glyph"),
  "emoji artwork has an explicit visual box inside the circular frame");
const firstArtwork = pickerButtons[0].children[0];
const firstVisual = firstArtwork.children[0];
switches.update(picker, { checked: true, stock: 102, slots: [12, 80, 10].map((stock, index) =>
  ({ available: true, highlighted: index === 0, stock, item: { name: "Bait " + index, icon: "B" } })) });
assert.equal(picker.children[0].children[0], pickerButtons[0], "switch updates retain the consumable buttons");
assert.equal(pickerButtons[0].children[0], firstArtwork, "unchanged consumable artwork retains its DOM identity");
assert.equal(firstArtwork.children[0], firstVisual, "unchanged emoji updates retain the bounded visual node");
assert(picker.classList.contains("inventory-toggle--multiple"));
assert.equal(pickerButtons[0].getAttribute("aria-pressed"), "true");
assert(pickerButtons[0].classList.contains("inventory-toggle__item--available"));
pickerButtons[1].click(); assert.equal(baitSlot, 1);
pickerButtons[2].click(); assert.equal(baitSlot, 2, "the third icon has its own pick action");
assert.equal(picker.children[1].children[0].checked, true, "the bait button is separate from the switch label");
const pickerInput = picker.children[1].children[0];
pickerInput.checked = false; pickerInput.fire("change");
assert.equal(picker.children[1].children[1].children[0].textContent, "3",
  "turning automatic mode off immediately shows the three equipped portions");
assert.deepEqual([...pickerButtons].map(button => button.children[1].textContent), ["1", "1", "1"],
  "manual mode shows one equipped portion below each different bait");
switches.update(picker, { slots: [0, 1, 2].map(() => ({ available: true, showCount: false,
  stock: 12, item: { name: "Worm", icon: "W" } })), stock: 12 });
assert([...pickerButtons].every(button => button.children[1].hidden),
  "identical baits keep every selectable icon but only the total count");
assert.equal(picker.children[1].children[1].children[0].textContent, "3");
pickerInput.checked = true; pickerInput.fire("change");
assert.equal(picker.children[1].children[1].children[0].textContent, "12",
  "automatic mode uses the shared reserve once");
assert([...pickerButtons].every(button => button.children[1].hidden));
switches.dispose(picker);
pickerButtons[0].click(); assert.equal(baitSlot, 2, "disposed bait buttons cannot call their previous host");
assert.equal(pickerButtons[0].listeners.get("click").size, 0);

// TK-107: switcher prefers switcherIconAsset over iconAsset when equipped (asset ids, spec 157 R16).
const wormToggle = switches.create({
  name: "Bait",
  placeholderAsset: "ui.inventory.bait",
  slots: [{
    available: true,
    item: {
      name: "Масляний черв'як",
      iconAsset: "items.baits.oil-worms--100",
      switcherIconAsset: "items.baits.oil-worm_icon",
    },
  }],
});
documentRef.body.append(wormToggle);
const wormImage = documentRef.byClass("inventory-toggle__image").pop();
assert.equal(wormImage?.src, "assets/items/baits/oil-worm_icon.webp", "the switcher displays switcherIconAsset when available");
switches.dispose(wormToggle);

const compact = switches.create({ variant: "control", name: "Feeder", modeLabel: "Automatic feeder", checked: true });
documentRef.body.append(compact);
assert.equal(compact.children.length, 2, "control variant contains the input and control without equipment or stock");
assert.equal(compact.children[0].getAttribute("aria-label"), "Automatic feeder");
switches.dispose(compact);
const meters = new InventoryResourceMeterRenderer({ domFactory });
for (const [raw, expected] of [[-10, 0], [134, 100], [NaN, 0], [undefined, 0], [67, 67]]) {
  const meter = meters.create({ id: "resource", percent: raw, label: `Reading ${raw}` });
  assert.equal(meter.style.getPropertyValue("--inventory-resource-percent"), `${expected}%`);
  assert.equal(meter.getAttribute("aria-valuenow"), String(expected));
  assert.equal(meter.getAttribute("aria-valuetext"), `Reading ${raw}`, "accessible text retains the authoritative reading");
}
const charges = new HoldCharges({ documentRef, labels: { holdActive: "Hold active" } });
const reading = { hasHold: true, max: 3, current: 3, isActive: false, restoring: [], restoreMaxTime: 10 };
charges.update(reading);
const chargeNodes = [...charges.circles];
assert(charges.circles.every(circle => circle.classList.contains("hold-charges__charge--available")));
reading.current = 0;
charges.update(reading);
assert(charges.circles.every(circle => circle.className === "hold-charges__charge"), "depleted reading clears old available presentation");
assert.deepEqual(charges.circles, chargeNodes, "numeric charge updates retain cached nodes");
reading.isActive = true; charges.update(reading);
assert(charges.circles[0].classList.contains("hold-charges__charge--active"));
reading.isActive = false; reading.restoring = [5]; charges.update(reading);
assert(charges.circles[0].classList.contains("hold-charges__charge--restoring"));
reading.restoring = []; charges.update(reading);
assert(charges.circles.every(circle => circle.className === "hold-charges__charge"));
charges.dispose();
const parameters = new InventoryItemParametersRenderer({ domFactory,
  resolver: { resolve: item => item?.empty ? [] : [{ label: "Parameter", value: 50, kind: "bar", percent: 50 }] } });
const sections = [1, 2, 3].map(value => ({ item: { instanceId: String(value) }, title: "Section" }));
const tiles = parameters.renderSections(sections);
parameters.update(tiles.children[2], { instanceId: "3", empty: true });
assert.equal(tiles.children.length, 2);
parameters.update(tiles.children[1], { instanceId: "2", empty: true });
assert.equal(tiles.children.length, 1);
// Glyph measurement is cached; its visual offsets belong to owner acceptance.
let measurements = 0;
const metrics = new GlyphInkMetrics({ documentRef: { documentElement: {},
  defaultView: { getComputedStyle: () => ({ getPropertyValue: () => "system-ui" }) },
  createElement: () => ({ getContext: () => ({ measureText() { measurements++; return { width: 100 }; } }) }) } });
metrics.offset("x"); metrics.offset("x");
assert.equal(measurements, 1, "repeated glyphs reuse the measurement");

console.log("UI components passed: shared close/switch callbacks, semantic controls, host mixes, disabled/compact states, stable artwork, cached measurement and disposal.");
