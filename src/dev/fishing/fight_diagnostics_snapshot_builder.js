import { hasLineReserve } from "../../game/domain/fishing/line_reserve.js";

// DEV fight diagnostics: the full per-step snapshot behind overlays, console modules and checks. Development
// composition (and the checks) give one to the fight session; production composes none and keeps the fight frame.
// It only reads the step's values and the orchestrator state passed in the build context.
export class FightDiagnosticsSnapshotBuilder {
  build({
    dtSec,
    forceData,
    dragSystem,
    lineState,
    finalRecoverableLineMeters,
    initialRecoverableLineMeters,
    actualSlackMeters,
    releaseResult,
    recoveredMeters,
    autoRecovery,
    strokeDistanceFrame,
    prePullStrokeDistanceFrame,
    autoRecoveredMeters,
    holdRecoveredMeters,
    hardLineLimit,
    constraintResult,
    rodPullDisplay,
    rodPullResult,
    rodPullMoveMeters,
    rodControlResult,
    rodControlMoveMeters,
    rodControlMovePx,
    rodControlMovementBlockReason,
    lineConstraintState,
    holdReelRecoverMoveMeters,
    previousReelHoldEngaged,
    previousReelHoldActive,
    rodPullMovementBlockReason,
    reelHoldMovementBlockReason,
    hardTensionBlocked,
    fishRetrieveResult,
    landingLiftResult,
    landingFrame,
    staminaFrame,
    tensionResult,
    stressSystem,
    physics,
    isPullMode,
    isRecoverMode,
    holdReelRecover,
    dragContext,
    playerForceBudget,
    playerPressureGain,
    playerTensionBuildRate,
    playerReelFatigueSession,
    playerPressureFatigue,
    poleFightSectorFrame,
    fishCondition,
  }, { fightFrame, physicsConfig, playerPullMotion, playerMaxPowerY }) {
    const frame = fightFrame;
    const lineHasReserve = hasLineReserve(lineState);
    const frameDtSec = Math.max(0, Number(dtSec) || 0);
    const appliedRodPullMoveMeters = Math.max(0, Number(rodPullMoveMeters) || 0);
    const appliedRodControlMoveMeters = Math.max(
      0,
      Number(rodControlMoveMeters) || 0,
    );
    const appliedRodControlMovePx = Math.max(
      0,
      Number(rodControlMovePx) || 0,
    );
    const appliedReelHoldMoveMeters = Math.max(
      0,
      Number(holdReelRecoverMoveMeters) || 0,
    );
    const totalAppliedPullMoveMeters =
      appliedRodPullMoveMeters + appliedReelHoldMoveMeters;
    const rodPullAppliedSpeedMps =
      frameDtSec > 0 ? appliedRodPullMoveMeters / frameDtSec : 0;
    const rodControlAppliedSpeedMps =
      frameDtSec > 0 ? appliedRodControlMoveMeters / frameDtSec : 0;
    const reelHoldAppliedSpeedMps =
      frameDtSec > 0 ? appliedReelHoldMoveMeters / frameDtSec : 0;
    const totalAppliedPullSpeedMps =
      frameDtSec > 0 ? totalAppliedPullMoveMeters / frameDtSec : 0;
    const playerPullMovementMode = this.#resolvePlayerPullMovementMode({
      appliedReelHoldMoveMeters,
      appliedRodPullMoveMeters,
    });
    const fishMovementMode = this.#resolveFishMovementMode(
      forceData.fightMovementFrame,
    );
    const fishMovementSummary = this.#resolveFishMovementSummary({
      frame: forceData.fightMovementFrame,
      awayDirX: forceData.awayDirX,
      awayDirY: forceData.awayDirY,
      fishWonForceKg:
        fishRetrieveResult?.fishWonForceKg ?? forceData.fishWonForceKg,
      netForceKg: fishRetrieveResult?.netForceKg,
      rodControlForceKg: rodControlResult?.forceKg,
    });
    const fishPressureSummary = this.#resolveFishPressureSummary({
      frame: forceData.fightMovementFrame,
      awayDirX: forceData.awayDirX,
      awayDirY: forceData.awayDirY,
      fishWonForceKg:
        fishRetrieveResult?.fishWonForceKg ?? forceData.fishWonForceKg,
      netForceKg: fishRetrieveResult?.netForceKg,
      rodControlForceKg: rodControlResult?.forceKg,
    });
    const lineDebug = {
      totalLineMeters: Math.max(0, Number(lineState.totalLineMeters ?? lineState.totalLengthMeters) || 0),
      fishDistanceMeters: Math.max(0, Number(lineState.distanceMeters) || 0),
      releasedLineMeters: Math.max(0, Number(lineState.releasedMeters) || 0),
      remainingLineMeters: Math.max(0, Number(lineState.remainingMeters) || 0),
      recoverableLineMeters: Math.max(0, Number(lineState.recoverableLineMeters) || 0),
      initialRecoverableLineMeters:
        Math.max(0, Number(initialRecoverableLineMeters) || 0),
      finalRecoverableLineMeters:
        Math.max(0, Number(finalRecoverableLineMeters) || 0),
      lineReleasedThisFrameMeters: Math.max(0, Number(releaseResult.releasedMeters) || 0),
      lineRecoveredThisFrameMeters: Math.max(0, Number(recoveredMeters) || 0),
      lineDemandedThisFrameMeters: Math.max(0, Number(releaseResult.demandedMeters) || 0),
      lineUnsatisfiedThisFrameMeters: Math.max(0, Number(releaseResult.unsatisfiedMeters) || 0),
      lineLengthLocked:
        lineConstraintState?.lineLengthLocked ??
        !!releaseResult.lineLengthLocked,
      radialConstraintActive:
        !!lineConstraintState?.radialConstraintActive,
      tautLine: !!lineConstraintState?.tautLine,
      dragCanPayout: !!lineConstraintState?.dragCanPayout,
      dragPayoutBlocked: !!lineConstraintState?.dragPayoutBlocked,
      constraintReason: lineConstraintState?.reason || "none",
      releaseBlockedReason: releaseResult.releaseBlockedReason || "none",
      releaseBlockedByDrag: !!releaseResult.blockedByDrag,
      releaseBlockedByHardLimit: !!releaseResult.blockedByHardLimit,
      lineHasReserve,
      spoolEmpty: !lineHasReserve,
      fullyExtended: !!lineState.isFullyExtended,
      hardLineLimit: !!hardLineLimit,
      hardLineLimitMeters: Math.max(0, Number(lineState.releasedMeters) || 0),
      rodStrokeCapacityMeters: Math.max(0, Number(rodPullDisplay.rodStrokeCapacityMeters) || 0),
      rodStrokeWonMeters: Math.max(0, Number(rodPullDisplay.rodStrokeWonMeters) || 0),
      rodStrokeUsedMeters: Math.max(0, Number(rodPullDisplay.rodStrokeUsedMeters) || 0),
      rodStrokeUnrecoveredMeters: Math.max(0, Number(rodPullDisplay.rodStrokeUnrecoveredMeters) || 0),
      rodStrokeRatio: Math.max(0, Math.min(1, Number(rodPullDisplay.rodStrokeRatio) || 0)),
      strokeRecoveredMeters: Math.max(0, Number(rodPullDisplay.strokeRecoveredMeters) || 0),
      strokeDistancePreviousMeters:
        Math.max(0, Number(rodPullDisplay.strokeDistancePreviousMeters) || 0),
      strokeDistanceCurrentMeters:
        Math.max(0, Number(rodPullDisplay.strokeDistanceCurrentMeters) || 0),
      strokeDistanceDeltaMeters:
        Number(rodPullDisplay.strokeDistanceDeltaMeters) || 0,
      strokeDistanceGainedMeters:
        Math.max(0, Number(rodPullDisplay.strokeDistanceGainedMeters) || 0),
      strokeDistanceLostMeters:
        Math.max(0, Number(rodPullDisplay.strokeDistanceLostMeters) || 0),
      strokeDistanceReason: rodPullDisplay.strokeDistanceReason || "none",
      prePullStrokeDistanceLostMeters:
        Math.max(0, Number(prePullStrokeDistanceFrame?.lostMeters) || 0),
      autoRecoverActive: !!autoRecovery?.active,
      autoRecoverBlockedReason: autoRecovery?.blockedReason || "not_checked",
      autoRecoverSpeedMetersPerSec:
        Math.max(0, Number(autoRecovery?.recoverSpeedMetersPerSec) || 0),
      autoRecoverBaseRetrieveSpeedMetersPerSec:
        Math.max(0, Number(autoRecovery?.retrieveSpeedMetersPerSec) || 0),
      autoRecoverReelMaxLoadKg:
        Math.max(0, Number(autoRecovery?.reelMaxLoadKg) || 0),
      autoRecoverReelEfficiency:
        Math.max(0, Math.min(1, Number(autoRecovery?.reelEfficiency) || 0)),
      autoRecoverReelLoadRatio:
        Math.max(0, Math.min(1, Number(autoRecovery?.reelLoadRatio) || 0)),
      autoRecoveredMeters: Math.max(0, Number(autoRecoveredMeters) || 0),
      holdRecoveredMeters: Math.max(0, Number(holdRecoveredMeters) || 0),
      reelHoldConfigEnabled: holdReelRecover?.enabled === true,
      reelHoldHasReel: holdReelRecover?.hasReel === true,
      reelHoldPlayerHoldActive:
        holdReelRecover?.playerHoldActive === true,
      playerReelFatigueSessionActive:
        playerReelFatigueSession?.active === true,
      playerReelFatigueSessionStarted:
        playerReelFatigueSession?.startedThisFrame === true,
      playerReelFatigueSessionEnded:
        playerReelFatigueSession?.endedThisFrame === true,
      reelHoldRequiredStrokeRatio:
        Math.max(0, Number(holdReelRecover?.requiredStrokeRatio) || 1),
      holdReelRecoverInputStrokeRatio:
        Math.max(0, Math.min(1, Number(holdReelRecover?.inputStrokeRatio) || 0)),
      finalRodStrokeRatio:
        Math.max(0, Math.min(1, Number(rodPullDisplay.rodStrokeRatio) || 0)),
      holdReelRecoverStrokeRatioDeltaToFull:
        Math.max(0, Number(holdReelRecover?.strokeRatioDeltaToFull) || 0),
      holdReelRecoverStrokeRatioTolerance:
        Math.max(0, Number(holdReelRecover?.strokeRatioTolerance) || 0),
      holdReelRecoverStrokeFull: holdReelRecover?.strokeFull === true,
      reelHoldStrokeFull: holdReelRecover?.strokeFull === true,
      reelHoldRawTensionKg:
        Math.max(0, Number(holdReelRecover?.rawTensionKg) || 0),
      reelHoldDragLimitKg:
        Math.max(0, Number(holdReelRecover?.dragLimitKg) || 0),
      reelHoldDragLocked: holdReelRecover?.dragLocked === true,
      reelHoldShouldSlipDrag: holdReelRecover?.shouldSlipDrag === true,
      reelHoldTensionBelowDragLimit:
        holdReelRecover?.tensionBelowDragLimit === true,
      reelHoldTensionBelowMaxLoad:
        holdReelRecover?.tensionBelowMaxLoad === true,
      reelHoldDragCanHold: holdReelRecover?.dragCanHold === true,
      reelHoldRetrieveSpeedMps:
        Math.max(
          0,
          Number(holdReelRecover?.retrieveSpeedMetersPerSecond) || 0,
        ),
      reelHoldActive: !!holdReelRecover?.active,
      reelHoldEngaged: !!holdReelRecover?.engaged,
      holdReelRecoverEngaged: !!holdReelRecover?.engaged,
      reelHoldCanPull:
        (holdReelRecover?.canPull ?? holdReelRecover?.engaged) === true,
      reelHoldBlockedReason:
        holdReelRecover?.blockedReason || "not_checked",
      reelHoldRecoveringLine: !!holdReelRecover?.recoveringLine,
      holdReelRecoveringLine: !!holdReelRecover?.recoveringLine,
      holdReelRecoverHasRecoverableLine:
        !!holdReelRecover?.hasRecoverableLine,
      holdReelRecoverLineBlockedReason:
        holdReelRecover?.lineRecoveryBlockedReason || "not_checked",
      strokeResetReason: rodPullDisplay.strokeResetReason || "none",
    };

    return {
      ...forceData.diagnostics,
      ...dragSystem.getDiagnostics(),
      dragSupported: frame.dragSupported,
      lineDebug,
      lineTotalMeters: lineState.totalLineMeters ?? lineState.totalLengthMeters,
      lineReleasedMeters: lineState.releasedMeters,
      lineRemainingMeters: frame.lineRemainingMeters,
      lineCanRelease: frame.lineCanRelease,
      lineSpoolEmpty: !lineHasReserve,
      lineReserveEmpty: !lineHasReserve,
      physicalLineLimit: !!lineState.isFullyExtended,
      lineMaxRemainingMeters: lineState.maxRemainingMeters,
      lineBaseReachMeters: lineState.baseReachMeters,
      lineTotalLengthMeters: lineState.totalLengthMeters,
      lineRecoverableMeters: lineState.recoverableLineMeters,
      isLineFullyExtended: lineState.isFullyExtended,
      lineExtensionRatio: lineState.lineExtensionRatio,
      lineDistanceMeters: frame.lineDistanceMeters,
      shoreLandingDistanceMeters:
        Math.max(0, Number(forceData.shoreLandingDistanceMeters) || 0),
      landingDistanceMode: "shore",
      actualSlackMeters,
      lineReleasedThisFrameMeters: frame.lineReleasedThisFrameMeters,
      lineDemandedThisFrameMeters: releaseResult.demandedMeters,
      lineUnsatisfiedThisFrameMeters: releaseResult.unsatisfiedMeters,
      lineLengthLocked:
        lineConstraintState?.lineLengthLocked ??
        !!releaseResult.lineLengthLocked,
      radialConstraintActive:
        !!lineConstraintState?.radialConstraintActive,
      lineTaut: !!lineConstraintState?.tautLine,
      lineDragCanPayout: !!lineConstraintState?.dragCanPayout,
      lineDragPayoutBlocked: !!lineConstraintState?.dragPayoutBlocked,
      lineConstraintReason: lineConstraintState?.reason || "none",
      lineReleaseBlockedReason:
        releaseResult.releaseBlockedReason || "none",
      reelSlip: frame.reelSlip,
      lineRecoveredThisFrameMeters: recoveredMeters,
      hardLineLimit: frame.hardLineLimit,
      constraintCorrectionPx: constraintResult.correctionPx,
      playerForceBudgetEnabled: !!playerForceBudget?.enabled,
      playerForceTotalBudgetKg:
        Math.max(0, Number(playerForceBudget?.totalPlayerBudgetKg) || 0),
      playerForceHoldBudgetKg:
        Math.max(0, Number(playerForceBudget?.holdBudgetKg) || 0),
      playerForceControlBudgetKg:
        Math.max(0, Number(playerForceBudget?.controlBudgetKg) || 0),
      playerForceHoldShare:
        Math.max(0, Math.min(1, Number(playerForceBudget?.holdShare) || 0)),
      playerForceControlShare:
        Math.max(0, Math.min(1, Number(playerForceBudget?.controlShare) || 0)),
      playerForceCombinedCeilingMultiplier:
        Math.max(0, Number(playerForceBudget?.combinedCeilingMultiplier) || 1),
      playerForceCombinedTensionCeilingKg:
        Math.max(0, Number(playerForceBudget?.combinedTensionCeilingKg) || 0),
      playerForceBudgetReason: playerForceBudget?.reason || "none",
      playerForceControlRequested:
        playerForceBudget?.controlRequested === true,
      playerForceControlEligible:
        playerForceBudget?.controlEligible === true,
      playerForceControlBlockedReason:
        playerForceBudget?.controlBlockedReason || "none",
      playerPressureGainMode:
        playerPressureGain?.mode || "none",
      playerPressureGainMultiplier:
        Math.max(0, Number(playerPressureGain?.multiplier) || 1),
      playerPressureHoldActive:
        playerPressureGain?.holdActive === true,
      playerPressureControlActive:
        playerPressureGain?.controlActive === true,
      playerPressureHoldForceKg:
        Math.max(0, Number(playerPressureGain?.holdForceKg) || 0),
      playerPressureControlForceKg:
        Math.max(0, Number(playerPressureGain?.controlForceKg) || 0),
      playerPressureControlInputRatio:
        Math.max(
          0,
          Math.min(1, Number(playerPressureGain?.controlInputRatio) || 0),
        ),
      tensionBuildMode:
        playerTensionBuildRate?.mode || "none",
      tensionBuildRateMultiplier:
        Math.max(
          0,
          Number(playerTensionBuildRate?.buildRateMultiplier) || 1,
        ),
      tensionBuildHoldActive:
        playerTensionBuildRate?.holdActive === true,
      tensionBuildControlActive:
        playerTensionBuildRate?.controlActive === true,
      rodHoldBaseChargePerSecond:
        Math.max(0, Number(rodPullResult?.baseChargePerSecond) || 0),
      rodHoldEffectiveChargePerSecond:
        Math.max(0, Number(rodPullResult?.chargePerSecond) || 0),
      rodControlBaseBuildPerSecond:
        Math.max(0, Number(rodControlResult?.controlBaseBuildPerSecond) || 0),
      rodControlEffectiveBuildPerSecond:
        Math.max(
          0,
          Number(rodControlResult?.controlEffectiveBuildPerSecond) || 0,
        ),
      rodControlBuildRatio:
        Math.max(0, Math.min(1, Number(rodControlResult?.controlBuildRatio) || 0)),
      tensionBuildRemainingReserveKg:
        Math.max(
          0,
          Number(playerForceBudget?.combinedTensionCeilingKg) -
            Number(tensionResult?.totalTensionKg),
        ) || 0,
      tensionBuildBlockedByCap:
        Math.max(
          0,
          Number(playerForceBudget?.combinedTensionCeilingKg) -
            Number(tensionResult?.totalTensionKg),
        ) <= 0.001,
      playerReelFatigueSessionActive:
        playerReelFatigueSession?.active === true,
      playerReelFatigueSessionStarted:
        playerReelFatigueSession?.startedThisFrame === true,
      playerReelFatigueSessionEnded:
        playerReelFatigueSession?.endedThisFrame === true,
      playerPressureFatigueEnabled:
        frame.playerPressureFatigueEnabled,
      playerPressureFatigueEfficiency:
        frame.playerPressureFatigueEfficiency,
      playerPressureFatigueNextEfficiency:
        playerPressureFatigue?.nextEfficiency ??
        playerPressureFatigue?.efficiency ??
        1,
      playerPressureFatigueState:
        frame.playerPressureFatigueState,
      playerPressureFatigueSourceMode:
        frame.playerPressureFatigueSourceMode,
      playerPressureFatigueSourceActive:
        frame.playerPressureFatigueSourceActive,
      playerPressureFatigueSourceReason:
        playerPressureFatigue?.sourceReason ||
        "reel_hold_session_inactive",
      playerPressureFatigueHoldMs:
        playerPressureFatigue?.holdElapsedMs ??
        playerPressureFatigue?.pressureHoldMs ??
        0,
      playerPressureFatigueHoldElapsedMs:
        playerPressureFatigue?.holdElapsedMs ??
        playerPressureFatigue?.pressureHoldMs ??
        0,
      playerPressureFatigueHoldSeconds:
        Math.max(
          0,
          Number(
            playerPressureFatigue?.holdElapsedMs ??
              playerPressureFatigue?.pressureHoldMs,
          ) || 0,
        ) /
        1000,
      playerPressureFatigueRecoveryState:
        playerPressureFatigue?.recoveryState || "disabled",
      playerPressureFatiguePressureKg:
        playerPressureFatigue?.pressureKg ?? 0,
      playerPressureFatigueFatigueRatio:
        playerPressureFatigue?.fatigueRatio ?? 0,
      playerPressureFatigueProgress:
        frame.playerPressureFatigueProgress,
      playerPressureFatigueGraceElapsedMs:
        frame.playerPressureFatigueGraceElapsedMs,
      playerPressureFatigueGraceDurationMs:
        frame.playerPressureFatigueGraceDurationMs,
      playerPressureFatigueGraceRemainingMs:
        playerPressureFatigue?.graceRemainingMs ?? 0,
      playerPressureFatigueFatigueElapsedMs:
        playerPressureFatigue?.fatigueElapsedMs ?? 0,
      playerPressureFatigueFatigueDurationMs:
        playerPressureFatigue?.fatigueDurationMs ?? 0,
      playerPressureFatigueFatigueRemainingMs:
        playerPressureFatigue?.fatigueRemainingMs ?? 0,
      playerPressureFatigueRecoveryDelayElapsedMs:
        playerPressureFatigue?.recoveryDelayElapsedMs ?? 0,
      playerPressureFatigueRecoveryDelayMs:
        playerPressureFatigue?.recoveryDelayMs ??
        playerPressureFatigue?.delayAfterPressureMs ??
        0,
      playerPressureFatigueRecoveryDelayRemainingMs:
        playerPressureFatigue?.recoveryDelayRemainingMs ?? 0,
      playerPressureFatigueRecoveryProgress:
        frame.playerPressureFatigueRecoveryProgress,
      playerPressureFatigueRecoveryRemainingMs:
        playerPressureFatigue?.recoveryRemainingMs ?? 0,
      playerPressureFatigueControlBreakEnabled:
        playerPressureFatigue?.controlBreakEnabled === true,
      playerPressureFatigueControlExhausted:
        playerPressureFatigue?.isControlExhausted === true,
      playerPressureFatigueControlBreakThreshold:
        playerPressureFatigue?.controlBreakFatigueProgressThreshold ??
        playerPressureFatigue?.controlBreakFatigueRatioThreshold ??
        0,
      playerPressureFatigueControlBreakMinHoldMs:
        playerPressureFatigue?.controlBreakMinContinuousPressureMs ?? 0,
      playerPressureFatigueRawRodHoldKg:
        playerPressureFatigue?.rawRodHoldKg ?? 0,
      playerPressureFatigueRawControlKg:
        playerPressureFatigue?.rawControlKg ?? 0,
      playerPressureFatigueRodHoldKg:
        playerPressureFatigue?.fatiguedRodHoldKg ?? 0,
      playerPressureFatigueControlKg:
        playerPressureFatigue?.fatiguedControlKg ?? 0,
      playerPressureFatigueRodHoldChannel:
        playerPressureFatigue?.channels?.rodHold !== false,
      playerPressureFatigueControlChannel:
        playerPressureFatigue?.channels?.rodControl !== false,
      poleFightSectorEnabled:
        poleFightSectorFrame?.enabled === true,
      poleFightSectorActive:
        frame.poleFightSectorActive,
      poleFightSectorClamped:
        poleFightSectorFrame?.clamped === true,
      poleFightSectorSide:
        poleFightSectorFrame?.side || "none",
      poleFightSectorAngleDeg:
        Number(poleFightSectorFrame?.angleDeg) || 0,
      poleFightSectorClampedAngleDeg:
        Number(poleFightSectorFrame?.clampedAngleDeg) || 0,
      poleFightSectorMaxAngleDeg:
        Number(poleFightSectorFrame?.maxAngleFromCenterDeg) || 0,
      poleFightSectorFishRadiusPx:
        Math.max(0, Number(poleFightSectorFrame?.radiusPx) || 0),
      poleFightSectorRadiusPx:
        Math.max(0, Number(poleFightSectorFrame?.radiusPx) || 0),
      poleFightSectorLimitRadiusPx:
        frame.poleFightSectorLimitRadiusPx,
      poleFightSectorLimitRadiusMeters:
        Math.max(0, Number(poleFightSectorFrame?.limitRadiusPx) || 0) /
        Math.max(1, physicsConfig.getPixelsPerMeter() || 50),
      poleFightSectorOriginX:
        Number(poleFightSectorFrame?.originX) || 0,
      poleFightSectorOriginY:
        Number(poleFightSectorFrame?.originY) || 0,
      poleFightSectorShoreOpeningWidthMeters:
        Math.max(
          0,
          Number(poleFightSectorFrame?.shoreOpeningWidthMeters) || 0,
        ),
      poleFightSectorApexX:
        Number(
          poleFightSectorFrame?.sectorApexX ??
          poleFightSectorFrame?.originX,
        ) || 0,
      poleFightSectorApexY:
        Number(
          poleFightSectorFrame?.sectorApexY ??
          poleFightSectorFrame?.originY,
        ) || 0,
      poleFightSectorApexOffsetPx:
        Math.max(0, Number(poleFightSectorFrame?.apexOffsetPx) || 0),
      poleFightSectorForwardX:
        Number(poleFightSectorFrame?.forwardX) || 0,
      poleFightSectorForwardY:
        Number(poleFightSectorFrame?.forwardY) || -1,
      poleFightSectorLeftBoundaryDirectionX:
        Number(poleFightSectorFrame?.leftBoundaryDirectionX) || 0,
      poleFightSectorLeftBoundaryDirectionY:
        Number(poleFightSectorFrame?.leftBoundaryDirectionY) || 0,
      poleFightSectorRightBoundaryDirectionX:
        Number(poleFightSectorFrame?.rightBoundaryDirectionX) || 0,
      poleFightSectorRightBoundaryDirectionY:
        Number(poleFightSectorFrame?.rightBoundaryDirectionY) || 0,
      poleFightSectorLeftBoundaryRadiusIntersectionX:
        Number(
          poleFightSectorFrame?.leftBoundaryRadiusIntersectionX,
        ) || 0,
      poleFightSectorLeftBoundaryRadiusIntersectionY:
        Number(
          poleFightSectorFrame?.leftBoundaryRadiusIntersectionY,
        ) || 0,
      poleFightSectorRightBoundaryRadiusIntersectionX:
        Number(
          poleFightSectorFrame?.rightBoundaryRadiusIntersectionX,
        ) || 0,
      poleFightSectorRightBoundaryRadiusIntersectionY:
        Number(
          poleFightSectorFrame?.rightBoundaryRadiusIntersectionY,
        ) || 0,
      poleFightSectorBoundaryType:
        poleFightSectorFrame?.boundaryType || "none",
      poleFightSectorOutside:
        poleFightSectorFrame?.outside === true,
      poleFightSectorRecoveryMovement:
        poleFightSectorFrame?.recoveryMovement === true,
      rodPullActive: rodPullDisplay.active,
      rodPullRatio: rodPullDisplay.ratio,
      rodPullRawForceKg: rodPullResult.rawForceKg ?? rodPullResult.forceKg,
      rodPullForceKg: rodPullResult.forceKg,
      rodLimitKg: rodPullResult.rodLimitKg,
      rodHoldMaxKg: frame.rodHoldMaxKg,
      rodHoldTensionCeilingMultiplier:
        rodPullResult.tensionCeilingMultiplier ?? 1,
      rodHoldTensionCeilingKg:
        rodPullResult.tensionCeilingKg ?? rodPullResult.rodLimitKg,
      effectiveRodHoldKg: frame.effectiveRodHoldKg,
      holdTensionRatio: frame.holdTensionRatio,
      playerHoldTensionKg: frame.playerHoldTensionKg,
      rawPlayerHoldTensionKg: fishRetrieveResult?.rawPlayerHoldTensionKg ?? 0,
      movableHoldTensionCapKg: fishRetrieveResult?.movableHoldTensionCapKg ?? 0,
      movableHoldTensionCapRatio:
        fishRetrieveResult?.movableHoldTensionCapRatio ?? 1,
      movableHoldTensionCapApplied:
        !!fishRetrieveResult?.movableHoldTensionCapApplied,
      fishCanMoveTowardPlayer:
        fishRetrieveResult?.fishCanMoveTowardPlayer !== false,
      playerDemandForceKg: rodPullResult.forceKg,
      fishRetrieveHoldRatio: fishRetrieveResult?.holdRatio,
      actualFishPullSpeedMps: fishRetrieveResult?.towardPlayerSpeedMps,
      targetFishPullSpeedMps: fishRetrieveResult?.towardPlayerSpeedMps,
      fishOppositionKg: fishRetrieveResult?.fishOppositionKg,
      fishTensionKg: frame.fishTensionKg,
      fishPassiveKg: fishRetrieveResult?.fishPassiveKg ?? forceData.fishPassiveKg,
      fishActiveKg: fishRetrieveResult?.fishActiveKg ?? forceData.fishActiveKg,
      fishWonForceKg:
        fishRetrieveResult?.fishWonForceKg ?? forceData.fishWonForceKg,
      fishWonRadialForceKg:
        fishRetrieveResult?.fishWonRadialForceKg ??
        forceData.fishWonRadialForceKg,
      radialAwayRatio:
        fishRetrieveResult?.radialAwayRatio ??
        forceData.radialAwayRatio ??
        fishRetrieveResult?.yAwayRatio ??
        forceData.yAwayRatio,
      fishWonYForceKg:
        fishRetrieveResult?.fishWonYForceKg ?? forceData.fishWonYForceKg,
      yAwayRatio:
        fishRetrieveResult?.yAwayRatio ?? forceData.yAwayRatio,
      dragBlockedForceKg:
        fishRetrieveResult?.dragBlockedForceKg ?? forceData.dragBlockedForceKg,
      excessYForceKg:
        fishRetrieveResult?.excessYForceKg ?? forceData.excessYForceKg,
      yEscapeForceKg:
        fishRetrieveResult?.yEscapeForceKg ?? forceData.yEscapeForceKg,
      radialEscapeForceKg:
        fishRetrieveResult?.radialEscapeForceKg ??
        forceData.radialEscapeForceKg,
      finalRadialSpeedPxPerSec:
        fishRetrieveResult?.finalRadialSpeedPxPerSec ??
        forceData.finalRadialSpeedPxPerSec,
      radialSpeedPxPerSec:
        fishRetrieveResult?.radialSpeedPxPerSec ??
        forceData.radialSpeedPxPerSec,
      outwardRadialSpeedPxPerSec:
        fishRetrieveResult?.outwardRadialSpeedPxPerSec ??
        forceData.outwardRadialSpeedPxPerSec,
      tangentSpeedPxPerSec:
        fishRetrieveResult?.tangentSpeedPxPerSec ??
        forceData.tangentSpeedPxPerSec,
      fishMoveIntentRadial: forceData.fishMoveIntentRadial,
      fishMoveIntentLateral: forceData.fishMoveIntentLateral,
      fishMoveDirX: forceData.fishMoveDirX,
      fishMoveDirY: forceData.fishMoveDirY,
      awayDirX: forceData.awayDirX,
      awayDirY: forceData.awayDirY,
      fishRuntimeBehaviorStates:
        forceData.fishPhysicsConfig?.behaviorProfile?.behaviors ||
        forceData.fishPhysicsConfig?.behaviors ||
        {},
      fishRuntimeForceProfile:
        forceData.fishPhysicsConfig?.forceProfile || {},
      fishRuntimeMovementProfile:
        forceData.fishPhysicsConfig?.movementProfile || {},
      enduranceMovementDebuffEnabled:
        forceData.enduranceMovementDebuffEnabled === true,
      enduranceMovementDebuffActive:
        forceData.enduranceMovementDebuffActive === true,
      enduranceMovementDebuffProgress:
        forceData.enduranceMovementDebuffProgress ?? 0,
      enduranceMovementDebuffPower:
        forceData.enduranceMovementDebuffPower ?? 0,
      enduranceLastSelectedBehavior:
        forceData.enduranceLastSelectedBehavior || "unknown",
      enduranceLastSampledRadialIntent:
        forceData.enduranceLastSampledRadialIntent ?? null,
      enduranceLastSampledLateralIntent:
        forceData.enduranceLastSampledLateralIntent ?? null,
      enduranceTargetRadialMin:
        forceData.enduranceTargetRadialMin ?? null,
      enduranceTargetRadialMax:
        forceData.enduranceTargetRadialMax ?? null,
      enduranceBaseRadialMin:
        forceData.enduranceBaseRadialMin ?? null,
      enduranceBaseRadialMax:
        forceData.enduranceBaseRadialMax ?? null,
      enduranceEffectiveRadialMin:
        forceData.enduranceEffectiveRadialMin ?? null,
      enduranceEffectiveRadialMax:
        forceData.enduranceEffectiveRadialMax ?? null,
      enduranceDashWeightMultiplier:
        forceData.enduranceDashWeightMultiplier ?? 1,
      enduranceLastDashWeightMultiplier:
        forceData.enduranceLastDashWeightMultiplier ?? 1,
      enduranceSwimWeightMultiplier:
        forceData.enduranceSwimWeightMultiplier ?? 1,
      enduranceIdleWeightMultiplier:
        forceData.enduranceIdleWeightMultiplier ?? 1,
      enduranceRestWeightMultiplier:
        forceData.enduranceRestWeightMultiplier ?? 1,
      fishRetrieveUsefulPullForceKg: fishRetrieveResult?.effectiveRodHoldKg,
      fishRetrieveSpeedMps: fishRetrieveResult?.speedMps,
      modelFightSpeedMps: fishRetrieveResult?.speedMps,
      simpleFightSpeedMps: fishRetrieveResult?.speedMps,
      totalAppliedPullMoveMeters,
      totalAppliedPullSpeedMps,
      fishOwnTowardSpeedMps: forceData.fishOwnTowardSpeedMps ?? 0,
      combinedTowardSpeedMps:
        (Number(forceData.fishOwnTowardSpeedMps) || 0) +
        totalAppliedPullSpeedMps,
      playerPullMovementMode,
      fishMovementMode,
      fishPressureRelation: fishPressureSummary.relation,
      fishPressureDirection: fishPressureSummary.direction,
      fishPressureStrengthKg: fishPressureSummary.strengthKg,
      fishPressureSpeedPxPerSec: fishPressureSummary.speedPxPerSec,
      fishPressureDirX: fishPressureSummary.dirX,
      fishPressureDirY: fishPressureSummary.dirY,
      fishMovementRelation: fishMovementSummary.relation,
      fishMovementDirection: fishMovementSummary.direction,
      fishMovementStrengthKg: fishMovementSummary.strengthKg,
      fishMovementActualSpeedPxPerSec: fishMovementSummary.actualSpeedPxPerSec,
      fishMovementActualDirX: fishMovementSummary.dirX,
      fishMovementActualDirY: fishMovementSummary.dirY,
      fishActualBlockedReason:
        forceData.fightMovementFrame?.fishActualBlockedReason || "none",
      fishMoveSectorClamped:
        !!forceData.fightMovementFrame?.poleFightSectorClamped,
      fishMoveSectorActive:
        !!forceData.fightMovementFrame?.poleFightSectorActive,
      fishMoveSectorSide:
        forceData.fightMovementFrame?.poleFightSectorSide || "none",
      fishMoveSectorAngleDeg:
        forceData.fightMovementFrame?.poleFightSectorAngleDeg ?? 0,
      fishMoveSectorBoundaryType:
        forceData.fightMovementFrame?.poleFightSectorBoundaryType || "none",
      fishMoveSectorAllowedMoveRatio:
        forceData.fightMovementFrame?.poleFightSectorAllowedMoveRatio ?? 1,
      fishMoveSectorEnforceRadius:
        forceData.fightMovementFrame?.poleFightSectorEnforceRadius !== false,
      // Deprecated alias: this is player pull movement, not fish movement.
      movementMode: playerPullMovementMode,
      towardPlayerSpeedMps: fishRetrieveResult?.towardPlayerSpeedMps,
      awaySpeedMps: fishRetrieveResult?.awaySpeedMps,
      netForceKg: fishRetrieveResult?.netForceKg,
      fishRetrieveMovementControlRatio:
        fishRetrieveResult?.movementControlRatio,
      fishRetrieveLineTensionKg: fishRetrieveResult?.totalTensionKg,
      fishRetrieveBalanceState: fishRetrieveResult?.balanceState,
      fishRetrieveMovementBlocked: fishRetrieveResult?.movementBlocked,
      fishRetrieveTensionBlocked: fishRetrieveResult?.tensionBlocked,
      fishRetrieveDesiredMoveMeters: fishRetrieveResult?.desiredMoveMeters,
      fishRetrieveAppliedMoveMeters: fishRetrieveResult?.appliedMoveMeters,
      landingLiftEnabled: !!landingLiftResult?.enabled,
      landingLiftInZone: frame.landingLiftInZone,
      landingLiftPlayerHoldActive: !!landingLiftResult?.playerHoldActive,
      landingLiftActive: frame.landingLiftActive,
      landingLiftHoldKg: frame.landingLiftHoldKg,
      landingLiftMaxKg: frame.landingLiftMaxKg,
      landingLiftWaterTensionKg:
        frame.landingLiftWaterTensionKg,
      landingLiftFishTensionKg: frame.landingLiftFishTensionKg,
      landingLiftWeightTensionRatio:
        landingLiftResult?.liftWeightTensionRatio ?? 0,
      landingLiftFastTimeSeconds:
        landingLiftResult?.fastLiftTimeSeconds ?? 0,
      landingLiftReleaseTimeSeconds:
        landingLiftResult?.releaseTimeSeconds ?? 0,
      landingLiftProgressRatio: frame.landingLiftProgressRatio,
      landingLiftTackleLoadProgressRatio:
        frame.landingLiftTackleLoadProgressRatio,
      landingLiftSlowdownRatio: frame.landingLiftSlowdownRatio,
      landingLiftSpeedRatio: frame.landingLiftSpeedRatio,
      landingLiftGainKgPerSecond:
        frame.landingLiftGainKgPerSecond,
      landingReady: !!landingFrame?.readiness?.ready,
      landingReadyReason: landingFrame?.readiness?.reason || "not_checked",
      landingSupportedTensionKg:
        landingFrame?.readiness?.supportedTensionKg ?? 0,
      landingRawTensionKg: landingFrame?.readiness?.rawTensionKg ?? 0,
      landingVisibleTensionKg:
        landingFrame?.readiness?.visibleTensionKg ?? 0,
      landingDragSlipping: !!landingFrame?.readiness?.dragSlipping,
      rodPullDistanceMeters: rodPullDisplay.distanceMeters,
      rodPullMaxDistanceMeters: rodPullDisplay.maxDistanceMeters,
      rodPullAvailableDistanceMeters: rodPullDisplay.availableDistanceMeters,
      rodPullDeltaMeters: rodPullResult.deltaMeters,
      rodPullMoveMeters: appliedRodPullMoveMeters,
      rodPullAppliedSpeedMps,
      playerPullMotionEnabled: !!playerPullMotion.enabled,
      playerPullMotionInertiaSeconds: playerPullMotion.inertiaSeconds,
      playerPullDesiredMoveX: playerPullMotion.desiredMoveX,
      playerPullActualMoveX: playerPullMotion.actualMoveX,
      playerPullDesiredMoveY: playerPullMotion.desiredMoveY,
      playerPullActualMoveY: playerPullMotion.actualMoveY,
      playerPullVelocityX: playerPullMotion.velocityX,
      playerPullVelocityY: playerPullMotion.velocityY,
      rodPullMovementBlockReason: rodPullMovementBlockReason || "none",
      rodPullCanMoveFish: rodPullResult.canMoveFish,
      rodPullBlockedReason: frame.rodPullBlockedReason,
      rodPullDragSlipping: frame.rodPullDragSlipping,
      rodPullReleaseRecovering: rodPullDisplay.releaseRecovering,
      rodPullReleaseRecoveryRatio: rodPullDisplay.releaseRecoveryRatio,
      rodPullChargeSpeedMultiplier: rodPullDisplay.chargeSpeedMultiplier,
      rodPullChargePerSecond: rodPullDisplay.chargePerSecond,
      activeRodPullForceKg: frame.activeRodPullForceKg,
      rodPullPlayerPressureEfficiency:
        rodPullResult.playerPressureEfficiency ?? 1,
      rodPullPlayerPressureFatigueEnabled:
        rodPullResult.playerPressureFatigueEnabled === true,
      rodControlActive: frame.rodControlActive,
      rodControlCanApply: !!rodControlResult?.canApply,
      rodControlDirectionX: frame.rodControlDirectionX,
      rodControlInputDirectionX: frame.rodControlInputDirectionX,
      rodControlInputRatio: frame.rodControlInputRatio,
      rodControlRequestedForceRatio:
        rodControlResult?.requestedForceRatio ?? 0,
      rodControlLoadReserveKg: rodControlResult?.loadReserveKg ?? 0,
      rodControlLoadReserveRatio: frame.rodControlLoadReserveRatio,
      rodControlTensionCeilingMultiplier:
        rodControlResult?.tensionCeilingMultiplier ?? 1,
      rodControlTensionCeilingKg:
        rodControlResult?.tensionCeilingKg ?? rodPullResult.rodLimitKg,
      rodControlPlayerForceBudgetEnabled:
        !!rodControlResult?.playerForceBudgetEnabled,
      rodControlPlayerForceBudgetKg:
        rodControlResult?.playerForceControlBudgetKg ?? 0,
      rodControlPlayerForceBudgetShare:
        rodControlResult?.playerForceControlShare ?? 0,
      rodControlForceLimitKg: rodControlResult?.forceLimitKg ?? 0,
      rodControlEffectiveForceLimitKg:
        rodControlResult?.effectiveForceLimitKg ?? 0,
      rodControlDragLimited: !!rodControlResult?.dragLimited,
      rodControlDragReserveKg: rodControlResult?.dragReserveKg ?? 0,
      rodControlCanSlipDrag: !!rodControlResult?.canSlipDrag,
      rodControlDeliveredForceRatio:
        rodControlResult?.deliveredForceRatio ?? 0,
      rodControlActualMovementRatio:
        rodControlResult?.actualMovementRatio ?? 0,
      rodControlTargetMode: rodControlResult?.targetMode || "input_direction",
      rodControlTargetRodX: rodControlResult?.targetRodX ?? null,
      rodControlFishOffsetX: rodControlResult?.fishOffsetX ?? 0,
      rodControlLineAngleDeg: rodControlResult?.lineAngleDeg ?? 0,
      rodControlMaxEffectiveAngleDeg:
        rodControlResult?.maxEffectiveAngleDeg ?? 0,
      rodControlAngleRatio: rodControlResult?.angleRatio ?? 0,
      rodControlDirectionFactor: frame.rodControlDirectionFactor,
      rodControlAligned: !!rodControlResult?.aligned,
      rodControlCentered: !!rodControlResult?.centered,
      rodControlStartedCentered:
        !!rodControlResult?.controlStartedCentered,
      rodControlCenterStartActive:
        !!rodControlResult?.centerStartActive,
      rodControlMaxPullSpeedMps:
        rodControlResult?.maxPullSpeedMetersPerSecond ?? 0,
      rodControlPhase:
        rodControlResult?.phase || "inactive",
      rodControlVisualControlRatio:
        rodControlResult?.visualControlRatio ?? 0,
      rodControlRawForceKg:
        rodControlResult?.rawForceKg ?? rodControlResult?.forceKg ?? 0,
      rodControlForceKg: rodControlResult?.forceKg ?? 0,
      rodControlPlayerPressureEfficiency:
        rodControlResult?.playerPressureEfficiency ?? 1,
      rodControlPlayerPressureFatigueEnabled:
        rodControlResult?.playerPressureFatigueEnabled === true,
      rodControlPlayerTensionKg: frame.rodControlPlayerTensionKg,
      rodControlTensionMultiplier: rodControlResult?.tensionMultiplier ?? 0,
      rodControlTensionMode:
        rodControlResult?.tensionMode || "side",
      rodControlFishControlAxisAlignment:
        rodControlResult?.fishControlAxisAlignment ?? 0,
      rodControlFishControlAxisVelocity:
        rodControlResult?.fishControlAxisVelocityPxPerSecond ?? 0,
      rodControlFishAutonomousSpeed:
        rodControlResult?.fishAutonomousSpeedPxPerSecond ?? 0,
      rodControlAxisX: rodControlResult?.controlAxisX ?? 0,
      rodControlAxisY: rodControlResult?.controlAxisY ?? 0,
      rodControlDesiredMoveMeters: rodControlResult?.desiredMoveMeters ?? 0,
      rodControlDesiredMovePx: rodControlResult?.desiredMovePx ?? 0,
      rodControlAllowedMoveMeters:
        rodControlResult?.allowedMoveMeters ?? 0,
      rodControlMoveMeters: appliedRodControlMoveMeters,
      rodControlMovePx: appliedRodControlMovePx,
      rodControlAppliedSpeedMps,
      rodControlMovementMode:
        rodControlResult?.movementMode || "none",
      rodControlLineLengthLocked:
        !!rodControlResult?.lineLengthLocked,
      rodControlRadialConstraintActive:
        !!rodControlResult?.radialConstraintActive,
      rodControlMovementBlockReason:
        frame.rodControlMovementBlockReason,
      rodControlBlockedReason: frame.rodControlBlockedReason,
      rodStrokeCapacityMeters: frame.rodStrokeCapacityMeters,
      rodStrokeWonMeters: rodPullDisplay.rodStrokeWonMeters,
      rodStrokeUsedMeters: rodPullDisplay.rodStrokeUsedMeters,
      rodStrokeUnrecoveredMeters: frame.rodStrokeUnrecoveredMeters,
      rodStrokeRatio: frame.rodStrokeRatio,
      strokeRecoveredMeters: rodPullDisplay.strokeRecoveredMeters ?? 0,
      strokeDistancePreviousMeters:
        rodPullDisplay.strokeDistancePreviousMeters ?? 0,
      strokeDistanceCurrentMeters:
        rodPullDisplay.strokeDistanceCurrentMeters ?? 0,
      strokeDistanceDeltaMeters:
        rodPullDisplay.strokeDistanceDeltaMeters ?? 0,
      strokeDistanceGainedMeters:
        rodPullDisplay.strokeDistanceGainedMeters ?? 0,
      strokeDistanceLostMeters:
        rodPullDisplay.strokeDistanceLostMeters ?? 0,
      strokeDistanceReason:
        rodPullDisplay.strokeDistanceReason || "none",
      prePullStrokeDistanceLostMeters:
        prePullStrokeDistanceFrame?.lostMeters ?? 0,
      playerFrameStrokeDistanceGainedMeters:
        strokeDistanceFrame?.gainedMeters ?? 0,
      playerFrameStrokeDistanceLostMeters:
        strokeDistanceFrame?.lostMeters ?? 0,
      playerFrameStrokeDistanceReason:
        strokeDistanceFrame?.reason || "none",
      strokeResetReason: rodPullDisplay.strokeResetReason || "none",
      availableExtraForceKg: rodPullDisplay.availableExtraForceKg,
      reelRecoveringLineCredit: recoveredMeters > 0,
      autoRecoverActive: !!autoRecovery?.active,
      autoRecoverBlockedReason: autoRecovery?.blockedReason || "not_checked",
      autoRecoverSpeedMps: autoRecovery?.recoverSpeedMetersPerSec ?? 0,
      autoRecoverBaseRetrieveSpeedMps:
        autoRecovery?.retrieveSpeedMetersPerSec ?? 0,
      autoRecoverReelMaxLoadKg: autoRecovery?.reelMaxLoadKg ?? 0,
      autoRecoverReelEfficiency: autoRecovery?.reelEfficiency ?? 0,
      autoRecoverReelLoadRatio: autoRecovery?.reelLoadRatio ?? 0,
      autoRecoverDesiredMeters: autoRecovery?.desiredRecoverMeters ?? 0,
      autoRecoverMaxByLineMeters: autoRecovery?.maxRecoverByLineMeters ?? 0,
      autoRecoveredMeters: autoRecoveredMeters ?? 0,
      holdRecoveredMeters: holdRecoveredMeters ?? 0,
      reelHoldConfigEnabled: holdReelRecover?.enabled === true,
      reelHoldHasReel: holdReelRecover?.hasReel === true,
      reelHoldPlayerHoldActive:
        holdReelRecover?.playerHoldActive === true,
      playerReelFatigueSessionActive:
        playerReelFatigueSession?.active === true,
      playerReelFatigueSessionStarted:
        playerReelFatigueSession?.startedThisFrame === true,
      playerReelFatigueSessionEnded:
        playerReelFatigueSession?.endedThisFrame === true,
      reelHoldRequiredStrokeRatio:
        holdReelRecover?.requiredStrokeRatio ?? 1,
      holdReelRecoverInputStrokeRatio:
        holdReelRecover?.inputStrokeRatio ?? 0,
      finalRodStrokeRatio: rodPullDisplay.rodStrokeRatio ?? 0,
      holdReelRecoverStrokeRatioDeltaToFull:
        holdReelRecover?.strokeRatioDeltaToFull ?? 0,
      holdReelRecoverStrokeRatioTolerance:
        holdReelRecover?.strokeRatioTolerance ?? 0,
      holdReelRecoverStrokeFull: holdReelRecover?.strokeFull === true,
      reelHoldStrokeFull: holdReelRecover?.strokeFull === true,
      reelHoldRawTensionKg: holdReelRecover?.rawTensionKg ?? 0,
      reelHoldDragLimitKg: holdReelRecover?.dragLimitKg ?? 0,
      reelHoldDragLocked: holdReelRecover?.dragLocked === true,
      reelHoldShouldSlipDrag: holdReelRecover?.shouldSlipDrag === true,
      reelHoldTensionBelowDragLimit:
        holdReelRecover?.tensionBelowDragLimit === true,
      reelHoldTensionBelowMaxLoad:
        holdReelRecover?.tensionBelowMaxLoad === true,
      reelHoldDragCanHold: holdReelRecover?.dragCanHold === true,
      reelHoldRetrieveSpeedMps:
        holdReelRecover?.retrieveSpeedMetersPerSecond ?? 0,
      holdReelRecoverEligible: !!holdReelRecover?.eligible,
      holdReelRecoverActive: !!holdReelRecover?.active,
      holdReelRecoverEngaged: !!holdReelRecover?.engaged,
      holdReelRecoveringLine: !!holdReelRecover?.recoveringLine,
      reelHoldActive: !!holdReelRecover?.active,
      reelHoldEngaged: !!holdReelRecover?.engaged,
      reelHoldCanPull:
        (holdReelRecover?.canPull ?? holdReelRecover?.engaged) === true,
      reelHoldRecoveringLine: !!holdReelRecover?.recoveringLine,
      holdReelRecoverHasRecoverableLine:
        !!holdReelRecover?.hasRecoverableLine,
      holdReelRecoverTimerMs: holdReelRecover?.timerMs ?? 0,
      holdReelRecoverDelayMs: holdReelRecover?.delayMs ?? 0,
      holdReelRecoverLoadReserveRatio:
        holdReelRecover?.reelLoadReserveRatio ?? 0,
      holdReelRecoverReelMaxLoadKg: holdReelRecover?.reelMaxLoadKg ?? 0,
      holdReelRecoverSpeedMps:
        holdReelRecover?.recoverSpeedMetersPerSecond ?? 0,
      holdReelRecoverMoveMeters: appliedReelHoldMoveMeters,
      reelHoldMoveMeters: appliedReelHoldMoveMeters,
      reelHoldAppliedSpeedMps,
      reelHoldAppliedDtSec: frameDtSec,
      reelHoldStateUsedForMovement: "previous_frame",
      reelHoldStateCalculatedThisFrame: "current_frame",
      previousReelHoldEngaged: previousReelHoldEngaged === true,
      previousReelHoldActive: previousReelHoldActive === true,
      currentReelHoldEngaged: !!holdReelRecover?.engaged,
      currentReelHoldActive: !!holdReelRecover?.active,
      reelHoldMovementBlockReason: reelHoldMovementBlockReason || "none",
      hardTensionBlocked: !!hardTensionBlocked,
      holdReelRecoverBlockedReason:
        holdReelRecover?.blockedReason || "not_checked",
      reelHoldBlockedReason:
        holdReelRecover?.blockedReason || "not_checked",
      holdReelRecoverLineBlockedReason:
        holdReelRecover?.lineRecoveryBlockedReason || "not_checked",
      holdReelRecoverSource:
        holdReelRecover?.source || "none",
      tensionMode: tensionResult.mode,
      rawTensionKg: frame.rawTensionKg,
      fishTensionKg: frame.fishTensionKg,
      playerHoldTensionKg: frame.playerHoldTensionKg,
      totalTensionKg: frame.totalTensionKg,
      rodStressRatio: tensionResult.rodStressRatio,
      lineStressRatio: tensionResult.lineStressRatio,
      hookStressRatio: tensionResult.hookStressRatio,
      rodMaxLoadKg: stressSystem.getEffectiveRodMaxLoadKg() || 0,
      lineMaxLoadKg: stressSystem.getEffectiveLineSystemMaxLoadKg() || 0,
      hookMaxLoadKg: stressSystem.getEffectiveHookMaxLoadKg() || 0,
      playerForceKg: forceData.player.forceKg,
      activeEffectivePullKg: fishRetrieveResult?.effectiveRodHoldKg ?? 0,
      activeNetPullKg: Math.max(0, Number(fishRetrieveResult?.netForceKg) || 0),
      effectivePullKg: fishRetrieveResult?.usefulPullForceKg ?? 0,
      netPullKg: fishRetrieveResult?.netForceKg ?? 0,
      dragLimitKg: frame.dragLimitKg,
      rawDragLimitKg: forceData.player.dragLimitKg,
      dragLocked: frame.dragLocked,
      rodPullCanWinDistance: rodPullResult.canMoveFish,
      shouldSlipDrag: frame.shouldSlipDrag,
      fishConditionPhase: fishCondition?.phase || "n/a",
      currentStamina: fishCondition?.currentStamina ?? 0,
      currentExhaustion: fishCondition?.currentExhaustion ?? 0,
      fishConditionMaxStamina: fishCondition?.maxStamina ?? 0,
      fishConditionMaxEndurance:
        fishCondition?.maxEndurance ?? fishCondition?.maxPoints ?? 0,
      staminaFrame,
      staminaFrameSource: staminaFrame?.source || "none",
      staminaPhase: staminaFrame?.phase || "stamina",
      framePhase: staminaFrame?.framePhase || staminaFrame?.phase || "stamina",
      frameCurrentExhaustion:
        staminaFrame?.frameCurrentExhaustion ?? 0,
      frameMaxEndurance:
        staminaFrame?.frameMaxEndurance ?? 0,
      frameEnduranceProgress:
        staminaFrame?.frameEnduranceProgress ?? 0,
      staminaPressureRatio: staminaFrame?.staminaPressureRatio ?? 0,
      staminaModelMode: staminaFrame?.staminaModelMode || "legacy",
      staminaMode: staminaFrame?.staminaMode || "idle",
      staminaTransitionReason:
        staminaFrame?.staminaTransitionReason || "none",
      staminaRecoveryFromExhaustionActive:
        staminaFrame?.staminaRecoveryFromExhaustionActive === true,
      rawStaminaInputActive:
        staminaFrame?.rawStaminaInputActive === true,
      staminaNoInputElapsedMs:
        staminaFrame?.staminaNoInputElapsedMs ?? 0,
      staminaNoInputTimeoutMs:
        staminaFrame?.staminaNoInputTimeoutMs ?? 0,
      staminaNoInputRecoveryReady:
        staminaFrame?.staminaNoInputRecoveryReady === true,
      staminaRecoveryTrigger:
        staminaFrame?.staminaRecoveryTrigger || "none",
      staminaPhaseReturnThreshold:
        staminaFrame?.staminaPhaseReturnThreshold ?? 0,
      staminaBefore: staminaFrame?.staminaBefore ?? 0,
      staminaAfter: staminaFrame?.staminaAfter ?? 0,
      playerStaminaPressureKg:
        staminaFrame?.playerStaminaPressureKg ??
        staminaFrame?.usedPlayerPressureKg ??
        0,
      fishStaminaResistanceKg:
        staminaFrame?.fishStaminaResistanceKg ?? 0,
      playerAdvantageRatio:
        staminaFrame?.playerAdvantageRatio ??
        staminaFrame?.activeDrainRatio ??
        0,
      clampedAdvantageRatio:
        staminaFrame?.clampedAdvantageRatio ?? 0,
      staminaDrainMultiplier:
        staminaFrame?.staminaDrainMultiplier ?? 0,
      lateralEdgeRatio:
        staminaFrame?.lateralEdgeRatio ?? 0,
      holdStaminaDrainMultiplier:
        staminaFrame?.holdStaminaDrainMultiplier ?? 1,
      controlStaminaDrainMultiplier:
        staminaFrame?.controlStaminaDrainMultiplier ??
        staminaFrame?.lateralStaminaWeight ??
        0,
      controlCenteringFactor:
        staminaFrame?.controlCenteringFactor ?? 1,
      controlDirectionState:
        staminaFrame?.controlDirectionState || "unknown",
      rodHoldStaminaPressureKg:
        staminaFrame?.rodHoldStaminaPressureKg ?? 0,
      reelHoldStaminaPressureKg:
        staminaFrame?.reelHoldStaminaPressureKg ?? 0,
      controlStaminaPressureKg:
        staminaFrame?.controlStaminaPressureKg ?? 0,
      staminaRegenPerSecond:
        staminaFrame?.passiveStaminaRegenPerSecond ?? 0,
      fatigueRegenMultiplier:
        staminaFrame?.fatigueRegenMultiplier ?? 1,
      staminaPlayerFatigueProgress:
        staminaFrame?.playerFatigueProgress ??
        playerPressureFatigue?.fatigueProgress ??
        0,
      staminaPlayerFatigueFull:
        staminaFrame?.playerFatigueFull === true,
      angleStressRatio: staminaFrame?.angleStressRatio ?? 0,
      staminaAppliedRodHoldKg: staminaFrame?.appliedRodHoldKg ?? 0,
      staminaAppliedReelHoldKg: staminaFrame?.appliedReelHoldKg ?? 0,
      staminaAppliedControlKg: staminaFrame?.appliedControlKg ?? 0,
      staminaPhysicalAppliedRodHoldKg:
        staminaFrame?.physicalAppliedRodHoldKg ??
        staminaFrame?.appliedRodHoldKg ??
        0,
      staminaPhysicalAppliedControlKg:
        staminaFrame?.physicalAppliedControlKg ??
        staminaFrame?.appliedControlKg ??
        0,
      staminaControlAppliedRodHoldKg:
        staminaFrame?.controlAppliedRodHoldKg ??
        staminaFrame?.appliedRodHoldKg ??
        0,
      staminaControlAppliedControlKg:
        staminaFrame?.controlAppliedControlKg ??
        staminaFrame?.appliedControlKg ??
        0,
      staminaPlayerPressureControlExhausted:
        staminaFrame?.playerPressureControlExhausted === true,
      staminaBudgetedRodHoldKg: staminaFrame?.budgetedRodHoldKg ?? 0,
      staminaBudgetedControlKg: staminaFrame?.budgetedControlKg ?? 0,
      staminaUsedPlayerPressureKg:
        staminaFrame?.usedPlayerPressureKg ?? 0,
      staminaRawAppliedPlayerPressureKg:
        staminaFrame?.rawAppliedPlayerPressureKg ?? 0,
      staminaAvailablePlayerPressureKg:
        staminaFrame?.availablePlayerPressureKg ?? 0,
      staminaActiveDrainRatio: staminaFrame?.activeDrainRatio ?? 0,
      staminaActiveDrainPerSecond:
        staminaFrame?.activeDrainPerSecond ?? 0,
      staminaActiveDrain:
        staminaFrame?.activeStaminaDrain ?? 0,
      staminaPassiveRegenPerSecond:
        staminaFrame?.passiveStaminaRegenPerSecond ?? 0,
      staminaPassiveRegen:
        staminaFrame?.passiveStaminaRegen ?? 0,
      staminaAngleRegenMultiplier:
        staminaFrame?.angleRegenMultiplier ?? 1,
      staminaRegenDelayActive:
        staminaFrame?.regenDelayActive === true,
      staminaPressureActive:
        staminaFrame?.staminaPressureActive === true,
      staminaPressureThresholdKg:
        staminaFrame?.staminaPressureThresholdKg ?? 0,
      staminaLineAngleDeg: staminaFrame?.lineAngleDeg ?? 0,
      staminaAngleRecoveryRatio:
        staminaFrame?.angleRecoveryRatio ?? 0,
      staminaAngleRegenPerSecond:
        staminaFrame?.angleRegenPerSecond ?? 0,
      staminaAngleRegen:
        staminaFrame?.angleStaminaRegen ?? 0,
      staminaNetPerSecond:
        staminaFrame?.netStaminaPerSecond ?? 0,
      staminaNetChange:
        staminaFrame?.netStaminaChange ?? 0,
      staminaWeakestTackleLimitKg:
        staminaFrame?.weakestTackleLimitKg ?? 0,
      staminaWeakestTackleLimitComponent:
        staminaFrame?.weakestTackleLimitComponent || "none",
      staminaLateralWeight:
        staminaFrame?.lateralStaminaWeight ?? 0,
      staminaAllowRegenWhilePulling:
        staminaFrame?.allowStaminaRegenWhilePulling === true,
      staminaRegenBlockedByPull:
        staminaFrame?.regenBlockedByPull === true,
      staminaBudgetOverflowWarning:
        staminaFrame?.budgetOverflowWarning === true,
      staminaPassiveDrainEnabled:
        staminaFrame?.passiveDrainEnabled === true,
      staminaPassiveDrainRatio:
        staminaFrame?.passiveDrainRatio ?? 0,
      staminaPassiveDrainPerSecond:
        staminaFrame?.passiveDrainPerSecond ?? 0,
      staminaPassiveDrain:
        staminaFrame?.passiveStaminaDrain ?? 0,
      staminaFishRadialEffortKg:
        staminaFrame?.fishWonRadialForceKg ?? 0,
      staminaDragBlockedKg:
        staminaFrame?.dragBlockedForceKg ?? 0,
      staminaResistanceRatio:
        staminaFrame?.passiveResistanceRatio ?? 0,
      staminaPassiveFishEffortRatio:
        staminaFrame?.passiveFishEffortRatio ?? 0,
      staminaLineTautRatio:
        staminaFrame?.lineTautRatio ?? 0,
      staminaLineTaut:
        staminaFrame?.lineTaut === true,
      staminaBehaviorMultiplier:
        staminaFrame?.passiveBehaviorMultiplier ?? 0,
      staminaBehaviorName:
        staminaFrame?.fishBehaviorName || "unknown",
      staminaShouldSlipDrag:
        staminaFrame?.shouldSlipDrag === true,
      staminaHardLineLimit:
        staminaFrame?.hardLineLimit === true,
      staminaTotalDrainPerSecond:
        staminaFrame?.totalStaminaDrainPerSecond ?? 0,
      staminaTotalDrain:
        staminaFrame?.totalStaminaDrain ?? 0,
      enduranceActiveDrainRatio:
        staminaFrame?.activeEnduranceDrainRatio ?? 0,
      enduranceActiveDrainPerSecond:
        staminaFrame?.activeEnduranceDrainPerSecond ?? 0,
      enduranceActiveDrain:
        staminaFrame?.activeEnduranceDrain ?? 0,
      endurancePassiveDrainRatio:
        staminaFrame?.passiveEnduranceDrainRatio ?? 0,
      endurancePassiveDrainPerSecond:
        staminaFrame?.passiveEnduranceDrainPerSecond ?? 0,
      endurancePassiveDrain:
        staminaFrame?.passiveEnduranceDrain ?? 0,
      enduranceTotalDrainRatio:
        staminaFrame?.enduranceTotalDrainRatio ?? 0,
      enduranceTotalDrainPerSecond:
        staminaFrame?.totalEnduranceDrainPerSecond ?? 0,
      enduranceTotalDrain:
        staminaFrame?.totalEnduranceDrain ?? 0,
      enduranceFishEffortRatio:
        staminaFrame?.enduranceFishEffortRatio ?? 0,
      enduranceResistanceRatio:
        staminaFrame?.enduranceResistanceRatio ?? 0,
      enduranceLineTautRatio:
        staminaFrame?.enduranceLineTautRatio ?? 0,
      enduranceBehaviorName:
        staminaFrame?.enduranceBehaviorName || "unknown",
      enduranceBehaviorMultiplier:
        staminaFrame?.enduranceBehaviorMultiplier ?? 0,
      playerForceY: Math.abs(rodPullResult.forceKg),
      playerForceX: Math.abs(rodControlResult?.forceKg || 0),
      fishForceY: Math.abs(forceData.totalFishForceKg * (forceData.targetVelocity.y < 0 ? -1 : 1)),
      fishForceX: Math.abs(forceData.totalFishForceKg * (forceData.targetVelocity.x ? Math.sign(forceData.targetVelocity.x) : 0)),
      playerMaxPowerY,
      playerMaxPowerX:
        (stressSystem.getEffectiveMaxTackleLoadKg() || 0) *
        (
          physicsConfig.getPlayerSteeringMultiplier() ??
          1.5
        ),
      lineConstrained: constraintResult.constrained,
      fightMode: isPullMode ? "pull" : isRecoverMode ? "recover" : "free",
      retrieveActive: isRecoverMode,
      playerPulling: forceData.player.isPulling,
      currentTensionKg: stressSystem.getTensionKg(),
      fishForceKg: forceData.totalFishForceKg,
      calculatedTensionKg: tensionResult.tensionKg,
      simpleFightSpeedPxPerSec:
        (Number(fishRetrieveResult?.speedMps) || 0) *
        (physicsConfig.getPixelsPerMeter() || 50),
      fightMovementTargetSpeedPxPerSec:
        forceData.fightMovementFrame?.targetSpeedPxPerSec ??
        Math.hypot(forceData.targetVelocity.x || 0, forceData.targetVelocity.y || 0),
      fightMovementActualSpeedPxPerSec:
        forceData.fightMovementFrame?.actualSpeedPxPerSec ?? 0,
      fightMovementDampingApplied:
        !!forceData.fightMovementFrame?.dampingApplied,
      fightMovementFallbackDampedUpdate:
        !!forceData.fightMovementFrame?.fallbackDampedUpdate,
      fishMoveRawVelocityX:
        forceData.fightMovementFrame?.fishMoveRawVelocityX ?? 0,
      fishMoveRawVelocityY:
        forceData.fightMovementFrame?.fishMoveRawVelocityY ?? 0,
      fishMoveAllowedVelocityX:
        forceData.fightMovementFrame?.fishMoveAllowedVelocityX ?? 0,
      fishMoveAllowedVelocityY:
        forceData.fightMovementFrame?.fishMoveAllowedVelocityY ?? 0,
      fishMoveRadialX:
        forceData.fightMovementFrame?.fishMoveRadialX ?? 0,
      fishMoveRadialY:
        forceData.fightMovementFrame?.fishMoveRadialY ?? 0,
      fishMoveRadialSpeedPxPerSec:
        forceData.fightMovementFrame?.fishMoveRadialSpeedPxPerSec ?? 0,
      fishMoveBlockedRadialSpeedPxPerSec:
        forceData.fightMovementFrame?.fishMoveBlockedRadialSpeedPxPerSec ?? 0,
      fishMoveAllowedTangentSpeedPxPerSec:
        forceData.fightMovementFrame?.fishMoveAllowedTangentSpeedPxPerSec ?? 0,
      fishMoveConstraintActive:
        !!forceData.fightMovementFrame?.fishMoveConstraintActive,
      fishMoveConstraintReason:
        forceData.fightMovementFrame?.fishMoveConstraintReason || "none",
      fishMoveProjectionReason:
        forceData.fightMovementFrame?.fishMoveProjectionReason || "free",
      fightMovementLineConstraintReason:
        forceData.fightMovementFrame?.lineConstraintReason || "none",
      fightMovementRadialConstraintActive:
        !!forceData.fightMovementFrame?.radialConstraintActive,
      fightMovementDragCanPayout:
        !!forceData.fightMovementFrame?.dragCanPayout,
      fightMovementDragPayoutBlocked:
        !!forceData.fightMovementFrame?.dragPayoutBlocked,
    };
  }

  #resolvePlayerPullMovementMode({
    appliedReelHoldMoveMeters,
    appliedRodPullMoveMeters,
  } = {}) {
    if (Number(appliedReelHoldMoveMeters) > 0.000001) return "reel_hold";
    if (Number(appliedRodPullMoveMeters) > 0.000001) return "rod_hold";
    return "none";
  }

  #resolveFishMovementMode(frame) {
    if (frame?.fishMoveProjectionReason === "radial_outward_projected") {
      return "radial_projection";
    }
    if (Number(frame?.actualSpeedPxPerSec) > 0.001) return "autonomous";
    return "none";
  }

  #resolveFishMovementSummary({
    frame,
    awayDirX = 0,
    awayDirY = 0,
    fishWonForceKg = 0,
    netForceKg = 0,
    rodControlForceKg = 0,
  } = {}) {
    const moveX = Number(frame?.movedX) || 0;
    const moveY = Number(frame?.movedY) || 0;
    const magnitude = Math.hypot(moveX, moveY);
    const actualSpeedPxPerSec = Math.max(
      0,
      Number(frame?.actualSpeedPxPerSec) || 0,
    );

    if (magnitude <= 0.000001 || actualSpeedPxPerSec <= 0.001) {
      return {
        relation: "none",
        direction: "none",
        strengthKg: 0,
        actualSpeedPxPerSec,
        dirX: 0,
        dirY: 0,
      };
    }

    const dirX = moveX / magnitude;
    const dirY = moveY / magnitude;
    const awayLength = Math.hypot(Number(awayDirX) || 0, Number(awayDirY) || 0);
    const normalizedAwayX = awayLength > 0.000001 ? awayDirX / awayLength : 0;
    const normalizedAwayY = awayLength > 0.000001 ? awayDirY / awayLength : -1;
    const radialDot = dirX * normalizedAwayX + dirY * normalizedAwayY;
    const relation = this.#resolveFishMovementRelation(radialDot);

    return {
      relation,
      direction: this.#resolveEightWayDirection(dirX, dirY),
      strengthKg: this.#resolveFishMovementStrengthKg({
        relation,
        fishWonForceKg,
        netForceKg,
        rodControlForceKg,
      }),
      actualSpeedPxPerSec,
      dirX,
      dirY,
    };
  }

  #resolveFishPressureSummary({
    frame,
    awayDirX = 0,
    awayDirY = 0,
    fishWonForceKg = 0,
    netForceKg = 0,
    rodControlForceKg = 0,
  } = {}) {
    const rawX = Number(frame?.fishMoveRawVelocityX) || 0;
    const rawY = Number(frame?.fishMoveRawVelocityY) || 0;
    const allowedX = Number(frame?.fishMoveAllowedVelocityX) || 0;
    const allowedY = Number(frame?.fishMoveAllowedVelocityY) || 0;
    const rawSpeed = Math.hypot(rawX, rawY);
    const allowedSpeed = Math.hypot(allowedX, allowedY);
    const hasRawVelocity = rawSpeed > 0.001;
    const sourceX = hasRawVelocity ? rawX : allowedX;
    const sourceY = hasRawVelocity ? rawY : allowedY;
    const speedPxPerSec = hasRawVelocity ? rawSpeed : allowedSpeed;
    const hasVelocity = speedPxPerSec > 0.001;
    const fallbackForce = Math.max(
      0,
      Number(fishWonForceKg) || 0,
      Number(netForceKg) || 0,
      Number(rodControlForceKg) || 0,
    );

    if (!hasVelocity && fallbackForce <= 0.000001) {
      return {
        relation: "none",
        direction: "none",
        strengthKg: 0,
        speedPxPerSec: 0,
        dirX: 0,
        dirY: 0,
      };
    }

    const awayLength = Math.hypot(Number(awayDirX) || 0, Number(awayDirY) || 0);
    const normalizedAwayX = awayLength > 0.000001 ? awayDirX / awayLength : 0;
    const normalizedAwayY = awayLength > 0.000001 ? awayDirY / awayLength : -1;
    const dirX = hasVelocity ? sourceX / speedPxPerSec : normalizedAwayX;
    const dirY = hasVelocity ? sourceY / speedPxPerSec : normalizedAwayY;
    const radialDot = dirX * normalizedAwayX + dirY * normalizedAwayY;
    const relation = this.#resolveFishMovementRelation(radialDot);

    return {
      relation,
      direction: this.#resolveEightWayDirection(dirX, dirY),
      strengthKg: this.#resolveFishMovementStrengthKg({
        relation,
        fishWonForceKg,
        netForceKg,
        rodControlForceKg,
      }),
      speedPxPerSec,
      dirX,
      dirY,
    };
  }

  #resolveFishMovementRelation(radialDot) {
    if (radialDot > 0.25) return "away_from_player";
    if (radialDot < -0.25) return "toward_player";
    return "sideways";
  }

  #resolveFishMovementStrengthKg({
    relation,
    fishWonForceKg = 0,
    netForceKg = 0,
    rodControlForceKg = 0,
  } = {}) {
    if (relation === "toward_player") return Math.max(0, Number(netForceKg) || 0);
    if (relation === "away_from_player") {
      return Math.max(0, Number(fishWonForceKg) || 0);
    }
    if (relation === "sideways") {
      return Math.max(
        0,
        Number(fishWonForceKg) || 0,
        Number(rodControlForceKg) || 0,
      );
    }
    return 0;
  }

  #resolveEightWayDirection(dirX, dirY) {
    const horizontal = this.#directionAxis(dirX, "left", "right");
    const vertical = this.#directionAxis(dirY, "up", "down");
    if (vertical && horizontal) return `${vertical}_${horizontal}`;
    return vertical || horizontal || "none";
  }

  #directionAxis(value, negativeName, positiveName) {
    if (value < -0.3826834323650898) return negativeName;
    if (value > 0.3826834323650898) return positiveName;
    return "";
  }
}
