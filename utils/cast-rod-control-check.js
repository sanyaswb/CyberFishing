const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

const runtime = new SourceRuntime();
const { BiteSystem } = runtime.importModule("src/game/application/fishing/bite_system.js");
const events = [];
const fish = {
  id: "test", name: "Test", maxHookSize: 10, baseChance: 0.5,
  depthConfig: { minDepth: 0, maxDepth: 10, chanceMultAtMaxDepth: 1 },
  timeMultipliers: {}, dayMultipliers: {},
};
const config = { physics: { castRodControl: {
  enabled: true, movingFloatBite: { enabled: true, chance: 0.001, excludeSpinning: true },
} } };
const bite = new BiteSystem({ fishes: [fish], tickRateMs: 1000 }, config,
  { next: () => 0.75 }, { emit: (type, detail) => events.push({ type, detail }) },
  { resolve() {} }, { resolve() {} }, { resolveImagePath() {} },
  { resolveBestMatch: () => ({ effectiveMultiplier: 1 }) }, { godModeValue: () => null });
bite.evaluateBite(1000, { hookDepth: 1, bottomDepth: 10, lineLength: 1 }, {
  hookSize: 1, baitCandidates: ["worm"], castRodFloatMoving: true, isSpinning: false,
});
assert.equal(events.at(-1).detail.fishRolls[0].chance, 0.001,
  "rod-driven float movement sets the eligible non-spinning bite chance to 0.1%");
const { CastRodControl } = runtime.importModule("src/game/application/fishing/cast_rod_control.js");
const { BitingState } = runtime.importModule("src/game/application/state/biting_state.js");
const { WaitingState } = runtime.importModule("src/game/application/state/waiting_state.js");
const { GameViewportFacade } = runtime.importModule("src/game/presentation/viewport/game_viewport_facade.js");
const { RodVisualOffsetSystem } = runtime.importModule("src/game/application/fishing/rod_visual_offset_system.js");
const { WaterMetric } = runtime.importModule("src/game/domain/locations/water_metric.js");
const { Vector2 } = runtime.importModule("src/engine/math/vector2.js");
const { CAST_ROD_CONTROL_CONFIG } = runtime.importModule("src/game/config/raw/physics/cast_rod_control_config.js");
const clone = value => JSON.parse(JSON.stringify(value));
const right = { rodControlActive: true, rodControlDirectionX: 1, rodControlInputRatio: 1 };
const left = { ...right, rodControlDirectionX: -1 };

function fixture({ floatX = 400, perspective = false } = {}) {
  const config = { physics: { simulation: { pixelsPerMeter: 50, maxDtMs: 50 }, castRodControl: clone(CAST_ROD_CONTROL_CONFIG) }, ui: {} };
  const bounds = { left: 100, right: 900, top: 0, bottom: 1000 };
  const metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 400,
    ...(perspective ? { maxMeters: 40, linearShare: 0.5 } : {}) });
  const projector = { virtualToScreen(x, y, out) { return out.set(x, y); },
    screenToVirtual(x, y, out) { return out.set(x, y); }, focusOnVirtualPos() {} };
  const metrics = { width: 1000, height: 1000 };
  const position = new Vector2(floatX, 0);
  const float = { getPosition: () => position, biting: true, guaranteed: false, stopped: 0, hooked: 0, ticks: 0,
    updateBite() { this.ticks++; }, update() {}, getBiteStepInfo: () => null,
    isBiting() { return this.biting; }, isGuaranteedBite() { return this.guaranteed; },
    hook() { this.hooked++; this.biting = false; }, stopBite() { this.stopped++; this.biting = false; }, startBite() {} };
  const control = new CastRodControl({ config, projector, canvasMetrics: metrics, getBaseRodVirtualPos: () => ({ x: 400, y: 1000 }) });
  const context = { dtMs: 50, input: {}, bounds, floatEntity: float, waterMetric: metric, checkWater: () => ({ depth: 5 }) };
  const step = (input = {}, extra = {}) => control.update({ ...context, input, ...extra });
  return { config, bounds, metric, projector, metrics, position, float, control, context, step };
}

function checkMovement() {
  const f = fixture(), frame = f.step(right);
  assert(frame.rodMoved && frame.floatMoved, "taut line moves the float");
  assert.equal(f.control.getScreenX(), 405);
  assert.equal(f.step(), frame, "observation frame is reused");
  assert.equal(frame.rodMoved, false); assert.equal(f.control.getScreenX(), 405, "release preserves position");
  for (let i = 0; i < 120; i++) f.step(right);
  assert.equal(f.control.getScreenX(), 900, "100% reaches the right green edge");
  assert.equal(f.step(right).rodMoved, false, "holding at an edge does not count as movement");
  for (let i = 0; i < 170; i++) f.step(left);
  assert.equal(f.control.getScreenX(), 100, "100% reaches the left green edge");
  f.config.physics.castRodControl.range.leftRatio = 0.5;
  f.config.physics.castRodControl.range.rightRatio = 0.25;
  f.step(); assert.equal(f.control.getScreenX(), 250);
  for (let i = 0; i < 100; i++) f.step(right);
  assert.equal(f.control.getScreenX(), 525, "independent ratios use the original center");
  f.config.physics.castRodControl.enabled = false;
  assert.equal(f.step(right).rodMoved, false); assert.equal(f.control.getScreenX(), null);
  f.config.physics.castRodControl.enabled = true;
  f.config.physics.castRodControl.speedPxPerSecond = 0;
  assert.equal(f.step(right).rodMoved, false); assert.equal(f.control.getScreenX(), 400);
  f.config.physics.castRodControl.speedPxPerSecond = 100;
  f.step(right, { dtMs: 1000 }); assert.equal(f.control.getScreenX(), 415, "stalls obey the physics delta cap at x3 while there is slack");
  f.step(left, { aiming: true }); assert.equal(f.control.getScreenX(), 415, "recast aim is separate");
  f.control.reset(); assert.equal(f.control.getScreenX(), null);
  f.step(left, { floatEntity: { getPosition: () => new Vector2(400, 0) } }); assert.equal(f.control.getScreenX(), 395);
  const analog = fixture();
  for (let i = 0; i < 100; i++) analog.step({ ...right, rodControlInputRatio: 0.5 });
  assert.equal(analog.control.getScreenX(), 650);
  analog.step({ ...right, fightActions: { lateralControl: { active: true, directionX: -1, inputRatio: 1 } } });
  assert.equal(analog.control.getScreenX(), 635, "composed input wins and a return through slack is x3");
  assert.equal(analog.control.isPulling({ isPulling: true, pointerAction: "rod_control_x" }), false);
  assert.equal(analog.control.isPulling({ isPulling: true, pointerAction: "rod_control_x", fightActions: { raw: { spaceDown: true } } }), true);
  assert.equal(analog.control.isPulling({ isPulling: true }), true);
  const facade = new GameViewportFacade({ rodVisualOffsetSystem: new RodVisualOffsetSystem(), world: {}, projector: analog.projector, canvasMetrics: analog.metrics,
    config: analog.config, biteEnvironmentService: {}, getCastRodScreenX: () => analog.control.getScreenX() });
  assert.equal(facade.getRodScreenX(400, analog.bounds), 635);
  assert.equal(facade.getRodVirtualPos(analog.bounds, 400).x, 635, "render and tackle share the owned rod position");
  analog.metrics.width = 500; analog.bounds.right = 500; analog.step(); assert(analog.control.getScreenX() <= 500);
  analog.control.setViewportScreenX(450); assert.equal(analog.control.getScreenX(), 450);
  assert.equal(analog.step().rodMoved, false, "camera/stage relocation is not a player's bite action");
}

function checkSpeedMultipliers() {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ~= ${b}`);
  assert.equal(CAST_ROD_CONTROL_CONFIG.speedMultipliers.stationaryFloat, 3);
  assert.equal(CAST_ROD_CONTROL_CONFIG.speedMultipliers.movingFloat, 1);
  const f = fixture({ floatX: 700 });
  const frame = f.step(right);
  assert.equal(frame.floatMoved, false); assert.equal(frame.lineTensionActive, false);
  assert.equal(f.control.getScreenX(), 415, "stationary float allows x3 rod speed");
  f.step(); assert.equal(frame.lineTensionActive, false, "release clears the active line pull");
  f.step(left); near(f.control.getScreenX(), 400); assert.equal(frame.lineTensionActive, true, "line pull starts when slack is exactly exhausted");
  f.step(left); near(f.control.getScreenX(), 395); assert.equal(frame.floatMoved, true); assert.equal(frame.lineTensionActive, true);
  f.step(right); near(f.control.getScreenX(), 410); assert.equal(frame.lineTensionActive, false, "returning toward the tackle restores x3 slack speed");

  const mixed = fixture({ floatX: 700 }); mixed.step(); mixed.control.setViewportScreenX(410);
  mixed.step(left); near(mixed.control.getScreenX(), 400 - 100 * (0.05 - 10 / 300));
  assert.equal(mixed.control.getFrame().floatMoved, true);
  assert.equal(mixed.control.getFrame().lineTensionActive, true, "speed and line pull switch within the same frame");
  const sample = dtMs => {
    const part = fixture({ floatX: 700 }); part.step(); part.control.setViewportScreenX(410);
    for (let elapsed = 0; elapsed < 50; elapsed += dtMs) part.step(left, { dtMs });
    return part.control.getScreenX();
  };
  near(sample(50), sample(10)); near(sample(10), sample(5));

  const blocked = fixture(); blocked.step(left, { checkWater: x => x >= 400 });
  near(blocked.control.getScreenX(), 395); assert.equal(blocked.control.getFrame().floatMoved, false);
  assert.equal(blocked.control.getFrame().lineTensionActive, true, "blocked tackle cannot create extra slack or speed");
  const noDrag = fixture(); noDrag.config.physics.castRodControl.floatDrag.enabled = false;
  noDrag.step(left); near(noDrag.control.getScreenX(), 395);
  assert.equal(noDrag.control.getFrame().lineTensionActive, true, "line reach determines the mode even when tackle dragging is disabled");

  const custom = fixture({ floatX: 700 });
  custom.config.physics.castRodControl.speedMultipliers.stationaryFloat = 2;
  custom.step(right); near(custom.control.getScreenX(), 410);
  custom.step(left); near(custom.control.getScreenX(), 400);
  custom.config.physics.castRodControl.speedMultipliers.movingFloat = 0.5;
  custom.step(left); near(custom.control.getScreenX(), 397.5);
  custom.config.physics.castRodControl.speedMultipliers.movingFloat = 0;
  custom.step(left); near(custom.control.getScreenX(), 397.5); assert.equal(custom.control.getFrame().lineTensionActive, false);
  custom.config.physics.castRodControl.speedMultipliers.stationaryFloat = 0;
  custom.step(right); near(custom.control.getScreenX(), 397.5);
  const capped = fixture({ floatX: 700 }); capped.step(right, { dtMs: 1000 }); near(capped.control.getScreenX(), 415);
  const target = fixture({ floatX: 700 }); target.config.physics.castRodControl.range.rightRatio = 0.01;
  target.step(right); near(target.control.getScreenX(), 405); assert.equal(target.control.getFrame().lineTensionActive, false);
  target.step(right); assert.equal(target.control.getFrame().rodMoved, false); assert.equal(target.control.getFrame().lineTensionActive, false);
  const perspective = fixture({ perspective: true }); perspective.step(right);
  near(perspective.control.getScreenX(), 405); assert.equal(perspective.control.getFrame().lineTensionActive, true);
}

function checkLine() {
  const slack = fixture({ floatX: 700 });
  assert.equal(slack.step(right).floatMoved, false, "moving toward the float creates slack");
  assert.equal(slack.step(left).floatMoved, false, "the return step uses slack");
  assert.equal(slack.step(left).floatMoved, true, "extending beyond the cast reach drags the float");
  const blocked = fixture();
  assert.equal(blocked.step(left, { checkWater: x => x >= 400 }).floatMoved, false);
  assert.equal(blocked.position.x, 400);
  blocked.config.physics.castRodControl.floatDrag.enabled = false; assert.equal(blocked.step(right).floatMoved, false);
  for (const perspective of [false, true]) {
    const f = fixture({ perspective });
    const initial = f.metric.distanceMeters(400, 1000, f.position.x, f.position.y);
    for (let i = 0; i < 20; i++) f.step(left);
    assert(Math.abs(f.metric.distanceMeters(f.control.getScreenX(), 1000, f.position.x, f.position.y) - initial) < 1e-8,
      "taut line reach uses ground metres on both uniform and perspective water");
  }
}

function checkProbability() {
  const env = { hookDepth: 1, bottomDepth: 10, lineLength: 1 };
  const gear = { hookSize: 1, baitCandidates: ["worm"], castRodFloatMoving: false, isSpinning: false };
  const evaluate = (dt = 1000, extra = {}) => { bite.evaluateBite(dt, env, { ...gear, ...extra }); return events.at(-1).detail.fishRolls[0].chance; };
  assert.equal(evaluate(), 0.5, "an undisturbed tick restores natural chance");
  evaluate(10, { castRodFloatMoving: true });
  assert.equal(evaluate(990), 0.001, "motion between bite ticks is retained");
  assert.equal(evaluate(), 0.5);
  env.hookDepth = 11; assert.equal(evaluate(1000, { castRodFloatMoving: true }), 0); env.hookDepth = 1;
  assert.equal(evaluate(1000, { castRodFloatMoving: true, isSpinning: true }), 0.5);
  config.physics.castRodControl.movingFloatBite.excludeSpinning = false;
  assert.equal(evaluate(1000, { castRodFloatMoving: true, isSpinning: true }), 0.001);
  assert.equal(evaluate(1000, { castRodFloatMoving: true, hookSize: 99 }), 0);
  config.physics.castRodControl.movingFloatBite.enabled = false;
  assert.equal(evaluate(1000, { castRodFloatMoving: true }), 0.5);
  config.physics.castRodControl.movingFloatBite.enabled = true;
  config.physics.castRodControl.enabled = false;
  assert.equal(evaluate(1000, { castRodFloatMoving: true }), 0.5);
  config.physics.castRodControl.enabled = true;
  evaluate(10, { castRodFloatMoving: true }); bite.reset(); assert.equal(evaluate(), 0.5);
  fish.baseChance = 0; assert.equal(evaluate(1000, { castRodFloatMoving: true }), 0); fish.baseChance = 0.5;
}

function deps(f, transitions, spinning = false) {
  const eq = { rod: { variant: spinning ? "spinning" : "float" }, reel: { effectiveStats: { basePower: 1 } } };
  return { config: f.config, castRodControl: f.control, float: f.float, projector: f.projector,
    inventory: { getEquipped: () => eq }, rules: { equipment: { isFeeder: () => false, isSpinning: () => spinning } },
    commands: { setState: (name, data) => transitions.push({ name, data }), panViewport() {} },
    world: { getWaterMetric: () => f.metric, checkWater: f.context.checkWater, getRodVirtualPos: () => ({ x: f.control.getScreenX() ?? 400, y: 1000 }) },
    input: { getState: () => right }, canPlayerCast: () => true, rng: { chance: () => false },
    getViewportSize: () => f.metrics, clock: { now: 1000 }, getCastStartTime: () => 0 };
}

function checkStates() {
  for (const spinning of [false, true]) for (const guaranteed of [false, true]) {
    const f = fixture(); f.float.guaranteed = guaranteed;
    const transitions = [], fish = { id: "same-fish" }, state = new BitingState(deps(f, transitions, spinning));
    state.enter({ fish });
    const touch = { ...right, pointerAction: "rod_control_x", isPulling: true };
    state.handleInput(touch); assert.equal(transitions.length, 0, "horizontal touch hold does not strike early");
    state.update(16, f.bounds, { input: touch, env: {} });
    assert.equal(transitions[0].name, guaranteed ? "playing" : "waiting");
    assert.equal(f.float.hooked, guaranteed ? 1 : 0); assert.equal(f.float.stopped, guaranteed ? 0 : 1);
    if (guaranteed) assert.equal(transitions[0].data.fish, fish);
    assert.equal(f.float.ticks, 0, "reaction samples the current bite window before sequence advancement");
  }
  const f = fixture(), transitions = [], state = new BitingState(deps(f, transitions));
  state.enter({ fish: {} }); f.config.physics.castRodControl.range.rightRatio = 0;
  state.update(16, f.bounds, { input: right, env: {} }); assert.equal(transitions.length, 0);
  f.config.physics.castRodControl.range.rightRatio = 1; f.config.physics.castRodControl.biteReaction.enabled = false;
  state.update(16, f.bounds, { input: right, env: {} }); assert.equal(transitions.length, 0);
  for (const spinning of [false, true]) {
    const w = fixture(), options = deps(w, [], spinning);
    options.biteSystem = { reset() {}, evaluateBite(dt, env, gear) {
      assert.equal(gear.isSpinning, spinning); assert.equal(gear.castRodFloatMoving, true); return null;
    } };
    options.world.getBiteEnv = () => ({});
    options.float.update = (bounds, dt, env, checkWater, effectiveInput) => {
      assert.ok(effectiveInput.castRodDeltaX > 0, "waiting passes actual sideways rod motion to the float's tilt response");
      assert.equal(effectiveInput.isPulling, false, "lateral tilt must not also retrieve");
    };
    options.fishing = { collectAvailableBaits(eq, eaten, target) { target.push("worm"); } };
    const waiting = new WaitingState(options); waiting.enter(); waiting.update(1000, w.bounds, { input: right, env: {} });
  }
}

checkSpeedMultipliers(); checkMovement(); checkLine(); checkProbability(); checkStates();
console.log("Cast rod control passed: green-zone ranges, analog input, x3 slack/x1 taut speed and same-frame time splitting, line-pull activation, zero/live multipliers, delta/release/reset and viewport ownership; perspective/water geometry; touch hold isolation; bite windows/identity/boundary holds; tick-latched absolute probability and spinning exceptions; waiting integration.");
