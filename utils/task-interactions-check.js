"use strict";
const assert = require("node:assert/strict");
const { TestDocument } = require("./testing/keepnet/test_document.js");
const { HorizontalScrollController } = require("../src/platform/browser/dom/horizontal_scroll_controller.js");
const { SwipePagerController } = require("../src/platform/browser/dom/swipe_pager_controller.js");

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
const { CastPowerAim } = require("../src/game/application/casting/cast_power_aim.js");
const aimConfig = { casting: { pointerAim: { maxLeadPx: 100, rampDistancePx: 100 }, edgeScrollCenterRatio: 1 } };
const aim = new CastPowerAim({ config: aimConfig, getViewportSize: () => ({ width: 400, height: 600 }) });
const start = { x: 200, y: 200 };
function aimAt(x) {
  aim.update({ pointerDown: true, pointerStart: start, pointerCurrent: { x, y: 200 } }, null, 16);
  return aim.getVisualState().screenX;
}
assert.equal(aimAt(200), 200);
assert.equal(aimAt(250), 300, "half ramp leads the finger by 50 logical pixels");
assert.equal(aimAt(300), 400);
assert.equal(aimAt(150), 100);
assert.equal(aimAt(100), 0);
assert.equal(aimAt(200), 200);
const release = aim.update({ pointerReleased: true, pointerRelease: { x: 250, y: 300 } }, null, 16);
assert.equal(release.screenX, 300, "release uses the same mapping without a final move event");
aim.reset();
aimConfig.casting.pointerAim.maxLeadPx = 0;
assert.equal(aimAt(250), 250, "a live zero lead restores the original pointer mapping");
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

const { InventoryDomFactory } = require("../src/platform/browser/dom/inventory_dom_factory.js");
const { composeHintRenderer } = require("../src/bootstrap/production/hint_renderer_composition.js");
const sheetTimers = new Timers();
const hints = composeHintRenderer({ domFactory: new InventoryDomFactory(documentRef), timers: sheetTimers });
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
  uiSurface: { physicalToLogicalDelta: ({ y }) => ({ y: y * 2 }) } });
const scaledHint = scaledHints.create({ closeLabel: "Close scaled" });
scaledHint.getBoundingClientRect = () => ({ height: 100 });
scaledHints.show(scaledHint, "Scaled");
scaledHint.fire("pointerdown", { pointerId: 4, clientX: 0, clientY: 0 });
scaledHint.fire("pointermove", { pointerId: 4, clientX: 0, clientY: 10 });
assert.equal(scaledHint.style.getPropertyValue("--ui-hint-drag-y"), "20px");
scaledHint.fire("pointerup", { pointerId: 4, clientX: 0, clientY: 10 });
sheetTimers.advance(200); assert(scaledHint.hidden, "the same 10% threshold survives UI surface scaling");
scaledHints.dispose(scaledHint);

const { InventoryUiState } = require("../src/game/application/inventory/inventory_ui_state.js");
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

const { GameTimeClock } = require("../src/game/domain/time/game_time_clock.js");
const { composeDevTimeDisplay } = require("../src/bootstrap/development/dev_time_composition.js");
for (const interval of [299, 300, 301]) {
  const timers = new Timers();
  let calendarNow = 0;
  let saved;
  const clock = new GameTimeClock({ anchorHours: 12, anchorMs: 0, timeScale: 1,
    now: () => calendarNow, save: value => { saved = value; } });
  const doc = new TestDocument();
  const config = { debug: { timeAccelerationEnabled: true, timeScale: 1 } };
  const control = composeDevTimeDisplay({ documentRef: doc, mount: doc.body, clock, config, timers, nowMs: () => timers.now });
  const button = control.container;
  button.click(); timers.advance(interval); button.click();
  if (interval <= 300) {
    assert.equal(clock.getHours(), 19); assert.equal(clock.getRateMultiplier(), 1);
    timers.advance(1000);
    assert.equal(clock.getRateMultiplier(), 1, "double activation never performs single acceleration");
    for (const expected of [0, 12]) { button.click(); timers.advance(100); button.click(); assert.equal(clock.getHours(), expected); timers.advance(1000); }
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

const { composeTimeDisplay } = require("../src/bootstrap/production/time_display_composition.js");
const phaseTimers = new Timers();
let phaseSave = { anchorHours: 12, anchorMs: 0, timeScale: 1 };
const phaseClock = new GameTimeClock({ ...phaseSave, now: () => 0, save: value => { phaseSave = value; } });
const peerClock = new GameTimeClock({ ...phaseSave, now: () => 0, load: () => phaseSave });
const phaseDoc = new TestDocument();
const phaseView = composeTimeDisplay({ documentRef: phaseDoc, mount: phaseDoc.body, clock: phaseClock,
  timers: phaseTimers, nowMs: () => phaseTimers.now });
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
