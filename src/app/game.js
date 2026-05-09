class GameClock {
  #lastFrameTime = 0;
  #realTimeOffset = Date.now() - performance.now();
  #maxDeltaMs;

  constructor(maxDeltaMs = 100) {
    this.#maxDeltaMs = maxDeltaMs;
    this.now = 0;
    this.delta = 0;
    this.total = 0;
    this.realNow = Date.now();
  }

  tick(frameTime) {
    if (!this.#lastFrameTime) {
      this.#lastFrameTime = frameTime;
      this.now = frameTime;
      this.realNow = this.#realTimeOffset + frameTime;
      return 0;
    }

    this.delta = Math.min(this.#maxDeltaMs, frameTime - this.#lastFrameTime);
    this.#lastFrameTime = frameTime;
    this.now = frameTime;
    this.total += this.delta;
    this.realNow = this.#realTimeOffset + frameTime;
    return this.delta;
  }

  reset(frameTime = performance.now()) {
    this.#lastFrameTime = frameTime;
    this.now = frameTime;
    this.delta = 0;
    this.total = 0;
    this.realNow = this.#realTimeOffset + frameTime;
  }
}

class GameLoop {
  #clock;
  #onUpdate;
  #onDraw;
  #isRunning = false;
  #rafId = 0;

  constructor(clock, onUpdate, onDraw) {
    this.#clock = clock;
    this.#onUpdate = onUpdate;
    this.#onDraw = onDraw;
  }

  start() {
    if (this.#isRunning) return;
    this.#isRunning = true;
    this.#clock.reset();

    const loop = (frameTime) => {
      if (!this.#isRunning) return;
      const dt = this.#clock.tick(frameTime);
      this.#onUpdate(dt);
      this.#onDraw();
      this.#rafId = requestAnimationFrame(loop);
    };

    this.#rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (!this.#isRunning) return;
    this.#isRunning = false;
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }
  }

  get isRunning() {
    return this.#isRunning;
  }
}

class EventLifecycle {
  #cleanups = [];

  add(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      target.removeEventListener(type, handler, options);
    };
    this.#cleanups.push(cleanup);
    return cleanup;
  }

  dispose() {
    for (let i = this.#cleanups.length - 1; i >= 0; i--) {
      this.#cleanups[i]();
    }
    this.#cleanups.length = 0;
  }
}

class EventBus {
  #listeners = new Map();

  on(type, handler) {
    let handlers = this.#listeners.get(type);
    if (!handlers) {
      handlers = new Set();
      this.#listeners.set(type, handlers);
    }
    handlers.add(handler);
    return () => handlers.delete(handler);
  }

  emit(type, payload) {
    const handlers = this.#listeners.get(type);
    if (!handlers) return;

    for (const handler of handlers) {
      handler(payload);
    }
  }

  clear() {
    this.#listeners.clear();
  }
}

class DebugEventBridge {
  #bus = new EventBus();
  #target;
  #isEnabled;

  constructor(target, isEnabled) {
    this.#target = target;
    this.#isEnabled = isEnabled;
  }

  on(type, handler) {
    return this.#bus.on(type, handler);
  }

  emit(type, detail) {
    if (!this.#isEnabled()) return;
    this.#bus.emit(type, detail);
    this.#target.dispatchEvent(new CustomEvent(type, { detail }));
  }

  clear() {
    this.#bus.clear();
  }
}

class SeededRng {
  #state;

  constructor(seed = 0x9e3779b9) {
    this.#state = this.#normalizeSeed(seed);
  }

  #normalizeSeed(seed) {
    if (typeof seed === "number" && Number.isFinite(seed)) {
      return seed >>> 0 || 0x9e3779b9;
    }

    const value = String(seed ?? "cyber-fishing");
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 0x9e3779b9;
  }

  next() {
    this.#state = Math.imul(1664525, this.#state) + 1013904223;
    return (this.#state >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(items) {
    return items[this.int(0, items.length - 1)];
  }
}

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

class DevFlags {
  static cheat(flag) {
    return typeof GodMode !== "undefined" && GodMode[flag] === true;
  }

  static debugEvents() {
    return !!(
      CONFIG.debug?.overlay ||
      CONFIG.debug?.events ||
      CONFIG.logs?.events ||
      window.DEBUG_MODULES
    );
  }
}

class BufferedAudioPlayer {
  #src;
  #context = null;
  #buffer = null;
  #loadPromise = null;
  #fallbackPool = null;
  #fallbackCursor = 0;

  constructor(src, fallbackPoolSize = 4) {
    this.#src = src;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (AudioContextClass) {
      this.#context = new AudioContextClass();
      this.#loadPromise = this.#load();
    } else {
      this.#fallbackPool = [];
      for (let i = 0; i < fallbackPoolSize; i++) {
        this.#fallbackPool.push(new Audio(src));
      }
    }
  }

  get src() {
    return this.#src;
  }

  async #load() {
    const response = await fetch(this.#src);
    const data = await response.arrayBuffer();
    this.#buffer = await this.#context.decodeAudioData(data);
    return this.#buffer;
  }

  warm() {
    return this.#loadPromise || Promise.resolve();
  }

  play(volume = 1) {
    if (this.#fallbackPool) {
      const sound = this.#fallbackPool[this.#fallbackCursor];
      this.#fallbackCursor =
        (this.#fallbackCursor + 1) % this.#fallbackPool.length;
      sound.pause();
      sound.currentTime = 0;
      sound.volume = volume;
      sound.play().catch(() => {});
      return;
    }

    if (!this.#buffer) {
      this.#loadPromise?.then(() => this.play(volume)).catch(() => {});
      return;
    }

    if (this.#context.state === "suspended") {
      this.#context.resume().catch(() => {});
    }

    const source = this.#context.createBufferSource();
    const gain = this.#context.createGain();
    gain.gain.value = volume;
    source.buffer = this.#buffer;
    source.connect(gain);
    gain.connect(this.#context.destination);
    source.start(0);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  dispose() {
    if (this.#fallbackPool) {
      for (let i = 0; i < this.#fallbackPool.length; i++) {
        const sound = this.#fallbackPool[i];
        sound.pause();
        sound.removeAttribute("src");
        sound.load();
      }
      this.#fallbackPool.length = 0;
    }

    if (this.#context && this.#context.state !== "closed") {
      this.#context.close().catch(() => {});
    }
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
    spawnConfig = CONFIG.spawns,
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

      // --- ВІДНОВЛЕНО: Перевірка наявності rainMultiplier ---
      const rainMultConfig = environment.wind?.rainMultiplier;
      this.#windState.rainMult =
        this.#isRaining && rainMultConfig
          ? rainMultConfig[0] +
            this.#rng.range(0, rainMultConfig[1] - rainMultConfig[0])
          : 1.0;
    }

    this.#windState.timer -= dt;
    if (this.#windState.timer <= 0) {
      const { changesPerDay } = environment.wind;
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
  #systems;
  #location;
  #canvas;
  #clock;
  #config;
  #bounds = { left: 0, right: 0, top: 0, bottom: 0 };
  #virtualTopLeft = new Vector2(0, 0);
  #virtualBottomRight = new Vector2(0, 0);

  constructor({ systems, location, canvas, clock, config }) {
    this.#systems = systems;
    this.#location = location;
    this.#canvas = canvas;
    this.#clock = clock;
    this.#config = config;
  }

  refreshViewport(recalculateMap = true) {
    const locations = this.#config.locations;
    this.#systems.projector.update(this.#canvas.width, this.#canvas.height);
    if (recalculateMap) {
      this.#systems.map.recalculateZones(
        this.#systems.projector,
        locations.cellSize,
      );
    }
  }

  getDynamicBounds() {
    const locations = this.#config.locations;
    const mapBounds = this.#systems.map.getCastableBoundsVirtual(
      locations.cellSize,
    );
    const vTL = this.#systems.projector.screenToVirtual(
      0,
      0,
      this.#virtualTopLeft,
    );
    const vBR = this.#systems.projector.screenToVirtual(
      this.#canvas.width,
      this.#canvas.height,
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

  checkWater(vx, vy) {
    const locations = this.#config.locations;
    const cell = this.#systems.map.getCellAtVirtualPos(
      vx,
      vy,
      locations.cellSize,
    );
    return cell && cell.isCastable && !cell.hasCollision ? cell : null;
  }

  update(dt, timeScale, bounds) {
    const locations = this.#config.locations;

    this.#systems.env.update(dt, timeScale);
    const envSnapshot = this.#systems.env.getSnapshot();
    this.#systems.map.update(dt, envSnapshot.time);
    this.#systems.chum.update(this.#clock.realNow, timeScale);

    this.#systems.chum.updateBoats(
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
        const cell = this.#systems.map.getCellAtVirtualPos(
          vx,
          vy,
          locations.cellSize,
        );
        return cell ? cell.hasCollision : false;
      },
      locations.cellSize,
      { current: this.#location.currentEnvironment?.current },
    );

    return envSnapshot;
  }
}

class RenderSystem {
  #systems;
  #config;

  constructor(systems, config) {
    this.#systems = systems;
    this.#config = config;
  }

  drawWorld(invalidCastMarker, debugEnabled) {
    const r = this.#systems.renderer;
    const locations = this.#config.locations;

    r.clear(this.#config.canvas.backgroundColor);
    r.drawBackground(this.#systems.map, this.#systems.projector);

    if (debugEnabled && locations?.debugVisuals) {
      r.drawLocationDebug?.(
        this.#systems.map,
        this.#systems.projector,
        locations,
      );
    }

    if (locations?.showChumZones !== false) {
      r.drawChumZones(this.#systems.chum, this.#systems.projector);
    }

    if (this.#systems.chum) {
      r.drawBoatWaypoints?.(this.#systems.chum, this.#systems.projector);
      r.drawBoats?.(this.#systems.chum, this.#systems.projector);

      const boats = this.#systems.chum.getBoats();
      for (let i = 0; i < boats.length; i++) {
        r.renderSensors?.(boats[i], this.#systems.projector);
      }
    }

    if (invalidCastMarker) {
      r.drawInvalidCastMarker(invalidCastMarker);
    }

    return r;
  }
}

class FishingController {
  #inventory;

  constructor(inventory) {
    this.#inventory = inventory;
  }

  consumeFirstBaitForFight(eq) {
    if (DevFlags.cheat("infiniteResources")) return false;

    const baits = eq?.baits || [];
    for (let i = 0; i < baits.length; i++) {
      if (baits[i]?.type === "bait") {
        return this.#inventory.consumeEquipped(`baits_${i}`, 1, false);
      }
    }
    return false;
  }

  consumeFeederChumIfNeeded(eq) {
    if (DevFlags.cheat("infiniteResources")) return false;
    if (eq?.rod?.type !== "feeder" || !eq?.feederChum) return false;
    return this.#inventory.consumeEquipped("feederChum", 1, false);
  }

  consumeHandChum(chum) {
    if (DevFlags.cheat("infiniteResources")) return false;
    if (!chum?.instanceId) return false;
    return this.#inventory.consumeItem(chum.instanceId, 1);
  }

  consumeDeliveryChum(slotIndex) {
    if (DevFlags.cheat("infiniteResources")) return false;
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return false;
    return this.#inventory.consumeEquipped(`deliveryChums_${slotIndex}`, 1);
  }

  collectAvailableBaits(eq, eatenBaits, outIds, outTypes) {
    outIds.length = 0;
    outTypes.length = 0;

    const baits = eq?.baits || [];
    const eaten = eatenBaits || [];
    for (let i = 0; i < baits.length; i++) {
      const bait = baits[i];
      if (!bait) continue;

      let isEaten = false;
      for (let j = 0; j < eaten.length; j++) {
        if (eaten[j].instanceId === bait.instanceId) {
          isEaten = true;
          break;
        }
      }

      if (!isEaten) {
        outIds.push(bait.id);
        outTypes.push(bait.type);
      }
    }
  }

  hasActiveLureType(types) {
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      if (type === "spinner" || type === "wobbler" || type === "jig") {
        return true;
      }
    }
    return false;
  }

  applyFailureEquipmentLoss(reason, eq) {
    if (DevFlags.cheat("noEquipmentLoss")) {
      console.log(
        "%c[GOD MODE] ðŸ›¡ï¸ Ð¡Ð½Ð°ÑÑ‚Ñ– Ñ‚Ð° Ð½Ð°Ð¶Ð¸Ð²ÐºÑƒ Ð²Ñ€ÑÑ‚Ð¾Ð²Ð°Ð½Ð¾ Ð²Ñ–Ð´ Ð²Ñ‚Ñ€Ð°Ñ‚Ð¸!",
        "color: #00ff00;",
      );
      return;
    }

    if (
      reason === "rod" ||
      reason === "line" ||
      reason === "hook" ||
      reason === "net_escape"
    ) {
      this.#consumeEquippedArray(eq?.baits, "baits");
    }

    if (reason === "rod" || reason === "line") {
      this.#consumeEquippedArray(eq?.hooks, "hooks");
      if (eq?.float) this.#inventory.consumeEquipped("float", 1);
      if (eq?.sinker) this.#inventory.consumeEquipped("sinker", 1);
      if (eq?.feederChum) this.#inventory.consumeEquipped("feederChum", 1);
    }

    if (reason === "rod" && eq?.rod) {
      this.#inventory.consumeEquipped("rod", 1);
    }
  }

  #consumeEquippedArray(items, slotName) {
    if (!items) return;
    for (let index = 0; index < items.length; index++) {
      if (items[index]) {
        this.#inventory.consumeEquipped(`${slotName}_${index}`, 1);
      }
    }
  }

  tryConsumeBaitDuringBite(eq, stepInfo, rng, physicsConfig) {
    if (!stepInfo?.isAction) return false;

    let consumedSlot = null;
    let consumedBaitId = null;
    const baits = eq?.baits || [];
    for (let i = 0; i < baits.length; i++) {
      if (baits[i] && baits[i].type === "bait") {
        consumedSlot = `baits_${i}`;
        consumedBaitId = baits[i].instanceId;
        break;
      }
    }

    if (!consumedBaitId) return false;

    const lossChance = stepInfo.isGuaranteed
      ? (physicsConfig.baitLossChance?.guaranteed ?? 0.5)
      : (physicsConfig.baitLossChance?.normal ?? 0.15);

    if (!rng.chance(lossChance)) return false;

    if (DevFlags.cheat("noEquipmentLoss")) {
      console.log(
        "%c[GOD MODE] ðŸ›¡ï¸ Ð Ð¸Ð±Ð° Ð½Ð°Ð¼Ð°Ð³Ð°Ð»Ð°ÑÑŒ Ð²ÐºÑ€Ð°ÑÑ‚Ð¸ Ð½Ð°Ð¶Ð¸Ð²ÐºÑƒ, Ð°Ð»Ðµ Ð‘Ð¾Ð³ Ð½Ðµ Ð´Ð¾Ð·Ð²Ð¾Ð»Ð¸Ð²!",
        "color: #00ff00;",
      );
    } else {
      this.#inventory.consumeEquipped(consumedSlot, 1);
    }

    return true;
  }
}

class ChumController {
  #systems;
  #fishing;
  #location;
  #clock;
  #depthUI;
  #getDynamicBounds;
  #getRodVirtualPos;
  #checkWater;
  #markInvalidCast;
  #canPlayerCast;
  #getGameStateName;
  #ui;
  #activeHandChum = null;
  #isAiming = false;
  #activeBoat = null;
  #uiClickLockTime = 0;

  constructor({
    systems,
    fishing,
    location,
    clock,
    depthUI,
    getDynamicBounds,
    getRodVirtualPos,
    checkWater,
    markInvalidCast,
    canPlayerCast,
    getGameStateName,
  }) {
    this.#systems = systems;
    this.#fishing = fishing;
    this.#location = location;
    this.#clock = clock;
    this.#depthUI = depthUI;
    this.#getDynamicBounds = getDynamicBounds;
    this.#getRodVirtualPos = getRodVirtualPos;
    this.#checkWater = checkWater;
    this.#markInvalidCast = markInvalidCast;
    this.#canPlayerCast = canPlayerCast;
    this.#getGameStateName = getGameStateName;
    this.#ui = new ChumUI(() => this.handleClick());
    this.refreshActiveHandChum();
  }

  get ui() {
    return this.#ui;
  }

  get isAiming() {
    return this.#isAiming;
  }

  get activeBoat() {
    return this.#activeBoat;
  }

  set activeBoat(boat) {
    this.#activeBoat = boat;
  }

  refreshActiveHandChum() {
    this.#activeHandChum =
      this.#systems.inventory.findFirstItemByType("chum_mix");
  }

  updateUI() {
    const eq = this.#systems.inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";
    const boatItem = eq.delivery || {};
    const isManual = boatItem.manualControl ?? true;
    const sections = boatItem.sections ?? boatItem.engineStats?.sections ?? 1;

    let state = "idle";
    let count = 0;

    if (method === "hand") {
      const activeChum = this.#activeHandChum;
      count = activeChum ? activeChum.quantity || 1 : 0;
      if (count <= 0) state = "empty";
      else if (this.#isAiming) state = "aiming";
      else state = "idle";
    } else if (method === "boat") {
      const boats = this.#systems.chum.getBoats();
      const activeBoat = boats.length > 0 ? boats[0] : null;

      if (!activeBoat) {
        const loadedCount = this.#countLoadedChums(eq.deliveryChums);
        count = sections;
        state =
          loadedCount === 0 ? "empty" : this.#isAiming ? "aiming" : "idle";
      } else {
        count = activeBoat.remainingSections;

        if (activeBoat.state === "idle") {
          state = this.#isAiming ? "aiming" : "idle";
        } else if (activeBoat.state === "drifting") {
          state = "empty";
        } else if (isManual) {
          if (
            activeBoat.state === "deploying" ||
            activeBoat.state === "returning"
          ) {
            state = "moving";
          } else if (activeBoat.state === "waiting") {
            state = count > 0 ? "ready" : "empty";
          }
        } else if (activeBoat.state === "returning") {
          state = "moving";
        } else if (
          activeBoat.state === "deploying" ||
          activeBoat.state === "waiting"
        ) {
          state = this.#isAiming ? "aiming" : "moving";
        }
      }
    }

    this.#ui.setState(state, method, count, isManual);
    this.#syncAimingWithBoatState(method, isManual);
  }

  handleClick() {
    const eq = this.#systems.inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    if (method === "hand") {
      if (this.#activeHandChum) {
        this.toggleAim();
      } else {
        this.#warn(
          "Ð£ Ð²Ð°Ñ Ð½ÐµÐ¼Ð°Ñ” Ð¿Ñ€Ð¸ÐºÐ¾Ñ€Ð¼ÐºÐ¸ Ð² Ñ–Ð½Ð²ÐµÐ½Ñ‚Ð°Ñ€Ñ–!",
        );
      }
      return;
    }

    if (method !== "boat") return;

    const boats = this.#systems.chum.getBoats();
    if (boats.length === 0) {
      if (this.#countLoadedChums(eq.deliveryChums) > 0) {
        this.toggleAim();
      } else {
        this.#warn(
          "Ð—Ð°Ð²Ð°Ð½Ñ‚Ð°Ð¶Ñ‚Ðµ Ð¿Ñ€Ð¸ÐºÐ¾Ñ€Ð¼ÐºÑƒ Ð² Ð±ÑƒÐ½ÐºÐµÑ€Ð¸ ÐºÐ¾Ñ€Ð°Ð±Ð»Ð¸ÐºÐ° Ñ‡ÐµÑ€ÐµÐ· Ñ–Ð½Ð²ÐµÐ½Ñ‚Ð°Ñ€!",
        );
      }
      return;
    }

    const activeBoat = boats[0];
    const boatItem = eq.delivery || {};
    const isManual = boatItem.manualControl ?? true;

    if (this.#isAiming) {
      this.toggleAim();
      return;
    }

    if (
      isManual &&
      activeBoat.state === "waiting" &&
      activeBoat.remainingSections > 0
    ) {
      this.#dropManualBoatChum(activeBoat, boatItem);
    }
  }

  toggleAim() {
    this.#isAiming = !this.#isAiming;
    this.#uiClickLockTime = this.#clock.now;

    if (this.#isAiming) {
      this.#depthUI.hide();
    }

    const eq = this.#systems.inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    if (this.#isAiming && method === "boat") {
      const bounds = this.#getDynamicBounds();
      const rodPos = this.#getRodVirtualPos(bounds);

      this.#activeBoat = this.#systems.chum.spawnIdleBoat(
        rodPos.x,
        bounds.bottom - 5,
        eq.delivery,
      );

      if (this.#activeBoat) {
        this.#activeBoat._loadedChums = this.#getLoadedChums(eq.deliveryChums);
        this.#activeBoat.remainingSections =
          this.#activeBoat._loadedChums.length;
      }
    } else if (!this.#isAiming && this.#activeBoat) {
      if (this.#activeBoat.state === "idle") {
        this.#systems.chum.removeBoat(this.#activeBoat);
      }
      this.#activeBoat = null;
    }
  }

  setAiming(value) {
    if (this.#isAiming !== !!value) {
      this.toggleAim();
    }
  }

  handleAiming(input, bounds) {
    if (!input.clickPos) return;

    if (
      this.#uiClickLockTime &&
      this.#clock.now - this.#uiClickLockTime < 200
    ) {
      input.clickPos = null;
      return;
    }

    const eq = this.#systems.inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";
    const vPos = this.#systems.projector.screenToVirtual(
      input.clickPos.x,
      input.clickPos.y,
    );
    const cell = this.#checkWater(vPos.x, vPos.y);

    if (method === "hand") {
      this.#handleHandAiming(input, bounds, vPos, cell);
    } else if (method === "boat") {
      this.#handleBoatAiming(input, vPos, cell);
    }
  }

  handleGlobalBoatControl(input) {
    if (
      !input.clickPos ||
      this.#isAiming ||
      this.#getGameStateName() === "playing"
    ) {
      return;
    }

    const boats = this.#systems.chum.getBoats();
    if (boats.length === 0) return;

    const activeBoat = boats[0];
    const vPos = this.#systems.projector.screenToVirtual(
      input.clickPos.x,
      input.clickPos.y,
    );
    let clickHandled = false;

    const distToBoat = Math.hypot(
      activeBoat.pos.x - vPos.x,
      activeBoat.pos.y - vPos.y,
    );
    const mapBounds = this.#getDynamicBounds();

    if (distToBoat < 40) {
      if (activeBoat.pos.y > mapBounds.bottom - 200) {
        this.#systems.chum.removeBoat(activeBoat);
      }
      clickHandled = true;
    } else if (activeBoat.state !== "drifting") {
      clickHandled = this.#handleBoatMapClick(activeBoat, vPos, input.clickPos);
    }

    if (clickHandled || !this.#canPlayerCast()) {
      input.clickPos = null;
    }
  }

  #handleHandAiming(input, bounds, vPos, cell) {
    const activeChum = this.#activeHandChum;

    if (!cell || !activeChum) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      this.toggleAim();
      return;
    }

    const virtualLineY = bounds.bottom - this.#location.chumCastDistance;
    if (vPos.y < virtualLineY) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      this.toggleAim();
      this.#warn(
        "Ð—Ð°Ð½Ð°Ð´Ñ‚Ð¾ Ð´Ð°Ð»ÐµÐºÐ¾ Ð´Ð»Ñ Ñ€ÑƒÑ‡Ð½Ð¾Ð³Ð¾ Ð·Ð°ÐºÐ¸Ð´Ð°Ð½Ð½Ñ!",
      );
      return;
    }

    this.#systems.chum.deployBait(vPos.x, vPos.y, activeChum.id);
    this.#fishing.consumeHandChum(activeChum);
    this.toggleAim();
  }

  #handleBoatAiming(input, vPos, cell) {
    const activeBoat = this.#activeBoat;
    if (!activeBoat) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      return;
    }

    const reservedTargets = this.#getReservedTargets(activeBoat);
    const chumData = activeBoat._loadedChums
      ? activeBoat._loadedChums[reservedTargets]
      : null;
    const chumToDrop = chumData ? chumData.item : null;

    if (!cell || !chumToDrop) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      return;
    }

    this.#systems.chum.deployBait(vPos.x, vPos.y, chumToDrop.id, activeBoat);
    this.#fishing.consumeDeliveryChum(chumData.slotIndex);

    const loadedCount = activeBoat._loadedChums.length;
    if (reservedTargets + 1 >= loadedCount) {
      this.toggleAim();
    }
  }

  #handleBoatMapClick(activeBoat, vPos, clickPos) {
    const cell = this.#checkWater(vPos.x, vPos.y);
    if (!cell) {
      this.#markInvalidCast(clickPos);
      return true;
    }

    const eq = this.#systems.inventory.getEquipped();
    const boatItem = eq.delivery || {};
    const isManual = boatItem.manualControl ?? true;

    if (isManual) {
      if (activeBoat.state !== "returning") {
        activeBoat.setTarget(vPos.x, vPos.y);
        return true;
      }
      return false;
    }

    const reservedTargets = this.#getReservedTargets(activeBoat);
    const freeSlots = activeBoat.remainingSections - reservedTargets;
    if (freeSlots <= 0 || activeBoat.state === "returning") return false;

    const chumData = activeBoat._loadedChums
      ? activeBoat._loadedChums[reservedTargets]
      : null;
    const chumToDrop = chumData ? chumData.item : null;
    if (!chumToDrop) return false;

    this.#systems.chum.deployBait(vPos.x, vPos.y, chumToDrop.id, activeBoat);
    this.#fishing.consumeDeliveryChum(chumData.slotIndex);
    return true;
  }

  #dropManualBoatChum(activeBoat, boatItem) {
    const loadedCount = activeBoat._loadedChums.length;
    const dropIndex = loadedCount - activeBoat.remainingSections;
    const chumData = activeBoat._loadedChums[dropIndex];

    if (chumData) {
      this.#systems.chum.deployBait(
        activeBoat.pos.x,
        activeBoat.pos.y,
        chumData.item.id,
      );
      this.#fishing.consumeDeliveryChum(chumData.slotIndex);
    }

    activeBoat.remainingSections--;

    if (activeBoat.remainingSections <= 0) {
      const hasAI =
        boatItem.hasAutoReturn ?? boatItem.engineStats?.hasAutoReturn ?? false;
      if (hasAI) {
        activeBoat.state = "returning";
      }
    }
  }

  #syncAimingWithBoatState(method, isManual) {
    if (!this.#isAiming || method !== "boat") return;

    const boats = this.#systems.chum.getBoats();
    const activeBoat = boats.length > 0 ? boats[0] : null;
    if (!activeBoat) return;

    if (!isManual && activeBoat.state === "returning") {
      this.#isAiming = false;
    } else if (
      isManual &&
      activeBoat.state !== "idle" &&
      activeBoat.state !== "waiting"
    ) {
      this.#isAiming = false;
    }
  }

  #getLoadedChums(deliveryChums) {
    const loadedChums = [];
    const chumsArr = deliveryChums || [];
    for (let i = 0; i < chumsArr.length; i++) {
      if (chumsArr[i]) {
        loadedChums.push({ slotIndex: i, item: chumsArr[i] });
      }
    }
    return loadedChums;
  }

  #countLoadedChums(deliveryChums) {
    let loadedCount = 0;
    const chumsArr = deliveryChums || [];
    for (let i = 0; i < chumsArr.length; i++) {
      if (chumsArr[i]) loadedCount++;
    }
    return loadedCount;
  }

  #getReservedTargets(boat) {
    return (boat.zoneId ? 1 : 0) + (boat.waypoints ? boat.waypoints.length : 0);
  }

  #warn(message) {
    this.#systems.inventoryUI?.showWarning(message);
  }
}

class GameState {
  constructor(game, data = {}) {
    this.game = game;
    this.data = data;
  }
  enter() {}
  exit() {}
  handleInput() {}
  update() {}
  draw() {}
  dispose() {}
}

class ScoutingState extends GameState {
  enter() {
    const eq = this.game.systems.inventory.getEquipped();
    const hasNet = !!eq.net;
    this.game.systems.ui.updateNetButtonState(hasNet, false);
  }

  exit() {
    this.game.depthUI.hide();
  }

  handleInput(input) {
    if (input.clickPos) {
      const vPos = this.game.systems.projector.screenToVirtual(
        input.clickPos.x,
        input.clickPos.y,
      );
      let cell = this.game.checkWater(vPos.x, vPos.y);
      const bounds = this.game.getDynamicBounds();

      // --- ВТРУЧАННЯ GOD MODE ---
      let canCastAnywhere = DevFlags.cheat("infiniteCasting");

      if (canCastAnywhere) {
        // Якщо чіт увімкнено, ми "підробляємо" дані, якщо їх немає
        if (!cell) cell = { depth: 2.0 }; // Дефолтна глибина для суходолу
      }
      // --------------------------

      // Розрахунок відстані (тепер з урахуванням God Mode)
      let isInside = true;
      if (!canCastAnywhere) {
        const eq = this.game.systems.inventory.getEquipped();
        let maxDist = eq.rod?.maxDistance || Infinity;
        if (maxDist !== Infinity) {
          isInside = vPos.y >= bounds.bottom - maxDist;
        }
      }

      if ((cell && isInside) || canCastAnywhere) {
        this.game.castLine(vPos.x, vPos.y, cell.depth);
      } else {
        this.game.markInvalidCast(input.clickPos);
      }
    }
  }

  update(dt, bounds) {
    this.game.systems.projector.focusOnVirtualPos(
      bounds.bottom - 200,
      dt,
      0.03,
    );

    const eq = this.game.systems.inventory.getEquipped();
    const rodType = eq?.rod?.type;
    const bait = eq?.baits?.[0];
    const isFeeder = rodType === "feeder";
    const isSpinning = rodType === "spinning";
    const isJig = bait?.type === "jig";
    const hasSinker = !!eq?.sinker;

    const canSelectDepth =
      !isFeeder && ((isSpinning && isJig) || (!isSpinning && hasSinker));

    if (!this.game.canPlayerCast() || !canSelectDepth) {
      if (this.game.depthUI.isActive) {
        this.game.depthUI.hide();
      }
      this.game.currentHookDepth = CONFIG.physics?.defaultDepthNoSinker ?? 0.1;
      return;
    }

    const maxDepth = this.game.getMaxHookDepth();

    if (!this.game.depthUI.isActive) {
      this.game.depthUI.show(
        maxDepth,
        Math.min(this.game.currentHookDepth, maxDepth),
        (d) => (this.game.currentHookDepth = d),
      );
    } else {
      if (typeof this.game.depthUI.updateMax === "function") {
        this.game.depthUI.updateMax(maxDepth);
      }
    }
  }

  draw(renderer, bounds) {
    if (!this.game.isAimingChum) {
      // Відмальовка дозволеної зони для ВУДКИ
      if (CONFIG.locations?.showAimingZone !== false) {
        const eq = this.game.systems.inventory.getEquipped();
        let rawDist = eq.rod?.maxDistance;
        let maxDist = rawDist === "max" || rawDist == null ? Infinity : rawDist;

        if (maxDist !== Infinity) {
          maxDist = Math.min(maxDist, bounds.bottom - bounds.top);
          renderer.drawAimingZone(
            this.game.systems.projector,
            bounds.bottom,
            maxDist,
            "rod",
          );
        }
      }
    } else {
      // Відмальовка дозволеної зони для ПРИКОРМКИ
      const eq = this.game.systems.inventory.getEquipped();
      const method = eq.delivery ? "boat" : "hand";

      // МАЛЮЄМО ЗОНУ ТІЛЬКИ ЯКЩО ПРИКОРМКА В РУЦІ
      if (method === "hand" && CONFIG.locations?.showAimingZone !== false) {
        // Беремо динамічний ID локації або використовуємо "test" як запобіжник
        const chumDist = this.game.chumCastDistance;

        renderer.drawAimingZone(
          this.game.systems.projector,
          bounds.bottom,
          chumDist,
          "chum",
        );
      }
    }
  }
}

class PlayingState extends GameState {
  #fishingSystem;
  #tensionMeter;
  #fishCondition;
  #staminaController;
  #isNetReady = false;
  #startTime = 0;
  #forces = { pX: 0, pY: 0, fX: 0, fY: 0 };
  #rod;
  #reel;
  #hasEquippedNet = false;
  #onConfigUpdateBind;
  #removeConfigUpdateListener = null;
  #fishForceApplied = new Vector2(0, 0);
  #playerForce = new Vector2(0, 0);
  #playerForceApplied = new Vector2(0, 0);
  #pullDirection = new Vector2(0, 0);

  enter(data) {
    this.#startTime = this.game.clock.now;
    this.data = data || {};
    const fishData = this.data.fish;

    const eq = this.game.systems.inventory.getEquipped();
    this.#hasEquippedNet = !!eq.net;

    this.game.fishing.consumeFirstBaitForFight(eq);

    this.#rod = new Rod(
      eq.rod?.level || 1,
      eq.rod?.basePower || 1.0,
      eq.rod?.compensation || 0,
      eq.rod?.type || "float",
      eq.rod?.maxDistance || 100,
      eq.rod?.hasReel !== false,
    );

    this.#reel = eq.reel
      ? new Reel(
          eq.reel.level || 1,
          eq.reel.basePower || 1.0,
          eq.reel.hold || null,
        )
      : new Reel(0, 0, null);

    // --- ВИПРАВЛЕНО БАГ З ЧИТАННЯМ ГАЧКА ---
    const activeHook = eq.hooks?.[0] || {};
    const hookLevel = activeHook.level || 1;
    const hookWeight = activeHook.weight || 1;
    const hookQuality = activeHook.quality || 1.0;
    const hook = new Hook(hookLevel, hookWeight, hookQuality);

    const fish = new Fish(
      fishData.level,
      fishData.weight,
      fishData.resistance,
      fishData.physics,
      this.game.rng,
    );

    this.#fishingSystem = new FishingSystem(
      this.#rod,
      this.#reel,
      fish,
      this.game.rng,
    );

    this.#tensionMeter = new TensionMeter(
      eq.rod?.level || 1,
      eq.reel?.level || 0,
      hook,
      CONFIG.tension,
      this.game.rng,
    );

    this.#fishCondition = new FishCondition(
      fishData.level,
      fishData.weight,
      CONFIG.stamina.fish,
    );

    this.#staminaController = new StaminaController(
      this.#fishCondition,
      fish,
      this.#rod.getPower() + this.#reel.getPower(),
      CONFIG.stamina.mechanics,
    );

    if (this.game.isDebugEnabled()) {
      console.log(
        `%c🎣 КЛЮНУВ: ${fishData.name}!`,
        "color: #00ff00; font-size: 16px; font-weight: bold;",
      );
      console.table({
        "Тип Вудки": this.#rod.getType(),
        "Наявність Котушки": this.#rod.hasReel() ? "Є" : "Немає (Махова)",
        "Згенерована Вага": fishData.weight.toFixed(3) + " кг",
        "Рівень (Складність)": fishData.level,
        "Базовий Опір": fishData.resistance.toFixed(2),
      });

      this.game.emitDebugEvent("debug-fish-hooked", {
        fish: fishData,
        eq: eq,
      });
    }

    // --- ДОДАНО: Слухаємо DevTools під час виважування ---
    this.#onConfigUpdateBind = () => this.#syncEquipment();
    this.#removeConfigUpdateListener?.();
    this.#removeConfigUpdateListener = this.game.addLifecycleListener(
      document,
      "config-updated",
      this.#onConfigUpdateBind,
    );
  }

  #syncEquipment() {
    const eq = this.game.systems.inventory.getEquipped();

    this.#rod = new Rod(
      eq.rod?.level || 1,
      eq.rod?.basePower || 1.0,
      eq.rod?.compensation || 0,
      eq.rod?.type || "float",
      eq.rod?.maxDistance || 100,
      eq.rod?.hasReel !== false,
    );

    this.#reel = eq.reel
      ? new Reel(
          eq.reel.level || 1,
          eq.reel.basePower || 1.0,
          eq.reel.hold || null,
        )
      : new Reel(0, 0, null);

    const activeHook = eq.hooks?.[0] || {};
    const hookLevel = activeHook.level || 1;
    const hookWeight = activeHook.weight || 1;
    const hookQuality = activeHook.quality || 1.0;
    const hook = new Hook(hookLevel, hookWeight, hookQuality);

    this.#fishingSystem.updateEquipment(this.#rod, this.#reel);
    this.#tensionMeter.updateEquipment(
      eq.rod?.level || 1,
      eq.reel?.level || 0,
      hook,
      CONFIG.tension,
    );
    this.#staminaController.updatePlayerPower(
      this.#rod.getPower() + this.#reel.getPower(),
    );

    if (window.DEBUG_MODULES && window.DEBUG_MODULES.forces) {
      console.log(
        "%c🔄 [DevTools] Характеристики снастей оновлено в реальному часі!",
        "color: #00ccff; font-weight: bold;",
      );
    }
  }

  update(dt, bounds, envData) {
    if (this.#tensionMeter.isBroken()) {
      this.game.setState("failed", {
        reason: this.#tensionMeter.getBreakReason(),
      });
      return;
    }

    const floatPos = this.game.float.getPosition();
    this.game.systems.projector.focusOnVirtualPos(floatPos.y, dt, 0.05);

    const fishForceRaw = this.#fishingSystem.calculateFishForce(
      dt,
      floatPos,
      bounds,
      CONFIG.stamina.mechanics,
      (vx, vy) => this.game.checkWater(vx, vy),
    );
    let tFishY = fishForceRaw.y;
    const activeHold = this.#fishingSystem.isHoldActive();

    if (activeHold && tFishY < 0) {
      tFishY = 0;
      fishForceRaw.y *= this.#fishingSystem.getHoldTensionMultiplier?.() || 1.0;
    }

    this.game.float.applyForce(
      this.#fishForceApplied
        .set(fishForceRaw.x, tFishY)
        .multiplyScalar(CONFIG.physics.fishForceMultiplier),
    );

    const input = this.game.systems.input.getState();
    const rodPos = this.game.getRodVirtualPos(bounds);
    const screenOffset = this.game.getScreenOffsetRatio(floatPos);

    const pF = this.#playerForce.set(0, 0);
    if (input.isPulling) {
      pF.copy(
        this.#fishingSystem.calculatePlayerForce(
          input.pullDirection,
          floatPos.x,
          floatPos.y,
          rodPos,
          screenOffset,
          CONFIG.physics,
          bounds,
        ),
      );
      this.#playerForceApplied
        .copy(pF)
        .multiplyScalar(CONFIG.physics.playerForceMultiplier);
      this.game.float.applyForce(this.#playerForceApplied);
    }

    this.#forces.pX = pF.x;
    this.#forces.pY = pF.y;
    this.#forces.fX = fishForceRaw.x;
    this.#forces.fY = fishForceRaw.y;

    const pMax = Math.abs(
      this.#fishingSystem.calculatePlayerForce(
        { x: 0, y: 1 },
        floatPos.x,
        floatPos.y,
        rodPos,
        screenOffset,
        CONFIG.physics,
        bounds,
      ).y * CONFIG.physics.playerForceMultiplier,
    );

    const fMag =
      Math.max(Math.abs(fishForceRaw.x), Math.abs(fishForceRaw.y)) *
      CONFIG.physics.fishForceMultiplier;

    this.#tensionMeter.update(
      input.isPulling,
      pMax,
      fMag,
      this.#fishingSystem.getReelPower(),
      fMag * 0.01,
      dt,
      CONFIG.tension,
      CONFIG.hookMechanics,
      activeHold,
    );

    this.#staminaController.evaluate(
      this.#tensionMeter.getTension(),
      input.isPulling,
      dt,
      floatPos.x,
      bounds,
    );

    let pullDirection = null;
    if (input.isPulling) {
      pullDirection = this.#pullDirection
        .set(rodPos.x - floatPos.x, rodPos.y - floatPos.y)
        .normalize();
    }

    this.game.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.game.checkWater(vx, vy),
      input,
      this.#fishingSystem.getReelPower(),
      pullDirection,
    );

    this.#isNetReady = this.game.net.isFloatInZone(floatPos.y, bounds.bottom);
    this.game.systems.ui.updateNetButtonState(
      this.#hasEquippedNet,
      this.#isNetReady,
    );

    const autoY =
      bounds.bottom -
      (CONFIG.locations.catchLineOffsetPx || 5) /
        this.game.systems.projector.getScale();

    if (
      floatPos.y >= this.game.net.getTriggerVirtualY(bounds.bottom) &&
      floatPos.y < autoY
    ) {
      this.#fishingSystem.tryTriggerFishLastDash?.(dt);
    }

    if (floatPos.y >= autoY) {
      this.game.setState("victory", { fish: this.data.fish });
    }
    this.game.holdUI.update(this.#fishingSystem.getHoldUIState());
  }

  handleNetClick() {
    if (!this.#isNetReady) return;

    const fishWeight = this.#fishingSystem.getFishWeight();
    const chance = this.game.net.calculateCatchChance(fishWeight);
    const roll = this.game.rng.range(0, 100);
    const success = roll <= chance;

    this.game.emitDebugEvent("netCatchRoll", {
      chance: chance,
      roll: roll,
      success: success,
    });

    this.game.setState(success ? "victory" : "failed", {
      reason: success ? null : "net_escape",
      fish: this.data.fish,
    });
  }

  handleInput(input) {
    const isHold = this.#fishingSystem.isHoldActive();
    const eq = this.game.systems.inventory.getEquipped();
    // 4. ВИПРАВЛЕНО: Безпечне читання параметрів котушки
    const swipeThreshold = eq.reel?.hold?.swipeThresholdPx || 100;

    if (this.#fishingSystem.getHoldUIState()?.hasHold) {
      if (input.toggleHold || input.swipeDeltaY > swipeThreshold) {
        isHold
          ? this.#fishingSystem.deactivateHold()
          : this.#fishingSystem.activateHold();
        if (input.swipeDeltaY) this.game.systems.input.consumeSwipe();
      }
    }

    if (input.pumpAction || input.swipeDeltaY < -swipeThreshold) {
      const red = this.#fishingSystem.tryUsePump(
        eq.reel?.pumpLevel || 0,
        eq.reel?.pumpPowerPerLevel || 10,
      );
      if (red > 0) this.#tensionMeter.applyPump(red);
      if (input.swipeDeltaY) this.game.systems.input.consumeSwipe();
    }
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "playing",
      this.#tensionMeter,
      this.#fishCondition,
      this.#startTime,
    );
  }

  getDebugData() {
    const fs = this.#fishingSystem;
    const sc = this.#staminaController;
    const floatPos = this.game.float.getPosition();
    const bounds = this.game.getDynamicBounds();
    const rodPos = this.game.getRodVirtualPos(bounds);
    const screenOffset = this.game.getScreenOffsetRatio(floatPos);

    const maxP = this.#fishingSystem.calculatePlayerForce(
      { x: 0, y: 1 },
      floatPos.x,
      floatPos.y,
      rodPos,
      screenOffset,
      CONFIG.physics,
      bounds,
    );

    const xRange = CONFIG.physics?.distanceXMultiplier || [1.0, 1.0];
    const boundsHeight = Math.max(1, bounds.bottom - bounds.top);
    const distRatio = Math.max(
      0,
      Math.min(1.0, (floatPos.y - bounds.top) / boundsHeight),
    );
    const depthScaleX = xRange[0] + distRatio * (xRange[1] - xRange[0]);

    const steerP =
      (this.#rod.getPower() + this.#reel.getPower()) *
      CONFIG.physics.playerSteeringMultiplier *
      CONFIG.physics.playerForceMultiplier *
      depthScaleX;

    return {
      playerForceY: Math.abs(this.#forces.pY || 0),
      playerForceX: Math.abs(this.#forces.pX || 0),
      fishForceY: Math.abs(this.#forces.fY || 0),
      fishForceX: Math.abs(this.#forces.fX || 0),

      playerMaxPowerY: Math.abs(maxP.y * CONFIG.physics.playerForceMultiplier),
      playerMaxPowerX: steerP,

      fishState: fs?.getCurrentState?.() || "idle",
      fishBasePower: fs?.getFishBasePower?.() || 0,
      fishInitialPower: fs?.getFishInitialPower?.() || 0,
      pullMult: fs?.getPullMultiplier?.() || 0,
      moveMult: fs?.getMoveMultiplier?.() || 0,
      activeDebuffName: fs?.getActiveDebuffName?.() || "Немає",

      masteryCurrentMult: fs?.getMasteryMultiplier?.() || 1.0,
      masteryTimerMs: sc?.getMasteryTimer?.() || 0,
      isMasteryActive: sc?.isMasteryActive?.() || false,
      exhaustionDurationMs: sc?.getExhaustionDurationMs?.() || 1000,

      hookedFish: this.data.fish,
      eq: this.game.systems.inventory.getEquipped(), // <-- ДОДАНО
    };
  }

  exit() {
    this.game.holdUI.update(null);
    this.game.systems.ui.hideNetButton();
    this.#removeConfigUpdateListener?.();
    this.#removeConfigUpdateListener = null;
  }
}

class WaitingState extends GameState {
  #effectiveInput = { isPulling: false, pullDirection: null };
  #pullDirection = new Vector2(0, 0);
  #baitIds = [];
  #baitTypes = [];

  enter() {
    this.game.systems.bite.reset();
  }

  handleInput(input) {
    if (input.isDoubleClick && this.game.canPlayerCast()) {
      this.game.setState("scouting");
    }

    const eq = this.game.systems.inventory.getEquipped();
    const isSpinning = eq?.rod?.type === "spinning";

    if (!isSpinning && input.longPressPos && this.game.canPlayerCast()) {
      const vPos = this.game.systems.projector.screenToVirtual(
        input.longPressPos.x,
        input.longPressPos.y,
      );

      const cell = this.game.checkWater(vPos.x, vPos.y);
      const bounds = this.game.getDynamicBounds(); // ДОДАНО: отримуємо межі екрану

      // === ДОДАНО: Перевірка максимальної дальності ===
      let rawDist = eq.rod?.maxDistance;
      let maxDist = rawDist === "max" || rawDist == null ? Infinity : rawDist;

      if (maxDist !== Infinity) {
        maxDist = Math.min(maxDist, bounds.bottom - bounds.top);
      }

      let isInside = true;
      if (maxDist !== Infinity) {
        const virtualLineY = bounds.bottom - maxDist;
        isInside = vPos.y >= virtualLineY;
      }
      // ================================================

      // ЗМІНЕНО: тепер перевіряємо і воду (cell), і дальність (isInside)
      if (cell && isInside) {
        this.game.castManager.registerCast(this.game.clock.now);
        this.game.castLine(vPos.x, vPos.y, cell.depth);

        this.game.fishing.consumeFeederChumIfNeeded(eq);
      } else {
        // Якщо клікнув на берег АБО занадто далеко — малюємо червоний хрестик
        this.game.invalidCastMarker = {
          x: input.longPressPos.x,
          y: input.longPressPos.y,
          timer: 500,
        };
      }
    }
  }

  update(dt, bounds, envData) {
    const pos = this.game.float.getPosition();
    this.game.systems.projector.focusOnVirtualPos(pos.y, dt, 0.05);

    const input = this.game.systems.input.getState();
    const eq = this.game.systems.inventory.getEquipped();

    const reelPower = eq?.reel ? eq.reel.basePower || 0 : 0;
    const isSpinning = eq?.rod?.type === "spinning";

    const effectiveInput = this.#effectiveInput;
    effectiveInput.isPulling = isSpinning ? input.isPulling : false;
    effectiveInput.pullDirection = input.pullDirection;

    let pullDirection = null;
    if (effectiveInput.isPulling) {
      const rodPos = this.game.getRodVirtualPos(bounds);
      pullDirection = this.#pullDirection
        .set(rodPos.x - pos.x, rodPos.y - pos.y)
        .normalize();
    }

    this.game.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.game.checkWater(vx, vy),
      effectiveInput,
      reelPower,
      pullDirection,
    );

    const updatedPos = this.game.float.getPosition();
    const shoreY =
      bounds.bottom -
      (CONFIG.locations.catchLineOffsetPx || 5) /
        this.game.systems.projector.getScale();

    if (updatedPos.y >= shoreY) {
      this.game.setState("scouting");
      return;
    }

    const baitIds = this.#baitIds;
    const baitTypes = this.#baitTypes;
    baitIds.length = 0;
    baitTypes.length = 0;

    this.game.fishing.collectAvailableBaits(
      eq,
      this.game.eatenBaits,
      baitIds,
      baitTypes,
    );

    let hooked = this.game.systems.bite.evaluateBite(dt, envData.biteEnv, {
      hookSize: eq?.hooks?.[0]?.level || eq?.baits?.[0]?.level || 1,
      baits: baitIds,
      baitTypes: baitTypes,
      isPulling: effectiveInput.isPulling,
    });

    if (hooked && CONFIG.debug?.fixedCatch?.enabled) {
      const fixed = CONFIG.debug.fixedCatch;
      const template =
        CONFIG.spawns.fishes.find((f) => f.id === fixed.fishId) ||
        CONFIG.spawns.fishes[0];

      const isActiveLure = this.game.fishing.hasActiveLureType(baitTypes);

      const chosenSequence = template.biteMechanics
        ? isActiveLure
          ? template.biteMechanics.active
          : template.biteMechanics.passive
        : null;

      hooked = {
        id: template.id,
        name: template.name + " (TEST)",
        physics: template.physics,
        level: fixed.level,
        weight: fixed.weight,
        resistance: fixed.resistance,
        biteSequence: chosenSequence,
      };
    }

    if (hooked) {
      this.game.float.startBite(effectiveInput.isPulling, hooked.biteSequence);
      this.game.setState("biting", { fish: hooked });
    }
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "waiting",
      null,
      null,
      this.game.castStartTime,
    );
  }
}

class BitingState extends GameState {
  #feederAudioPlayer;
  #lastStepId = -1;
  #ringQueue = [];
  #ringHead = 0;
  #stepTimeElapsed = 0;
  #pullDirection = new Vector2(0, 0);

  enter(data) {
    if (super.enter) super.enter();

    this.fish = data.fish;

    this.#lastStepId = -1;
    this.#ringQueue.length = 0;
    this.#ringHead = 0;
    this.#stepTimeElapsed = 0;

    const eq = this.game.systems.inventory.getEquipped();
    if (eq?.rod?.type === "feeder" && CONFIG.ui?.audio?.feederBite) {
      const src = CONFIG.ui.audio.feederBite;
      if (!this.#feederAudioPlayer || this.#feederAudioPlayer.src !== src) {
        this.#feederAudioPlayer?.dispose();
        this.#feederAudioPlayer = new BufferedAudioPlayer(src);
      }
      this.#feederAudioPlayer.warm().catch(() => {});
    } else {
      this.#feederAudioPlayer?.dispose();
      this.#feederAudioPlayer = null;
    }
  }

  exit() {
    this.#ringQueue.length = 0;
    this.#ringHead = 0;
  }

  handleInput(input) {
    const eq = this.game.systems.inventory.getEquipped();
    const isSpinning = eq?.rod?.type === "spinning";

    if (input.isPulling && !isSpinning) {
      if (!this.game.canPlayerCast()) return;

      const isGuaranteed = this.game.float.isGuaranteedBite();
      const success = this.game.rng.chance(isGuaranteed ? 0.99 : 0.01);

      if (success) {
        this.game.float.hook();
        if (
          this.game.systems.bite &&
          typeof this.game.systems.bite.hookFish === "function"
        ) {
          this.game.systems.bite.hookFish();
        }
        this.game.setState("playing", { fish: this.fish });
      } else {
        this.game.float.stopBite();
        this.game.setState("scouting");
      }
    }
  }

  update(dt, bounds, envData) {
    this.game.float.updateBite(dt, (vx, vy) => this.game.checkWater(vx, vy));

    const input = this.game.systems.input.getState();
    const pos = this.game.float.getPosition();
    this.game.systems.projector.focusOnVirtualPos(pos.y, dt, 0.05);

    const eq = this.game.systems.inventory.getEquipped();
    const isSpinning = eq?.rod?.type === "spinning";

    const reelPower = eq?.reel ? eq.reel.basePower || 0 : 0;

    let pullDirection = null;
    if (input.isPulling) {
      const rodPos = this.game.getRodVirtualPos(bounds);
      pullDirection = this.#pullDirection
        .set(rodPos.x - pos.x, rodPos.y - pos.y)
        .normalize();
    }

    this.game.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.game.checkWater(vx, vy),
      input,
      reelPower,
      pullDirection,
    );

    const stepInfo = this.game.float.getBiteStepInfo?.();
    if (isSpinning && stepInfo && stepInfo.isGuaranteed && input.isPulling) {
      this.game.float.hook();
      if (
        this.game.systems.bite &&
        typeof this.game.systems.bite.hookFish === "function"
      ) {
        this.game.systems.bite.hookFish();
      }
      this.game.setState("playing", { fish: this.fish });
      return;
    }

    // --- ЗМІНЕНО: Якщо риба втратила інтерес (не встигли підсікти) ---
    if (!this.game.float.isBiting()) {
      this.game.setState("waiting");
      return;
    }

    const updatedPos = this.game.float.getPosition();
    const shoreY =
      bounds.bottom -
      (CONFIG.locations.catchLineOffsetPx || 5) /
        this.game.systems.projector.getScale();
    if (updatedPos.y >= shoreY) {
      this.game.float.stopBite();
      this.game.setState("scouting");
      return;
    }

    // --- ЗМІНЕНО: Механіка ТАЄМНОЇ втрати наживки ---
    if (stepInfo) {
      if (stepInfo.id !== this.#lastStepId) {
        this.#lastStepId = stepInfo.id;

        if (stepInfo.isAction) {
          if (
            this.game.fishing.tryConsumeBaitDuringBite(
              eq,
              stepInfo,
              this.game.rng,
              CONFIG.physics,
            )
          ) {
            this.game.float.stopBite();
            this.game.setState("waiting");
            return;
          }

          if (this.#feederAudioPlayer) {
            this.#scheduleRings(stepInfo);
          }
        }
      }

      if (this.#feederAudioPlayer) {
        this.#processRingQueue(dt);
      }
    }
  }

  #scheduleRings(stepInfo) {
    this.#ringQueue.length = 0;
    this.#ringHead = 0;
    this.#stepTimeElapsed = 0;

    const cfg = CONFIG.feederConfig || {
      volumeNormal: 0.4,
      volumeGuaranteed: 1.0,
      guaranteedRings: [2, 3],
    };

    if (!stepInfo.isGuaranteed) {
      this.#ringQueue.push({
        startAt: 0,
        volume: cfg.volumeNormal,
      });
    } else {
      const minRings = cfg.guaranteedRings[0];
      const maxRings = cfg.guaranteedRings[1];
      const ringCount = this.game.rng.int(minRings, maxRings);

      const interval = stepInfo.duration / ringCount;

      for (let i = 0; i < ringCount; i++) {
        this.#ringQueue.push({
          startAt: i * interval,
          volume: cfg.volumeGuaranteed,
        });
      }
    }
  }

  #processRingQueue(dt) {
    if (this.#ringHead >= this.#ringQueue.length) return;

    this.#stepTimeElapsed += dt;

    while (
      this.#ringHead < this.#ringQueue.length &&
      this.#stepTimeElapsed >= this.#ringQueue[this.#ringHead].startAt
    ) {
      const currentRing = this.#ringQueue[this.#ringHead++];
      this.#playSound(currentRing.volume);
    }

    if (this.#ringHead >= this.#ringQueue.length) {
      this.#ringQueue.length = 0;
      this.#ringHead = 0;
    }
  }

  #playSound(volume) {
    this.#feederAudioPlayer?.play(volume);
  }

  dispose() {
    this.#feederAudioPlayer?.dispose();
    this.#feederAudioPlayer = null;
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "biting",
      null,
      null,
      this.game.castStartTime,
    );
  }
}

class FailedState extends GameState {
  enter(data) {
    if (super.enter) super.enter();
    this.game.systems.ui.updateContinueButtonState(true);

    const eq = this.game.systems.inventory.getEquipped();
    const reason = data?.reason;

    this.game.fishing.applyFailureEquipmentLoss(reason, eq);
  }

  exit() {
    this.game.systems.ui.updateContinueButtonState(false);
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "failed",
      null,
      null,
      0,
    );

    renderer.drawGameOver(
      window.innerWidth,
      window.innerHeight,
      this.data.reason,
    );
  }
}

class VictoryState extends GameState {
  enter(data) {
    this.data = data || {};
    this.game.systems.ui.updateContinueButtonState(true);
  }

  exit() {
    this.game.systems.ui.updateContinueButtonState(false);
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "victory",
      null,
      null,
      0,
    );

    renderer.drawVictory(window.innerWidth, window.innerHeight);
  }
}

class Game {
  #systems = {};
  #state = null;
  #gameStateName = "scouting";
  #canvas;
  #float;
  #net;
  #castManager;
  #depthUI;
  #timeUI;
  #holdUI;
  #hasEquippedNet = false;
  #location;
  #rng;
  #debugEvents = new DebugEventBridge(document, () => DevFlags.debugEvents());
  #clock = new GameClock();
  #listeners = new EventLifecycle();
  #loop;
  #world;
  #renderSystem;
  #fishingController;
  #chumController;
  #stateInstances = {};
  #pendingState = null;
  #isTransitioning = false;
  #dayOfWeek = new Date().getDay();
  #rodVirtualPos = new Vector2(0, 0);
  #screenScratch = new Vector2(0, 0);
  #screenScratch2 = new Vector2(0, 0);
  #stateUpdateContext = { env: null, biteEnv: null };
  #biteEnvData = {
    hookDepth: 0,
    bottomDepth: 0,
    lineLength: 0,
    timePhase: "day",
    dayOfWeek: 0,
    zoneBonus: 1,
    chumBonus: 1,
    chumTargets: [],
    isRaining: false,
    isFoggy: false,
    castSpamMultiplier: 1,
  };
  #debugCurrentBaits = [];
  eatenBaits = [];

  invalidCastMarker = null;
  castStartTime = 0;
  castDistanceRatio = 0;
  currentHookDepth = 1.0;
  lastTime = 0;

  constructor(canvasId) {
    this.#canvas = document.getElementById(canvasId);
    this.#canvas.width = window.innerWidth;
    this.#canvas.height = window.innerHeight;
    this.#loop = new GameLoop(
      this.#clock,
      (dt) => {
        this.update(dt);
        this.lastTime = this.#clock.now;
      },
      () => this.draw(),
    );

    this.#location = new LocationManager(
      CONFIG.locations,
      CONFIG.player?.locationId,
    );
    this.#rng = new SeededRng(CONFIG.debug?.seed ?? CONFIG.rng?.seed);

    const locId = this.#location.id;
    const locCfg = this.#location.config;

    const projectorInstance = new ViewportProjector(CONFIG.locations, locId);

    const inventoryManager = new InventoryManager(ITEM_DB, CONFIG.player);
    const eq = inventoryManager.getEquipped();

    // --- ДОДАНО: Формуємо міст між новим інвентарем та старою системою прикормки ---
    const chumConfigObj = {
      baits: {},
      deliveryMethods: {},
    };

    // Розгортаємо прикормки (витягуємо дані з engineStats у корінь об'єкта)
    if (typeof ITEM_DB !== "undefined" && ITEM_DB.chums) {
      for (const [key, item] of Object.entries(ITEM_DB.chums)) {
        chumConfigObj.baits[key] = { ...item, ...(item.engineStats || {}) };
      }
    }

    // Додаємо фоллбек для кораблика (щоб метод getBoatEnergy не крашився)
    if (typeof ITEM_DB !== "undefined" && ITEM_DB.deliveryMethods) {
      const firstBoatKey = Object.keys(ITEM_DB.deliveryMethods)[0];
      if (firstBoatKey) {
        const b = ITEM_DB.deliveryMethods[firstBoatKey];
        chumConfigObj.deliveryMethods.boat = { ...b, ...(b.engineStats || {}) };
      }
    }

    this.#systems = {
      renderer: new Renderer(this.#canvas),
      projector: projectorInstance,
      map: new LocationMap(locId, CONFIG.locations, this.#rng),
      env: new EnvironmentSystem(
        locCfg,
        CONFIG.debug?.initialTime ?? 12,
        this.#rng,
        CONFIG.spawns,
      ),
      input: new InputManager(this.#canvas, Number(CONFIG.ui?.rod?.x) || null),
      ui: new UIManager(CONFIG),

      // ВИПРАВЛЕНО: Передаємо наш новий зібраний об'єкт замість порожнього CONFIG.chum
      chum: new ChumManager(locId, chumConfigObj, projectorInstance, {
        rng: this.#rng,
        now: () => this.#clock.realNow,
      }),

      bite: new BiteSystem(CONFIG.spawns, {}, this.#rng),
      inventory: inventoryManager,
    };

    this.#systems.inventoryUI = new InventoryUI(this.#systems.inventory);
    this.#world = new GameWorld({
      systems: this.#systems,
      location: this.#location,
      canvas: this.#canvas,
      clock: this.#clock,
      config: CONFIG,
    });
    this.#renderSystem = new RenderSystem(this.#systems, CONFIG);
    this.#fishingController = new FishingController(this.#systems.inventory);

    this.#net = new Net(eq.net || { active: false, maxWeight: 0, length: 10 });

    this.#systems.inventory.onInventoryChanged((detail) =>
      this.#handleInventoryChanged(detail.equipment),
    );

    this.#castManager = new CastManager();
    this.#depthUI = new DepthSelectorUI();
    this.#timeUI = new TimeDisplayUI();
    this.#holdUI = new HoldChargesUI();
    this.#chumController = new ChumController({
      systems: this.#systems,
      fishing: this.#fishingController,
      location: this.#location,
      clock: this.#clock,
      depthUI: this.#depthUI,
      getDynamicBounds: () => this.getDynamicBounds(),
      getRodVirtualPos: (bounds) => this.getRodVirtualPos(bounds),
      checkWater: (vx, vy) => this.checkWater(vx, vy),
      markInvalidCast: (p) => this.markInvalidCast(p),
      canPlayerCast: () => this.canPlayerCast(),
      getGameStateName: () => this.#gameStateName,
    });

    this.#rebuildFloat();

    this.#initEvents();
    this.setState("scouting");
    this.start();
  }

  #handleInventoryChanged(newEq) {
    const netConfig = newEq.net
      ? { ...newEq.net, ...(newEq.net.engineStats || {}) }
      : { active: false, maxWeight: 0, length: 10, chances: [] };

    if (this.#net && typeof this.#net.updateConfig === "function") {
      this.#net.updateConfig(netConfig);
    } else {
      this.#net = new Net(netConfig);
    }

    this.#hasEquippedNet = !!newEq.net;
    this.#chumController?.refreshActiveHandChum();

    if (
      this.systems &&
      this.systems.ui &&
      typeof this.systems.ui.updateNetButtonState === "function"
    ) {
      this.systems.ui.updateNetButtonState(this.#hasEquippedNet, false);
    }

    if (this.#depthUI && typeof this.#depthUI.updateMax === "function") {
      this.#depthUI.updateMax(this.getMaxHookDepth());
    }
  }

  #rebuildFloat() {
    const eq = this.#systems.inventory.getEquipped();

    let physicsType = "float";
    let physicsConfig = {};

    if (
      eq.baits?.[0] &&
      ["spinner", "wobbler", "jig"].includes(eq.baits[0].type)
    ) {
      physicsType = eq.baits[0].type;
      physicsConfig = { ...eq.baits[0] };
    } else if (eq.float) {
      physicsType = "float";
      physicsConfig = { ...eq.float };
    } else if (eq.sinker) {
      physicsType = "float";
      physicsConfig = { ...eq.sinker };
    }

    this.#float = BaitFactory.create(
      physicsType,
      0,
      0,
      physicsConfig,
      eq,
      this.#rng,
    );
  }

  #initEvents() {
    this.#listeners.add(window, "resize", () => {
      this.#canvas.width = window.innerWidth;
      this.#canvas.height = window.innerHeight;
      this.#refreshViewport();
    });

    this.#systems.ui.onNetClick = () => {
      if (this.#state && typeof this.#state.handleNetClick === "function") {
        this.#state.handleNetClick();
      }
    };

    this.#systems.ui.onContinueClick = () => this.setState("scouting");
    this.#refreshViewport();

    // --- ВІДНОВЛЕНО: Слухач оновлень конфігу з DevTools ---
    this.#listeners.add(document, "config-updated", (e) => {
      if (e.detail && e.detail.path && e.detail.path[0] === "locations") {
        this.#refreshViewport(false);
        if (
          this.#systems.map &&
          typeof this.#systems.map.refreshConfig === "function"
        ) {
          // ВАЖЛИВО: Кажемо карті перечитати зони колізій і сітку!
          this.#systems.map.refreshConfig(CONFIG.locations);
        }
      }
    });
  }

  #refreshViewport(recalculateMap = true) {
    this.#world.refreshViewport(recalculateMap);
  }

  setState(name, data = {}) {
    if (this.#isTransitioning) {
      this.#pendingState = { name, data };
      return;
    }

    this.#isTransitioning = true;
    let next = { name, data };

    try {
      while (next) {
        this.#pendingState = null;
        if (this.#state) this.#state.exit();
        this.#gameStateName = next.name;

        if (this.#systems.inventory) {
          this.#systems.inventory.setLock(next.name !== "scouting");
        }

        this.#state = this.#getStateInstance(next.name);
        this.#state.enter(next.data);
        next = this.#pendingState;
      }
    } finally {
      this.#isTransitioning = false;
    }
  }

  #getStateInstance(name) {
    if (this.#stateInstances[name]) return this.#stateInstances[name];

    const states = {
      scouting: ScoutingState,
      waiting: WaitingState,
      biting: BitingState,
      playing: PlayingState,
      failed: FailedState,
      victory: VictoryState,
    };

    const StateClass = states[name];
    if (!StateClass) throw new Error(`Unknown game state: ${name}`);

    const state = new StateClass(this);
    this.#stateInstances[name] = state;
    return state;
  }

  update(dt) {
    const timeScale = CONFIG.debug?.timeScale || 1;
    const input = this.#systems.input.getState();
    const bounds = this.getDynamicBounds();

    const envSnapshot = this.#world.update(dt, timeScale, bounds);
    this.#castManager.update(dt);
    this.#timeUI.update(envSnapshot.time);
    this.updateChumUI();

    if (this.isAimingChum) {
      this.handleChumAiming(input, bounds);
    } else {
      this.handleGlobalBoatControl(input);
      this.#state.handleInput(input);
      const context = this.#stateUpdateContext;
      context.env = this.#systems.env.getPhysicsEnv();
      context.biteEnv = this.getEnvDataForBite();
      this.#state.update(dt, bounds, context);
    }

    if (this.invalidCastMarker) {
      this.invalidCastMarker.timer -= dt;
      if (this.invalidCastMarker.timer <= 0) this.invalidCastMarker = null;
    }

    this.#sendDebug();
  }

  draw() {
    const b = this.getDynamicBounds();
    const r = this.#renderSystem.drawWorld(
      this.invalidCastMarker,
      this.isDebugEnabled(),
    );

    this.#state.draw(r, b);
  }

  castLine(vx, vy, cellDepth) {
    const eq = this.#systems.inventory.getEquipped();

    // 1. ПЕРЕВІРКА ОБОВ'ЯЗКОВОГО СПОРЯДЖЕННЯ
    if (!eq.rod) {
      console.warn("❌ Відсутнє вудилище!");
      return;
    }

    // Перевіряємо, чи потрібна котушка (для pole/махових — ні)
    const needsReel =
      eq.rod.hasReel ?? eq.rod.engineStats?.hasReel ?? eq.rod.type !== "pole";
    if (needsReel && !eq.reel) {
      console.warn("❌ Для цього вудилища необхідна котушка!");
      return;
    }

    // 2. ПІДГОТОВКА ПАРАМЕТРІВ ЗАКИДАННЯ
    const rodPos = this.getRodVirtualPos(this.getDynamicBounds());
    const dist = Math.hypot(vx - rodPos.x, vy - rodPos.y);
    const maxDist = Math.max(1, Number(eq.rod.maxDistance) || 2000);

    this.castDistanceRatio = Math.min(1, dist / maxDist);
    this.castStartTime = this.#clock.now;

    const isFeeder = eq.rod.type === "feeder";
    if (isFeeder) {
      this.currentHookDepth = cellDepth;
    }

    // 3. ВИЗНАЧЕННЯ ТИПУ ФІЗИКИ ТА КОНФІГУ
    let physicsType = "float";
    let physicsConfig = {};

    // Пріоритет 1: Спінінгові приманки (перевіряємо просто по типу вудки)
    if (eq.rod.type === "spinning" && eq.baits?.[0]) {
      const baitStats = eq.baits[0].engineStats || eq.baits[0];
      // Беремо конкретний тип приманки (wobbler, spinner, jig)
      physicsType = baitStats.type || eq.baits[0].type || "spinner";
      physicsConfig = { ...baitStats };
    }
    // Пріоритет 2: Поплавок
    else if (eq.float) {
      physicsType = "float";
      physicsConfig = { ...eq.float.engineStats, ...eq.float };
    }
    // Пріоритет 3: Грузило/Фідер
    else if (eq.sinker) {
      physicsType = eq.rod.type === "feeder" ? "feeder" : "float";
      physicsConfig = { ...eq.sinker.engineStats, ...eq.sinker };
    }

    // 4. СТВОРЕННЯ ОБ'ЄКТА ПРИМАНКИ
    this.#float = BaitFactory.create(
      physicsType,
      vx,
      vy,
      physicsConfig,
      eq,
      this.#rng,
    );

    // 5. ЗАПУСК ФІЗИКИ
    if (typeof this.#float.cast === "function") {
      // Передаємо sinkerConfig. Якщо його немає — передаємо пустий об'єкт,
      // щоб FloatEntity.cast використав свої внутрішні дефолти і не крашнувся.
      const sinkerCfg = eq.sinker
        ? { ...eq.sinker.engineStats, ...eq.sinker }
        : null;

      this.#float.cast(
        vx,
        vy,
        this.currentHookDepth,
        this.currentHookDepth > cellDepth,
        sinkerCfg, // Передаємо null або об'єкт, FloatEntity має це обробити
        this.castDistanceRatio,
      );
    } else {
      this.#float.setPosition(vx, vy);
      if (typeof this.#float.setHookDepth === "function") {
        this.#float.setHookDepth(0.1);
      }
      if (typeof this.#float.stopBite === "function") {
        this.#float.stopBite();
      }
    }

    this.setState("waiting");
  }

  drawFishingElements(
    renderer,
    bottom, // Це наш віртуальний низ (vBot)
    state,
    tMeter, // Перейменував для зручності, щоб збігалося з кодом нижче
    fCond, // Перейменував
    startTime,
  ) {
    // 1. Отримуємо екіпірування ОДИН раз
    const eq = this.#systems.inventory.getEquipped();

    const floatPos = this.#float.getPosition();
    const sPos = this.#systems.projector.virtualToScreen(
      floatPos.x,
      floatPos.y,
      this.#screenScratch,
    );
    const elapsed = this.#clock.now - startTime;

    let ratio = 1.0,
      drop = 0;
    const lineCfg = CONFIG.ui.line;

    // Логіка розрахунку натягу ліски (Ratio/Drop)
    if (state === "waiting" || state === "biting") {
      const minDelay = lineCfg.distanceDelayMinMs ?? 1500;
      const maxDelay = lineCfg.distanceDelayMaxMs ?? 5000;
      const distanceDelay =
        minDelay + this.castDistanceRatio * (maxDelay - minDelay);

      const activeItem =
        (eq.rod?.type === "spinning" ? eq.baits?.[0] : eq.sinker) || {};
      const sinkRate =
        activeItem.sinkSpeed || activeItem.engineStats?.sinkSpeed || 1;

      const duration =
        (this.currentHookDepth / sinkRate) * 1000 + distanceDelay;
      const prog = duration > 0 ? Math.min(1, elapsed / duration) : 1;

      const easePower = lineCfg.shrinkEasePower ?? 4;
      const ease = 1 - Math.pow(1 - prog, easePower);

      ratio = 1.0 - ease * (1.0 - lineCfg.shrinkPercent / 100);
      drop = ease * (lineCfg.sinkDropPx || 120);

      const input = this.#systems.input.getState();
      if (input.isPulling) {
        ratio = 1.0;
        drop = 0;
      }
    } else if (state === "playing") {
      const baseSnap = lineCfg.snapDurationMs ?? 300;
      const depthRatio = Math.min(1, this.currentHookDepth / 10.0);
      const snapDuration =
        baseSnap *
        (1.0 + depthRatio * ((lineCfg.snapDepthMaxMultiplier ?? 2.0) - 1.0));

      const prog = snapDuration > 0 ? Math.min(1, elapsed / snapDuration) : 1;
      const ease = 1 - Math.pow(1 - prog, 3);
      const startR = lineCfg.shrinkPercent / 100;

      ratio = startR + ease * (1.0 - startR);
      drop = (lineCfg.sinkDropPx || 120) * (1 - ease);
    }

    // Розрахунок обмежень для ліски (щоб не провалилася крізь землю)
    const mapBottomScreenY = this.#systems.projector.virtualToScreen(
      0,
      bottom,
      this.#screenScratch2,
    ).y;
    const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
    const rodTopY = rodScreenY - 200;
    const distY = sPos.y - rodTopY;

    if (distY < 0) {
      const minRatio = (mapBottomScreenY - rodTopY) / distY;
      ratio = Math.max(ratio, minRatio);
    }

    const targetYAfterShrink = rodTopY + distY * ratio;
    const maxAllowedDrop = Math.max(0, mapBottomScreenY - targetYAfterShrink);
    drop = Math.min(drop, maxAllowedDrop);

    // --- МАЛЮВАННЯ ---

    renderer.drawCatchZone(
      this.#systems.projector,
      this.#net,
      bottom,
      CONFIG.locations,
      CONFIG.ui.catchZone,
    );

    renderer.drawRodLine(
      sPos,
      state,
      tMeter?.getTension() || 0,
      ratio,
      drop,
      CONFIG.ui.rod,
      lineCfg,
      this.#clock.now,
    );

    // ОСЬ ТУТ МИ ПЕРЕДАЄМО eq ПРАВИЛЬНО
    renderer.drawFloat(
      sPos,
      this.#float,
      eq.float || {},
      this.#systems.projector,
      eq,
    );

    if (state === "playing" && tMeter && fCond) {
      renderer.drawTensionBar(tMeter, CONFIG.tension, CONFIG.ui.indicators);
      renderer.drawFishCondition(fCond, CONFIG.ui.indicators);
    }
  }

  canPlayerCast() {
    const eq = this.#systems.inventory.getEquipped();

    if (!eq || !eq.rod) {
      return false;
    }

    const boat = this.#systems.chum.getBoats()[0];
    if (!boat) return true;
    if (boat.state === "drifting" || boat.state === "returning") return true;

    const boatItem = eq.delivery || {};
    const isManual = boatItem.manualControl ?? true;

    return !isManual && boat.remainingSections <= 0;
  }

  getDynamicBounds() {
    return this.#world.getDynamicBounds();
  }

  getMaxHookDepth() {
    const eq = this.#systems.inventory.getEquipped();

    if (eq.rod?.type === "spinning" && eq.baits?.[0]?.type === "jig") {
      return eq.baits[0].engineStats?.maxDepth ?? eq.baits[0].maxDepth ?? 8.0;
    }

    if (eq.sinker) {
      return eq.sinker.engineStats?.maxDepth ?? eq.sinker.maxDepth ?? 10.0;
    }

    return CONFIG.physics?.defaultDepthNoSinker ?? 0.1;
  }

  getRodVirtualPos(bounds) {
    const rodX =
      CONFIG.ui.rod.x === "center"
        ? this.#canvas.width / 2
        : Number(CONFIG.ui.rod.x);
    this.#systems.projector.screenToVirtual(rodX, 0, this.#rodVirtualPos);
    this.#rodVirtualPos.y = bounds.bottom;
    return this.#rodVirtualPos;
  }

  getScreenOffsetRatio(floatPos) {
    const sPos = this.#systems.projector.virtualToScreen(
      floatPos.x,
      floatPos.y,
      this.#screenScratch2,
    );
    const rodX =
      CONFIG.ui.rod.x === "center"
        ? this.#canvas.width / 2
        : Number(CONFIG.ui.rod.x);
    const halfWidth = Math.max(1, this.#canvas.width / 2);
    return Math.min(1, Math.abs(sPos.x - rodX) / halfWidth);
  }

  checkWater(vx, vy) {
    return this.#world.checkWater(vx, vy);
  }

  getEnvDataForBite() {
    const pos = this.#float.getPosition();
    const env = this.#systems.env.getSnapshot();
    const cell = this.checkWater(pos.x, pos.y);
    const chum = this.#systems.chum.getChumDataAt(pos.x, pos.y);
    const bottomDepth = cell?.depth || 0;

    let feederBonus = 1.0;
    let feederTargets = [];
    const eq = this.#systems.inventory.getEquipped();
    const isFeeder = eq?.rod?.type === "feeder";

    if (typeof this.#float.getChumBonus === "function" && eq?.feederChum) {
      const elapsedMs = this.#clock.now - this.castStartTime;
      const chumData = this.#float.getChumBonus(elapsedMs, eq.feederChum);
      feederBonus = chumData.bonus;
      feederTargets = chumData.targets;
    }

    const biteEnv = this.#biteEnvData;
    biteEnv.hookDepth = Math.min(
      this.#float.getCurrentHookDepth(),
      bottomDepth,
    );
    biteEnv.bottomDepth = bottomDepth;
    biteEnv.lineLength = isFeeder ? bottomDepth : this.currentHookDepth || 0.1;
    biteEnv.timePhase = env.phase;
    biteEnv.dayOfWeek = this.#dayOfWeek;
    biteEnv.zoneBonus = cell?.multiplier || cell?.bonus || 1.0;
    biteEnv.chumBonus = Math.max(chum?.bonus || 1.0, feederBonus);
    biteEnv.isRaining = env.isRaining;
    biteEnv.isFoggy = env.isFoggy;
    biteEnv.castSpamMultiplier = this.#castManager.getBiteChanceMultiplier();

    const targets = biteEnv.chumTargets;
    targets.length = 0;
    this.#appendUniqueTargets(targets, chum?.targets);
    this.#appendUniqueTargets(targets, feederTargets);

    return biteEnv;
  }

  #appendUniqueTargets(out, source) {
    if (!source) return;
    for (let i = 0; i < source.length; i++) {
      const target = source[i];
      let exists = false;
      for (let j = 0; j < out.length; j++) {
        if (out[j] === target) {
          exists = true;
          break;
        }
      }
      if (!exists) out.push(target);
    }
  }

  updateChumUI() {
    this.#chumController.updateUI();
  }

  handleChumClick() {
    this.#chumController.handleClick();
  }

  toggleChumAim() {
    this.#chumController.toggleAim();
  }

  handleChumAiming(input, bounds) {
    this.#chumController.handleAiming(input, bounds);
  }

  handleGlobalBoatControl(input) {
    this.#chumController.handleGlobalBoatControl(input);
  }

  get isAimingChum() {
    return this.#chumController?.isAiming || false;
  }

  set isAimingChum(value) {
    this.#chumController?.setAiming(value);
  }

  get activeBoat() {
    return this.#chumController?.activeBoat || null;
  }

  set activeBoat(boat) {
    if (this.#chumController) {
      this.#chumController.activeBoat = boat;
    }
  }

  markInvalidCast(p) {
    this.invalidCastMarker = { x: p.x, y: p.y, timer: 500 };
  }

  #sendDebug() {
    if (!CONFIG.debug?.overlay) return;

    const env = this.#systems.env.getSnapshot();
    const pos = this.#float.getPosition();
    const ed = this.getEnvDataForBite();

    const eq = this.#systems.inventory.getEquipped();
    const currentBaits = this.#debugCurrentBaits;
    currentBaits.length = 0;
    const equippedBaits = eq?.baits || [];
    for (let i = 0; i < equippedBaits.length; i++) {
      if (equippedBaits[i]?.id) currentBaits.push(equippedBaits[i].id);
    }
    const currentHookSize = eq?.hook?.level || 1;

    let detail = {
      gameState: this.#gameStateName,
      floatX: Math.round(pos.x),
      floatY: Math.round(pos.y),
      hookDepth: ed.hookDepth,
      bottomDepth: ed.bottomDepth,
      lineLength: ed.lineLength,
      baits: currentBaits,
      phase: env.phase,
      isRaining: env.isRaining,
      isFoggy: env.isFoggy,
      liveChances: this.#systems.bite.getLiveChances(ed, {
        hookSize: currentHookSize,
        baits: currentBaits,
      }),
      chumZones: this.#systems.chum?.getZones
        ? this.#systems.chum.getZones()
        : [],
    };

    const boats = this.#systems.chum?.getBoats() || [];
    const activeBoat = boats[0];
    const boatItem = eq.delivery || {};
    const boatHasSonar = boatItem.hasSonar ?? false;

    if (activeBoat && boatHasSonar && this.#gameStateName === "scouting") {
      const boatCell = this.checkWater(activeBoat.pos.x, activeBoat.pos.y);
      const boatChum = this.#systems.chum.getChumDataAt(
        activeBoat.pos.x,
        activeBoat.pos.y,
      );

      detail.isBoatSonar = true;
      detail.floatX = Math.round(activeBoat.pos.x);
      detail.floatY = Math.round(activeBoat.pos.y);
      detail.bottomDepth = boatCell?.depth || 0;

      const boatEd = {
        ...ed,
        bottomDepth: detail.bottomDepth,
        hookDepth: detail.bottomDepth,
        zoneBonus: boatCell?.multiplier || boatCell?.bonus || 1.0,
        chumBonus: boatChum.bonus || 1.0,
        chumTargets: boatChum.targets || [],
      };

      detail.liveChances = this.#systems.bite.getLiveChances(boatEd, {
        hookSize: currentHookSize,
        baits: currentBaits,
      });
    }

    if (this.#state && typeof this.#state.getDebugData === "function") {
      Object.assign(detail, this.#state.getDebugData());
    }

    this.emitDebugEvent("debug-live-update", detail);
  }

  start() {
    this.#loop.start();
  }

  stop() {
    this.#loop.stop();
  }

  dispose() {
    this.stop();
    if (this.#state) this.#state.exit();

    for (const state of Object.values(this.#stateInstances)) {
      state.dispose?.();
    }

    this.#systems.input?.dispose?.();
    this.#systems.chum?.dispose?.();
    this.#systems.inventory?.dispose?.();
    this.#listeners.dispose();
    this.#debugEvents.clear();
  }

  get gameStateName() {
    return this.#gameStateName;
  }
  get clock() {
    return this.#clock;
  }
  get rng() {
    return this.#rng;
  }
  get locationId() {
    return this.#location.id;
  }
  get chumCastDistance() {
    return this.#location.chumCastDistance;
  }
  isDebugEnabled() {
    return DevFlags.debugEvents();
  }
  addLifecycleListener(target, type, handler, options) {
    return this.#listeners.add(target, type, handler, options);
  }
  emitDebugEvent(type, detail) {
    this.#debugEvents.emit(type, detail);
  }
  onDebugEvent(type, handler) {
    return this.#debugEvents.on(type, handler);
  }
  get systems() {
    return this.#systems;
  }
  get float() {
    return this.#float;
  }
  get castManager() {
    return this.#castManager;
  }
  get fishing() {
    return this.#fishingController;
  }
  get depthUI() {
    return this.#depthUI;
  }
  get holdUI() {
    return this.#holdUI;
  }
  get net() {
    return this.#net;
  }
}

const game = new Game("gameCanvas");
if (typeof CacheManager !== "undefined" && CacheManager.printStorageUsage) {
  CacheManager.printStorageUsage();
}
