const SIMULATION_PHYSICS_CONFIG = {
  pixelsPerMeter: 50,
  fixedDtMs: 16.666,
  maxDtMs: 50,
};

const FLOAT_MOTION_PHYSICS_CONFIG = {
  enabled: true,
  minSpeedPxPerSec: 2,
  speedForMaxTiltPxPerSec: 120,
  maxAngleDeg: 24,
  sinkingStartAngleDeg: 90,
  minStandUpDurationMs: 400,
  responseSpeed: 12,
  settleSpeed: 7,
  pullTiltMultiplier: 1.2,
  pullImpulseOvershootDeg: 0,
  pullImpulseResponseSpeed: 32,
  pullImpulseDecaySpeed: 8,
  pullImpulseLateralDeadZone: 0.02,
  pullImpulseDepthDeadZone: 0.02,
  pullImpulseDepthScaleDrop: 0.45,
  lateralInfluence: 1.0,
  verticalInfluence: 0.35,
  verticalTiltSign: 1,
};

const CASTING_POWER_PHYSICS_CONFIG = {
  fallbackCoefficient: 0.5,
  minCoefficient: 0,
  maxCoefficient: 1,
  rodLengthCoefficientPerMeter: 0.1,
  reelBearingCoefficient: 0.1,
};

const PHYSICS_CONFIG = {
  simulation: SIMULATION_PHYSICS_CONFIG,
  water: WATER_PHYSICS_CONFIG,
  environment: ENVIRONMENT_PHYSICS_CONFIG,
  fight: FIGHT_PHYSICS_CONFIG,
  tackle: TACKLE_PHYSICS_CONFIG,
  tension: TENSION_PHYSICS_CONFIG,
  retrieve: {
    passive: PASSIVE_RETRIEVE_PHYSICS_CONFIG,
    lure: LURE_RETRIEVE_PHYSICS_CONFIG,
    poleIdle: POLE_IDLE_RETRIEVE_PHYSICS_CONFIG,
    biteFallback: BITE_FALLBACK_PHYSICS_CONFIG,
  },
  floatMotion: FLOAT_MOTION_PHYSICS_CONFIG,
  castingPower: CASTING_POWER_PHYSICS_CONFIG,
};
