import { DampedSpring } from "../../../engine/animation/damped_spring.js";

const DEG_PER_RAD = 180 / Math.PI;
const TWO_PI = Math.PI * 2;

// The drawn pose of the float (spec 127): a rigid body hanging on its waterline, with a sideways lean (roll, drawn as
// rotation; positive turns the tip right), a lean toward or away from the viewer (pitch, drawn as foreshortening) and
// a draft (share of the body under water). One damped spring per value follows a target that is the tackle's intended
// lean (lying, standing up, bite steps) plus the forces, each scaled by its gain in CONFIG.physics.floatPose:
//
//   motion through the water: the float's measured displacement in ground metres minus the current; the line or the
//     fish drives it at the bottom, so the tip lags behind the motion;
//   line pull toward the rod and the fish's pull: they drag the bottom, so the tip leans away from them;
//   wind on the antenna: the tip leans downwind.
//
// Sideways components turn roll, components toward the player turn pitch, so pulling straight in never turns the
// float sideways. The springs never jump: a state change only moves the target. Visual only: nothing here reaches
// gameplay or its random numbers. Allocation-free per frame.
export class FloatPoseAnimator {
  #getConfig;
  #roll = new DampedSpring();
  #pitch = new DampedSpring();
  #draft = new DampedSpring();
  #castSerial = -1;
  #lastX = NaN;
  #lastY = NaN;
  #planeVelocity = { x: 0, y: 0 };
  #target = { roll: 0, pitch: 0, draft: 0, load: 1 };
  #pose = { rollDeg: 0, pitchDeg: 0, draft: 0, visibleShare: 1, foreshortening: 1 };

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
  advance({ signals, position, metric, dtSec, artDraft = 0 }) {
    const config = this.#getConfig() || {};
    const dt = Math.max(0, Number(dtSec) || 0);
    const fresh = signals.castSerial !== this.#castSerial || !Number.isFinite(this.#lastX);
    const pixelsPerMeter = metric?.pixelsPerMeter > 0 ? metric.pixelsPerMeter : 0;
    let motionX = 0;
    let motionY = 0;
    if (!fresh && dt > 0 && pixelsPerMeter > 0 && config.enabled !== false) {
      const velocity = this.#planeVelocity;
      metric.velocityToBasePlane(position.x, position.y, (position.x - this.#lastX) / dt,
        (position.y - this.#lastY) / dt, velocity);
      motionX = velocity.x / pixelsPerMeter - signals.waterX / pixelsPerMeter;
      motionY = velocity.y / pixelsPerMeter - signals.waterY / pixelsPerMeter;
      const speed = Math.hypot(motionX, motionY);
      const maxSpeed = Math.max(0, Number(config.maxInputSpeedMetersPerSec) || 0);
      // A jump far beyond any real speed is a teleport (line constraint, recast), not motion.
      if (speed > maxSpeed * 3) {
        motionX = 0;
        motionY = 0;
      } else if (speed > maxSpeed) {
        motionX *= maxSpeed / speed;
        motionY *= maxSpeed / speed;
      }
    }
    this.#castSerial = signals.castSerial;
    this.#lastX = position.x;
    this.#lastY = position.y;
    const target = this.#writeTarget(signals, config, motionX, motionY, artDraft);
    const lyingAngle = Math.abs(Number(config.lyingAngleDeg) || 90);
    if (fresh || config.enabled === false) {
      this.#roll.reset(target.roll);
      this.#pitch.reset(target.pitch);
      this.#draft.reset(target.draft);
    } else {
      const stabilityMin = FloatPoseAnimator.#share(config.stabilityMin, 0.35);
      const omega = TWO_PI * Math.max(0, Number(config.naturalFrequencyHz) || 0) *
        Math.sqrt(stabilityMin + (1 - stabilityMin) * target.load);
      const zeta = Math.max(0, Number(config.dampingRatio) || 0);
      this.#roll.step(target.roll, omega, zeta, dt, -lyingAngle, lyingAngle);
      this.#pitch.step(target.pitch, omega, zeta, dt, -lyingAngle, lyingAngle);
      const draft = config.draft || {};
      this.#draft.step(target.draft, TWO_PI * Math.max(0, Number(draft.naturalFrequencyHz) || 0),
        Math.max(0, Number(draft.dampingRatio) || 0), dt, 0, 1.5);
    }
    const pose = this.#pose;
    pose.rollDeg = this.#roll.value;
    pose.pitchDeg = this.#pitch.value;
    pose.draft = this.#draft.value;
    pose.visibleShare = Math.max(0, Math.min(1, 1 - pose.draft));
    pose.foreshortening = Math.abs(Math.cos(pose.pitchDeg / DEG_PER_RAD));
    return pose;
  }

  // Targets of this frame: the intended lean plus the soft-limited forces; the draft from the load, the bite and the
  // line. A rising bite (scaleY above 1: the fish lifts the shot) takes the load off, so the float rises and lies down.
  #writeTarget(signals, config, motionX, motionY, artDraft) {
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
    const intent = (Number(signals.angleDeg) || 0) * (signals.isBiteTilt ? fishGain : 1) +
      signals.lyingSide * lyingAngle * lift;
    const forceX = enabled ? -motionGain * motionX - lineGain * signals.lineX + windGain * signals.windDeg : 0;
    const forceY = enabled ? -motionGain * motionY - lineGain * signals.lineY : 0;
    const target = this.#target;
    target.load = load;
    target.roll = Math.max(-lyingAngle, Math.min(lyingAngle, intent + maxForce * Math.tanh(forceX / maxForce)));
    target.pitch = maxForce * Math.tanh(forceY / maxForce);
    const linePull = enabled ? FloatPoseAnimator.#share(config.draft?.linePull, 0) * Math.hypot(signals.lineX, signals.lineY) : 0;
    // The ballast sinks the part above the art's waterline: the bar's whole length, an image float's antenna.
    const art = Math.max(0, Math.min(1, Number(artDraft) || 0));
    const restDraft = art + (Number(signals.restDraft) || 0) * (1 - art);
    target.draft = Math.max(0, Math.min(1.5, restDraft * load + sink * (1 - art) + linePull * (1 - art)));
    return target;
  }

  static #share(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
  }
}
