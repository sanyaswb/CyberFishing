class WorstCaseForceDebugSelector {
  #configSource;

  constructor({ configSource = () => CONFIG } = {}) {
    this.#configSource = configSource;
  }

  select(data) {
    const activeFish = data?.hookedFish;
    if (!activeFish) return null;

    const config = this.#safeConfig();
    const fightPhysicsConfig = config?.fightPhysicsConfig || null;
    const currentFishBase = Number(data.fishPassiveKg ?? data.fishBasePower) || 0;
    const { maxPull, maxMove } = this.#selectWorstBehaviorMultipliers(
      data.fishRuntimeBehaviorStates ||
        activeFish.physics?.behaviorProfile?.behaviors ||
        activeFish.physics?.behaviors ||
        {},
    );
    const effectiveTackleLoadKg = this.#selectEffectiveTackleLoadKg(
      data.equipment || data.eq || {},
      fightPhysicsConfig,
    );
    const worstAnglePenaltyMultiplier = this.#selectWorstAnglePenaltyMultiplier(
      fightPhysicsConfig,
    );
    const playerSteeringMultiplier =
      Number(fightPhysicsConfig?.getPlayerSteeringMultiplier?.()) || 1.5;

    return {
      worstFishX: currentFishBase * maxMove,
      playerSteerMin:
        effectiveTackleLoadKg *
        worstAnglePenaltyMultiplier *
        playerSteeringMultiplier,
      maxPossibleForceY: currentFishBase * maxPull,
      worstPlayerY: effectiveTackleLoadKg * worstAnglePenaltyMultiplier,
    };
  }

  #safeConfig() {
    try {
      return this.#configSource?.() || null;
    } catch (error) {
      console.warn("[WorstCaseForceDebugSelector] Config source failed", error);
      return null;
    }
  }

  #selectWorstBehaviorMultipliers(behaviors) {
    let maxPull = 0;
    let maxMove = 0;

    for (const behavior of Object.values(behaviors || {})) {
      const forceMultiplier = Number(behavior?.forceMultiplier) || 0;
      const speedMultiplier = Math.abs(Number(behavior?.speedMultiplier) || 0);
      if (forceMultiplier > maxPull) maxPull = forceMultiplier;
      if (speedMultiplier > maxMove) maxMove = speedMultiplier;
    }

    return { maxPull, maxMove };
  }

  #selectEffectiveTackleLoadKg(equipment, fightPhysicsConfig) {
    const loads = [];
    this.#pushFinitePositive(loads, this.#effectiveLoad(equipment.rod, 0));

    const hasReel =
      equipment.rod?.effectiveStats?.hasReel !== false && !!equipment.reel;
    if (hasReel) {
      this.#pushFinitePositive(loads, this.#effectiveLoad(equipment.reel, 0));
      this.#pushFinitePositive(loads, this.#effectiveLoad(equipment.reel?.line, 0));
    } else {
      this.#pushFinitePositive(
        loads,
        fightPhysicsConfig?.getLineConfig?.()?.defaultMaxLoadKg ?? 0,
      );
    }

    return loads.length ? Math.min(...loads) : 0;
  }

  #effectiveLoad(item, fallback = 0) {
    const maxLoad = Number(item?.effectiveStats?.maxLoadKg ?? fallback);
    const durability = Number(item?.effectiveStats?.durability ?? 100);
    const lossPerPercent = Number(
      item?.effectiveStats?.durabilityMaxLoadLossPerPercent ?? 0.001,
    );

    if (!Number.isFinite(maxLoad) || maxLoad <= 0) return fallback;

    return (
      maxLoad *
      Math.max(0.1, 1 - Math.max(0, 100 - durability) * lossPerPercent)
    );
  }

  #selectWorstAnglePenaltyMultiplier(fightPhysicsConfig) {
    const angleConfig = fightPhysicsConfig?.getRodAnglePenaltyConfig?.() || {};
    if (angleConfig.enabled === false) return 1.0;
    return Number(angleConfig.maxPenaltyMultiplier) || 0.65;
  }

  #pushFinitePositive(target, value) {
    const normalizedValue = Number(value);
    if (Number.isFinite(normalizedValue) && normalizedValue > 0) {
      target.push(normalizedValue);
    }
  }
}

window.WorstCaseForceDebugSelector = WorstCaseForceDebugSelector;
