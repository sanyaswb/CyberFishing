// Spec 179 stage A: the location's emission and radiation.
// - Emission: idle → onset → peak → fade → idle. Each part lasts a random time from its range (real seconds); the pause
//   before the next emission is random too (firstDelaySec before the first one). The intensity (0…1) rises on the onset
//   slowly, then faster (t²), stays 1 on the peak and falls on the fade (smoothstep down), so nothing switches at once.
// - Radiation (0…1): base + (emissionPeak − base) × intensity; a DEV or script override replaces it until cleared.
// The rng is the emission's own stream (the weather's and the fish's numbers never change because of it). Settings are
// read live through getSettings() (MAP_DB.<id>.weather: its `emission` and `radiation` blocks); nothing is allocated per
// update; snapshot is one object rewritten in place.
const PHASES = Object.freeze(["idle", "onset", "peak", "fade"]);
const NEXT_PHASE = Object.freeze({ onset: "peak", peak: "fade", fade: "idle" });
const DEFAULT_RANGES = Object.freeze({
  firstDelaySec: Object.freeze([600, 1800]),
  intervalSec: Object.freeze([1800, 5400]),
  onsetSec: Object.freeze([40, 90]),
  peakSec: Object.freeze([90, 240]),
  fadeSec: Object.freeze([40, 90]),
});
const PHASE_RANGE = Object.freeze({ onset: "onsetSec", peak: "peakSec", fade: "fadeSec" });

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const pair = (value, fallback) => (Array.isArray(value) && value.length >= 2 &&
  Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) ? value : fallback);

export class EmissionModel {
  #rng;
  #getSettings;
  #phase = "idle";
  #phaseLeftSec = 0;
  #phaseDurationSec = 0;
  #started = false;
  #frozen = false;
  #radiationOverride = null;
  #snapshot = {
    phase: "idle",
    phaseLeftSec: 0,
    phaseDurationSec: 0,
    intensity: 0,
    radiation: 0,
    serial: 0,
    frozen: false,
    radiationForced: false,
  };

  // rng: { next(), range(min, max) } (the emission's own seeded stream); getSettings: () => MAP_DB.<id>.weather (or null:
  // no emission, radiation 0).
  constructor({ rng, getSettings }) {
    if (typeof rng?.next !== "function" || typeof rng?.range !== "function") {
      throw new TypeError("EmissionModel requires an rng");
    }
    if (typeof getSettings !== "function") throw new TypeError("EmissionModel requires getSettings");
    this.#rng = rng;
    this.#getSettings = getSettings;
    this.#sync(this.#getSettings() || null);
  }

  get snapshot() {
    return this.#snapshot;
  }

  // dtMs: real milliseconds since the last update.
  update(dtMs) {
    const settings = this.#getSettings() || null;
    const emission = settings?.emission;
    if (!this.#started) {
      this.#started = true;
      this.#enter("idle", emission, this.#range(emission, "firstDelaySec"));
    }
    if (!this.#frozen && (this.#phase !== "idle" || emission?.enabled !== false)) {
      this.#phaseLeftSec -= Math.max(0, finite(dtMs, 0)) / 1000;
      if (this.#phaseLeftSec <= 0) this.#advance(emission);
    }
    this.#sync(settings);
  }

  // Starts a part now (DEV, scripted emission): phase idle | onset | peak | fade; durationSec null rolls it from the
  // location's range. A forced idle waits the regular interval before the next emission.
  force(phase, { durationSec = null } = {}) {
    if (!PHASES.includes(phase)) return false;
    const emission = this.#getSettings()?.emission;
    this.#started = true;
    const duration = durationSec !== null && Number.isFinite(Number(durationSec)) ? Math.max(0, Number(durationSec)) : null;
    this.#enter(phase, emission, duration);
    this.#sync(this.#getSettings() || null);
    return true;
  }

  // Frozen: the current part never ends (the intensity stays where it is).
  setFrozen(frozen) {
    this.#frozen = frozen === true;
    this.#sync(this.#getSettings() || null);
  }

  // Radiation 0…1 held by hand (DEV, tests); null returns to base + emission.
  setRadiationOverride(radiation) {
    this.#radiationOverride = radiation === null || !Number.isFinite(Number(radiation))
      ? null : clamp01(Number(radiation));
    this.#sync(this.#getSettings() || null);
  }

  #advance(emission) {
    if (this.#phase === "idle") this.#enter("onset", emission, null);
    else this.#enter(NEXT_PHASE[this.#phase], emission, null);
  }

  #enter(phase, emission, durationSec) {
    if (phase === "onset" && this.#phase === "idle") this.#snapshot.serial += 1;
    this.#phase = phase;
    const duration = durationSec ?? this.#range(emission, phase === "idle" ? "intervalSec" : PHASE_RANGE[phase]);
    this.#phaseDurationSec = duration;
    this.#phaseLeftSec = duration;
  }

  #range(emission, key) {
    const range = pair(emission?.[key], DEFAULT_RANGES[key]);
    const min = Math.max(0, Number(range[0]));
    const max = Math.max(min, Number(range[1]));
    return max > min ? this.#rng.range(min, max) : min;
  }

  #intensity() {
    if (this.#phase === "idle") return 0;
    if (this.#phase === "peak") return 1;
    const progress = this.#phaseDurationSec > 0 ? clamp01(1 - this.#phaseLeftSec / this.#phaseDurationSec) : 1;
    if (this.#phase === "onset") return progress * progress;
    return 1 - progress * progress * (3 - 2 * progress);
  }

  #sync(settings) {
    const snapshot = this.#snapshot;
    const intensity = this.#intensity();
    const base = clamp01(finite(settings?.radiation?.base, 0));
    const peak = clamp01(finite(settings?.radiation?.emissionPeak, 1));
    snapshot.phase = this.#phase;
    snapshot.phaseLeftSec = Math.max(0, this.#phaseLeftSec);
    snapshot.phaseDurationSec = this.#phaseDurationSec;
    snapshot.intensity = intensity;
    snapshot.radiation = this.#radiationOverride ?? clamp01(base + (peak - base) * intensity);
    snapshot.frozen = this.#frozen;
    snapshot.radiationForced = this.#radiationOverride !== null;
  }
}
