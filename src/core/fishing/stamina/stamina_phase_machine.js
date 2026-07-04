class StaminaPhaseMachine {
  #pressureResolver;
  #drainCalculator;
  #regenCalculator;
  #transitionResolver;
  #staminaRecoveryFromExhaustionActive = false;
  #staminaNoInputElapsedMs = 0;

  constructor({
    pressureResolver = new StaminaPressureResolver(),
    drainCalculator = new StaminaDrainCalculator(),
    regenCalculator = new StaminaRegenCalculator(),
    transitionResolver = new StaminaTransitionResolver(),
  } = {}) {
    this.#pressureResolver = pressureResolver;
    this.#drainCalculator = drainCalculator;
    this.#regenCalculator = regenCalculator;
    this.#transitionResolver = transitionResolver;
  }

  reset() {
    this.#staminaRecoveryFromExhaustionActive = false;
    this.#staminaNoInputElapsedMs = 0;
  }

  createFrame({
    phase = "stamina",
    currentStamina = 0,
    maxStamina = 1,
    rodHoldKg = 0,
    reelHoldKg = 0,
    controlKg = 0,
    controlExhausted = false,
    fishLateralContext = {},
    controlDirectionX = 0,
    rawStaminaInputActive = false,
    fishStaminaResistanceKg = 0,
    playerFatigueProgress = 0,
    lineAngleDeg = 0,
    dtSec = 0,
    config = {},
  } = {}) {
    const resolvedPhase = this.#normalizePhase(phase);
    const mechanics = config || {};
    const pressureConfig = mechanics.pressure || {};
    const drainConfig = mechanics.drain || {};
    const regenConfig = mechanics.regen || {};
    const pressureFrame = this.#pressureResolver.resolve({
      rodHoldKg,
      reelHoldKg,
      controlKg,
      controlExhausted,
      fishLateralContext,
      controlDirectionX,
      config: pressureConfig,
    });
    const pressureThresholdKg = this.#positive(
      pressureConfig.thresholdKg,
      0.01,
    );
    const playerFatigue = this.#clamp01(playerFatigueProgress);
    const playerFatigueFull =
      playerFatigue >= 1;
    const noInputFrame = this.#updateNoInputState({
      phase: resolvedPhase,
      rawStaminaInputActive,
      dtSec,
      config: regenConfig.afterExhaustion?.inactivityRecovery || {},
    });
    const recoveryTrigger = this.#resolveRecoveryTrigger({
      playerFatigueFull,
      controlExhausted,
      noInputRecoveryReady: noInputFrame.staminaNoInputRecoveryReady,
      alreadyRecovering: this.#staminaRecoveryFromExhaustionActive,
    });
    const recoveryFromExhaustionAllowed = recoveryTrigger !== "none";
    const pressureActive =
      pressureFrame.playerStaminaPressureKg > pressureThresholdKg;
    const beforeExhaustion = regenConfig.beforeExhaustion || {};
    const afterExhaustion = regenConfig.afterExhaustion || {};
    const canDrain =
      resolvedPhase === "stamina" &&
      pressureActive &&
      !playerFatigueFull;
    const recoveryAllowed =
      canDrain
        ? false
        : resolvedPhase === "stamina"
          ? (
              (
                beforeExhaustion.immediateOnNoPressure !== false &&
                !pressureActive
              ) ||
              (
                beforeExhaustion.allowWhenPlayerFatigueFull !== false &&
                playerFatigueFull
              )
            )
          : (
              (
                afterExhaustion.allowOnlyWhenPlayerFatigueFull !== false &&
                recoveryFromExhaustionAllowed
              ) ||
              this.#staminaRecoveryFromExhaustionActive
            );
    const drainFrame = this.#drainCalculator.calculate({
      playerStaminaPressureKg: pressureFrame.playerStaminaPressureKg,
      fishStaminaResistanceKg,
      pressureThresholdKg,
      baseDrainPerSecond: drainConfig.baseDrainPerSecond,
      dtSec,
      config: drainConfig,
    });
    const regenFrame = this.#regenCalculator.calculate({
      recoveryAllowed,
      playerFatigueProgress: playerFatigue,
      lineAngleDeg,
      baseRegenPerSecond: regenConfig.baseRegenPerSecond,
      dtSec,
      config: regenConfig,
    });
    const staminaBefore = this.#positive(currentStamina);
    const max = Math.max(0.001, this.#positive(maxStamina, 1));
    const staminaMode = canDrain && drainFrame.shouldDrain
      ? "drain"
      : regenFrame.shouldRegen
        ? "regen"
        : "idle";
    const staminaDelta =
      staminaMode === "drain"
        ? -drainFrame.staminaDrain
        : staminaMode === "regen"
          ? regenFrame.staminaRegen
          : 0;
    const staminaAfter = Math.max(0, Math.min(max, staminaBefore + staminaDelta));
    const transitionFrame = this.#transitionResolver.resolve({
      phase: resolvedPhase,
      currentStamina: staminaAfter,
      maxStamina: max,
      playerFatigueProgress: playerFatigue,
      controlExhausted,
      staminaNoInputRecoveryReady: noInputFrame.staminaNoInputRecoveryReady,
      recoveryTrigger,
      staminaRecoveryFromExhaustionActive:
        this.#staminaRecoveryFromExhaustionActive || staminaMode === "regen",
      config: mechanics,
    });
    this.#staminaRecoveryFromExhaustionActive =
      transitionFrame.staminaRecoveryFromExhaustionActive === true;

    return Object.freeze({
      source: "simplified_stamina_model",
      staminaModelMode: "simplified",
      phase: resolvedPhase,
      nextPhase: transitionFrame.nextPhase,
      staminaMode,
      staminaBefore,
      staminaAfter,
      staminaDelta,
      currentStamina: staminaBefore,
      maxStamina: max,
      playerStaminaPressureKg: pressureFrame.playerStaminaPressureKg,
      fishStaminaResistanceKg: this.#positive(fishStaminaResistanceKg),
      pressureThresholdKg,
      pressureActive,
      drainPerSecond: staminaMode === "drain" ? drainFrame.drainPerSecond : 0,
      staminaDrain: staminaMode === "drain" ? drainFrame.staminaDrain : 0,
      regenPerSecond: staminaMode === "regen" ? regenFrame.regenPerSecond : 0,
      staminaRegen: staminaMode === "regen" ? regenFrame.staminaRegen : 0,
      playerAdvantageRatio: drainFrame.playerAdvantageRatio,
      clampedAdvantageRatio: drainFrame.clampedAdvantageRatio,
      drainMultiplier: drainFrame.drainMultiplier,
      lateralEdgeRatio: pressureFrame.lateralEdgeRatio,
      fishSide: pressureFrame.fishSide,
      expectedControlDirectionToCenter:
        pressureFrame.expectedControlDirectionToCenter,
      holdDrainMultiplier: pressureFrame.holdDrainMultiplier,
      controlDrainMultiplier: pressureFrame.controlDrainMultiplier,
      controlCenteringFactor: pressureFrame.controlCenteringFactor,
      controlDirectionState: pressureFrame.controlDirectionState,
      rodHoldStaminaPressureKg: pressureFrame.rodHoldStaminaPressureKg,
      reelHoldStaminaPressureKg: pressureFrame.reelHoldStaminaPressureKg,
      controlStaminaPressureKg: pressureFrame.controlStaminaPressureKg,
      angleRegenMultiplier: regenFrame.angleRegenMultiplier,
      fatigueRegenMultiplier: regenFrame.fatigueRegenMultiplier,
      playerFatigueProgress: playerFatigue,
      playerFatigueFull,
      rawStaminaInputActive: rawStaminaInputActive === true,
      staminaNoInputElapsedMs: noInputFrame.staminaNoInputElapsedMs,
      staminaNoInputTimeoutMs: noInputFrame.staminaNoInputTimeoutMs,
      staminaNoInputRecoveryReady:
        noInputFrame.staminaNoInputRecoveryReady,
      staminaRecoveryTrigger: recoveryTrigger,
      transitionReason: transitionFrame.transitionReason,
      phaseReturnThreshold: transitionFrame.phaseReturnThreshold,
      staminaRecoveryFromExhaustionActive:
        this.#staminaRecoveryFromExhaustionActive,
    });
  }

  #updateNoInputState({
    phase,
    rawStaminaInputActive,
    dtSec,
    config,
  }) {
    const enabled = config.enabled === true;
    const timeoutMs = this.#positive(config.noInputTimeoutMs, 5000);
    if (phase !== "exhaustion") {
      this.#staminaNoInputElapsedMs = 0;
    } else if (rawStaminaInputActive === true) {
      this.#staminaNoInputElapsedMs = 0;
    } else {
      this.#staminaNoInputElapsedMs += this.#positive(dtSec) * 1000;
    }
    return Object.freeze({
      staminaNoInputElapsedMs: this.#staminaNoInputElapsedMs,
      staminaNoInputTimeoutMs: timeoutMs,
      staminaNoInputRecoveryReady:
        enabled && this.#staminaNoInputElapsedMs >= timeoutMs,
    });
  }

  #resolveRecoveryTrigger({
    playerFatigueFull,
    controlExhausted,
    noInputRecoveryReady,
    alreadyRecovering,
  }) {
    if (playerFatigueFull === true) return "fatigue_full";
    if (controlExhausted === true) return "control_exhausted";
    if (noInputRecoveryReady === true) return "no_input_timeout";
    if (alreadyRecovering === true) return "already_recovering";
    return "none";
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
  window.StaminaPhaseMachine = StaminaPhaseMachine;
}
