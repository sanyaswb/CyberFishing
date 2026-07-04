class StaminaTransitionResolver {
  resolve({
    phase = "stamina",
    currentStamina = 0,
    maxStamina = 1,
    playerFatigueProgress = 0,
    controlExhausted = false,
    staminaRecoveryFromExhaustionActive = false,
    config = {},
  } = {}) {
    const resolvedPhase = this.#normalizePhase(phase);
    const stamina = this.#positive(currentStamina);
    const max = Math.max(0.001, this.#positive(maxStamina, 1));
    const fatigueFull =
      this.#clamp01(playerFatigueProgress) >= 1 ||
      controlExhausted === true;
    const regenConfig = config.regen || {};
    const afterExhaustion = regenConfig.afterExhaustion || {};
    const threshold =
      max * this.#clamp01(afterExhaustion.phaseReturnThresholdRatio ?? 0.001);

    if (resolvedPhase === "stamina" && stamina <= 0) {
      return Object.freeze({
        nextPhase: "exhaustion",
        staminaRecoveryFromExhaustionActive: false,
        transitionReason: "stamina_zero",
        phaseReturnThreshold: threshold,
      });
    }

    if (resolvedPhase === "exhaustion") {
      const recoveryActive =
        staminaRecoveryFromExhaustionActive === true || fatigueFull;
      if (recoveryActive && stamina >= threshold && threshold > 0) {
        return Object.freeze({
          nextPhase: "stamina",
          staminaRecoveryFromExhaustionActive: false,
          transitionReason: "stamina_recovered_from_exhaustion",
          phaseReturnThreshold: threshold,
        });
      }
      return Object.freeze({
        nextPhase: "exhaustion",
        staminaRecoveryFromExhaustionActive: recoveryActive,
        transitionReason: recoveryActive
          ? "fatigue_full_recovery"
          : "exhaustion_locked",
        phaseReturnThreshold: threshold,
      });
    }

    return Object.freeze({
      nextPhase: "stamina",
      staminaRecoveryFromExhaustionActive: false,
      transitionReason: "none",
      phaseReturnThreshold: threshold,
    });
  }

  #normalizePhase(value) {
    const text = String(value || "stamina").trim().toLowerCase();
    return text === "exhaustion" ? "exhaustion" : "stamina";
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }
}

if (typeof window !== "undefined") {
  window.StaminaTransitionResolver = StaminaTransitionResolver;
}
