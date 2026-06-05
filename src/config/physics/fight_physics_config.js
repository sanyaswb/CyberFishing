const FIGHT_PHYSICS_CONFIG = {
  directionForce: {
    towardPlayerMultiplier: 0.0,
    sideMultiplier: 1.0,
    awayMultiplier: 2.5,
    towardPlayerHoldOppositionRatio: 0.0,
    sideHoldOppositionRatio: 0.35,
    awayHoldOppositionRatio: 1.0,
  },

  rodHold: {
    chargeTimeSeconds: 0.35,
    distanceMultiplierByRodLength: 0.5,
    minStrokeMeters: 0.001,
    finalLandingDistanceMeters: 0.5,

    anglePenalty: {
      enabled: true,
      noPenaltyAngleDeg: 15,
      maxPenaltyAngleDeg: 75,
      maxPenaltyMultiplier: 0.9,
    },
  },

  rodStroke: {
    capacityByRodLengthRatio: 1.0,
  },

  playerPullMotion: {
    inertiaSeconds: 0.16,
  },

  rodControl: {
    enabled: true,

    input: {
      minLockDistancePx: 10,
      screenWidthRatioForFullPower: 0.2,
      fallbackFullPowerPx: 90,
      horizontalDominanceRatio: 1.25,
      directionDeadZonePx: 12,
      directionSwitchDeadZonePx: 24,
      keyboardRampUpSeconds: 0.25,
      keyboardRampDownSeconds: 0.18,
    },

    alignment: {
      useActualRodPositionAsTarget: true,
      minInitialOffsetPx: 12,
      alignedThresholdPx: 8,
      maxEffectiveAngleDeg: 45,
      allowAwayDirection: false,
      awayDirectionMultiplier: 0,
    },

    force: {
      maxForceKg: 0.22,
      sidePullSpeedMultiplier: 1.0,
      fishWeightResistanceMultiplier: 0.35,
    },

    tension: {
      sameDirectionMultiplier: 0.0,
      sideMultiplier: 1.0,
      oppositeDirectionMultiplier: 2.5,
    },

    rodVisual: {
      maxOffsetScreenRatio: 0.05,
      fallbackMaxOffsetPx: 55,
      returnSmoothing: 5,
      edgePaddingPx: 16,
      clampToPlayableZone: true,
      followFishMovementRatio: 1.0,
      dragSlipResponsiveness: 10,
    },

    lineCoupling: {
      tightLineUsesFishDrivenVisual: true,
      dragSlipUsesInputDrivenVisual: true,
    },

    reelHold: {
      enabled: true,
      limitRatio: 0.98,
    },
  },

  tension: {
    smoothingPerSecond: 10.0,
    slackTensionKg: 0.0,
    movableHoldTensionCapRatio: 1.0,
  },

  reelHold: {
    enabled: true,
    requireRodStrokeFull: true,
    delayMs: 0,
    strokeRatio: 1.0,
    strokeToleranceMeters: 0.001,
  },

  landing: {
    lift: {
      enabled: true,
      liftWeightTensionRatio: 1.0,
      liftTimeSeconds: 0.35,
      releaseTimeSeconds: 0.2,
    },

    catchZone: {
      reel: {
        landingDistanceMeters: 1.0,
      },

      pole: {
        landingDistanceByRodLength: 1.0,
        minLandingDistanceMeters: 1.0,
        maxLandingDistanceMeters: 2.0,
      },

      maxLoadWeightRatio: 1.0,
    },
  },
};
