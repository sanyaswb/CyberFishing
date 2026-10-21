import { BITE_FALLBACK_PHYSICS_CONFIG, LURE_RETRIEVE_PHYSICS_CONFIG, PASSIVE_RETRIEVE_PHYSICS_CONFIG, POLE_IDLE_RETRIEVE_PHYSICS_CONFIG } from "../raw/physics/retrieve_physics.js";
import { ENVIRONMENT_PHYSICS_CONFIG, WATER_PHYSICS_CONFIG } from "../raw/physics/environment_physics.js";
import { FIGHT_PHYSICS_CONFIG } from "../raw/physics/fight_physics.js";
import { TACKLE_PHYSICS_CONFIG } from "../raw/physics/tackle_physics.js";
import { TENSION_PHYSICS_CONFIG } from "../raw/physics/tension_physics.js";
import { CAST_ROD_CONTROL_CONFIG } from "../raw/physics/cast_rod_control_config.js";

export const SIMULATION_PHYSICS_CONFIG = {
  pixelsPerMeter: 50,
  fixedDtMs: 16.666,
  maxDtMs: 50,
};

// The float's pose (spec 127). The tackle rules read lyingAngleDeg, minStandUpDurationMs and pullLateralDeadZone (when
// the float lies, stands up and which side a pull turns it to); FloatPoseAnimator draws the pose from the rest: one
// damped spring per axis toward the summed lean of the forces, each force scaled by its gain.
export const FLOAT_POSE_PHYSICS_CONFIG = {
  enabled: true,
  lyingAngleDeg: 90,
  minStandUpDurationMs: 400,
  pullLateralDeadZone: 0.02,
  naturalFrequencyHz: 2.5,
  dampingRatio: 0.55,
  stabilityMin: 0.35,
  maxForceTiltDeg: 60,
  maxInputSpeedMetersPerSec: 4,
  gains: {
    motion: 12,
    line: 8,
    fish: 1,
    wind: 1,
  },
  draft: {
    naturalFrequencyHz: 4,
    dampingRatio: 0.8,
    linePull: 0.2,
  },
};

export const CASTING_POWER_PHYSICS_CONFIG = {
  fallbackCoefficient: 0.5,
  minCoefficient: 0,
  maxCoefficient: 1,
  rodLengthCoefficientPerMeter: 0.1,
  reelBearingCoefficient: 0.1,
};

export const PHYSICS_CONFIG = {
  simulation: SIMULATION_PHYSICS_CONFIG,
  water: WATER_PHYSICS_CONFIG,
  environment: ENVIRONMENT_PHYSICS_CONFIG,
  fight: FIGHT_PHYSICS_CONFIG,
  castRodControl: CAST_ROD_CONTROL_CONFIG,
  tackle: TACKLE_PHYSICS_CONFIG,
  tension: TENSION_PHYSICS_CONFIG,
  retrieve: {
    passive: PASSIVE_RETRIEVE_PHYSICS_CONFIG,
    lure: LURE_RETRIEVE_PHYSICS_CONFIG,
    poleIdle: POLE_IDLE_RETRIEVE_PHYSICS_CONFIG,
    biteFallback: BITE_FALLBACK_PHYSICS_CONFIG,
  },
  floatPose: FLOAT_POSE_PHYSICS_CONFIG,
  castingPower: CASTING_POWER_PHYSICS_CONFIG,
};
