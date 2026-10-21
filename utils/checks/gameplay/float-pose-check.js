"use strict";

// Spec 127: the float's drawn pose comes from one spring model fed by forces, not from hand-written angles. Catches
// wrong lean directions (pull, fish, diagonal retrieve), sideways lean from motion toward the player, distance-
// dependent lean, jumps on state changes or reversals, frame-rate dependence and a stretched instead of sunk float.
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const runtime = new SourceRuntime();
const load = (path) => runtime.importModule(path);
const { FloatPoseAnimator } = load("src/game/presentation/fishing/float_pose_animator.js");
const { FloatEntity } = load("src/game/domain/tackle/float_entity.js");
const { WaterMetric } = load("src/game/domain/locations/water_metric.js");
const { FLOAT_POSE_PHYSICS_CONFIG: CONFIG } = load("src/game/config/physics/physics_config.js");

const flat = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500 });
const signals = (overrides = {}) => ({
  castSerial: 1, angleDeg: 0, scaleY: 1, isBiteTilt: false, load: 1, lyingSide: 1, restDraft: 0, windDeg: 0,
  lineX: 0, lineY: 0, waterX: 0, waterY: 0, ...overrides,
});

// Runs an animator for `seconds` at `fps`; move(t) gives the float's map position, input(t) its signals.
function run({ seconds = 1.5, fps = 60, metric = flat, config = CONFIG, move = () => ({ x: 500, y: 500 }),
  input = () => signals(), animator = new FloatPoseAnimator({ getConfig: () => config }), onFrame = null } = {}) {
  const dt = 1 / fps;
  const frames = Math.round(seconds * fps);
  let previous = null;
  for (let frame = 0; frame <= frames; frame += 1) {
    const t = frame * dt;
    const pose = animator.advance({ signals: input(t), position: move(t), metric, dtSec: dt });
    onFrame?.(pose, previous, t);
    previous = { rollDeg: pose.rollDeg, pitchDeg: pose.pitchDeg, draft: pose.draft };
  }
  return animator.pose;
}

// Criterion 2: the line or the fish pulls the bottom; the tip leans the other way.
assert(run({ input: () => signals({ lineX: -1 }) }).rollDeg > 3, "line pulling the bottom left turns the tip right");
assert(run({ input: () => signals({ lineX: 1 }) }).rollDeg < -3, "line pulling the bottom right turns the tip left");
assert(run({ move: (t) => ({ x: 500 - 60 * t, y: 500 }) }).rollDeg > 3, "dragged left, the tip lags to the right");
assert(run({ move: (t) => ({ x: 500 + 60 * t, y: 500 }) }).rollDeg < -3, "dragged right, the tip lags to the left");
const fishLeft = run({ input: () => signals({ angleDeg: 20, isBiteTilt: true }), move: (t) => ({ x: 500 - 4 * t, y: 500 }) });
assert(fishLeft.rollDeg > 20, "a bite step that drags the float left leans the tip right, with the motion adding to it");

// Criterion 1: a diagonal retrieve toward the player (rod at the bottom right) leans the tip away along both axes;
// pulling straight in never turns the float sideways.
const diagonal = run({ move: (t) => ({ x: 500 + 40 * t, y: 500 + 40 * t }),
  input: () => signals({ lineX: Math.SQRT1_2, lineY: Math.SQRT1_2 }) });
assert(diagonal.rollDeg < -3 && diagonal.pitchDeg < -3 && diagonal.rotationDeg < -3,
  "diagonal retrieve: tip left and away from the player, drawn turned left");
const straight = run({ move: (t) => ({ x: 500, y: 500 + 60 * t }), input: () => signals({ lineY: 1 }) });
assert(straight.rollDeg === 0 && straight.rotationDeg === 0, "a pull straight toward the player turns no sideways lean");
// TK-027 projection: the camera looks down at the water, so a lean away from the player draws a little longer and a
// lean toward the player shorter (the part along the water is flattened by the surface tilt).
assert(straight.foreshortening > 1, "leaning away from the player draws longer");
const toward = run({ move: (t) => ({ x: 500, y: 500 - 60 * t }), input: () => signals({ lineY: -1 }) });
assert(toward.pitchDeg > 3 && toward.foreshortening < 0.95, "leaning toward the player draws shorter (pseudo-distance)");

// Ground metres: the same ground speed leans the float the same near the shore and far away.
const perspective = WaterMetric.illustrated({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500,
  maxMeters: 30, farScale: 0.3, lateralContraction: true });
const groundMove = (metres) => {
  const point = { x: 0, y: 0 };
  return (t) => perspective.toVirtual(1 * t, metres, point) && { x: point.x, y: point.y };
};
const nearLean = run({ metric: perspective, move: groundMove(3) }).rollDeg;
const farLean = run({ metric: perspective, move: groundMove(27) }).rollDeg;
assert(nearLean < -3 && Math.abs(nearLean - farLean) < 0.2, `1 m/s leans alike near and far (${nearLean} / ${farLean})`);

// Criterion 4: a sharp reversal, a bite step and its end only move the target; the pose never jumps.
let largestStep = 0;
const track = (pose, previous) => {
  if (previous) largestStep = Math.max(largestStep, Math.abs(pose.rollDeg - previous.rollDeg));
};
run({ seconds: 2, input: (t) => signals({ lineX: t < 1 ? 1 : -1 }), onFrame: track });
assert(largestStep < 3, `a full left-right reversal moves at most ${largestStep.toFixed(2)}° per frame`);
largestStep = 0;
run({ seconds: 2, input: (t) => signals({ angleDeg: t > 0.5 && t < 1.2 ? 25 : 0, isBiteTilt: t > 0.5 && t < 1.2 }),
  onFrame: track });
assert(largestStep < 0.25 * 25, `a 25° bite step and its end move at most ${largestStep.toFixed(2)}° per frame`);

// Frame rate: 30, 60 and 144 FPS reach the same pose.
const atFps = (fps) => run({ seconds: 0.4, fps, input: (t) => signals({ lineX: t < 0.2 ? 1 : -1 }) }).rollDeg;
assert(Math.abs(atFps(30) - atFps(144)) < 0.5 && Math.abs(atFps(60) - atFps(144)) < 0.2,
  `frame-rate independent (${atFps(30)} / ${atFps(60)} / ${atFps(144)})`);

// Criterion 6: the body sinks, never stretches; heavier ballast rides deeper; a lifting bite lays the float down.
assert(run({ input: () => signals({ scaleY: 0 }) }).visibleShare < 0.02, "a full sink hides the body");
assert(Math.abs(run({ input: () => signals({ restDraft: 0.3 }) }).visibleShare - 0.7) < 0.01, "rest draft 0.3 shows 70 %");
const lifted = run({ input: () => signals({ scaleY: 1.5 }) });
assert(lifted.rollDeg > 40 && lifted.visibleShare === 1, "a 50 % lift takes the load off: the float leans to lying, nothing stretches");
assert(run({ input: () => signals({ lineY: 1, restDraft: 0 }) }).visibleShare < 0.85, "the line pull sinks the float a little");

// Lying and standing up from the real float rig; over-depth keeps it lying. The rig's own sinking rules are reused.
const floatConfig = { getFloatPoseConfig: () => CONFIG, getMaxDtMs: () => 50 };
const rig = new FloatEntity(500, 500, { sinkingDelayMs: 0, sinkingDurationMs: 400 }, 10, { next: () => 0.25 }, null,
  null, null, { fightPhysicsConfig: floatConfig });
const ballast = { effectiveStats: { ballastWeight: "heavy", ballastProfiles: { heavy: { speedMult: 2, restDraft: 0.3 } } } };
rig.cast(500, 500, 1, false, ballast);
const rigAnimator = new FloatPoseAnimator({ getConfig: () => CONFIG });
const bounds = { left: 0, right: 1000, top: 0, bottom: 1000 };
const step = () => {
  rig.update(bounds, 16, null, null, {}, 0, null);
  return rigAnimator.advance({ signals: rig.getPoseSignals(), position: rig.getPosition(), metric: flat, dtSec: 0.016 });
};
assert.equal(step().rollDeg, 90, "a new cast starts lying on its side, placed without a transition");
let standing;
for (let frame = 0; frame < 120; frame += 1) standing = step();
assert(Math.abs(standing.rollDeg) < 1 && Math.abs(standing.visibleShare - 0.7) < 0.02,
  "after the shot sinks the float stands, heavy ballast rides 30 % deeper");
rig.cast(500, 500, 1, true, ballast);
let lying;
for (let frame = 0; frame < 120; frame += 1) lying = step();
assert(Math.abs(Math.abs(lying.rollDeg) - 90) < 1, "over-depth keeps the float lying");
assert.equal(rig.getVisualState().angle, undefined, "the rig no longer writes a drawn angle");

// Line and current reach the pose from the rig's update; records are reused (no allocation per frame).
rig.cast(500, 500, 1, false, ballast);
const pull = { x: 0.6, y: 0.8 };
rig.update(bounds, 16, { current: { speedPxPerSec: 10, direction: { x: 1, y: 0 } } }, null,
  { isPulling: true, idleRetrieveParams: null }, 0, pull);
const recorded = rig.getPoseSignals();
assert(recorded.lineX === 0.6 && recorded.lineY === 0.8 && recorded.waterX === 10 && recorded.waterY === 0,
  "the rig records the line pull and the water's velocity for the pose");
assert.equal(rig.getPoseSignals(), recorded, "the signals record is reused");
const reused = new FloatPoseAnimator({ getConfig: () => CONFIG });
const first = reused.advance({ signals: signals(), position: { x: 1, y: 1 }, metric: flat, dtSec: 0.016 });
assert.equal(reused.advance({ signals: signals(), position: { x: 1, y: 1 }, metric: flat, dtSec: 0.016 }), first,
  "the pose record is reused");

// Disabled: only the intended lean, no forces and no transition.
const off = run({ config: { ...CONFIG, enabled: false }, input: () => signals({ angleDeg: 12, lineX: 1, windDeg: 20 }) });
assert(off.rollDeg === 12 && off.visibleShare === 1, "disabled pose shows the intended lean only");

// Stage 4 (TK-025…TK-028): a lying float is towed by its bottom. Lying on its right side (cast side +1) and dragged
// right at 0.5 m/s, the bottom moves first and the tip swings around behind it; it ends trailing left.
{
  const lyingSignals = (overrides = {}) => signals({ angleDeg: 90, load: 0, lyingSide: 1, ...overrides });
  const towRight = (t) => ({ x: 500 + 25 * Math.min(t, 3), y: 500 });
  let firstStep = null;
  let largestLeanStep = 0;
  let largestPitch = 0;
  const towed = run({ seconds: 4, move: towRight, input: () => lyingSignals(), onFrame: (pose, previous, t) => {
    if (previous && firstStep === null && t > 0) firstStep = Math.abs(pose.rollDeg - previous.rollDeg);
    if (previous) largestLeanStep = Math.max(largestLeanStep,
      Math.hypot(pose.rollDeg - previous.rollDeg, pose.pitchDeg - previous.pitchDeg));
    largestPitch = Math.max(largestPitch, pose.pitchDeg);
  } });
  assert(firstStep < 2, `the first frame of the tow turns the body only a little (${firstStep}°)`);
  assert(towed.rollDeg < -80, `after 1.5 m of tow (6 trail lengths) the tip trails behind the bottom, lying left (${towed.rollDeg}°)`);
  assert(largestPitch > 30, "the tip swings around through the side toward the player, it never flips");
  assert(largestLeanStep < 6, `the swing is smooth (largest step ${largestLeanStep.toFixed(2)}° per frame)`);
  const rest = run({ seconds: 5, move: (t) => ({ x: 500 + 25 * Math.min(t, 3), y: 500 }), input: () => lyingSignals() });
  assert(rest.rollDeg < -80, "at rest the lying float keeps the direction it was towed into");
  const atFps = (fps) => run({ seconds: 2, fps, move: towRight, input: () => lyingSignals() }).rollDeg;
  assert(Math.abs(atFps(30) - atFps(144)) < 2 && Math.abs(atFps(60) - atFps(144)) < 1,
    `the tow depends on the path, not the frame rate (${atFps(30)} / ${atFps(60)} / ${atFps(144)})`);
  const drifting = run({ seconds: 2, move: (t) => ({ x: 500 + 20 * t, y: 500 }),
    input: () => lyingSignals({ waterX: 20 }) });
  assert(drifting.rollDeg > 80, "drifting with the water does not turn a lying float");
  // Lying toward the player (towed away from the player): shorter by the surface tilt, never invisible.
  const tilted = WaterMetric.illustrated({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500, maxMeters: 20,
    tiltDegrees: 30, farScale: 1 });
  const away = run({ seconds: 3, metric: tilted, move: (t) => ({ x: 500, y: 500 - 25 * Math.min(t, 1.5) }),
    input: () => lyingSignals() });
  assert(away.pitchDeg > 80 && Math.abs(Math.abs(away.rotationDeg) - 180) < 15 && Math.abs(away.foreshortening - 0.5) < 0.1,
    `a float lying toward the player points down the screen at the tilt's share of its length (${away.foreshortening})`);
  // The lean is one vector: lying plus strong forces on both axes stays within the lying angle.
  const clamped = run({ input: () => lyingSignals({ lineX: -1, lineY: -1, windDeg: 40 }) });
  assert(Math.hypot(clamped.rollDeg, clamped.pitchDeg) <= 90 + 1e-6, "the lean vector never exceeds the lying angle");
  // A standing float leaning sideways is a plain rotation of full length.
  const side = run({ input: () => signals({ lineX: -1 }) });
  assert(Math.abs(side.rotationDeg - side.rollDeg) < 1e-9 && Math.abs(side.foreshortening - 1) < 1e-9,
    "a sideways lean draws as rotation at full length");
}

// Image float (stage 3): the render model and the Canvas fallback. The item length is the antenna above the art's
// waterline at ui.float.displayScale; only the top visible share of the art is drawn; only a night float's tip glows.
{
  const { FishingEquipmentRenderModelBuilder } = load("src/game/presentation/fishing/fishing_equipment_render_model_builder.js");
  const { FloatRenderer } = load("src/game/presentation/fishing/float_renderer.js");
  const floatUi = { displayScale: 2 };
  const builder = new FishingEquipmentRenderModelBuilder({
    projector: { getPerspective: () => ({ scale: 1 }), getScale: () => 1 }, canvasMetrics: { width: 800, height: 600 },
    clock: { delta: 16 }, config: { ui: { float: floatUi } }, getRodScreenX: () => 400,
    rodAnimation: { setSkin() {}, advance() {} }, getWind: () => null,
    floatPose: new FloatPoseAnimator({ getConfig: () => CONFIG }), getWaterMetric: () => flat,
  });
  const skin = { scene: { src: "float.webp", waterline: 0.3, glow: { src: "glow.webp", pad: 8 } } };
  let colour = "#00ff80";
  const entity = { getVisualState: () => ({ color: colour }), getPosition: () => ({ x: 500, y: 500 }),
    isHooked: () => false, getPoseSignals: () => signals({ castSerial: 7 }) };
  const model = {};
  const build = (variant) => builder.buildFloat({ target: model, screenPosition: { x: 50, y: 60 }, floatEntity: entity,
    equipment: { rod: { variant: "float" }, float: { variant, skin, effectiveStats: { width: 3, length: 15 } } } });
  build("day");
  assert(Math.abs(model.bodyHeight - 15 * 2 / 0.3) < 1e-9 && Math.abs(model.visibleShare - 0.3) < 1e-9 &&
    model.imageId === "float.webp" && model.tipGlowId === "", "a day image float: doubled size, antenna above water, no glow");
  build("night");
  assert.equal(model.tipGlowId, "glow.webp", "the night float gets its tip glow");
  assert(model.glow === true && model.glowColor === "#46ff8c", "the night float has a green halo by default");
  colour = "#ff0000";
  build("day");
  assert.equal(model.glow, false, "the bite colours' halo is off by default and a day float has none");
  floatUi.biteHalo = true;
  build("day");
  assert(model.glow === true && model.glowColor === "#ff0000", "the DEV switch brings the bite halo back");
  floatUi.biteHalo = false;
  floatUi.nightHalo = false;
  floatUi.nightTipGlow = false;
  build("night");
  assert(model.glow === false && model.tipGlowId === "", "DEV switches turn the night halo and tip glow off");
  delete floatUi.nightHalo;
  delete floatUi.nightTipGlow;
  colour = "#00ff80";
  build("night");
  const draws = [], states = [];
  const surface = { save() {}, restore() {}, translate() {}, rotate() {}, fillRect: () => draws.push("bar"),
    drawImage: (...args) => draws.push(args), setState: (state) => states.push(state) };
  const images = { tryGet: (id) => ({ "float.webp": { naturalWidth: 33, naturalHeight: 384 },
    "glow.webp": { naturalWidth: 49, naturalHeight: 392 } })[id] ?? null };
  new FloatRenderer({ surface, images }).render(model);
  const [bodyDraw, glowDraw] = draws;
  assert(Math.abs(bodyDraw[4] - 384 * 0.3) < 1e-9 && Math.abs(bodyDraw[8] - model.bodyHeight * 0.3) < 1e-9 &&
    Math.abs(bodyDraw[7] / model.bodyHeight - 33 / 384) < 1e-9, "Canvas draws the art's top 30 % in its proportions");
  assert(glowDraw && states[0].globalCompositeOperation === "lighter", "the tip glow is added with additive light");
  draws.length = 0;
  build("day");
  new FloatRenderer({ surface, images }).render(model);
  assert.equal(draws.length, 1, "a day float draws only its body");
  model.imageId = "missing.webp";
  draws.length = 0;
  new FloatRenderer({ surface, images }).render(model);
  assert.deepEqual(draws, ["bar"], "without its art the float stays a bar");
}

console.log("Float pose passed: line/fish/motion lean the tip away from the pull, diagonal retrieve splits sideways lean from foreshortening, same ground speed same lean near and far, smooth reversals and bite steps, 30/60/144 FPS alike, sinking without stretching, ballast draft, lying/standing/over-depth, reused records; lying float towed by its bottom (swing, rest, path-based, drift, visible toward the player, lean vector clamp); image float crop, doubled size, night-only tip glow, bar fallback.");
