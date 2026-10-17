const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");
const { TestDocument } = require("./testing/keepnet/test_document");

function eventTarget() {
  const handlers = new Map();
  return {
    clientWidth: 800,
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
    },
    removeEventListener(type, handler) { handlers.get(type)?.delete(handler); },
    emit(type, fields = {}) {
      const event = { type, pointerId: 1, clientX: 100, clientY: 100,
        preventDefault() { this.prevented = true; }, ...fields };
      for (const handler of handlers.get(type) || []) handler(event);
      return event;
    },
    setPointerCapture(id) { this.captured = id; },
    hasPointerCapture(id) { return this.captured === id; },
    releasePointerCapture() { this.captured = null; },
  };
}

const windowTarget = eventTarget();
let now = 1000;
const runtime = new SourceRuntime({ globals: {
  window: windowTarget,
  Date: class extends Date { static now() { return now; } },
  setTimeout: () => 1, clearTimeout() {},
} });
const { ScoutingState } = runtime.importModule("src/game/application/state/scouting_state.js");
const { InputController } = runtime.importModule("src/platform/browser/input/input_controller.js");
const { EventLifecycle } = runtime.importModule("src/engine/events/event_lifecycle.js");
const { GameViewportFacade } = runtime.importModule("src/game/presentation/viewport/game_viewport_facade.js");
const config = { casting: { enabled: true }, input: { pointerThreshold: 10,
  pullHoldMinMs: 120, keys: { pull: ["Space"] },
  mapPan: { inverted: true, sensitivity: 1, maxDistancePx: 0, wheelStepPx: 40 },
} };
let equipment = {}, warnings = 0, casts = 0;
const deps = {
  config, projector: { focusOnVirtualPos() {} }, rng: {},
  inventory: { getEquipped: () => equipment, evaluateCastReadiness: () => ({ canCast: !!equipment.rod }) },
  world: { getWaterMetric: () => ({}) }, getViewportSize: () => ({ width: 800, height: 600 }),
  isAimingChum: () => false, canPlayerCast: () => false,
  rules: { equipment: { requiresReel: () => false, hasEquippedLine: () => true, canSelectDepth: () => false } },
  commands: { showMissingRodInventoryWarning: () => warnings++, castLine: () => casts++, panViewport() {} },
  ui: { updateNetButtonState() {}, setScoutingPointerDimmed() {} },
  depthUI: { isActive: false }, currentHookDepthRef: { set() {} },
};
const scouting = new ScoutingState(deps);
scouting.enter();
scouting.update(16, { bottom: 600 }, { input: { pointerDown: true, isPulling: false } });
assert.equal(warnings, 0, "a pointer press must wait for click/scroll classification before opening Inventory");

const canvas = eventTarget();
const input = new InputController(canvas, null, { runtimeConfig: config, listeners: new EventLifecycle() });
input.setPointerPanEnabled(true);
const pans = [];
const viewport = new GameViewportFacade({ rodVisualOffsetSystem: new (runtime.importModule("src/game/application/fishing/rod_visual_offset_system.js").RodVisualOffsetSystem)(), config, world: { pan: (x, y) => pans.push([x, y]) } });
function frame() {
  const state = input.getState();
  viewport.applyPan(state, "scouting", false);
  scouting.update(16, { bottom: 600 }, { input: state });
  return state;
}

for (const pointerType of ["mouse", "touch"]) {
  canvas.emit("pointerdown", { pointerType });
  now += 1000;
  assert.equal(frame().isPulling, false, "waiting before dragging does not become a fishing hold");
  canvas.emit("pointermove", { clientX: 120, pointerType });
  canvas.emit("pointermove", { clientX: 160, pointerType });
  assert.equal(frame().panDeltaX, -60, "all pointer moves between frames accumulate");
  assert.equal(frame().panDeltaX, 0, "movement is consumed once");
  windowTarget.emit("pointerup", { clientX: 180, pointerType });
  const release = frame();
  assert.equal(release.panDeltaX, -20, "the release preserves movement after the last pointermove");
  assert.equal(release.clickPos, null);
  assert.equal(warnings, 0);
  assert.equal(canvas.captured, null);
}
assert.equal(pans[0][0], -60, "power casting permits explicit map navigation");
assert.equal(pans.every(([, y]) => y === 0), true, "the existing camera scroll remains horizontal");

canvas.emit("pointerdown");
canvas.emit("pointermove", { clientX: 105 });
windowTarget.emit("pointerup", { clientX: 105 });
assert(frame().clickPos, "movement within the configured tolerance is a click");
assert.equal(warnings, 1, "an actual map click still explains the missing rod");
canvas.emit("pointerdown");
windowTarget.emit("pointercancel");
assert.equal(frame().clickPos, null, "cancellation is never a click");
assert.equal(warnings, 1);

canvas.emit("pointerdown", { pointerType: "touch" });
canvas.emit("pointermove", { clientX: 200, pointerId: 2 });
windowTarget.emit("pointerup", { clientX: 200, pointerId: 2 });
windowTarget.emit("touchend", { pointerId: undefined });
assert.equal(frame().pointerDown, true, "a second finger cannot move or finish the primary gesture");
canvas.emit("pointermove", { clientY: 150 });
assert.equal(frame().panDeltaX, 0, "vertical navigation preserves horizontal camera ownership");
canvas.emit("pointermove");
windowTarget.emit("pointerup");
assert.equal(frame().clickPos, null, "a drag returning to its start cannot become a click");
assert.equal(warnings, 1);

config.input.mapPan.inverted = false;
config.input.mapPan.sensitivity = 2;
config.input.mapPan.maxDistancePx = 50;
canvas.emit("pointerdown");
canvas.emit("pointermove", { clientX: 130 });
assert.equal(frame().panDeltaX, 50, "inversion, sensitivity and gesture distance are configurable");
canvas.emit("pointermove", { clientX: 150 });
assert.equal(frame().panDeltaX, 0, "the drag distance limit holds across frames");
canvas.emit("pointermove", { clientX: 110 });
assert.equal(frame().panDeltaX, -30, "reversing a limited gesture moves back from its capped position");
windowTarget.emit("pointerup", { clientX: 110 }); frame();

const wheel = canvas.emit("wheel", { deltaX: 0, deltaY: 2, deltaMode: 1 });
assert.equal(wheel.prevented, true);
assert.equal(frame().panDeltaX, -160, "mouse wheel lines use the configured distance and sensitivity");
assert.equal(warnings, 1);
assert.equal(canvas.emit("wheel", { deltaY: 120, ctrlKey: true }).prevented, undefined, "Ctrl+wheel stays browser zoom");
canvas.emit("pointerdown");
canvas.emit("pointermove", { clientX: 130 });
windowTarget.emit("blur");
assert.equal(frame().panDeltaX, 0, "blur discards unfinished navigation");
assert.equal(canvas.captured, null);

equipment = { rod: {} };
input.setPointerPanEnabled(false);
canvas.emit("pointerdown");
now += 200;
assert.equal(input.getState().isPulling, true, "equipped pointer holds preserve fight input");
windowTarget.emit("pointerup"); input.getState();
assert.equal(canvas.emit("wheel", { deltaY: 120 }).prevented, undefined, "wheel navigation does not affect equipped casting/fights");
equipment = {};
input.setPointerPanEnabled(true);
canvas.emit("pointerdown");
canvas.emit("pointermove", { clientX: 140 });
equipment = { rod: {} };
input.setPointerPanEnabled(false);
assert.equal(frame().pointerPanning, true, "navigation ownership is latched even if a rod is equipped mid-drag");
windowTarget.emit("pointerup", { clientX: 140 });
assert.equal(frame().clickPos, null);
input.dispose();

const { TimeDisplay } = runtime.importModule("src/platform/browser/ui/time_display.js");
for (const onActivate of [null, () => {}]) {
  const clock = new TimeDisplay({ documentRef: new TestDocument(), onActivate });
  assert.equal(clock.container.fire("pointerdown").stopped, true, "passive and disabled clocks shield gameplay input");
  const css = runtime.read("src/game/presentation/styles/hud/time-display.css");
  assert.match(css, /\.time-display\s*\{[^}]*pointer-events:\s*auto/s, "the clock must intercept hit testing in every state");
  clock.dispose();
}
assert.equal(casts, 0);
// Spec 098: with the split strip on the right the canvas starts at its left edge; world input is canvas-relative.
{
  const stripCanvas = eventTarget();
  const stripInput = new InputController(stripCanvas, null, { runtimeConfig: config, listeners: new EventLifecycle(),
    getOriginX: () => 896 });
  stripCanvas.emit("pointerdown", { pointerType: "mouse", button: 0, clientX: 1000, clientY: 200 });
  const pressed = stripInput.getState();
  assert.equal(pressed.pointerStart.x, 104, "a press in the strip starts at its canvas position");
  assert.equal(pressed.pointerCurrent.x, 104);
  assert.equal(pressed.pointerStart.y, 200, "the strip has no vertical offset");
  stripInput.dispose();
}
console.log("Scouting input passed: click/drag, mouse/touch/wheel, accumulated movement, inversion/distance, cancellation, equipped holds and clock shielding.");
