/**
 * Reusable fish physics profile presets.
 *
 * Presets describe archetypes. Species files can reuse them directly or override
 * only the fields that make a fish unique.
 */
const COMMON_LAST_DASH_TRIGGER = Object.freeze({
  enabled: true,
  targetState: "lastDash",
  chance: 0.5,
  checkIntervalMs: 1000,
  catchZoneMultiplier: 1.1,
  stayUntilLeaveZone: false,
});

const COMMON_LAST_DASH_BEHAVIOR = Object.freeze({
  enabled: true,
  forceMultiplier: 0,
  speedMultiplier: 0,
  powerRatio: 0,
  speedRatio: 0,
  minTime: 1000,
  maxTime: 3000,
  weight: 0,
  dirChangeMinMs: 500,
  dirChangeMaxMs: 1000,
  agility: 1,
});

const FISH_PROFILE_PRESETS = Object.freeze({
  passiveTrainingFish: Object.freeze({
    forceProfile: Object.freeze({
      basePower: 0,
      minPowerRatio: 0,
    }),
    staminaProfile: Object.freeze({
      baseStamina: 1000,
    }),
    movementProfile: Object.freeze({
      baseSpeed: 0,
      maxSpeedMetersPerSec: 0,
      agility: 0,
      bounceCooldownMs: 2000,
      dirChangeMinMs: 500,
      dirChangeMaxMs: 1500,
      lastDashTrigger: Object.freeze({
        ...COMMON_LAST_DASH_TRIGGER,
        catchZoneMultiplier: 1.5,
      }),
    }),
    resistanceProfile: Object.freeze({
      speedForceMultiplier: 0,
      waterResistanceMultiplier: 0,
    }),
    retrieveProfile: Object.freeze({
      passiveBodyResistanceMultiplier: 1.0,
      activeAwayMultiplier: 1.0,
      waterDragMultiplier: 1.0,
      referencePullSpeedMultiplier: 1.0,
    }),
    behaviorProfile: Object.freeze({
      behaviors: Object.freeze({
        idle: Object.freeze({ forceMultiplier: 0, speedMultiplier: 0, powerRatio: 0, speedRatio: 0, minTime: 500, maxTime: 3000, weight: 25 }),
        rest: Object.freeze({ forceMultiplier: 0, speedMultiplier: 0, powerRatio: 0, speedRatio: 0, minTime: 500, maxTime: 2500, weight: 25 }),
        swim: Object.freeze({ forceMultiplier: 0, speedMultiplier: 0, powerRatio: 0, speedRatio: 0, minTime: 2000, maxTime: 4000, weight: 25 }),
        dash: Object.freeze({ forceMultiplier: 0, speedMultiplier: 0, powerRatio: 0, speedRatio: 0, minTime: 1000, maxTime: 2200, weight: 25 }),
        lastDash: COMMON_LAST_DASH_BEHAVIOR,
      }),
    }),
  }),

  activePredator: Object.freeze({
    forceProfile: Object.freeze({
      basePower: 1.0,
      minPowerRatio: 0.25,
    }),
    staminaProfile: Object.freeze({
      baseStamina: 900,
    }),
    movementProfile: Object.freeze({
      baseSpeed: 1.0,
      maxSpeedMetersPerSec: 2.2,
      agility: 1.3,
      bounceCooldownMs: 2000,
      dirChangeMinMs: 500,
      dirChangeMaxMs: 1500,
      lastDashTrigger: COMMON_LAST_DASH_TRIGGER,
    }),
    resistanceProfile: Object.freeze({
      speedForceMultiplier: 0.35,
      waterResistanceMultiplier: 1.0,
    }),
    retrieveProfile: Object.freeze({
      passiveBodyResistanceMultiplier: 1.0,
      activeAwayMultiplier: 1.0,
      waterDragMultiplier: 1.0,
      referencePullSpeedMultiplier: 1.0,
    }),
    behaviorProfile: Object.freeze({
      behaviors: Object.freeze({
        idle: Object.freeze({ forceMultiplier: 0.2, speedMultiplier: 0, powerRatio: 0.2, speedRatio: 0, minTime: 1000, maxTime: 3000, weight: 20 }),
        rest: Object.freeze({ forceMultiplier: 0.1, speedMultiplier: 0, powerRatio: 0.1, speedRatio: 0, minTime: 500, maxTime: 2500, weight: 15 }),
        swim: Object.freeze({ forceMultiplier: 0.8, speedMultiplier: 0.6, powerRatio: 0.8, speedRatio: 0.6, minTime: 2000, maxTime: 4000, weight: 40 }),
        dash: Object.freeze({ forceMultiplier: 1.2, speedMultiplier: 1.0, powerRatio: 1.2, speedRatio: 1.0, minTime: 1000, maxTime: 2200, weight: 25 }),
        lastDash: Object.freeze({ ...COMMON_LAST_DASH_BEHAVIOR, forceMultiplier: 2.5, speedMultiplier: 1.4, powerRatio: 2.5, speedRatio: 1.4 }),
      }),
    }),
  }),

  smallPeaceful: Object.freeze({
    forceProfile: Object.freeze({ basePower: 0.7, minPowerRatio: 0.2 }),
    staminaProfile: Object.freeze({ baseStamina: 700 }),
    movementProfile: Object.freeze({
      baseSpeed: 1.0,
      maxSpeedMetersPerSec: 0.7,
      agility: 0.8,
      bounceCooldownMs: 2000,
      dirChangeMinMs: 700,
      dirChangeMaxMs: 1800,
      lastDashTrigger: COMMON_LAST_DASH_TRIGGER,
    }),
    resistanceProfile: Object.freeze({
      speedForceMultiplier: 0.25,
      waterResistanceMultiplier: 0.9,
    }),
    retrieveProfile: Object.freeze({
      passiveBodyResistanceMultiplier: 0.9,
      activeAwayMultiplier: 0.8,
      waterDragMultiplier: 0.85,
      referencePullSpeedMultiplier: 1.0,
    }),
    behaviorProfile: Object.freeze({
      behaviors: Object.freeze({
        idle: Object.freeze({ forceMultiplier: 0.1, speedMultiplier: 0, powerRatio: 0.1, speedRatio: 0, minTime: 1000, maxTime: 3500, weight: 30 }),
        rest: Object.freeze({ forceMultiplier: 0.05, speedMultiplier: 0, powerRatio: 0.05, speedRatio: 0, minTime: 800, maxTime: 2500, weight: 25 }),
        swim: Object.freeze({ forceMultiplier: 0.45, speedMultiplier: 0.45, powerRatio: 0.45, speedRatio: 0.45, minTime: 2000, maxTime: 4500, weight: 35 }),
        dash: Object.freeze({ forceMultiplier: 0.8, speedMultiplier: 0.8, powerRatio: 0.8, speedRatio: 0.8, minTime: 800, maxTime: 1800, weight: 10 }),
        lastDash: COMMON_LAST_DASH_BEHAVIOR,
      }),
    }),
  }),
});
