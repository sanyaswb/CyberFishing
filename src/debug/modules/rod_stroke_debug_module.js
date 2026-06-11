class RodStrokeDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "rodStroke", title: "Rod Stroke" });
  }

  render(context) {
    const live = context.live || {};
    console.table({
      "Rod pull active": live.rodPullActive === true,
      "Active pull force kg": DebugFormatters.number(
        live.activeRodPullForceKg ?? live.rodPullForceKg,
        3,
      ),
      "Rod hold kg": DebugFormatters.number(live.rodPullForceKg, 3),
      "Effective rod hold kg": DebugFormatters.number(
        live.effectiveRodHoldKg,
        3,
      ),
      "Hold tension ratio": DebugFormatters.number(live.holdTensionRatio, 3),
      "Player hold tension kg": DebugFormatters.number(
        live.playerHoldTensionKg,
        3,
      ),
      "Fish opposition kg": DebugFormatters.number(
        live.fishOppositionKg ?? live.totalFishForceKg,
        3,
      ),
      "Max tackle load kg": DebugFormatters.number(live.maxTackleLoadKg, 3),
      "Drag limit kg": DebugFormatters.number(live.dragLimitKg, 3),
      "Available extra kg": DebugFormatters.number(
        live.availableExtraForceKg,
        3,
      ),
      "Charge speed multiplier": DebugFormatters.number(
        live.rodPullChargeSpeedMultiplier,
        3,
      ),
      "Charge per second": DebugFormatters.number(
        live.rodPullChargePerSecond,
        3,
      ),
      "Rod stroke ratio": `${DebugFormatters.number((Number(live.rodStrokeRatio) || 0) * 100, 1)}%`,
      "Rod stroke used": `${DebugFormatters.number(live.rodStrokeUsedMeters, 2)} / ${DebugFormatters.number(live.rodStrokeCapacityMeters, 2)} m`,
      "Rod stroke unrecovered": DebugFormatters.number(
        live.rodStrokeUnrecoveredMeters,
        2,
      ),
      "Stroke distance gained": DebugFormatters.number(
        live.strokeDistanceGainedMeters,
        3,
      ),
      "Stroke distance lost": DebugFormatters.number(
        live.strokeDistanceLostMeters,
        3,
      ),
      "Stroke distance reason": live.strokeDistanceReason || "none",
      "Pump credit meters": DebugFormatters.number(
        live.pumpCreditMeters ?? live.slackMeters,
        2,
      ),
      "Pump credit penalty": DebugFormatters.number(
        live.pumpCreditPenaltyMeters ?? live.slackPenaltyMeters,
        2,
      ),
      "Actual loose line": DebugFormatters.number(live.actualSlackMeters, 2),
      "Reel recovering line credit": live.reelRecoveringSlack === true,
      "Hard line limit": live.hardLineLimit === true,
      Result: live.rodPullCanMoveFish ? "MOVING_FISH" : "NO_PULL",
      "Blocked reason": live.rodPullBlockedReason || "none",
    });
  }
}

window.RodStrokeDebugModule = RodStrokeDebugModule;
