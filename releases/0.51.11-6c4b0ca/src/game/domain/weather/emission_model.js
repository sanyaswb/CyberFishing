// Spec 179 stage A: the location's emission and radiation.
// - Emission: idle → onset → peak → fade → idle. An emission starts by chance, like a bite (owner, TK-321.1): while idle
//   the model rolls once every checkIntervalSec (real seconds); nothing holds the moment of the next emission, so it
//   cannot be computed ahead. The chance of a roll is chancePerCheck + chanceGrowthPerCheck × (failed rolls since the
//   last emission), so the waits gather around the balance target instead of spreading like a flat chance (growth 0
//   gives the flat chance). No rolls during cooldownSec after the session's start and after each emission.
//   Each part lasts a random time from its range; the intensity (0…1) rises on the onset slowly, then faster (t²),
//   stays 1 on the peak and falls on the fade (smoothstep down), so nothing switches at once.
// - Radiation (0…1): base + (emissionPeak − base) × intensity; a DEV or script override replaces it until cleared.
// The rng is the emission's own stream (the weather's and the fish's numbers never change because of it). Settings are
// read live through getSettings() (MAP_DB.<id>.weather: its `emission` and `radiation` blocks); nothing is allocated per
// update; snapshot is one object rewritten in place.
const PHASES = Object.freeze(["idle", "onset", "peak", "fade"]);
const NEXT_PHASE = Object.freeze({ onset: "peak", peak: "fade", fade: "idle" });
const DEFAULT_RANGES = Object.freeze({
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
  #canStart;
  #phase = "idle";
  #phaseLeftSec = 0;
  #phaseDurationSec = 0;
  #cooldownLeftSec = null;
  #checkLeftSec = 0;
  #failedChecks = 0;
  #frozen = false;
  #radiationOverride = null;
  #snapshot = {
    phase: "idle",
    phaseLeftSec: 0,
    phaseDurationSec: 0,
    intensity: 0,
    radiation: 0,
    serial: 0,
    chance: 0,
    failedChecks: 0,
    cooldownLeftSec: 0,
    frozen: false,
    radiationForced: false,
  };

  // rng: { next(), range(min, max) } (the emission's own seeded stream); getSettings: () => MAP_DB.<id>.weather (or null:
  // no emission, radiation 0); canStart: () => boolean, whether an emission may begin now (spec 179 D4: its background
  // has loaded); while false the rolls wait (none is counted as failed).
  constructor({ rng, getSettings, canStart = () => true }) {
    if (typeof rng?.next !== "function" || typeof rng?.range !== "function") {
      throw new TypeError("EmissionModel requires an rng");
    }
    if (typeof getSettings !== "function") throw new TypeError("EmissionModel requires getSettings");
    if (typeof canStart !== "function") throw new TypeError("EmissionModel canStart must be a function");
    this.#rng = rng;
    this.#getSettings = getSettings;
    this.#canStart = canStart;
    this.#sync(this.#getSettings() || null);
  }

  get snapshot() {
    return this.#snapshot;
  }

  // dtMs: real milliseconds since the last update.
  update(dtMs) {
    const settings = this.#getSettings() || null;
    const emission = settings?.emission;
    const dtSec = Math.max(0, finite(dtMs, 0)) / 1000;
    if (this.#cooldownLeftSec === null) this.#startIdle(emission);
    if (!this.#frozen) {
      if (this.#phase === "idle") this.#updateIdle(emission, dtSec);
      else {
        this.#phaseLeftSec -= dtSec;
        if (this.#phaseLeftSec <= 0) this.#enter(NEXT_PHASE[this.#phase], emission, null);
      }
    }
    this.#sync(settings);
  }

  // Starts a part now (DEV, scripted emission): phase idle | onset | peak | fade; durationSec null rolls it from the
  // location's range. A forced idle starts the cooldown and the rolls anew.
  force(phase, { durationSec = null } = {}) {
    if (!PHASES.includes(phase)) return false;
    const emission = this.#getSettings()?.emission;
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

  // The rolls run only past the cooldown, one per checkIntervalSec of idle time; a disabled emission never rolls.
  #updateIdle(emission, dtSec) {
    if (emission?.enabled === false) return;
    let left = dtSec;
    if (this.#cooldownLeftSec > 0) {
      const spent = Math.min(left, this.#cooldownLeftSec);
      this.#cooldownLeftSec -= spent;
      left -= spent;
    }
    if (this.#cooldownLeftSec > 0 || left <= 0) return;
    this.#checkLeftSec -= left;
    if (this.#checkLeftSec > 0) return;
    this.#checkLeftSec = Math.max(1, finite(emission?.checkIntervalSec, 60));
    if (!this.#canStart()) return;
    if (this.#rng.next() < this.#chance(emission)) this.#enter("onset", emission, null);
    else this.#failedChecks += 1;
  }

  #chance(emission) {
    return clamp01(Math.max(0, finite(emission?.chancePerCheck, 0)) +
      Math.max(0, finite(emission?.chanceGrowthPerCheck, 0)) * this.#failedChecks);
  }

  #startIdle(emission) {
    this.#cooldownLeftSec = Math.max(0, finite(emission?.cooldownSec, 0));
    this.#checkLeftSec = Math.max(1, finite(emission?.checkIntervalSec, 60));
    this.#failedChecks = 0;
  }

  #enter(phase, emission, durationSec) {
    if (phase === "onset" && this.#phase === "idle") this.#snapshot.serial += 1;
    this.#phase = phase;
    if (phase === "idle") {
      this.#startIdle(emission);
      this.#phaseDurationSec = 0;
      this.#phaseLeftSec = 0;
      return;
    }
    const duration = durationSec ?? this.#range(emission, PHASE_RANGE[phase]);
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
    snapshot.chance = this.#phase === "idle" ? this.#chance(settings?.emission) : 0;
    snapshot.failedChecks = this.#failedChecks;
    snapshot.cooldownLeftSec = Math.max(0, this.#cooldownLeftSec ?? 0);
    snapshot.frozen = this.#frozen;
    snapshot.radiationForced = this.#radiationOverride !== null;
  }
}
