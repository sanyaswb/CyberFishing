export class GameFishingFacade {
  #inventory;
  #chum;
  #playerCastRules;
  #equipmentRules;
  #config;
  #castService;
  #biteEnvironmentService;
  #getCurrentHookDepth;
  #setCurrentHookDepth;
  #setFloat;
  #setCastDistanceRatio;
  #setCastStartTime;
  #setState;

  constructor({
    inventory,
    chum,
    playerCastRules,
    equipmentRules,
    config,
    castService,
    biteEnvironmentService,
    getCurrentHookDepth,
    setCurrentHookDepth,
    setFloat,
    setCastDistanceRatio,
    setCastStartTime,
    setState,
  }) {
    this.#inventory = inventory;
    this.#chum = chum;
    this.#playerCastRules = playerCastRules;
    this.#equipmentRules = equipmentRules;
    this.#config = config;
    this.#castService = castService;
    this.#biteEnvironmentService = biteEnvironmentService;
    this.#getCurrentHookDepth = getCurrentHookDepth;
    this.#setCurrentHookDepth = setCurrentHookDepth;
    this.#setFloat = setFloat;
    this.#setCastDistanceRatio = setCastDistanceRatio;
    this.#setCastStartTime = setCastStartTime;
    this.#setState = setState;
  }

  castLine(vx, vy, cellDepth, options = {}) {
    const result = this.#castService.cast(vx, vy, cellDepth, {
      equipment: this.#inventory.getEquipped(),
      currentHookDepth: this.#getCurrentHookDepth(),
      rodVirtualPos: options.rodVirtualPos || null,
    });
    if (!result.success) return result;

    this.#setFloat(result.floatEntity);
    this.#setCastDistanceRatio(result.castDistanceRatio);
    this.#setCastStartTime(result.castStartTime);
    this.#setCurrentHookDepth(result.currentHookDepth);
    this.#setState(result.nextState);
    return result;
  }

  canPlayerCast() {
    const equipment = this.#inventory.getEquipped();
    const activeBoat = this.#chum.getBoats()[0] || null;
    return this.#playerCastRules.canPlayerCast(equipment, activeBoat);
  }

  getMaxHookDepth() {
    return this.#equipmentRules.getMaxHookDepth(
      this.#inventory.getEquipped(),
      this.#config,
    );
  }

  getEnvDataForBite() {
    return this.#biteEnvironmentService.getBiteEnvData();
  }
}
