const FISH_RETRIEVE_PHYSICS_CONFIG = {
  passiveBodyResistance: {
    tautBodyResistanceKgPerKg: 0.2,
  },

  activeFishResistance: {
    activeAwayForceMultiplier: 1.0,
  },

  waterDragWhilePulling: {
    referencePullSpeedMetersPerSecond: 1.0,
    dragKgPerKgAtReferenceSpeed: 1.0,
  },

  playerPressureTransfer: {
    referenceWeightKg: 0.5,
    minTransferRatio: 0.05,
    blockedTransferRatio: 1.0,
  },
};

const PASSIVE_RETRIEVE_PHYSICS_CONFIG = {
  power: 1.0,
  multiplier: 35,
  waterFriction: 0.35,
  depthRiseSpeed: 0.15,
};

const LURE_RETRIEVE_PHYSICS_CONFIG = {
  multiplier: 50,
  idleSpinningBiteChance: 0.005,
  defaultDepthNoSinker: 0.1,
  guaranteedBiteCooldownMs: [0, 0],
};

const POLE_IDLE_RETRIEVE_PHYSICS_CONFIG = {
  speedMetersPerSecond: 1.2,
  waterFrictionMultiplier: 0.15,
};

const BITE_FALLBACK_PHYSICS_CONFIG = {
  baitLossChance: {
    normal: 0.0,
    guaranteed: 0.0,
  },
};
