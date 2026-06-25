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
      "Base depletion rate": DebugFormatters.number(
        config.baseDepletionRate,
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
      "Line angle deg": DebugFormatters.number(
        live.staminaLineAngleDeg,
        2,
      ),
      "Angle recovery ratio": DebugFormatters.number(
        live.staminaAngleRecoveryRatio,
        3,
      ),
      "Angle regen/sec": DebugFormatters.number(
        live.staminaAngleRegenPerSecond,
        3,
      ),
      "Net stamina/sec": DebugFormatters.number(
        live.staminaNetPerSecond,
        3,
      ),
      "Budget overflow warning": live.staminaBudgetOverflowWarning === true,
      "Edge regen rate": DebugFormatters.number(config.edgeRegenRate, 3),
      "Regen multiplier phase 1": DebugFormatters.number(
        config.regenMultiplierPhase1,
        3,
      ),
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
