class BiteEnvironmentService {
  #world;
  #env;
  #chum;
  #inventory;
  #floatRef;
  #clock;
  #castManager;
  #equipmentRules;
  #getCurrentHookDepth;
  #getCastStartTime;
  #getDayOfWeek;
  #getTimeScale;
  #getGameStateName;
  #consumeExpiredFeederChum;
  #biteEnvData;

  constructor({
    world,
    env,
    chum,
    inventory,
    floatRef,
    clock,
    castManager,
    equipmentRules,
    getCurrentHookDepth,
    getCastStartTime,
    getDayOfWeek,
    getTimeScale,
    getGameStateName,
    consumeExpiredFeederChum,
    biteEnvData,
  }) {
    this.#world = world;
    this.#env = env;
    this.#chum = chum;
    this.#inventory = inventory;
    this.#floatRef = floatRef;
    this.#clock = clock;
    this.#castManager = castManager;
    this.#equipmentRules = equipmentRules;
    this.#getCurrentHookDepth = getCurrentHookDepth;
    this.#getCastStartTime = getCastStartTime;
    this.#getDayOfWeek = getDayOfWeek;
    this.#getTimeScale = getTimeScale;
    this.#getGameStateName = getGameStateName;
    this.#consumeExpiredFeederChum = consumeExpiredFeederChum;
    this.#biteEnvData = biteEnvData;
  }

  getDynamicBounds() {
    return this.#world.getDynamicBounds();
  }

  checkWater(vx, vy) {
    return this.#world.checkWater(vx, vy);
  }

  getBiteEnvData() {
    const floatEntity = this.#floatRef();
    const pos = floatEntity.getPosition();
    const env = this.#env.getSnapshot();
    const cell = this.checkWater(pos.x, pos.y);
    const chum = this.#chum.getChumDataAt(pos.x, pos.y);
    const bottomDepth = cell?.depth || 0;

    let feederBonus = 1.0;
    let feederTargets = [];
    const eq = this.#inventory.getEquipped();
    const isFeeder = this.#equipmentRules.isFeeder(eq);
    const isTackleInWater = this.#isTackleInWater();

    if (
      isTackleInWater &&
      typeof floatEntity.getChumBonus === "function" &&
      eq?.feederChum
    ) {
      const timeScale = this.#getTimeScale?.() || 1;
      const elapsedMs =
        Math.max(0, this.#clock.now - this.#getCastStartTime()) * timeScale;
      const chumData = floatEntity.getChumBonus(elapsedMs, eq.feederChum);
      if (chumData.isExpired) {
        this.#consumeExpiredFeederChum?.(eq);
      } else {
        feederBonus = chumData.bonus;
        feederTargets = chumData.targets;
      }
    }

    const zoneBonus = chum?.bonus || 1.0;
    const zoneTargets = chum?.targets || [];
    let selectedChumBonus = zoneBonus;
    let selectedChumTargets = zoneTargets;

    if (feederTargets.length > 0) {
      if (zoneTargets.length === 0 || feederBonus > zoneBonus) {
        selectedChumBonus = feederBonus;
        selectedChumTargets = feederTargets;
      }
    }

    const hookDepth =
      typeof floatEntity.getEffectiveHookDepth === "function"
        ? floatEntity.getEffectiveHookDepth(bottomDepth)
        : Math.min(floatEntity.getCurrentHookDepth(), bottomDepth);
    const lineLength =
      typeof floatEntity.getEffectiveLineLength === "function"
        ? floatEntity.getEffectiveLineLength(bottomDepth)
        : hookDepth;

    const biteEnv = this.#biteEnvData;
    biteEnv.locationId = this.#world.currentLocationId;
    biteEnv.hookDepth = hookDepth;
    biteEnv.bottomDepth = bottomDepth;
    biteEnv.lineLength = isFeeder
      ? lineLength
      : this.#getCurrentHookDepth() || 0.1;
    biteEnv.timePhase = env.phase;
    biteEnv.dayOfWeek = this.#getDayOfWeek();
    biteEnv.zoneBonus = cell?.multiplier || cell?.bonus || 1.0;
    biteEnv.chumBonus = selectedChumBonus;
    biteEnv.isRaining = env.isRaining;
    biteEnv.isFoggy = env.isFoggy;
    biteEnv.castSpamMultiplier = this.#castManager.getBiteChanceMultiplier();

    const targets = biteEnv.chumTargets;
    targets.length = 0;
    this.#appendUniqueTargets(targets, selectedChumTargets);
    return biteEnv;
  }

  #isTackleInWater() {
    const stateName = this.#getGameStateName?.();
    return (
      stateName === "waiting" ||
      stateName === "biting" ||
      stateName === "playing"
    );
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
}
