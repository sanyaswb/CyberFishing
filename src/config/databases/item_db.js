/**
 * Item database.
 *
 * Тримає тільки дані предметів. Runtime-логіка, UI та баланс риби
 * не повинні потрапляти в цей файл.
 *
 * Важливо: дальність закидання НЕ зберігається в ITEM_DB.
 * Її рахує CastDistanceCalculator з окремо спорядженої ліски
 * та CONFIG.physics.simulation.pixelsPerMeter.
 * rarityProfile призначається дизайнером і не виводиться з engineStats.
 */
const ITEM_DB = {
  rods: {
    // 1. СПІНІНГ (для блишень, воблерів, джигу)
    rod_test_spin: {
      id: "rod_test_spin",
      name: "Тестовий Спінінг",
      type: "spinning", // Для UI фільтрів
      icon: "🎣",
      rarityProfile: {
        mode: "authored",
        tier: 3,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "rod.spinning" },
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
        quality: 6,
        holdTensionRatio: 1.0,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        hasReel: true,
        capabilities: ["reel", "lure"],
        equipmentCapabilities: {
          supportsReel: true,
          supportsFloat: false,
          supportsFeederRig: false,
          supportsLures: true,
        },
      },
    },

    // 2. ФІДЕР (донка, прикормка лягає на дно)
    rod_test_feeder: {
      id: "rod_test_feeder",
      name: "Тестовий Фідер",
      type: "feeder", // Для UI фільтрів
      icon: "🎣",
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "rod.feeder" },
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
        maxLoadKg: 1,
        quality: 7,
        holdTensionRatio: 1.0,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        hasReel: true,
        capabilities: ["reel", "feeder_rig"],
        equipmentCapabilities: {
          supportsReel: true,
          supportsFloat: false,
          supportsFeederRig: true,
          supportsLures: false,
        },
      },
    },

    // 3. ПОПЛАВКОВА ВУДКА (класика)
    rod_test_float: {
      id: "rod_test_float",
      name: "Бамбукова Вудка",
      type: "float",
      icon: "🎣",
      rarityProfile: {
        mode: "authored",
        tier: 5,
        maxTier: 5,
        isUnique: true,
        uniqueId: "stalker_bamboo_rod",
      },
      progressionProfile: { groupId: "rod.float" },
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
        lengthMeters: 5.0,
        castPowerCoefficient: 1.0,
        maxLoadKg: 1,
        quality: 8,
        holdTensionRatio: 1.0,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        hasReel: false,
        capabilities: ["float", "hook"],
        equipmentCapabilities: {
          supportsReel: false,
          supportsFloat: true,
          supportsFeederRig: false,
          supportsLures: false,
        },
      },
    },
  },

  reels: {
    reel_test: {
      id: "reel_test",
      name: "Тестова Котушка",
      type: "spinning_reel",
      icon: "⚙️",
      rarityProfile: {
        mode: "authored",
        tier: 3,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "reel.drag" },
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
        maxLoadKg: 1,
        lineCapacityMeters: 20,
        bearingCount: 3,
        retrieveSpeedMetersPerSec: 0.8,
        dragMinKg: 0,
        dragMaxKg: 1,
        dragChangeSpeedPerSec: 0.35,
        quality: 6,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        requiresTag: "reel",
        assemblyProfileId: "reel_standard",
      },
    },

    reel_bolognese_nodrag: {
      id: "reel_bolognese_nodrag",
      name: "Інерційна котушка без фрикціону",
      type: "spinning_reel",
      icon: "⚙️",
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "reel.no_drag" },
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
        quality: 4,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
        requiresTag: "reel",
        assemblyProfileId: "reel_standard",
      },
    },
  },

  lines: {
    line_test_1: {
      id: "line_test_1",
      name: "Test line I",
      type: "fishing_line",
      icon: "🧵",
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "line.fishing" },
      displayStats: {
        lengthMeters: "Довжина: м.",
        diameterMm: "Товщина: мм",
        maxLoadKg: "Макс. навантаження: кг.",
        durability: "Стан: %",
      },
      engineStats: {
        type: "fishing_line",
        lengthMeters: 25,
        diameterMm: 0.22,
        maxLoadKg: 1,
        quality: 5,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
      },
    },

    line_test_2: {
      id: "line_test_2",
      name: "Test line II",
      type: "fishing_line",
      icon: "🧵",
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "line.fishing" },
      displayStats: {
        lengthMeters: "Довжина: м.",
        diameterMm: "Товщина: мм",
        maxLoadKg: "Макс. навантаження: кг.",
        durability: "Стан: %",
      },
      engineStats: {
        type: "fishing_line",
        lengthMeters: 10,
        diameterMm: 0.16,
        maxLoadKg: 1,
        quality: 7,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
      },
    },

    line_test_3: {
      id: "line_test_3",
      name: "Test line III",
      type: "fishing_line",
      icon: "🧵",
      rarityProfile: {
        mode: "authored",
        tier: 3,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "line.fishing" },
      displayStats: {
        lengthMeters: "Довжина: м.",
        diameterMm: "Товщина: мм",
        maxLoadKg: "Макс. навантаження: кг.",
        durability: "Стан: %",
      },
      engineStats: {
        type: "fishing_line",
        lengthMeters: 50,
        diameterMm: 0.16,
        maxLoadKg: 1,
        quality: 7,
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
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "line.leader" },
      displayStats: {
        diameterMm: "Товщина: мм",
        maxLoadKg: "Макс. навантаження: кг.",
        durability: "Стан: %",
      },
      engineStats: {
        type: "leader_line",
        diameterMm: 0.25,
        maxLoadKg: 1.2,
        quality: 6,
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
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "hook.standard" },
      displayStats: {
        weight: "Вага: кг",
      },
      engineStats: {
        weight: 4,
        maxLoadKg: 0.8,
        quality: 1,
        assemblyProfileId: "hook_standard",
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
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "rig.feeder" },
      displayStats: {
        hooksCount: "Гачки:",
        hasChumSlot: {
          label: "Прикормка",
          map: { true: "Є", false: "Немає" },
        },
        currentCompensation: "Компенсація:",
      },
      engineStats: {
        requiresTag: "feeder_rig",
        capabilities: ["hook", "bait", "chum_mix"],
        hooksCount: 2,
        hasChumSlot: true,
        rigPower: 1.8,
        quality: 7.0,
        assemblyProfileId: "feeder_spring_basic",
        currentCompensation: [0.1, 1.0], // Додано компенсацію для фідерної снасті
      },
    },

    oil_worm: {
      id: "oil_worm",
      name: "Масляний черв'як",
      type: "bait",
      icon: "🪱",
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      displayStats: {
        type: {
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      engineStats: {
        type: "bait",
        attractionPower: 1.8,
        quality: 8,
        requiresTag: "bait",
      },
    },

    bread: {
      id: "bread",
      name: "Хліб",
      type: "bait",
      icon: "🍞",
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      displayStats: {
        type: {
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      engineStats: {
        type: "bait",
        attractionPower: 1,
        quality: 5,
        requiresTag: "bait",
      },
    },

    test_spinner: {
      id: "test_spinner",
      name: "Блешня (Тест)",
      type: "lure",
      icon: "🥄",
      rarityProfile: {
        mode: "authored",
        tier: 3,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "lure.spinner" },
      displayStats: {
        type: {
          label: "Тип",
          map: { spinner: "Блешня" },
        },
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
        attractionPower: 7,
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
      rarityProfile: {
        mode: "authored",
        tier: 4,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "lure.wobbler" },
      displayStats: {
        type: {
          label: "Тип",
          map: { wobbler: "Воблер" },
        },
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
        attractionPower: 8,
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
      rarityProfile: {
        mode: "authored",
        tier: 3,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "lure.wobbler" },
      displayStats: {
        type: {
          label: "Тип",
          map: { wobbler: "Воблер" },
        },
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
        attractionPower: 7.5,
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
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "lure.jig" },
      displayStats: {
        type: {
          label: "Тип",
          map: { jig: "Джиг" },
        },
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
        jigPower: 6.5,
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
      rarityProfile: {
        mode: "authored",
        tier: 4,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "float.day" },
      displayStats: {
        type: {
          label: "Тип",
          map: { day: "Денний", night: "Нічний" },
        },
        windCompensation: "Компенсація:",
        ballastWeight: {
          label: "Огрузка",
          map: { light: "Легка", medium: "Середня", heavy: "Важка" },
        },
        width: "Ширина: мм",
        length: "Довжина: см",
      },

      engineStats: {
        width: 3,
        length: 15,
        type: "day",
        sensitivity: 9,
        quality: 10.0,
        windCompensation: [0.1, 1.0],
        overDepthPenaltyMult: 0.5,
        sinkingDelayMs: 500,
        sinkingDurationMs: 4000,
        sinkingReferenceDepthMeters: 10.0,
        currentCompensation: [0.1, 1.0],
        ballastWeight: "light",
        ballastProfiles: {
          light: { speedMult: 1.0, heightScale: 1.0 },
          medium: { speedMult: 1.5, heightScale: 0.85 },
          heavy: { speedMult: 2.0, heightScale: 0.7 },
        },
        requiresTag: "float",
      },
    },
  },

  nets: {
    net_basic: {
      id: "net_basic",
      name: "Базова підсака",
      type: "net", // Залишається як є
      icon: "🕸️",
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "net.landing" },
      displayStats: {
        maxWeight: "Макс. вага: кг",
        length: "Довжина: м",
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
          { min: 100, max: null, openEnded: true, chance: 50 },
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
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "chum.carp" },
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
        quality: 6,
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
      rarityProfile: {
        mode: "authored",
        tier: 5,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "delivery.boat" },

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
        quality: 9,
        level: 3,
        assemblyProfileId: "bait_boat",
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
      rarityProfile: null,
      progressionProfile: null,
      displayStats: {},
      engineStats: { type: "build_box" },
    },
  },

  builds: {
    debug_float_build: {
      id: "debug_float_build",
      name: "Test Build (Dev)",
      type: "build_template",
      rarityProfile: null,
      progressionProfile: null,
      items: [
        { itemId: "rod_test_float", quantity: 1 },
        { itemId: "line_test_1", quantity: 1 },
        { itemId: "float_day", quantity: 1 },
        { itemId: "hook_basic", quantity: 1 },
      ],
    },

    debug_feeder_build: {
      id: "debug_feeder_build",
      name: "Test Build (Dev2)",
      type: "build_template",
      rarityProfile: null,
      progressionProfile: null,
      items: [
        { itemId: "rod_test_feeder", quantity: 1 },
        { itemId: "line_test_2", quantity: 1 },
        { itemId: "feeder_spring_basic", quantity: 1 },
        { itemId: "hook_basic", quantity: 1 },
        { itemId: "reel_test", quantity: 1 },
      ],
    },
  },
};
