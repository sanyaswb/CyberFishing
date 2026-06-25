const TACKLE_PHYSICS_CONFIG = {
  line: {
    defaultMaxLoadKg: 12,
    durabilityMaxLoadLossPerPercent: 0.001,
    rodLengthReserveMultiplier: 1.0,
    noReelMinRodLengthMultiplier: 1.0,
    noReelExtraLengthMeters: 1.0,
    noReelRodLengthMultiplier: 2.0,
    fullExtensionTensionMultiplier: 1.0,
    slackTensionMultiplier: 0.0,
    constraintTolerancePx: 0.5,
  },

  reelDrag: {
    minRatio: 0,
    maxRatio: 1,
    tensionGrowthPower: 1.6,
    autoRetrieveEnabled: true,
    creepReleaseRatio: 0,

    pointerControl: {
      enabled: true,
      powerSwipePx: 200,
      powerDeadzoneRatio: 0.25,
      powerAnchorReturnPxPerSecond: 1200,
    },

    keyboardControl: {
      changeSpeedPerSec: 0.35,
    },
  },

  reel: {
    autoRecoverSlack: true,
    holdRecoverAfterFullStrokeMs: 0,
    holdRecoverStrokeRatio: 1.0,
    bearingRetrieveSpeedBonusMetersPerSec: 0.2,
  },
};
