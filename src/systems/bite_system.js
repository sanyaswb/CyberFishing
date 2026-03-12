class BiteSystem {
  #biteConfig;
  #fishDatabase;
  #tickRate;
  #timer;
  #overDepthPenaltyMult;

  constructor(biteConfig, floatConfig) {
    this.#biteConfig = biteConfig;
    this.#fishDatabase = biteConfig.fishes;
    this.#tickRate = biteConfig.tickRateMs;
    this.#timer = 0;
    this.#overDepthPenaltyMult = floatConfig.overDepthPenaltyMult || 0.5;
  }

  reset() {
    this.#timer = 0;
  }

  #lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }

  #generateFishInstance(fish, currentDepth) {
    const dc = fish.depthConfig;
    const wc = fish.weightConfig;

    let t = (currentDepth - dc.minDepth) / (dc.maxDepth - dc.minDepth);
    t = Math.max(0, Math.min(1, t));

    const currentMinWeight = this.#lerp(
      dc.minWeightAtMinDepth,
      dc.minWeightAtMaxDepth,
      t,
    );
    const currentMaxWeight = this.#lerp(
      dc.maxWeightAtMinDepth,
      dc.maxWeightAtMaxDepth,
      t,
    );

    const roll = Math.pow(Math.random(), wc.rarityCurve);
    const generatedWeight =
      currentMinWeight + (currentMaxWeight - currentMinWeight) * roll;

    const absoluteMin = dc.minWeightAtMinDepth;
    const absoluteMax = dc.maxWeightAtMaxDepth;
    const weightRatio =
      (generatedWeight - absoluteMin) / (absoluteMax - absoluteMin);

    const generatedLevel = Math.max(1, Math.round(weightRatio * wc.maxLevel));
    const generatedResistance = this.#lerp(
      wc.baseResistance,
      wc.maxResistance,
      weightRatio,
    );

    return {
      id: fish.id,
      name: fish.name,
      weight: generatedWeight,
      level: generatedLevel,
      resistance: generatedResistance,
      physics: fish.physics,
    };
  }

  evaluateBite(dt, envData, playerGear) {
    this.#timer += dt;
    if (this.#timer < this.#tickRate) return null;
    this.#timer -= this.#tickRate;

    let possibleBites = [];

    for (const fish of this.#fishDatabase) {
      const dc = fish.depthConfig;

      if (playerGear.hookSize > fish.maxHookSize) continue;
      if (envData.hookDepth < dc.minDepth || envData.hookDepth > dc.maxDepth)
        continue;

      const baitMult = fish.baitMultipliers[playerGear.baitId] || 0;
      if (baitMult === 0) continue;

      let finalChance = fish.baseChance * baitMult;
      finalChance *= fish.timeMultipliers[envData.timePhase] || 1.0;
      finalChance *= fish.dayMultipliers[envData.dayOfWeek] || 1.0;

      let currentChumMult = 1.0;
      if (envData.chumBonus > 1.0 && Array.isArray(envData.chumTargets)) {
        if (envData.chumTargets.includes(fish.id)) {
          currentChumMult = envData.chumBonus;
        }
      }
      finalChance *= currentChumMult;

      if (envData.isRaining)
        finalChance *= fish.weatherMultipliers?.rain ?? 1.0;
      if (envData.isFoggy) finalChance *= fish.weatherMultipliers?.fog ?? 1.0;
      finalChance *= envData.castSpamMultiplier ?? 1.0;
      if (envData.hookDepth > envData.bottomDepth)
        finalChance *= this.#overDepthPenaltyMult;

      if (Math.random() <= finalChance) possibleBites.push(fish);
    }

    if (possibleBites.length > 0) {
      const selected =
        possibleBites[Math.floor(Math.random() * possibleBites.length)];
      return this.#generateFishInstance(selected, envData.hookDepth);
    }
    return null;
  }

  getLiveChances(envData, playerGear) {
    let chances = [];

    const physicalHookDepth = Math.min(envData.hookDepth, envData.bottomDepth);

    for (const fish of this.#fishDatabase) {
      const dc = fish.depthConfig;

      if (playerGear.hookSize > fish.maxHookSize) continue;

      if (physicalHookDepth < dc.minDepth || physicalHookDepth > dc.maxDepth)
        continue;

      const baitMult = fish.baitMultipliers[playerGear.baitId] || 0;
      if (baitMult === 0) continue;

      let currentChumMult = 1.0;
      if (envData.chumBonus > 1.0 && Array.isArray(envData.chumTargets)) {
        if (envData.chumTargets.includes(fish.id)) {
          currentChumMult = envData.chumBonus;
        }
      }

      const timeMult = fish.timeMultipliers[envData.timePhase] || 1.0;
      const dayMult = fish.dayMultipliers[envData.dayOfWeek] || 1.0;

      let t = (physicalHookDepth - dc.minDepth) / (dc.maxDepth - dc.minDepth);
      t = Math.max(0, Math.min(1, t));
      const depthChanceMult = this.#lerp(1.0, dc.chanceMultAtMaxDepth, t);

      const rainMult = envData.isRaining
        ? (fish.weatherMultipliers?.rain ?? 1.0)
        : 1.0;
      const fogMult = envData.isFoggy
        ? (fish.weatherMultipliers?.fog ?? 1.0)
        : 1.0;
      const weatherMult = rainMult * fogMult;

      const overDepthPenalty =
        envData.lineLength > envData.bottomDepth
          ? this.#overDepthPenaltyMult || 0.5
          : 1.0;

      const spamMult = envData.castSpamMultiplier ?? 1.0;
      const zoneMult = envData.zoneMultiplier ?? 1.0;

      const finalChance =
        fish.baseChance *
        baitMult *
        timeMult *
        dayMult *
        currentChumMult *
        depthChanceMult *
        weatherMult *
        zoneMult *
        spamMult *
        overDepthPenalty;

      chances.push({
        name: fish.name,
        chance: (finalChance * 100).toFixed(2) + "%",
        breakdown: {
          base: fish.baseChance.toFixed(3),
          bait: baitMult.toFixed(2),
          time: timeMult.toFixed(2),
          day: dayMult.toFixed(2),
          depth: depthChanceMult.toFixed(2),
          weather: weatherMult.toFixed(2),
          zone: zoneMult.toFixed(2),
          chum: currentChumMult.toFixed(2),
          spam: spamMult.toFixed(2),
          overDepth: overDepthPenalty.toFixed(2),
        },
      });
    }
    return chances;
  }
}

class CastManager {
  #penaltyLevel;
  #timer;
  #lastCastTime;

  constructor() {
    this.#penaltyLevel = 0;
    this.#timer = 0;
    this.#lastCastTime = 0;
  }

  update(dt) {
    if (this.#timer > 0) {
      this.#timer -= dt;

      if (this.#timer <= 0 && this.#penaltyLevel > 0) {
        this.#penaltyLevel--;
        if (this.#penaltyLevel > 0) {
          this.#timer = 2000;
        }
      }
    }
  }

  canCast() {
    return true;
  }

  registerCast(currentTimeMs) {
    const timeSinceLast = currentTimeMs - this.#lastCastTime;
    this.#lastCastTime = currentTimeMs;

    const spamWindow = Math.max(2000, this.#timer);

    if (timeSinceLast <= spamWindow) {
      this.#penaltyLevel = Math.min(4, this.#penaltyLevel + 1);

      if (this.#penaltyLevel === 4) {
        this.#timer = 5000;
      } else {
        this.#timer = 2000;
      }
    }

    if (
      typeof window.DEBUG_MODULES !== "undefined" &&
      window.DEBUG_MODULES.forces
    ) {
      console.log(
        `[CastManager] Закидання. Штраф: -${this.#penaltyLevel * 25}%. Таймер: ${this.#timer}мс`,
      );
    }
  }

  getBiteChanceMultiplier() {
    return Math.max(0, 1.0 - this.#penaltyLevel * 0.25);
  }
}
