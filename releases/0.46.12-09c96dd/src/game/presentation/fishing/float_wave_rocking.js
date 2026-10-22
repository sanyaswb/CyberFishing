const TWO_PI = Math.PI * 2;
const RAD_PER_DEG = Math.PI / 180;
// The water amplitude (art pixels) at which the rocking settings apply as written: the default of CONFIG.canvas.water.
const REFERENCE_AMPLITUDE = 20;

// The float rocking on the water (spec 128, simplified in v0.46.12): a few slow sines of time with unrelated
// frequencies, so the motion never looks mechanical. Its strength follows the water's wave amplitude (the default
// amplitude rocks at the configured sizes, a higher one more) and the surface size at the float (far water calmer).
// No link to the individual waves of the water picture.
//
//   standing: up and down (bobPx) and a little sideways (swayPx);
//   lying: up and down and a turn of the body (lyingTurnDeg); the caller turns it about the middle of its visible part.
//
// The lying share is the spec 127 lean over lyingAngleDeg, so the change between the two needs no state. A function of
// time and place only: the same at any frame rate. Visual only; allocation-free (one reused result).
export class FloatWaveRocking {
  #getSettings;
  #result = { dx: 0, dy: 0, turnRad: 0 };
  // For DEV: how many frames asked, the last state (off / still / active) and the last offsets.
  #status = { frames: 0, state: "off", dx: 0, dy: 0, turnDeg: 0, strength: 0, lying: 0 };

  // getSettings: () => CONFIG.canvas.water (read every frame, so DEV edits apply at once).
  constructor({ getSettings }) {
    if (typeof getSettings !== "function") throw new TypeError("FloatWaveRocking requires getSettings");
    this.#getSettings = getSettings;
  }

  get status() {
    return this.#status;
  }

  // nowMs: the frame's real clock; position: the float on the map; metric: the location's WaterMetric (optional);
  // pose: FloatPoseAnimator's pose; lyingAngleDeg: the lean of a lying float; biting: a bite step shows.
  // Returns { dx, dy } in logical pixels for the waterline point and turnRad for the body about its middle.
  compute({ nowMs, position, metric = null, pose, lyingAngleDeg, biting = false }) {
    const result = this.#result;
    const status = this.#status;
    result.dx = 0;
    result.dy = 0;
    result.turnRad = 0;
    status.frames += 1;
    status.state = "off";
    status.strength = 0;
    const water = this.#getSettings() || {};
    const rocking = water.floatRocking || {};
    if (rocking.enabled === true) {
      const surface = metric && Number.isFinite(position?.y) ? metric.surfaceScaleAt(position.y) : 1;
      status.strength = FloatWaveRocking.#positive(water.amplitude) / REFERENCE_AMPLITUDE * surface *
        (biting ? FloatWaveRocking.#share(rocking.biteShare) : 1);
      status.state = status.strength > 0 ? "active" : "still";
      if (status.strength > 0) this.#rock(rocking, status.strength, nowMs, pose, lyingAngleDeg, result);
    }
    status.dx = result.dx;
    status.dy = result.dy;
    status.turnDeg = result.turnRad / RAD_PER_DEG;
    return result;
  }

  #rock(rocking, strength, nowMs, pose, lyingAngleDeg, result) {
    const period = Math.max(0.2, Number(rocking.periodSec) || 2);
    // The frequencies are unrelated, so the phase is not wrapped (a wrap would jump); at epoch milliseconds it keeps
    // microradian precision.
    const phase = TWO_PI * (Number(nowMs) || 0) / 1000 / period;
    const lean = Math.hypot(Number(pose?.rollDeg) || 0, Number(pose?.pitchDeg) || 0);
    const lying = Math.min(1, lean / Math.max(1e-6, Math.abs(Number(lyingAngleDeg) || 90)));
    this.#status.lying = lying;
    const bob = 0.7 * Math.sin(phase) + 0.3 * Math.sin(1.7 * phase + 1.3);
    const sway = Math.sin(0.63 * phase + 2.1);
    const turn = 0.75 * Math.sin(0.81 * phase + 0.6) + 0.25 * Math.sin(1.9 * phase + 2.4);
    result.dy = FloatWaveRocking.#positive(rocking.bobPx) * strength * bob;
    result.dx = FloatWaveRocking.#positive(rocking.swayPx) * strength * sway * (1 - lying);
    result.turnRad = FloatWaveRocking.#positive(rocking.lyingTurnDeg) * RAD_PER_DEG * strength * turn * lying;
  }

  static #positive(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  static #share(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 1;
  }
}
