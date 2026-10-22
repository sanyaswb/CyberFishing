"use strict";
const assert = require("node:assert/strict");
const { TestDocument } = require("../../testing/keepnet/test_document.js");
const { InventorySelectorGeometry } = require("../../../src/game/presentation/inventory/inventory_selector_geometry.js");
const { INVENTORY_SELECTOR_CONFIG } = require("../../../src/game/presentation/inventory/inventory_selector_config.js");
const { CONFIG } = require("../../../src/game/config/runtime/game_config.js");
assert.equal(CONFIG.ui.inventorySelector.radialEnabled, true, "radial design is enabled by default");
assert.equal(CONFIG.ui.inventorySelector.size, 1, "initial size defaults to standard");
assert.equal(CONFIG.ui.inventorySelector.openSize, 3, "open size defaults independently to large");
assert.equal(CONFIG.ui.inventorySelector.compactShape, "half", "compact toolbars default to the half fan");

const geometries = Object.fromEntries(Object.keys(INVENTORY_SELECTOR_CONFIG.layouts)
  .map(layout => [layout, new InventorySelectorGeometry(INVENTORY_SELECTOR_CONFIG, layout)]));
const geometry = geometries.corner;
assert.deepEqual(geometry.box, { minX: -2.1, minY: -2.1, maxX: 0, maxY: 0 }, "the corner fan keeps its quarter-disk drawing box");
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
// TK-034: compact fans are mirror-symmetric about the vertical through the central button.
for (const [layout, sweep] of [["half", 180], ["arc", 120]]) {
  const fan = geometries[layout];
  const [left, middle, right] = fan.sectors;
  assert(Math.abs(middle.center.x) < 1e-12, `${layout}: the middle petal stands upright`);
  assert.equal(left.points.length, right.points.length);
  for (const point of left.points) {
    assert(right.points.some(other => Math.abs(point.x + other.x) < 1e-9 && Math.abs(point.y - other.y) < 1e-9),
      `${layout}: the left and right petals are mirror images`);
  }
  assert(Math.abs(fan.box.minX + fan.box.maxX) < 1e-12 && Math.abs(fan.retentionBox.minX + fan.retentionBox.maxX) < 1e-12,
    `${layout}: drawing and retention boxes are centred on the button`);
  assert(Math.abs(fan.innerRadius - fan.centralRadius - INVENTORY_SELECTOR_CONFIG.gap) < 1e-12);
  for (let index = 0; index < 3; index++) {
    assert.equal(fan.hitTest(fan.sectors[index].center.x, fan.sectors[index].center.y), index, `${layout}: petal ${index} is selectable`);
  }
  const step = sweep / 3, start = (180 - sweep) / 2, mid = (fan.innerRadius + fan.radius) / 2;
  for (let k = 0; k <= 3; k++) {
    const angle = (start + k * step) * Math.PI / 180;
    assert.equal(fan.hitTest(-mid * Math.cos(angle), -mid * Math.sin(angle)), -1, `${layout}: radial gaps are not selectable`);
  }
  assert.equal(fan.hitTest(0, -fan.centralRadius / 2), -1, `${layout}: the central button is not a petal`);
  assert(fan.contains(0, -fan.radius) && !fan.contains(0, -fan.retentionRadius - 0.05), `${layout}: retention ends above the arc`);
  assert(Math.abs(fan.extent.width - (fan.retentionBox.maxX - fan.retentionBox.minX)) < 1e-12);
}
assert.deepEqual(geometries.half.central.box, { minX: -0.5, minY: -0.5, maxX: 0.5, maxY: 0 }, "half: the open central button is the lower half disk");
assert(Math.abs(geometries.half.central.center.y + 2 / (3 * Math.PI)) < 1e-12, "half: its symbol sits at the half-disk centroid");
assert.deepEqual(geometries.arc.central.box, { minX: -0.5, minY: -0.5, maxX: 0.5, maxY: 0.5 }, "arc: the open central button is the whole disk");
assert(Math.abs(geometries.half.extent.height - geometries.half.retentionRadius) < 1e-12, "half: the fan rises from the toolbar bottom");
assert(Math.abs(geometries.arc.extent.height - geometries.arc.retentionRadius - 0.5) < 1e-12, "arc: the fan rises from the button centre");
assert(geometries.arc.extent.width < geometries.half.extent.width, "the arc is narrower than the half fan");
// TK-037: the left corner fan mirrors the corner fan petal by petal (the same section stays beside the ground).
{
  const left = geometries["corner-left"];
  for (let index = 0; index < 3; index++) {
    const a = geometry.sectors[index], b = left.sectors[index];
    assert(Math.abs(a.center.x + b.center.x) < 1e-12 && Math.abs(a.center.y - b.center.y) < 1e-12, `petal ${index} is mirrored`);
    for (const point of a.points) {
      assert(b.points.some(other => Math.abs(point.x + other.x) < 1e-9 && Math.abs(point.y - other.y) < 1e-9), "mirrored outline");
    }
    assert.equal(left.hitTest(b.center.x, b.center.y), index);
  }
  assert(Math.abs(left.central.center.x + geometry.central.center.x) < 1e-12, "the open central quarter disk is mirrored");
  assert(left.contains(0.7, -0.7) && !left.contains(-0.7, -0.7) && !left.contains(2.1, -2.1), "retention covers only the mirrored quarter");
  assert(Math.abs(left.extent.width - geometry.extent.width) < 1e-12 && Math.abs(left.extent.height - geometry.extent.height) < 1e-12);
}
const { InventorySelectorRenderer } = require("../../../src/game/presentation/inventory/inventory_selector_renderer.js");
const { InventorySelectorController } = require("../../../src/platform/browser/dom/inventory_selector_controller.js");
const { InventoryDomFactory } = require("../../../src/platform/browser/dom/inventory_dom_factory.js");
const { INVENTORY_SECTIONS } = require("../../../src/game/presentation/inventory/inventory_sections.js");
const { INVENTORY_SELECTOR_LABELS } = require("../../../src/game/presentation/inventory/inventory_selector_labels.js");
const { composeInventorySelector } = require("../../../src/bootstrap/production/inventory_selector_composition.js");
const { InventorySelectorConfigValidator } = require("../../../src/game/config/validation/inventory_selector_config_validator.js");
const { createRuntimeConfigContext } = require("../../../src/bootstrap/production/config_context.js");

function scenario({ width = 320, size = 1, openSize = size, hover = false, reduced = false, layout = "corner",
  compact = layout !== "corner" } = {}) {
  const doc = new TestDocument(), windowEvents = new TestDocument(), motion = new TestDocument();
  const slot = { layout: compact ? "compact" : "" };
  let time = 0, reads = 0, captured = null, mutationCallback, moved = 0;
  const animations = [];
  doc.body.nodeType = 1;
  motion.matches = reduced;
  doc.defaultView = { performance: { now: () => time },
    addEventListener: (...args) => windowEvents.addEventListener(...args),
    removeEventListener: (...args) => windowEvents.removeEventListener(...args),
    matchMedia: () => motion,
    getComputedStyle: node => ({ display: node.hidden ? "none" : "block", transitionDuration: "0.2s", transitionTimingFunction: "linear",
      getPropertyValue: name => name === "--inventory-selector-layout" ? slot.layout : "" }),
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
  const view = new InventorySelectorRenderer({ domFactory: new InventoryDomFactory(doc), geometries,
    compactLayout: compact ? layout : "half",
    sections: INVENTORY_SECTIONS, labels: INVENTORY_SELECTOR_LABELS, keepnetImage: "assets/items/keepnet/keepnet--0.webp", id: "test-sections" });
  view.setSizeScales(INVENTORY_SELECTOR_CONFIG.sizeScales[size], INVENTORY_SELECTOR_CONFIG.sizeScales[openSize]);
  doc.body.appendChild(view.element);
  // The fan centre stays at logical (300, 500); the root box lies around it by the layout's origin share.
  view.element.getBoundingClientRect = () => {
    reads++;
    const current = 48 * INVENTORY_SELECTOR_CONFIG.sizeScales[view.expanded ? openSize : size];
    const origin = geometries[view.layout].origin;
    return { left: moved + 17 + (300 - current * origin.x) * scale,
      top: 29 + (500 - current * origin.y) * scale, width: current * scale, height: current * scale };
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
  return { doc, view, controller, surface, selected, fire, position, metrics, slot,
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

// TK-034/037: compact toolbars (<=820 px) place the fan in the centre or a bottom corner; release selects in
// every compact layout and size pair.
for (const layout of ["half", "arc", "corner", "corner-left"]) for (const width of [240, 320, 820]) for (const [size, openSize] of [[1, 3], [3, 1], [2, 2]]) {
  for (let index = 0; index < 3; index++) {
    const s = scenario({ width, size, openSize, layout, compact: true });
    const fan = geometries[layout];
    s.fire("pointerdown"); s.advance();
    assert.equal(s.view.layout, layout, "the toolbar slot selects the compact fan on opening");
    assert(s.view.compact, "the selector knows it opened in the compact slot");
    assert(s.view.element.classList.contains(`inventory-selector--${layout}`));
    s.fire("pointermove", fan.sectors[(index + 1) % 3].center);
    s.fire("pointermove", fan.sectors[index].center);
    assert(s.view.buttons[index].classList.contains("inventory-selector__section--highlighted"));
    s.fire("pointerup", fan.sectors[index].center);
    assert.deepEqual(s.selected, [INVENTORY_SECTIONS.items[index].id], `${layout} ${width}px ${size}->${openSize}: release selects petal ${index}`);
    assert.equal(s.reads(), 1, "compact moves and release never measure DOM");
    s.dispose();
  }
}
{
  const s = scenario({ layout: "arc" });
  s.fire("pointerdown"); s.advance();
  s.fire("pointerup", { x: 0, y: 0 });
  assert.deepEqual(s.selected, [], "the round central button is not a petal");
  s.slot.layout = "";
  s.fire("pointerdown"); s.advance();
  assert.equal(s.view.layout, "corner", "a wide toolbar restores the corner fan");
  s.fire("pointerup", geometry.sectors[1].center);
  assert.deepEqual(s.selected, ["backpack"]);
  s.view.setCompactLayout("half"); s.slot.layout = "compact";
  s.fire("pointerdown"); s.advance();
  assert.equal(s.view.layout, "half", "the configured compact shape applies on the next opening");
  const outside = s.doc.fire("pointerdown", { target: s.doc.body, preventDefault() { this.prevented = true; } });
  assert(!s.view.expanded && outside.stopped && outside.prevented, "a press beside the open compact fan only closes it");
  const idle = s.doc.fire("pointerdown", { target: s.doc.body });
  assert(!idle.stopped, "a closed selector never consumes presses");
  s.dispose();
}
{
  const s = scenario({ width: 1280 }); s.fire("pointerdown"); s.advance();
  const outside = s.doc.fire("pointerdown", { target: s.doc.body });
  assert(!s.view.expanded && !outside.stopped, "wide toolbars keep their outside presses");
  s.dispose();
}
{
  const s = scenario({ layout: "corner", compact: true }); s.fire("pointerdown"); s.advance();
  const outside = s.doc.fire("pointerdown", { target: s.doc.body });
  assert(!s.view.expanded && outside.stopped, "a compact corner fan also makes its neighbours inactive");
  s.slot.layout = ""; s.fire("pointerdown"); s.advance();
  assert(!s.view.compact && s.view.layout === "corner", "the same corner geometry is wide again on a wide toolbar");
  assert(!s.doc.fire("pointerdown", { target: s.doc.body }).stopped);
  s.dispose();
}

async function checkComposition() {
  const s = scenario(); s.controller.dispose(); s.view.dispose();
  const editor = { scroll: 123, filters: "rods" };
  const config = { ui: { inventorySelector: { ...CONFIG.ui.inventorySelector } } };
  const ctx = createRuntimeConfigContext(config, { validateOverrides: InventorySelectorConfigValidator.validateOverrides,
    resetOnImport: ["ui.inventorySelector.radialEnabled", "ui.inventorySelector.size", "ui.inventorySelector.openSize",
      "ui.inventorySelector.compactShape", "ui.inventorySelector.compactPlacement", "ui.inventorySelector.compactActionsSide"] });
  let classic, keepnet, listener, equipmentListener, finishArtwork, finishSelector, artworkLoads = 0;
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
      if (records.length === 3) return new Promise(resolve => { finishSelector = resolve; });
      artworkLoads++; return new Promise(resolve => { finishArtwork = resolve; });
    } }, logger: { warn: assert.fail } });
  binding.view.element.getBoundingClientRect = () => ({ left: 218.4, top: 418.4, width: 81.6, height: 81.6 });
  assert.equal(classic, false, "radial startup must never expose the classic backpack while artwork is pending");
  assert.equal(keepnet, false, "the classic keepnet must also stay hidden during radial preload");
  assert(!binding.view.enabled, "the radial control waits for its artwork");
  config.ui.inventorySelector.radialEnabled = false; s.doc.fire("config-updated");
  assert(classic && keepnet && !binding.view.enabled, "classic mode remains usable while preload is pending");
  config.ui.inventorySelector.radialEnabled = true; s.doc.fire("config-updated");
  assert(!classic && !keepnet && !binding.view.enabled, "returning to radial hides classic controls before readiness");
  finishSelector();
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
  const compactWidth = () => Number(binding.view.element.style.getPropertyValue("--inventory-selector-compact-width"));
  assert.equal(compactWidth(), geometries.half.extent.width, "the compact slot is sized for the half fan by default");
  binding.controller.openKeyboard();
  ctx.set("ui.inventorySelector.compactShape", "arc"); s.doc.fire("config-updated");
  assert(!binding.view.expanded, "a shape edit cancels stale geometry");
  assert.equal(compactWidth(), geometries.arc.extent.width, "DevTools switches the compact fan live");
  // TK-037: placement and action column; a corner selector always puts the column on the other side.
  const classes = () => binding.view.element.className.split(" ").filter(name => /--(slot|actions)-/.test(name)).sort();
  assert.deepEqual(classes(), ["inventory-selector--actions-right", "inventory-selector--slot-center"]);
  for (const [placement, side, expected, layout] of [
    ["right", "right", ["inventory-selector--actions-left", "inventory-selector--slot-right"], "corner"],
    ["left", "left", ["inventory-selector--actions-right", "inventory-selector--slot-left"], "corner-left"],
    ["center", "left", ["inventory-selector--actions-left", "inventory-selector--slot-center"], "arc"],
  ]) {
    binding.controller.openKeyboard();
    ctx.set("ui.inventorySelector.compactPlacement", placement); ctx.set("ui.inventorySelector.compactActionsSide", side);
    s.doc.fire("config-updated");
    assert(!binding.view.expanded, "a placement edit cancels stale geometry");
    assert.deepEqual(classes(), expected, `${placement}/${side}: selector and column placement`);
    assert.equal(compactWidth(), geometries[layout].extent.width, `${placement}: the slot is sized for its fan`);
  }
  const exported = ctx.exportOverrides();
  ctx.resetAll(); s.doc.fire("config-updated"); assert(!classic && binding.view.enabled);
  ctx.importOverrides(exported); s.doc.fire("config-updated"); assert(binding.view.enabled);
  assert.equal(config.ui.inventorySelector.size, 3);
  assert.equal(config.ui.inventorySelector.openSize, 1, "both sizes survive export/import");
  assert.equal(config.ui.inventorySelector.compactShape, "arc", "the compact shape survives export/import");
  assert.equal(config.ui.inventorySelector.compactActionsSide, "left", "the column side survives export/import");
  ctx.importOverrides({}); s.doc.fire("config-updated"); assert(!classic && binding.view.enabled);
  assert.equal(config.ui.inventorySelector.size, 1);
  assert.equal(config.ui.inventorySelector.openSize, 3);
  assert.equal(config.ui.inventorySelector.compactShape, "half");
  assert.equal(compactWidth(), geometries.half.extent.width, "reset restores the half fan");
  assert.equal(config.ui.inventorySelector.compactPlacement, "center");
  assert.deepEqual(classes(), ["inventory-selector--actions-right", "inventory-selector--slot-center"], "reset restores the centre and right column");
  ctx.importOverrides({ "ui.inventorySelector.size": 2 });
  assert.equal(config.ui.inventorySelector.openSize, 3, "older scalar overrides retain the open default");
  ctx.resetAll();
  for (const data of [{ "ui.inventorySelector.size": 4 }, { "ui.inventorySelector.openSize": 0 },
    { "ui.inventorySelector.openSize": "3" }, { "ui.inventorySelector.radialEnabled": "true" },
    { "ui.inventorySelector.typo": true }, { "ui.inventorySelector": { radialEnabled: true, size: 2, openSize: 3, typo: 1 } },
    { "ui.inventorySelector.compactShape": "circle" }, { "ui.inventorySelector.compactPlacement": "top" },
    { "ui.inventorySelector.compactActionsSide": "center" }]) {
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
async function checkPreloadOutcomes() {
  for (const options of [
    { radial: false, fail: false, disposeEarly: false },
    { radial: true, fail: true, disposeEarly: false },
    { radial: true, fail: false, disposeEarly: true },
    { radial: true, fail: true, disposeEarly: true },
  ]) {
    const s = scenario(); s.controller.dispose(); s.view.dispose();
    const config = { ui: { inventorySelector: { radialEnabled: options.radial } } };
    let finish, fail, classic, keepnet, visibilityWrites = 0, warnings = 0;
    const binding = composeInventorySelector({
      documentRef: s.doc, windowRef: s.doc.defaultView, uiSurface: s.surface, mountNode: s.doc.body, config,
      inventoryUI: { setShortcutVisible: value => { classic = value; visibilityWrites++; },
        onVisibilityChange: () => () => {} },
      keepnetUI: { setShortcutVisible: value => { keepnet = value; visibilityWrites++; } },
      imageAssets: { preload: () => new Promise((resolve, reject) => { finish = resolve; fail = reject; }) },
      logger: { warn: () => { warnings++; } },
    });
    assert.equal(classic, !options.radial); assert.equal(keepnet, classic);
    assert(!binding.view.enabled);
    if (options.disposeEarly) binding.dispose();
    const beforeCompletion = visibilityWrites;
    if (options.fail) fail(new Error("deterministic preload failure"));
    else finish();
    assert.equal(await binding.ready, !options.fail);
    if (options.disposeEarly) {
      assert.equal(visibilityWrites, beforeCompletion, "late preload completion cannot alter disposed controls");
      assert.equal(warnings, 0);
    } else {
      assert(classic && keepnet && !binding.view.enabled, "explicit classic or failed artwork leaves usable classic shortcuts");
      assert.equal(warnings, Number(options.fail));
      s.doc.fire("config-updated");
      assert(classic && keepnet && !binding.view.enabled, "config refresh preserves the failed-artwork fallback");
    }
    binding.dispose();
    for (const listeners of s.doc.listeners.values()) assert.equal(listeners.size, 0);
  }
}
checkComposition().then(checkPreloadOutcomes).then(() => console.log("Inventory selector passed: geometry, all release targets, hover, keyboard, capture, motion, coordinates, live sizes, overrides, pending preload/fallback and disposal."))
  .catch(error => { console.error(error); process.exitCode = 1; });
