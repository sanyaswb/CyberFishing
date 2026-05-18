/**
 * Item database.
 *
 * Тримає тільки дані предметів. Runtime-логіка, UI та баланс риби
 * не повинні потрапляти в цей файл.
 *
 * Важливо: дальність закидання НЕ зберігається в ITEM_DB.
 * Її рахує CastDistanceCalculator з окремо спорядженої ліски
 * та CONFIG.physics.pixelsPerMeter.
 */
const ITEM_DB = {
  rods: {
    // 1. СПІНІНГ (для блишень, воблерів, джигу)
    rod_test_spin: {
      id: "rod_test_spin",
      name: "Тестовий Спінінг",
      type: "spinning", // Для UI фільтрів
      icon: "🎣",
      displayStats: {
        maxLoadKg: "Макс. навантаження: кг.",
        lengthMeters: "Довжина: м.",
        castPowerCoefficient: "Сила закидання:",
        type: {
          label: "Тип",
          map: {
            spinning: "Спінінг",
            feeder: "Фідер",
            float: "Махова поплавкова",
            pole: "Махова",
          },
        },
        durability: "Стан: %",
      },
      engineStats: {
        type: "spinning", // КРИТИЧНО ДЛЯ ФІЗИКИ
        level: 4,
        basePower: 1.5,
        compensation: 0.6,
        accuracy: 70,
        lengthMeters: 2.4,
        castPowerCoefficient: 0.54,
        maxLoadKg: 1,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        hasReel: true,
        capabilities: ["reel", "lure"],
      },
    },

    // 2. ФІДЕР (донка, прикормка лягає на дно)
    rod_test_feeder: {
      id: "rod_test_feeder",
      name: "Тестовий Фідер",
      type: "feeder", // Для UI фільтрів
      icon: "🎋",
      displayStats: {
        maxLoadKg: "Макс. навантаження: кг.",
        lengthMeters: "Довжина: м.",
        castPowerCoefficient: "Сила закидання:",
        type: {
          label: "Тип",
          map: {
            spinning: "Спінінг",
            feeder: "Фідер",
            float: "Махова поплавкова",
            pole: "Махова",
          },
        },
        durability: "Стан: %",
      },
      engineStats: {
        type: "feeder", // КРИТИЧНО ДЛЯ ФІЗИКИ
        level: 4,
        basePower: 1.5,
        compensation: 0.4,
        accuracy: 85,
        lengthMeters: 3.6,
        castPowerCoefficient: 0.66,
        maxLoadKg: 5,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        hasReel: true,
        capabilities: ["reel", "feeder_rig"],
      },
    },

    // 3. ПОПЛАВКОВА ВУДКА (класика)
    rod_test_float: {
      id: "rod_test_float",
      name: "Бамбукова Вудка",
      type: "float",
      icon: "🎍",
      displayStats: {
        maxLoadKg: "Макс. навантаження: кг.",
        lengthMeters: "Довжина: м.",
        castPowerCoefficient: "Сила закидання:",
        type: {
          label: "Тип",
          map: {
            spinning: "Спінінг",
            feeder: "Фідер",
            float: "Махова поплавкова",
            pole: "Махова",
          },
        },
        durability: "Стан: %",
      },
      engineStats: {
        type: "float",
        level: 1,
        basePower: 1.0,
        compensation: 0.2,
        accuracy: 60,
        lengthMeters: 2.0,
        castPowerCoefficient: 1.0,
        maxLoadKg: 1,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        hasReel: false,
        capabilities: ["float", "sinker", "hook"],
      },
    },
  },

  reels: {
    reel_test: {
      id: "reel_test",
      name: "Тестова Котушка",
      type: "spinning_reel",
      icon: "⚙️",
      displayStats: {
        maxLoadKg: "Макс. навантаження: кг.",
        lineCapacityMeters: "Ємність: м.",
        dragMaxKg: {
          label: "Фрикціон",
          range: ["dragMinKg", "dragMaxKg"],
          suffix: "кг.",
        },
        retrieveSpeedMetersPerSec: "Підмотка: м/с",
        bearingCount: "Підшипники:",
        durability: "Стан: %",
      },
      engineStats: {
        basePower: 1.0,
        maxLoadKg: 2,
        lineCapacityMeters: 20,
        bearingCount: 3,
        retrieveSpeedMetersPerSec: 0.8,
        dragMinKg: 0,
        dragMaxKg: 2,
        dragChangeSpeedPerSec: 0.35,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        requiresTag: "reel",
      },
    },

    reel_bolognese_nodrag: {
      id: "reel_bolognese_nodrag",
      name: "Інерційна котушка без фрикціону",
      type: "spinning_reel",
      icon: "⚙️",
      displayStats: {
        maxLoadKg: "Макс. навантаження: кг.",
        lineCapacityMeters: "Ємність: м.",
        dragMaxKg: "Фрикціон: кг.",
        retrieveSpeedMetersPerSec: "Підмотка: м/с",
        bearingCount: "Підшипники:",
        hasDrag: {
          label: "Фрикціон",
          map: { true: "Є", false: "Немає" },
        },
        durability: "Стан: %",
      },
      engineStats: {
        basePower: 0.6,
        maxLoadKg: 1.5,
        lineCapacityMeters: 18,
        bearingCount: 1,
        retrieveSpeedMetersPerSec: 0.55,
        hasDrag: false,
        dragMinKg: 0,
        dragMaxKg: 0,
        dragChangeSpeedPerSec: 0,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        requiresTag: "reel",
      },
    },
  },

  lines: {
    line_test_13m: {
      id: "line_test_13m",
      name: "Тестова ліска 13м",
      type: "fishing_line",
      icon: "🧵",
      displayStats: {
        lengthMeters: "Довжина: м.",
        diameterMm: "Товщина: мм",
        maxLoadKg: "Макс. навантаження: кг.",
        durability: "Стан: %",
      },
      engineStats: {
        type: "fishing_line",
        lengthMeters: 13,
        diameterMm: 0.22,
        maxLoadKg: 2,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
      },
    },

    line_test_3m: {
      id: "line_test_3m",
      name: "Коротка ліска 3м",
      type: "fishing_line",
      icon: "🧵",
      displayStats: {
        lengthMeters: "Довжина: м.",
        diameterMm: "Товщина: мм",
        maxLoadKg: "Макс. навантаження: кг.",
        durability: "Стан: %",
      },
      engineStats: {
        type: "fishing_line",
        lengthMeters: 3,
        diameterMm: 0.16,
        maxLoadKg: 1,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
      },
    },

    line_test_4m: {
      id: "line_test_4m",
      name: "Коротка ліска 4м",
      type: "fishing_line",
      icon: "🧵",
      displayStats: {
        lengthMeters: "Довжина: м.",
        diameterMm: "Товщина: мм",
        maxLoadKg: "Макс. навантаження: кг.",
        durability: "Стан: %",
      },
      engineStats: {
        type: "fishing_line",
        lengthMeters: 4,
        diameterMm: 0.16,
        maxLoadKg: 1,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
      },
    },
  },

  leaders: {
    leader_test_025: {
      id: "leader_test_025",
      name: "Тестовий поводок 0.25мм",
      type: "leader_line",
      icon: "🪢",
      displayStats: {
        diameterMm: "Товщина: мм",
        maxLoadKg: "Макс. навантаження: кг.",
        durability: "Стан: %",
      },
      engineStats: {
        type: "leader_line",
        diameterMm: 0.25,
        maxLoadKg: 1.2,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        requiresTag: "line",
      },
    },
  },

  hooks: {
    hook_basic: {
      id: "hook_basic",
      name: "Базовий гачок",
      type: "hook",
      icon: "🪝",
      displayStats: {
        weight: "Вага: кг",
        quality: "Якість:",
      },
      engineStats: {
        weight: 4,
        quality: 1,
        requiresTag: "hook",
        capabilities: ["bait"], // ДОДАНО: тепер гачок дозволяє чіпляти наживку!
      },
    },
  },

  baits: {
    feeder_spring_basic: {
      id: "feeder_spring_basic",
      name: "Базова пружина",
      type: "feeder_rig",
      icon: "🪤",
      displayStats: {
        hooksCount: "Гачки:",
        hasChumSlot: {
          label: "Прикормка",
          map: { true: "Є", false: "Немає" },
        },
        quality: "Якість:",
        currentCompensation: "Компенсація:",
      },
      engineStats: {
        requiresTag: "feeder_rig",
        capabilities: ["hook", "bait", "chum_mix"],
        hooksCount: 2,
        hasChumSlot: true,
        quality: 7.0,
        currentCompensation: [0.1, 1.0], // Додано компенсацію для фідерної снасті
      },
    },

    oil_worm: {
      id: "oil_worm",
      name: "Масляний черв'як",
      type: "bait",
      icon: "🪱",
      displayStats: {
        type: {
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      engineStats: { type: "bait", requiresTag: "bait" },
    },

    bread: {
      id: "bread",
      name: "Хліб",
      type: "bait",
      icon: "🍞",
      displayStats: {
        type: {
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      engineStats: { type: "bait", requiresTag: "bait" },
    },

    test_spinner: {
      id: "test_spinner",
      name: "Блешня (Тест)",
      type: "lure",
      icon: "🥄",
      displayStats: {
        type: {
          label: "Тип",
          map: { spinner: "Блешня" },
        },
        quality: "Якість:",
        sinkSpeed: "Занурення: м/с",
        riseSpeed: "Підйом: м/с",
        currentCompensation: "Компенсація:",
      },
      engineStats: {
        type: "spinner",
        mode: 1,
        waterFriction: 0.2,
        sinkSpeed: 1.5,
        riseSpeed: 2.0,
        quality: 8.0,
        currentCompensation: [0.1, 1.0],
        requiresTag: "lure",
      },
    },

    test_wobbler_suspend: {
      id: "test_wobbler_suspend",
      name: "Воблер Suspend",
      type: "lure",
      icon: "🐟",
      displayStats: {
        type: {
          label: "Тип",
          map: { wobbler: "Воблер" },
        },
        quality: "Якість:",
        targetMaxDepth: {
          label: "Глибина",
          range: ["targetMinDepth", "targetMaxDepth"],
          suffix: "м",
        },
        mode: {
          label: "Режим",
          map: { 2: "Suspend", 3: "Sinking" },
        },
        currentCompensation: "Компенсація:",
      },
      engineStats: {
        type: "wobbler",
        mode: 2,
        waterFriction: 0.4,
        sinkSpeed: 1.0,
        riseSpeed: 1.0,
        targetMinDepth: 2.0,
        targetMaxDepth: 4.5,
        maxDepth: 6.5,
        quality: 8.0,
        currentCompensation: [0.1, 1.0],
        requiresTag: "lure",
      },
    },

    test_wobbler_sinking: {
      id: "test_wobbler_sinking",
      name: "Воблер Sinking",
      type: "lure",
      icon: "🐟",
      displayStats: {
        type: {
          label: "Тип",
          map: { wobbler: "Воблер" },
        },
        quality: "Якість:",
        targetMaxDepth: {
          label: "Глибина",
          range: ["targetMinDepth", "targetMaxDepth"],
          suffix: "м",
        },
        mode: {
          label: "Режим",
          map: { 2: "Suspend", 3: "Sinking" },
        },
        currentCompensation: "Компенсація:",
      },
      engineStats: {
        type: "wobbler",
        mode: 3,
        waterFriction: 0.3,
        sinkSpeed: 2.0,
        riseSpeed: 1.5,
        targetMinDepth: 1.0,
        targetMaxDepth: 3.5,
        maxDepth: 5.0,
        quality: 8.0,
        currentCompensation: [0.1, 1.0],
        requiresTag: "lure",
      },
    },

    test_jig: {
      id: "test_jig",
      name: "Джиг",
      type: "jig",
      icon: "🪨",
      displayStats: {
        type: {
          label: "Тип",
          map: { jig: "Джиг" },
        },
        quality: "Якість:",
        sinkSpeed: "Занурення: м/с",
        riseSpeed: "Підйом: м/с",
        currentCompensation: "Компенсація:",
      },
      engineStats: {
        type: "jig",
        mode: 1,
        waterFriction: 0.15,
        sinkSpeed: 3.0,
        riseSpeed: 2.5,
        quality: 7.0,
        currentCompensation: [0.1, 0.9],
        requiresTag: "lure",
      },
    },
  },

  floats: {
    float_day: {
      id: "float_day",
      name: "Денний поплавок",
      type: "float_tackle",
      icon: "🥢",
      displayStats: {
        type: {
          label: "Тип",
          map: { day: "Денний", night: "Нічний" },
        },
        quality: "Якість:",
        windCompensation: "Компенсація:",
        width: "Ширина: мм",
        length: "Довжина: см",
      },

      engineStats: {
        width: 3,
        length: 15,
        type: "day",
        quality: 10.0,
        windCompensation: [0.1, 1.0],
        overDepthPenaltyMult: 0.5,
        sinkingDelayMs: 500,
        sinkingDurationMs: 4000,
        requiresTag: "float",
      },
    },
  },

  sinkers: {
    sinker_light: {
      id: "sinker_light",
      name: "Легкий грузик",
      type: "sinker",
      icon: "🪨",
      displayStats: {
        weight: {
          label: "Вага",
          map: { light: "Легкий", medium: "Середній", heavy: "Важкий" },
        },
        maxDepth: "Макс. глибина: м",
        quality: "Якість:",
      },
      engineStats: {
        level: 1,
        quality: 10.0,
        maxDepth: 10.0,
        currentCompensation: [0.1, 1.0],
        weight: "light",
        weights: {
          light: { speedMult: 1.0, heightScale: 1.0 },
          medium: { speedMult: 1.5, heightScale: 0.85 },
          heavy: { speedMult: 2.0, heightScale: 0.7 },
        },
        requiresTag: "sinker",
      },
    },
  },

  nets: {
    net_basic: {
      id: "net_basic",
      name: "Базова підсака",
      type: "net", // Залишається як є
      icon: "🕸️",
      displayStats: {
        maxWeight: "Макс. вага: кг",
        length: "Довжина: м",
        quality: "Якість:",
      },
      engineStats: {
        active: true,
        length: 3.0,
        maxWeight: 3.0,
        quality: 1.0,
        catchType: "all", // ЗМІНЕНО: type -> catchType
        chances: [
          { min: 0, max: 39, chance: 80 },
          { min: 40, max: 79, chance: 70 },
          { min: 80, max: 99, chance: 60 },
          { min: 100, max: Infinity, chance: 50 },
        ],
      },
    },
  },

  chums: {
    carp_mix_basic: {
      id: "carp_mix_basic",
      name: "Базова коропова суміш",
      type: "chum_mix",
      icon: "🍞",
      displayStats: {
        minBonusDurationHours: "Мін. тривалість: год",
        radius: "Радіус: px",
        maxBonus: "Макс. бонус:",
      },
      engineStats: {
        requiresTag: "chum_mix",
        targetFishes: ["crucian_stalker"],
        radius: 150,
        maxBonus: 2.0,
        minBonus: 1.2,
        rampUpTimeMs: 3600000,
        peakDurationMs: 7200000,
        totalBonusTimeMs: 14400000,
        safeRecastWindowMs: 300000,
        minBonusDurationHours: 24,
      },
    },
  },

  deliveryMethods: {
    boat_lvl3: {
      id: "boat_lvl3",
      name: "Кораблик (Рівень 3)",
      icon: "🚤",
      type: "boat",

      displayStats: {
        speedPxPerSec: {
          label: "Швидкість",
          byLevel: "statsByLevel",
          stat: "speedPxPerSec",
          suffix: "px/с",
        },
        hasSonar: {
          label: "Сонар",
          map: { true: "Встановлено", false: "Немає" },
        },
        sections: "Бункери:",
      },
      engineStats: {
        hasSonar: true,
        showSensors: false,
        manualControl: false,
        type: "boat",
        capabilities: ["chum_mix"],
        sections: 3,
        level: 3,
        statsByLevel: {
          1: { speedPxPerSec: 150, maxEnergy: 60, energyDrainPerSec: 1 },
          2: { speedPxPerSec: 200, maxEnergy: 90, energyDrainPerSec: 1 },
          3: { speedPxPerSec: 250, maxEnergy: 120, energyDrainPerSec: 1 },
        },

        maneuver: {
          reverseTimeSec: 0.8,
          reverseThrustMult: 0.8,
          maneuverTimeSec: 1.5,
          maneuverThrustMult: 0.3,
          maneuverSpeedMult: 0.4,
        },

        sensorRangeFactor: 1.5,
        turnSpeedRad: 2.5,
        avoidancePersistenceMs: 300,
        avoidanceThrustMultiplier: 0.5,
        acceleration: 800,
        slowRadius: 150,
        brakeForce: 0.5,
        finishRadiusTarget: 5,
        finishRadiusReturning: 30,
        emoji: "🚤",
      },
    },
  },

  misc: {
    sys_build_box: {
      id: "sys_build_box",
      name: "Ящик збірки",
      type: "build_box",
      icon: "🧰",
      displayStats: {},
      engineStats: { type: "build_box" },
    },
  },
};
