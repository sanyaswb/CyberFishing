// Spec 179 stage F (TK-340): the protection a used item gives the player for a while — the vodka's: the emission's
// screen effects are weaker by `protection` (0…1) for `durationSec` real seconds. Another bottle renews the time and
// keeps the stronger protection; protections never add up (owner Q8). The time is the page's monotonic clock, so a
// change of the system time changes nothing; the effect lives with the session (a reload ends it).
const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export class PlayerProtectionEffects {
  #now;
  #protection = 0;
  #untilMs = 0;

  // now: () => milliseconds of a monotonic clock (performance.now).
  constructor({ now }) {
    if (typeof now !== "function") throw new TypeError("PlayerProtectionEffects requires now");
    this.#now = now;
  }

  // A used item's effect ({ effect, protection, durationSec }); true when it took effect.
  apply(use) {
    if (use?.effect !== "emissionProtection") return false;
    const protection = clamp01(number(use.protection, 0));
    const durationSec = Math.max(0, number(use.durationSec, 0));
    if (protection <= 0 || durationSec <= 0) return false;
    const active = this.remainingSec() > 0;
    this.#protection = active ? Math.max(this.#protection, protection) : protection;
    this.#untilMs = this.#now() + durationSec * 1000;
    return true;
  }

  // 0…1 now (0 once the time is over).
  protection() {
    return this.remainingSec() > 0 ? this.#protection : 0;
  }

  remainingSec() {
    return Math.max(0, (this.#untilMs - this.#now()) / 1000);
  }

  // DEV: ends the effect now.
  clear() {
    this.#protection = 0;
    this.#untilMs = 0;
  }
}
