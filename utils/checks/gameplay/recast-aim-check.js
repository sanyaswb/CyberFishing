"use strict";

// G-068: aiming a re-cast (a long press while the tackle is in the water) looks like aiming the first cast: the CAST
// bar and the aim line show, the rod, line, tackle and fight areas do not (spec 099 D3: no rod before the cast), and
// they stay hidden while the cast flies; once it lands the tackle shows again.
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const runtime = new SourceRuntime();
const { ScoutingState } = runtime.importModule("src/game/application/state/scouting_state.js");
const { WaitingState } = runtime.importModule("src/game/application/state/waiting_state.js");
const { CastPowerAim } = runtime.importModule("src/game/application/casting/cast_power_aim.js");
const { GameRenderIntent } = runtime.importModule("src/game/presentation/rendering/game_render_intent.js");

const bounds = { left: 0, right: 320, top: 0, bottom: 1000 };
const equipment = { rod: { variant: "float" }, reel: { effectiveStats: { basePower: 1 } }, float: {} };
const casts = [];
const deps = {
  config: { casting: { enabled: true, powerSwipePx: 90 }, debug: {}, physics: {}, ui: {} },
  rng: { next: () => 0.5, chance: () => false },
  getViewportSize: () => ({ width: 320, height: 600 }),
  projector: { getScale: () => 1, focusOnVirtualPos() {}, followVirtualX() {}, screenToVirtual: (x, y) => ({ x, y }), virtualToScreen: (x, y) => ({ x, y }) },
  commands: { panViewport() {}, setState() {}, castLine: (...args) => casts.push(args) },
  world: {
    getWaterMetric: () => ({
      isUniform: true,
      distanceMeters: () => 99,
      topBasePixels: 1000,
      yAtBasePixels: (d) => 1000 - d,
      virtualPixelsFromShore: (d) => d,
      distanceBasePixels: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2),
    }),
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

// TK-268: GodMode infiniteCasting allows casting to any distance across the whole water metric regardless of equipped tackle.
let godModeInfiniteCasting = false;
deps.services.devFlags.isEnabled = (flag) => flag === "infiniteCasting" && godModeInfiniteCasting;
deps.rules.equipment.getEffectiveCastDistance = (eq) => eq?.variant === "pole" ? 160 : 500;

// Without infiniteCasting: pole rod max distance is 160, float rod is 500
equipment.variant = "pole";
const scoutingStandardPole = new ScoutingState(deps);
scoutingStandardPole.enter();
scoutingStandardPole.update(16, bounds, { input: hold });
const aimStandardPole = intentOf(scoutingStandardPole);
assert.equal(aimStandardPole.casting.maxDistance, 160, "without infiniteCasting pole rod is limited to 160px");

// With infiniteCasting: any tackle reaches full water metric (1000px)
godModeInfiniteCasting = true;
const scoutingGodPole = new ScoutingState(deps);
scoutingGodPole.enter();
scoutingGodPole.update(16, bounds, { input: hold });
const aimGodPole = intentOf(scoutingGodPole);
assert.equal(aimGodPole.casting.maxDistance, 1000, "with infiniteCasting pole rod reaches full water distance (1000px)");

// Changing tackle to spinning or float rod still reaches full water distance (1000px)
equipment.variant = "spinning";
const scoutingGodSpinning = new ScoutingState(deps);
scoutingGodSpinning.enter();
scoutingGodSpinning.update(16, bounds, { input: hold });
const aimGodSpinning = intentOf(scoutingGodSpinning);
assert.equal(aimGodSpinning.casting.maxDistance, 1000, "with infiniteCasting spinning rod reaches full water distance (1000px)");

// Full power release resolves to the far water edge (distance 1000px, y = 0)
const aim = new CastPowerAim({
  config: deps.config,
  projector: deps.projector,
  rng: deps.rng,
  getWaterMetric: () => deps.world.getWaterMetric(),
  getViewportSize: deps.getViewportSize,
  panViewport: deps.commands.panViewport,
});
const release = { active: true, power: 1.0, screenX: 160, screenY: 560 };
const resolvedTarget = scoutingGodPole.resolveCastTarget(aim, release, bounds, equipment);
assert.equal(resolvedTarget.success, true, "cast target resolves successfully");
assert.equal(resolvedTarget.y <= bounds.top + 50, true,
  "cast with power 1.0 lands near the top boundary (far water edge), actual y: " + resolvedTarget.y);

console.log("Re-cast aim passed: a long-press re-cast shows the CAST bar without the rod, line or tackle, like the first "
  + "aim, keeps them hidden while the cast flies and shows them again when it lands.");
