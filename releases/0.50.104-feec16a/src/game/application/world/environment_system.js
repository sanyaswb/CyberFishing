// Time of day, wind and weather of the location. Spec 172 stage A: the weather is an injected WeatherModel (intensities,
// fades, storm, lightning, its own rng stream); this system derives the fields the bite chances, the radio, the wind and
// the float read: isRaining / isFoggy from the intensity thresholds (MAP_DB.<id>.weather.thresholds) and wind.rainMult =
// 1 + rain × (environment.wind.rainMultiplier − 1), continuous with the rain's intensity. Without a weather model the
// weather stays clear. rng: the weather's stream (spec 172 Q1), also used by the wind.
const DEFAULT_RAIN_THRESHOLD = 0.15;
const DEFAULT_FOG_THRESHOLD = 0.3;
const CLEAR_WEATHER = Object.freeze({
  precipitation: "clear", precipitationLeftSec: 0, episode: 0, fogState: "none", fogLeftSec: 0, rain: 0, storm: 0, fog: 0, cloud: 0,
  rainTarget: 0, stormTarget: 0, fogTarget: 0, strikeSerial: 0, strikeVariant: 0, strikeDistance: 0, frozen: false,
});

export class EnvironmentSystem {
  #config;
  #spawnConfig;
  #gameTimeHours;
  #lastHour = -1;
  #currentPhase = "day";
  #weather;
  #windState = { direction: 0, rainMult: 1.0, timer: 0 };
  // Spec 172 TK-271: a direction (−1 | 0 | 1) set by DEV or a script replaces the random one until cleared (null).
  #windOverride = null;
  #snapshot = {
    time: 0,
    phase: "day",
    isRaining: false,
    isFoggy: false,
    weather: CLEAR_WEATHER,
    wind: { direction: 0, rainMult: 1.0, timer: 0, forced: false },
  };
  #physicsEnv = {
    current: null,
    wind: null,
  };
  #physicsWind = {
    direction: 0,
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
  ) {
    this.#config = config;
    this.#spawnConfig = spawnConfig;
    this.#rng = rng;
    this.#gameTimeClock = gameTimeClock;
    this.#weather = weather;
    this.#gameTimeHours = initialTime;
    if (this.#spawnConfig?.timePhases) {
      this.#lastHour = Math.floor(initialTime);
      this.#updatePhase(this.#lastHour);
    }
    if (weather) this.#snapshot.weather = weather.snapshot;
    this.#syncSnapshot();
  }

  // The weather model (DEV section, scripted weather), or null.
  // Holds the wind's direction: -1 (to the left), 0 (calm) or 1 (to the right); null returns to the random wind. The
  // physics and the views read it like the random one.
  setWindOverride(direction) {
    this.#windOverride = direction === -1 || direction === 0 || direction === 1 ? direction : null;
    this.#syncSnapshot();
  }

  get weather() {
    return this.#weather;
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
    this.#updateWeather(dt);
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
    this.#snapshot.wind.direction = this.#windDirection();
    this.#snapshot.wind.forced = this.#windOverride !== null;
    this.#snapshot.wind.rainMult = this.#windState.rainMult;
    this.#snapshot.wind.timer = this.#windState.timer;
  }

  #updatePhase(hour) {
    const phases = this.#spawnConfig.timePhases;
    for (const [phase, times] of Object.entries(phases)) {
      const inRange =
        times.startHour < times.endHour
          ? hour >= times.startHour && hour < times.endHour
          : hour >= times.startHour || hour < times.endHour;
      if (inRange) this.#currentPhase = phase;
    }
  }

  #updateWeather(dt) {
    this.#weather?.update(dt, this.#currentPhase);
    const environment = this.#config?.environment;
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

  #windDirection() {
    return this.#windOverride ?? this.#windState.direction;
  }

  getSnapshot() {
    return this.#snapshot;
  }

  getPhysicsEnv() {
    const base = this.#config.environment;
    const env = this.#physicsEnv;
    env.current = base.current;
    env.wind = null;

    const direction = this.#windDirection();
    if (base.wind && direction !== 0) {
      const m = this.#windState.rainMult;
      const wind = this.#physicsWind;
      wind.direction = direction;
      wind.breezeAngleRange[0] = base.wind.breezeAngleRange[0] * m;
      wind.breezeAngleRange[1] = base.wind.breezeAngleRange[1] * m;
      wind.gustAngleRange[0] = base.wind.gustAngleRange[0] * m;
      wind.gustAngleRange[1] = base.wind.gustAngleRange[1] * m;
      wind.gustFluctuationMs = base.wind.gustFluctuationMs;
      wind.gustChancePerSec = base.wind.gustChancePerSec * m;
      wind.gustDurationMs = base.wind.gustDurationMs;
      env.wind = wind;
    }
    return env;
  }
}
