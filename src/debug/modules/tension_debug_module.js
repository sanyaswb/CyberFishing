class TensionDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "tension", title: "Tension" });
  }

  render(context) {
    const live = context.live || {};
    const config = typeof CONFIG !== "undefined" ? CONFIG.tension || {} : {};
    const maxTackleLoadKg = Number(
      live.maxTackleLoadKg ?? live.playerMaxPowerY,
    );
    const fishForceKg =
      Number(live.totalFishForceKg) ||
      Math.hypot(Number(live.fishForceY) || 0, Number(live.fishForceX) || 0);
    const dragLimitKg = Number(live.dragLimitKg) || 0;
    const tensionKg = Number(live.tensionKg) || 0;
    const tensionRatio = Number.isFinite(maxTackleLoadKg)
      ? tensionKg / Math.max(0.001, maxTackleLoadKg)
      : NaN;

    console.table({
      "Current tension kg": DebugFormatters.number(tensionKg, 3),
      "Current tension %": DebugFormatters.number(
        live.tension ?? live.tensionPercent,
        2,
      ),
      "Max tackle load kg": DebugFormatters.number(maxTackleLoadKg, 3),
      "Fish force kg": DebugFormatters.number(fishForceKg, 3),
      "Drag limit kg": DebugFormatters.number(dragLimitKg, 3),
      "Tension / max load": DebugFormatters.number(tensionRatio, 3),
      "Kg smoothing / sec": DebugFormatters.number(
        config.kgSmoothPerSecond,
        3,
      ),
      "Break threshold %": DebugFormatters.number(config.breakThreshold, 2),
      "Formula source":
        "FightPhysicsSystem.calculateTensionKg + TackleStressSystem",
    });
  }
}

window.TensionDebugModule = TensionDebugModule;
