// Spec 179 stage J (TK-372, owner): the emission shakes the view. «спочатку тряска періодична і рідка на початку
// амплітуда не велика а на піку постійна (сила постійно коливається але у більших діапазонах)».
// - Jolts (before and after the peak): short shakes of joltSec (± irregularity), the next one after an interval that
//   shortens from joltIntervalSec[0] to [1] as the emission's intensity grows (± irregularity); a jolt's size grows from
//   joltPx[0] to [1] with the intensity (the higher, the stronger) and each jolt rises and settles (a sine arch).
// - The peak (phase "peak"): a constant shake blended in over peakBlendSec; its size wanders between peakPx[0] and
//   [1], a new target every wanderSec (± irregularity), eased toward it — the strength always swings, in a wider range.
// The offset's direction: two unrelated sines per axis at about frequencyHz, so the shake never repeats a pattern.
// Visual only: random is Math.random (never a gameplay stream); the gas mask does not stop it (the ground shakes), the
// house does (its intensity is 0). One record rewritten in place: { x, y } logical px and marginPx — the largest offset
// the current state can reach, for the scene's cover (stable during a jolt, so the cover does not pump).
import { clampUnit, finiteOr, pairValue } from "../../../engine/math/number_normalization.js";
const TWO_PI = Math.PI * 2;
const lerp = (from, to, share) => from + (to - from) * share;

export class EmissionCameraShake {
  #random;
  #time = 0;
  #nextJoltSec = null;
  #joltAge = Infinity;
  #joltSec = 0;
  #joltPx = 0;
  #peakShare = 0;
  #wanderPx = 0;
  #wanderTargetPx = 0;
  #wanderLeftSec = 0;
  #phases = [0, 0, 0, 0];
  #record = { x: 0, y: 0, marginPx: 0, amplitudePx: 0 };

  constructor({ random = Math.random } = {}) {
    if (typeof random !== "function") throw new TypeError("EmissionCameraShake requires random");
    this.#random = random;
    for (let index = 0; index < this.#phases.length; index += 1) this.#phases[index] = this.#random() * TWO_PI;
  }

  get record() {
    return this.#record;
  }

  // dtMs: real milliseconds since the last frame; intensity: the emission's intensity on the player, 0…1 (0 — none, in
  // the house); atPeak: the emission is in its peak phase; settings: CONFIG.emission.screen.shake.
  update(dtMs, intensity, atPeak, settings) {
    const record = this.#record;
    const level = settings?.enabled === true ? clampUnit(finiteOr(intensity, 0)) : 0;
    if (level <= 0) return this.#rest();
    const dt = Math.max(0, finiteOr(dtMs, 0)) / 1000;
    this.#time += dt;
    const irregularity = clampUnit(finiteOr(settings.irregularity, 0));
    // Jolts.
    if (this.#nextJoltSec === null) this.#nextJoltSec = this.#interval(level, settings, irregularity);
    this.#nextJoltSec -= dt;
    if (this.#nextJoltSec <= 0) {
      this.#joltAge = 0;
      this.#joltSec = Math.max(0.05, finiteOr(settings.joltSec, 0.45) * this.#spread(irregularity));
      this.#joltPx = this.#joltMaxPx(level, settings) * lerp(0.6, 1, this.#random());
      this.#nextJoltSec = this.#interval(level, settings, irregularity);
    } else this.#joltAge += dt;
    const joltShare = this.#joltAge < this.#joltSec ? Math.sin(Math.PI * this.#joltAge / this.#joltSec) : 0;
    // The peak's constant shake, its size wandering.
    const blendSec = Math.max(0.01, finiteOr(settings.peakBlendSec, 1.5));
    this.#peakShare = clampUnit(this.#peakShare + (atPeak === true ? dt : -dt) / blendSec);
    const peakLow = Math.max(0, pairValue(settings.peakPx, 0, 0));
    const peakHigh = Math.max(peakLow, pairValue(settings.peakPx, 1, peakLow));
    this.#wanderLeftSec -= dt;
    if (this.#wanderLeftSec <= 0) {
      this.#wanderLeftSec = Math.max(0.1, finiteOr(settings.wanderSec, 1.2) * this.#spread(irregularity));
      this.#wanderTargetPx = lerp(peakLow, peakHigh, this.#random());
    }
    const ease = 1 - Math.exp(-dt * 3 / Math.max(0.1, finiteOr(settings.wanderSec, 1.2)));
    this.#wanderPx += (this.#wanderTargetPx - this.#wanderPx) * ease;
    const peakPx = this.#peakShare * this.#wanderPx;
    const amplitude = Math.max(joltShare * this.#joltPx, peakPx);
    // Direction: unrelated sines, so the path never settles into a pattern.
    const omega = TWO_PI * Math.max(0.1, finiteOr(settings.frequencyHz, 14)) * this.#time;
    const phases = this.#phases;
    record.x = amplitude * (0.6 * Math.sin(omega + phases[0]) + 0.4 * Math.sin(omega * 1.73 + phases[1]));
    record.y = amplitude * (0.6 * Math.sin(omega * 1.13 + phases[2]) + 0.4 * Math.sin(omega * 2.11 + phases[3]));
    record.amplitudePx = amplitude;
    record.marginPx = Math.max(this.#joltMaxPx(level, settings), this.#peakShare * peakHigh);
    return record;
  }

  #joltMaxPx(level, settings) {
    return Math.max(0, lerp(pairValue(settings.joltPx, 0, 3), pairValue(settings.joltPx, 1, 8), level));
  }

  #interval(level, settings, irregularity) {
    const mean = lerp(pairValue(settings.joltIntervalSec, 0, 5.5), pairValue(settings.joltIntervalSec, 1, 1.2), level);
    return Math.max(0.05, mean * this.#spread(irregularity));
  }

  // 1 ± irregularity, one random draw (a method, not a per-frame closure: the update allocates nothing).
  #spread(irregularity) {
    return 1 + (this.#random() * 2 - 1) * irregularity;
  }

  #rest() {
    const record = this.#record;
    this.#time = 0;
    this.#nextJoltSec = null;
    this.#joltAge = Infinity;
    this.#peakShare = 0;
    this.#wanderPx = 0;
    this.#wanderLeftSec = 0;
    record.x = 0;
    record.y = 0;
    record.marginPx = 0;
    record.amplitudePx = 0;
    return record;
  }
}
