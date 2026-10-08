import { LandingPolicyResolver } from "../../domain/fishing/landing_policy_resolver.js";

export class CatchResolutionService {
  #landingPolicyResolver;
  #logger;
  #isLogEnabled;

  // logger + isLogEnabled: the DEV catch-resolution console report (DEBUG_MODULES.catchResolution), composed by bootstrap.
  constructor({ landingPolicyResolver = null, logger = null, isLogEnabled = null } = {}) {
    this.#landingPolicyResolver = landingPolicyResolver || new LandingPolicyResolver();
    this.#logger = logger;
    this.#isLogEnabled = isLogEnabled;
  }

  reset() {}

  resolveAutoCatch({
    fishData,
    lineDistanceMeters,
    shoreLandingDistanceMeters,
    maxTackleLoadKg,
    config,
    rod = null,
    reel = null,
    landingFrame = null,
    fightDebug = null,
  }) {
    const physicsConfig = config?.fightPhysicsConfig;
    const cfg = physicsConfig?.getCatchZoneConfig?.() || {};
    const landingPolicy = this.#landingPolicyResolver.resolve({ rod, reel });
    const landingDistanceMeters = landingPolicy.getLandingDistanceMeters({
      rod,
      reel,
      config,
      lineDistanceMeters,
      fishData,
      maxTackleLoadKg,
    });
    const rawShoreDistanceMeters = Number(
      landingFrame?.shoreLandingDistanceMeters ??
        shoreLandingDistanceMeters ??
        lineDistanceMeters,
    );
    const shoreDistanceMeters = Number.isFinite(rawShoreDistanceMeters)
      ? Math.max(0, rawShoreDistanceMeters)
      : Infinity;
    if (shoreDistanceMeters > landingDistanceMeters) return {};

    const readiness = this.#resolveLandingReadiness({
      physicsConfig,
      landingFrame,
    });
    const landingReady = readiness.ready;
    const success = this.#canLandByWeight({
      fishWeightKg: fishData?.weight,
      maxTackleLoadKg,
      config: cfg,
    }) && landingReady;
    const transition = success
      ? { name: "victory", data: { fish: fishData } }
      : null;
    if (transition) {
      this.#logAutoCatchVictory({
        fishData,
        shoreDistanceMeters,
        landingDistanceMeters,
        landingPolicy,
        maxTackleLoadKg,
        catchConfig: cfg,
        landingReady,
        readiness,
        landingFrame,
        fightDebug,
      });
    }
    return {
      inLandingZone: true,
      landingReady,
      landingReadyReason: readiness.reason,
      landingReadiness: readiness,
      success,
      shoreLandingDistanceMeters: shoreDistanceMeters,
      landingDistanceMeters,
      landingPolicy: landingPolicy.constructor?.name || "LandingPolicy",
      transition,
    };
  }

  resolveNetAttempt(net, fishWeight, rng, fishData) {
    const chance = net.calculateCatchChance(fishWeight);
    const roll = rng.range(0, 100);
    const success = chance > 0 && roll < chance;
    return {
      chance,
      roll,
      success,
      transition: {
        name: success ? "victory" : "failed",
        data: { reason: success ? null : "net_escape", fish: fishData },
      },
    };
  }

  #canLandByWeight({ fishWeightKg, maxTackleLoadKg, config }) {
    const fishWeight = Math.max(0, Number(fishWeightKg) || 0);
    const maxLoad = Math.max(0, Number(maxTackleLoadKg) || 0);
    if (maxLoad <= 0) return false;

    const maxRatio = Math.max(0, Number(config.maxLoadWeightRatio) || 1.0);
    return fishWeight <= maxLoad * maxRatio + 0.0001;
  }

  #resolveLandingReadiness({ physicsConfig, landingFrame }) {
    if (landingFrame?.readiness) {
      return landingFrame.readiness;
    }

    const liftConfig = physicsConfig?.getLandingLiftConfig?.() || {};
    if (liftConfig.enabled === false) {
      return {
        ready: true,
        reason: "landing_lift_disabled",
      };
    }

    return {
      ready: false,
      reason: "landing_frame_missing",
      liftRequiredKg: 0,
      liftHoldKg: 0,
      supportedTensionKg: 0,
      rawTensionKg: 0,
      visibleTensionKg: 0,
      dragSlipping: false,
    };
  }

  #logAutoCatchVictory({
    fishData,
    shoreDistanceMeters,
    landingDistanceMeters,
    landingPolicy,
    maxTackleLoadKg,
    catchConfig,
    landingReady,
    readiness,
    landingFrame,
    fightDebug,
  }) {
    if (!this.#logger || this.#isLogEnabled?.() !== true) return;

    const fishWeightKg = Math.max(0, Number(fishData?.weight) || 0);
    const maxRatio = Math.max(
      0,
      Number(catchConfig?.maxLoadWeightRatio) || 1,
    );
    const maxAllowedWeightKg =
      Math.max(0, Number(maxTackleLoadKg) || 0) * maxRatio;
    const reason =
      landingReady
        ? "landing_lift_ready"
        : readiness?.reason || "landing_lift_disabled_or_legacy";
    const lift = landingFrame?.lift || {};
    const tension = landingFrame?.tension || {};
    const values = {
      reason,
      fishId: fishData?.id || fishData?.name || "unknown",
      fishWeightKg,
      maxTackleLoadKg: Number(maxTackleLoadKg) || 0,
      maxAllowedWeightKg,
      maxLoadWeightRatio: maxRatio,
      lineDistanceMeters:
        Number(landingFrame?.lineDistanceMeters ?? fightDebug?.lineDistanceMeters) || 0,
      shoreLandingDistanceMeters: shoreDistanceMeters,
      landingDistanceMeters,
      landingPolicy: landingPolicy?.constructor?.name || "LandingPolicy",
      landingReady: !!landingReady,
      landingReadyReason: readiness?.reason || "not_checked",
      landingLiftActive: !!(lift.active ?? fightDebug?.landingLiftActive),
      landingLiftInZone: !!(lift.inLandingZone ?? fightDebug?.landingLiftInZone),
      landingLiftHoldKg:
        Number(lift.liftHoldKg ?? fightDebug?.landingLiftHoldKg) || 0,
      landingLiftMaxKg:
        Number(lift.liftMaxKg ?? fightDebug?.landingLiftMaxKg) || 0,
      landingLiftWaterTensionKg:
        Number(lift.waterFightTensionKg ?? fightDebug?.landingLiftWaterTensionKg) || 0,
      landingLiftFishTensionKg:
        Number(lift.fishTensionKg ?? fightDebug?.landingLiftFishTensionKg) || 0,
      landingLiftProgressRatio:
        Number(lift.progressRatio ?? fightDebug?.landingLiftProgressRatio) || 0,
      landingLiftTackleLoadProgressRatio:
        Number(
          lift.tackleLoadProgressRatio ??
            fightDebug?.landingLiftTackleLoadProgressRatio,
        ) || 0,
      landingLiftSlowdownRatio:
        Number(lift.slowdownRatio ?? fightDebug?.landingLiftSlowdownRatio) || 0,
      landingLiftSpeedRatio:
        Number(lift.speedRatio ?? fightDebug?.landingLiftSpeedRatio) || 0,
      landingLiftGainKgPerSecond:
        Number(lift.gainKgPerSecond ?? fightDebug?.landingLiftGainKgPerSecond) || 0,
      tensionKg: Number(fightDebug?.tensionKg) || 0,
      targetTensionKg: Number(fightDebug?.targetTensionKg) || 0,
      supportedTensionKg:
        Number(readiness?.supportedTensionKg ?? tension.supportedTensionKg) || 0,
      totalTensionKg:
        Number(tension.totalTensionKg ?? fightDebug?.totalTensionKg) || 0,
      rawTensionKg:
        Number(tension.rawTensionKg ?? fightDebug?.rawTensionKg) || 0,
      rawTotalTensionKg:
        Number(tension.rawTotalTensionKg ?? fightDebug?.rawTotalTensionKg) || 0,
      visibleTensionKg:
        Number(tension.visibleTensionKg ?? fightDebug?.visibleTensionKg) || 0,
      fishTensionKg:
        Number(lift.fishTensionKg ?? fightDebug?.fishTensionKg) || 0,
      playerHoldTensionKg: Number(fightDebug?.playerHoldTensionKg) || 0,
      rodHoldKg: Number(fightDebug?.activeRodPullForceKg) || 0,
      rodHoldMaxKg: Number(fightDebug?.rodHoldMaxKg) || 0,
      effectiveRodHoldKg: Number(fightDebug?.effectiveRodHoldKg) || 0,
      holdTensionRatio: Number(fightDebug?.holdTensionRatio) || 0,
      rodStrokeRatio: Number(fightDebug?.rodStrokeRatio) || 0,
      rodPullBlockedReason: fightDebug?.rodPullBlockedReason || "none",
      rodPullDragSlipping: !!fightDebug?.rodPullDragSlipping,
      dragLimitKg: Number(fightDebug?.dragLimitKg) || 0,
      dragLocked: !!fightDebug?.dragLocked,
      reelSlip: !!fightDebug?.reelSlip,
      rodStressRatio: Number(fightDebug?.rodStressRatio) || 0,
      lineStressRatio: Number(fightDebug?.lineStressRatio) || 0,
      hookStressRatio: Number(fightDebug?.hookStressRatio) || 0,
      lineCanRelease: !!fightDebug?.lineCanRelease,
      hardLineLimit: !!fightDebug?.hardLineLimit,
    };

    this.#logger.groupCollapsed("[CatchResolution] victory: " + reason);
    this.#logger.table(values);
    this.#logger.groupEnd();
  }
}
