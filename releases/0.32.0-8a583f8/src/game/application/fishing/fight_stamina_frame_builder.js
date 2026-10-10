import { StaminaBalanceFrame } from "../../domain/fishing/stamina/stamina_balance_frame.js";
import { hasFinitePoint } from "../../../engine/math/number_normalization.js";
import { isLineTaut } from "../../domain/fishing/line_state_queries.js";

// Fight pipeline stage resolve_stamina_frame: the fish stamina frame of one step (resistance, lateral context,
// line angle and tautness) and the one-time budget overflow warning; reset() re-arms the warning.
export class FightStaminaFrameBuilder {
  #staminaBalanceFrame = new StaminaBalanceFrame();
  #staminaBudgetOverflowWarningActive = false;
  #config;
  #logger;

  constructor({ config, logger }) {
    this.#config = config;
    this.#logger = logger;
  }

  buildStaminaFrame({
    forceData,
    rodPullResult,
    rodControlResult,
    fishRetrieveResult,
    lineState,
    stressSystem,
    fishCondition,
    floatEntity,
    rodTipPosition,
    physics,
    fightInput,
    dtSec,
    isPullMode,
    isRecoverMode,
    holdReelRecover,
    playerPressureFatigue,
  } = {}) {
    const playerIsPulling = !!isPullMode && !isRecoverMode;
    const appliedRodHoldKg = Math.max(
      0,
      Number(
        fishRetrieveResult?.effectiveRodHoldKg ??
          rodPullResult?.effectiveForceKg ??
          rodPullResult?.forceKg,
      ) || 0,
    );
    const appliedControlKg = Math.max(
      0,
      Number(rodControlResult?.forceKg) || 0,
    );
    const appliedReelHoldKg = holdReelRecover?.active === true
      ? Math.max(
          0,
          (Number(holdReelRecover?.reelMaxLoadKg) || 0) *
            (Number(holdReelRecover?.reelLoadReserveRatio) || 0),
        )
      : 0;
    const playerPressureControlExhausted =
      playerPressureFatigue?.isControlExhausted === true;
    const weakestFrame =
      stressSystem.getWeakestTackleLimitFrame() ||
      Object.freeze({
        weakestTackleLimitKg:
          Math.max(0, Number(stressSystem.getEffectiveMaxTackleLoadKg()) || 0),
        component: "stress_system",
        candidates: Object.freeze([]),
      });
    const frame = this.#staminaBalanceFrame.create({
      phase: fishCondition?.phase || "stamina",
      playerIsPulling,
      fishTensionKg:
        fishRetrieveResult?.fishTensionKg ?? forceData?.fishTensionKg,
      appliedRodHoldKg,
      appliedReelHoldKg,
      appliedControlKg,
      playerPressureControlExhausted,
      playerFatigueProgress: playerPressureFatigue?.fatigueProgress ?? 0,
      weakestTackleLimitKg: weakestFrame.weakestTackleLimitKg,
      currentStamina: fishCondition?.currentStamina,
      maxStamina: fishCondition?.maxStamina ?? fishCondition?.maxPoints,
      lineAngleDeg: this.#resolveLineAngleDeg({
        floatEntity,
        rodTipPosition,
        rodControlResult,
      }),
      fishLateralContext: this.#resolveStaminaLateralContext({
        rodControlResult,
      }),
      controlDirectionX: rodControlResult?.inputDirectionX ?? 0,
      rawStaminaInputActive: this.#resolveRawStaminaInputActive({
        fightInput,
      }),
      fishStaminaResistanceKg: this.#resolveFishStaminaResistanceKg({
        forceData,
        fishRetrieveResult,
      }),
      isLineFullyExtended: !!lineState?.isFullyExtended,
      fishWonRadialForceKg:
        fishRetrieveResult?.fishWonRadialForceKg ??
        forceData?.fishWonRadialForceKg,
      dragBlockedForceKg:
        fishRetrieveResult?.dragBlockedForceKg ??
        forceData?.dragBlockedForceKg,
      lineTaut:
        fishRetrieveResult?.lineTaut ??
        forceData?.lineTaut ??
        isLineTaut(lineState),
      lineTautRatio: this.#resolveLineTautRatio({
        fishRetrieveResult,
        forceData,
        lineState,
      }),
      fishBehaviorName: this.#resolveFishBehaviorName(forceData),
      shouldSlipDrag:
        fishRetrieveResult?.shouldSlipDrag ?? forceData?.shouldSlipDrag,
      hardLineLimit:
        !!lineState?.isFullyExtended ||
        !!fishRetrieveResult?.tensionBlocked,
      currentExhaustion: fishCondition?.currentExhaustion,
      maxEndurance:
        fishCondition?.maxEndurance ?? fishCondition?.maxPoints,
      dtSec,
      config:
        this.#config?.stamina?.mechanics ||
        physics?.stamina?.mechanics ||
        {},
    });

    if (frame) {
      this.#warnStaminaBudgetOverflow(frame);
      return Object.freeze({
        ...frame,
        angleStressRatio: frame.angleStressRatio,
        staminaPressureRatio: frame.activeDrainRatio,
        weakestTackleLimitComponent: weakestFrame.component,
        weakestTackleLimitCandidates: weakestFrame.candidates,
      });
    }

    return Object.freeze({
      playerPowerIsPulling: playerIsPulling,
      angleStressRatio: Math.max(
        0,
        Math.min(1, Number(forceData?.player?.angleStressRatio) || 0),
      ),
      staminaPressureRatio: 0,
      framePhase: fishCondition?.phase || "stamina",
      frameCurrentExhaustion: Math.max(
        0,
        Number(fishCondition?.currentExhaustion) || 0,
      ),
      frameMaxEndurance: Math.max(
        0,
        Number(fishCondition?.maxEndurance ?? fishCondition?.maxPoints) || 0,
      ),
      frameEnduranceProgress:
        this.#resolveFrameEnduranceProgress(fishCondition),
      isLineFullyExtended: !!lineState?.isFullyExtended,
      source: "legacy_fallback",
    });
  }

  #resolveFrameEnduranceProgress(fishCondition) {
    const maxEndurance = Math.max(
      0,
      Number(fishCondition?.maxEndurance ?? fishCondition?.maxPoints) || 0,
    );
    if (maxEndurance <= 0) return 0;
    return Math.max(
      0,
      Math.min(
        1,
        1 - (Number(fishCondition?.currentExhaustion) || 0) / maxEndurance,
      ),
    );
  }

  #resolveLineTautRatio({ fishRetrieveResult, forceData, lineState } = {}) {
    const explicit = Number(
      fishRetrieveResult?.lineTautRatio ?? forceData?.lineTautRatio,
    );
    if (Number.isFinite(explicit)) {
      return Math.max(0, Math.min(1, explicit));
    }
    const lineTaut =
      fishRetrieveResult?.lineTaut ??
      forceData?.lineTaut ??
      isLineTaut(lineState);
    return lineTaut ? 1 : 0;
  }

  #resolveFishBehaviorName(forceData) {
    const value =
      forceData?.behavior?.name ??
      forceData?.diagnostics?.fishState ??
      forceData?.fishState ??
      forceData?.fishBehaviorName ??
      "unknown";
    const normalized = String(value || "unknown").trim().toLowerCase();
    return normalized || "unknown";
  }

  #resolveLineAngleDeg({ floatEntity, rodTipPosition, rodControlResult } = {}) {
    const fishPosition = floatEntity.getPosition();
    if (hasFinitePoint(fishPosition) && hasFinitePoint(rodTipPosition)) {
      const absOffsetX = Math.abs(fishPosition.x - rodTipPosition.x);
      const dy = Math.abs(rodTipPosition.y - fishPosition.y);
      return Math.atan2(absOffsetX, Math.max(1, dy)) * 180 / Math.PI;
    }
    const existing = Number(rodControlResult?.lineAngleDeg);
    return Number.isFinite(existing) && existing >= 0 ? existing : 0;
  }

  #resolveStaminaLateralContext({ rodControlResult } = {}) {
    const fishOffsetX = Number(rodControlResult?.fishOffsetX) || 0;
    const angleRatio = Math.max(
      0,
      Math.min(1, Number(rodControlResult?.angleRatio) || 0),
    );
    const absOffset = Math.abs(fishOffsetX);
    const maxAllowedLateralOffsetPx =
      angleRatio > 0.000001 ? absOffset / angleRatio : 0;
    return Object.freeze({
      fishLateralOffsetPx: fishOffsetX,
      maxAllowedLateralOffsetPx,
      angleRatio,
    });
  }

  #resolveRawStaminaInputActive({ fightInput } = {}) {
    const actions = fightInput?.fightActions;
    if (actions?.hold?.active === true) return true;
    if (actions?.lateralControl?.active === true) return true;
    return (
      fightInput?.isPulling === true ||
      fightInput?.pullHeld === true ||
      fightInput?.rodControlActive === true
    );
  }

  #resolveFishStaminaResistanceKg({ forceData, fishRetrieveResult } = {}) {
    const candidates = [
      forceData?.fishCurrentStateMaxForceKg,
      forceData?.diagnostics?.fishCurrentStateMaxForceKg,
      forceData?.fishStateMaxForceWithoutPowerDebuffKg,
      fishRetrieveResult?.fishOppositionKg,
      forceData?.fishOppositionKg,
      forceData?.totalFishForceKg,
      forceData?.fishWeightKg,
    ];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  #warnStaminaBudgetOverflow(frame) {
    if (!frame?.budgetOverflowWarning) {
      this.#staminaBudgetOverflowWarningActive = false;
      return;
    }
    if (this.#staminaBudgetOverflowWarningActive) return;
    this.#staminaBudgetOverflowWarningActive = true;
    this.#logger?.warn(
      "[STAMINA] Stamina received applied player pressure above available tackle budget. This means physics budget and stamina frame are out of sync.",
      frame,
    );
  }

  reset() {
    this.#staminaBudgetOverflowWarningActive = false;
  }
}
