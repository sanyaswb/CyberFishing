/**
 * Reusable fish physics profile presets for simplified fight physics.
 *
 * Presets describe only values used by the v0.19 fight model:
 * - forceProfile.basePower;
 * - staminaProfile;
 * - movementProfile.baseSpeed + AI movement metadata;
 * - behaviorProfile.behaviors.*.forceMultiplier/speedMultiplier.
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
  minTime: 1000,
  maxTime: 3000,
  weight: 0,
  dirChangeMinMs: 500,
  dirChangeMaxMs: 1000,
  agility: 1,
});

const FISH_PROFILE_PRESETS = Object.freeze({
  passiveTrainingFish: Object.freeze({
    forceProfile: Object.freeze({ basePower: 0 }),
    staminaProfile: Object.freeze({ baseStamina: 1000 }),
    movementProfile: Object.freeze({
      baseSpeed: 0,
      agility: 0,
      bounceCooldownMs: 2000,
      dirChangeMinMs: 500,
      dirChangeMaxMs: 1500,
      lastDashTrigger: Object.freeze({
        ...COMMON_LAST_DASH_TRIGGER,
        catchZoneMultiplier: 1.5,
      }),
    }),
    behaviorProfile: Object.freeze({
      behaviors: Object.freeze({
        idle: Object.freeze({ forceMultiplier: 0, speedMultiplier: 0, minTime: 500, maxTime: 3000, weight: 25 }),
        rest: Object.freeze({ forceMultiplier: 0, speedMultiplier: 0, minTime: 500, maxTime: 2500, weight: 25 }),
        swim: Object.freeze({ forceMultiplier: 0, speedMultiplier: 0, minTime: 2000, maxTime: 4000, weight: 25 }),
        dash: Object.freeze({ forceMultiplier: 0, speedMultiplier: 0, minTime: 1000, maxTime: 2200, weight: 25 }),
        lastDash: COMMON_LAST_DASH_BEHAVIOR,
      }),
    }),
  }),

  activePredator: Object.freeze({
    forceProfile: Object.freeze({ basePower: 1.0 }),
    staminaProfile: Object.freeze({ baseStamina: 900 }),
    movementProfile: Object.freeze({
      baseSpeed: 1.0,
      agility: 1.3,
      bounceCooldownMs: 2000,
      dirChangeMinMs: 500,
      dirChangeMaxMs: 1500,
      lastDashTrigger: COMMON_LAST_DASH_TRIGGER,
    }),
    behaviorProfile: Object.freeze({
      behaviors: Object.freeze({
        idle: Object.freeze({ forceMultiplier: 0.2, speedMultiplier: 0.0, minTime: 1000, maxTime: 3000, weight: 20 }),
        rest: Object.freeze({ forceMultiplier: 0.1, speedMultiplier: 0.0, minTime: 500, maxTime: 2500, weight: 15 }),
        swim: Object.freeze({ forceMultiplier: 0.8, speedMultiplier: 0.6, minTime: 2000, maxTime: 4000, weight: 40 }),
        dash: Object.freeze({ forceMultiplier: 1.2, speedMultiplier: 1.0, minTime: 1000, maxTime: 2200, weight: 25 }),
        lastDash: Object.freeze({ ...COMMON_LAST_DASH_BEHAVIOR, forceMultiplier: 2.5, speedMultiplier: 1.4 }),
      }),
    }),
  }),

  smallPeaceful: Object.freeze({
    forceProfile: Object.freeze({ basePower: 0.7 }),
    staminaProfile: Object.freeze({ baseStamina: 700 }),
    movementProfile: Object.freeze({
      baseSpeed: 1.0,
      agility: 0.8,
      bounceCooldownMs: 2000,
      dirChangeMinMs: 700,
      dirChangeMaxMs: 1800,
      lastDashTrigger: COMMON_LAST_DASH_TRIGGER,
    }),
    behaviorProfile: Object.freeze({
      behaviors: Object.freeze({
        idle: Object.freeze({ forceMultiplier: 0.1, speedMultiplier: 0.0, minTime: 1000, maxTime: 3500, weight: 30 }),
        rest: Object.freeze({ forceMultiplier: 0.05, speedMultiplier: 0.0, minTime: 800, maxTime: 2500, weight: 25 }),
        swim: Object.freeze({ forceMultiplier: 0.45, speedMultiplier: 0.45, minTime: 2000, maxTime: 4500, weight: 35 }),
        dash: Object.freeze({ forceMultiplier: 0.8, speedMultiplier: 0.8, minTime: 800, maxTime: 1800, weight: 10 }),
        lastDash: COMMON_LAST_DASH_BEHAVIOR,
      }),
    }),
  }),
});
