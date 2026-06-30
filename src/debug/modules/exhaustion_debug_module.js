class ExhaustionDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "exhaustion", title: "Exhaustion" });
  }

  render(context) {
    const live = context.live || {};
    const config =
      typeof CONFIG !== "undefined" ? CONFIG.stamina?.mechanics || {} : {};

    console.table({
      "Fish condition phase": live.fishConditionPhase || "n/a",
      "Current exhaustion": DebugFormatters.number(live.currentExhaustion, 3),
      "Max endurance": DebugFormatters.number(
        live.fishConditionMaxEndurance,
        3,
      ),
      "Duration live": DebugFormatters.ms(live.exhaustionDurationMs),
      "Mastery time ratio": DebugFormatters.number(
        config.masteryTimeRatio,
        3,
      ),
      "Mastery power multiplier": DebugFormatters.number(
        config.masteryPowerMultiplier,
        3,
      ),
      "Active debuff": live.activeDebuffName || "n/a",
    });
  }
}

window.ExhaustionDebugModule = ExhaustionDebugModule;
