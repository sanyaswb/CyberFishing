export class GameTimeClock {
  #anchorHours;
  #anchorMs;
  #timeScale;
  #now;
  #save;
  #load;
  #rateMultiplier = 1;

  constructor({ anchorHours, anchorMs, timeScale, now, save = null, load = null }) {
    this.#anchorHours = anchorHours;
    this.#anchorMs = anchorMs;
    this.#timeScale = timeScale;
    this.#now = now;
    this.#save = save;
    this.#load = load;
  }

  getHours() {
    const elapsed = Math.max(0, this.#now() - this.#anchorMs);
    return (this.#anchorHours + elapsed * this.#timeScale * this.#rateMultiplier / 3600000) % 24;
  }

  // Real milliseconds until the displayed game minute changes (spec 081), at the current scale and rate.
  msUntilNextMinute() {
    const minutes = this.getHours() * 60;
    const remainingMinutes = Math.floor(minutes) + 1 - minutes;
    return remainingMinutes * 60000 / (this.#timeScale * this.#rateMultiplier);
  }

  getRateMultiplier() { return this.#rateMultiplier; }

  setHours(hours) {
    if (!Number.isFinite(hours) || hours < 0 || hours >= 24) return false;
    this.#anchorHours = hours;
    this.#anchorMs = this.#now();
    this.#save?.({ anchorHours: hours, anchorMs: this.#anchorMs, timeScale: this.#timeScale });
    return true;
  }

  setRateMultiplier(multiplier) {
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier === this.#rateMultiplier) return;
    this.checkpoint();
    this.#rateMultiplier = multiplier;
  }

  checkpoint() {
    this.#anchorHours = this.getHours();
    this.#anchorMs = this.#now();
    // Transient rate changes persist reached hours, never the extra rate itself.
    this.#save?.({ anchorHours: this.#anchorHours, anchorMs: this.#anchorMs, timeScale: this.#timeScale });
  }

  setTimeScale(timeScale) {
    if (!Number.isFinite(timeScale) || timeScale <= 0 || timeScale === this.#timeScale) return;
    const hours = this.getHours();
    this.#anchorHours = hours;
    this.#anchorMs = this.#now();
    this.#timeScale = timeScale;
    this.#save?.({ anchorHours: hours, anchorMs: this.#anchorMs, timeScale });
  }

  sync() {
    const value = this.#load?.();
    if (!value || (value.anchorMs === this.#anchorMs && value.anchorHours === this.#anchorHours && value.timeScale === this.#timeScale)) return;
    this.#anchorHours = value.anchorHours;
    this.#anchorMs = value.anchorMs;
    this.#timeScale = value.timeScale;
  }
}
