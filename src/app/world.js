class LocationManager {
  #locationsConfig;
  #currentId;

  constructor(locationsConfig, initialId = null) {
    this.#locationsConfig = locationsConfig;
    this.#currentId =
      initialId ||
      locationsConfig.currentLocationId ||
      Object.keys(locationsConfig.map || {})[0];
  }

  get id() {
    return this.#currentId;
  }

  get config() {
    return this.#locationsConfig.map[this.#currentId];
  }

  get currentEnvironment() {
    return this.config?.environment || null;
  }

  get chumCastDistance() {
    return this.config?.chumCastDistance || 300;
  }
}

class EnvironmentSystem {
  #config;
  #spawnConfig;
  #gameTimeHours;
  #lastHour = -1;
  #currentPhase = "day";
  #isRaining = false;
  #isFoggy = false;
  #weatherTimer = 0;
  #windState = { direction: 0, rainMult: 1.0, timer: 0 };
  #snapshot = {
    time: 0,
    phase: "day",
    isRaining: false,
    isFoggy: false,
    wind: { direction: 0, rainMult: 1.0, timer: 0 },
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

  constructor(
    config,
    initialTime = 12,
    rng = new SeededRng(),
    spawnConfig = {},
  ) {
    this.#config = config;
    this.#spawnConfig = spawnConfig;
    this.#rng = rng;
    this.#gameTimeHours = initialTime;
    this.#syncSnapshot();
  }

  update(dt, timeScale) {
    this.#gameTimeHours =
      (this.#gameTimeHours + (dt / 3600000) * timeScale) % 24;
    const hour = Math.floor(this.#gameTimeHours);

    if (hour !== this.#lastHour) {
      this.#lastHour = hour;
      this.#updatePhase(hour);
    }
    this.#updateWeather(dt);
    this.#syncSnapshot();
  }

  #syncSnapshot() {
    this.#snapshot.time = this.#gameTimeHours;
    this.#snapshot.phase = this.#currentPhase;
    this.#snapshot.isRaining = this.#isRaining;
    this.#snapshot.isFoggy = this.#isFoggy;
    this.#snapshot.wind.direction = this.#windState.direction;
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
    const { weather, environment } = this.#config;
    this.#weatherTimer -= dt;
    if (this.#weatherTimer <= 0) {
      this.#isRaining = this.#rng.chance(weather.chances.rain);
      this.#isFoggy = this.#rng.chance(weather.chances.fog);
      this.#weatherTimer = weather.updateIntervalMs;

      const rainMultConfig = environment.wind?.rainMultiplier;
      this.#windState.rainMult =
        this.#isRaining && rainMultConfig
          ? rainMultConfig[0] +
            this.#rng.range(0, rainMultConfig[1] - rainMultConfig[0])
          : 1.0;
    }

    this.#windState.timer -= dt;
    if (this.#windState.timer <= 0) {
      const wind = environment.wind;
      if (!wind?.changesPerDay) return;

      const { changesPerDay } = wind;
      this.#windState.timer =
        86400000 /
        (changesPerDay[0] +
          this.#rng.range(0, changesPerDay[1] - changesPerDay[0]));
      this.#windState.direction = this.#rng.pick([-1, 0, 1]);
    }
  }

  getSnapshot() {
    return this.#snapshot;
  }

  getPhysicsEnv() {
    const base = this.#config.environment;
    const env = this.#physicsEnv;
    env.current = base.current;
    env.wind = null;

    if (base.wind && this.#windState.direction !== 0) {
      const m = this.#windState.rainMult;
      const wind = this.#physicsWind;
      wind.direction = this.#windState.direction;
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

class GameWorld {
  #map;
  #env;
  #chum;
  #projector;
  #location;
  #canvasMetrics;
  #clock;
  #locationConfig;
  #bounds = { left: 0, right: 0, top: 0, bottom: 0 };
  #virtualTopLeft = new Vector2(0, 0);
  #virtualBottomRight = new Vector2(0, 0);

  constructor({
    map,
    env,
    chum,
    projector,
    location,
    canvasMetrics,
    clock,
    locationConfig,
  }) {
    this.#map = map;
    this.#env = env;
    this.#chum = chum;
    this.#projector = projector;
    this.#location = location;
    this.#canvasMetrics = canvasMetrics;
    this.#clock = clock;
    this.#locationConfig = locationConfig;
  }

  refreshViewport(recalculateMap = true) {
    this.#projector.update(
      this.#canvasMetrics.width,
      this.#canvasMetrics.height,
    );
    if (recalculateMap) {
      this.#map.recalculateZones(
        this.#projector,
        this.#locationConfig.cellSize,
      );
    }
  }

  getDynamicBounds() {
    const locations = this.#locationConfig;
    const mapBounds = this.#map.getCastableBoundsVirtual(locations.cellSize);
    const vTL = this.#projector.screenToVirtual(0, 0, this.#virtualTopLeft);
    const vBR = this.#projector.screenToVirtual(
      this.#canvasMetrics.width,
      this.#canvasMetrics.height,
      this.#virtualBottomRight,
    );

    this.#bounds.left = locations.lockZoneXToScreen
      ? Math.max(vTL.x, mapBounds.left)
      : mapBounds.left;
    this.#bounds.right = locations.lockZoneXToScreen
      ? Math.min(vBR.x, mapBounds.right)
      : mapBounds.right;
    this.#bounds.top = mapBounds.top;
    this.#bounds.bottom = mapBounds.bottom;

    return this.#bounds;
  }

  pan(deltaX, deltaY = 0) {
    if (!deltaX && !deltaY) return;
    this.#projector.pan(deltaX, deltaY);
  }

  checkWater(vx, vy) {
    const cell = this.#map.getCellAtVirtualPos(
      vx,
      vy,
      this.#locationConfig.cellSize,
    );
    return cell && cell.isCastable && !cell.hasCollision ? cell : null;
  }

  update(dt, timeScale, bounds) {
    const locations = this.#locationConfig;

    this.#env.update(dt, timeScale);
    const envSnapshot = this.#env.getSnapshot();
    this.#map.update(dt, envSnapshot.time);
    this.#chum.update(this.#clock.realNow, timeScale);

    this.#chum.updateBoats(
      dt,
      (vx, vy) => {
        if (
          vx < bounds.left ||
          vx > bounds.right ||
          vy < bounds.top ||
          vy > bounds.bottom
        ) {
          return null;
        }
        return this.checkWater(vx, vy);
      },
      (vx, vy) => {
        const cell = this.#map.getCellAtVirtualPos(vx, vy, locations.cellSize);
        return cell ? cell.hasCollision : false;
      },
      locations.cellSize,
      { current: this.#location.currentEnvironment?.current },
    );

    return envSnapshot;
  }
}
