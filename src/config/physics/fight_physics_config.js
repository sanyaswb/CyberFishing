const FIGHT_PHYSICS_CONFIG = {
  fishForce: {
    dynamicLoadFromMotion: {
      enabled: true,

      directionMultiplier: {
        sameDirection: 0.4,
        sideDirection: 1.0,
        oppositeDirection: 1.8,
      },
    },

    exhaustion: {
      minPowerRatioFallback: 0.25,
    },
  },

  playerControl: {
    steering: {
      xAxisMultiplier: 1.5,
      inputSteeringBlend: 0.35,
      edgePullPenalty: 0.5,
      distanceXMultiplier: [0.3, 1.0],
    },

    rodAnglePenalty: {
      enabled: true,
      noPenaltyAngleDeg: 15,
      maxPenaltyAngleDeg: 75,
      maxPenaltyMultiplier: 0.65,
    },
  },

  rodPull: {
    enabled: true,
    pumpCreditReducesNextPullDistance: false,
    distanceMultiplierByRodLength: 0.5,
    strokeChargePerSecond: 1.0,
    minEffectivePullKg: 0.01,
    minStrokeMeters: 0.001,
    finalLandingDistanceMeters: 0.5,
    controlledPullLimitRatio: 0.6,
  },

  fishRetrieve: FISH_RETRIEVE_PHYSICS_CONFIG,

  landing: {
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
