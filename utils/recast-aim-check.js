"use strict";

// G-068: aiming a re-cast (a long press while the tackle is in the water) looks like aiming the first cast: the CAST
// bar and the aim line show, the rod, line, tackle and fight areas do not (spec 099 D3: no rod before the cast), and
// they stay hidden while the cast flies; once it lands the tackle shows again.
const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

const runtime = new SourceRuntime();
const { ScoutingState } = runtime.importModule("src/game/application/state/scouting_state.js");
const { WaitingState } = runtime.importModule("src/game/application/state/waiting_state.js");
const { GameRenderIntent } = runtime.importModule("src/game/presentation/rendering/game_render_intent.js");

const bounds = { left: 0, right: 320, top: 0, bottom: 1000 };
const equipment = { rod: { variant: "float" }, reel: { effectiveStats: { basePower: 1 } }, float: {} };
const casts = [];
const deps = {
  config: { casting: { enabled: true, powerSwipePx: 90 }, debug: {}, physics: {}, ui: {} },
  rng: { next: () => 0.5, chance: () => false },
  getViewportSize: () => ({ width: 320, height: 600 }),
  projector: { focusOnVirtualPos() {}, screenToVirtual: (x, y) => ({ x, y }), virtualToScreen: (x, y) => ({ x, y }) },
  commands: { panViewport() {}, setState() {}, castLine: (...args) => casts.push(args) },
  world: {
    getWaterMetric: () => ({ isUniform: true, distanceMeters: () => 99, topBasePixels: 1000, yAtBasePixels: (d) => 1000 - d }),
    checkWater: () => ({ depth: 2 }), getRodVirtualPos: () => ({ x: 160, y: 1000 }), getBiteEnv: () => ({}),
  },
  inventory: { getEquipped: () => equipment, evaluateCastReadiness: () => ({ canCast: true }) },
  rules: { equipment: { isSpinning: () => false, isFeeder: () => false, getEffectiveCastDistance: () => 500,
    canSelectDepth: () => false } },
  services: { devFlags: { isEnabled: () => false } },
  ui: { updateNetButtonState() {}, setScoutingPointerDimmed() {} },
  depthUI: { isOpen: false, isActive: false, hide() {} },
  currentHookDepthRef: { get: () => 1, set() {} },
  isAimingChum: () => false,
  canPlayerCast: () => true,
  clock: { now: 1000 },
  getCastStartTime: () => 0,
  castRodControl: { isPulling: () => false, update: () => ({ rodMoved: false, floatMoved: false, deltaPx: 0 }) },
  float: { getPosition: () => ({ x: 160, y: 400 }), update() {} },
  input: { getState: () => ({}) },
  biteSystem: { reset() {}, evaluateBite: () => null },
  fishing: { collectAvailableBaits() {} },
  castPenalty: { registerCast() {} },
};
const hold = { pointerDown: true, pointerStart: { x: 160, y: 500 }, pointerCurrent: { x: 160, y: 560 } };
const intentOf = (state) => {
  const intent = new GameRenderIntent();
  state.getRenderState(intent, bounds);
  return intent;
};

const scouting = new ScoutingState(deps);
scouting.enter();
scouting.update(16, bounds, { input: hold });
const firstAim = intentOf(scouting);
assert.deepEqual([firstAim.casting.powerVisible, firstAim.fishing.visible], [true, false],
  "the first aim shows the CAST bar and no rod");

const waiting = new WaitingState(deps);
waiting.enter();
assert.equal(intentOf(waiting).fishing.visible, true, "with the tackle in the water the rod, line and tackle show");
waiting.handleInput({ longPressPos: { x: 160, y: 500 } });
waiting.update(16, bounds, { input: hold, env: {} });
const recastAim = intentOf(waiting);
assert.deepEqual([recastAim.casting.powerVisible, recastAim.fishing.visible],
  [firstAim.casting.powerVisible, firstAim.fishing.visible], "a re-cast aims exactly like the first cast: no rod");
assert.equal(recastAim.casting.maxDistance, firstAim.casting.maxDistance, "with the same cast reach");

waiting.resolveCastTarget = () => ({ success: true, x: 160, y: 300, depth: 1, travelDelayMs: 100, originVirtualX: 160,
  originVirtualY: 1000, rodScreenX: 160 });
waiting.update(16, bounds, { input: { pointerReleased: true, pointerRelease: { x: 160, y: 560 } }, env: {} });
const flying = intentOf(waiting);
assert.deepEqual([flying.fishing.visible, casts.length], [false, 0], "while the re-cast flies the old tackle is hidden");
waiting.update(120, bounds, { input: {}, env: {} });
assert.equal(casts.length, 1, "the re-cast lands");
assert.equal(intentOf(waiting).fishing.visible, true, "after it lands the tackle shows again");

console.log("Re-cast aim passed: a long-press re-cast shows the CAST bar without the rod, line or tackle, like the first "
  + "aim, keeps them hidden while the cast flies and shows them again when it lands.");
