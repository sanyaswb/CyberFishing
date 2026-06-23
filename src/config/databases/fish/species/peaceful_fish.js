/** Peaceful fish species for FISH_DB. */
const PEACEFUL_FISH = [
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
      maxWeightAtMinDepth: 0.3,
      minWeightAtMaxDepth: 0.751,
      maxWeightAtMaxDepth: 5.0,
      chanceMultAtMaxDepth: 0.2,
    },

    weightConfig: {
      rarityCurve: 1.0,
      maxLevel: 6,
      levelWeightRanges: [
        { level: 1, min: 0.05, max: 0.25, basePower: 1 },
        { level: 2, min: 0.251, max: 0.75, basePower: 1 },
        { level: 3, min: 0.751, max: 1.5, basePower: 1 },
        { level: 4, min: 1.501, max: 2.5, basePower: 1 },
        { level: 5, min: 2.501, max: 3.5, basePower: 1 },
        { level: 6, min: 3.501, max: 5.0, basePower: 1 },
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
      forceProfile: {
        basePower: 1.0,
      },

      staminaProfile: {
        baseStamina: 1000,
      },

      movementProfile: {
        baseSpeed: 1.0,
        agility: 0.2,
        bounceCooldownMs: 2000,
        dirChangeMinMs: 500,
        dirChangeMaxMs: 1500,
        radialRange: [-0.3, 1],
        lateralRange: [-1, 1],
        lastDashTrigger: {
          enabled: true,
          targetState: "lastDash",
          chance: 0.5,
          checkIntervalMs: 1000,
          catchZoneMultiplier: 1.5,
          stayUntilLeaveZone: false,
        },
      },

      behaviorProfile: {
        behaviors: {
          idle: {
            forceMultiplier: 0.7,
            speedMultiplier: 1,
            agility: 0.35,
            minTime: 500,
            maxTime: 3000,
            weight: 25,
          },
          rest: {
            forceMultiplier: 0.3,
            speedMultiplier: 0.5,
            agility: 0.25,
            minTime: 500,
            maxTime: 2500,
            weight: 25,
          },
          swim: {
            forceMultiplier: 1,
            speedMultiplier: 1,
            agility: 0.45,
            minTime: 2000,
            maxTime: 4000,
            weight: 25,
          },
          dash: {
            forceMultiplier: 1.2,
            speedMultiplier: 1.5,
            direction: {
              radialRange: [0.75, 1],
              lateralRange: [-0.55, 0.55],
              agility: 0.8,
            },
            minTime: 1000,
            maxTime: 2200,
            weight: 25,
          },
          lastDash: {
            enabled: true,
            forceMultiplier: 1.5,
            speedMultiplier: 2,
            direction: {
              radialRange: [0.85, 1],
              lateralRange: [-0.35, 0.35],
              agility: 1,
            },
            minTime: 1000,
            maxTime: 3000,
            weight: 0,
            dirChangeMinMs: 500,
            dirChangeMaxMs: 1000,
            agility: 1,
          },
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
];
