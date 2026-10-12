export class GameTimeClock {
  #anchorHours;
  #anchorMs;
  #timeScale;
  #now;
  #save;
  #load;

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
    return (this.#anchorHours + elapsed * this.#timeScale / 3600000) % 24;
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
    if (!value || (value.anchorMs === this.#anchorMs && value.timeScale === this.#timeScale)) return;
    this.#anchorHours = value.anchorHours;
    this.#anchorMs = value.anchorMs;
    this.#timeScale = value.timeScale;
  }
}
