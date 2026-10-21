const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const runtime = new SourceRuntime();
const { FightLandingTensionStage } = runtime.importModule("src/game/application/fishing/fight_landing_tension_stage.js");
const { LineTensionCalculator } = runtime.importModule("src/game/domain/fishing/line_tension_calculator.js");
const config = { enabled: true, alignment: { enabled: false }, tension: {
  towardFishCompensation: { enabled: true, ratePerSecond: 4, loadCurvePower: 1, movementEpsilonPx: 0.001 },
} };
const stage = new FightLandingTensionStage({ config: {}, physicsConfig: { getRodControlConfig: () => config } });
const args = {
  tensionSystem: new LineTensionCalculator(),
  stressSystem: { getEffectiveRodMaxLoadKg: () => 10, getEffectiveLineSystemMaxLoadKg: () => 10,
    getEffectiveHookMaxLoadKg: () => 10 },
  forceData: { fishTensionKg: 8 }, fishRetrieveResult: { fishTensionKg: 8, totalTensionKg: 8 },
  dragContext: { effectiveDragLimitKg: 10, dragLocked: true }, lineState: {}, dtSec: 0.05,
  rodMotion: { deltaPx: 2, fishOffsetX: 100, drivenByInput: true, movementRatio: 1 },
};
assert.ok(stage.calculateTension(args).tensionKg < 8,
  "actual rod motion toward the fish compensates existing fish tension in free alignment mode");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ~= ${b}`);
const { RodSideTensionCompensation } = runtime.importModule("src/game/domain/fishing/rod_side_tension_compensation.js");
const policy = new RodSideTensionCompensation();
const sample = { previousReliefKg: 0, tensionKg: 8, rodLimitKg: 10, dtSec: 0.05,
  rodMotion: args.rodMotion, rodControlConfig: config };
const first = policy.calculate(sample);
assert.ok(first > 0 && first < 8);
assert.ok(policy.calculate({ ...sample, tensionKg: 16 }) / 16 > first / 8, "dash loads get faster proportional relief");
assert.equal(policy.calculate({ ...sample, rodMotion: { ...args.rodMotion, deltaPx: -2 } }), 0);
near(policy.calculate({ ...sample, rodMotion: { ...args.rodMotion, deltaPx: -2, fishOffsetX: -100 } }), first);
for (const rodMotion of [null, { ...args.rodMotion, deltaPx: 0 }, { ...args.rodMotion, drivenByInput: false },
  { ...args.rodMotion, fishOffsetX: 0 }, { ...args.rodMotion, deltaPx: 0.0001 }]) {
  assert.equal(policy.calculate({ ...sample, previousReliefKg: first, rodMotion }), 0, "stop/return/center/boundary clears relief");
}
for (const key of ["enabled", "alignment", "compensation"]) {
  const cfg = JSON.parse(JSON.stringify(config));
  if (key === "enabled") cfg.enabled = false;
  if (key === "alignment") cfg.alignment.enabled = true;
  if (key === "compensation") cfg.tension.towardFishCompensation.enabled = false;
  assert.equal(policy.calculate({ ...sample, previousReliefKg: first, rodControlConfig: cfg }), 0);
}
const tuning = config.tension.towardFishCompensation;
tuning.ratePerSecond = 0; assert.equal(policy.calculate({ ...sample, previousReliefKg: first }), 0); tuning.ratePerSecond = 4;
const simulate = (fps) => {
  let previousReliefKg = 0;
  for (let frame = 0; frame < fps; frame++) previousReliefKg = policy.calculate({ ...sample, previousReliefKg, dtSec: 1 / fps });
  return previousReliefKg;
};
near(simulate(30), simulate(60)); near(simulate(60), simulate(120));
near(policy.calculate({ ...sample, rodMotion: { ...args.rodMotion, movementRatio: 0.5 } }),
  policy.calculate({ ...sample, dtSec: 0.025 }));

// Preview is pure; only the final tension update advances the session's compensation once.
const { TackleStressSystem } = runtime.importModule("src/game/domain/fishing/tackle_stress_system.js");
const stress = new TackleStressSystem({ rod: { getEffectiveMaxLoadKg: () => 10 },
  lineSystem: { getEffectiveLineMaxLoadKg: () => 10 },
  config: { tackleStress: { enabled: false } }, devFlags: { isEnabled: () => false } });
const finalStage = new FightLandingTensionStage({ config: {}, physicsConfig: {
  getRodControlConfig: () => config, getLandingLiftConfig: () => ({ enabled: false }),
  getTensionConfig: () => ({ kgSmoothPerSecond: 18, tackleStress: { enabled: false } }),
} });
const frameArgs = { ...args, stressSystem: stress };
near(finalStage.calculateTension(frameArgs).tensionKg, finalStage.calculateTension(frameArgs).tensionKg);
const final = finalStage.updateTension(frameArgs);
near(final.rodSideReliefKg, first);
near(stress.getDiagnostics().effectiveTensionKg, final.tensionKg);
assert.ok(stress.getFightFrame().rodStressRatio < 0.8, "relief affects real tackle stress, not just the visible bar");
const next = finalStage.updateTension(frameArgs);
assert.ok(next.tensionKg < final.tensionKg, "continuous movement accumulates relief");
const stopped = finalStage.updateTension({ ...frameArgs, rodMotion: { ...args.rodMotion, deltaPx: 0 } });
assert.equal(stopped.rodSideReliefKg, 0); assert.equal(stopped.tensionKg, 8);
assert.equal(stress.getDiagnostics().effectiveTensionKg, 8);
near(finalStage.updateTension(frameArgs).tensionKg, final.tensionKg, "new motion starts a new compensation interval");

// A sideways rod move pulls the line, and with it the float's bottom, to that side without retrieving or changing
// hook depth; the drawn pose leans the tip the other way and settles when the rod stops (spec 127).
const { FloatEntity } = runtime.importModule("src/game/domain/tackle/float_entity.js");
const { FloatPoseAnimator } = runtime.importModule("src/game/presentation/fishing/float_pose_animator.js");
const { WaterMetric } = runtime.importModule("src/game/domain/locations/water_metric.js");
const { FLOAT_POSE_PHYSICS_CONFIG } = runtime.importModule("src/game/config/physics/physics_config.js");
const float = new FloatEntity(100, 100, {}, 10, { next: () => 0.5 }, null, null, null, {
  fightPhysicsConfig: { getFloatPoseConfig: () => FLOAT_POSE_PHYSICS_CONFIG },
});
const metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0 });
const animator = new FloatPoseAnimator({ getConfig: () => FLOAT_POSE_PHYSICS_CONFIG });
const position = { ...float.getPosition() }, depth = float.getCurrentHookDepth();
const pose = (input, frames) => {
  for (let frame = 0; frame < frames; frame += 1) {
    float._recordPoseInputs(input, null);
    float._processMechanics(16, input, 0, null);
    animator.advance({ signals: float.getPoseSignals(), position: float.getPosition(), metric, dtSec: 0.016 });
  }
  return animator.pose.rollDeg;
};
pose({ castRodDeltaX: 0 }, 1);
assert.ok(pose({ castRodDeltaX: 2 }, 20) < 0, "moving rod right pulls the bottom right: the tip leans left");
assert.equal(float.getPoseSignals().lineX, 1);
assert.ok(pose({ castRodDeltaX: -2 }, 40) > 0, "moving rod left pulls the bottom left: the tip leans right");
const tilted = animator.pose.rollDeg;
assert.ok(Math.abs(pose({ castRodDeltaX: 0 }, 60)) < tilted, "tilt settles after motion stops");
assert.equal(float.getPoseSignals().lineX, 0);
assert.equal(float.getPosition().x, position.x); assert.equal(float.getPosition().y, position.y);
assert.equal(float.getCurrentHookDepth(), depth);
assert.equal(float.getVelocity().x, 0); assert.equal(float.getVelocity().y, 0);
console.log("Rod side tension passed: both fish sides, dash scaling, frame-rate independence, partial strokes, stop/boundary/return/disabled modes, pure preview, continuous relief and real tackle stress; a sideways rod move leans the float through the line pull without retrieval.");
