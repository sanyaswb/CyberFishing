// Spec 172 stage A: the location's weather as two independent processes with an intensity of 0…1 each.
// - Precipitation: clear → rain → storm (a storm only follows rain and returns to rain). Each state lasts a random time
//   from the location's range and has a random target intensity; the current intensities move toward their targets
//   linearly (fadeInSec for 0 → 1 while rising, fadeOutSec for 1 → 0 while falling), so rain never switches at once.
// - Fog: none ↔ fog, possible only in the configured time-of-day phases; leaving them ends the fog (it fades out).
// - Lightning: while the storm intensity is above zero, strikes come at an interval that shortens with the intensity;
//   each strike increments strikeSerial and sets its variant and distance (0 near … 1 far). Views only read the event.
// All times are real seconds (owner, spec 172 Q2). The rng is the weather's own stream (owner, Q1): weather never takes
// numbers from the fish. Settings are read live through getSettings() (DEV edits apply at the next state change or
// fade step); nothing is allocated per update. snapshot is one object rewritten in place.
const PRECIPITATION_STATES = Object.freeze(["clear", "rain", "storm"]);
const NEXT_STATES = Object.freeze({
  clear: Object.freeze(["clear", "rain"]),
  rain: Object.freeze(["clear", "rain", "storm"]),
  storm: Object.freeze(["rain"]),
});
const STRIKE_VARIANTS = 4;
const DEFAULT_CLEAR_SEC = Object.freeze([180, 900]);
const DEFAULT_FOG_IDLE_SEC = Object.freeze([120, 600]);

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const pair = (value, fallback) => (Array.isArray(value) && value.length >= 2 &&
  Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) ? value : fallback);

export class WeatherModel {
  #rng;
  #getSettings;
  #precipitation = "clear";
  #precipitationLeftSec = 0;
  #episode = 0;
  #rainTarget = 0;
  #stormTarget = 0;
  #fogState = "none";
  #fogLeftSec = 0;
  #fogTarget = 0;
  #fadeOverride = null;
  #strikeLeftSec = 0;
  #frozen = false;
  #snapshot = {
    precipitation: "clear",
    precipitationLeftSec: 0,
    episode: 0,
    fogState: "none",
    fogLeftSec: 0,
    rain: 0,
    storm: 0,
    fog: 0,
    cloud: 0,
    rainTarget: 0,
    stormTarget: 0,
    fogTarget: 0,
    strikeSerial: 0,
    strikeVariant: 0,
    strikeDistance: 0,
    frozen: false,
  };

  // rng: { next(), range(min, max), chance(p) } (the weather's own seeded stream); getSettings: () =>
  // MAP_DB.<id>.weather (or null: always clear, no fog).
  constructor({ rng, getSettings }) {
    if (typeof rng?.next !== "function" || typeof rng?.range !== "function" || typeof rng?.chance !== "function") {
      throw new TypeError("WeatherModel requires an rng");
    }
    if (typeof getSettings !== "function") throw new TypeError("WeatherModel requires getSettings");
    this.#rng = rng;
    this.#getSettings = getSettings;
  }

  get snapshot() {
    return this.#snapshot;
  }

  // dtMs: real milliseconds since the last update; phase: the current time-of-day phase (fog eligibility).
  update(dtMs, phase) {
    const dtSec = Math.max(0, finite(dtMs, 0)) / 1000;
    const settings = this.#getSettings() || null;
    if (!this.#frozen) {
      this.#precipitationLeftSec -= dtSec;
      if (this.#precipitationLeftSec <= 0) this.#nextPrecipitation(settings);
      this.#fogLeftSec -= dtSec;
      if (this.#fogLeftSec <= 0 || (this.#fogState === "fog" && !this.#fogAllowed(settings, phase))) {
        this.#nextFog(settings, phase);
      }
    }
    const precipitation = settings?.precipitation;
    const fog = settings?.fog;
    const snapshot = this.#snapshot;
    snapshot.rain = this.#approach(snapshot.rain, this.#rainTarget, precipitation, dtSec);
    snapshot.storm = this.#approach(snapshot.storm, this.#stormTarget, precipitation, dtSec);
    snapshot.fog = this.#approach(snapshot.fog, this.#fogTarget, fog, dtSec);
    this.#updateLightning(settings, dtSec);
    this.#sync();
  }

  // Sets a state now, for scripted weather and DEV. process: "precipitation" (state clear | rain | storm) or "fog"
  // (state none | fog); intensity 0…1 (null: rolled from the location's range); durationSec (null: rolled); fadeSec:
  // the time of this transition from the current intensity (null: the configured fades).
  force(process, state, { intensity = null, durationSec = null, fadeSec = null } = {}) {
    const settings = this.#getSettings() || null;
    if (process === "precipitation" && PRECIPITATION_STATES.includes(state)) {
      this.#enterPrecipitation(state, settings, intensity, durationSec);
    } else if (process === "fog" && (state === "none" || state === "fog")) {
      this.#enterFog(state, settings, intensity, durationSec);
    } else {
      return false;
    }
    this.#fadeOverride = Number.isFinite(Number(fadeSec)) && fadeSec !== null ? Math.max(0, Number(fadeSec)) : null;
    if (this.#fadeOverride === 0) {
      this.#snapshot.rain = this.#rainTarget;
      this.#snapshot.storm = this.#stormTarget;
      this.#snapshot.fog = this.#fogTarget;
      this.#fadeOverride = null;
    }
    this.#sync();
    return true;
  }

  // Changes a target intensity of the current state without restarting it (its timer runs on): kind "rain", "storm"
  // or "fog", intensity 0…1. The intensity moves there with the usual fades. For DEV's live sliders and scripts; a
  // storm keeps raining at least as hard as its own intensity.
  setIntensity(kind, intensity) {
    if (!Number.isFinite(Number(intensity))) return false;
    const level = clamp01(Number(intensity));
    if (kind === "rain") this.#rainTarget = this.#precipitation === "storm" ? Math.max(level, this.#stormTarget) : level;
    else if (kind === "storm") {
      this.#stormTarget = level;
      this.#rainTarget = Math.max(this.#rainTarget, level);
    } else if (kind === "fog") this.#fogTarget = level;
    else return false;
    this.#sync();
    return true;
  }

  // A lightning strike now (DEV), whatever the storm intensity.
  strike() {
    this.#emitStrike(this.#getSettings() || null);
    this.#sync();
  }

  // Frozen weather keeps its states (no timers run out); intensities still finish their fades.
  setFrozen(frozen) {
    this.#frozen = frozen === true;
    this.#sync();
  }

  #nextPrecipitation(settings) {
    const config = settings?.precipitation;
    const candidates = NEXT_STATES[this.#precipitation];
    let total = 0;
    for (let index = 0; index < candidates.length; index += 1) total += Math.max(0, finite(config?.[candidates[index]]?.weight, 0));
    let state = "clear";
    if (total > 0) {
      let roll = this.#rng.next() * total;
      for (let index = 0; index < candidates.length; index += 1) {
        roll -= Math.max(0, finite(config?.[candidates[index]]?.weight, 0));
        if (roll < 0) { state = candidates[index]; break; }
      }
    } else if (this.#precipitation === "storm") {
      state = "rain";
    }
    this.#enterPrecipitation(state, settings, null, null);
  }

  #enterPrecipitation(state, settings, intensity, durationSec) {
    const config = settings?.precipitation?.[state];
    this.#precipitation = state;
    this.#episode += 1;
    this.#precipitationLeftSec = durationSec !== null && Number.isFinite(Number(durationSec))
      ? Math.max(0, Number(durationSec))
      : this.#roll(pair(config?.durationSec, DEFAULT_CLEAR_SEC));
    const level = intensity !== null && Number.isFinite(Number(intensity))
      ? clamp01(Number(intensity))
      : state === "clear" ? 0 : clamp01(this.#roll(pair(config?.intensity, [0.5, 0.5])));
    if (state === "clear") {
      this.#rainTarget = 0;
      this.#stormTarget = 0;
    } else if (state === "rain") {
      this.#rainTarget = level;
      this.#stormTarget = 0;
    } else {
      // A storm rains at least as hard as its own intensity.
      this.#rainTarget = Math.max(this.#rainTarget, level);
      this.#stormTarget = level;
      if (this.#snapshot.storm <= 0) this.#strikeLeftSec = this.#strikeInterval(settings, level);
    }
    this.#fadeOverride = null;
  }

  #fogAllowed(settings, phase) {
    const phases = settings?.fog?.phases;
    return Array.isArray(phases) ? phases.includes(phase) : true;
  }

  #nextFog(settings, phase) {
    const config = settings?.fog;
    const chance = clamp01(finite(config?.chance, 0));
    const fog = this.#fogAllowed(settings, phase) && chance > 0 && this.#rng.chance(chance);
    this.#enterFog(fog ? "fog" : "none", settings, null, null);
  }

  #enterFog(state, settings, intensity, durationSec) {
    const config = settings?.fog;
    this.#fogState = state;
    this.#fogLeftSec = durationSec !== null && Number.isFinite(Number(durationSec))
      ? Math.max(0, Number(durationSec))
      : this.#roll(pair(state === "fog" ? config?.durationSec : config?.idleSec,
        state === "fog" ? [120, 600] : DEFAULT_FOG_IDLE_SEC));
    this.#fogTarget = state === "none" ? 0 : intensity !== null && Number.isFinite(Number(intensity))
      ? clamp01(Number(intensity)) : clamp01(this.#roll(pair(config?.intensity, [0.5, 0.5])));
    this.#fadeOverride = null;
  }

  // Moves value toward target: a full 0 → 1 rise takes fadeInSec, a full 1 → 0 fall fadeOutSec (a DEV/script fade
  // overrides both until the next state change).
  #approach(value, target, config, dtSec) {
    if (value === target) return value;
    const rising = target > value;
    const seconds = this.#fadeOverride ?? Math.max(0, finite(rising ? config?.fadeInSec : config?.fadeOutSec, 0));
    if (seconds <= 0) return target;
    const step = dtSec / seconds;
    return rising ? Math.min(target, value + step) : Math.max(target, value - step);
  }

  #updateLightning(settings, dtSec) {
    const storm = this.#snapshot.storm;
    if (storm <= 0) return;
    this.#strikeLeftSec -= dtSec;
    if (this.#strikeLeftSec > 0) return;
    this.#emitStrike(settings);
    this.#strikeLeftSec = this.#strikeInterval(settings, storm);
  }

  // intervalSec: [at storm 0, at storm 1]; each interval varies ±50% around that value.
  #strikeInterval(settings, storm) {
    const interval = pair(settings?.lightning?.intervalSec, [25, 6]);
    const base = Number(interval[0]) + (Number(interval[1]) - Number(interval[0])) * clamp01(storm);
    return Math.max(0.5, base * this.#rng.range(0.5, 1.5));
  }

  #emitStrike(settings) {
    const snapshot = this.#snapshot;
    snapshot.strikeSerial += 1;
    snapshot.strikeVariant = Math.min(STRIKE_VARIANTS - 1, Math.floor(this.#rng.next() * STRIKE_VARIANTS));
    snapshot.strikeDistance = clamp01(this.#roll(pair(settings?.lightning?.distance, [0.2, 1])));
  }

  #roll(range) {
    const min = Number(range[0]);
    const max = Number(range[1]);
    return max > min ? this.#rng.range(min, max) : min;
  }

  #sync() {
    const snapshot = this.#snapshot;
    snapshot.precipitation = this.#precipitation;
    snapshot.precipitationLeftSec = Math.max(0, this.#precipitationLeftSec);
    snapshot.episode = this.#episode;
    snapshot.fogState = this.#fogState;
    snapshot.fogLeftSec = Math.max(0, this.#fogLeftSec);
    snapshot.cloud = Math.max(snapshot.rain, snapshot.storm);
    snapshot.rainTarget = this.#rainTarget;
    snapshot.stormTarget = this.#stormTarget;
    snapshot.fogTarget = this.#fogTarget;
    snapshot.frozen = this.#frozen;
  }
}
