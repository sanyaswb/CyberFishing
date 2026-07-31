class BiteSystem {
  #fishDatabase;
  #tickRate;
  #timer;
  #overDepthPenaltyMult;
  #passivePullBiteChanceMultiplier;
  #lineConfig;
  #runtimeConfig;
  #guaranteedBiteCooldownRange;
  #guaranteedBiteCooldownRemaining = 0;
  #cooldownDebugTimer = 0;
  #possibleBitesBuffer;
  #possibleBiteChancesBuffer;
  #rng;
  #debugEvents;
  #fishRarityResolver;
  #tickIndex = 0;

  constructor(
    biteConfig,
    runtimeConfig,
    rng = null,
    debugEvents = null,
    fishRarityResolver = null,
  ) {
    if (
      !fishRarityResolver ||
      typeof fishRarityResolver.resolve !== "function"
    ) {
      throw new TypeError("BiteSystem requires fishRarityResolver");
    }
    const physicsConfig = this.#resolvePhysicsConfig(runtimeConfig);
    const lineConfig = runtimeConfig?.ui?.line || runtimeConfig?.line || {};
    this.#runtimeConfig = runtimeConfig || {};
    this.#fishDatabase = this.#resolveFishDatabase(biteConfig);
    this.#tickRate = biteConfig?.tickRateMs ?? 1000;
    this.#timer = 0;
    this.#overDepthPenaltyMult = physicsConfig?.overDepthPenaltyMult || 0.5;
    this.#lineConfig = lineConfig;
    this.#passivePullBiteChanceMultiplier =
      lineConfig?.passivePullBiteChanceMultiplier ?? 1.0;
    this.#guaranteedBiteCooldownRange =
      physicsConfig?.getLureRetrieveConfig?.()?.guaranteedBiteCooldownMs ||
      [2000, 15000];
    this.#possibleBitesBuffer = [];
    this.#possibleBiteChancesBuffer = [];
    this.#rng = rng || { next: () => Math.random() };
    this.#debugEvents = debugEvents || null;
    this.#fishRarityResolver = fishRarityResolver;
  }

  setFishDatabase(fishDatabase) {
    this.#fishDatabase = this.#resolveFishDatabase(fishDatabase);
  }

  #resolvePhysicsConfig(runtimeConfig) {
    if (runtimeConfig?.fightPhysicsConfig) return runtimeConfig.fightPhysicsConfig;
    if (typeof FightPhysicsConfigAdapter !== "undefined") {
      return new FightPhysicsConfigAdapter(runtimeConfig);
    }
    return null;
  }

  reset() {
    this.#timer = 0;
    this.#cooldownDebugTimer = 0;
    this.#tickIndex = 0;
  }

  #resolveFishDatabase(source) {
    if (Array.isArray(source)) return source;
    if (Array.isArray(source?.fishes)) return source.fishes;
    return [];
  }

  #lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }

  #clamp01(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(1, parsed));
  }

  #getGodModeConfig() {
    const godMode = this.#runtimeConfig?.debug?.godMode || null;
    return godMode?.enabled ? godMode : null;
  }

  #clampChance(chance) {
    return this.#clamp01(chance);
  }

  #applyGodModeChanceOverride(chance) {
    const godMode = this.#getGodModeConfig();
    if (!godMode?.fixedBiteChanceEnabled) return this.#clampChance(chance);

    const percent = Number(godMode.fixedBiteChancePercent);
    const normalized = Number.isFinite(percent) ? percent / 100 : 1;
    return this.#clampChance(normalized);
  }

  #applyGodModeBiteSequence(sequence) {
    if (!sequence) return sequence;

    const godMode = this.#getGodModeConfig();
    const mode = String(godMode?.biteSequenceMode || "default").toLowerCase();
    if (mode !== "guaranteed" && mode !== "normal") return sequence;

    return {
      ...sequence,
      chanceGuaranteed: mode === "guaranteed" ? 1.0 : 0.0,
      chanceNormal: mode === "guaranteed" ? 0.0 : 1.0,
    };
  }

  #getDepthRatio(hookDepth, depthConfig) {
    const range = depthConfig.maxDepth - depthConfig.minDepth;
    if (!Number.isFinite(range) || range <= 0) return 0;
    return this.#clamp01((hookDepth - depthConfig.minDepth) / range);
  }

  #getDepthChanceMultiplier(hookDepth, depthConfig) {
    const maxDepthMultiplier = Number.isFinite(depthConfig.chanceMultAtMaxDepth)
      ? depthConfig.chanceMultAtMaxDepth
      : 1.0;
    return this.#lerp(
      1.0,
      maxDepthMultiplier,
      this.#getDepthRatio(hookDepth, depthConfig),
    );
  }

  #hasActiveLureType(baitTypes) {
    const types = Array.isArray(baitTypes) ? baitTypes : [];
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      if (type === "spinner" || type === "wobbler" || type === "jig") {
        return true;
      }
    }
    return false;
  }

  #resolveLevelBasePower(weightConfig, level) {
    const ranges = weightConfig?.levelWeightRanges;
    if (!Array.isArray(ranges)) return 1;

    const match = ranges.find(
      (range) => Number(range?.level) === Number(level),
    );
    return Number.isFinite(Number(match?.basePower))
      ? Math.max(0, Number(match.basePower))
      : 1;
  }

  #resolveLevelAverageWeightKg(weightConfig, level, depthConfig = null) {
    const ranges = weightConfig?.levelWeightRanges;
    const match = Array.isArray(ranges)
      ? ranges.find((range) => Number(range?.level) === Number(level))
      : null;
    const rangeMin = Number(match?.min);
    const rangeMax = Number(match?.max);
    if (Number.isFinite(rangeMin) && Number.isFinite(rangeMax)) {
      return (Math.min(rangeMin, rangeMax) + Math.max(rangeMin, rangeMax)) / 2;
    }

    const maxLevel = Math.max(1, Math.round(Number(weightConfig?.maxLevel) || 1));
    const currentLevel = Math.max(1, Math.round(Number(level) || 1));
    const globalMin = Number(depthConfig?.minWeightAtMinDepth);
    const globalMax = Number(depthConfig?.maxWeightAtMaxDepth);
    if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) return null;

    const low = Math.min(globalMin, globalMax);
    const high = Math.max(globalMin, globalMax);
    const step = (high - low) / maxLevel;
    return low + step * (currentLevel - 0.5);
  }

  #buildFishPhysics(fishPhysics, weightConfig, level) {
    const levelBasePower = this.#resolveLevelBasePower(weightConfig, level);
    if (typeof FishPhysicsProfile !== "undefined") {
      return FishPhysicsProfile.toRuntimeConfig(fishPhysics || {}, {
        levelBasePower,
      });
    }

    return {
      ...(fishPhysics || {}),
      levelBasePower,
    };
  }

  #next() {
    return this.#rng.next();
  }

  #chance(probability) {
    return this.#rollChance(probability).success;
  }

  #rollChance(probability) {
    const normalized = this.#clamp01(probability);
    const roll = this.#next();
    return {
      probability: normalized,
      roll,
      success: roll < normalized,
    };
  }

  #formatPercent(value) {
    return `${(this.#clamp01(value) * 100).toFixed(2)}%`;
  }

  #emitDebugEvent(type, detail) {
    if (!this.#debugEvents || typeof this.#debugEvents.emit !== "function")
      return;
    this.#debugEvents.emit(type, detail);
  }

  #buildGodModeDebug() {
    const godMode = this.#getGodModeConfig();
    if (!godMode) return null;
    return {
      enabled: true,
      fixedBiteChanceEnabled: godMode.fixedBiteChanceEnabled === true,
      fixedBiteChancePercent: godMode.fixedBiteChancePercent,
      biteSequenceMode: godMode.biteSequenceMode || "default",
    };
  }

  #int(min, max) {
    return typeof this.#rng.int === "function"
      ? this.#rng.int(min, max)
      : Math.floor(min + this.#next() * (max - min + 1));
  }

  #updateGuaranteedBiteCooldown(dt) {
    if (this.#guaranteedBiteCooldownRemaining <= 0) return false;
    this.#guaranteedBiteCooldownRemaining = Math.max(
      0,
      this.#guaranteedBiteCooldownRemaining - dt,
    );
    return this.#guaranteedBiteCooldownRemaining > 0;
  }

  #startGuaranteedBiteCooldown() {
    const range = this.#guaranteedBiteCooldownRange;
    const rawMin = Array.isArray(range) ? range[0] : 2000;
    const rawMax = Array.isArray(range) ? range[1] : rawMin;
    let min = Number.isFinite(rawMin) ? rawMin : 2000;
    let max = Number.isFinite(rawMax) ? rawMax : min;

    if (max < min) {
      const swap = min;
      min = max;
      max = swap;
    }

    min = Math.max(0, Math.floor(min));
    max = Math.max(min, Math.floor(max));
    this.#guaranteedBiteCooldownRemaining =
      min === max ? min : this.#int(min, max);
    return this.#guaranteedBiteCooldownRemaining;
  }

  #calculateFishChance(fish, envData, playerGear) {
    const dc = fish.depthConfig;
    const hookDepth = envData.hookDepth;

    if (playerGear.hookSize > fish.maxHookSize) return 0;
    if (hookDepth < dc.minDepth || hookDepth > dc.maxDepth) return 0;

    const baitsToTest = Array.isArray(playerGear.baits)
      ? playerGear.baits
      : [playerGear.baitId];

    let maxBaitMult = 0;
    for (let i = 0; i < baitsToTest.length; i++) {
      const mult = fish.baitMultipliers[baitsToTest[i]] || 0;
      if (mult > maxBaitMult) maxBaitMult = mult;
    }

    if (maxBaitMult === 0) return 0;

    let chance = fish.baseChance * maxBaitMult;

    chance *= fish.timeMultipliers[envData.timePhase] || 1.0;
    chance *= fish.dayMultipliers[envData.dayOfWeek] || 1.0;
    chance *= envData.zoneBonus || 1.0;

    if (envData.chumBonus > 1.0 && envData.chumTargets?.includes(fish.id)) {
      chance *= envData.chumBonus;
    }

    if (envData.isRaining) chance *= fish.weatherMultipliers?.rain ?? 1.0;
    if (envData.isFoggy) chance *= fish.weatherMultipliers?.fog ?? 1.0;

    chance *= envData.castSpamMultiplier ?? 1.0;

    if (envData.lineLength > envData.bottomDepth) {
      chance *= this.#overDepthPenaltyMult;
    }

    if (
      playerGear.isPulling &&
      !this.#hasActiveLureType(playerGear.baitTypes)
    ) {
      chance *=
        this.#lineConfig?.passivePullBiteChanceMultiplier ??
        this.#passivePullBiteChanceMultiplier;
    }

    chance *= this.#getDepthChanceMultiplier(hookDepth, dc);

    return this.#applyGodModeChanceOverride(chance);
  }

  #generateFishInstance(fish, currentDepth, playerGear) {
    // <-- ДОДАНО playerGear
    const { depthConfig: dc, weightConfig: wc } = fish;

    let t = Math.max(
      0,
      Math.min(1, (currentDepth - dc.minDepth) / (dc.maxDepth - dc.minDepth)),
    );

    const curMinW = this.#lerp(
      dc.minWeightAtMinDepth,
      dc.minWeightAtMaxDepth,
      t,
    );
    const curMaxW = this.#lerp(
      dc.maxWeightAtMinDepth,
      dc.maxWeightAtMaxDepth,
      t,
    );

    const genWeight =
      curMinW + (curMaxW - curMinW) * Math.pow(this.#next(), wc.rarityCurve);
    // --- ДОДАНО: Логіка вибору профілю клювання ---
    const baitsToTest = Array.isArray(playerGear.baits)
      ? playerGear.baits
      : [playerGear.baitId];
    const baitId = baitsToTest[0] || "oil_worm";

    // --- ВИПРАВЛЕНО: Логіка вибору профілю клювання ---
    // Беремо типи прямо з переданих даних гравця
    const baitTypes = playerGear.baitTypes || ["float"];
    const isActiveLure = this.#hasActiveLureType(baitTypes);

    let chosenBiteSequence = null;
    if (fish.biteMechanics) {
      chosenBiteSequence = isActiveLure
        ? fish.biteMechanics.active
        : fish.biteMechanics.passive;
      chosenBiteSequence = this.#applyGodModeBiteSequence(chosenBiteSequence);
    }

    const rarityProfile = this.#fishRarityResolver.resolve({
      weightKg: genWeight,
      weightConfig: wc,
      depthConfig: dc,
      rarityProfile: fish.rarityProfile,
      baseAnomaly: fish.anomaly,
    });
    const { level, maxLevel, isUnique, anomaly, rarity } = rarityProfile;
    const levelAverageWeightKg = this.#resolveLevelAverageWeightKg(wc, level, dc);
    const trophyWeight = fish.trophyWeightKg ?? fish.trophyWeight ?? null;

    return {
      id: fish.id,
      name: fish.name,
      weight: genWeight,
      level,
      maxLevel,
      levelAverageWeightKg,
      physics: this.#buildFishPhysics(fish.physics, wc, level),
      biteSequence: chosenBiteSequence,
      imagePath: this.#resolveFishImagePath(fish, level, isUnique),
      isUnique,
      isTrophy: trophyWeight !== null ? genWeight >= trophyWeight : false,
      anomaly,
      rarity,
    };
  }

  #resolveFishImagePath(fish, level, isUnique = false) {
    const uniqueImagePath = fish.visual?.uniqueImagePath;
    if (isUnique && typeof uniqueImagePath === "string" && uniqueImagePath) {
      return uniqueImagePath;
    }
    const pattern = fish.visual?.imagePattern;
    if (typeof pattern === "string") {
      return pattern.replace("{level}", level);
    }
    return `assets/fish/${fish.id}/${fish.id}--${level}.webp`;
  }

  evaluateBite(dt, envData, playerGear) {
    const cooldownBeforeMs = this.#guaranteedBiteCooldownRemaining;
    if (this.#updateGuaranteedBiteCooldown(dt)) {
      this.#cooldownDebugTimer += dt;
      if (this.#cooldownDebugTimer >= this.#tickRate) {
        this.#cooldownDebugTimer -= this.#tickRate;
        this.#tickIndex++;
        this.#emitDebugEvent("debug-bite-tick", {
          mode: "WAITING",
          tickIndex: this.#tickIndex,
          tickRateMs: this.#tickRate,
          result: "COOLDOWN",
          checkedFishCount: 0,
          cooldown: {
            active: true,
            beforeMs: cooldownBeforeMs,
            afterMs: this.#guaranteedBiteCooldownRemaining,
            reason: "guaranteed_bite_cooldown",
          },
          godMode: this.#buildGodModeDebug(),
        });
      }
      return null;
    }
    this.#cooldownDebugTimer = 0;

    this.#timer += dt;
    if (this.#timer < this.#tickRate) return null;
    this.#timer -= this.#tickRate;
    this.#tickIndex++;

    this.#possibleBitesBuffer.length = 0;
    this.#possibleBiteChancesBuffer.length = 0;

    const fishRolls = [];

    for (let i = 0; i < this.#fishDatabase.length; i++) {
      const fish = this.#fishDatabase[i];
      const chance = this.#calculateFishChance(fish, envData, playerGear);
      const rollResult = chance > 0 ? this.#rollChance(chance) : null;
      const success = rollResult ? rollResult.success : false;

      fishRolls.push({
        id: fish.id,
        name: fish.name,
        chance,
        chancePercent: this.#formatPercent(chance),
        roll: rollResult ? rollResult.roll : null,
        rollPercent: rollResult ? this.#formatPercent(rollResult.roll) : "—",
        result: success ? "КЛЮНУЛО" : "НЕ КЛЮНУЛО",
        skipped: chance <= 0,
      });

      if (success) {
        this.#possibleBitesBuffer.push(fish);
        this.#possibleBiteChancesBuffer.push(chance);
      }
    }

    let selected = null;
    let selectedChance = 0;
    let selectedIndex = -1;
    let cooldownStartedMs = 0;

    if (this.#possibleBitesBuffer.length > 0) {
      selectedIndex = this.#int(0, this.#possibleBitesBuffer.length - 1);
      selected = this.#possibleBitesBuffer[selectedIndex];
      selectedChance = this.#possibleBiteChancesBuffer[selectedIndex];
      if (selectedChance >= 1.0) {
        cooldownStartedMs = this.#startGuaranteedBiteCooldown();
      }
    }

    this.#emitDebugEvent("debug-bite-tick", {
      mode: "WAITING",
      tickIndex: this.#tickIndex,
      tickRateMs: this.#tickRate,
      result: selected ? "КЛЮНУЛО" : "НЕ КЛЮНУЛО",
      checkedFishCount: this.#fishDatabase.length,
      fishRolls,
      bitesCount: this.#possibleBitesBuffer.length,
      selectedFish: selected
        ? {
            id: selected.id,
            name: selected.name,
            index: selectedIndex,
            chance: selectedChance,
            chancePercent: this.#formatPercent(selectedChance),
          }
        : null,
      cooldown: {
        active: cooldownStartedMs > 0,
        startedMs: cooldownStartedMs,
        reason:
          cooldownStartedMs > 0
            ? "100% bite selected → cooldown started"
            : null,
      },
      godMode: this.#buildGodModeDebug(),
    });

    if (selected) {
      // <-- ЗМІНЕНО: тепер передаємо playerGear сюди
      return this.#generateFishInstance(
        selected,
        envData.hookDepth,
        playerGear,
      );
    }

    return null;
  }

  getLiveChances(envData, playerGear) {
    const results = [];
    for (let i = 0; i < this.#fishDatabase.length; i++) {
      const fish = this.#fishDatabase[i];
      const chance = this.#calculateFishChance(fish, envData, playerGear);

      if (chance > 0) {
        results.push({
          name: fish.name,
          chance: (chance * 100).toFixed(2) + "%",
          chanceValue: chance,
          breakdown: this.#getBreakdown(fish, envData, playerGear),
        });
      }
    }
    return results;
  }

  #getBreakdown(fish, envData, playerGear) {
    const dc = fish.depthConfig;
    const hookDepth = envData.hookDepth;
    const baitsToTest = Array.isArray(playerGear.baits)
      ? playerGear.baits
      : [playerGear.baitId];
    let maxBaitMult = 0;
    for (let i = 0; i < baitsToTest.length; i++) {
      const mult = fish.baitMultipliers[baitsToTest[i]] || 0;
      if (mult > maxBaitMult) maxBaitMult = mult;
    }

    return {
      base: fish.baseChance.toFixed(3),
      bait: maxBaitMult.toFixed(2),
      time: (fish.timeMultipliers[envData.timePhase] || 1.0).toFixed(2),
      depth: this.#getDepthChanceMultiplier(hookDepth, dc).toFixed(2),
      weather: (
        (envData.isRaining ? (fish.weatherMultipliers?.rain ?? 1.0) : 1.0) *
        (envData.isFoggy ? (fish.weatherMultipliers?.fog ?? 1.0) : 1.0)
      ).toFixed(2),
      chum: (envData.chumBonus > 1.0 && envData.chumTargets?.includes(fish.id)
        ? envData.chumBonus
        : 1.0
      ).toFixed(2),
      spam: (envData.castSpamMultiplier ?? 1.0).toFixed(2),
      overDepth: (envData.lineLength > envData.bottomDepth
        ? this.#overDepthPenaltyMult
        : 1.0
      ).toFixed(2),
      day: (fish.dayMultipliers[envData.dayOfWeek] || 1.0).toFixed(2),
      zone: (envData.zoneBonus || 1.0).toFixed(2),
    };
  }
}

class CastManager {
  #penaltyLevel;
  #timer;
  #lastCastTime;
  #penaltyStepMs = 2000;
  #maxPenaltyMs = 5000;

  constructor() {
    this.#penaltyLevel = 0;
    this.#timer = 0;
    this.#lastCastTime = 0;
  }

  update(dt) {
    if (this.#timer <= 0) return;

    this.#timer -= dt;
    if (this.#timer <= 0 && this.#penaltyLevel > 0) {
      this.#penaltyLevel--;
      if (this.#penaltyLevel > 0) this.#timer = this.#penaltyStepMs;
    }
  }

  canCast() {
    return true;
  }

  registerCast(currentTimeMs) {
    const timeSinceLast = currentTimeMs - this.#lastCastTime;
    this.#lastCastTime = currentTimeMs;

    if (timeSinceLast <= Math.max(this.#penaltyStepMs, this.#timer)) {
      this.#penaltyLevel = Math.min(4, this.#penaltyLevel + 1);
      this.#timer =
        this.#penaltyLevel === 4 ? this.#maxPenaltyMs : this.#penaltyStepMs;
    }
  }

  getBiteChanceMultiplier() {
    return Math.max(0, 1.0 - this.#penaltyLevel * 0.25);
  }
}
