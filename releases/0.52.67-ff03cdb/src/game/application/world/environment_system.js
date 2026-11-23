import { timePhaseAt } from "../../domain/time/time_phase.js";
// Time of day, wind and weather of the location. Spec 172 stage A: the weather is an injected WeatherModel (intensities,
// fades, storm, lightning, its own rng stream); this system derives the fields the bite chances, the radio, the wind and
// the float read: isRaining / isFoggy from the intensity thresholds (MAP_DB.<id>.weather.thresholds) and wind.rainMult =
// 1 + rain × (environment.wind.rainMultiplier − 1), continuous with the rain's intensity. Without a weather model the
// weather stays clear. rng: the weather's stream (spec 172 Q1), also used by the wind.
// Spec 179 stage A: an injected EmissionModel gives the emission's part and intensity and the location's radiation
// (snapshot.emission, snapshot.radiation); while an emission runs the weather's storm is held at least at the
// emission's own strength (MAP_DB.<id>.weather.emission.storm.storm) × its intensity (spec 180: a floor, recomputed
// each frame, so it rises and falls with the emission). TK-399 (owner): the emission holds no rain — a storm may come
// without it. Without an emission model: no emission, radiation 0.
const DEFAULT_RAIN_THRESHOLD = 0.15;
const DEFAULT_FOG_THRESHOLD = 0.3;
const CLEAR_WEATHER = Object.freeze({
  precipitation: "clear", fogState: "none", rain: 0, storm: 0, fog: 0, cloud: 0, strikeSerial: 0, strikeVariant: 0,
  strikeDistance: 0, lightningActive: false, frozen: false, events: null,
});
// Spec 182 D2 (TK-351): without a starfall model — no starfall.
const NO_STARFALL = Object.freeze({ inWindow: false, active: false, strength: 0, planned: 0, held: false, nightSerial: 0,
  periodCount: 0, periodStartHours: Object.freeze([]), periodLevels: Object.freeze([]), windowHours: 0, positionHours: 0,
  bolideAtHours: null, bolideSerial: 0 });
const NO_EMISSION = Object.freeze({
  phase: "idle", phaseLeftSec: 0, phaseDurationSec: 0, intensity: 0, radiation: 0, serial: 0, frozen: false,
  radiationForced: false,
});

export class EnvironmentSystem {
  #config;
  #spawnConfig;
  #gameTimeHours;
  // TK-336: the game clock the weather reads (fog in game time and by hour), one object rewritten every frame.
  #weatherClock = { hour: 0, timeScale: 1 };
  #lastHour = -1;
  #currentPhase = "day";
  #weather;
  #wind;
  #emission;
  #starfall;
  #windState = { direction: 0, rainMult: 1.0, timer: 0 };
  // Spec 172 TK-271: a direction (−1 | 0 | 1) set by DEV or a script replaces the random one until cleared (null).
  #windOverride = null;
  #snapshot = {
    time: 0,
    phase: "day",
    isRaining: false,
    isFoggy: false,
    weather: CLEAR_WEATHER,
    emission: NO_EMISSION,
    radiation: 0,
    // Spec 182: the starfall's night (strength 0…1, the plan, the bolide's serial).
    starfall: NO_STARFALL,
    // TK-398: whether the weather runs by itself (false: only what is switched on by hand).
    automaticWeather: true,
    wind: {
      direction: 0,
      strength: 0,
      baseStrength: 0,
      gustStrength: 0,
      targetStrength: 0,
      state: "calm",
      isGusting: false,
      rainMult: 1.0,
      timer: 0,
      forced: false,
      forcedDirection: null,
      forcedStrength: null,
    },
  };
  #physicsEnv = {
    current: null,
    wind: null,
  };
  // TK-367: the water current's speed (px/s) held by hand (DevTools «Керування»), null: the location's own. The held
  // current is one record rewritten from the location's (its direction and other fields kept), never the config.
  #currentHold = null;
  #heldCurrent = {};
  #automatic = true;
  #physicsWind = {
    direction: 0,
    strength: 0,
    gustStrength: 0,
    rainMult: 1.0,
    float: null,
    breezeAngleRange: [0, 0],
    gustAngleRange: [0, 0],
    gustFluctuationMs: null,
    gustChancePerSec: 0,
    gustDurationMs: null,
  };
  #rng;
  #gameTimeClock;

  constructor(
    config,
    initialTime = 0,
    rng,
    spawnConfig = {},
    gameTimeClock = null,
    weather = null,
    wind = null,
    emission = null,
    starfall = null,
  ) {
    this.#config = config;
    this.#spawnConfig = spawnConfig;
    this.#rng = rng;
    this.#gameTimeClock = gameTimeClock;
    this.#weather = weather;
    this.#wind = wind;
    this.#emission = emission;
    this.#starfall = starfall;
    this.#gameTimeHours = initialTime;
    if (this.#spawnConfig?.timePhases) {
      this.#lastHour = Math.floor(initialTime);
      this.#updatePhase(this.#lastHour);
    }
    if (weather) this.#snapshot.weather = weather.snapshot;
    if (emission) this.#snapshot.emission = emission.snapshot;
    if (starfall) this.#snapshot.starfall = starfall.snapshot;
    this.#syncSnapshot();
  }

  // The weather model (DEV section, scripted weather), or null.
  // Holds the wind's direction: -1 (to the left), 0 (calm) or 1 (to the right); null returns to the random wind. The
  // physics and the views read it like the random one.
  setWindOverride(direction) {
    if (this.#wind) {
      this.#wind.setDirectionOverride(direction);
    } else {
      this.#windOverride = direction === -1 || direction === 0 || direction === 1 ? direction : null;
    }
    this.#syncSnapshot();
  }

  // Spec 178: holds the living wind strength in 0…1, or null for automatic weather/episodes.
  setWindStrengthOverride(strength) {
    this.#wind?.setStrengthOverride(strength);
    this.#syncSnapshot();
  }

  // TK-398: automatic weather on / off (DevTools «Керування» → «Автоматична погода»; on by default, not saved). This
  // system owns the switch and passes it to every model: off — no chances are rolled and nothing starts by itself
  // (rain, storm, fog, the emission, the starfall's night, the wind's episodes and gusts), the running events end; the
  // location's own current is still water and the sea has no calm swell of its own (snapshot.automaticWeather, read by
  // the sea state). What is switched on by hand runs as always, with its effect on the others.
  setAutomaticWeather(on) {
    const automatic = on !== false;
    this.#automatic = automatic;
    this.#weather?.setAutomatic(automatic);
    this.#wind?.setAutomatic(automatic);
    this.#emission?.setAutomatic(automatic);
    this.#starfall?.setAutomatic(automatic);
    if (!automatic) this.#windState.direction = 0;
    this.#snapshot.automaticWeather = automatic;
    this.#syncSnapshot();
  }

  get automaticWeather() {
    return this.#automatic;
  }

  // TK-367: holds the water current's speed (px/s, 0 — still water), or null for the location's own current.
  setCurrentSpeedOverride(speed) {
    this.#currentHold = speed === null || speed === undefined || !Number.isFinite(Number(speed))
      ? null : Math.max(0, Number(speed));
  }

  get currentSpeedOverride() {
    return this.#currentHold;
  }

  // The water current the tackle, the fish and the boats feel: base (a location's current or null) as it is, or a copy
  // with the held speed. Reused; each reader passes its own base (the boats read the live location, GameWorld).
  // TK-398: without automatic weather the location's own current is still (speed 0) unless held.
  resolveCurrent(base) {
    const speed = this.#currentHold ?? (this.#automatic ? null : 0);
    if (!base || speed === null) return base ?? null;
    const held = this.#heldCurrent;
    for (const key in base) held[key] = base[key];
    held.speedPxPerSec = speed;
    return held;
  }

  triggerWindGust(options) {
    const started = this.#wind ? this.#wind.triggerGust(options) : false;
    this.#syncSnapshot();
    return started;
  }

  get weather() {
    return this.#weather;
  }

  get wind() {
    return this.#wind;
  }

  // Spec 179: the emission model (DEV section, scripted emission), or null.
  get emission() {
    return this.#emission;
  }

  // Spec 182: the starfall's night (DEV section), or null.
  get starfall() {
    return this.#starfall;
  }

  // dt: real milliseconds of the frame.
  update(dt, timeScale) {
    this.#gameTimeClock?.setTimeScale(timeScale);
    this.#gameTimeHours = this.#gameTimeClock
      ? this.#gameTimeClock.getHours()
      : (this.#gameTimeHours + (dt / 3600000) * timeScale) % 24;
    const hour = Math.floor(this.#gameTimeHours);

    if (hour !== this.#lastHour) {
      this.#lastHour = hour;
      this.#updatePhase(hour);
    }
    this.#weatherClock.hour = this.#gameTimeHours;
    this.#weatherClock.timeScale = Math.max(0, Number(timeScale) || 1);
    this.#updateWeather(dt);
    // Spec 182 D2, Q3: no starfall while an emission runs (the night's timeline goes on).
    this.#starfall?.update(this.#weatherClock, this.#snapshot.emission.phase !== "idle");
    this.#syncSnapshot();
  }

  #syncSnapshot() {
    const weather = this.#snapshot.weather;
    const thresholds = this.#config?.weather?.thresholds;
    const rainThreshold = Number.isFinite(Number(thresholds?.rain)) ? Number(thresholds.rain) : DEFAULT_RAIN_THRESHOLD;
    const fogThreshold = Number.isFinite(Number(thresholds?.fog)) ? Number(thresholds.fog) : DEFAULT_FOG_THRESHOLD;
    const maxRainMult = Number(this.#config?.environment?.wind?.rainMultiplier);
    this.#windState.rainMult = weather.rain > 0 && maxRainMult > 1 ? 1 + weather.rain * (maxRainMult - 1) : 1.0;
    this.#snapshot.time = this.#gameTimeHours;
    this.#snapshot.phase = this.#currentPhase;
    this.#snapshot.isRaining = weather.rain > 0 && weather.rain >= rainThreshold;
    this.#snapshot.isFoggy = weather.fog > 0 && weather.fog >= fogThreshold;
    this.#snapshot.radiation = this.#snapshot.emission.radiation;
    const windSnap = this.#wind?.snapshot ?? null;
    const windOut = this.#snapshot.wind;
    if (windSnap) {
      windOut.direction = windSnap.direction;
      windOut.strength = windSnap.strength;
      windOut.baseStrength = windSnap.baseStrength;
      windOut.gustStrength = windSnap.gustStrength;
      windOut.targetStrength = windSnap.targetStrength;
      windOut.state = windSnap.state;
      windOut.isGusting = windSnap.isGusting;
      windOut.forced = windSnap.forcedDirection !== null;
      windOut.forcedDirection = windSnap.forcedDirection;
      windOut.forcedStrength = windSnap.forcedStrength;
      windOut.timer = windSnap.episodeLeftSec * 1000;
    } else {
      windOut.direction = this.#windDirection();
      windOut.strength = windOut.direction === 0 ? 0 : 1;
      windOut.baseStrength = windOut.strength;
      windOut.gustStrength = 0;
      windOut.targetStrength = windOut.strength;
      windOut.state = windOut.direction === 0 ? "calm" : "moderate";
      windOut.isGusting = false;
      windOut.forced = this.#windOverride !== null;
      windOut.forcedDirection = this.#windOverride;
      windOut.forcedStrength = null;
      windOut.timer = this.#windState.timer;
    }
    windOut.rainMult = this.#windState.rainMult;
  }

  #updatePhase(hour) {
    this.#currentPhase = timePhaseAt(hour, this.#spawnConfig.timePhases) ?? this.#currentPhase;
  }

  #updateWeather(dt) {
    this.#weather?.update(dt, this.#weatherClock, this.#updateEmission(dt));
    if (this.#wind) {
      this.#wind.update(dt, this.#snapshot.weather);
      return;
    }
    const environment = this.#config?.environment;
    if (!this.#automatic) return;
    this.#windState.timer -= dt;
    if (this.#windState.timer <= 0) {
      const wind = environment?.wind;
      if (!wind?.changesPerDay) return;

      const { changesPerDay } = wind;
      this.#windState.timer =
        86400000 /
        (changesPerDay[0] +
          this.#rng.range(0, changesPerDay[1] - changesPerDay[0]));
      this.#windState.direction = this.#rng.pick([-1, 0, 1]);
    }
  }

  // Spec 180: the emission's floor for the storm × its intensity; 0 outside an emission (TK-399: no rain floor).
  #updateEmission(dt) {
    if (!this.#emission) return 0;
    this.#emission.update(dt);
    const intensity = this.#emission.snapshot.intensity;
    if (!(intensity > 0)) return 0;
    const hold = this.#config?.weather?.emission?.storm;
    return Math.max(0, Math.min(1, Number(hold?.storm) || 0)) * intensity;
  }

  #windDirection() {
    return this.#wind ? this.#wind.snapshot.direction : this.#windOverride ?? this.#windState.direction;
  }

  getSnapshot() {
    return this.#snapshot;
  }

  getPhysicsEnv() {
    const base = this.#config.environment;
    const env = this.#physicsEnv;
    env.current = this.resolveCurrent(base?.current ?? null);
    env.wind = null;

    const windSnap = this.#wind?.snapshot ?? null;
    const direction = windSnap ? windSnap.direction : this.#windDirection();
    if (direction !== 0 && (windSnap ? windSnap.strength > 0 : Boolean(base?.wind))) {
      const m = this.#windState.rainMult;
      const wind = this.#physicsWind;
      wind.direction = direction;
      wind.strength = windSnap ? windSnap.strength : 1;
      wind.gustStrength = windSnap ? windSnap.gustStrength : 0;
      wind.rainMult = m;
      wind.float = windSnap?.float ?? this.#config?.weather?.wind?.float ?? null;
      if (!windSnap && base?.wind) {
        wind.breezeAngleRange[0] = base.wind.breezeAngleRange[0] * m;
        wind.breezeAngleRange[1] = base.wind.breezeAngleRange[1] * m;
        wind.gustAngleRange[0] = base.wind.gustAngleRange[0] * m;
        wind.gustAngleRange[1] = base.wind.gustAngleRange[1] * m;
        wind.gustFluctuationMs = base.wind.gustFluctuationMs;
        wind.gustChancePerSec = base.wind.gustChancePerSec * m;
        wind.gustDurationMs = base.wind.gustDurationMs;
      }
      env.wind = wind;
    }
    return env;
  }
}
