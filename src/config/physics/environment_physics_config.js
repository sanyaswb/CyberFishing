const WATER_PHYSICS_CONFIG = {
  tautBodyResistancePerKg: 0.2,
  motionResistance: 1000,
  speedMultiplier: 64,
};

const ENVIRONMENT_PHYSICS_CONFIG = {
  water: {
    currentInfluenceMultiplier: 1.0,

    fishMotionLoad: {
      speedLoadKgPerKgPerMps: 1.0,
    },
  },
};
