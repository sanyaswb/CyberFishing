class Fish {
  #level;
  #weight;
  #resistance;
  #fishConfig;
  #powerDebuff;
  #behavior;
  #isLastDashTriggered = false;
  #lastDashTimer = 0;
  #masteryPowerMult = 1.0;
  #lastDebuffName = null;

  #originalBehaviors = null;
  #hasActiveDebuff = false;
  #rng;

  constructor(level, weight, resistance, fishConfig, rng = null) {
    this.#level = level;
    this.#weight = weight;
    this.#resistance = resistance;
    this.#fishConfig = fishConfig;
    this.#rng = rng || { next: () => Math.random() };
    this.#powerDebuff = 0;
    this.#behavior = new FishBehavior(this.#fishConfig, this.#rng);
  }

  #chance(probability) {
    return typeof this.#rng.chance === "function"
      ? this.#rng.chance(probability)
      : this.#rng.next() < probability;
  }

  #int(min, max) {
    return typeof this.#rng.int === "function"
      ? this.#rng.int(min, max)
      : Math.floor(min + this.#rng.next() * (max - min + 1));
  }

  getWeight() {
    return this.#weight;
  }

  getPhysicsConfig() {
    return this.#fishConfig || {};
  }

  getLevelMultiplier() {
    const table = this.#fishConfig.levelPowerMultiplier;
    if (Array.isArray(table) && table.length > 0) {
      return table[Math.max(0, Math.min(table.length - 1, this.#level - 1))];
    }
    return 1 + (Math.max(1, this.#level) - 1) * 0.15;
  }

  getInitialPower() {
    if (this.#fishConfig?.basePower) {
      return this.#weight * this.getLevelMultiplier() * this.#fishConfig.basePower;
    }
    return this.#level * this.#weight + this.#resistance;
  }

  getStaticPowerKg() {
    const basePower = this.#fishConfig?.basePower ?? 1.0;
    return this.#weight * this.getLevelMultiplier() * basePower;
  }

  getCurrentStaticPowerKg() {
    const base = this.getStaticPowerKg();
    const initial = Math.max(0.001, this.getInitialPower());
    const currentRatio = this.getPower() / initial;
    const minRatio = this.#fishConfig?.minPowerRatio ?? 0.25;
    return base * Math.max(minRatio, currentRatio);
  }

  getBaseSpeedPxPerSec(pixelsPerMeter = 50) {
    if (Number.isFinite(Number(this.#fishConfig?.baseSpeedMetersPerSec))) {
      return this.#fishConfig.baseSpeedMetersPerSec * pixelsPerMeter;
    }
    if (Number.isFinite(Number(this.#fishConfig?.baseSpeedPxPerSec))) {
      return this.#fishConfig.baseSpeedPxPerSec;
    }
    if (Number.isFinite(Number(this.#fishConfig?.baseSpeed))) {
      return this.#fishConfig.baseSpeed;
    }
    return 100;
  }

  getPower() {
    const initial = this.getInitialPower();
    const current = Math.max(0, initial - this.#powerDebuff);
    return current * this.#masteryPowerMult;
  }

  get activeDebuffName() {
    return this.#hasActiveDebuff
      ? this.#lastDebuffName || "Невідомий"
      : "Немає";
  }

  getMasteryMultiplier() {
    return this.#masteryPowerMult;
  }

  setMasteryMultiplier(currentMultiplier) {
    this.#masteryPowerMult = Number(currentMultiplier);
  }

  clearMasteryDebuff() {
    if (this.#masteryPowerMult !== 1.0) {
      this.#masteryPowerMult = 1.0;
      console.log(
        `[MASTERY] Риба вирвалась з центру! Плавне підкорення скинуто.`,
      );
    }
  }

  get hasActiveDebuff() {
    return this.#hasActiveDebuff;
  }

  applyPowerDebuff(amount, minBasePowerRatio = 0) {
    this.#powerDebuff = this.#clampPowerDebuff(
      this.#powerDebuff + amount,
      minBasePowerRatio,
    );
  }

  setPowerDebuffByExhaustionRatio(
    exhaustionRatio,
    maxPowerDropPerSec,
    maxDurationSec,
    minBasePowerRatio = 0.2,
  ) {
    const ratio = Math.max(0, Math.min(1, Number(exhaustionRatio) || 0));
    const maxPossibleDebuff = maxPowerDropPerSec * maxDurationSec;

    this.#powerDebuff = this.#clampPowerDebuff(
      maxPossibleDebuff * (1.0 - ratio),
      minBasePowerRatio,
    );
  }

  #clampPowerDebuff(value, minBasePowerRatio) {
    const initial = this.getInitialPower();
    const minRatio = Math.max(
      0,
      Math.min(1, Number(minBasePowerRatio) || 0),
    );
    const maxAllowedDebuff = initial * (1.0 - minRatio);
    return Math.max(0, Math.min(maxAllowedDebuff, Number(value) || 0));
  }

  getBehavior(dt) {
    this.#behavior.update(dt);
    return this.#behavior.getStateData();
  }

  reactToWall(wallSide) {
    if (this.#behavior && typeof this.#behavior.reactToWall === "function") {
      this.#behavior.reactToWall(wallSide);
    }
  }

  applyRandomDebuff(debuffsCfg) {
    const behaviors = this.#fishConfig.behaviors;
    if (!behaviors) return;

    if (!this.#originalBehaviors) {
      this.#originalBehaviors = JSON.parse(JSON.stringify(behaviors));
    }

    this.clearDebuff();
    this.#hasActiveDebuff = true;

    const types = [
      "swimPull",
      "dashMaxTime",
      "idleMaxTime",
      "dashPull",
      "restWeight",
      "restMaxTime",
    ];
    const debuffType = types[this.#int(0, types.length - 1)];
    this.#lastDebuffName = debuffType;
    console.log(`[DEBUFF] Фаза 2 виснажена! Дебаф: ${debuffType}`);

    switch (debuffType) {
      case "swimPull":
        if (behaviors.swim) {
          if (behaviors.swim.powerRatio !== undefined) behaviors.swim.powerRatio *= debuffsCfg.swimPullMult;
          if (behaviors.swim.pull !== undefined) behaviors.swim.pull *= debuffsCfg.swimPullMult;
        }
        break;
      case "dashMaxTime":
        if (behaviors.dash)
          behaviors.dash.maxTime *= debuffsCfg.dashMaxTimeMult;
        break;
      case "idleMaxTime":
        if (behaviors.idle)
          behaviors.idle.maxTime *= debuffsCfg.idleMaxTimeMult;
        break;
      case "dashPull":
        if (behaviors.dash) {
          if (behaviors.dash.powerRatio !== undefined) behaviors.dash.powerRatio *= debuffsCfg.dashPullMult;
          if (behaviors.dash.pull !== undefined) behaviors.dash.pull *= debuffsCfg.dashPullMult;
        }
        break;
      case "restWeight":
        if (behaviors.rest) {
          behaviors.rest.weight += debuffsCfg.restWeightAdd;
          if (behaviors.swim)
            behaviors.swim.weight = Math.max(
              1,
              behaviors.swim.weight - debuffsCfg.restWeightAdd,
            );
        }
        break;
      case "restMaxTime":
        if (behaviors.rest)
          behaviors.rest.maxTime *= debuffsCfg.restMaxTimeMult;
        break;
    }
  }

  clearDebuff() {
    if (!this.#originalBehaviors || !this.#hasActiveDebuff) return;
    const behaviors = this.#fishConfig.behaviors;
    for (const key in this.#originalBehaviors) {
      if (behaviors[key])
        Object.assign(behaviors[key], this.#originalBehaviors[key]);
    }
    this.#hasActiveDebuff = false;
    console.log(`[DEBUFF] Стаміна 100%. Дебафи знято.`);
  }

  tryTriggerLastDash(dt) {
    const triggerCfg = this.#fishConfig.lastDashTrigger;
    if (!triggerCfg) return;
    if (this.#isLastDashTriggered && (triggerCfg.isLocked ?? true)) return;

    this.#lastDashTimer += dt;
    const interval = triggerCfg.checkIntervalMs ?? 1000;

    if (this.#lastDashTimer >= interval) {
      this.#lastDashTimer = 0;
      const currentBehavior = this.#behavior.getStateData();
      const targetState = triggerCfg.targetState || "lastDash";

      if (currentBehavior.name === targetState) return;
      if (this.#chance(triggerCfg.chance ?? 0.05)) this.triggerLastDash();
    }
  }

  triggerLastDash() {
    const triggerCfg = this.#fishConfig.lastDashTrigger;
    if (!this.#isLastDashTriggered) {
      this.#powerDebuff *= 0.5;
      this.#isLastDashTriggered = true;
    }
    this.#behavior.forceState(
      triggerCfg?.targetState || "lastDash",
      triggerCfg?.isLocked ?? false,
    );
  }
}

class FishBehavior {
  #config;
  #currentStateName;
  #stateTimer;
  #dirTimer;
  #currentPull;
  #targetPull;
  #currentMove;
  #targetMove;
  #currentDirX;
  #targetDirX;
  #isLocked;
  #rng;

  constructor(fishConfig, rng = null) {
    this.#config = fishConfig;
    this.#rng = rng || { next: () => Math.random() };
    this.#currentStateName = "swim";
    this.#stateTimer = 0;
    this.#dirTimer = 0;
    this.#currentPull = 1.0;
    this.#targetPull = 1.0;
    this.#currentMove = 0.0;
    this.#targetMove = 0.0;
    this.#currentDirX = 0;
    this.#targetDirX = 0;
    this.#isLocked = false;
    this.#pickNextState();
  }

  #range(min, max) {
    return typeof this.#rng.range === "function"
      ? this.#rng.range(min, max)
      : min + this.#rng.next() * (max - min);
  }

  #pickNextState() {
    if (this.#isLocked) return;

    const states = this.#config.behaviors;
    if (!states) return;

    const validKeys = [];
    for (const key of Object.keys(states)) {
      if (states[key].weight > 0) validKeys.push(key);
    }

    if (validKeys.length === 0) return;

    let totalWeight = 0;
    for (let k of validKeys) {
      totalWeight += states[k].weight;
    }

    let r = this.#range(0, totalWeight);
    let selectedKey = validKeys[0];

    for (let k of validKeys) {
      if (r < states[k].weight) {
        selectedKey = k;
        break;
      }
      r -= states[k].weight;
    }

    this.#currentStateName = selectedKey;
    const state = states[this.#currentStateName];
    this.#targetPull = Math.max(0, Number(state.powerRatio ?? state.pull ?? 1) || 0);
    this.#targetMove = this.#clamp01(state.speedRatio ?? state.move ?? 0);
    this.#stateTimer = this.#range(state.minTime, state.maxTime);
  }

  forceState(stateName, isLocked = false) {
    const state = this.#config.behaviors[stateName];
    if (!state) {
      console.error(`[BEHAVIOR ERROR] Стан ${stateName} не знайдено!`);
      return;
    }

    this.#currentStateName = stateName;
    this.#targetPull = Math.max(0, Number(state.powerRatio ?? state.pull ?? 1) || 0);
    this.#targetMove = this.#clamp01(state.speedRatio ?? state.move ?? 0);
    this.#isLocked = isLocked;
    this.#stateTimer = this.#range(state.minTime, state.maxTime);
    this.#dirTimer = 0;
  }

  reactToWall(wallSide) {
    this.#targetDirX = wallSide === -1 ? 1 : -1;
    this.#currentDirX = this.#targetDirX;
    const stateConfig = this.#config.behaviors[this.#currentStateName];
    this.#dirTimer =
      stateConfig.bounceCooldownMs ?? this.#config.bounceCooldownMs ?? 2000;

    if (!this.#isLocked) {
      this.#stateTimer = 0;
    }
  }

  update(dt) {
    this.#stateTimer -= dt;
    if (this.#stateTimer <= 0) {
      if (this.#isLocked) this.#isLocked = false;
      this.#pickNextState();
    }

    const stateConfig = this.#config.behaviors[this.#currentStateName];

    this.#dirTimer -= dt;
    if (this.#dirTimer <= 0) {
      this.#targetDirX = this.#range(-1, 1);
      const minMs =
        stateConfig.dirChangeMinMs ?? this.#config.dirChangeMinMs ?? 500;
      const maxMs =
        stateConfig.dirChangeMaxMs ?? this.#config.dirChangeMaxMs ?? 2000;
      this.#dirTimer = this.#range(minMs, maxMs);
    }

    const agility = stateConfig.agility ?? this.#config.agility ?? 1.0;
    const t = Math.min(1, (dt / 1000) * 3.0 * agility);

    this.#currentPull += (this.#targetPull - this.#currentPull) * t;
    this.#currentMove += (this.#targetMove - this.#currentMove) * t;
    this.#currentDirX += (this.#targetDirX - this.#currentDirX) * t;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  getStateData() {
    const stateConfig = this.#config.behaviors[this.#currentStateName];
    return {
      name: this.#currentStateName,
      pullMult: this.#currentPull,
      powerRatio: this.#currentPull,
      speedRatio: this.#clamp01(Math.abs(this.#currentMove)),
      moveX: this.#clamp01(Math.abs(this.#currentMove)) * this.#currentDirX,
      agility: stateConfig.agility ?? this.#config.agility ?? 1.0,
      edgePowerMultiplier:
        stateConfig.edgePowerMultiplier ??
        this.#config.edgePowerMultiplier ??
        1.0,
    };
  }
}

class FishCondition {
  #maxPoints;
  #currentStamina;
  #currentExhaustion;
  #phase;

  constructor(level, weight, staminaFishConfig, fishPhysics = null) {
    if (fishPhysics?.baseStamina) {
      const basePower = fishPhysics.basePower ?? 1.0;
      const levelMultiplier = 1 + (Math.max(1, level) - 1) * 0.15;
      const weightMultiplier = fishPhysics.staminaWeightMultiplier ?? 0;
      this.#maxPoints =
        fishPhysics.baseStamina *
        basePower *
        levelMultiplier *
        (1 + Math.max(0, weightMultiplier) * Math.max(0, weight - 1));
    } else {
      this.#maxPoints =
        level * weight * staminaFishConfig.baseStaminaMultiplier +
        staminaFishConfig.flatBonus;
    }
    this.#currentStamina = this.#maxPoints;
    this.#currentExhaustion = this.#maxPoints;
    this.#phase = "stamina";
  }

  get phase() {
    return this.#phase;
  }
  get maxPoints() {
    return this.#maxPoints;
  }
  get currentStamina() {
    return this.#currentStamina;
  }
  get currentExhaustion() {
    return this.#currentExhaustion;
  }

  breakExhaustion() {
    if (this.#phase === "exhaustion") {
      this.#phase = "stamina";
    }
  }

  applyStaminaDamage(amount) {
    if (this.#phase !== "stamina") return;
    this.#currentStamina = Math.max(0, this.#currentStamina - amount);
    if (this.#currentStamina === 0) {
      this.#phase = "exhaustion";
    }
  }

  applyStaminaRegen(amount) {
    if (this.#phase !== "stamina") return;
    this.#currentStamina = Math.min(
      this.#maxPoints,
      this.#currentStamina + amount,
    );
  }

  applyExhaustionDamage(amount) {
    if (this.#phase !== "exhaustion") return;
    this.#currentExhaustion = Math.max(0, this.#currentExhaustion - amount);
  }

  applyPunishment(capPercent) {
    const cap = this.#maxPoints * capPercent;
    if (this.#currentExhaustion < cap) {
      this.#currentExhaustion = cap;
      console.log(
        `[STAMINA] Риба відновилася! Виснаження повернулося до ${capPercent * 100}%`,
      );
    }
  }
}
