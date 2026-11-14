// Spec 179 stage E (TK-324): the emission's darkening and blur on the screen, as numbers for the DOM veil.
// - Darkening starts at the edges and closes in: the clear middle's radius shrinks from clearRadius[0] to
//   clearRadius[1] (shares of the screen's half-diagonal) as the strength grows (eased: slow at first), and the edges
//   darken up to maxDarkness.
// - Blur pulses, not linearly: blurPx = maxBlurPx × strength × (base + (1 − base) × pulse), where the pulse is a raised
//   cosine whose frequency speeds up with the strength from pulseHz[0] to pulseHz[1] (the phase is integrated, so a
//   change of speed never jumps).
// strength comes from EmissionExposure (intensity × (1 − protection)). One record rewritten in place; no allocation.
const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const TWO_PI = Math.PI * 2;

export class EmissionScreenEffect {
  #phase = 0;
  #record = { visible: false, includeHud: true, strength: 0, darkness: 0, clearRadius: 1, feather: 0.3, blurPx: 0 };

  get record() {
    return this.#record;
  }

  // dtMs: real milliseconds since the last frame; strength: 0…1; settings: CONFIG.emission.screen.
  update(dtMs, strength, settings) {
    const record = this.#record;
    const enabled = settings?.enabled !== false;
    const level = enabled ? clamp01(number(strength, 0)) : 0;
    record.includeHud = settings?.includeHud !== false;
    record.strength = level;
    if (level <= 0) {
      this.#phase = 0;
      record.visible = false;
      record.darkness = 0;
      record.blurPx = 0;
      record.clearRadius = 1;
      return record;
    }
    const dtSec = Math.max(0, number(dtMs, 0)) / 1000;
    const slowHz = Math.max(0, number(settings?.pulseHz?.[0], 0.25));
    const fastHz = Math.max(slowHz, number(settings?.pulseHz?.[1], 1.4));
    this.#phase = (this.#phase + TWO_PI * (slowHz + (fastHz - slowHz) * level * level) * dtSec) % (TWO_PI * 1000);
    const pulse = 0.5 - 0.5 * Math.cos(this.#phase);
    const base = clamp01(number(settings?.pulseBase, 0.35));
    const eased = level * level * (3 - 2 * level);
    const startRadius = clamp01(number(settings?.clearRadius?.[0], 0.95));
    const endRadius = clamp01(number(settings?.clearRadius?.[1], 0.15));
    record.visible = true;
    record.clearRadius = startRadius + (endRadius - startRadius) * eased;
    record.feather = clamp01(number(settings?.feather, 0.35));
    record.darkness = clamp01(number(settings?.maxDarkness, 0.85)) * eased;
    record.blurPx = Math.max(0, number(settings?.maxBlurPx, 6)) * level * (base + (1 - base) * pulse);
    return record;
  }
}
