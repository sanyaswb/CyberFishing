export const PASSIVE_RETRIEVE_PHYSICS_CONFIG = {
  passiveRetrievePowerRatio: 1.0,
  multiplier: 35,
  waterFriction: 0.35,
  depthRiseSpeed: 0.15,
};

export const LURE_RETRIEVE_PHYSICS_CONFIG = {
  multiplier: 50,
  idleSpinningBiteChance: 0.005,
  defaultSurfaceDepthMeters: 0.1,
  guaranteedBiteCooldownMs: [0, 0],
};

export const POLE_IDLE_RETRIEVE_PHYSICS_CONFIG = {
  speedMetersPerSecond: 1.2,
  waterFrictionMultiplier: 0.15,
};

export const BITE_FALLBACK_PHYSICS_CONFIG = {
  baitLossChance: {
    normal: 0.0,
    guaranteed: 0.0,
  },
};
