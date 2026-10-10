import { LandingLiftReadinessPolicy } from "../../domain/fishing/landing_lift_readiness_policy.js";
import { LandingLiftTensionCalculator } from "../../domain/fishing/landing_lift_tension_calculator.js";
import { hasLineReserve } from "../../domain/fishing/line_state_queries.js";

// Fight pipeline stages update_final_tension and resolve_landing_frame: the step's final tension including the
// landing lift hold, and the landing frame with its lift readiness. Owns the lift hold of one fight session.
export class FightLandingTensionStage {
  #landingLiftCalculator = new LandingLiftTensionCalculator();
  #landingLiftHoldKg = 0;
  #landingLiftReadinessPolicy = new LandingLiftReadinessPolicy();
  #config;
  #physicsConfig;

  constructor({ config, physicsConfig }) {
    this.#config = config;
    this.#physicsConfig = physicsConfig;
  }

  updateTension({
    tensionSystem,
    stressSystem,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    rodControlResult,
    dragContext,
    lineState,
    hardLineLimit,
    dtSec,
    pullInput,
  }) {
    const landingLift = this.#updateLandingLift({
      dtSec,
      pullInput,
      forceData,
      rodPullResult,
      fishRetrieveResult,
      lineState,
      maxTackleLoadKg: stressSystem.getEffectiveMaxTackleLoadKg(),
    });
    const calculatedTension = this.calculateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult,
      fishRetrieveResult,
      rodControlResult,
      landingLift,
      dragContext,
      lineState,
      hardLineLimit,
    });
    const tensionResult = {
      ...calculatedTension,
      landingLift,
    };

    if (typeof stressSystem.updateTensionFrame === "function") {
      const lineHasReserve = hasLineReserve(lineState);
      const canSlipDrag =
        !dragContext.dragLocked &&
        lineHasReserve &&
        !hardLineLimit;
      const tensionStressSource =
        canSlipDrag && tensionResult.shouldSlipDrag
          ? "visible"
          : "raw";
      stressSystem.updateTensionFrame({
        visibleTensionKg: tensionResult.tensionKg,
        totalTensionKg: tensionResult.totalTensionKg,
        rawTotalTensionKg: tensionResult.rawTotalTensionKg,
        rawTensionKg: tensionResult.rawTensionKg,
        fishTensionKg: tensionResult.fishTensionKg,
        tensionStressSource,
        dtSec,
        tensionConfig:
          this.#physicsConfig.getTensionConfig() ||
          this.#config.tension ||
          {},
      });
    } else {
      stressSystem.updateTarget(
        tensionResult.tensionKg,
        dtSec,
        this.#config.tension || {},
      );
    }
    return tensionResult;
  }

  calculateTension({
    tensionSystem,
    stressSystem,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    rodControlResult,
    landingLift,
    dragContext,
    lineState,
    hardLineLimit,
  }) {
    const lineHasReserve = hasLineReserve(lineState);
    const baseFishTensionKg =
      fishRetrieveResult.fishTensionKg ?? forceData.fishTensionKg;
    const basePlayerHoldTensionKg = fishRetrieveResult.playerHoldTensionKg ?? 0;
    const lateralTensionKg = Math.max(
      0,
      Number(rodControlResult?.playerTensionKg) || 0,
    );
    const baseTotalTensionKg =
      fishRetrieveResult.totalTensionKg ?? fishRetrieveResult.lineTensionKg;
    const landingLiftActive = !!landingLift?.active;
    const fishTensionKg = landingLiftActive
      ? landingLift.fishTensionKg
      : baseFishTensionKg;
    const playerHoldTensionKg = landingLiftActive
      ? 0
      : basePlayerHoldTensionKg + lateralTensionKg;
    const totalTensionKg = landingLiftActive
      ? landingLift.totalTensionKg
      : Math.max(0, Number(baseTotalTensionKg) || 0) + lateralTensionKg;
    return tensionSystem.calculate({
      totalTensionKg,
      fishForceKg: fishTensionKg,
      rodPullForceKg: playerHoldTensionKg,
      fishTensionKg,
      playerHoldTensionKg,
      rodLimitKg: stressSystem.getEffectiveRodMaxLoadKg(),
      lineLimitKg: stressSystem.getEffectiveLineSystemMaxLoadKg(),
      hookLimitKg: stressSystem.getEffectiveHookMaxLoadKg(),
      dragLimitKg: dragContext.effectiveDragLimitKg,
      hardLineLimit: !!hardLineLimit,
      lineHasReserve,
      dragLocked: dragContext.dragLocked,
      dragAlreadyResolved:
        Number.isFinite(Number(fishRetrieveResult?.dragBlockedForceKg)),
      shouldSlipDrag: !!fishRetrieveResult?.shouldSlipDrag,
      landingLift,
    });
  }

  #updateLandingLift({
    dtSec,
    pullInput,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    lineState,
    maxTackleLoadKg,
  }) {
    const landingDistanceMeters = Number(forceData?.landingDistanceMeters) || 0;
    const rawShoreDistanceMeters = Number(forceData?.shoreLandingDistanceMeters);
    const shoreLandingDistanceMeters = Number.isFinite(rawShoreDistanceMeters)
      ? Math.max(0, rawShoreDistanceMeters)
      : Infinity;
    const inLandingZone =
      landingDistanceMeters > 0 &&
      shoreLandingDistanceMeters <= landingDistanceMeters + 0.001;
    const playerHoldActive = !!pullInput?.pullHeld;
    const lift = this.#landingLiftCalculator.calculate({
      previousLiftHoldKg: this.#landingLiftHoldKg,
      fishWeightKg: this.#resolveFishWeightKg(forceData),
      maxTackleLoadKg,
      waterFightTensionKg:
        fishRetrieveResult?.fishTensionKg ?? forceData?.fishTensionKg,
      inLandingZone,
      playerHoldActive,
      dtSec,
      config: this.#physicsConfig.getLandingLiftConfig(),
    });

    this.#landingLiftHoldKg = lift.liftHoldKg;
    return lift;
  }

  buildLandingFrame({ forceData, lineState, tensionResult } = {}) {
    const lift = tensionResult?.landingLift || {};
    const rawLineDistanceMeters = Number(lineState?.distanceMeters);
    const lineDistanceMeters = Number.isFinite(rawLineDistanceMeters)
      ? Math.max(0, rawLineDistanceMeters)
      : Infinity;
    const rawShoreDistanceMeters = Number(forceData?.shoreLandingDistanceMeters);
    const shoreLandingDistanceMeters = Number.isFinite(rawShoreDistanceMeters)
      ? Math.max(0, rawShoreDistanceMeters)
      : Infinity;
    const landingDistanceMeters = Math.max(
      0,
      Number(forceData?.landingDistanceMeters) || 0,
    );
    const tensionFrame = Object.freeze({
      visibleTensionKg: Math.max(0, Number(tensionResult?.tensionKg) || 0),
      supportedTensionKg: Math.max(
        0,
        Number(tensionResult?.totalTensionKg) || 0,
      ),
      totalTensionKg: Math.max(0, Number(tensionResult?.totalTensionKg) || 0),
      rawTensionKg: Math.max(0, Number(tensionResult?.rawTensionKg) || 0),
      rawTotalTensionKg: Math.max(
        0,
        Number(tensionResult?.rawTotalTensionKg) || 0,
      ),
      shouldSlipDrag: !!tensionResult?.shouldSlipDrag,
      dragSlipping: !!tensionResult?.shouldSlipDrag,
    });
    const readiness = this.#resolveLandingReadiness({
      landingLiftFrame: lift,
      tensionFrame,
    });

    return Object.freeze({
      inLandingZone: !!lift?.inLandingZone,
      landingDistanceMeters,
      lineDistanceMeters,
      shoreLandingDistanceMeters,
      lift,
      tension: tensionFrame,
      readiness,
    });
  }

  #resolveLandingReadiness({ landingLiftFrame, tensionFrame }) {
    const config = this.#physicsConfig.getLandingLiftConfig() || {};
    if (this.#landingLiftReadinessPolicy?.evaluate) {
      return this.#landingLiftReadinessPolicy.evaluate({
        landingLiftFrame,
        tensionFrame,
        config,
      });
    }

    const liftMaxKg = Math.max(0, Number(landingLiftFrame?.liftMaxKg) || 0);
    const liftHoldKg = Math.max(0, Number(landingLiftFrame?.liftHoldKg) || 0);
    const supportedTensionKg = Math.max(
      0,
      Number(tensionFrame?.supportedTensionKg) || 0,
    );
    return Object.freeze({
      ready:
        config.enabled === false ||
        (
          !!landingLiftFrame?.inLandingZone &&
          !!landingLiftFrame?.playerHoldActive &&
          !!landingLiftFrame?.active &&
          liftMaxKg > 0 &&
          liftHoldKg >= liftMaxKg - 0.001 &&
          supportedTensionKg >= liftMaxKg - 0.001
        ),
      reason: "fallback",
      liftRequiredKg: liftMaxKg,
      liftHoldKg,
      supportedTensionKg,
      rawTensionKg: Math.max(0, Number(tensionFrame?.rawTensionKg) || 0),
      visibleTensionKg: Math.max(
        0,
        Number(tensionFrame?.visibleTensionKg) || 0,
      ),
      dragSlipping: !!tensionFrame?.shouldSlipDrag,
    });
  }

  #resolveFishWeightKg(forceData) {
    return Math.max(
      0,
      Number(forceData?.fishWeightKg) || 0,
    );
  }
}
