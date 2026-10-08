import { FishBehavior } from "./fish_behavior.js";
import { FishPhysicsProfile } from "./fish_physics_profile.js";

export class Fish {
  #level;
  #weight;
  #fishConfig;
  #powerDebuff;
  #behavior;
  #masteryPowerMult = 1.0;
  #lastDebuffName = null;
  #debuffState;

  #originalBehaviors = null;
  #hasActiveDebuff = false;
  #rng;
  #logger;

  // Composition injects the diagnostics logger (a platform adapter in production).
  constructor(level, weight, fishConfig, rng = null, logger = null) {
    const owner = this;
    this.#debuffState = Object.freeze({
      get active() { return owner.#hasActiveDebuff; },
      get type() { return owner.#lastDebuffName; },
    });
    this.#level = level;
    this.#weight = weight;
    this.#fishConfig = FishPhysicsProfile.toRuntimeConfig(fishConfig);
    this.#rng = rng || { next: () => Math.random() };
    this.#logger = logger;
    this.#powerDebuff = 0;
    this.#behavior = new FishBehavior(this.#fishConfig, this.#rng, this.#logger);
  }

  #int(min, max) {
    return typeof this.#rng.int === "function"
      ? this.#rng.int(min, max)
      : Math.floor(min + this.#rng.next() * (max - min + 1));
  }

  getWeight() {
    return this.#weight;
  }

  updateRuntimeStats({ level, weight, physics } = {}) {
    if (Number.isFinite(Number(level))) {
      this.#level = Math.max(1, Math.round(Number(level)));
    }
    if (Number.isFinite(Number(weight))) {
      this.#weight = Math.max(0, Number(weight));
    }
    if (physics && typeof physics === "object") {
      this.#fishConfig = FishPhysicsProfile.toRuntimeConfig(physics);
      this.#behavior = new FishBehavior(this.#fishConfig, this.#rng, this.#logger);
    }
  }

  getPhysicsConfig() {
    return this.#fishConfig || {};
  }

  getLevelMultiplier() {
    // Numeric level is NOT multiplied into fish force anymore.
    // The level only selects a configured per-level basePower coefficient.
    const levelBasePower = this.#fishConfig?.forceProfile?.levelBasePower;
    if (Number.isFinite(Number(levelBasePower))) {
      return Math.max(0, Number(levelBasePower));
    }

    return 1;
  }

  getInitialPower() {
    const basePowerValue = this.#fishConfig?.forceProfile?.basePower;
    const basePower = Number.isFinite(Number(basePowerValue))
      ? Number(basePowerValue)
      : 1.0;
    return this.#weight * this.getLevelMultiplier() * Math.max(0, basePower);
  }

  getPower() {
    const initial = this.getInitialPower();
    const current = Math.max(0, initial - this.#powerDebuff);
    return current * this.#masteryPowerMult;
  }

  getPowerBeforeMastery() {
    return Math.max(0, this.getInitialPower() - this.#powerDebuff);
  }

  getPowerDebuff() {
    return Math.max(0, this.#powerDebuff);
  }

  getDebuffState() { return this.#debuffState; }

  getMasteryMultiplier() {
    return this.#masteryPowerMult;
  }

  setMasteryMultiplier(currentMultiplier) {
    this.#masteryPowerMult = Number(currentMultiplier);
  }

  clearMasteryDebuff() {
    if (this.#masteryPowerMult !== 1.0) {
      this.#masteryPowerMult = 1.0;
      this.#logger?.log?.(
        `[MASTERY] Риба вирвалась з центру! Плавне підкорення скинуто.`,
      );
    }
  }

  get hasActiveDebuff() {
    return this.#hasActiveDebuff;
  }

  setPowerRatioByEnduranceRatio(
    enduranceRatio,
    minBasePowerRatio = 0.2,
    curvePower = 1.0,
  ) {
    const ratio = Math.max(0, Math.min(1, Number(enduranceRatio) || 0));
    const minRatio = Math.max(0, Math.min(1, Number(minBasePowerRatio) || 0));
    const curve = Math.max(0.001, Number(curvePower) || 1);
    const exhaustionProgress = 1.0 - ratio;
    const debuffProgress = Math.pow(exhaustionProgress, curve);
    const targetPowerRatio = 1.0 - (1.0 - minRatio) * debuffProgress;
    const initialPower = this.getInitialPower();

    this.#powerDebuff = this.#clampPowerDebuff(
      initialPower * (1.0 - targetPowerRatio),
      minRatio,
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

  getBehavior(dt, runtimeMovementModifier = null) {
    this.#behavior.update(dt, runtimeMovementModifier);
    return this.#behavior.getStateData();
  }

  evaluateLastDashTrigger(context = {}) {
    return this.#behavior.evaluateLastDashTrigger(context);
  }

  handleFightEvent(event = {}) {
    this.#behavior.handleFightEvent(event);
  }

  getLastDashDiagnostics() {
    return this.#behavior.getLastDashDiagnostics();
  }

  reactToWall(wallSide) {
    if (this.#behavior && typeof this.#behavior.reactToWall === "function") {
      this.#behavior.reactToWall(wallSide);
    }
  }

  #getBehaviorMap() {
    return this.#fishConfig?.behaviorProfile?.behaviors || this.#fishConfig?.behaviors || null;
  }

  applyRandomDebuff(debuffsCfg) {
    const behaviors = this.#getBehaviorMap();
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
    this.#logger?.log?.(`[DEBUFF] Фаза 2 виснажена! Дебаф: ${debuffType}`);

    switch (debuffType) {
      case "swimPull":
        if (behaviors.swim) {
          behaviors.swim.forceMultiplier *= debuffsCfg.swimPullMult;
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
          behaviors.dash.forceMultiplier *= debuffsCfg.dashPullMult;
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
    const behaviors = this.#getBehaviorMap();
    for (const key in this.#originalBehaviors) {
      if (behaviors[key])
        Object.assign(behaviors[key], this.#originalBehaviors[key]);
    }
    this.#hasActiveDebuff = false;
    this.#logger?.log?.(`[DEBUFF] Стаміна 100%. Дебафи знято.`);
  }

}
