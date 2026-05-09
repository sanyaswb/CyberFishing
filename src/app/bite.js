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

    if (typeof floatEntity.getChumBonus === "function" && eq?.feederChum) {
      const elapsedMs = this.#clock.now - this.#getCastStartTime();
      const chumData = floatEntity.getChumBonus(elapsedMs, eq.feederChum);
      feederBonus = chumData.bonus;
      feederTargets = chumData.targets;
    }

    const biteEnv = this.#biteEnvData;
    biteEnv.hookDepth = Math.min(
      floatEntity.getCurrentHookDepth(),
      bottomDepth,
    );
    biteEnv.bottomDepth = bottomDepth;
    biteEnv.lineLength = isFeeder
      ? bottomDepth
      : this.#getCurrentHookDepth() || 0.1;
    biteEnv.timePhase = env.phase;
    biteEnv.dayOfWeek = this.#getDayOfWeek();
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
}
