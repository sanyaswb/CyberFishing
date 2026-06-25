const TENSION_PHYSICS_CONFIG = {
  kgSmoothPerSecond: 2.5,
  overloadGraceMs: 0,

  breaking: {
    thresholdPercent: 100,
    baseBreakTimeMs: 1000,
    timePerEquipmentLevelMs: 100,
  },

  tackleStress: {
    enabled: true,

    stress: {
      capacity: 1.0,
      baseGainPerSecond: 0.45,
      recoveryPerSecond: 0.35,
      minStressToRoll: 0.01,
    },

    failureRoll: {
      intervalMs: 500,
      chanceScale: 1.0,
    },

    failureSelection: {
      tieBreakPriority: ["leader", "line", "hook", "rod", "reel"],
    },
  },
};
