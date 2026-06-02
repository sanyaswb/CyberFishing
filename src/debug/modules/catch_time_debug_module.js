class CatchTimeDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "catchTime", title: "Catch Time" });
  }

  render(context) {
    const live = context.live || {};
    const fish = DebugDataSelectors.lastKnownFish(context);
    const durationMs = Number(live.exhaustionDurationMs);
    const masteryRatio =
      typeof CONFIG !== "undefined"
        ? CONFIG.stamina?.mechanics?.masteryTimeRatio ?? 0.5
        : 0.5;

    console.table({
      Fish: fish ? fish.name || fish.id : "n/a",
      "Weight kg": fish
        ? `${DebugFormatters.number(fish.weight, 3)} kg`
        : "n/a",
      Level: fish?.level ?? "n/a",
      "Ideal exhaustion duration": DebugFormatters.ms(durationMs),
      "Mastery starts after": Number.isFinite(durationMs)
        ? DebugFormatters.ms(durationMs * masteryRatio)
        : "n/a",
      "Data source": Number.isFinite(durationMs)
        ? "StaminaController.getExhaustionDurationMs"
        : "waiting for live fight data",
    });
  }
}

window.CatchTimeDebugModule = CatchTimeDebugModule;
