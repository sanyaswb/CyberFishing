/** Predator fish species for FISH_DB. */
const PREDATOR_FISH = [
{
    id: "perch_radioactive",
    name: "Окунь-радіоактивний",
    baseChance: 0.02,
    maxHookSize: 4,

    weatherMultipliers: {
      rain: 2.0,
      fog: 2.5,
    },

    depthConfig: {
      minDepth: 1.0,
      maxDepth: 10.0,
      minWeightAtMinDepth: 0.125,
      maxWeightAtMinDepth: 0.8,
      minWeightAtMaxDepth: 1.123,
      maxWeightAtMaxDepth: 2.678,
      chanceMultAtMaxDepth: 0.4,
    },

    weightConfig: {
      rarityCurve: 3.5,
      maxLevel: 5,
    },

    baitMultipliers: {
      oil_worm: 2.0,
      test_spinner: 1.0,
      test_wobbler_sinking: 1.0,
      test_wobbler_suspend: 1.0,
      test_jig: 1.0,
    },

    timeMultipliers: { morning: 1.5, day: 0.8, evening: 1.2, night: 0.3 },
    dayMultipliers: {
      1: 1.0,
      2: 1.0,
      3: 1.0,
      4: 1.0,
      5: 1.0,
      6: 1.2,
      0: 1.2,
    },

    physics: {
      forceProfile: {
        basePower: 1.0,
        minPowerRatio: 0.25,
      },

      staminaProfile: {
        baseStamina: 900,
      },

      movementProfile: {
        maxSpeedMetersPerSec: 2.2,
        agility: 1.3,
        bounceCooldownMs: 2000,
        dirChangeMinMs: 500,
        dirChangeMaxMs: 1500,
        lastDashTrigger: {
          enabled: true,
          targetState: "lastDash",
          chance: 0.5,
          checkIntervalMs: 1000,
          catchZoneMultiplier: 1.1,
          stayUntilLeaveZone: false,
        },
      },

      resistanceProfile: {
        speedForceMultiplier: 0.35,
        waterResistanceMultiplier: 1.0,
      },

      retrieveProfile: {
        passiveBodyResistanceMultiplier: 1.0,
        activeAwayMultiplier: 1.0,
        waterDragMultiplier: 1.0,
        referencePullSpeedMultiplier: 1.0,
      },

      behaviorProfile: {
        behaviors: {
          idle: {
            powerRatio: 0.8,
            speedRatio: 0.8,
            minTime: 500,
            maxTime: 2000,
            weight: 10,
          },
          rest: {
            powerRatio: 0.5,
            speedRatio: 0.5,
            minTime: 500,
            maxTime: 2500,
            weight: 5,
          },
          swim: {
            powerRatio: 1.0,
            speedRatio: 1.0,
            minTime: 2000,
            maxTime: 4000,
            weight: 55,
          },
          dash: {
            powerRatio: 2.0,
            speedRatio: 1.0,
            minTime: 500,
            maxTime: 1200,
            weight: 30,
          },
          lastDash: {
            enabled: true,
            powerRatio: 2.2,
            speedRatio: 1.2,
            minTime: 1000,
            maxTime: 3000,
            weight: 0,
            dirChangeMinMs: 500,
            dirChangeMaxMs: 1000,
            agility: 1.5,
          },
        }
      },
    },

    biteMechanics: {
      // --- Клювання на Поплавок та Фідер (ТВОЇ СТАРІ ЦИФРИ) ---
      passive: {
        maxSequences: [1, 5],
        sequenceIntervalMs: [1555, 5333],

        chanceGuaranteed: 0.5,
        chanceNormal: 0.5,
        normalIters: [1, 10],
        guaranteedIters: [1, 3],
        intervalMs: [300, 800],
        animDurationMs: [300, 800],

        movementChance: 0.5,
        movementSpeedPx: [2, 8],
        movementDurationMs: [1000, 2500],

        animations: {
          bob: { heightPercent: [-5, 5] },
          sink: { heightPercent: [-50, -10] },
          rise: { heightPercent: [10, 30] },
          tilt: { angle: [-25, 25] },
          slide: {},
        },

        guaranteedModifiers: {
          bobAmpAdd: 10,
          sinkHeightPercent: [-100, -80],
          riseHeightPercent: [30, 70],
          holdDurationMs: [1000, 2500],
          tiltAngle: [85, 90],
          movementSpeedMult: [4.0, 3.0],
          movementDurationMult: [2.0, 2.0],
        },
      },

      // --- Клювання на Спінінгові приманки (Воблер, Блешня, Джиг) ---
      active: {
        chanceGuaranteed: 0.6,
        chanceNormal: 0.4,
        maxSequences: [1, 2],
        sequenceIntervalMs: [200, 400],
        intervalMs: [200, 400],
        animDurationMs: [100, 200],
        movementChance: 1.0,
        movementDurationMs: [100, 250],
        movementSpeedPx: [40, 80],
        guaranteedIters: [1, 1],
        normalIters: [1, 2],
        animations: {
          slide: {}, // Тільки різкі ривки
        },
        guaranteedModifiers: {
          movementSpeedMult: [1.5, 2.5],
          movementDurationMult: [1.0, 1.5],
        },
      },
    },
  }
];
