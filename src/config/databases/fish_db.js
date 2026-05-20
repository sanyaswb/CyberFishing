/**
 * Fish species database.
 *
 * Тримає тільки дані видів риби: spawn chance, вагу, клювання, фізику
 * та візуальні шаблони. Runtime-налаштування спавну лишаються в CONFIG.spawns.
 */
const FISH_DB = [
  {
    id: "crucian_stalker",
    name: "Карась-сталкер",
    baseChance: 0.02,
    maxHookSize: 6,
    trophyWeightKg: 1.0,
    visual: {
      imagePattern: "assets/fish/crucian_stalker/crucian_stalker--{level}.webp",
      uniqueLevel: 6,
    },

    weatherMultipliers: {
      rain: 1.5,
      fog: 1.2,
    },

    depthConfig: {
      minDepth: 0.5,
      maxDepth: 11.0,
      minWeightAtMinDepth: 0.05,
      maxWeightAtMinDepth: 0.8,
      minWeightAtMaxDepth: 0.751,
      maxWeightAtMaxDepth: 5.0,
      chanceMultAtMaxDepth: 0.2,
    },

    weightConfig: {
      rarityCurve: 1.0,
      maxLevel: 6,
      levelWeightRanges: [
        { level: 1, min: 0.05, max: 0.25, basePower: 0.1 },
        { level: 2, min: 0.251, max: 0.75, basePower: 0.1 },
        { level: 3, min: 0.751, max: 1.5, basePower: 0.1 },
        { level: 4, min: 1.501, max: 2.5, basePower: 0.1 },
        { level: 5, min: 2.501, max: 3.5, basePower: 0.1 },
        { level: 6, min: 3.501, max: 5.0, basePower: 0.1 },
      ],
    },

    baitMultipliers: {
      oil_worm: 1.0,
      bread: 1.0,
    },

    timeMultipliers: { morning: 1.0, day: 1.0, evening: 1.0, night: 1.0 },
    dayMultipliers: {
      1: 1.0,
      2: 1.0,
      3: 1.0,
      4: 1.0,
      5: 1.0,
      6: 1.0,
      0: 1.0,
    },

    physics: {
      basePower: 1.0,
      baseStamina: 1000,
      baseSpeedMetersPerSec: 2.0,
      speedForceMultiplier: 0.35,
      waterResistanceMultiplier: 1.0,
      minPowerRatio: 0.25,
      agility: 1.0,
      bounceCooldownMs: 2000,
      dirChangeMinMs: 500,
      dirChangeMaxMs: 1500,

      behaviors: {
        idle: {
          powerRatio: 1.0,
          speedRatio: 1.0,
          minTime: 500,
          maxTime: 3000,
          weight: 25,
        },
        rest: {
          powerRatio: 1.0,
          speedRatio: 1.0,
          minTime: 500,
          maxTime: 2500,
          weight: 25,
        },
        swim: {
          powerRatio: 1.0,
          speedRatio: 1.0,
          minTime: 2000,
          maxTime: 4000,
          weight: 25,
        },
        dash: {
          powerRatio: 1.0,
          speedRatio: 1.0,
          minTime: 1000,
          maxTime: 2200,
          weight: 25,
        },
      },
    },

    biteMechanics: {
      // --- Клювання на Поплавок та Фідер (ТВОЇ СТАРІ ЦИФРИ) ---
      passive: {
        maxSequences: [1, 5],
        sequenceIntervalMs: [1555, 5333],

        chanceGuaranteed: 0.4,
        chanceNormal: 0.6,
        normalIters: [1, 6],
        guaranteedIters: [1, 3],
        intervalMs: [400, 1100],
        animDurationMs: [300, 800],

        movementChance: 0.4,
        movementSpeedPx: [2, 4],
        movementDurationMs: [1000, 2500],

        animations: {
          bob: { heightPercent: [-5, 5] }, // Легке коливання поплавка
          sink: { heightPercent: [-50, -10] }, // Різке занурення (клювання)
          rise: { heightPercent: [10, 30] }, // Різке підняття (клювання)
          tilt: { angle: [-25, 25] },
          slide: {}, // Різкі ривки в сторони
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
    },
  },
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
      basePower: 1.0,
      baseStamina: 900,
      baseSpeedMetersPerSec: 2.2,
      speedForceMultiplier: 0.35,
      waterResistanceMultiplier: 1.0,
      minPowerRatio: 0.25,
      agility: 1.3,
      bounceCooldownMs: 2000,
      dirChangeMinMs: 500,
      dirChangeMaxMs: 1500,
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
  },
];
