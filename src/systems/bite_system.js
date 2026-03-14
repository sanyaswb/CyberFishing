class BiteSystem {
  #biteConfig;
  #fishDatabase;
  #tickRate;
  #timer;
  #overDepthPenaltyMult;
  #possibleBitesBuffer;

  constructor(biteConfig, floatConfig) {
    this.#biteConfig = biteConfig;
    this.#fishDatabase = biteConfig.fishes;
    this.#tickRate = biteConfig.tickRateMs;
    this.#timer = 0;
    this.#overDepthPenaltyMult = floatConfig.overDepthPenaltyMult || 0.5;
    this.#possibleBitesBuffer = [];
  }

  reset() {
    this.#timer = 0;
  }

  #lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }

  #calculateFishChance(fish, envData, playerGear, isLiveQuery = false) {
    const dc = fish.depthConfig;
    const hookDepth = isLiveQuery
      ? Math.min(envData.hookDepth, envData.bottomDepth)
      : envData.hookDepth;

    if (playerGear.hookSize > fish.maxHookSize) return 0;
    if (hookDepth < dc.minDepth || hookDepth > dc.maxDepth) return 0;

    const baitMult = fish.baitMultipliers[playerGear.baitId] || 0;
    if (baitMult === 0) return 0;

    let chance = fish.baseChance * baitMult;
    chance *= fish.timeMultipliers[envData.timePhase] || 1.0;
    chance *= fish.dayMultipliers[envData.dayOfWeek] || 1.0;

    if (envData.chumBonus > 1.0 && envData.chumTargets?.includes(fish.id)) {
      chance *= envData.chumBonus;
    }

    if (envData.isRaining) chance *= fish.weatherMultipliers?.rain ?? 1.0;
    if (envData.isFoggy) chance *= fish.weatherMultipliers?.fog ?? 1.0;

    chance *= envData.castSpamMultiplier ?? 1.0;

    const depthRef = isLiveQuery ? envData.lineLength : envData.hookDepth;
    if (depthRef > envData.bottomDepth) {
      chance *= this.#overDepthPenaltyMult;
    }

    if (isLiveQuery) {
      let t = (hookDepth - dc.minDepth) / (dc.maxDepth - dc.minDepth);
      t = Math.max(0, Math.min(1, t));
      chance *= this.#lerp(1.0, dc.chanceMultAtMaxDepth, t);
    }

    return chance;
  }

  #generateFishInstance(fish, currentDepth) {
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
      curMinW + (curMaxW - curMinW) * Math.pow(Math.random(), wc.rarityCurve);
    const weightRatio =
      (genWeight - dc.minWeightAtMinDepth) /
      (dc.maxWeightAtMaxDepth - dc.minWeightAtMinDepth);

    return {
      id: fish.id,
      name: fish.name,
      weight: genWeight,
      level: Math.max(1, Math.round(weightRatio * wc.maxLevel)),
      resistance: this.#lerp(wc.baseResistance, wc.maxResistance, weightRatio),
      physics: fish.physics,
    };
  }

  evaluateBite(dt, envData, playerGear) {
    this.#timer += dt;
    if (this.#timer < this.#tickRate) return null;
    this.#timer -= this.#tickRate;

    this.#possibleBitesBuffer.length = 0;

    for (let i = 0; i < this.#fishDatabase.length; i++) {
      const fish = this.#fishDatabase[i];
      const chance = this.#calculateFishChance(
        fish,
        envData,
        playerGear,
        false,
      );

      if (chance > 0 && Math.random() <= chance) {
        this.#possibleBitesBuffer.push(fish);
      }
    }

    if (this.#possibleBitesBuffer.length > 0) {
      const selected =
        this.#possibleBitesBuffer[
          Math.floor(Math.random() * this.#possibleBitesBuffer.length)
        ];
      return this.#generateFishInstance(selected, envData.hookDepth);
    }

    return null;
  }

  getLiveChances(envData, playerGear) {
    const results = [];
    for (let i = 0; i < this.#fishDatabase.length; i++) {
      const fish = this.#fishDatabase[i];
      const chance = this.#calculateFishChance(fish, envData, playerGear, true);

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
    const hookDepth = Math.min(envData.hookDepth, envData.bottomDepth);
    let t = Math.max(
      0,
      Math.min(1, (hookDepth - dc.minDepth) / (dc.maxDepth - dc.minDepth)),
    );

    return {
      base: fish.baseChance.toFixed(3),
      bait: (fish.baitMultipliers[playerGear.baitId] || 0).toFixed(2),
      time: (fish.timeMultipliers[envData.timePhase] || 1.0).toFixed(2),
      depth: this.#lerp(1.0, dc.chanceMultAtMaxDepth, t).toFixed(2),
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
