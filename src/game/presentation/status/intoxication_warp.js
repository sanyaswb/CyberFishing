// TK-374.3 (owner): from four bottles the drunk world waves — «постійний ефект як у хвиль (без перспективи) з довгими
// хвилями і високим розкидом (щоб хвилі не були однакові і не рухались симетрично) постійний ефект послаблюється до
// майже без хвиль, а от 5 рівень постійний ефект 4 рівня і трішки посилюється». The owner chose a CSS warp (no filter):
// the scene's frame is skewed and unevenly stretched (SceneCanvasMotion), the compositor moves it, nothing is redrawn.
// - Four channels (skew x, skew y, stretch x, stretch y), each two sines of their own long periods (periodSec, drawn
//   once per channel) and phases: unrelated, so the waves never repeat a shape and never move in step.
// - The strength wanders: a new target between minShare (almost no waves) and 1 every wanderSec (random within it),
//   eased toward it; times strength by the bottles (a list: 0 up to three bottles, 1 at four, a little more at five).
// Visual only: random is Math.random. One record rewritten in place: { skewX, skewY (degrees), stretchX, stretchY }.
import { clampUnit, finiteOr, listValue, pairBetween, pairValue } from "../../../engine/math/number_normalization.js";
const TWO_PI = Math.PI * 2;
const CHANNELS = 4;
const lerp = (from, to, share) => from + (to - from) * share;

export class IntoxicationWarp {
  #random;
  #time = 0;
  // Per channel: two periods' shares (0…1 within periodSec) and two phases.
  #periodShares = new Float64Array(CHANNELS * 2);
  #phases = new Float64Array(CHANNELS * 2);
  #stagePower = 0;
  #envelope = 0;
  #target = 0;
  #wanderLeft = 0;
  #wanderSec = 1;
  #record = { skewX: 0, skewY: 0, stretchX: 0, stretchY: 0 };

  constructor({ random }) {
    if (typeof random !== "function") throw new TypeError("IntoxicationWarp requires random");
    this.#random = random;
    for (let index = 0; index < CHANNELS * 2; index++) {
      this.#periodShares[index] = this.#random();
      this.#phases[index] = this.#random() * TWO_PI;
    }
  }

  get record() {
    return this.#record;
  }

  // dt: seconds; stage: the bottles drunk, 1…; fade: the intoxication's level 0…1; settings: CONFIG.canvas.intoxication.warp.
  update(dt, stage, fade, settings) {
    const record = this.#record;
    const index = Math.max(0, Math.floor(finiteOr(stage, 1)) - 1);
    const power = settings?.enabled === true ? Math.max(0, listValue(settings.strength, index, 0)) : 0;
    const ease = 1 - Math.exp(-dt * 3 / Math.max(0.05, finiteOr(settings?.stageBlendSec, 2)));
    this.#stagePower += (power - this.#stagePower) * ease;
    if (this.#stagePower < 1e-4 && power === 0) return this.reset();
    this.#time += dt;
    this.#wander(dt, settings);
    const amount = this.#stagePower * this.#envelope * clampUnit(finiteOr(fade, 0));
    const low = Math.max(0.5, pairValue(settings.periodSec, 0, 5));
    const high = Math.max(low, pairValue(settings.periodSec, 1, 13));
    const skew = Math.max(0, finiteOr(settings.skewDeg, 1.5)) * amount;
    const stretch = Math.max(0, finiteOr(settings.stretch, 0.03)) * amount;
    record.skewX = skew * this.#channel(0, low, high);
    record.skewY = skew * 0.6 * this.#channel(1, low, high);
    // A stretch only grows an axis (0…1): the frame never shrinks inside its cover.
    record.stretchX = stretch * (this.#channel(2, low, high) + 1) / 2;
    record.stretchY = stretch * (this.#channel(3, low, high) + 1) / 2;
    return record;
  }

  // −1…1: two sines of this channel's own periods.
  #channel(channel, low, high) {
    const first = channel * 2;
    const a = TWO_PI * this.#time / lerp(low, high, this.#periodShares[first]) + this.#phases[first];
    const b = TWO_PI * this.#time / lerp(low, high, this.#periodShares[first + 1]) + this.#phases[first + 1];
    return 0.6 * Math.sin(a) + 0.4 * Math.sin(b * 1.37);
  }

  #wander(dt, settings) {
    this.#wanderLeft -= dt;
    if (this.#wanderLeft <= 0) {
      this.#wanderSec = Math.max(0.2, pairBetween(settings.wanderSec, 3, 8, this.#random()));
      this.#wanderLeft = this.#wanderSec;
      this.#target = lerp(clampUnit(finiteOr(settings.minShare, 0.05)), 1, this.#random());
    }
    this.#envelope += (this.#target - this.#envelope) * (1 - Math.exp(-dt * 3 / this.#wanderSec));
  }

  // Sober (or switched off): no waves.
  reset() {
    const record = this.#record;
    this.#stagePower = 0;
    this.#envelope = 0;
    this.#wanderLeft = 0;
    record.skewX = 0;
    record.skewY = 0;
    record.stretchX = 0;
    record.stretchY = 0;
    return record;
  }
}
