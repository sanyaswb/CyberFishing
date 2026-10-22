const TWO_PI = Math.PI * 2;
const RAD_PER_DEG = Math.PI / 180;
// The water amplitude (art pixels) at which the rocking sizes apply as written: the default of CONFIG.canvas.water.
const REFERENCE_AMPLITUDE = 20;
// The default waves' crest frequency (speed / wavelength) at which periodSec applies as written.
const REFERENCE_WAVE_RATE = 40 / 200;
// The float's wind tilt per unit of windShare, and the heavy ballast's share of the body under water.
const REFERENCE_WIND_DEG = 30;
const HEAVY_REST_DRAFT = 0.3;
const WEATHER_TIME_CONSTANT_SEC = 0.6;
const MAX_STEP_SEC = 0.1;

// The float rocking on the water (spec 128): slow sines with unrelated frequencies, so the motion never looks
// mechanical and is not tied to individual waves of the water picture.
//
//   standing: up and down (bobPx) and a little sideways (swayPx);
//   lying: up and down and a turn of the body (lyingTurnDeg); the caller turns it about the middle of its visible part.
//
// Strength: the water's wave amplitude, the surface size at the float (far water calmer), a bite step, and (stage 2)
// the landing after a cast, the weather (the float's wind tilt and the rain), the ballast (a heavier float rocks less).
// Tempo: periodSec, faster with faster or shorter waves, slower with heavy ballast. The phase is integrated, so a tempo
// change never jumps; landing and weather change smoothly. Visual only; allocation-free.
export class FloatWaveRocking {
  #getSettings;
  #result = { dx: 0, dy: 0, turnRad: 0 };
  #phase = 0;
  #lastNowMs = NaN;
  #castSerial = null;
  #landedAtMs = 0;
  #weather = 1;
  #weatherReady = false;
  // For DEV: frames asked, the last state (off / still / active), offsets and multipliers.
  #status = { frames: 0, state: "off", dx: 0, dy: 0, turnDeg: 0, strength: 0, lying: 0,
    landing: 1, weather: 1, ballast: 1, tempo: 1 };

  // getSettings: () => CONFIG.canvas.water (read every frame, so DEV edits apply at once).
  constructor({ getSettings }) {
    if (typeof getSettings !== "function") throw new TypeError("FloatWaveRocking requires getSettings");
    this.#getSettings = getSettings;
  }

  get status() {
    return this.#status;
  }

  // nowMs: the frame's real clock; position: the float on the map; metric: the location's WaterMetric (optional);
  // pose: FloatPoseAnimator's pose; lyingAngleDeg: the lean of a lying float; signals: FloatEntity.getPoseSignals()
  // (castSerial, isBiteTilt, windDeg, restDraft); rainMult: the weather's rain multiplier (1 when dry).
  // Returns { dx, dy } in logical pixels for the waterline point and turnRad for the body about its middle.
  compute({ nowMs, position, metric = null, pose, lyingAngleDeg, signals = null, rainMult = 1 }) {
    const result = this.#result;
    const status = this.#status;
    const now = Number(nowMs) || 0;
    const dt = Number.isFinite(this.#lastNowMs) ? Math.max(0, Math.min(MAX_STEP_SEC, (now - this.#lastNowMs) / 1000)) : 0;
    this.#lastNowMs = now;
    result.dx = 0;
    result.dy = 0;
    result.turnRad = 0;
    status.frames += 1;
    status.state = "off";
    status.strength = 0;
    const water = this.#getSettings() || {};
    const rocking = water.floatRocking || {};
    if (rocking.enabled === true) {
      const draft = Math.max(0, Math.min(1, (Number(signals?.restDraft) || 0) / HEAVY_REST_DRAFT));
      const landing = this.#landing(rocking, signals, now);
      const weather = this.#followWeather(rocking, signals, rainMult, dt);
      const ballast = Math.max(0, 1 - FloatWaveRocking.#share(rocking.ballastCalm, 0) * draft);
      const surface = metric && Number.isFinite(position?.y) ? metric.surfaceScaleAt(position.y) : 1;
      const bite = signals?.isBiteTilt === true ? FloatWaveRocking.#share(rocking.biteShare, 1) : 1;
      const tempo = FloatWaveRocking.#waveTempo(water, rocking) / (1 + FloatWaveRocking.#positive(rocking.ballastSlow) * draft);
      const period = Math.max(0.2, Number(rocking.periodSec) || 2);
      // Every frequency below is a multiple of 0.01, so 100 turns is a common period: the wrap never jumps.
      this.#phase = (this.#phase + TWO_PI * dt * tempo / period) % (TWO_PI * 100);
      const strength = FloatWaveRocking.#positive(water.amplitude) / REFERENCE_AMPLITUDE * surface * bite * landing *
        weather * ballast;
      status.landing = landing;
      status.weather = weather;
      status.ballast = ballast;
      status.tempo = tempo;
      status.strength = strength;
      status.state = strength > 0 ? "active" : "still";
      if (strength > 0) this.#rock(rocking, strength, pose, lyingAngleDeg, result);
    }
    status.dx = result.dx;
    status.dy = result.dy;
    status.turnDeg = result.turnRad / RAD_PER_DEG;
    return result;
  }

  // Right after a cast the float rocks landingBoost times as much and settles quadratically over landingSettleSec.
  #landing(rocking, signals, now) {
    const serial = signals?.castSerial ?? null;
    if (serial !== this.#castSerial) {
      this.#castSerial = serial;
      this.#landedAtMs = now;
    }
    const boost = Math.max(1, Number(rocking.landingBoost) || 1);
    const settleMs = FloatWaveRocking.#positive(rocking.landingSettleSec) * 1000;
    if (serial === null || boost === 1 || !(settleMs > 0)) return 1;
    const left = 1 - Math.min(1, Math.max(0, now - this.#landedAtMs) / settleMs);
    return 1 + (boost - 1) * left * left;
  }

  // The float's wind tilt (gusts, already reduced by its wind compensation) and the rain raise the rocking; the factor
  // follows its target with a time constant, so a gust swells instead of jumping.
  #followWeather(rocking, signals, rainMult, dt) {
    const wind = Math.abs(Number(signals?.windDeg) || 0) / REFERENCE_WIND_DEG;
    const rain = Math.max(0, (Number(rainMult) || 1) - 1);
    const target = 1 + FloatWaveRocking.#positive(rocking.windShare) * wind + FloatWaveRocking.#positive(rocking.rainShare) * rain;
    if (this.#weatherReady) this.#weather += (target - this.#weather) * (1 - Math.exp(-dt / WEATHER_TIME_CONSTANT_SEC));
    else this.#weather = target;
    this.#weatherReady = true;
    return this.#weather;
  }

  #rock(rocking, strength, pose, lyingAngleDeg, result) {
    const phase = this.#phase;
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

  // The waves' crest frequency (speed / wavelength) against the default's, mixed in by waveTempoShare.
  static #waveTempo(water, rocking) {
    const rate = FloatWaveRocking.#positive(water.speed) / Math.max(1, Number(water.wavelength) || 1);
    const share = FloatWaveRocking.#positive(rocking.waveTempoShare);
    return Math.max(0.25, Math.min(4, 1 + share * (rate / REFERENCE_WAVE_RATE - 1)));
  }

  static #positive(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  static #share(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
  }
}
