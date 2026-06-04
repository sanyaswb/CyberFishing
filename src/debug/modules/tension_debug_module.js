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
      "Effective tension kg": DebugFormatters.number(
        live.effectiveTensionKg,
        3,
      ),
      "Main tackle limit kg": DebugFormatters.number(
        live.mainTackleLimitKg,
        3,
      ),
      "Overload kg": DebugFormatters.number(live.overloadKg, 3),
      "Stress overloaded": !!live.stressWasOverloaded,
      "Stress value": DebugFormatters.number(live.stressValue, 3),
      "Stress capacity": DebugFormatters.number(live.stressCapacity, 3),
      "Stress ratio": DebugFormatters.number(live.stressRatio, 3),
      "Stress gain / sec": DebugFormatters.number(
        live.stressGainPerSecond,
        3,
      ),
      "Stress recovery / sec": DebugFormatters.number(
        live.stressRecoveryPerSecond,
        3,
      ),
      "Failure roll timer ms": DebugFormatters.number(
        live.failureRollTimerMs,
        1,
      ),
      "Failure roll interval ms": DebugFormatters.number(
        live.failureRollIntervalMs,
        1,
      ),
      "Failure chance": DebugFormatters.number(live.failureChance, 3),
      "Failure source": live.failureSource || "n/a",
      "Last roll value": DebugFormatters.number(live.lastRollValue, 3),
      "Last roll passed": !!live.lastRollPassed,
      "Guaranteed failure": !!live.guaranteedFailure,
      "Selected failure component": live.selectedFailureComponent || "n/a",
      "Tie-break priority": Array.isArray(live.tieBreakPriority)
        ? live.tieBreakPriority.join(" > ")
        : "n/a",
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
