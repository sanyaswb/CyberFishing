import { CrossingWavePattern } from "../../../engine/animation/crossing_wave_pattern.js";

const TWO_PI = Math.PI * 2;
const RAD_PER_DEG = Math.PI / 180;

// The float rocking on the water's waves (spec 128). The water under the float moves as the scene's water does: the
// same crossing waves (CrossingWavePattern) with CONFIG.canvas.water's amplitude, wavelength, speed and vertical share,
// smaller far away (the water metric's surface size). Pixi's DisplacementFilter samples the art at p + offset
// (vendor/pixi 8.22.0, filter fragment: texture(uTexture, vTextureCoord + offset)), so the water's art moves by
// -offset; the float moves with the art.
//
//   standing: up and down with the water under its waterline point, and swayShare of its sideways shift;
//   lying: up and down with the mean of the water under both ends of its visible body, and turned by the water's
//   slope between them (rotationGain, at most maxRotationDeg); the caller turns the body about its middle.
//
// The lying share is the spec 127 lean over lyingAngleDeg, so the change between the two needs no state. A function of
// time and place only: the same at any frame rate. Visual only; allocation-free (one reused result).
export class FloatWaveRocking {
  #getSettings;
  #result = { dx: 0, dy: 0, turnRad: 0 };

  // getSettings: () => CONFIG.canvas.water (read every frame, so DEV edits apply at once).
  constructor({ getSettings }) {
    if (typeof getSettings !== "function") throw new TypeError("FloatWaveRocking requires getSettings");
    this.#getSettings = getSettings;
  }

  // nowMs: the frame's real clock; position: the float on the map (map pixels are art pixels); metric: the location's
  // WaterMetric; screenScale: logical pixels per map pixel; pose: FloatPoseAnimator's pose; lyingAngleDeg: the lean
  // of a lying float; visibleLength / rotationRad: the drawn visible body; biting: a bite step shows.
  // Returns { dx, dy } in logical pixels for the waterline point and turnRad for the body about its middle.
  compute({ nowMs, position, metric, screenScale, pose, lyingAngleDeg, visibleLength, rotationRad, biting = false }) {
    const result = this.#result;
    result.dx = 0;
    result.dy = 0;
    result.turnRad = 0;
    const water = this.#getSettings() || {};
    const rocking = water.floatRocking || {};
    if (water.enabled !== true || rocking.enabled !== true || !metric || !(screenScale > 0)) return result;
    const strength = biting ? FloatWaveRocking.#share(rocking.biteShare) : 1;
    const amplitude = FloatWaveRocking.#positive(water.amplitude) * screenScale * metric.surfaceScaleAt(position.y) * strength;
    if (!(amplitude > 0)) return result;
    const k = TWO_PI / Math.max(1, Number(water.wavelength) || 1);
    const travel = k * (Number(water.speed) || 0) * (Number(nowMs) || 0) / 1000;
    const nearArtPerMeter = metric.pixelsPerMeterY(metric.shoreY);
    const vertical = amplitude * FloatWaveRocking.#positive(water.verticalShare);
    const surfaceX = position.x / metric.surfaceScaleAt(position.y);
    const surfaceY = -metric.metersFromShore(position.y) * nearArtPerMeter;
    const bottomY = CrossingWavePattern.sampleAt(CrossingWavePattern.WAVES_Y, k, surfaceX, surfaceY, travel);
    const lean = Math.hypot(Number(pose?.rollDeg) || 0, Number(pose?.pitchDeg) || 0);
    const lying = Math.min(1, lean / Math.max(1e-6, Math.abs(Number(lyingAngleDeg) || 90)));
    const bob = FloatWaveRocking.#positive(rocking.bobShare);
    if (lying < 1) {
      const sideways = CrossingWavePattern.sampleAt(CrossingWavePattern.WAVES_X, k, surfaceX, surfaceY, travel);
      result.dx = -amplitude * FloatWaveRocking.#positive(rocking.swayShare) * sideways * (1 - lying);
      result.dy = -vertical * bob * bottomY * (1 - lying);
    }
    const length = Math.max(0, Number(visibleLength) || 0);
    if (lying > 0 && length > 0) {
      // The visible body's far end on the map (the screen is the map scaled), and the water under it.
      const rotation = Number(rotationRad) || 0;
      const tipX = position.x + length * Math.sin(rotation) / screenScale;
      const tipMapY = position.y - length * Math.cos(rotation) / screenScale;
      const tipY = CrossingWavePattern.sampleAt(CrossingWavePattern.WAVES_Y, k, tipX / metric.surfaceScaleAt(tipMapY),
        -metric.metersFromShore(tipMapY) * nearArtPerMeter, travel);
      result.dy += -vertical * bob * (bottomY + tipY) / 2 * lying;
      // The body from the waterline point to its end, with each end moved by the water under it: its new angle.
      const rise = -vertical * (tipY - bottomY);
      const turned = Math.atan2(length * Math.sin(rotation), length * Math.cos(rotation) - rise);
      let turn = turned - rotation;
      if (turn > Math.PI) turn -= TWO_PI;
      else if (turn < -Math.PI) turn += TWO_PI;
      const limit = FloatWaveRocking.#positive(rocking.maxRotationDeg) * RAD_PER_DEG;
      turn *= FloatWaveRocking.#positive(rocking.rotationGain);
      result.turnRad = Math.max(-limit, Math.min(limit, turn)) * lying;
    }
    return result;
  }

  static #positive(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  static #share(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 1;
  }
}
