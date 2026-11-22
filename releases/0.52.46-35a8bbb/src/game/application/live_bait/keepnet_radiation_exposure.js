// Spec 179 D8 (TK-369): the keepnet's radiation dose, gathered with the game frame. The radiation is the location's, the
// same for every fish, so a frame only adds one number (seconds of full radiation); the dose reaches the save — one
// command of LiveBaitCommandService — when the closest fish would die or once a careTickMs while it gathers. Without
// radiation and with nothing gathered a frame does nothing. Only frames of play on the location call it (not the house).
export class KeepnetRadiationExposure {
  #liveBait;
  #config;
  #pendingSec = 0;
  #elapsedMs = 0;

  // liveBait: LiveBaitCommandService ({ radiationHeadroomSec(), applyRadiation(doseSec) }); config: CONFIG.liveBait.
  constructor({ liveBait, config }) {
    if (typeof liveBait?.applyRadiation !== "function" || typeof liveBait.radiationHeadroomSec !== "function")
      throw new TypeError("KeepnetRadiationExposure requires liveBait");
    if (!Number.isFinite(config?.careTickMs)) throw new TypeError("KeepnetRadiationExposure requires CONFIG.liveBait");
    this.#liveBait = liveBait;
    this.#config = config;
  }

  get pendingSec() { return this.#pendingSec; }

  // dtMs: the frame; radiation: the location's (0…1). True when the gathered dose was applied this frame.
  update(dtMs, radiation) {
    const r = Number.isFinite(radiation) ? Math.max(0, Math.min(1, radiation)) : 0;
    if (r <= 0 && this.#pendingSec === 0) return false;
    const dt = Math.max(0, Number(dtMs) || 0);
    this.#pendingSec += r * dt / 1000;
    this.#elapsedMs += dt;
    if (this.#elapsedMs < this.#config.careTickMs && this.#pendingSec < this.#liveBait.radiationHeadroomSec())
      return false;
    return this.flush();
  }

  // Applies what was gathered (also before the player leaves the location).
  flush() {
    const dose = this.#pendingSec;
    this.#pendingSec = 0;
    this.#elapsedMs = 0;
    if (!(dose > 0)) return false;
    this.#liveBait.applyRadiation(dose);
    return true;
  }
}
