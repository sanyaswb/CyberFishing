const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const { TestDocument } = require("../../testing/keepnet/test_document");

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
let equipment = {}, warnings = 0, casts = 0, gasMaskWarnings = 0, emissionBlocks = false;
const deps = {
  config, projector: { focusOnVirtualPos() {}, followVirtualX() {} }, rng: {},
  inventory: { getEquipped: () => equipment, evaluateCastReadiness: () => ({ canCast: !!equipment.rod }) },
  world: { getWaterMetric: () => ({}) }, getViewportSize: () => ({ width: 800, height: 600 }),
  isAimingChum: () => false, canPlayerCast: () => false,
  castGate: { isBlocked: () => emissionBlocks },
  rules: { equipment: { requiresReel: () => false, hasEquippedLine: () => true, canSelectDepth: () => false } },
  commands: { showMissingRodInventoryWarning: () => warnings++, castLine: () => casts++, panViewport() {},
    showGasMaskRequiredWarning: () => gasMaskWarnings++ },
  ui: { updateNetButtonState() {}, setScoutingPointerDimmed() {} },
  depthUI: { isActive: false }, currentHookDepthRef: { get: () => 1, set() {}, choose() {}, isChosen: () => false, clearChoice() {} },
};
const scouting = new ScoutingState(deps);
scouting.enter();
scouting.update(16, { bottom: 600 }, { input: { pointerDown: true, isPulling: false } });
assert.equal(warnings, 0, "a pointer press must wait for click/scroll classification before opening Inventory");

// Spec 179 stage E (TK-324): during an emission without a gas mask a cast is refused with one warning per press.
{
  const gated = new ScoutingState(deps);
  equipment = { rod: { id: "rod" } };
  emissionBlocks = true;
  gated.enter();
  gated.update(16, { bottom: 600 }, { input: { pointerDown: true, isPulling: false } });
  assert.equal(gasMaskWarnings, 0, "a bare press may still become navigation: no warning yet");
  gated.update(16, { bottom: 600 }, { input: { pointerDown: true, isPulling: true } });
  gated.update(16, { bottom: 600 }, { input: { pointerDown: true, isPulling: true } });
  assert.equal(gasMaskWarnings, 1, "a cast during an emission warns «У вас немає протигазу» once per press");
  for (let index = 0; index < 30; index += 1) gated.update(16, { bottom: 600 }, { input: { pointerDown: false, clickPos: null } });
  assert.equal(casts, 0, "and never casts");
  emissionBlocks = false;
  equipment = {};
  gasMaskWarnings = 0;
}

const canvas = eventTarget();
const input = new InputController(canvas, null, { runtimeConfig: config, listeners: new EventLifecycle() });
input.setPointerPanEnabled(true);
const pans = [];
const viewport = new GameViewportFacade({ rodVisualOffsetSystem: new (runtime.importModule("src/game/application/fishing/rod_visual_offset_system.js").RodVisualOffsetSystem)(), config, world: { pan: (x, y) => pans.push([x, y]) },
  projector: { screenToVirtual: (x, y, out) => out.set(x, y) } });
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
assert.equal(canvas.captured, 1, "equipped aiming owns its pointer across HUD buttons");
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
  const clockDocument = new TestDocument();
  const clock = new TimeDisplay({ documentRef: clockDocument, onActivate, icons: { create: () => clockDocument.createElement("span") } });
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
// TK-281: keys typed into a field stay with the field (caret arrows, the letters on the game's keys); elsewhere the
// game keeps them.
{
  const keyConfig = { ...config, input: { ...config.input,
    keys: { pull: ["Space"], left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
      dragIncrease: ["KeyS", "ArrowDown"], dragDecrease: ["KeyW", "ArrowUp"], retrieve: ["ShiftLeft"] } } };
  const keyCanvas = eventTarget();
  const keyInput = new InputController(keyCanvas, null, { runtimeConfig: keyConfig, listeners: new EventLifecycle() });
  for (const target of [{ tagName: "INPUT" }, { tagName: "TEXTAREA" }, { tagName: "SELECT" }, { tagName: "DIV", isContentEditable: true }]) {
    for (const code of ["ArrowLeft", "ArrowUp", "KeyA", "KeyS", "ShiftLeft", "Space"]) {
      assert.equal(windowTarget.emit("keydown", { code, key: code, target }).prevented, undefined,
        `${code} typed into ${target.tagName} is left to the field`);
    }
    const typing = keyInput.getState();
    assert.equal(typing.aimLeft || typing.dragIncrease || typing.dragDecrease || typing.isPulling || typing.retrieve, false,
      "typing into a field does not steer the game");
  }
  assert.equal(windowTarget.emit("keydown", { code: "ArrowLeft", key: "ArrowLeft", target: { tagName: "CANVAS" } }).prevented, true,
    "outside a field the game owns its keys");
  assert.equal(keyInput.getState().aimLeft, true);
  windowTarget.emit("keyup", { code: "ArrowLeft", key: "ArrowLeft", target: { tagName: "INPUT" } });
  assert.equal(keyInput.getState().aimLeft, false, "a key released inside a field is released for the game too");
  keyInput.dispose();
}
// Spec 183 (TK-361): touch with a ready rod. A sideways swipe scrolls; a tap arms the aim, which waits for a touch that
// sets direction and power; a release at power 0 after a move keeps it, a tap or a double tap removes it; a long swipe
// down aims at once from the touch point. The mouse aims on press as before; there is no long-press re-cast.
{
  equipment = { rod: { id: "rod" } };
  const touchCasts = [];
  const touchDeps = { ...deps, commands: { ...deps.commands, castLine: (...args) => touchCasts.push(args), setState() {} } };
  const touchScouting = new ScoutingState(touchDeps);
  touchScouting.resolveCastTarget = (aim, release) => ({ success: true, x: release.screenX, y: 100, depth: 1, travelDelayMs: 0,
    originVirtualX: release.screenX, originVirtualY: 600, rodScreenX: release.screenX, power: release.power });
  touchScouting.enter();
  const touchCanvas = eventTarget();
  const touchInput = new InputController(touchCanvas, null, { runtimeConfig: config, listeners: new EventLifecycle() });
  const touchPans = [];
  const touchViewport = new GameViewportFacade({ rodVisualOffsetSystem: new (runtime.importModule(
    "src/game/application/fishing/rod_visual_offset_system.js").RodVisualOffsetSystem)(), config,
  world: { pan: (x) => touchPans.push(x) }, projector: { screenToVirtual: (x, y, out) => out.set(x, y) } });
  // As GameApplication.#syncInputAvailability: scouting, a ready rod, no chum — arming until the aim waits.
  const touchFrame = () => {
    touchInput.setTouchAimMode(touchScouting.isTouchAimArmed() ? "armed" : "arming");
    const state = touchInput.getState();
    touchViewport.applyPan(state, "scouting", false);
    touchScouting.update(16, { bottom: 600 }, { input: state });
    return state;
  };
  const touch = (type, fields = {}) => (type === "pointerup" ? windowTarget : touchCanvas).emit(type, { pointerType: "touch", ...fields });
  // A tap (200 ms, as a real finger: longer than pullHoldMinMs), then an idle frame (the game syncs the input mode
  // every frame before the next touch).
  const tap = (x = 300, holdMs = 200) => {
    touch("pointerdown", { clientX: x, clientY: 100 });
    touchFrame();
    now += holdMs;
    touchFrame();
    touch("pointerup", { clientX: x, clientY: 100 });
    const released = touchFrame();
    touchFrame();
    return released;
  };
  touchFrame();
  // A sideways swipe scrolls the map; nothing aims.
  touch("pointerdown", { clientX: 100, clientY: 100 });
  touch("pointermove", { clientX: 160, clientY: 104 });
  assert.equal(touchFrame().pointerPanning, true, "a touch with a ready rod starts as a map scroll");
  touch("pointerup", { clientX: 160, clientY: 104 });
  touchFrame();
  assert.ok(touchPans.length > 0 && touchPans[0] !== 0, "a sideways swipe scrolls the map");
  assert.deepEqual([touchScouting.isTouchAimArmed(), touchCasts.length], [false, 0], "and neither aims nor casts");
  // A tap arms the aim; a move that ends at power 0 keeps it; a tap removes it.
  now += 1000;
  tap();
  assert.equal(touchScouting.isTouchAimArmed(), true, "a tap starts aiming");
  now += 1000;
  touch("pointerdown", { clientX: 300, clientY: 100 });
  assert.equal(touchFrame().pointerPanning, false, "while aiming a touch aims (no scroll)");
  touch("pointermove", { clientX: 360, clientY: 100 });
  touchFrame();
  touch("pointerup", { clientX: 360, clientY: 100 });
  touchFrame();
  assert.deepEqual([touchScouting.isTouchAimArmed(), touchCasts.length], [true, 0], "a release at power 0 after a move keeps aiming");
  now += 1000;
  tap();
  assert.equal(touchScouting.isTouchAimArmed(), false, "a tap while aiming removes it");
  // A double tap removes the aim and does not start it again.
  now += 1000;
  tap();
  assert.equal(touchScouting.isTouchAimArmed(), true);
  now += 1000;
  tap(300, 80);
  now += 60;
  tap(300, 80);
  assert.equal(touchScouting.isTouchAimArmed(), false, "a double tap removes aiming and does not start it again");
  // Aiming, then a pull down with power casts and ends the aim.
  now += 1000;
  tap();
  now += 1000;
  touch("pointerdown", { clientX: 300, clientY: 100 });
  touchFrame();
  touch("pointermove", { clientX: 300, clientY: 200 });
  touchFrame();
  touch("pointerup", { clientX: 300, clientY: 200 });
  touchFrame();
  touchFrame();
  assert.deepEqual([touchCasts.length, touchScouting.isTouchAimArmed()], [1, false], "a release with power casts; the aim ends");
  // A long swipe down aims at once, its power from the touch point.
  now += 1000;
  const pansBefore = touchPans.length;
  touch("pointerdown", { clientX: 400, clientY: 100 });
  touch("pointermove", { clientX: 402, clientY: 130 });
  assert.equal(touchFrame().pointerPanning, true, "a short pull down is not aiming yet");
  touch("pointermove", { clientX: 404, clientY: 200 });
  const swiping = touchFrame();
  assert.deepEqual([swiping.pointerPanning, swiping.pointerStart.y], [false, 100], "a long swipe down aims from the touch point");
  touch("pointerup", { clientX: 404, clientY: 200 });
  touchFrame();
  touchFrame();
  assert.equal(touchCasts.length, 2, "and its release casts");
  assert.equal(touchPans.length, pansBefore, "a swipe down never scrolls the map");
  // A short move down released before the swipe length is neither a tap nor aiming.
  now += 1000;
  touch("pointerdown", { clientX: 300, clientY: 100 });
  touch("pointermove", { clientX: 300, clientY: 125 });
  touchFrame();
  touch("pointerup", { clientX: 300, clientY: 125 });
  const shortPull = touchFrame();
  assert.deepEqual([shortPull.clickPos, touchScouting.isTouchAimArmed(), touchCasts.length], [null, false, 2],
    "a short pull down is not a click and does not aim");
  // The mouse aims on press as before (spec 183 D3).
  now += 1000;
  touchCanvas.emit("pointerdown", { pointerType: "mouse", clientX: 300, clientY: 100 });
  assert.equal(touchFrame().pointerPanning, false, "a mouse press with a ready rod aims at once");
  windowTarget.emit("pointerup", { pointerType: "mouse", clientX: 300, clientY: 100 });
  touchFrame();
  // D4: no long press re-cast — the input no longer reports one.
  now += 1000;
  touch("pointerdown", { clientX: 300, clientY: 100 });
  now += 3000;
  assert.equal("longPressPos" in touchFrame(), false, "a long press is not reported (no re-cast by long press)");
  touch("pointerup", { clientX: 300, clientY: 100 });
  touchFrame();
  touchInput.dispose();
  equipment = {};
}
// TK-363 (spec 183 D6): a touch aim never jumps to the finger. A waiting aim stays where it is when a touch lands
// elsewhere; a held sideways swipe moves it at a speed that grows with the swipe and starts smoothly; a still finger in
// the middle leaves it, at a screen edge pushes it toward that edge; the release casts where the aim is. The mouse keeps
// placing the aim under the pointer.
{
  const { CONFIG } = runtime.importModule("src/game/config/runtime/game_config.js");
  const { CastPowerAim } = runtime.importModule("src/game/application/casting/cast_power_aim.js");
  const casting = JSON.parse(JSON.stringify(CONFIG.casting));
  const width = 1000;
  const aim = new CastPowerAim({ config: { casting }, projector: null, getWaterMetric: () => null,
    getViewportSize: () => ({ width, height: 600 }), panViewport: null, rng: null });
  const hold = (pointerType, startX, x, frames, y = 100) => {
    const xs = [];
    for (let frame = 0; frame < frames; frame += 1) {
      aim.update({ pointerDown: true, pointerType, pointerStart: { x: startX, y: 100 }, pointerCurrent: { x, y } }, null, 16);
      xs.push(aim.getVisualState().screenX);
    }
    return xs;
  };
  const release = (pointerType, x, y = 100) => aim.update({ pointerDown: false, pointerReleased: true, pointerType,
    pointerRelease: { x, y }, pointerStart: { x, y: 100 }, pointerCurrent: { x, y } }, null, 16);
  aim.arm(500);
  assert.equal(hold("touch", 800, 800, 1)[0], 500, "a touch far from a waiting aim does not move it there");
  release("touch", 800);
  aim.arm(500);
  const still = hold("touch", 500, 505, 30);
  assert.equal(still[29], 500, "a still finger in the middle (inside the dead zone) leaves the aim");
  release("touch", 505);
  aim.arm(500);
  const short = hold("touch", 500, 560, 40);
  release("touch", 560);
  aim.arm(500);
  const long = hold("touch", 500, 700, 40);
  assert.ok(long[0] - 500 < 2, "the aim starts moving smoothly, not with a jump");
  assert.ok(short[39] > 500 && long[39] > short[39], "a held swipe to the right moves the aim right, a longer one faster");
  for (let index = 1; index < long.length; index += 1) assert.ok(long[index] - long[index - 1] <= 700 * 0.016 + 1e-9, "never faster than the full speed");
  const released = release("touch", 700, 300);
  assert.equal(released.screenX, long[39], "the release casts from where the aim is, not from the finger");
  aim.arm(500);
  const left = hold("touch", 980, 860, 30);
  assert.ok(left[29] < 500, "a swipe to the left from the right edge moves the aim left");
  release("touch", 860);
  aim.arm(500);
  const edge = hold("touch", 995, 995, 30);
  assert.ok(edge[29] > 500, "a still finger at the right edge pushes the aim right");
  release("touch", 995);
  assert.equal(hold("mouse", 300, 300, 1)[0], 300, "the mouse places the aim under the pointer as before");
  release("mouse", 300);
}
console.log("Scouting input passed: click/drag, mouse/touch/wheel, accumulated movement, inversion/distance, cancellation, equipped holds and clock shielding; spec 183 touch aiming; touch aim moves like a joystick (TK-363).");
