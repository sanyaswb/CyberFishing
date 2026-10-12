import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class StaminaTransitionResolver {
  resolve({
    phase = "stamina",
    currentStamina = 0,
    maxStamina = 1,
    playerFatigueProgress = 0,
    controlExhausted = false,
    staminaNoInputRecoveryReady = false,
    recoveryTrigger = "none",
    staminaRecoveryFromExhaustionActive = false,
    config = {},
  } = {}) {
    const resolvedPhase = this.#normalizePhase(phase);
    const stamina = nonNegativeOr(currentStamina);
    const max = Math.max(0.001, nonNegativeOr(maxStamina, 1));
    const fatigueFull =
      clampUnitFinite(playerFatigueProgress) >= 1;
    const recoveryFromExhaustionAllowed =
      fatigueFull ||
      controlExhausted === true ||
      staminaNoInputRecoveryReady === true ||
      staminaRecoveryFromExhaustionActive === true;
    const regenConfig = config.regen || {};
    const afterExhaustion = regenConfig.afterExhaustion || {};
    const threshold =
      max * clampUnitFinite(afterExhaustion.phaseReturnThresholdRatio ?? 0.001);

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
        recoveryFromExhaustionAllowed;
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
          ? `${recoveryTrigger || "already_recovering"}_recovery`
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
}
