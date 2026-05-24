const TENSION_PHYSICS_CONFIG = {
  kgSmoothPerSecond: 2.5,
  overloadGraceMs: 0,
  powerRatioExponent: 2.0,
  sensitivityMultiplier: 1.5,
  smoothApproach: 0.15,
  reelRecoveryMultiplier: 0.2,

  breaking: {
    thresholdPercent: 100,
    baseBreakTimeMs: 1000,
    timePerEquipmentLevelMs: 100,
  },
};
