class BiteSystem {
  #fishDatabase;
  #tickRate;
  #timer;
  #overDepthPenaltyMult;
  #guaranteedBiteCooldownRange;
  #guaranteedBiteCooldownRemaining = 0;
  #possibleBitesBuffer;
  #possibleBiteChancesBuffer;
  #rng;

  constructor(biteConfig, floatConfig, rng = null) {
    this.#fishDatabase = biteConfig.fishes;
    this.#tickRate = biteConfig.tickRateMs;
    this.#timer = 0;
    this.#overDepthPenaltyMult = floatConfig?.overDepthPenaltyMult || 0.5;
    this.#guaranteedBiteCooldownRange =
      floatConfig?.guaranteedBiteCooldownMs || [2000, 15000];
    this.#possibleBitesBuffer = [];
    this.#possibleBiteChancesBuffer = [];
    this.#rng = rng || { next: () => Math.random() };
  }

  reset() {
    this.#timer = 0;
  }

  #lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, value));
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

  #next() {
    return this.#rng.next();
  }

  #chance(probability) {
    return typeof this.#rng.chance === "function"
      ? this.#rng.chance(probability)
      : this.#next() < probability;
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

    chance *= this.#getDepthChanceMultiplier(hookDepth, dc);

    return chance;
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
    const weightRatio =
      (genWeight - dc.minWeightAtMinDepth) /
      (dc.maxWeightAtMaxDepth - dc.minWeightAtMinDepth);

    // --- ДОДАНО: Логіка вибору профілю клювання ---
    const baitsToTest = Array.isArray(playerGear.baits)
      ? playerGear.baits
      : [playerGear.baitId];
    const baitId = baitsToTest[0] || "oil_worm";

    // --- ВИПРАВЛЕНО: Логіка вибору профілю клювання ---
    // Беремо типи прямо з переданих даних гравця
    const baitTypes = playerGear.baitTypes || ["float"];
    let isActiveLure = false;
    for (let i = 0; i < baitTypes.length; i++) {
      const type = baitTypes[i];
      if (type === "spinner" || type === "wobbler" || type === "jig") {
        isActiveLure = true;
        break;
      }
    }

    let chosenBiteSequence = null;
    if (fish.biteMechanics) {
      chosenBiteSequence = isActiveLure
        ? fish.biteMechanics.active
        : fish.biteMechanics.passive;
    }

    const level = Math.max(1, Math.round(weightRatio * wc.maxLevel));
    const maxLevel = wc.maxLevel || level;
    const uniqueLevel = fish.visual?.uniqueLevel;
    const isUnique =
      fish.isUnique === true ||
      fish.unique === true ||
      (Number.isFinite(uniqueLevel) && level >= uniqueLevel);
    const trophyWeight = fish.trophyWeightKg ?? fish.trophyWeight ?? null;

    return {
      id: fish.id,
      name: fish.name,
      weight: genWeight,
      level,
      maxLevel,
      resistance: this.#lerp(wc.baseResistance, wc.maxResistance, weightRatio),
      physics: fish.physics,
      biteSequence: chosenBiteSequence,
      imagePath: this.#resolveFishImagePath(fish, level),
      isUnique,
      isTrophy: trophyWeight !== null ? genWeight >= trophyWeight : false,
      anomaly: fish.anomaly || "none",
    };
  }

  #resolveFishImagePath(fish, level) {
    const pattern = fish.visual?.imagePattern;
    if (typeof pattern === "string") {
      return pattern.replace("{level}", level);
    }
    return `assets/fish/${fish.id}/${fish.id}--${level}.webp`;
  }

  evaluateBite(dt, envData, playerGear) {
    if (this.#updateGuaranteedBiteCooldown(dt)) return null;

    this.#timer += dt;
    if (this.#timer < this.#tickRate) return null;
    this.#timer -= this.#tickRate;

    this.#possibleBitesBuffer.length = 0;
    this.#possibleBiteChancesBuffer.length = 0;

    for (let i = 0; i < this.#fishDatabase.length; i++) {
      const fish = this.#fishDatabase[i];
      const chance = this.#calculateFishChance(fish, envData, playerGear);

      if (chance > 0 && this.#chance(chance)) {
        this.#possibleBitesBuffer.push(fish);
        this.#possibleBiteChancesBuffer.push(chance);
      }
    }

    if (this.#possibleBitesBuffer.length > 0) {
      const selectedIndex = this.#int(0, this.#possibleBitesBuffer.length - 1);
      const selected = this.#possibleBitesBuffer[selectedIndex];
      if (this.#possibleBiteChancesBuffer[selectedIndex] >= 1.0) {
        this.#startGuaranteedBiteCooldown();
      }
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
