const WATER_PHYSICS_CONFIG = {
  tautBodyResistancePerKg: 0.2,
  motionResistance: 1000,
  speedMultiplier: 64,
};

const ENVIRONMENT_PHYSICS_CONFIG = {
  water: {
    // Map/current influence on fish movement only.
    // It does not create additional line tension in the simplified fight model.
    currentInfluenceMultiplier: 1.0,
  },
};
