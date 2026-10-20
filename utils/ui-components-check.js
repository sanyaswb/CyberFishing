"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { GlyphInkMetrics } = require("../src/platform/browser/dom/glyph_ink_metrics.js");
const { TestDocument } = require("./testing/keepnet/test_document.js");
const { InventoryDomFactory } = require("../src/platform/browser/dom/inventory_dom_factory.js");
const { UiCloseButtonRenderer } = require("../src/game/presentation/ui/ui_close_button_renderer.js");
const { UiAutoSwitchRenderer } = require("../src/game/presentation/ui/ui_auto_switch_renderer.js");
const { InventoryResourceMeterRenderer } = require("../src/game/presentation/inventory/inventory_resource_meter_renderer.js");
const { HoldCharges } = require("../src/platform/browser/ui/hold_charges.js");
const { InventoryItemParametersRenderer } = require("../src/game/presentation/inventory/inventory_item_parameters_renderer.js");

const documentRef = new TestDocument();
const domFactory = new InventoryDomFactory(documentRef);
// The float and landing net share one transparent toolbar group. Closed depth
// content is removed from interaction, rather than masking a tall game region.
{
  const { GameToolbar } = require("../src/platform/browser/ui/game_toolbar.js");
  const { DepthSelector } = require("../src/platform/browser/ui/depth_selector.js");
  const { GameControls } = require("../src/platform/browser/ui/game_controls.js");
  const { HUD_LABELS } = require("../src/game/presentation/hud/hud_labels.js");
  const toolbar = new GameToolbar({ documentRef, mountNode: documentRef.body });
  const depth = new DepthSelector({ documentRef, mountNode: toolbar.depthMountNode, domFactory,
    labels: HUD_LABELS, iconImages: { F: "assets/items/floats/float-day.webp" } });
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
  placeholderUrl: "assets/ui/inventory/bait.svg", stock: 17, onChange: value => { selected = value; } });
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
  placeholderUrl: "assets/ui/inventory/bait.svg", onSlotActivate: index => { baitSlot = index; },
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
assert(!tiles.classList.contains("inventory-item-parameters--single"));
assert(tiles.children[2].classList.contains("inventory-item-parameter-section--centered"));
assert(!tiles.children[0].classList.contains("inventory-item-parameter-section--centered"));
parameters.update(tiles.children[2], { instanceId: "3", empty: true });
assert.equal(tiles.children.length, 2);
assert(tiles.children.every(node => !node.classList.contains("inventory-item-parameter-section--centered")), "removing an odd tile resets container placement");
parameters.update(tiles.children[1], { instanceId: "2", empty: true });
assert(tiles.classList.contains("inventory-item-parameters--single"), "a single tile retains full width through explicit BEM state");
// DESIGN_RULES §8: emoji glyphs centre by their measured ink. Segoe UI Emoji's worm (font-file metrics, 100px): advance
// 137.3, ink 22.9..111.8 and -14..84.5 around the baseline; Segoe UI line metrics 107.9/25.1.
const segoeWorm = { width: 137.3, actualBoundingBoxLeft: -22.9, actualBoundingBoxRight: 111.8,
  actualBoundingBoxAscent: 84.5, actualBoundingBoxDescent: 14, fontBoundingBoxAscent: 107.9, fontBoundingBoxDescent: 25.1 };
const measuredGlyphs = [];
const canvasDocument = {
  documentElement: {},
  defaultView: { getComputedStyle: () => ({ getPropertyValue: (name) => (name === "--ui-font-body" ? " system-ui, sans-serif" : "") }) },
  createElement: () => ({ getContext: () => ({ measureText(text) { measuredGlyphs.push([this.font, text]); return segoeWorm; } }) }),
};
const inkMetrics = new GlyphInkMetrics({ documentRef: canvasDocument });
assert.deepEqual(inkMetrics.offset("🪱"), { x: 0.013, y: -0.062 }, "the ink offset centres the drawn glyph, not its advance or line box");
inkMetrics.offset("🪱");
assert.deepEqual(measuredGlyphs, [["100px system-ui, sans-serif", "🪱"]], "each glyph is measured once with the --ui-font-body family");
assert.deepEqual(new GlyphInkMetrics({ documentRef }).offset("🪱"), { x: 0, y: 0 }, "without a canvas the glyph keeps flex centring");
const glyph = new InventoryDomFactory(documentRef, { glyphMetrics: inkMetrics }).glyph("🪱", "example__icon");
const glyphInk = glyph.children[0];
assert(glyph.classList.contains("ui-glyph") && glyph.classList.contains("example__icon") && glyph.getAttribute("aria-hidden") === "true");
assert(glyphInk.classList.contains("ui-glyph__ink") && glyphInk.textContent === "🪱" &&
  glyphInk.style.getPropertyValue("--ui-glyph-shift-x") === "0.013em" && glyphInk.style.getPropertyValue("--ui-glyph-shift-y") === "-0.062em",
"the factory writes the measured shift in em");
// Guard: every glyph consumer only sizes its box; centring, font and line height belong to ui-glyph.css.
const sourceRoot = path.join(__dirname, "..", "src");
const sourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory() ? sourceFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
const allSources = sourceFiles(sourceRoot);
const glyphClasses = new Set(allSources.filter((file) => file.endsWith(".js"))
  .flatMap((file) => [...fs.readFileSync(file, "utf8").matchAll(/\.glyph\([^;]*?,\s*"([a-z0-9_-]+)"\)/g)].map((match) => match[1])));
assert(glyphClasses.size >= 4, "toggle, item card, attachment badge and parameter icons use the shared glyph");
const glyphCss = fs.readFileSync(path.join(sourceRoot, "game/presentation/styles/ui-glyph.css"), "utf8");
assert.match(glyphCss, /\.ui-glyph\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*center;[^}]*container-type:\s*size;/,
  "the glyph box centres with flex, which overflows an over-wide advance evenly");
for (const file of allSources.filter((entry) => entry.endsWith(".css"))) {
  for (const rule of fs.readFileSync(file, "utf8").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const owner = [...glyphClasses].find((name) => new RegExp(`\\.${name}\\s*$`).test(rule[1].trim().split(",").pop()));
    if (owner) assert.doesNotMatch(rule[2], /(^|;|\s)(font|font-size|line-height|display|place-items|align-items|justify-content)\s*:/,
      `${path.basename(file)} must not re-centre or re-size the ${owner} glyph text`);
  }
}

console.log("UI components passed: shared close/switch callbacks, semantic controls, host mixes, disabled/compact states, stable artwork, measured glyph centring and disposal.");
