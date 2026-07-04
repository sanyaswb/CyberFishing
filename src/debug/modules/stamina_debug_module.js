class StaminaDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "stamina", title: "Stamina" });
  }

  render(context) {
    const live = context.live || {};
    const config =
      typeof CONFIG !== "undefined" ? CONFIG.stamina?.mechanics || {} : {};

    console.table({
      "Fish condition phase": live.fishConditionPhase || "n/a",
      "Stamina frame phase": live.staminaPhase || "n/a",
      "Stamina model": live.staminaModelMode || "legacy",
      "Stamina mode": live.staminaMode || "idle",
      "Transition reason": live.staminaTransitionReason || "none",
      "Recovery trigger": live.staminaRecoveryTrigger || "none",
      "Raw stamina input active": live.rawStaminaInputActive === true,
      "No-input elapsed": DebugFormatters.ms(live.staminaNoInputElapsedMs),
      "No-input timeout": DebugFormatters.ms(live.staminaNoInputTimeoutMs),
      "No-input recovery ready": live.staminaNoInputRecoveryReady === true,
      "Fish state": live.fishState || "n/a",
      "Current stamina": DebugFormatters.number(live.currentStamina, 3),
      "Current exhaustion": DebugFormatters.number(live.currentExhaustion, 3),
      "Max stamina": DebugFormatters.number(
        live.fishConditionMaxStamina,
        3,
      ),
      "Max endurance": DebugFormatters.number(
        live.fishConditionMaxEndurance,
        3,
      ),
      "Applied rodHold kg": DebugFormatters.number(
        live.staminaAppliedRodHoldKg,
        3,
      ),
      "Applied control kg": DebugFormatters.number(
        live.staminaAppliedControlKg,
        3,
      ),
      "Used player pressure kg": DebugFormatters.number(
        live.staminaUsedPlayerPressureKg,
        3,
      ),
      "Player stamina pressure kg": DebugFormatters.number(
        live.playerStaminaPressureKg,
        3,
      ),
      "Fish stamina resistance kg": DebugFormatters.number(
        live.fishStaminaResistanceKg,
        3,
      ),
      "Player advantage ratio": DebugFormatters.number(
        live.playerAdvantageRatio,
        3,
      ),
      "Stamina drain multiplier": DebugFormatters.number(
        live.staminaDrainMultiplier,
        3,
      ),
      "Lateral edge ratio": DebugFormatters.number(
        live.lateralEdgeRatio,
        3,
      ),
      "Hold stamina multiplier": DebugFormatters.number(
        live.holdStaminaDrainMultiplier,
        3,
      ),
      "Control stamina multiplier": DebugFormatters.number(
        live.controlStaminaDrainMultiplier,
        3,
      ),
      "Control centering factor": DebugFormatters.number(
        live.controlCenteringFactor,
        3,
      ),
      "Control direction state": live.controlDirectionState || "unknown",
      "Weakest tackle limit kg": DebugFormatters.number(
        live.staminaWeakestTackleLimitKg,
        3,
      ),
      "Active drain ratio": DebugFormatters.number(
        live.staminaActiveDrainRatio,
        3,
      ),
      "Active drain/sec": DebugFormatters.number(
        live.staminaActiveDrainPerSecond,
        3,
      ),
      "Passive stamina regen/sec": DebugFormatters.number(
        live.staminaPassiveRegenPerSecond,
        3,
      ),
      "Line angle deg": DebugFormatters.number(
        live.staminaLineAngleDeg,
        2,
      ),
      "Angle regen multiplier": DebugFormatters.number(
        live.staminaAngleRegenMultiplier,
        3,
      ),
      "Fatigue regen multiplier": DebugFormatters.number(
        live.fatigueRegenMultiplier,
        3,
      ),
      "Regen delay active": live.staminaRegenDelayActive === true,
      "Net stamina/sec": DebugFormatters.number(
        live.staminaNetPerSecond,
        3,
      ),
      "Active endurance/sec": DebugFormatters.number(
        live.enduranceActiveDrainPerSecond,
        3,
      ),
      "Passive endurance/sec": DebugFormatters.number(
        live.endurancePassiveDrainPerSecond,
        3,
      ),
      "Total endurance/sec": DebugFormatters.number(
        live.enduranceTotalDrainPerSecond,
        3,
      ),
      "Endurance resistance ratio": DebugFormatters.number(
        live.enduranceResistanceRatio,
        3,
      ),
      "Endurance line taut ratio": DebugFormatters.number(
        live.enduranceLineTautRatio,
        3,
      ),
      "Endurance behavior": `${live.enduranceBehaviorName || "unknown"} x${DebugFormatters.number(
        live.enduranceBehaviorMultiplier,
        3,
      )}`,
      "Budget overflow warning": live.staminaBudgetOverflowWarning === true,
      "Mastery active": live.isMasteryActive === true,
      "Mastery timer": DebugFormatters.ms(live.masteryTimerMs),
      "Mastery multiplier live": DebugFormatters.number(
        live.masteryCurrentMult,
        3,
      ),
      "Exhaustion duration live": DebugFormatters.ms(
        live.exhaustionDurationMs,
      ),
    });
  }
}

window.StaminaDebugModule = StaminaDebugModule;
