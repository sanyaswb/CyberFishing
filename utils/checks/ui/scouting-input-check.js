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
// TK-363.2 (spec 183 D6): a touch aim never jumps under the finger but follows its movement 1:1 from where it was; while
// aiming the map scrolls toward the aim's side, faster the farther the aim is from the screen's middle, starting and
// stopping smoothly; the release casts where the aim is. The mouse keeps placing the aim under the pointer.
// TK-365: with casting.touchAim.startAtFullPower an aim armed by a click waits at full power and a downward swipe lowers it.
{
  const { CONFIG } = runtime.importModule("src/game/config/runtime/game_config.js");
  const { CastPowerAim } = runtime.importModule("src/game/application/casting/cast_power_aim.js");
  const casting = JSON.parse(JSON.stringify(CONFIG.casting));
  const width = 1000;
  const pans = [];
  const aim = new CastPowerAim({ config: { casting }, projector: null, getWaterMetric: () => null,
    getViewportSize: () => ({ width, height: 600 }), panViewport: (delta) => pans.push(delta), rng: null });
  const frame = (pointerType, startX, x, y = 100) => {
    aim.update({ pointerDown: true, pointerType, pointerStart: { x: startX, y: 100 }, pointerCurrent: { x, y } }, null, 16);
    return aim.getVisualState();
  };
  const release = (pointerType, x, y = 100) => aim.update({ pointerDown: false, pointerReleased: true, pointerType,
    pointerRelease: { x, y }, pointerStart: { x, y: 100 }, pointerCurrent: { x, y } }, null, 16);
  const panSum = (from) => pans.slice(from).reduce((sum, delta) => sum + delta, 0);
  casting.touchAim.startAtFullPower = false;
  aim.arm(500);
  assert.equal(frame("touch", 800, 800).screenX, 500, "a touch far from a waiting aim does not move it there");
  assert.equal(frame("touch", 800, 860).screenX, 560, "a finger moved 60 px moves the aim 60 px");
  assert.equal(frame("touch", 800, 700).screenX, 400, "and back the other way just as much");
  const released = release("touch", 700, 300);
  assert.equal(released.screenX, 400, "the release casts from where the aim is, not from the finger");
  // The map scroll: none with the aim in the middle, smooth start, faster farther from the middle.
  aim.arm(500);
  let from = pans.length;
  for (let index = 0; index < 30; index += 1) frame("touch", 500, 500);
  assert.equal(panSum(from), 0, "an aim in the middle does not scroll the map");
  release("touch", 500);
  const scroll = (aimX) => {
    aim.arm(aimX);
    const start = pans.length;
    for (let index = 0; index < 60; index += 1) frame("touch", 500, 500);
    release("touch", 500);
    return pans.slice(start);
  };
  const near = scroll(650);
  const far = scroll(950);
  const left = scroll(150);
  assert.ok(far[0] > 0 && far[0] <= casting.touchAim.panAccelerationPxPerSecond2 * 0.016 * 0.016 + 1e-9,
    "the scroll starts smoothly, without a jerk");
  assert.ok(near.at(-1) > 0 && far.at(-1) > near.at(-1), "an aim right of the middle scrolls right, farther — faster");
  assert.ok(left.at(-1) < 0, "an aim left of the middle scrolls left");
  assert.ok(far.at(-1) <= casting.touchAim.panMaxPxPerSecond * 0.016 + 1e-9, "never faster than the configured speed");
  // TK-365: full-power start.
  casting.touchAim.startAtFullPower = true;
  aim.arm(500);
  assert.equal(aim.getVisualState().power, 1, "a click-armed aim waits at full power");
  assert.equal(frame("touch", 500, 560).power, 1, "a sideways move keeps full power");
  const half = frame("touch", 500, 560, 100 + casting.powerSwipePx * (casting.powerDeadzoneRatio + 0.5));
  assert.ok(half.power > 0.3 && half.power < 0.7, "a downward swipe lowers it");
  assert.equal(frame("touch", 500, 560, 400).power, 0, "a long downward swipe takes it to 0");
  assert.equal(frame("touch", 500, 560, 100).power, 1, "back up — full power again");
  assert.equal(release("touch", 560, 100).power, 1, "the release casts at the power shown");
  aim.reset();
  assert.ok(frame("touch", 500, 500, 400).power > 0.99, "an aim started by a long swipe (not armed) still grows from 0");
  release("touch", 500, 400);
  // TK-363.3: only a touch that begins near the aim line sets the power; one farther away only moves the aim.
  aim.arm(500);
  frame("touch", 900, 900);
  const aimOnly = frame("touch", 900, 850, 400);
  assert.deepEqual([aimOnly.screenX, aimOnly.power], [450, 1], "a touch far from the aim line moves it but a downward slip keeps the power");
  assert.equal(release("touch", 850, 400).power, 0, "and its release does not cast (the aim stays)");
  aim.arm(500);
  frame("touch", 520, 520);
  assert.equal(frame("touch", 520, 520, 400).power, 0, "a touch within the zone of the aim line sets the power");
  release("touch", 520, 400);
  aim.arm(500);
  frame("touch", 526, 526);
  assert.equal(frame("touch", 526, 526, 400).power, 1, "26 px away is outside the 25 px zone");
  release("touch", 526, 400);
  casting.touchAim.startAtFullPower = false;
  aim.arm(500);
  assert.equal(aim.getVisualState().power, 0, "with the switch off the armed aim waits at 0 (as before)");
  aim.reset();
  assert.equal(frame("mouse", 300, 300).screenX, 300, "the mouse places the aim under the pointer as before");
  release("mouse", 300);
}
console.log("Scouting input passed: click/drag, mouse/touch/wheel, accumulated movement, inversion/distance, cancellation, equipped holds and clock shielding; spec 183 touch aiming; touch aim follows the finger 1:1 with a smooth centre-based map scroll (TK-363.2) and an optional full-power start (TK-365); power only from a touch near the aim line (TK-363.3).");
