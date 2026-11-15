// Spec 179 stage E (TK-324, TK-324.1): the emission's darkening and blur on the screen, as numbers for the DOM veil.
// - Blur (TK-324.1, owner: «наче персонажа підглючує»): sharp, irregular pulses. Each pulse rises fast (attackSec) and
//   falls a little slower (decaySec, eased out); its height is random within pulseAmplitude; the next one comes after a
//   random share (± pulseJitter) of an interval that shortens from pulseIntervalSec[0] to [1] as the strength grows, so
//   the rhythm never repeats but quickens toward the peak. Between pulses a faint base (baseShare) stays. Everything
//   scales with the strength, so the blur grows as the emission goes on.
// - Darkening (TK-324.1, owner: «колихаєшся на хвилі»): from the edges inward. The clear middle narrows with the strength
//   (eased) and sways on a slow swell: the swell's period wanders between swayPeriodSec[0] and [1] (no fixed beat), and
//   it closes in deeper than it opens out (swayOutShare of the closing), so each closing reaches further than the
//   opening before it. The edges darken up to maxDarkness and breathe a little with the same swell.
// strength comes from EmissionExposure (intensity × (1 − protection)). random: () => 0…1 (visual only). One record
// rewritten in place; no allocation per frame.
const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const pairAt = (pair, index, fallback) => number(Array.isArray(pair) ? pair[index] : undefined, fallback);
const TWO_PI = Math.PI * 2;
// The swell's period drifts on a slower wave with this period (s), so consecutive swells differ in length.
const SWELL_DRIFT_SEC = 23;

export class EmissionScreenEffect {
  #random;
  #pulseAge = Infinity;
  #pulseHeight = 0;
  #nextPulseSec = 0;
  #swellPhase = 0;
  #driftPhase = 0;
  #record = { visible: false, includeHud: true, strength: 0, darkness: 0, clearRadius: 1, feather: 0.5, blurPx: 0 };

  constructor({ random = Math.random } = {}) {
    if (typeof random !== "function") throw new TypeError("EmissionScreenEffect requires random");
    this.#random = random;
  }

  get record() {
    return this.#record;
  }

  // dtMs: real milliseconds since the last frame; strength: 0…1; settings: CONFIG.emission.screen.
  update(dtMs, strength, settings) {
    const record = this.#record;
    const level = settings?.enabled !== false ? clamp01(number(strength, 0)) : 0;
    record.includeHud = settings?.includeHud !== false;
    record.strength = level;
    if (level <= 0) {
      this.#reset();
      record.visible = false;
      record.darkness = 0;
      record.blurPx = 0;
      record.clearRadius = 1;
      return record;
    }
    const dtSec = Math.min(0.25, Math.max(0, number(dtMs, 0)) / 1000);
    record.visible = true;
    this.#updateVignette(record, level, dtSec, settings?.vignette);
    record.blurPx = this.#updateBlur(level, dtSec, settings?.blur);
    return record;
  }

  #updateVignette(record, level, dtSec, vignette) {
    const eased = level * level * (3 - 2 * level);
    const start = clamp01(pairAt(vignette?.clearRadius, 0, 0.95));
    const end = clamp01(pairAt(vignette?.clearRadius, 1, 0.15));
    const slowSec = Math.max(0.5, pairAt(vignette?.swayPeriodSec, 0, 7));
    const fastSec = Math.max(0.5, pairAt(vignette?.swayPeriodSec, 1, 3.5));
    // The swell's period wanders between the two bounds on a slower drift, and shortens a little with the strength.
    this.#driftPhase = (this.#driftPhase + TWO_PI * dtSec / SWELL_DRIFT_SEC) % TWO_PI;
    const drift = 0.5 + 0.5 * Math.sin(this.#driftPhase);
    const periodSec = slowSec + (fastSec - slowSec) * clamp01(0.6 * drift + 0.4 * level);
    this.#swellPhase = (this.#swellPhase + TWO_PI * dtSec / periodSec) % TWO_PI;
    const wave = Math.sin(this.#swellPhase);
    // Closing in (wave > 0) goes the whole amplitude, opening out only swayOutShare of it.
    const amplitude = Math.max(0, number(vignette?.swayAmplitude, 0.06)) * eased;
    const outShare = clamp01(number(vignette?.swayOutShare, 0.55));
    const sway = wave >= 0 ? wave * amplitude : wave * amplitude * outShare;
    record.clearRadius = clamp01(start + (end - start) * eased - sway);
    record.feather = clamp01(number(vignette?.feather, 0.5));
    record.darkness = clamp01(clamp01(number(vignette?.maxDarkness, 0.85)) * eased * (1 + 0.12 * wave * eased));
  }

  #updateBlur(level, dtSec, blur) {
    const random = this.#random;
    const slowSec = Math.max(0.05, pairAt(blur?.pulseIntervalSec, 0, 2.4));
    const fastSec = Math.max(0.05, pairAt(blur?.pulseIntervalSec, 1, 0.35));
    const jitter = clamp01(number(blur?.pulseJitter, 0.6));
    const attack = Math.max(0.01, number(blur?.attackSec, 0.05));
    const decay = Math.max(0.01, number(blur?.decaySec, 0.22));
    this.#nextPulseSec -= dtSec;
    this.#pulseAge += dtSec;
    if (this.#nextPulseSec <= 0) {
      const minHeight = clamp01(pairAt(blur?.pulseAmplitude, 0, 0.35));
      const maxHeight = Math.max(minHeight, clamp01(pairAt(blur?.pulseAmplitude, 1, 1)));
      this.#pulseHeight = minHeight + (maxHeight - minHeight) * random();
      this.#pulseAge = 0;
      const interval = slowSec + (fastSec - slowSec) * level;
      this.#nextPulseSec = Math.max(attack + 0.02, interval * (1 + jitter * (2 * random() - 1)));
    }
    const age = this.#pulseAge;
    let shape = 0;
    if (age < attack) shape = age / attack;
    else if (age < attack + decay) {
      const rest = 1 - (age - attack) / decay;
      shape = rest * rest;
    }
    const base = clamp01(number(blur?.baseShare, 0.15));
    const peak = Math.max(0, number(blur?.maxPx, 6));
    return peak * level * (base + (1 - base) * shape * this.#pulseHeight);
  }

  #reset() {
    this.#pulseAge = Infinity;
    this.#pulseHeight = 0;
    this.#nextPulseSec = 0;
    this.#swellPhase = 0;
  }
}
