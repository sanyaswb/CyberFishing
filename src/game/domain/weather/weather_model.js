import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
import { WeatherEventProcess } from "./weather_event_process.js";

// Spec 180 stage A (TK-325): the location's weather as independent processes — rain, storm and fog — each with its own
// chance per check, its own timeline (duration, peak start, peak length, peak strength, rolled when it starts) and its
// own manual hold (WeatherEventProcess). Owner (2026-11-15): a storm does not always bring rain; while it lasts the
// rain's chance and strength rise (CONFIG.weather.storm.rainChanceMult / rainStrengthMult × the storm's strength), so a stormy wind
// without rain is possible. Lightning belongs to the storm: when a storm starts it rolls whether it has lightning and,
// if so, where on the storm's timeline the strikes begin and end; strikes come at random intervals, shorter as the
// storm grows (lightning.intervalSec [at strength 0, at 1] ± jitter).
// Fog (spec 180 D17, TK-336, owner 2026-11-16) lives in game time: its checks, timeline and cooldown run at the game
// clock's pace (the shown strength still eases in real seconds). Its chance is × the multiplier of the game-hour window
// it falls in (fog.hours: [{ fromHour, toHour, chanceMult }], ×1 outside) and × the rain's boost: every rain that ends
// adds fog.rainBoost.perRain (up to fog.rainBoost.max), and the boost goes back to ×1 when a fog starts.
// An emission holds a storm from outside (update's stormFloor, spec 179 D3); TK-399 (owner): not the rain — under the
// emission's storm the rain comes only by its own chance, raised by the storm as under any storm. initial (spec 180 D14): the weather a
// session starts with. All times are real seconds; the rng is the weather's own stream (spec 172 Q1). snapshot is one
// object rewritten in place: rain, storm, fog, cloud (0…1), strike*, the processes' own snapshots, and compatibility
// fields for the views (precipitation, fogState, frozen = any manual hold).
const STRIKE_VARIANTS = 4;
// Spec 187 D14: a frozen storm below this strength strikes no lightning.
const FROZEN_STRIKE_MIN = 1e-3;
const KINDS = Object.freeze(["rain", "storm", "fog"]);

const pair = (value, fallback) => (Array.isArray(value) && value.length >= 2 &&
  Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) ? value : fallback);

export class WeatherModel {
  #rng;
  #getSettings;
  #getGeneral;
  #processes;
  #started = false;
  #automatic = true;
  #stormSerial = 0;
  #lightning = { has: false, startSec: 0, endSec: 0, nextSec: 0 };
  // Spec 187 D14: seconds to the next strike of a frozen storm (null: none counting).
  #frozenStrikeInSec = null;
  #fogRainBoost = 1;
  #rainWasActive = false;
  #fogSerial = 0;
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
    // TK-327.1: the current storm's rolled lightning (DevTools shows what was generated).
    lightning: { has: false, startSec: 0, endSec: 0 },
    events: null,
    // TK-336: the fog's chance multipliers now — of the hour window and of the rains since the last fog.
    fogHourMult: 1,
    fogRainBoost: 1,
  };

  // rng: { next(), range(min, max), chance(p) } (the weather's own seeded stream); getSettings: () =>
  // MAP_DB.<id>.weather (or null: always clear); getGeneralSettings: () => CONFIG.weather (spec 180 D3: the storm's
  // multipliers, the same on every location) or null (no storm effect on the rain).
  constructor({ rng, getSettings, getGeneralSettings = () => null }) {
    if (typeof rng?.next !== "function" || typeof rng?.range !== "function" || typeof rng?.chance !== "function") {
      throw new TypeError("WeatherModel requires an rng");
    }
    if (typeof getSettings !== "function") throw new TypeError("WeatherModel requires getSettings");
    if (typeof getGeneralSettings !== "function") throw new TypeError("WeatherModel getGeneralSettings must be a function");
    this.#rng = rng;
    this.#getSettings = getSettings;
    this.#getGeneral = getGeneralSettings;
    this.#processes = Object.freeze(Object.fromEntries(KINDS.map((kind) => [kind,
      new WeatherEventProcess({ rng, getSettings: () => this.#getSettings()?.[kind] ?? null })])));
    this.#snapshot.events = Object.freeze(Object.fromEntries(KINDS.map((kind) => [kind, this.#processes[kind].snapshot])));
  }

  get snapshot() {
    return this.#snapshot;
  }

  // dtMs: real milliseconds; clock: { hour (game hours, 0…24), timeScale (game seconds per real second) } or null (real
  // time, no hour windows); stormFloor: the storm's strength 0…1 held from outside (an emission), 0 — none.
  update(dtMs, clock = null, stormFloor = 0) {
    const settings = this.#getSettings() || null;
    if (!this.#started) this.#startInitial(settings);
    const dtSec = Math.max(0, finiteOr(dtMs, 0)) / 1000;
    const storm = this.#processes.storm;
    storm.update(dtSec, true, 1, 1, finiteOr(stormFloor, 0));
    if (storm.snapshot.serial !== this.#stormSerial) {
      this.#stormSerial = storm.snapshot.serial;
      this.#rollLightning(settings?.storm?.lightning, storm);
    }
    const stormStrength = storm.snapshot.strength;
    const general = this.#getGeneral()?.storm;
    const rainChanceMult = 1 + (Math.max(1, finiteOr(general?.rainChanceMult, 1)) - 1) * stormStrength;
    const rainStrengthMult = 1 + (Math.max(1, finiteOr(general?.rainStrengthMult, 1)) - 1) * stormStrength;
    this.#processes.rain.update(dtSec, true, rainChanceMult, rainStrengthMult);
    this.#updateFog(settings?.fog, clock, dtSec);
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

  // TK-398: automatic weather on / off for every process — off: no checks, no initial weather; spec 187 D12: every
  // strength freezes where it is (WeatherEventProcess), a frozen storm strikes by its strength (D14). start() and hold()
  // still work.
  setAutomatic(on) {
    this.#automatic = on !== false;
    for (const kind of KINDS) this.#processes[kind].setAutomatic(this.#automatic);
    this.#sync();
  }

  get automatic() {
    return this.#automatic;
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
    if (!this.#automatic) return;
    for (const kind of KINDS) {
      const strength = clampUnit(finiteOr(settings?.initial?.[kind], 0));
      if (strength > 0) this.start(kind, { peakStrength: strength, atPeak: true });
    }
  }

  // TK-336: a rain that ended raises the fog's boost; a fog that started resets it.
  #updateFog(config, clock, dtSec) {
    const rainActive = this.#processes.rain.snapshot.active;
    if (this.#rainWasActive && !rainActive) {
      const boost = config?.rainBoost;
      this.#fogRainBoost = Math.min(Math.max(1, finiteOr(boost?.max, 1)), this.#fogRainBoost + Math.max(0, finiteOr(boost?.perRain, 0)));
    }
    this.#rainWasActive = rainActive;
    const hourMult = this.#hourMult(config?.hours, clock?.hour);
    const fog = this.#processes.fog;
    fog.update(dtSec, true, hourMult * this.#fogRainBoost, 1, 0, Math.max(0, finiteOr(clock?.timeScale, 1)));
    if (fog.snapshot.serial !== this.#fogSerial) {
      this.#fogSerial = fog.snapshot.serial;
      this.#fogRainBoost = 1;
    }
    this.#snapshot.fogHourMult = hourMult;
    this.#snapshot.fogRainBoost = this.#fogRainBoost;
  }

  // The chance multiplier of the window that holds the hour (the largest if windows overlap); ×1 outside them or without
  // an hour. A window with fromHour > toHour passes midnight.
  #hourMult(windows, hour) {
    if (!Array.isArray(windows) || !Number.isFinite(hour)) return 1;
    let mult = null;
    for (const window of windows) {
      const from = finiteOr(window?.fromHour, 0), to = finiteOr(window?.toHour, 0);
      const inside = from <= to ? hour >= from && hour < to : hour >= from || hour < to;
      if (inside) mult = Math.max(mult ?? 0, Math.max(0, finiteOr(window?.chanceMult, 1)));
    }
    return mult ?? 1;
  }

  // At a storm's start: lightning or not, and where on its timeline the strikes begin and end (shares of the duration).
  #rollLightning(config, storm) {
    const lightning = this.#lightning;
    const timeline = storm.timeline;
    lightning.has = this.#rng.chance(clampUnit(finiteOr(config?.chance, 1)));
    if (!lightning.has) return;
    const [startMin, startMax] = pair(config?.startShare, [0, 0.3]);
    const [endMin, endMax] = pair(config?.endShare, [0.6, 1]);
    lightning.startSec = timeline.durationSec * clampUnit(this.#roll(startMin, startMax));
    lightning.endSec = Math.max(lightning.startSec, timeline.durationSec * clampUnit(this.#roll(endMin, endMax)));
    lightning.nextSec = lightning.startSec;
  }

  #updateLightning(config, storm, dtSec) {
    if (!this.#automatic) {
      this.#updateFrozenLightning(config, storm, dtSec);
      return;
    }
    const lightning = this.#lightning;
    const elapsed = storm.snapshot.elapsedSec;
    const live = storm.snapshot.active && lightning.has && elapsed >= lightning.startSec && elapsed <= lightning.endSec;
    this.#snapshot.lightningActive = live;
    if (!live || elapsed < lightning.nextSec) return;
    this.#emitStrike(config);
    lightning.nextSec = elapsed + this.#strikeInterval(config, storm);
  }

  // Spec 187 D14 (owner: «шанси застивають на своїх коефіцієнтах і діють при поточному рівні»): without automatic
  // weather a storm has no timeline — while it is above zero the strikes come at the interval its strength gives.
  #updateFrozenLightning(config, storm, dtSec) {
    const live = storm.snapshot.strength > FROZEN_STRIKE_MIN;
    this.#snapshot.lightningActive = live;
    if (!live) {
      this.#frozenStrikeInSec = null;
      return;
    }
    if (this.#frozenStrikeInSec === null) this.#frozenStrikeInSec = this.#strikeInterval(config, storm);
    this.#frozenStrikeInSec -= dtSec;
    if (this.#frozenStrikeInSec > 0) return;
    this.#emitStrike(config);
    this.#frozenStrikeInSec = this.#strikeInterval(config, storm);
  }

  // The time to the next strike: intervalSec [slow, fast] by the storm's strength, ± jitter.
  #strikeInterval(config, storm) {
    const [slow, fast] = pair(config?.intervalSec, [25, 6]);
    const base = Number(slow) + (Number(fast) - Number(slow)) * storm.snapshot.strength;
    const jitter = clampUnit(finiteOr(config?.jitter, 0.5));
    return Math.max(0.5, base * (1 + jitter * (2 * this.#rng.next() - 1)));
  }

  #emitStrike(config) {
    const snapshot = this.#snapshot;
    snapshot.strikeSerial += 1;
    snapshot.strikeVariant = Math.min(STRIKE_VARIANTS - 1, Math.floor(this.#rng.next() * STRIKE_VARIANTS));
    const [near, far] = pair(config?.distance, [0.2, 1]);
    snapshot.strikeDistance = clampUnit(this.#roll(Number(near), Number(far)));
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
    snapshot.lightning.has = this.#lightning.has;
    snapshot.lightning.startSec = this.#lightning.startSec;
    snapshot.lightning.endSec = this.#lightning.endSec;
  }
}
