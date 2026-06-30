class StaminaController {
  #condition;
  #mechanicsConfig;
  #playerBasePower;
  #fish;
  #masteryTimer = 0;
  #isMasteryActive = false;
  #isFullyRecovered = false;
  #hasLostStamina = false;
  #lastStaminaBalanceFrame = null;

  constructor(condition, fish, playerBasePower, mechanicsConfig) {
    this.#condition = condition;
    this.#fish = fish;
    this.#playerBasePower = playerBasePower;
    this.#mechanicsConfig = mechanicsConfig;
  }

  updatePlayerPower(newPower) {
    this.#playerBasePower = Math.max(0, Number(newPower) || 0);
  }

  getMasteryTimer() {
    return this.#masteryTimer;
  }

  isMasteryActive() {
    return this.#isMasteryActive;
  }

  getLastStaminaBalanceFrame() {
    return this.#lastStaminaBalanceFrame;
  }

  restoreFullStamina() {
    this.#condition.restoreFull?.();
    this.#masteryTimer = 0;
    this.#isMasteryActive = false;
    this.#isFullyRecovered = false;
    this.#hasLostStamina = false;
    this.#fish.clearDebuff?.();
    this.#fish.setMasteryMultiplier?.(1.0);
  }

  getExhaustionDurationMs() {
    const expectedDps = this.#expectedEnduranceDrainPerSecond();
    if (expectedDps > 0) {
      return (this.#maxEndurance() / expectedDps) * 1000;
    }

    return this.#legacyExhaustionDurationMs();
  }

  #legacyExhaustionDurationMs() {
    if (!this.#fish) return 1000;
    const idealDps =
      this.#mechanicsConfig.baseDepletionRate *
      Math.max(0.001, this.#playerBasePower);
    const idealTimeSec = this.#maxEndurance() / Math.max(1, idealDps);
    const multiplier = Math.max(
      0.001,
      Number(this.#mechanicsConfig.exhaustionDepletionMultiplier) || 1.0,
    );

    return (idealTimeSec * this.#fish.getInitialPower() * 1000) / multiplier;
  }

  evaluate(
    arg1,
    playerPowerIsPullingLegacy,
    dtLegacy,
    floatXLegacy,
    boundsLegacy,
  ) {
    const args =
      typeof arg1 === "object" && arg1 !== null
        ? arg1
        : {
            tension: arg1,
            playerPowerIsPulling: playerPowerIsPullingLegacy,
            dt: dtLegacy,
            angleStressRatio: this.#legacyAngleStress(
              floatXLegacy,
              boundsLegacy,
            ),
          };

    const tension = Math.max(0, Number(args.tension) || 0);
    const playerPowerIsPulling = !!args.playerPowerIsPulling;
    const dt = Math.max(0, Number(args.dt) || 0);
    const timeScale = dt / 1000;
    const angleStressRatio = this.#clamp01(args.angleStressRatio);
    const staminaPressureRatio = this.#clamp01(args.staminaPressureRatio);
    const staminaFrame =
      args.staminaFrame?.source === "stamina_balance_frame"
        ? args.staminaFrame
        : args.source === "stamina_balance_frame"
          ? args
          : null;
    const isLineFullyExtended = !!args.isLineFullyExtended;
    const effectivePressureRatio = Math.max(
      staminaPressureRatio,
      playerPowerIsPulling && isLineFullyExtended ? 1 : 0,
    );
    const hasEffectivePressure =
      playerPowerIsPulling && effectivePressureRatio > 0.001;

    if (this.#condition.phase === "exhaustion") {
      if (staminaFrame) {
        this.#evaluateEnduranceBalanceFrame(staminaFrame, dt);
        return;
      }
      this.#evaluateExhaustionPhase({
        tension,
        dt,
        timeScale,
        angleStressRatio,
        effectivePressureRatio,
        hasEffectivePressure,
      });
      return;
    }

    if (this.#condition.phase === "stamina") {
      if (staminaFrame) {
        this.#evaluateStaminaBalanceFrame(staminaFrame);
        return;
      }
      this.#evaluateStaminaPhase({
        tension,
        timeScale,
        angleStressRatio,
        effectivePressureRatio,
        hasEffectivePressure,
      });
    }
  }

  #evaluateStaminaBalanceFrame(frame) {
    this.#lastStaminaBalanceFrame = frame;
    const netChange = Number(frame.netStaminaChange) || 0;
    if (netChange < 0) {
      this.#condition.applyStaminaDamage(-netChange);
    } else if (netChange > 0) {
      this.#condition.applyStaminaRegen(netChange);
    }
  }

  #evaluateEnduranceBalanceFrame(frame, dt) {
    this.#lastStaminaBalanceFrame = frame;
    this.#updateMasteryWindow(dt, 0, this.getExhaustionDurationMs());

    const damage = Math.max(
      0,
      Number(frame.totalEnduranceDrain ?? frame.enduranceTotalDrain) || 0,
    );
    if (damage <= 0) {
      this.#applyFinalDebuffIfExhausted();
      return;
    }

    this.#applyEnduranceFrameDrain({ damage });
  }

  #evaluateExhaustionPhase({
    tension,
    dt,
    timeScale,
    angleStressRatio,
    effectivePressureRatio,
    hasEffectivePressure,
  }) {
    if (
      angleStressRatio > 0 ||
      tension > this.#mechanicsConfig.exhaustionOptimalMax
    ) {
      this.#condition.breakExhaustion();
      return;
    }

    if (!hasEffectivePressure) return;

    const exhaustionMultiplier = Math.max(
      0.001,
      Number(this.#mechanicsConfig.exhaustionDepletionMultiplier) || 1.0,
    );
    const idealDps =
      this.#mechanicsConfig.baseDepletionRate *
      Math.max(0.001, this.#playerBasePower);
    const idealTimeSec = this.#maxEndurance() / Math.max(1, idealDps);
    const exhaustionDurationSec = Math.max(
      0.001,
      idealTimeSec * this.#fish.getInitialPower(),
    );
    const effectiveExhaustionDurationSec =
      exhaustionDurationSec / exhaustionMultiplier;
    const exhaustionDurationMs = effectiveExhaustionDurationSec * 1000;

    this.#updateMasteryWindow(dt, angleStressRatio, exhaustionDurationMs);
    this.#applyExhaustionPressure(
      timeScale,
      effectivePressureRatio,
      effectiveExhaustionDurationSec,
      exhaustionMultiplier,
    );
  }

  #updateMasteryWindow(dt, angleStressRatio, exhaustionDurationMs) {
    if (this.#condition.currentExhaustion > 0 || angleStressRatio !== 0) {
      this.#masteryTimer = 0;
      if (this.#isMasteryActive) {
        this.#isMasteryActive = false;
        this.#fish.clearMasteryDebuff();
      }
      return;
    }

    const masteryRatio = this.#mechanicsConfig.masteryTimeRatio ?? 0.5;
    const targetPhaseTimeMs = exhaustionDurationMs * masteryRatio;
    this.#masteryTimer += dt;

    if (this.#masteryTimer <= targetPhaseTimeMs) {
      this.#fish.setMasteryMultiplier(1.0);
      return;
    }

    this.#isMasteryActive = true;
    const drainElapsed = this.#masteryTimer - targetPhaseTimeMs;
    const drainProgress = Math.min(
      1,
      drainElapsed / Math.max(1, targetPhaseTimeMs),
    );
    const maxDebuffDrop = this.#mechanicsConfig.masteryPowerMultiplier ?? 0.2;
    this.#fish.setMasteryMultiplier(1.0 - maxDebuffDrop * drainProgress);
  }

  #applyExhaustionPressure(
    timeScale,
    effectivePressureRatio,
    effectiveExhaustionDurationSec,
    exhaustionMultiplier,
  ) {
    if (this.#condition.currentExhaustion <= 0) return;

    const pointsPerSec =
      this.#maxEndurance() / effectiveExhaustionDurationSec;
    const damage = pointsPerSec * timeScale * effectivePressureRatio;
    const debuff =
      this.#mechanicsConfig.basePowerDropPerSec *
      exhaustionMultiplier *
      effectivePressureRatio *
      timeScale;

    if (this.#condition.currentExhaustion <= damage) {
      const ratio = this.#condition.currentExhaustion / Math.max(0.001, damage);
      this.#condition.applyExhaustionDamage(this.#condition.currentExhaustion);
      this.#fish.applyPowerDebuff(
        debuff * ratio,
        this.#mechanicsConfig.minBasePowerRatio ?? 0.2,
      );
      if (!this.#fish.hasActiveDebuff) {
        this.#fish.applyRandomDebuff(this.#mechanicsConfig.debuffs);
      }
      return;
    }

    this.#condition.applyExhaustionDamage(damage);
    this.#fish.applyPowerDebuff(
      debuff,
      this.#mechanicsConfig.minBasePowerRatio ?? 0.2,
    );
  }

  #applyEnduranceFrameDrain({ damage }) {
    if (this.#condition.currentExhaustion <= 0) {
      this.#applyFinalDebuffIfExhausted();
      return;
    }

    if (this.#condition.currentExhaustion <= damage) {
      this.#condition.applyExhaustionDamage(
        this.#condition.currentExhaustion,
      );
      this.#syncFramePowerDebuffWithEndurance();
      this.#applyFinalDebuffIfExhausted();
      return;
    }

    this.#condition.applyExhaustionDamage(damage);
    this.#syncFramePowerDebuffWithEndurance();
  }

  #syncFramePowerDebuffWithEndurance() {
    const enduranceRatio = this.#clamp01(
      this.#condition.currentExhaustion / this.#maxEndurance(),
    );
    const powerDebuffConfig = this.#mechanicsConfig.powerDebuff || {};
    const enabled = powerDebuffConfig.enabled !== false;
    const minBasePowerRatio = this.#clamp01(
      powerDebuffConfig.minBasePowerRatio ??
        this.#mechanicsConfig.minBasePowerRatio ??
        0.2,
    );
    const curvePower = Math.max(
      0.001,
      Number(powerDebuffConfig.curvePower) || 1.0,
    );

    if (enabled && typeof this.#fish?.setPowerRatioByEnduranceRatio === "function") {
      this.#fish.setPowerRatioByEnduranceRatio(
        enduranceRatio,
        minBasePowerRatio,
        curvePower,
      );
      return;
    }

    if (typeof this.#fish?.setPowerDebuffByExhaustionRatio !== "function") {
      return;
    }

    const maxPowerDropPerSec = this.#positive(
      this.#mechanicsConfig.basePowerDropPerSec,
      0,
    );
    const expectedDurationSec = Math.max(
      0.001,
      this.getExhaustionDurationMs() / 1000,
    );

    this.#fish.setPowerDebuffByExhaustionRatio(
      enduranceRatio,
      maxPowerDropPerSec,
      expectedDurationSec,
      minBasePowerRatio,
    );
  }

  #applyFinalDebuffIfExhausted() {
    if (this.#condition.currentExhaustion > 0) return;
    if (!this.#fish.hasActiveDebuff) {
      this.#fish.applyRandomDebuff(this.#mechanicsConfig.debuffs);
    }
  }

  #evaluateStaminaPhase({
    tension,
    timeScale,
    angleStressRatio,
    effectivePressureRatio,
    hasEffectivePressure,
  }) {
    const regenMult =
      this.#condition.currentExhaustion > 0
        ? this.#mechanicsConfig.regenMultiplierPhase1 || 1.5
        : 1.0;

    if (angleStressRatio > 0) {
      this.#condition.applyStaminaRegen(
        this.#mechanicsConfig.edgeRegenRate *
          angleStressRatio *
          timeScale *
          regenMult,
      );
    }

    if (!hasEffectivePressure) {
      const regenFactor = Math.max(0, 1 - tension / 100);
      this.#condition.applyStaminaRegen(
        this.#mechanicsConfig.baseRegenRate *
          regenFactor *
          timeScale *
          regenMult,
      );
    } else if (tension <= this.#mechanicsConfig.optimalMax) {
      const efficiency = Math.max(
        0,
        1 - tension / this.#mechanicsConfig.optimalMax,
      );
      const damage =
        this.#mechanicsConfig.baseDepletionRate *
        efficiency *
        Math.max(0.001, this.#playerBasePower) *
        effectivePressureRatio *
        timeScale *
        (1 - angleStressRatio);
      this.#condition.applyStaminaDamage(damage);
    }

    this.#applyRecoveryPunishment();
  }

  #applyRecoveryPunishment() {
    if (this.#condition.currentStamina < this.#maxStamina()) {
      this.#hasLostStamina = true;
    }

    if (
      !this.#hasLostStamina ||
      this.#condition.currentStamina < this.#maxStamina()
    ) {
      this.#isFullyRecovered = false;
      return;
    }

    if (this.#isFullyRecovered) return;
    this.#isFullyRecovered = true;

    const punishmentCap = this.#mechanicsConfig.punishmentCap || 0.8;
    this.#condition.applyPunishment(punishmentCap);

    if (this.#fish.hasActiveDebuff) {
      this.#fish.clearDebuff();
    }

    const exhaustionMultiplier = Math.max(
      0.001,
      Number(this.#mechanicsConfig.exhaustionDepletionMultiplier) || 1.0,
    );
    const idealDps =
      this.#mechanicsConfig.baseDepletionRate *
      Math.max(0.001, this.#playerBasePower);
    const idealTimeSec = this.#maxEndurance() / Math.max(1, idealDps);
    const exhaustionDurationSec =
      (idealTimeSec * this.#fish.getInitialPower()) / exhaustionMultiplier;
    const maxPowerDropPerSec =
      this.#mechanicsConfig.basePowerDropPerSec * exhaustionMultiplier;

    this.#fish.setPowerDebuffByExhaustionRatio(
      punishmentCap,
      maxPowerDropPerSec,
      exhaustionDurationSec,
      this.#mechanicsConfig.minBasePowerRatio ?? 0.2,
    );

    console.log(
      `[STAMINA] Fish recovered stamina. Exhaustion ${punishmentCap * 100}%, power synchronized.`,
    );
  }

  #legacyAngleStress(floatX, bounds) {
    if (!bounds) return 0;
    const centerX = (bounds.left + bounds.right) / 2;
    const halfWidth = (bounds.right - bounds.left) / 2;
    const rawPenalty =
      Math.abs((Number(floatX) || centerX) - centerX) / (halfWidth || 1);
    return this.#clamp01(
      (rawPenalty - this.#mechanicsConfig.centerSweetSpot) /
        (1 - this.#mechanicsConfig.centerSweetSpot),
    );
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  #expectedEnduranceDrainPerSecond() {
    const enduranceDrain = this.#mechanicsConfig.enduranceDrain || {};
    const active = enduranceDrain.active || {};
    const passive = enduranceDrain.passive || {};
    const activeDps =
      active.enabled === false
        ? 0
        : this.#positive(active.drainPerSecond, 80);
    const passiveDps =
      passive.enabled === false
        ? 0
        : this.#positive(passive.drainPerSecond, 15) *
          this.#positive(passive.defaultBehaviorMultiplier, 0.5);
    return Math.max(0, activeDps + passiveDps);
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #maxStamina() {
    const value = Number(this.#condition.maxStamina ?? this.#condition.maxPoints);
    return Number.isFinite(value) ? Math.max(0.001, value) : 0.001;
  }

  #maxEndurance() {
    const value = Number(this.#condition.maxEndurance ?? this.#condition.maxPoints);
    return Number.isFinite(value) ? Math.max(0.001, value) : 0.001;
  }
}

class BuffManager {
  #activeBuffs;

  constructor() {
    this.#activeBuffs = [];
  }

  addBuff(multiplier, duration) {
    this.#activeBuffs.push({ multiplier, remainingMs: duration });
  }

  update(dt) {
    for (let i = this.#activeBuffs.length - 1; i >= 0; i--) {
      this.#activeBuffs[i].remainingMs -= dt;
      if (this.#activeBuffs[i].remainingMs <= 0) {
        this.#activeBuffs.splice(i, 1);
      }
    }
  }

  getTotalMultiplier() {
    let multiplier = 1.0;
    for (let i = 0; i < this.#activeBuffs.length; i++) {
      multiplier *= this.#activeBuffs[i].multiplier;
    }
    return multiplier;
  }
}
