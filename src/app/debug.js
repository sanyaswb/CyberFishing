class DebugService {
  #config;
  #currentBaits = [];
  #currentBaitTypes = [];
  constructor(config) {
    this.#config = config;
  }

  update(context) {
    if (!this.#config.debug?.overlay) return;
    if (!context || typeof context.emitDebugEvent !== "function") return;
    context.emitDebugEvent("debug-live-update", this.#buildPayload(context));
  }

  #buildPayload(context) {
    const env = context.getEnvSnapshot();
    const pos = context.getFloatPosition();
    const ed = context.getBiteEnv();
    const eq = context.getEquipment();
    const input = context.getInputState?.() || {};
    const currentBaits = this.#currentBaits;
    const currentBaitTypes = this.#currentBaitTypes;
    currentBaits.length = 0;
    currentBaitTypes.length = 0;
    const equippedBaits = eq?.baits || [];
    for (let i = 0; i < equippedBaits.length; i++) {
      if (equippedBaits[i]?.id) currentBaits.push(equippedBaits[i].id);
      if (equippedBaits[i]?.type) currentBaitTypes.push(equippedBaits[i].type);
    }
    const currentHookSize = eq?.hooks?.[0]?.level || eq?.baits?.[0]?.level || 1;
    const detail = {
      gameState: context.getGameStateName(),
      floatX: Math.round(pos.x),
      floatY: Math.round(pos.y),
      hookDepth: ed.hookDepth,
      bottomDepth: ed.bottomDepth,
      lineLength: ed.lineLength,
      baits: currentBaits,
      phase: env.phase,
      isRaining: env.isRaining,
      isFoggy: env.isFoggy,
      liveChances: context.getLiveChances(ed, {
        hookSize: currentHookSize,
        baits: currentBaits,
        baitTypes: currentBaitTypes,
        isPulling: input.isPulling,
      }),
      chumZones: context.getChumZones(),
    };

    const activeBoat = context.getActiveBoat();
    const boatHasSonar = eq?.delivery?.hasSonar ?? false;
    if (activeBoat && boatHasSonar && detail.gameState === "scouting") {
      const boatCell = context.checkWater(activeBoat.pos.x, activeBoat.pos.y);
      const boatChum = context.getChumDataAt(
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
      detail.liveChances = context.getLiveChances(boatEd, {
        hookSize: currentHookSize,
        baits: currentBaits,
        baitTypes: currentBaitTypes,
        isPulling: false,
      });
    }

    const stateDebug = context.getStateDebugData();
    if (stateDebug) Object.assign(detail, stateDebug);
    return detail;
  }
}
