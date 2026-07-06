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
    tensionCeilingMultiplier: 1.0,
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

  playerForceBudget: {
    enabled: true,
    allocationMode: "independent",

    control: {
      maxBudgetShare: 0.5,
      minInputRatio: 0.001,
    },

    tensionCeiling: {
      holdMultiplier: 1.0,
      controlMultiplier: 1.0,
      maxCombinedMultiplier: 1.0,
    },
  },

  playerPressureGain: {
    enabled: true,
    inputThresholds: {
      holdForceKg: 0.01,
      controlInputRatio: 0.05,
      controlForceKg: 0.01,
    },
    multipliers: {
      holdOnly: 1.0,
      controlOnly: 1.0,
      holdAndControl: 1.5,
    },
  },

  playerTensionBuildRate: {
    enabled: true,
    rodControlBuildPerSecond: 4.0,
    inputThresholds: {
      holdForceKg: 0.01,
      controlForceKg: 0.01,
      holdInputRatio: 0.05,
      controlInputRatio: 0.05,
    },
    multipliers: {
      none: 1.0,
      holdOnly: 1.0,
      controlOnly: 1.0,
      holdAndControl: 1.5,
    },
    applyTo: {
      rodHoldCharge: true,
      rodControlBuild: true,
    },
  },

  playerPressureFatigue: {
    enabled: true,
    source: {
      mode: "reel_hold_session",
    },
    pressureThresholdKg: 0.01,
    graceDurationMs: 3000,
    fatigueDurationMs: 6000,
    minEfficiency: 0.45,
    curvePower: 1.2,

    controlBreak: {
      enabled: true,
      fatigueProgressThreshold: 0.9,
      minContinuousPressureMs: 8000,
    },

    recovery: {
      delayAfterPressureMs: 400,
      recoveryPerSecond: 0.8,
      holdCompleteVisibleMs: 500,
    },

    channels: {
      rodHold: true,
      rodControl: true,
    },

    visual: {
      enabled: true,
      position: {
        anchor: "top_right",
        offsetX: 24,
        offsetY: 56,
      },
      radius: 16,
      ringWidth: 4,
      idleVisible: false,
      colors: {
        grace: "#ffffff",
        ready: "#2ecc71",
        warning: "#f1c40f",
        danger: "#e74c3c",
        background: "rgba(0, 0, 0, 0.35)",
        ringBackground: "rgba(255, 255, 255, 0.18)",
      },
    },
  },

  playerPullMotion: {
    inertiaSeconds: 0.16,
  },

  poleFightSector: {
    enabled: true,
    maxAngleFromCenterDeg: 50,
    shoreOpeningWidthMeters: 3.0,
  },

  rodControl: {
    enabled: true,
    tensionCeilingMultiplier: 1.15,

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
      enabled: true,
      targetAnchorMode: "cast_base", // or "current_base"
      maxEffectiveAngleDeg: 20,
      alignedThresholdPx: 8,
      centerStartThresholdPx: 0.5,
    },

    force: {
      sidePullSpeedMultiplier: 1.0,
    },

    tension: {
      sameDirectionMultiplier: 0.0,
      sideMultiplier: 1.0,
      oppositeDirectionMultiplier: 2.5,
      mode: {
        sameDirectionThreshold: 0.35,
        oppositeDirectionThreshold: -0.35,
        minFishSpeedPxPerSec: 1,
      },
    },

    lineConstraint: {
      tautThresholdRatio: 0.995,
      epsilonMeters: 0.001,
      projectLockedMovementToArc: true,
    },

    rodAim: {
      enabled: true,
      maxOffsetScreenRatio: 0.02,
      fallbackMaxOffsetPx: 40,
      baseAimSpeedPxPerSecond: 100,
      fishLoadMinSpeedRatio: 0.3,
      fishLoadMaxSpeedRatio: 1.5,
      fishLoadCurvePower: 1.0,
      tightLineAimMultiplier: 0.35,
      freeLineAimMultiplier: 1.0,
      dragSlipAimMultiplier: 1.3,
      minimumLoadSpeedRatio: 0.35,
      returnSpeedMultiplier: 1.5,
      edgePaddingPx: 16,
      clampToPlayableZone: true,
    },

    rodVisual: {
      maxOffsetScreenRatio: 0.05,
      fallbackMaxOffsetPx: 55,
      moveResponsiveness: 8,
      returnResponsiveness: 5,
      edgePaddingPx: 16,
      clampToPlayableZone: true,
      tightLineFollowsAppliedFish: true,
      followFishMovementRatio: 1.0,
      freeLineUsesInputDrivenVisual: true,
      freeLineResponsiveness: 10,
      weightSpeed: {
        fullSpeedMaxWeightRatio: 0.3,
        minimumSpeedWeightRatio: 1.0,
        minimumSpeedRatio: 0.5,
      },
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
    strokeRatioTolerance: 0.001,
    strokeToleranceMeters: 0.001,
  },

  reelRecovery: {
    fishSpeedMultiplier: 0.5,
  },

  landing: {
    lift: {
      enabled: true,
      liftWeightTensionRatio: 1.0,
      fastLiftTimeSeconds: 0.35,
      releaseTimeSeconds: 0.5,
      slowdownStartRatio: 0.1,
      endSpeedRatio: 0.01,
      slowdownCurvePower: 0.5,
    },

    catchZone: {
      reel: {
        landingDistanceMeters: 1.0,
      },

      pole: {
        landingDistanceByRodLength: 1.0,
        minLandingDistanceMeters: 1.0,
        maxLandingDistanceMeters: 1.0,
      },

      maxLoadWeightRatio: 1.0,
    },
  },
};
