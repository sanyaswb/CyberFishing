const FIGHT_PHYSICS_CONFIG = {
  directionForce: {
    towardPlayerMultiplier: 0.0,
    sideMultiplier: 1.0,
    awayMultiplier: 2.5,
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
    capacityByRodLengthRatio: 0.5,
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
      releaseTimeSeconds: 0.20,
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
