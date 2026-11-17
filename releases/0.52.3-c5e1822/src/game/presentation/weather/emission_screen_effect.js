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
// TK-324.2: vignette.enabled and blur.enabled switch each part on its own (the veil hides when both are off).
// Spec 181 D2 (TK-342): strength is the emission's full intensity (EmissionExposure.intensity()); the player's statuses
// weaken the OUTPUT by three shares that stay (EmissionExposure.modifier): the darkness × vignette share (the clear middle
// opens toward the whole screen by the same share), the blur's px × blur share, the pulses' rate × blurRate share — so
// 0.5 shows exactly half of the effect at any phase and the pulses keep the emission's rhythm; two zero shares (the gas
// mask) hide the veil. random: () => 0…1 (visual only). One record rewritten in place; no allocation per frame.
import { clampUnit, finiteOr, pairValue } from "../../../engine/math/number_normalization.js";
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

  // dtMs: real milliseconds since the last frame; strength: 0…1; settings: CONFIG.emission.screen; vignetteShare,
  // blurShare, blurRateShare: 0…1, the shares of the output that stay (spec 181 D2).
  update(dtMs, strength, settings, vignetteShare = 1, blurShare = 1, blurRateShare = 1) {
    const record = this.#record;
    const vignetteKept = clampUnit(finiteOr(vignetteShare, 1));
    const blurKept = clampUnit(finiteOr(blurShare, 1));
    const shown = vignetteKept > 0 || blurKept > 0;
    const level = settings?.enabled !== false && shown ? clampUnit(finiteOr(strength, 0)) : 0;
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
    const dtSec = Math.min(0.25, Math.max(0, finiteOr(dtMs, 0)) / 1000);
    const vignetteOn = settings?.vignette?.enabled !== false && vignetteKept > 0;
    const blurOn = settings?.blur?.enabled !== false && blurKept > 0;
    record.visible = vignetteOn || blurOn;
    if (vignetteOn) {
      this.#updateVignette(record, level, dtSec, settings?.vignette);
      record.darkness *= vignetteKept;
      record.clearRadius = 1 - (1 - record.clearRadius) * vignetteKept;
    } else { record.darkness = 0; record.clearRadius = 1; }
    record.blurPx = blurOn ? this.#updateBlur(level, dtSec, settings?.blur, clampUnit(finiteOr(blurRateShare, 1))) * blurKept : 0;
    return record;
  }

  #updateVignette(record, level, dtSec, vignette) {
    const eased = level * level * (3 - 2 * level);
    const start = clampUnit(pairValue(vignette?.clearRadius, 0, 0.95));
    const end = clampUnit(pairValue(vignette?.clearRadius, 1, 0.15));
    const slowSec = Math.max(0.5, pairValue(vignette?.swayPeriodSec, 0, 7));
    const fastSec = Math.max(0.5, pairValue(vignette?.swayPeriodSec, 1, 3.5));
    // The swell's period wanders between the two bounds on a slower drift, and shortens a little with the strength.
    this.#driftPhase = (this.#driftPhase + TWO_PI * dtSec / SWELL_DRIFT_SEC) % TWO_PI;
    const drift = 0.5 + 0.5 * Math.sin(this.#driftPhase);
    const periodSec = slowSec + (fastSec - slowSec) * clampUnit(0.6 * drift + 0.4 * level);
    this.#swellPhase = (this.#swellPhase + TWO_PI * dtSec / periodSec) % TWO_PI;
    const wave = Math.sin(this.#swellPhase);
    // Closing in (wave > 0) goes the whole amplitude, opening out only swayOutShare of it.
    const amplitude = Math.max(0, finiteOr(vignette?.swayAmplitude, 0.06)) * eased;
    const outShare = clampUnit(finiteOr(vignette?.swayOutShare, 0.55));
    const sway = wave >= 0 ? wave * amplitude : wave * amplitude * outShare;
    record.clearRadius = clampUnit(start + (end - start) * eased - sway);
    record.feather = clampUnit(finiteOr(vignette?.feather, 0.5));
    record.darkness = clampUnit(clampUnit(finiteOr(vignette?.maxDarkness, 0.85)) * eased * (1 + 0.12 * wave * eased));
  }

  // Spec 180 D5: five knobs — strengthPx, pulsesPerSec [at the start, at the peak], irregularity (the gaps' spread and the
  // heights' range), sharpness (0: soft swells, 1: sharp twitches → attack 0.2 … 0.03 s, decay 0.8 … 0.15 s), floor.
  #updateBlur(level, dtSec, blur, rateShare) {
    const random = this.#random;
    const slowRate = Math.max(0.05, pairValue(blur?.pulsesPerSec, 0, 0.42));
    const fastRate = Math.max(0.05, pairValue(blur?.pulsesPerSec, 1, 2.85));
    const jitter = clampUnit(finiteOr(blur?.irregularity, 0.6));
    const sharpness = clampUnit(finiteOr(blur?.sharpness, 0.88));
    const attack = 0.2 + (0.03 - 0.2) * sharpness;
    const decay = 0.8 + (0.15 - 0.8) * sharpness;
    this.#nextPulseSec -= dtSec;
    this.#pulseAge += dtSec;
    // Spec 181 D2: the blurRate share slows the pulses; 0 — no new pulse (the floor stays; asked again in a moment).
    const rate = (slowRate + (fastRate - slowRate) * level) * rateShare;
    if (this.#nextPulseSec <= 0 && rate <= 0) this.#nextPulseSec = 0.25;
    else if (this.#nextPulseSec <= 0) {
      const minHeight = 1 - 0.65 * jitter;
      this.#pulseHeight = minHeight + (1 - minHeight) * random();
      this.#pulseAge = 0;
      this.#nextPulseSec = Math.max(attack + 0.02, (1 / rate) * (1 + jitter * (2 * random() - 1)));
    }
    const age = this.#pulseAge;
    let shape = 0;
    if (age < attack) shape = age / attack;
    else if (age < attack + decay) {
      const rest = 1 - (age - attack) / decay;
      shape = rest * rest;
    }
    const base = clampUnit(finiteOr(blur?.floor, 0.15));
    const peak = Math.max(0, finiteOr(blur?.strengthPx, 6));
    return peak * level * (base + (1 - base) * shape * this.#pulseHeight);
  }

  #reset() {
    this.#pulseAge = Infinity;
    this.#pulseHeight = 0;
    this.#nextPulseSec = 0;
    this.#swellPhase = 0;
  }
}
