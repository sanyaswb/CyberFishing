class StaminaController {
  #condition;
  #mechanicsConfig;
  #fish;
  #masteryTimer = 0;
  #isMasteryActive = false;
  #lastStaminaBalanceFrame = null;

  constructor(condition, fish, mechanicsConfig) {
    this.#condition = condition;
    this.#fish = fish;
    this.#mechanicsConfig = mechanicsConfig;
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
    this.#fish.clearDebuff?.();
    this.#fish.setMasteryMultiplier?.(1.0);
  }

  getExhaustionDurationMs() {
    const expectedDps = this.#expectedEnduranceDrainPerSecond();
    if (expectedDps > 0) {
      return (this.#maxEndurance() / expectedDps) * 1000;
    }

    return 1000;
  }

  evaluate(args = {}) {
    const dt = Math.max(0, Number(args.dt) || 0);
    const staminaFrame =
      args.staminaFrame?.source === "stamina_balance_frame"
        ? args.staminaFrame
        : args.source === "stamina_balance_frame"
          ? args
          : null;

    if (!staminaFrame) return;

    if (this.#condition.phase === "exhaustion") {
      this.#evaluateSimplifiedEnduranceFrame(staminaFrame, dt);
      return;
    }

    if (this.#condition.phase === "stamina") {
      this.#evaluateSimplifiedStaminaFrame(staminaFrame);
    }
  }

  #evaluateSimplifiedStaminaFrame(frame) {
    this.#lastStaminaBalanceFrame = frame;
    const mode = frame.staminaMode || "idle";
    if (mode === "drain") {
      const damage = Math.max(
        0,
        Number(frame.activeStaminaDrain ?? frame.totalStaminaDrain) || 0,
      );
      if (damage > 0) this.#condition.applyStaminaDamage(damage);
    } else if (mode === "regen") {
      const regen = Math.max(
        0,
        Number(frame.passiveStaminaRegen ?? frame.staminaRegen) || 0,
      );
      if (regen > 0) this.#condition.applyStaminaRegen(regen);
    }
    this.#recoverEnduranceInStaminaPhase(frame);
  }

  #evaluateSimplifiedEnduranceFrame(frame, dt) {
    this.#lastStaminaBalanceFrame = frame;
    if (this.#condition.currentExhaustion <= 0) {
      this.#applyFinalDebuffIfExhausted();
      return;
    }
    const mode = frame.staminaMode || "idle";
    if (mode === "regen") {
      const regen = Math.max(
        0,
        Number(frame.passiveStaminaRegen ?? frame.staminaRegen) || 0,
      );
      if (regen > 0) {
        this.#condition.applyExhaustionStaminaRegen?.(regen);
      }
      if (frame.nextPhase === "stamina") {
        this.#returnToStaminaPhase();
        return;
      }
    }

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

  #returnToStaminaPhase() {
    this.#masteryTimer = 0;
    if (this.#isMasteryActive) {
      this.#isMasteryActive = false;
      this.#fish.clearMasteryDebuff?.();
    }
    this.#fish.setMasteryMultiplier?.(1.0);
    this.#condition.breakExhaustion?.();
  }

  #recoverEnduranceInStaminaPhase(frame) {
    if (this.#condition.phase !== "stamina") return;
    if ((frame.framePhase ?? frame.phase) !== "stamina") return;

    const recovery = this.#enduranceRecoveryConfig();
    if (recovery.enabled === false) return;
    if (
      recovery.requiresFullStamina !== false &&
      this.#condition.currentStamina < this.#maxStamina()
    ) {
      return;
    }

    const recoveryPerSecond = this.#positive(recovery.recoveryPerSecond, 30);
    const recoveryAmount = recoveryPerSecond * this.#positive(frame.dtSec, 0);
    if (recoveryAmount <= 0) return;

    const capRatio = this.#clamp01(recovery.maxRecoveryRatio ?? 0.8);
    const recoveryCap = this.#maxEndurance() * capRatio;
    if (this.#condition.currentExhaustion >= recoveryCap) return;
    if (typeof this.#condition.applyExhaustionRegen !== "function") return;

    this.#condition.applyExhaustionRegen(recoveryAmount, recoveryCap);
    this.#syncFramePowerDebuffWithEndurance();
  }

  #enduranceRecoveryConfig() {
    const config = this.#mechanicsConfig.enduranceRecovery;
    return config && typeof config === "object" ? config : { enabled: false };
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
      powerDebuffConfig.minBasePowerRatio ?? 0.2,
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
  }

  #applyFinalDebuffIfExhausted() {
    if (this.#condition.currentExhaustion > 0) return;
    if (!this.#fish.hasActiveDebuff) {
      this.#fish.applyRandomDebuff(this.#mechanicsConfig.debuffs);
    }
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
