"use strict";
const assert = require("node:assert/strict");
const { TestDocument } = require("../../testing/keepnet/test_document.js");
const { InventorySelectorGeometry } = require("../../../src/game/presentation/inventory/inventory_selector_geometry.js");
const { INVENTORY_SELECTOR_CONFIG } = require("../../../src/game/presentation/inventory/inventory_selector_config.js");
const { CONFIG } = require("../../../src/game/config/runtime/game_config.js");
assert.equal(CONFIG.ui.inventorySelector.radialEnabled, true, "radial design is enabled by default");
assert.equal(CONFIG.ui.inventorySelector.size, 1, "initial size defaults to standard");
assert.equal(CONFIG.ui.inventorySelector.openSize, 3, "open size defaults independently to large");

const geometry = new InventorySelectorGeometry(INVENTORY_SELECTOR_CONFIG);
assert(Math.abs(geometry.innerRadius - geometry.centralRadius - INVENTORY_SELECTOR_CONFIG.gap) < 1e-12,
  "the central arc and sector neighbours use one shared gap");
for (let index = 0; index < 3; index++) {
  const sector = geometry.sectors[index];
  assert.equal(geometry.hitTest(sector.center.x, sector.center.y), index);
  assert(geometry.contains(sector.center.x, sector.center.y));
}
assert.equal(geometry.hitTest(0, 0), -1);
assert.equal(geometry.hitTest(-1.6, 0), -1, "axis gap is not a selectable sector");
assert(geometry.contains(-0.7, -0.7), "the route from the button through gaps retains hover");
assert(!geometry.contains(-2.1, -2.1), "retention is a quarter disk, not a rectangle");
for (let i = 0; i < geometry.sectors[0].points.length; i++) {
  const base = geometry.sectors[0].points[i], rotated = geometry.sectors[1].points[i];
  const angle = Math.PI / 6;
  assert(Math.abs(rotated.x - (base.x * Math.cos(angle) - base.y * Math.sin(angle))) < 1e-12);
  assert(Math.abs(rotated.y - (base.x * Math.sin(angle) + base.y * Math.cos(angle))) < 1e-12,
    "each section is exactly the same rounded geometry rotated by 30 degrees");
}
for (const angle of [0, 30, 60, 90]) {
  assert.equal(geometry.hitTest(-1.6 * Math.cos(angle * Math.PI / 180), -1.6 * Math.sin(angle * Math.PI / 180)), -1,
    "all four radial gaps are non-selectable");
}
{
  const angle = Math.asin(INVENTORY_SELECTOR_CONFIG.gap / 2 / geometry.radius) + 0.001;
  assert.equal(geometry.hitTest(-2.099 * Math.cos(angle), -2.099 * Math.sin(angle)), -1,
    "a cut-away rounded outer corner is not its rectangular hit box");
}
const { InventorySelectorRenderer } = require("../../../src/game/presentation/inventory/inventory_selector_renderer.js");
const { InventorySelectorController } = require("../../../src/platform/browser/dom/inventory_selector_controller.js");
const { InventoryDomFactory } = require("../../../src/platform/browser/dom/inventory_dom_factory.js");
const { INVENTORY_SECTIONS } = require("../../../src/game/presentation/inventory/inventory_sections.js");
const { INVENTORY_SELECTOR_LABELS } = require("../../../src/game/presentation/inventory/inventory_selector_labels.js");
const { composeInventorySelector } = require("../../../src/bootstrap/production/inventory_selector_composition.js");
const { InventorySelectorConfigValidator } = require("../../../src/game/config/validation/inventory_selector_config_validator.js");
const { createRuntimeConfigContext } = require("../../../src/bootstrap/production/config_context.js");

function scenario({ width = 320, size = 1, openSize = size, hover = false, reduced = false } = {}) {
  const doc = new TestDocument(), windowEvents = new TestDocument(), motion = new TestDocument();
  let time = 0, reads = 0, captured = null, mutationCallback, moved = 0;
  const animations = [];
  doc.body.nodeType = 1;
  motion.matches = reduced;
  doc.defaultView = { performance: { now: () => time },
    addEventListener: (...args) => windowEvents.addEventListener(...args),
    removeEventListener: (...args) => windowEvents.removeEventListener(...args),
    matchMedia: () => motion,
    getComputedStyle: node => ({ display: node.hidden ? "none" : "block", transitionDuration: "0.2s", transitionTimingFunction: "linear", getPropertyValue: () => "" }),
    MutationObserver: class {
      constructor(callback) { mutationCallback = callback; }
      observe() {}
      disconnect() {}
    },
  };
  const scale = Math.min(1, width / 320), unit = 48 * INVENTORY_SELECTOR_CONFIG.sizeScales[openSize];
  const subscriptions = new Set();
  const metrics = { hoverEnabled: hover, scale };
  const surface = { getMetrics: () => metrics,
    physicalToLogicalPoint: ({ x, y }) => ({ x: (x - 17) / scale, y: (y - 29) / scale }),
    subscribe: listener => { subscriptions.add(listener); return () => subscriptions.delete(listener); } };
  const view = new InventorySelectorRenderer({ domFactory: new InventoryDomFactory(doc), geometry,
    sections: INVENTORY_SECTIONS, labels: INVENTORY_SELECTOR_LABELS, keepnetImage: "assets/items/keepnet/keepnet--0.webp", id: "test-sections" });
  view.setSizeScales(INVENTORY_SELECTOR_CONFIG.sizeScales[size], INVENTORY_SELECTOR_CONFIG.sizeScales[openSize]);
  doc.body.appendChild(view.element);
  view.element.getBoundingClientRect = () => {
    reads++;
    const current = 48 * INVENTORY_SELECTOR_CONFIG.sizeScales[view.expanded ? openSize : size];
    return { left: moved + 17 + (300 - current) * scale,
      top: 29 + (500 - current) * scale, width: current * scale, height: current * scale };
  };
  view.central.setPointerCapture = id => { captured = id; };
  view.central.hasPointerCapture = id => captured === id;
  view.central.releasePointerCapture = () => { captured = null; };
  for (const button of view.buttons) button.animate = (frames, options) => {
    const start = time;
    const animation = { frames, options, cancelled: false,
      get playState() { return this.cancelled ? "idle" : time - start >= options.duration ? "finished" : "running"; },
      effect: { getComputedTiming: () => ({ progress: time - start >= options.duration && options.fill === "none"
        ? null : Math.min(1, Math.max(0, (time - start) / options.duration)) }) },
      cancel() { this.cancelled = true; } };
    animations.push(animation);
    return animation;
  };
  const selected = [];
  const controller = new InventorySelectorController({ view, uiSurface: surface, documentRef: doc,
    windowRef: doc.defaultView, onSelect: id => selected.push(id) });
  controller.setEnabled(true);
  const position = ({ x, y }) => ({ clientX: 17 + (300 + x * unit) * scale, clientY: 29 + (500 + y * unit) * scale });
  const fire = (type, point = { x: -0.5, y: -0.5 }, fields = {}) => view.element.fire(type,
    { target: view.central, pointerId: 1, pointerType: "touch", button: 0, ...position(point), ...fields });
  return { doc, view, controller, surface, selected, fire, position, metrics,
    advance: (ms = 250) => { time += ms; }, reads: () => reads, capture: () => captured,
    animations, mutate: records => mutationCallback(records), moveLayout: () => { moved += 10; },
    resize: () => { for (const listener of subscriptions) listener(metrics); },
    dispose: () => { controller.dispose(); controller.dispose(); view.dispose();
      assert.equal(subscriptions.size, 0);
      assert(animations.every(animation => animation.cancelled), "all candidate animations are cancelled on disposal");
      for (const owner of [doc, windowEvents, motion, view.element, view.central]) {
        assert.equal([...owner.listeners.values()].reduce((n, set) => n + set.size, 0), 0);
      }
    } };
}
for (const width of [240, 280, 319, 320, 820, 1280]) {
  for (const [size, openSize] of [[1, 3], [2, 3], [3, 1], [2, 2]]) {
    for (const reduced of [false, true]) {
      const s = scenario({ width, size, openSize, reduced });
      s.fire("pointerdown");
      const reads = s.reads();
      if (!reduced) {
        s.fire("pointermove", geometry.sectors[2].center);
        assert(!s.view.buttons[2].classList.contains("inventory-selector__section--highlighted"),
          "selection waits for scaling and reveal");
        s.advance();
      }
      for (let i = 0; i < 120; i++) s.fire("pointermove", geometry.sectors[2].center);
      assert.equal(s.reads(), reads, "moves do not remeasure the animated control");
      s.fire("pointerup", geometry.sectors[2].center);
      assert.deepEqual(s.selected, ["keepnet"], `release follows the open scale ${size} -> ${openSize}`);
      assert.equal(s.capture(), null);
      assert(!s.view.expanded);
      s.dispose();
    }
  }
}
for (const [size, openSize] of [[1, 3], [3, 1]]) {
  const s = scenario({ width: 1280, size, openSize, hover: true });
  s.view.central.fire("pointerenter", { pointerType: "mouse" }); s.advance();
  s.fire("pointermove", geometry.sectors[0].center, { pointerType: "mouse" }); s.advance();
  s.fire("click", geometry.sectors[0].center, { target: s.view.buttons[0], pointerType: "mouse", detail: 1 });
  assert.deepEqual(s.selected, ["equipment"], "mouse selection uses final expanded bounds");
  s.dispose();
}
{
  const s = scenario({ hover: true, width: 1280 });
  assert(s.view.central.classList.contains("game-toolbar-button"), "closed selector reuses the shared toolbar button appearance");

  s.view.central.fire("pointerenter", { pointerType: "mouse" }); s.advance();
  s.doc.body.setAttribute("class", "game-shell--pointer-release");
  s.mutate([{ target: s.doc.body, attributeName: "class", oldValue: "game-shell" }]);
  assert(s.view.expanded, "an unrelated ancestor class change must not cancel hover");
  const reads = s.reads();
  s.mutate([{ target: s.doc.body, attributeName: "class", oldValue: "game-shell--pointer-release" }]);
  assert(s.view.expanded && s.reads() === reads, "an unchanged attribute delivery does no layout work");
  s.doc.body.hidden = true;
  s.doc.body.setAttribute("hidden", "");
  s.mutate([{ target: s.doc.body, attributeName: "hidden", oldValue: null }]);
  assert(!s.view.expanded, "a hidden ancestor cancels selection");
  s.doc.body.hidden = false;
  s.doc.body.removeAttribute("hidden");
  s.view.central.fire("pointerenter", { pointerType: "mouse" }); s.advance();
  s.moveLayout(); s.doc.body.setAttribute("style", "left:10px");
  s.mutate([{ target: s.doc.body, attributeName: "style", oldValue: "" }]);
  assert(!s.view.expanded, "a real ancestor layout change invalidates cached coordinates"); s.dispose();
}
for (const pointerType of ["mouse", "touch"]) for (const elapsed of [100, 250]) {
  const s = scenario({ hover: pointerType === "mouse", width: 1280 });
  if (pointerType === "mouse") s.view.central.fire("pointerenter", { pointerType });
  else s.fire("pointerdown");
  s.advance();
  s.fire("pointermove", geometry.sectors[0].center, { pointerType });
  assert.equal(s.animations.length, 1, "both input types animate the newly highlighted sector");
  assert.equal(s.animations[0].frames[0].translate, "0% 0%");
  assert.equal(s.animations[0].options.duration, 200);
  const angle = Math.PI / 12;
  const tip = { x: -geometry.radius * Math.cos(angle), y: -geometry.radius * Math.sin(angle) };
  const offset = geometry.sectors[0].shift;
  s.advance(elapsed);
  const visible = { x: tip.x + offset.x * 0.25, y: tip.y + offset.y * 0.25 };
  const invisible = { x: tip.x + offset.x * 0.9, y: tip.y + offset.y * 0.9 };
  assert.equal(s.view.hitTest(visible.x, visible.y, [0.5, 0, 0]), 0,
    "the moving sector accepts its currently visible outer edge");
  assert.equal(s.view.hitTest(invisible.x, invisible.y, [0.5, 0, 0]), -1,
    "a not-yet-visible final animation position is not selectable");
  s.fire("pointerleave", visible, { pointerType, relatedTarget: s.view.retention });
  assert(s.view.expanded, "outward feedback remains inside retention");
  if (pointerType === "mouse") s.fire("click", visible, { pointerType, target: s.view.buttons[0], detail: 1 });
  else s.fire("pointerup", visible);
  assert.deepEqual(s.selected, ["equipment"]); s.dispose();
}

for (const width of [240, 280, 319, 320, 1024, 1025]) for (const size of [1, 2, 3]) {
  for (let index = 0; index < 3; index++) {
    const s = scenario({ width, size });
    assert.equal(s.view.central.getAttribute("aria-expanded"), "false");
    assert(s.view.group.inert && s.view.buttons.every(button => button.tabIndex === -1));
    s.fire("pointerdown"); s.advance();
    assert.equal(s.capture(), 1);
    s.fire("pointermove", geometry.sectors[(index + 1) % 3].center);
    s.fire("pointermove", geometry.sectors[index].center);
    assert(s.view.buttons[index].classList.contains("inventory-selector__section--highlighted"));
    s.fire("pointerup", geometry.sectors[index].center);
    assert.deepEqual(s.selected, [INVENTORY_SECTIONS.items[index].id]);
    s.fire("click", geometry.sectors[index].center, { detail: 1 });
    assert.equal(s.selected.length, 1, "compatibility click is consumed");
    assert.equal(s.capture(), null);
    assert.equal(s.reads(), 1, "moves and release never measure DOM");
    assert(!s.view.expanded && s.view.group.inert);
    s.dispose();
  }
}
for (const point of [{ x: -0.5, y: -0.5 }, { x: -1.6, y: 0 }, { x: -2.2, y: -2.2 }]) {
  const s = scenario(); s.fire("pointerdown"); s.advance();
  s.fire("pointermove", geometry.sectors[0].center); s.fire("pointerup", point);
  assert.deepEqual(s.selected, [], "release discards the former candidate outside a visible sector"); s.dispose();
}
for (const event of ["pointercancel", "lostpointercapture", "resize", "blur", "hidden"]) {
  const s = scenario(); s.fire("pointerdown"); s.advance();
  if (event === "resize") s.resize();
  else if (event === "blur") s.controller.cancel();
  else if (event === "hidden") { s.doc.visibilityState = "hidden"; s.doc.fire("visibilitychange"); }
  else s.fire(event);
  s.fire("pointerup", geometry.sectors[0].center);
  assert.deepEqual(s.selected, []); assert.equal(s.capture(), null); s.dispose();
}
{
  const s = scenario();
  s.fire("pointerdown", undefined, { button: 2 }); assert(!s.view.expanded);
  s.fire("pointerdown");
  s.fire("pointerup", geometry.sectors[0].center);
  assert.deepEqual(s.selected, [], "early release cannot select a sector still travelling");
  s.fire("pointerdown"); s.advance();
  s.fire("pointerdown", undefined, { pointerId: 2, isPrimary: false });
  s.fire("pointerup", geometry.sectors[2].center, { pointerId: 2 });
  assert(s.view.expanded && s.capture() === 1);
  s.fire("pointerup", geometry.sectors[1].center);
  assert.deepEqual(s.selected, ["backpack"]); s.dispose();
}
for (const index of [0, 1, 2]) {
  const s = scenario({ hover: true, width: 1280 });
  s.view.central.fire("pointerenter", { pointerType: "mouse" }); s.advance();
  s.fire("pointermove", { x: -0.7, y: -0.7 }, { pointerType: "mouse" });
  assert(s.view.expanded, "the route through a transparent gap keeps the fan open");
  s.fire("click", undefined, { target: s.view.central, pointerType: "mouse", detail: 1 });
  assert.deepEqual(s.selected, [], "central mouse click never selects a section");
  s.fire("click", geometry.sectors[index].center, { target: s.view.buttons[index], detail: 1 });
  assert.deepEqual(s.selected, [INVENTORY_SECTIONS.items[index].id]);
  s.view.central.fire("pointerenter", { pointerType: "mouse" }); assert(!s.view.expanded);
  s.fire("pointerleave"); s.view.central.fire("pointerenter", { pointerType: "mouse" });
  assert(s.view.expanded, "hover reopens after exit and re-entry");
  s.fire("pointermove", { x: -2.1, y: -2.1 }, { pointerType: "mouse" }); assert(!s.view.expanded);
  s.dispose();
}
{
  const s = scenario({ hover: true, width: 1280 });
  s.view.central.fire("pointerenter", { pointerType: "mouse" }); s.advance();
  for (const point of [{ x: -0.7, y: -0.7 }, { x: -0.05, y: -1.8 },
    { x: -1.6 * Math.cos(Math.PI / 6), y: -1.6 * Math.sin(Math.PI / 6) },
    { x: -1.6 * Math.cos(Math.PI / 3), y: -1.6 * Math.sin(Math.PI / 3) }]) {
    s.fire("pointerleave", point, { relatedTarget: s.view.retention, pointerType: "mouse" });
    assert(s.view.expanded, "DOM leave while still inside the fan, centre or gap must not close it");
    s.fire("pointermove", point, { target: s.view.retention, pointerType: "mouse" });
    assert(s.view.expanded, "the component's own retention receives internal pointer movement");
  }
  s.fire("pointerleave", { x: -3, y: -3 }, { relatedTarget: s.doc.body, pointerType: "mouse" });
  assert(!s.view.expanded, "leaving the whole retention area closes once"); s.dispose();
}
{
  const s = scenario({ reduced: true });
  s.fire("pointerdown"); s.fire("pointerup", geometry.sectors[2].center);
  assert.deepEqual(s.selected, ["keepnet"], "reduced motion has no readiness delay");
  assert.equal(s.animations.length, 0, "reduced motion schedules no outward movement");
  s.fire("keydown", undefined, { key: "Enter" });
  assert.equal(s.doc.activeElement, s.view.buttons[0]);
  s.fire("keydown", undefined, { target: s.view.buttons[2], key: "Escape" });
  assert.equal(s.doc.activeElement, s.view.central);
  s.fire("keydown", undefined, { key: " " });
  s.fire("keydown", undefined, { target: s.view.buttons[1], key: "Enter" });
  assert.deepEqual(s.selected, ["keepnet", "backpack"]);
  s.controller.openKeyboard(); s.fire("focusout", undefined, { relatedTarget: s.doc.body });
  assert(!s.view.expanded); s.dispose();
}

async function checkComposition() {
  const s = scenario(); s.controller.dispose(); s.view.dispose();
  const editor = { scroll: 123, filters: "rods" };
  const config = { ui: { inventorySelector: { ...CONFIG.ui.inventorySelector } } };
  const ctx = createRuntimeConfigContext(config, { validateOverrides: InventorySelectorConfigValidator.validateOverrides,
    resetOnImport: ["ui.inventorySelector.radialEnabled", "ui.inventorySelector.size", "ui.inventorySelector.openSize"] });
  let classic, keepnet, listener, equipmentListener, finishArtwork, artworkLoads = 0;
  const equipped = { rod: null };
  const inventory = { editor, rootNode: s.doc.createElement("div"),
    setShortcutVisible: value => { classic = value; }, onVisibilityChange: fn => { listener = fn; return () => { listener = null; }; },
    openSection: id => { s.selected.push(id); listener(true); } };
  const binding = composeInventorySelector({ documentRef: s.doc, windowRef: s.doc.defaultView,
    uiSurface: s.surface, mountNode: s.doc.body, inventoryUI: inventory,
    keepnetUI: { setShortcutVisible: value => { keepnet = value; } }, config,
    equipmentSource: { getEquipped: () => equipped,
      onInventoryChanged: fn => { equipmentListener = fn; return () => { equipmentListener = null; }; } },
    imageAssets: { preload: records => {
      if (records.length === 3) return Promise.resolve();
      artworkLoads++; return new Promise(resolve => { finishArtwork = resolve; });
    } }, logger: { warn: assert.fail } });
  binding.view.element.getBoundingClientRect = () => ({ left: 218.4, top: 418.4, width: 81.6, height: 81.6 });
  await binding.ready;
  assert(!classic && !keepnet && binding.view.enabled);
  const fallback = binding.view.buttons[0].children[1], art = binding.view.buttons[0].children[2];
  assert.equal(fallback.getAttribute("hidden"), null); assert(art.hidden);
  equipped.rod = { skin: { thumbnail: { src: "assets/items/rods/bamboo-rod-ecip-v1.webp", visibleHeight: 0.5, focusX: 0.31 } } };
  equipmentListener(); finishArtwork(); await Promise.resolve();
  const rodImage = art.children[0];
  assert.equal(rodImage.getAttribute("src"), equipped.rod.skin.thumbnail.src);
  assert.equal(fallback.getAttribute("hidden"), ""); assert(!art.hidden && rodImage.draggable === false);
  equipmentListener(); assert.equal(artworkLoads, 1, "unchanged inventory never reloads rod art");
  assert.equal(art.children[0], rodImage, "rod updates retain the image node");
  equipped.rod = null; equipmentListener(); assert.equal(fallback.getAttribute("hidden"), null); assert(art.hidden);
  equipped.rod = { imageUrl: "assets/items/rods/bamboo-rod-unecip-v1.webp" }; equipmentListener();
  equipped.rod = null; equipmentListener(); finishArtwork(); await Promise.resolve();
  assert.equal(fallback.getAttribute("hidden"), null); assert(art.hidden, "a late preload cannot restore a removed rod");
  assert.equal(binding.view.element.style.getPropertyValue("--inventory-selector-closed-scale"), String(1 / 1.7));
  for (let i = 0; i < 10; i++) {
    ctx.set("ui.inventorySelector.radialEnabled", i % 2 === 0); s.doc.fire("config-updated");
    assert.equal(binding.view.enabled, i % 2 === 0);
    assert.equal(classic, i % 2 !== 0); assert.equal(keepnet, classic);
    assert.equal(inventory.editor, editor); assert.equal(editor.scroll, 123);
  }
  ctx.set("ui.inventorySelector.radialEnabled", true); s.doc.fire("config-updated");
  binding.controller.openKeyboard();
  ctx.set("ui.inventorySelector.size", 3); s.doc.fire("config-updated");
  assert(!binding.view.expanded);
  assert.equal(binding.view.element.style.getPropertyValue("--inventory-selector-scale"), "1.7");
  binding.controller.openKeyboard();
  ctx.set("ui.inventorySelector.openSize", 1); s.doc.fire("config-updated");
  assert(!binding.view.expanded, "an open-size edit cancels stale geometry");
  assert.equal(config.ui.inventorySelector.size, 3, "the two settings are independent");
  assert.equal(binding.view.element.style.getPropertyValue("--inventory-selector-open-scale"), String(1 / 1.7));
  binding.controller.openKeyboard(); listener(true); assert(!binding.view.expanded);
  const exported = ctx.exportOverrides();
  ctx.resetAll(); s.doc.fire("config-updated"); assert(!classic && binding.view.enabled);
  ctx.importOverrides(exported); s.doc.fire("config-updated"); assert(binding.view.enabled);
  assert.equal(config.ui.inventorySelector.size, 3);
  assert.equal(config.ui.inventorySelector.openSize, 1, "both sizes survive export/import");
  ctx.importOverrides({}); s.doc.fire("config-updated"); assert(!classic && binding.view.enabled);
  assert.equal(config.ui.inventorySelector.size, 1);
  assert.equal(config.ui.inventorySelector.openSize, 3);
  ctx.importOverrides({ "ui.inventorySelector.size": 2 });
  assert.equal(config.ui.inventorySelector.openSize, 3, "older scalar overrides retain the open default");
  ctx.resetAll();
  for (const data of [{ "ui.inventorySelector.size": 4 }, { "ui.inventorySelector.openSize": 0 },
    { "ui.inventorySelector.openSize": "3" }, { "ui.inventorySelector.radialEnabled": "true" },
    { "ui.inventorySelector.typo": true }, { "ui.inventorySelector": { radialEnabled: true, size: 2, openSize: 3, typo: 1 } }]) {
    assert.throws(() => ctx.importOverrides(data), /ui.inventorySelector/);
    assert.equal(config.ui.inventorySelector.size, 1, "invalid imports are atomic");
  }
  binding.dispose(); binding.dispose(); assert.equal(listener, null); assert.equal(equipmentListener, null);
  assert(classic && keepnet);
  for (const listeners of s.doc.listeners.values()) assert.equal(listeners.size, 0);
  const fs = require("node:fs");
  const path = require("node:path");
  const css = fs.readFileSync(path.join(__dirname, "../../../src/game/presentation/styles/inventory/inventory-selector.css"), "utf8");
  assert.ok(css.includes("border-width: calc(0.025 * var(--inventory-selector-drawing-unit))"),
    "open central button matches the visible border width of the expanded sectors");
}
checkComposition().then(() => console.log("Inventory selector passed: geometry, all release targets, hover, keyboard, capture, motion, coordinates, live sizes, overrides and disposal."))
  .catch(error => { console.error(error); process.exitCode = 1; });
