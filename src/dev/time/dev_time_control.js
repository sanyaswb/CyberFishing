// The calendar clock owns its transient rate; this DEV control owns activation and its view lifecycle.
// Each press steps the rate through RATE_STEPS and back to ×1; spec 187 D20 (owner): ×10 and ×20 after ×5.
const RATE_STEPS = Object.freeze([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 10, 20]);

export class DevTimeControl {
  #clock;
  #view;
  #isEnabled;
  #baseScale;
  #reserveWidth;
  #changePhase;
  #expanded = false;
  #disposed = false;
  #suspended = false;
  constructor({ clock, view, isEnabled, reserveWidth, baseScale = null, changePhase = null }) {
    this.#clock = clock;
    this.#view = view;
    this.#isEnabled = isEnabled;
    this.#baseScale = baseScale;
    this.#reserveWidth = reserveWidth;
    this.#changePhase = changePhase;
    this.update(clock.getHours());
  }
  get container() { return this.#view.container; }
  update(hours) {
    if (this.#disposed || this.#suspended) return;
    if (this.#baseScale) this.#clock.setTimeScale(this.#baseScale());
    const enabled = this.#isEnabled() === true;
    if (!enabled) this.#clock.setRateMultiplier(1);
    const multiplier = this.#clock.getRateMultiplier();
    const expanded = multiplier > 1;
    if (expanded !== this.#expanded) { this.#expanded = expanded; this.#reserveWidth?.(expanded); }
    this.#view.setControlState(enabled, multiplier);
    this.#view.update(hours);
  }
  advance() {
    if (this.#disposed || this.#suspended || this.#isEnabled() !== true) return;
    const current = this.#clock.getRateMultiplier();
    this.#clock.setRateMultiplier(RATE_STEPS.find((step) => step > current) ?? 1);
    this.update(this.#clock.getHours());
  }
  getSnapshot() {
    return { enabled: this.#isEnabled() === true, multiplier: this.#clock.getRateMultiplier(), timeScale: this.#baseScale?.() };
  }
  advancePhase() {
    if (this.#disposed || this.#suspended || this.#isEnabled() !== true) return;
    this.#changePhase?.();
    this.update(this.#clock.getHours());
  }
  suspend() {
    this.#view.cancelActivation?.();
    const snapshot = this.getSnapshot();
    if (this.#disposed || this.#suspended) return snapshot;
    if (snapshot.multiplier === 1) this.#clock.checkpoint();
    else this.#clock.setRateMultiplier(1);
    this.update(this.#clock.getHours());
    this.#suspended = true;
    return snapshot;
  }
  resume(snapshot) {
    if (this.#disposed) return;
    this.#suspended = false;
    this.#clock.sync();
    const multiplier = snapshot?.multiplier;
    this.#clock.setRateMultiplier(this.#isEnabled() === true && RATE_STEPS.includes(multiplier) ? multiplier : 1);
    this.update(this.#clock.getHours());
  }
  dispose() {
    if (this.#disposed) return;
    if (!this.#suspended) {
      if (this.#clock.getRateMultiplier() === 1) this.#clock.checkpoint();
      else this.#clock.setRateMultiplier(1);
    }
    this.#disposed = true;
    this.#reserveWidth?.(false);
    this.#view.dispose();
  }
}
