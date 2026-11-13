import { DampedSpring } from "../../../engine/animation/damped_spring.js";

const RAD_PER_DEG = Math.PI / 180;
const DEG_PER_RAD = 180 / Math.PI;
const TWO_PI = Math.PI * 2;

// The drawn pose of the float (spec 127): a rigid body hanging on its waterline point, where the line is attached.
// Its lean is one vector on the water plane (X sideways, positive turns the tip right; Z toward the player): the length
// is the angle from upright, the direction is where the tip points. One damped spring per component and one for the
// draft (share of the body under water) follow targets made of:
//
//   the lying part: lyingAngleDeg x (1 - load) along the towed direction. The tip of a lying body is a point in ground
//     metres that the bottom drags behind it at lying.trailLengthMeters (a towed stick / tractrix follower): the
//     bottom moves first, the top swings behind and lines up with the motion; at rest the direction stays;
//   the fish's bite steps (sideways, scaled by gains.fish);
//   the forces, each scaled by its gain in CONFIG.physics.floatPose: motion through the water (the measured
//     displacement in ground metres minus the current; the tip lags behind it), the line pull and the wind.
//
// The pose is drawn by projecting the leaning body onto the screen: its vertical part keeps its length, its part along
// the water is flattened by the surface tilt (WaterMetric.surfaceSquashY, spec 126). A float leaning toward the player
// is shorter, one lying toward the player still shows. The springs never jump: a state change only moves the target.
// Visual only: nothing here reaches gameplay or its random numbers. Allocation-free per frame.
export class FloatPoseAnimator {
  #getConfig;
  #leanX = new DampedSpring();
  #leanZ = new DampedSpring();
  #draft = new DampedSpring();
  #castSerial = -1;
  #towSerial = -1;
  #lastX = NaN;
  #lastY = NaN;
  #planeVelocity = { x: 0, y: 0 };
  #ground = { x: 0, y: 0 };
  // The lying body's bottom and tip in the lean frame (metres: X sideways, Z toward the player).
  #bottom = { x: 0, z: 0 };
  #tip = { x: 0, z: 0 };
  #direction = { x: 1, z: 0 };
  #target = { x: 0, z: 0, draft: 0, load: 1 };
  #pose = { rollDeg: 0, pitchDeg: 0, rotationDeg: 0, draft: 0, visibleShare: 1, foreshortening: 1 };

  // getConfig: () => CONFIG.physics.floatPose (read every frame, so DEV edits apply at once).
  constructor({ getConfig }) {
    if (typeof getConfig !== "function") throw new TypeError("FloatPoseAnimator requires getConfig");
    this.#getConfig = getConfig;
  }

  get pose() {
    return this.#pose;
  }

  // signals: FloatEntity.getPoseSignals(); position: the float on the map; metric: the location's WaterMetric;
  // dtSec: the frame time; artDraft: share of an image float's body under water at rest (its art below the
  // waterline; 0 for the bar). A new cast (or the first frame) places the pose on its target without a transition.
  // rollDeg / pitchDeg are the lean's components; rotationDeg and foreshortening (drawn length share) its projection.
  advance({ signals, position, metric, dtSec, artDraft = 0 }) {
    const config = this.#getConfig() || {};
    const dt = Math.max(0, Number(dtSec) || 0);
    const fresh = signals.castSerial !== this.#castSerial || !Number.isFinite(this.#lastX);
    const pixelsPerMeter = metric?.pixelsPerMeter > 0 ? metric.pixelsPerMeter : 0;
    const maxSpeed = Math.max(0, Number(config.maxInputSpeedMetersPerSec) || 0);
    let motionX = 0;
    let motionZ = 0;
    let waterX = 0;
    let waterZ = 0;
    let teleport = false;
    if (!fresh && dt > 0 && pixelsPerMeter > 0) {
      const velocity = this.#planeVelocity;
      metric.velocityToBasePlane(position.x, position.y, (position.x - this.#lastX) / dt,
        (position.y - this.#lastY) / dt, velocity);
      waterX = signals.waterX / pixelsPerMeter;
      waterZ = signals.waterY / pixelsPerMeter;
      motionX = velocity.x / pixelsPerMeter - waterX;
      motionZ = velocity.y / pixelsPerMeter - waterZ;
      const speed = Math.hypot(motionX, motionZ);
      // A jump far beyond any real speed is a teleport (line constraint, recast), not motion.
      if (speed > maxSpeed * 3) {
        teleport = true;
        motionX = 0;
        motionZ = 0;
      } else if (speed > maxSpeed) {
        motionX *= maxSpeed / speed;
        motionZ *= maxSpeed / speed;
      }
    }
    this.#castSerial = signals.castSerial;
    this.#lastX = position.x;
    this.#lastY = position.y;
    this.#tow(signals, config, metric, position, fresh || teleport || pixelsPerMeter === 0, waterX * dt, waterZ * dt);
    const enabled = config.enabled !== false;
    const target = this.#writeTarget(signals, config, enabled ? motionX : 0, enabled ? motionZ : 0, artDraft);
    const lyingAngle = Math.abs(Number(config.lyingAngleDeg) || 90);
    if (fresh || !enabled) {
      this.#leanX.reset(target.x);
      this.#leanZ.reset(target.z);
      this.#draft.reset(target.draft);
    } else {
      const stabilityMin = FloatPoseAnimator.#share(config.stabilityMin, 0.35);
      const omega = TWO_PI * Math.max(0, Number(config.naturalFrequencyHz) || 0) *
        Math.sqrt(stabilityMin + (1 - stabilityMin) * target.load);
      const zeta = Math.max(0, Number(config.dampingRatio) || 0);
      this.#leanX.step(target.x, omega, zeta, dt, -lyingAngle, lyingAngle);
      this.#leanZ.step(target.z, omega, zeta, dt, -lyingAngle, lyingAngle);
      const draft = config.draft || {};
      this.#draft.step(target.draft, TWO_PI * Math.max(0, Number(draft.naturalFrequencyHz) || 0),
        Math.max(0, Number(draft.dampingRatio) || 0), dt, 0, 1.5);
    }
    const pose = this.#pose;
    pose.rollDeg = this.#leanX.value;
    pose.pitchDeg = this.#leanZ.value;
    pose.draft = this.#draft.value;
    pose.visibleShare = Math.max(0, Math.min(1, 1 - pose.draft));
    this.#project(pose, Number.isFinite(metric?.surfaceSquashY) ? metric.surfaceSquashY : 1);
    return pose;
  }

  // The lying body's direction, towed by its bottom (TK-026): the tip moves with the water, then the bottom drags it
  // along the line between them so they stay trailLengthMeters apart. Distance-based, so the frame rate does not
  // matter; a reversal swings the tip around through the side it was on. A new cast lays it on the cast side; a
  // teleport moves the body without turning it.
  #tow(signals, config, metric, position, reset, waterDx, waterDz) {
    const trail = Math.max(1e-3, Number(config.lying?.trailLengthMeters) || 0.25);
    const bottom = this.#bottom;
    const tip = this.#tip;
    const direction = this.#direction;
    const castSide = signals.lyingSide < 0 ? -1 : 1;
    const previousX = bottom.x;
    const previousZ = bottom.z;
    if (metric) {
      metric.toGround(position.x, position.y, this.#ground);
      bottom.x = this.#ground.x;
      bottom.z = -this.#ground.y;
    }
    if (signals.castSerial !== this.#towSerial) {
      this.#towSerial = signals.castSerial;
      direction.x = castSide;
      direction.z = 0;
      reset = true;
    }
    if (!reset) {
      tip.x += waterDx;
      tip.z += waterDz;
      // Dragged toward its own tip the body is pushed head first, an unstable balance the follower alone leaves very
      // slowly: the more head first, the more the tip is turned toward the player, so it swings around (and shows
      // while it does) instead of sliding ahead.
      const moveX = bottom.x - previousX - waterDx;
      const moveZ = bottom.z - previousZ - waterDz;
      const move = Math.hypot(moveX, moveZ);
      const headFirst = move > 1e-9 ? Math.max(0, (moveX * direction.x + moveZ * direction.z) / move) : 0;
      if (headFirst > 0) {
        tip.x -= direction.z * move * headFirst;
        tip.z += Math.abs(direction.x) * move * headFirst;
      }
      const dx = tip.x - bottom.x;
      const dz = tip.z - bottom.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 1e-9) {
        direction.x = dx / distance;
        direction.z = dz / distance;
      }
    }
    tip.x = bottom.x + direction.x * trail;
    tip.z = bottom.z + direction.z * trail;
  }


  // Targets of this frame: the lying part along the towed direction, the fish's bite step, the soft-limited forces;
  // the draft from the load, the bite and the line. A rising bite (scaleY above 1: the fish lifts the shot) takes the
  // load off, so the float rises and lies down.
  #writeTarget(signals, config, motionX, motionZ, artDraft) {
    const gains = config.gains || {};
    const lyingAngle = Math.abs(Number(config.lyingAngleDeg) || 90);
    const maxForce = Math.max(1e-6, Number(config.maxForceTiltDeg) || 60);
    const motionGain = Number(gains.motion) || 0;
    const lineGain = Number(gains.line) || 0;
    const fishGain = Number.isFinite(gains.fish) ? gains.fish : 1;
    const windGain = Number.isFinite(gains.wind) ? gains.wind : 1;
    const scaleY = Number.isFinite(signals.scaleY) ? signals.scaleY : 1;
    const lift = Math.max(0, Math.min(1, scaleY - 1));
    const sink = Math.max(0, 1 - scaleY);
    const load = Math.max(0, Math.min(1, Number(signals.load) || 0)) * (1 - lift);
    const enabled = config.enabled !== false;
    // The rig's intended lean is lying x (1 - load) outside bites: the towed direction carries it. In a bite it is the
    // fish's step, sideways as authored.
    const lying = (enabled ? lyingAngle * (1 - load) : 0);
    const fish = signals.isBiteTilt ? (Number(signals.angleDeg) || 0) * fishGain : 0;
    let baseX = lying * this.#direction.x + fish;
    let baseZ = lying * this.#direction.z;
    if (!enabled) baseX = signals.isBiteTilt ? fish : Number(signals.angleDeg) || 0;
    let forceX = enabled ? -motionGain * motionX - lineGain * signals.lineX + windGain * signals.windDeg : 0;
    let forceZ = enabled ? -motionGain * motionZ - lineGain * signals.lineY : 0;
    const forceLength = Math.hypot(forceX, forceZ);
    if (forceLength > 1e-9) {
      const limited = maxForce * Math.tanh(forceLength / maxForce) / forceLength;
      forceX *= limited;
      forceZ *= limited;
    }
    let x = baseX + forceX;
    let z = baseZ + forceZ;
    const length = Math.hypot(x, z);
    if (length > lyingAngle) {
      x *= lyingAngle / length;
      z *= lyingAngle / length;
    }
    const target = this.#target;
    target.load = load;
    target.x = x;
    target.z = z;
    const linePull = enabled ? FloatPoseAnimator.#share(config.draft?.linePull, 0) * Math.hypot(signals.lineX, signals.lineY) : 0;
    // The ballast sinks the part above the art's waterline: the bar's whole length, an image float's antenna.
    const art = Math.max(0, Math.min(1, Number(artDraft) || 0));
    const restDraft = art + (Number(signals.restDraft) || 0) * (1 - art);
    target.draft = Math.max(0, Math.min(1.5, restDraft * load + sink * (1 - art) + linePull * (1 - art)));
    return target;
  }

  // Body direction (sin θ ux, cos θ up, sin θ uz) drawn as (x, up + z-along-the-water x squash): rotation and the
  // drawn length share. A standing lean sideways is a plain rotation of full length (TK-027).
  #project(pose, squash) {
    const angle = Math.hypot(pose.rollDeg, pose.pitchDeg) * RAD_PER_DEG;
    if (!(angle > 1e-9)) {
      pose.rotationDeg = 0;
      pose.foreshortening = 1;
      return;
    }
    const sideways = Math.sin(angle) * pose.rollDeg / Math.hypot(pose.rollDeg, pose.pitchDeg);
    const towardPlayer = Math.sin(angle) * pose.pitchDeg / Math.hypot(pose.rollDeg, pose.pitchDeg);
    const up = Math.cos(angle) - towardPlayer * Math.max(0, squash);
    pose.rotationDeg = Math.atan2(sideways, up) * DEG_PER_RAD;
    pose.foreshortening = Math.hypot(sideways, up);
  }

  static #share(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
  }
}
