const MS_PER_HOUR = 3600000;

export class GameTimeClock {
  #anchorHours;
  #anchorMs;
  #anchorGameMs;
  #timeScale;
  #now;
  #save;
  #load;
  #rateMultiplier = 1;

  // anchorGameMs: monotonic game milliseconds at the anchor (spec 152). Saves made before it existed start the count
  // at the anchor's hour of day.
  constructor({ anchorHours, anchorMs, anchorGameMs = anchorHours * MS_PER_HOUR, timeScale, now, save = null,
    load = null }) {
    this.#anchorHours = anchorHours;
    this.#anchorMs = anchorMs;
    this.#anchorGameMs = anchorGameMs;
    this.#timeScale = timeScale;
    this.#now = now;
    this.#save = save;
    this.#load = load;
  }

  getHours() {
    return (this.#anchorHours + this.#elapsedGameMs() / MS_PER_HOUR) % 24;
  }

  // Monotonic game time (spec 152): never goes back; the rate, the DEV acceleration and DEV phase jumps all count.
  getGameMs() {
    return this.#anchorGameMs + this.#elapsedGameMs();
  }

  // Real milliseconds until the displayed game minute changes (spec 081), at the current scale and rate.
  msUntilNextMinute() {
    const minutes = this.getHours() * 60;
    const remainingMinutes = Math.floor(minutes) + 1 - minutes;
    return remainingMinutes * 60000 / (this.#timeScale * this.#rateMultiplier);
  }

  getRateMultiplier() { return this.#rateMultiplier; }

  // A phase jump always moves forward: the hours up to the new hour of day are elapsed game time (spec 152 D1).
  setHours(hours) {
    if (!Number.isFinite(hours) || hours < 0 || hours >= 24) return false;
    const forwardHours = (((hours - this.getHours()) % 24) + 24) % 24;
    this.#anchorGameMs = this.getGameMs() + forwardHours * MS_PER_HOUR;
    this.#anchorHours = hours;
    this.#anchorMs = this.#now();
    this.#persist();
    return true;
  }

  setRateMultiplier(multiplier) {
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier === this.#rateMultiplier) return;
    this.checkpoint();
    this.#rateMultiplier = multiplier;
  }

  checkpoint() {
    this.#reanchor();
    // Transient rate changes persist reached hours, never the extra rate itself.
    this.#persist();
  }

  setTimeScale(timeScale) {
    if (!Number.isFinite(timeScale) || timeScale <= 0 || timeScale === this.#timeScale) return;
    this.#reanchor();
    this.#timeScale = timeScale;
    this.#persist();
  }

  sync() {
    const value = this.#load?.();
    if (!value || (value.anchorMs === this.#anchorMs && value.anchorHours === this.#anchorHours && value.timeScale === this.#timeScale)) return;
    this.#anchorHours = value.anchorHours;
    this.#anchorMs = value.anchorMs;
    this.#anchorGameMs = value.anchorGameMs ?? value.anchorHours * MS_PER_HOUR;
    this.#timeScale = value.timeScale;
  }

  #elapsedGameMs() {
    return Math.max(0, this.#now() - this.#anchorMs) * this.#timeScale * this.#rateMultiplier;
  }

  #reanchor() {
    this.#anchorGameMs = this.getGameMs();
    this.#anchorHours = this.getHours();
    this.#anchorMs = this.#now();
  }

  #persist() {
    this.#save?.({ anchorHours: this.#anchorHours, anchorMs: this.#anchorMs, anchorGameMs: this.#anchorGameMs,
      timeScale: this.#timeScale });
  }
}
