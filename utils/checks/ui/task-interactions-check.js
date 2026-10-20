"use strict";
const assert = require("node:assert/strict");
const { TestDocument } = require("../../testing/keepnet/test_document.js");
const { HorizontalScrollController } = require("../../../src/platform/browser/dom/horizontal_scroll_controller.js");
const { SwipePagerController } = require("../../../src/platform/browser/dom/swipe_pager_controller.js");

const documentRef = new TestDocument();
function surface() {
  const node = documentRef.createElement("div");
  node.layoutWidth = node.clientWidth = 600;
  node.scrollWidth = 1200;
  node.scrollLeft = 100;
  node.capture = null;
  node.setPointerCapture = id => { node.capture = id; };
  node.hasPointerCapture = id => node.capture === id;
  node.releasePointerCapture = () => { node.capture = null; };
  return node;
}

for (const pointerType of ["mouse", "touch"]) {
  const row = surface();
  const scroll = new HorizontalScrollController();
  scroll.attach(row);
  row.fire("pointerdown", { pointerId: 1, pointerType, button: 0, clientX: 200, clientY: 50 });
  assert.equal(row.fire("dragstart").prevented, true, "native image drag cannot steal the row gesture");
  row.fire("pointermove", { pointerId: 1, pointerType, clientX: 100, clientY: 50 });
  if (pointerType === "mouse") assert.equal(row.scrollLeft, 200);
  row.fire("lostpointercapture", { type: "lostpointercapture", pointerId: 1, target: documentRef.createElement("button") });
  row.fire("pointermove", { pointerId: 1, pointerType, clientX: 80, clientY: 50 });
  if (pointerType === "mouse") assert.equal(row.scrollLeft, 220, "a child losing capture does not cancel its parent's drag");
  row.fire("pointerup", { pointerId: 1 });
  scroll.detach(row);
  assert.equal(row.capture, null);
  assert.equal([...row.listeners.values()].reduce((n, set) => n + set.size, 0), 0);

  const preview = surface();
  let index = 1;
  const pager = new SwipePagerController({ positionProperty: null });
  pager.attach(preview, { pageCount: 3, getIndex: () => index, onSelect: value => { index = value; } });
  preview.fire("pointerdown", { pointerId: 2, pointerType, button: 0, clientX: 400, clientY: 50 });
  assert.equal(preview.fire("dragstart").prevented, true, "native artwork drag cannot cancel the preview swipe");
  preview.fire("pointermove", { pointerId: 2, clientX: 200, clientY: 50 });
  preview.fire("pointerup", { type: "pointerup", pointerId: 2, clientX: 200, clientY: 50 });
  assert.equal(index, 2);
  assert.equal(preview.capture, null);
  preview.fire("pointerdown", { pointerId: 3, pointerType, button: 0, clientX: 200, clientY: 50 });
  preview.fire("pointermove", { pointerId: 3, clientX: 400, clientY: 50 });
  pager.detach(preview);
  assert.equal(index, 2, "detach never commits a partial swipe");
  assert.equal(preview.capture, null);
  assert.equal([...preview.listeners.values()].reduce((n, set) => n + set.size, 0), 0);
}
const { CastPowerAim } = require("../../../src/game/application/casting/cast_power_aim.js");
const aimConfig = { casting: { pointerAim: { maxLeadPx: 80, rampDistancePx: 100 }, edgeScrollCenterRatio: 1 } };
const aimViewport = { width: 400, height: 600 };
const aimPans = [];
const aimBounds = { left: 0, right: 400, top: 0, bottom: 1000 };
const aimEdges = { left: true, right: true };
const aimProjector = {
  virtualToScreen: (x, y, out) => Object.assign(out, { x, y }),
  screenToVirtual: (x, y, out) => Object.assign(out, { x, y }),
  getScale: () => 1,
  isAtHorizontalEdge: direction => direction < 0 ? aimEdges.left : direction > 0 && aimEdges.right,
};
const aimMetric = { topBasePixels: 1000, virtualPixelsFromShore: value => value,
  yAtBasePixels: value => 1000 - value, distanceBasePixels: (x, y, ox, oy) => Math.hypot(x - ox, y - oy) };
const aim = new CastPowerAim({ config: aimConfig, getViewportSize: () => aimViewport,
  projector: aimProjector, getWaterMetric: () => aimMetric, panViewport: delta => aimPans.push(delta),
  rng: { next: () => 0.5 } });
const start = { x: 40, y: 200 };
function aimAt(x) {
  aim.update({ pointerDown: true, pointerStart: start, pointerCurrent: { x, y: 200 } }, null, 16);
  return aim.getVisualState().screenX;
}
aimEdges.left = aimEdges.right = false;
assert.equal(aimAt(250), 250, "G-090: pointer aim has no lead while the viewport can still pan right");
assert.equal(aimAt(150), 150, "pointer aim has no lead while the viewport can still pan left");
aimEdges.right = true;
assert.equal(aimAt(250), 290, "the right camera edge enables the existing right-half lead curve");
assert.equal(aimAt(150), 150, "the right camera edge does not enable left-half lead");
assert.equal(aimAt(200), 200);
aimEdges.right = false;
aimEdges.left = true;
assert.equal(aimAt(150), 110, "the left camera edge enables only left-half lead");
assert.equal(aimAt(250), 250);
aimEdges.left = false;
assert.equal(aimAt(150), 150, "moving the camera away from an edge disables its lead immediately");
aimEdges.right = true;
aimAt(250);
aimEdges.right = false;
assert.equal(aim.update({ pointerReleased: true, pointerRelease: { x: 250, y: 300 } }, null, 16).screenX, 250,
  "release rechecks the real edge instead of retaining a previous lead");
aim.reset();
aimEdges.left = aimEdges.right = true;
aimAt(40);
assert.equal(aimAt(300), 380);
assert.equal(aimAt(200), 200, "G-088: returning from the right edge recentres at viewport midpoint after a left-side start");
for (const [startX, initialAimX] of [[40, 0], [150, 110], [200, 200], [250, 290], [360, 400]]) {
  aim.reset();
  start.x = startX;
  assert.equal(aimAt(startX), initialAimX, "the first pointerdown already uses the viewport-centred mapping");
  for (const [pointerX, aimX] of [[200, 200], [250, 290], [300, 380], [320, 400], [400, 400],
    [250, 290], [200, 200], [150, 110], [100, 20], [80, 0], [0, 0], [200, 200]]) {
    assert.equal(aimAt(pointerX), aimX, `start ${startX}: viewport-centred mapping at ${pointerX}`);
  }
}
for (const offset of [0.01, 1, 25, 50, 99]) {
  const left = aimAt(200 - offset), right = aimAt(200 + offset);
  assert(Math.abs(left + right - 400) < 1e-9, "lead stays symmetric and continuous through centre on reversal");
  assert(right >= 200 + offset && right <= 200 + offset + 80);
}
aimAt(250);
const centreRelease = aim.update({ pointerReleased: true, pointerRelease: { x: 200, y: 300 } }, null, 16);
assert.equal(centreRelease.screenX, 200, "release at centre recentres without a final move event");
assert.equal(centreRelease.power, 0.5, "vertical power keeps its existing formula");
aim.reset();
start.x = 40;
aimAt(200);
const release = aim.update({ pointerReleased: true, pointerRelease: { x: 250, y: 300 } }, null, 16);
assert.equal(release.screenX, 290, "release uses the same mapping without a final move event");
assert.equal(release.startX, 40, "contact metadata is preserved without owning horizontal lead");
const target = aim.resolveTarget(release, { bounds: aimBounds, maxDistance: 600, accuracyPx: 0,
  accuracyPercent: 0, checkWater: () => ({ depth: 2 }) });
aim.update({ pointerDown: true, pointerStart: start, pointerCurrent: { x: 250, y: 300 } }, null, 16);
const preview = aim.getAccuracyPreview(aimBounds, 600, 0, 0);
assert.equal(preview.x, release.screenX, "accuracy preview shares the release coordinate");
assert.equal(target.success, true);
assert.equal(target.x, preview.x);
assert.equal(target.rodScreenX, preview.x, "resolved cast target and rod origin agree with preview");
aim.reset();
aimConfig.casting.edgeScrollCenterRatio = 0.3;
assert.equal(aimAt(250), 290);
assert(Math.abs(aimPans.at(-1) - 900 * Math.pow(30 / 140, 1.6) * 0.016) < 1e-9,
  "edge pan follows the led coordinate rather than the contact or raw pointer");
aimConfig.casting.edgeScrollCenterRatio = 1;
aimViewport.width = 640;
assert.equal(aimAt(320), 320, "an active gesture follows the resized game viewport centre");
assert.equal(aimAt(370), 410);
aimViewport.width = 320;
assert.equal(aimAt(160), 160, "a narrow playable viewport uses its own midpoint");
assert.equal(aimAt(210), 250);
aimViewport.width = 400;
aim.reset();
aimConfig.casting.pointerAim.maxLeadPx = 0;
assert.equal(aimAt(250), 250, "a live zero lead restores the original pointer mapping");
delete aimConfig.casting.pointerAim;
assert.equal(aimAt(250), 290, "the default is 80 logical pixels when pointer configuration is absent");
aim.reset();
aim.update({ isPulling: true, aimRight: true }, null, 16);
assert(Math.abs(aim.getVisualState().screenX - 206.72) < 1e-9, "keyboard keeps its 420px/s aim without pointer lead");
assert(Math.abs(aim.update({}, null, 16).screenX - 206.72) < 1e-9);

const { ViewportProjector } = require("../../../src/game/application/viewport/viewport_projector.js");
const edgeViewport = { width: 400, height: 600 };
const edgeProjector = new ViewportProjector({ baseResolution: { width: 1000, height: 1000 },
  map: { lake: { safeZone: { top: 0, bottom: 600 } } } }, "lake", () => ({ scale: 1, squashY: 1 }));
edgeProjector.update(edgeViewport.width, edgeViewport.height);
const edgeAim = new CastPowerAim({ config: { casting: { edgeScrollCenterRatio: 0.3 } }, projector: edgeProjector,
  getViewportSize: () => edgeViewport, panViewport: delta => edgeProjector.pan(delta) });
function edgeAimAt(x) {
  edgeAim.update({ pointerDown: true, pointerStart: { x: 200, y: 200 }, pointerCurrent: { x, y: 200 } }, null, 16);
  return edgeAim.getVisualState().screenX;
}
assert.equal(edgeProjector.isAtHorizontalEdge(-1), false);
assert.equal(edgeProjector.isAtHorizontalEdge(1), false);
assert.equal(edgeProjector.isAtHorizontalEdge(0), false);
assert.equal(edgeAimAt(300), 300, "real camera movement keeps raw pointer aim before reaching a limit");
edgeProjector.pan(1e6);
assert.equal(edgeProjector.isAtHorizontalEdge(1), true);
assert.equal(edgeProjector.isAtHorizontalEdge(-1), false);
assert.equal(edgeAimAt(250), 290);
assert.equal(edgeAimAt(150), 150, "the actual right stop never enables a left lead");
assert.equal(edgeAimAt(200), 200);
assert.equal(edgeAimAt(100), 100, "pan away from the right stop uses raw left-half aim");
assert.equal(edgeProjector.isAtHorizontalEdge(1), false);
assert.equal(edgeAimAt(250), 250, "no stale lead survives departure from the stop");
edgeProjector.pan(-1e6);
assert.equal(edgeProjector.isAtHorizontalEdge(-1), true);
assert.equal(edgeProjector.isAtHorizontalEdge(1), false);
assert.equal(edgeAimAt(150), 110);
assert.equal(edgeAimAt(250), 250);
assert.equal(edgeAimAt(300), 300);
assert.equal(edgeProjector.isAtHorizontalEdge(-1), false);
assert.equal(edgeAimAt(150), 150);
edgeProjector.pan(1e6); edgeProjector.pan(-1);
assert.equal(edgeProjector.isAtHorizontalEdge(1), false);
assert.equal(edgeAimAt(350), 400, "the same update that reaches the real right camera limit enables its lead");
assert.equal(edgeProjector.isAtHorizontalEdge(1), true);
edgeProjector.pan(-1e6); edgeProjector.pan(1);
assert.equal(edgeAimAt(50), 0, "the same update that reaches the left limit enables left lead");
assert.equal(edgeProjector.isAtHorizontalEdge(-1), true);
edgeViewport.width = 1600;
edgeProjector.update(edgeViewport.width, edgeViewport.height);
assert.equal(edgeProjector.isAtHorizontalEdge(-1), true);
assert.equal(edgeProjector.isAtHorizontalEdge(1), true);
assert.equal(edgeAimAt(750), 710, "a whole-location view has both limits and keeps the centred curve");
assert.equal(edgeAimAt(850), 890);
edgeViewport.width = 320;
edgeProjector.update(edgeViewport.width, edgeViewport.height);
assert.equal(edgeProjector.isAtHorizontalEdge(1), false);
assert.equal(edgeAimAt(210), 210, "a resized narrow game strip uses its real camera limits, without viewport-width guesses");
const unknownEdgeAim = new CastPowerAim({ config: {}, getViewportSize: () => edgeViewport });
unknownEdgeAim.update({ pointerDown: true, pointerStart: start, pointerCurrent: { x: 250, y: 200 } }, null, 16);
assert.equal(unknownEdgeAim.getVisualState().screenX, 250, "missing camera-edge information never enables lead");

class Timers {
  now = 0;
  next = 0;
  jobs = new Map();
  setTimeout(callback, delay) { const id = ++this.next; this.jobs.set(id, { callback, at: this.now + delay }); return id; }
  clearTimeout(id) { this.jobs.delete(id); }
  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      const next = [...this.jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.now = next[1].at; this.jobs.delete(next[0]); next[1].callback();
    }
    this.now = end;
  }
}

const { InventoryDomFactory } = require("../../../src/platform/browser/dom/inventory_dom_factory.js");
const { composeHintRenderer } = require("../../../src/bootstrap/production/hint_renderer_composition.js");
function hintSurface(initialWidth = 600) {
  let width = initialWidth;
  const subscribers = new Set();
  return { subscribers, getMetrics: () => ({ logicalWidth: Math.max(320, width) }),
    physicalToLogicalDelta: ({ y }) => ({ y }),
    subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    resize(nextWidth) { width = nextWidth; for (const callback of subscribers) callback(); } };
}
const sheetTimers = new Timers();
const mobileHintSurface = hintSurface();
const hints = composeHintRenderer({ domFactory: new InventoryDomFactory(documentRef), timers: sheetTimers, uiSurface: mobileHintSurface });
const hint = hints.create({ closeLabel: "Close" });
documentRef.body.append(hint);
hint.getBoundingClientRect = () => ({ height: 200 });
const text = hint.children[0];
const drag = (dy, target = hint, cancel = false) => {
  hint.fire("pointerdown", { pointerId: 1, clientX: 0, clientY: 0, target });
  hint.fire("pointermove", { pointerId: 1, clientX: 0, clientY: dy, target });
  hint.fire(cancel ? "pointercancel" : "pointerup", { pointerId: 1, clientX: 0, clientY: dy, target });
};
hints.show(hint, "First");
assert(hint.classList.contains("ui-hint--sheet"));
drag(19); sheetTimers.advance(200); assert(!hint.hidden);
drag(20); assert(hint.classList.contains("ui-hint--closing")); sheetTimers.advance(200); assert(hint.hidden);
hints.show(hint, "Second");
hint.fire("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
sheetTimers.advance(6000); assert(!hint.hidden, "an active drag pauses automatic dismissal");
hint.fire("pointercancel", { pointerId: 1 });
sheetTimers.advance(4999); assert(!hint.hidden);
sheetTimers.advance(1); assert(hint.classList.contains("ui-hint--closing"));
const staleClose = [...sheetTimers.jobs.values()][0].callback;
hints.show(hint, "Replacement"); staleClose(); assert(!hint.hidden && hints.textOf(hint) === "Replacement");
text.scrollTop = 60; drag(20, text); assert.equal(text.scrollTop, 40); assert(!hint.classList.contains("ui-hint--closing"));
drag(80, hint, true); assert(!hint.hidden);
hints.dispose(hint); assert.equal(sheetTimers.jobs.size, 0);
assert.equal([...hint.listeners.values()].reduce((n, set) => n + set.size, 0), 0);

const scaledHints = composeHintRenderer({ domFactory: new InventoryDomFactory(documentRef), timers: sheetTimers,
  uiSurface: { ...hintSurface(240), physicalToLogicalDelta: ({ y }) => ({ y: y * 2 }) } });
const scaledHint = scaledHints.create({ closeLabel: "Close scaled" });
scaledHint.getBoundingClientRect = () => ({ height: 100 });
scaledHints.show(scaledHint, "Scaled");
scaledHint.fire("pointerdown", { pointerId: 4, clientX: 0, clientY: 0 });
scaledHint.fire("pointermove", { pointerId: 4, clientX: 0, clientY: 10 });
assert.equal(scaledHint.style.getPropertyValue("--ui-hint-drag-y"), "20px");
scaledHint.fire("pointerup", { pointerId: 4, clientX: 0, clientY: 10 });
sheetTimers.advance(200); assert(scaledHint.hidden, "the same 10% threshold survives UI surface scaling");
scaledHints.dispose(scaledHint);

const responsiveSurface = hintSurface(820);
const responsiveHints = composeHintRenderer({ domFactory: new InventoryDomFactory(documentRef), timers: sheetTimers,
  uiSurface: responsiveSurface, inlineDurationMs: 4000 });
const responsiveHint = responsiveHints.create({ closeLabel: "Responsive close" });
responsiveHint.getBoundingClientRect = () => ({ height: 200 });
responsiveHints.show(responsiveHint, "Boundary message");
assert(responsiveHint.classList.contains("ui-hint--sheet"), "820px retains the mobile bottom sheet");
responsiveHint.fire("pointerdown", { pointerId: 8, clientX: 0, clientY: 0 });
responsiveHint.fire("pointermove", { pointerId: 8, clientX: 0, clientY: 30 });
responsiveSurface.resize(821);
assert(!responsiveHint.classList.contains("ui-hint--sheet"), "G-089: above 820px the notice returns to its original inline mode");
assert(responsiveHint.children.find(node => node.classList.contains("ui-hint__handle")).hidden,
  "the desktop notice has no visible or focusable sheet handle");
assert.equal(responsiveHint.style.getPropertyValue("--ui-hint-drag-y"), "");
responsiveHint.fire("pointerup", { pointerId: 8, clientX: 0, clientY: 30 });
responsiveHint.fire("pointerdown", { pointerId: 9, clientX: 0, clientY: 0 });
responsiveHint.fire("pointermove", { pointerId: 9, clientX: 0, clientY: 100 });
responsiveHint.fire("pointerup", { pointerId: 9, clientX: 0, clientY: 100 });
assert(!responsiveHint.hidden && !responsiveHint.classList.contains("ui-hint--closing"), "desktop drag never dismisses a notice");
sheetTimers.advance(3999); assert(!responsiveHint.hidden);
sheetTimers.advance(1); assert(responsiveHint.hidden, "desktop House duration stays 4000ms without a sheet exit animation");
responsiveSurface.resize(820);
responsiveHints.show(responsiveHint, "Mobile again");
sheetTimers.advance(4999); assert(!responsiveHint.hidden);
sheetTimers.advance(1); assert(responsiveHint.classList.contains("ui-hint--closing"));
const responsiveStaleClose = [...sheetTimers.jobs.values()][0].callback;
responsiveSurface.resize(1280);
responsiveStaleClose();
assert(!responsiveHint.hidden && !responsiveHint.classList.contains("ui-hint--closing"), "resize cancels a stale mobile exit");
responsiveHints.dispose(responsiveHint);
assert.equal(responsiveSurface.subscribers.size, 0);
assert.equal(mobileHintSurface.subscribers.size, 0);
assert.equal(sheetTimers.jobs.size, 0);

const { InventoryUiState } = require("../../../src/game/application/inventory/inventory_ui_state.js");
const route = new InventoryUiState();
route.selectSection("backpack"); route.selectCategory("rods");
route.toggleSubfilter("float", true); route.toggleRarityFilter("rare", true);
route.toggleSortCriterion("quality"); route.selectSortDirection("descending");
const originalRoute = route.snapshot();
route.showAssemblyEditor("root");
const returnContext = route.editorReturnContext;
route.equipmentEquipped("float", "component");
route.showAssemblyEditor("root", { returnContext });
route.showAssemblyEditor("root"); route.backFromAssemblyEditor();
for (const key of ["activeSectionId", "activeCategoryId", "activeSubfilterIds", "activeRarityFilterIds", "sortCriterionIds", "sortDirectionId"])
  assert.deepEqual(route.snapshot()[key], originalRoute[key], "component updates retain the entry setting " + key);
route.showAssemblyEditor("root"); route.close(); route.selectSection("equipment"); route.open();
route.showAssemblyEditor("another"); route.backFromAssemblyEditor();
assert.equal(route.activeSectionId, "equipment", "closing ends the old route");

const { GameTimeClock } = require("../../../src/game/domain/time/game_time_clock.js");
const { EnvironmentSystem } = require("../../../src/game/application/world/environment_system.js");
const { composeDevTimeDisplay } = require("../../../src/bootstrap/development/dev_time_composition.js");
for (const interval of [299, 300, 301]) {
  const timers = new Timers();
  let calendarNow = 0;
  let saved;
  const clock = new GameTimeClock({ anchorHours: 12, anchorMs: 0, timeScale: 1,
    now: () => calendarNow, save: value => { saved = value; } });
  const doc = new TestDocument();
  const config = { debug: { timeAccelerationEnabled: true, timeScale: 1 } };
  const control = composeDevTimeDisplay({ documentRef: doc, mount: doc.body, clock, config, timers, nowMs: () => timers.now });
  const environment = new EnvironmentSystem({ weather: { chances: { rain: 0, fog: 0 }, updateIntervalMs: 1000 }, environment: {} },
    12, { chance: () => false }, { timePhases: { day: { startHour: 9, endHour: 21 }, night: { startHour: 21, endHour: 9 } } }, clock);
  const button = control.container;
  button.click(); timers.advance(interval); button.click();
  if (interval <= 300) {
    assert.equal(clock.getHours(), 19); assert.equal(clock.getRateMultiplier(), 1);
    timers.advance(1000);
    assert.equal(clock.getRateMultiplier(), 1, "double activation never performs single acceleration");
    for (const expected of [0, 12]) {
      calendarNow += 100;
      button.click(); timers.advance(100); button.click();
      assert.equal(clock.getHours(), expected, "elapsed time after evening must not skip midnight");
      environment.update(16, 1);
      assert.equal(environment.getSnapshot().phase, expected === 0 ? "night" : "day", "environment follows the phase anchor");
      if (expected === 0) {
        const reloadedNight = new GameTimeClock({ ...saved, now: () => calendarNow + 3600000 });
        assert.equal(reloadedNight.getHours(), 1, "reload continues from the persisted midnight anchor");
      }
      timers.advance(1000);
    }
    assert.equal(saved.timeScale, 1);
    assert.deepEqual(Object.keys(saved).sort(), ["anchorHours", "anchorMs", "timeScale"]);
    calendarNow += 3600000; assert.equal(clock.getHours(), 13);
    assert.equal(clock.setHours(NaN), false); assert.equal(clock.setHours(24), false);
    button.click(); control.suspend(); timers.advance(1000); assert.equal(clock.getRateMultiplier(), 1);
  } else {
    assert.equal(clock.getHours(), 12); assert.equal(clock.getRateMultiplier(), 1.5);
    timers.advance(301); assert.equal(clock.getRateMultiplier(), 2);
  }
  control.dispose(); assert.equal(timers.jobs.size, 0);
}

const { composeTimeDisplay } = require("../../../src/bootstrap/production/time_display_composition.js");
const phaseTimers = new Timers();
const { InventoryPickCancelController } = require("../../../src/platform/browser/dom/inventory_pick_cancel_controller.js");
for (const pointerType of ["mouse", "touch"]) {
  const timers = new Timers(), doc = new TestDocument();
  const root = doc.createElement("div"), target = doc.createElement("button");
  target.classList.add("inventory-slot--highlighted"); root.appendChild(target); doc.body.appendChild(root);
  let cancelled = 0;
  const controller = new InventoryPickCancelController({ timers, holdMs: 200, moveTolerancePx: 8 });
  controller.attach(root, { windowRef: doc, onCancel: () => { cancelled++; } });
  const down = fields => root.fire("pointerdown", { target, pointerType, button: 0, isPrimary: true,
    pointerId: 1, clientX: 10, clientY: 10, ...fields });
  down(); timers.advance(199); assert.equal(cancelled, 0);
  timers.advance(1); assert.equal(cancelled, 1, "pick cancellation fires at 200ms without the removal delay");
  assert(root.fire("click", { target }).prevented, "the hold consumes its following equip click");
  down(); root.fire("pointermove", { pointerId: 1, clientX: 20, clientY: 10 });
  timers.advance(300); assert.equal(cancelled, 1, "drag never cancels a pick");
  down(); root.fire("pointerup", { pointerId: 1 }); timers.advance(300);
  assert.equal(cancelled, 1, "short presses keep their normal activation");
  down(); root.fire("pointercancel", { pointerId: 1 }); timers.advance(300); assert.equal(cancelled, 1);
  down(); doc.fire("blur"); timers.advance(300); assert.equal(cancelled, 1);
  down({ isPrimary: false }); timers.advance(300); assert.equal(cancelled, 1);
  if (pointerType === "mouse") {
    assert(down({ button: 2 }).prevented); assert.equal(cancelled, 2, "right-click cancels immediately");
  }
  const before = cancelled;
  down(); target.remove(); timers.advance(300); assert.equal(cancelled, before, "stale target cannot cancel another selection");
  root.appendChild(target); down(); controller.dispose(); timers.advance(300); assert.equal(cancelled, before);
  assert.equal(timers.jobs.size, 0);
  assert.equal([...root.listeners.values()].reduce((total, handlers) => total + handlers.size, 0), 0);
}
let phaseSave = { anchorHours: 12, anchorMs: 0, timeScale: 1 };
const phaseClock = new GameTimeClock({ ...phaseSave, now: () => 0, save: value => { phaseSave = value; } });
const peerClock = new GameTimeClock({ ...phaseSave, now: () => 0, load: () => phaseSave });
const phaseDoc = new TestDocument();
const passiveView = composeTimeDisplay({ documentRef: phaseDoc, mount: phaseDoc.body, clock: phaseClock,
  timers: phaseTimers, nowMs: () => phaseTimers.now });
passiveView.container.fire("click", { detail: 1 }); passiveView.container.fire("click", { detail: 1 });
assert.equal(phaseClock.getHours(), 12, "production composition has no phase-changing capability");
assert.equal(phaseTimers.jobs.size, 0);
passiveView.dispose();
const phaseConfig = { debug: { timeAccelerationEnabled: false, timeScale: 1 } };
const phaseControl = composeDevTimeDisplay({ documentRef: phaseDoc, mount: phaseDoc.body, clock: phaseClock,
  config: phaseConfig, timers: phaseTimers, nowMs: () => phaseTimers.now });
const phaseView = phaseControl;
phaseControl.advancePhase();
phaseView.container.fire("click", { detail: 0 }); phaseView.container.fire("click", { detail: 0 });
assert.equal(phaseClock.getHours(), 12, "disabled DEV double activation cannot change hours");
assert.equal(phaseTimers.jobs.size, 0);
phaseConfig.debug.timeAccelerationEnabled = true;
phaseControl.update(phaseClock.getHours());
phaseView.container.fire("click", { detail: 1 });
phaseConfig.debug.timeAccelerationEnabled = false;
phaseControl.update(phaseClock.getHours());
assert.equal(phaseTimers.jobs.size, 0, "disabling cancels a pending single/double activation");
phaseConfig.debug.timeAccelerationEnabled = true;
phaseControl.update(phaseClock.getHours());
phaseView.container.fire("click", { detail: 0 }); phaseTimers.advance(100);
phaseConfig.debug.timeAccelerationEnabled = false;
phaseView.container.fire("click", { detail: 0 });
assert.equal(phaseClock.getHours(), 12, "the command rechecks the live flag before the next display update");
phaseControl.update(phaseClock.getHours());
phaseConfig.debug.timeAccelerationEnabled = true;
phaseControl.update(phaseClock.getHours());
phaseView.container.fire("click", { detail: 0 }); phaseTimers.advance(100);
phaseView.container.fire("click", { detail: 0 }); assert.equal(phaseClock.getHours(), 19, "keyboard click pairs share the production command");
peerClock.sync(); assert.equal(peerClock.getHours(), 19, "phase anchors synchronize even in the same millisecond");
const reload = new GameTimeClock({ ...phaseSave, now: () => 3600000 });
assert.equal(reload.getHours(), 20, "reload continues from the existing anchor shape");
phaseView.container.fire("click", { detail: 1 });
phaseView.container.fire("pointerdown", { pointerId: 5, clientX: 0, clientY: 0 });
phaseView.container.fire("pointermove", { pointerId: 5, clientX: 9, clientY: 0 });
phaseView.container.fire("pointerup", { pointerId: 5, clientX: 9, clientY: 0 });
phaseView.container.fire("click", { detail: 1 }); phaseTimers.advance(1000);
assert.equal(phaseClock.getHours(), 19, "movement rejects and cancels a pending pair");
phaseView.container.fire("pointerdown", { pointerId: 6, clientX: 0, clientY: 0 });
phaseView.container.fire("pointercancel", { pointerId: 6 });
phaseView.container.fire("click", { detail: 1 }); assert.equal(phaseTimers.jobs.size, 0);
phaseView.dispose();
console.log("Task interactions passed: wide gestures, pointer aiming, sheet thresholds/timers/scrolling and clock double activation.");
