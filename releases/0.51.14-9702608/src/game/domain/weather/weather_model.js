import { WeatherEventProcess } from "./weather_event_process.js";

// Spec 180 stage A (TK-325): the location's weather as independent processes — rain, storm and fog — each with its own
// chance per check, its own timeline (duration, peak start, peak length, peak strength, rolled when it starts) and its
// own manual hold (WeatherEventProcess). Owner (2026-11-15): a storm does not always bring rain; while it lasts the
// rain's chance and strength rise (storm.rainChanceMult / rainStrengthMult × the storm's strength), so a stormy wind
// without rain is possible. Lightning belongs to the storm: when a storm starts it rolls whether it has lightning and,
// if so, where on the storm's timeline the strikes begin and end; strikes come at random intervals, shorter as the
// storm grows (lightning.intervalSec [at strength 0, at 1] ± jitter). Fog runs only in its time-of-day phases.
// An emission holds a storm and rain from outside (update's floors, spec 179 D3). initial (spec 180 D14): the weather a
// session starts with. All times are real seconds; the rng is the weather's own stream (spec 172 Q1). snapshot is one
// object rewritten in place: rain, storm, fog, cloud (0…1), strike*, the processes' own snapshots, and compatibility
// fields for the views (precipitation, fogState, frozen = any manual hold).
const STRIKE_VARIANTS = 4;
const KINDS = Object.freeze(["rain", "storm", "fog"]);

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const pair = (value, fallback) => (Array.isArray(value) && value.length >= 2 &&
  Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) ? value : fallback);

export class WeatherModel {
  #rng;
  #getSettings;
  #processes;
  #started = false;
  #stormSerial = 0;
  #lightning = { has: false, startSec: 0, endSec: 0, nextSec: 0 };
  #snapshot = {
    rain: 0,
    storm: 0,
    fog: 0,
    cloud: 0,
    precipitation: "clear",
    fogState: "none",
    frozen: false,
    strikeSerial: 0,
    strikeVariant: 0,
    strikeDistance: 0,
    lightningActive: false,
    events: null,
  };

  // rng: { next(), range(min, max), chance(p) } (the weather's own seeded stream); getSettings: () =>
  // MAP_DB.<id>.weather (or null: always clear).
  constructor({ rng, getSettings }) {
    if (typeof rng?.next !== "function" || typeof rng?.range !== "function" || typeof rng?.chance !== "function") {
      throw new TypeError("WeatherModel requires an rng");
    }
    if (typeof getSettings !== "function") throw new TypeError("WeatherModel requires getSettings");
    this.#rng = rng;
    this.#getSettings = getSettings;
    this.#processes = Object.freeze(Object.fromEntries(KINDS.map((kind) => [kind,
      new WeatherEventProcess({ rng, getSettings: () => this.#getSettings()?.[kind] ?? null })])));
    this.#snapshot.events = Object.freeze(Object.fromEntries(KINDS.map((kind) => [kind, this.#processes[kind].snapshot])));
  }

  get snapshot() {
    return this.#snapshot;
  }

  // dtMs: real milliseconds; phase: the time-of-day phase (fog's phases); floors: { storm, rain } 0…1 held from
  // outside (an emission), or null.
  update(dtMs, phase, floors = null) {
    const settings = this.#getSettings() || null;
    if (!this.#started) this.#startInitial(settings);
    const dtSec = Math.max(0, finite(dtMs, 0)) / 1000;
    const storm = this.#processes.storm;
    storm.update(dtSec, true, 1, 1, finite(floors?.storm, 0));
    if (storm.snapshot.serial !== this.#stormSerial) {
      this.#stormSerial = storm.snapshot.serial;
      this.#rollLightning(settings?.storm?.lightning, storm);
    }
    const stormStrength = storm.snapshot.strength;
    const rainChanceMult = 1 + (Math.max(1, finite(settings?.storm?.rainChanceMult, 1)) - 1) * stormStrength;
    const rainStrengthMult = 1 + (Math.max(1, finite(settings?.storm?.rainStrengthMult, 1)) - 1) * stormStrength;
    this.#processes.rain.update(dtSec, true, rainChanceMult, rainStrengthMult, finite(floors?.rain, 0));
    this.#processes.fog.update(dtSec, this.#fogAllowed(settings, phase));
    this.#updateLightning(settings?.storm?.lightning, storm, dtSec);
    this.#sync();
  }

  // kind: "rain" | "storm" | "fog"; strength 0…1 pins that process only, null releases it (spec 180 D1).
  hold(kind, strength, options = {}) {
    if (!KINDS.includes(kind)) return false;
    this.#processes[kind].hold(strength, options);
    this.#sync();
    return true;
  }

  // Starts / ends an event of one kind now (DEV, scripts); start options: { peakStrength, atPeak }.
  start(kind, options = {}) {
    if (!KINDS.includes(kind)) return false;
    this.#processes[kind].start(options);
    if (kind === "storm") {
      this.#stormSerial = this.#processes.storm.snapshot.serial;
      this.#rollLightning(this.#getSettings()?.storm?.lightning, this.#processes.storm);
    }
    this.#sync();
    return true;
  }

  stop(kind) {
    if (!KINDS.includes(kind)) return false;
    this.#processes[kind].stop();
    this.#sync();
    return true;
  }

  // Every process back to its own course.
  releaseAll() {
    for (const kind of KINDS) this.#processes[kind].hold(null);
    this.#sync();
  }

  // A lightning strike now (DEV), whatever the storm.
  strike() {
    this.#emitStrike(this.#getSettings()?.storm?.lightning);
    this.#sync();
  }

  // D14: the session starts with the location's initial weather: { rain, storm, fog } 0…1, an event of that kind at
  // its peak with that strength (0 or absent: none).
  #startInitial(settings) {
    this.#started = true;
    for (const kind of KINDS) {
      const strength = clamp01(finite(settings?.initial?.[kind], 0));
      if (strength > 0) this.start(kind, { peakStrength: strength, atPeak: true });
    }
  }

  #fogAllowed(settings, phase) {
    const phases = settings?.fog?.phases;
    return Array.isArray(phases) ? phases.includes(phase) : true;
  }

  // At a storm's start: lightning or not, and where on its timeline the strikes begin and end (shares of the duration).
  #rollLightning(config, storm) {
    const lightning = this.#lightning;
    const timeline = storm.timeline;
    lightning.has = this.#rng.chance(clamp01(finite(config?.chance, 1)));
    if (!lightning.has) return;
    const [startMin, startMax] = pair(config?.startShare, [0, 0.3]);
    const [endMin, endMax] = pair(config?.endShare, [0.6, 1]);
    lightning.startSec = timeline.durationSec * clamp01(this.#roll(startMin, startMax));
    lightning.endSec = Math.max(lightning.startSec, timeline.durationSec * clamp01(this.#roll(endMin, endMax)));
    lightning.nextSec = lightning.startSec;
  }

  #updateLightning(config, storm, dtSec) {
    const lightning = this.#lightning;
    const elapsed = storm.snapshot.elapsedSec;
    const live = storm.snapshot.active && lightning.has && elapsed >= lightning.startSec && elapsed <= lightning.endSec;
    this.#snapshot.lightningActive = live;
    if (!live || elapsed < lightning.nextSec) return;
    this.#emitStrike(config);
    const [slow, fast] = pair(config?.intervalSec, [25, 6]);
    const base = Number(slow) + (Number(fast) - Number(slow)) * storm.snapshot.strength;
    const jitter = clamp01(finite(config?.jitter, 0.5));
    lightning.nextSec = elapsed + Math.max(0.5, base * (1 + jitter * (2 * this.#rng.next() - 1)));
    void dtSec;
  }

  #emitStrike(config) {
    const snapshot = this.#snapshot;
    snapshot.strikeSerial += 1;
    snapshot.strikeVariant = Math.min(STRIKE_VARIANTS - 1, Math.floor(this.#rng.next() * STRIKE_VARIANTS));
    const [near, far] = pair(config?.distance, [0.2, 1]);
    snapshot.strikeDistance = clamp01(this.#roll(Number(near), Number(far)));
  }

  #roll(min, max) {
    const low = Number(min);
    const high = Number(max);
    return high > low ? this.#rng.range(low, high) : low;
  }

  #sync() {
    const snapshot = this.#snapshot;
    const rain = this.#processes.rain.snapshot;
    const storm = this.#processes.storm.snapshot;
    const fog = this.#processes.fog.snapshot;
    snapshot.rain = rain.strength;
    snapshot.storm = storm.strength;
    snapshot.fog = fog.strength;
    snapshot.cloud = Math.max(snapshot.rain, snapshot.storm);
    snapshot.precipitation = snapshot.storm > 0 ? "storm" : snapshot.rain > 0 ? "rain" : "clear";
    snapshot.fogState = snapshot.fog > 0 ? "fog" : "none";
    snapshot.frozen = rain.held || storm.held || fog.held;
  }
}
