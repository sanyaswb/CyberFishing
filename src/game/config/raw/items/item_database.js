/**
 * Item database.
 *
 * Тримає тільки дані предметів. Runtime-логіка, UI та баланс риби
 * не повинні потрапляти в цей файл.
 *
 * Важливо: дальність закидання НЕ зберігається в ITEM_DB.
 * Її рахує CastDistanceCalculator з окремо спорядженої ліски
 * та CONFIG.physics.simulation.pixelsPerMeter.
 * rarityProfile призначається дизайнером і не виводиться з gameplayStats.
 */
export const ITEM_DB = {
  rods: {
    // 1. СПІНІНГ (для блишень, воблерів, джигу)
    rod_test_spin: {
      id: "rod_test_spin",
      name: "Тестовий Спінінг",
      itemType: "rod",
      variant: "spinning",
      icon: "🎣",
      rarityProfile: {
        mode: "authored",
        tier: 3,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "rod.spinning" },
      capabilities: ["reel", "lure"],
      equipmentCapabilities: {
        supportsReel: true,
        supportsFloat: false,
        supportsFeederRig: false,
        supportsLures: true,
      },
      displayStats: {
        maxLoadKg: "Макс. навантаження: кг.",
        lengthMeters: "Довжина: м.",
        castPowerCoefficient: "Сила закидання:",
        variant: {
          key: "variant",
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
      gameplayStats: {
        equipmentPowerLevel: 4,
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
      },
    },

    // 2. ФІДЕР (донка, прикормка лягає на дно)
    rod_test_feeder: {
      id: "rod_test_feeder",
      name: "Тестовий Фідер",
      itemType: "rod",
      variant: "feeder",
      icon: "🎣",
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "rod.feeder" },
      capabilities: ["reel", "feeder_rig"],
      equipmentCapabilities: {
        supportsReel: true,
        supportsFloat: false,
        supportsFeederRig: true,
        supportsLures: false,
      },
      displayStats: {
        maxLoadKg: "Макс. навантаження: кг.",
        lengthMeters: "Довжина: м.",
        castPowerCoefficient: "Сила закидання:",
        variant: {
          key: "variant",
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
      gameplayStats: {
        equipmentPowerLevel: 4,
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
      },
    },

    // 3. ПОПЛАВКОВА ВУДКА (класика)
    rod_test_float: {
      id: "rod_test_float",
      name: "Бамбукова Вудка",
      itemType: "rod",
      variant: "float",
      icon: "🎣",
      // Перший скін (spec 071): мініатюра показує нижню половину малюнка; клітинка вудки — весь малюнок з ліскою чи без,
      // прев'ю редактора — весь малюнок.
      skin: {
        id: "bamboo-rod-v1",
        thumbnail: {
          src: "assets/items/rods/bamboo-rod-ecip-v1.webp",
          visibleHeight: 0.5,
          focusX: 0.31,
        },
        equipment: {
          withLine: "assets/items/rods/bamboo-rod-ecip-v1.webp",
          withoutLine: "assets/items/rods/bamboo-rod-unecip-v1.webp",
        },
        // Spine rod in the scene (spec 099): skin of the export (the 2026-10-17 re-export has "default"); the line
        // hangs from the line-tip bone.
        animation: {
          skeleton: "assets/animations/rods/bamboo-rod-v1/rod.json",
          atlas: "assets/animations/rods/bamboo-rod-v1/rod.atlas",
          skin: "default",
          linePoint: "line-tip",
        },
      },
      rarityProfile: {
        mode: "authored",
        tier: 5,
        maxTier: 5,
        isUnique: true,
        uniqueId: "stalker_bamboo_rod",
      },
      progressionProfile: { groupId: "rod.float" },
      capabilities: ["float", "hook"],
      equipmentCapabilities: {
        supportsReel: false,
        supportsFloat: true,
        supportsFeederRig: false,
        supportsLures: false,
      },
      displayStats: {
        maxLoadKg: "Макс. навантаження: кг.",
        lengthMeters: "Довжина: м.",
        castPowerCoefficient: "Сила закидання:",
        variant: {
          key: "variant",
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
      gameplayStats: {
        equipmentPowerLevel: 1,
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
      },
    },
  },

  reels: {
    reel_test: {
      id: "reel_test",
      name: "Тестова Котушка",
      itemType: "reel",
      variant: "spinning_reel",
      icon: "⚙️",
      rarityProfile: {
        mode: "authored",
        tier: 3,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "reel.drag" },
      requiresTag: "reel",
      assemblyProfileId: "reel_standard",
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
      gameplayStats: {
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
      },
    },

    reel_bolognese_nodrag: {
      id: "reel_bolognese_nodrag",
      name: "Інерційна котушка без фрикціону",
      itemType: "reel",
      variant: "spinning_reel",
      icon: "⚙️",
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "reel.no_drag" },
      requiresTag: "reel",
      assemblyProfileId: "reel_standard",
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
      gameplayStats: {
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
      },
    },
  },

  lines: {
    line_test_1: {
      id: "line_test_1",
      name: "Test line I",
      itemType: "fishing_line",
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
      gameplayStats: {
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
      itemType: "fishing_line",
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
      gameplayStats: {
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
      itemType: "fishing_line",
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
      gameplayStats: {
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
      itemType: "leader_line",
      icon: "🪢",
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "line.leader" },
      requiresTag: "line",
      displayStats: {
        diameterMm: "Товщина: мм",
        maxLoadKg: "Макс. навантаження: кг.",
        durability: "Стан: %",
      },
      gameplayStats: {
        diameterMm: 0.25,
        maxLoadKg: 1.2,
        quality: 6,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
      },
    },
  },

  hooks: {
    hook_basic: {
      id: "hook_basic",
      name: "Базовий гачок",
      itemType: "hook",
      icon: "🪝",
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "hook.standard" },
      assemblyProfileId: "hook_standard",
      requiresTag: "hook",
      capabilities: ["bait"],
      displayStats: {
        weight: "Вага: кг",
      },
      gameplayStats: {
        hookSizeGrade: 1,
        hookPowerGrade: 1,
        weight: 4,
        maxLoadKg: 0.8,
        quality: 1,
        durability: 100,
        durabilityMaxLoadLossPerPercent: 0.001,
      },
    },
  },

  baits: {
    live_crucian: {
      id: "live_crucian",
      name: "Живець",
      itemType: "bait",
      icon: "🐟",
      rarityProfile: { mode: "authored", tier: 1, maxTier: 5, isUnique: false },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      gameplayStats: {},
    },
    feeder_spring_basic: {
      id: "feeder_spring_basic",
      name: "Базова пружина",
      itemType: "feeder_rig",
      icon: "🪤",
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "rig.feeder" },
      requiresTag: "feeder_rig",
      capabilities: ["hook", "bait", "chum_mix"],
      assemblyProfileId: "feeder_spring_basic",
      displayStats: {
        hooksCount: "Гачки:",
        hasChumSlot: {
          label: "Прикормка",
          map: { true: "Є", false: "Немає" },
        },
        currentCompensation: "Компенсація:",
      },
      gameplayStats: {
        hooksCount: 2,
        hasChumSlot: true,
        quality: 7.0,
        currentCompensation: [0.1, 1.0], // Додано компенсацію для фідерної снасті
      },
    },

    oil_worm: {
      id: "oil_worm",
      baitId: "oil_worm",
      name: "Масляний черв'як (50 шт)",
      itemType: "bait",
      icon: "🪱",
      iconUrl: "assets/items/baits/oil-worms--50.webp",
      switcherIconUrl: "assets/items/baits/oil-worm_icon.webp",
      packSize: 50,
      defaultQuantity: 50,
      devExclude: true,
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      displayStats: {
        itemType: {
          key: "itemType",
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      gameplayStats: {},
    },

    oil_worm_25: {
      id: "oil_worm_25",
      baitId: "oil_worm",
      name: "Масляний черв'як (25 шт)",
      itemType: "bait",
      icon: "🪱",
      iconUrl: "assets/items/baits/oil-worms--25.webp",
      switcherIconUrl: "assets/items/baits/oil-worm_icon.webp",
      packSize: 25,
      defaultQuantity: 25,
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      displayStats: {
        itemType: {
          key: "itemType",
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      gameplayStats: {},
    },

    oil_worm_50: {
      id: "oil_worm_50",
      baitId: "oil_worm",
      name: "Масляний черв'як (50 шт)",
      itemType: "bait",
      icon: "🪱",
      iconUrl: "assets/items/baits/oil-worms--50.webp",
      switcherIconUrl: "assets/items/baits/oil-worm_icon.webp",
      packSize: 50,
      defaultQuantity: 50,
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      displayStats: {
        itemType: {
          key: "itemType",
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      gameplayStats: {},
    },

    oil_worm_75: {
      id: "oil_worm_75",
      baitId: "oil_worm",
      name: "Масляний черв'як (75 шт)",
      itemType: "bait",
      icon: "🪱",
      iconUrl: "assets/items/baits/oil-worms--75.webp",
      switcherIconUrl: "assets/items/baits/oil-worm_icon.webp",
      packSize: 75,
      defaultQuantity: 75,
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      displayStats: {
        itemType: {
          key: "itemType",
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      gameplayStats: {},
    },

    oil_worm_100: {
      id: "oil_worm_100",
      baitId: "oil_worm",
      name: "Масляний черв'як (100 шт)",
      itemType: "bait",
      icon: "🪱",
      iconUrl: "assets/items/baits/oil-worms--100.webp",
      switcherIconUrl: "assets/items/baits/oil-worm_icon.webp",
      packSize: 100,
      defaultQuantity: 100,
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      displayStats: {
        itemType: {
          key: "itemType",
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      gameplayStats: {},
    },

    bread: {
      id: "bread",
      baitId: "bread",
      name: "Бамбуковий хліб (25 шт)",
      itemType: "bait",
      icon: "🍞",
      iconUrl: "assets/items/baits/bread--25.webp",
      packSize: 25,
      defaultQuantity: 25,
      devExclude: true,
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      displayStats: {
        itemType: {
          key: "itemType",
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      gameplayStats: {},
    },

    bread_10: {
      id: "bread_10",
      baitId: "bread",
      name: "Бамбуковий хліб (10 шт)",
      itemType: "bait",
      icon: "🍞",
      iconUrl: "assets/items/baits/bread--10.webp",
      packSize: 10,
      defaultQuantity: 10,
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      displayStats: {
        itemType: {
          key: "itemType",
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      gameplayStats: {},
    },

    bread_25: {
      id: "bread_25",
      baitId: "bread",
      name: "Бамбуковий хліб (25 шт)",
      itemType: "bait",
      icon: "🍞",
      iconUrl: "assets/items/baits/bread--25.webp",
      packSize: 25,
      defaultQuantity: 25,
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      displayStats: {
        itemType: {
          key: "itemType",
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      gameplayStats: {},
    },

    bread_50: {
      id: "bread_50",
      baitId: "bread",
      name: "Бамбуковий хліб (50 шт)",
      itemType: "bait",
      icon: "🍞",
      iconUrl: "assets/items/baits/bread--50.webp",
      packSize: 50,
      defaultQuantity: 50,
      rarityProfile: {
        mode: "authored",
        tier: 1,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "bait.natural" },
      requiresTag: "bait",
      displayStats: {
        itemType: {
          key: "itemType",
          label: "Тип",
          map: { bait: "Наживка" },
        },
      },
      gameplayStats: {},
    },

    test_spinner: {
      id: "test_spinner",
      name: "Блешня (Тест)",
      itemType: "lure",
      variant: "spinner",
      icon: "🥄",
      rarityProfile: {
        mode: "authored",
        tier: 3,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "lure.spinner" },
      requiresTag: "lure",
      displayStats: {
        variant: {
          key: "variant",
          label: "Тип",
          map: { spinner: "Блешня" },
        },
        sinkSpeed: "Занурення: м/с",
        riseSpeed: "Підйом: м/с",
        currentCompensation: "Компенсація:",
      },
      gameplayStats: {
        mode: 1,
        waterFriction: 0.2,
        sinkSpeed: 1.5,
        riseSpeed: 2.0,
        quality: 8.0,
        currentCompensation: [0.1, 1.0],
      },
    },

    test_wobbler_suspend: {
      id: "test_wobbler_suspend",
      name: "Воблер Suspend",
      itemType: "lure",
      variant: "wobbler",
      icon: "🐟",
      rarityProfile: {
        mode: "authored",
        tier: 4,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "lure.wobbler" },
      requiresTag: "lure",
      displayStats: {
        variant: {
          key: "variant",
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
      gameplayStats: {
        mode: 2,
        waterFriction: 0.4,
        sinkSpeed: 1.0,
        riseSpeed: 1.0,
        targetMinDepth: 2.0,
        targetMaxDepth: 4.5,
        maxDepth: 6.5,
        quality: 8.0,
        currentCompensation: [0.1, 1.0],
      },
    },

    test_wobbler_sinking: {
      id: "test_wobbler_sinking",
      name: "Воблер Sinking",
      itemType: "lure",
      variant: "wobbler",
      icon: "🐟",
      rarityProfile: {
        mode: "authored",
        tier: 3,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "lure.wobbler" },
      requiresTag: "lure",
      displayStats: {
        variant: {
          key: "variant",
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
      gameplayStats: {
        mode: 3,
        waterFriction: 0.3,
        sinkSpeed: 2.0,
        riseSpeed: 1.5,
        targetMinDepth: 1.0,
        targetMaxDepth: 3.5,
        maxDepth: 5.0,
        quality: 8.0,
        currentCompensation: [0.1, 1.0],
      },
    },

    test_jig: {
      id: "test_jig",
      name: "Джиг",
      itemType: "lure",
      variant: "jig",
      icon: "🪨",
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "lure.jig" },
      requiresTag: "lure",
      displayStats: {
        variant: {
          key: "variant",
          label: "Тип",
          map: { jig: "Джиг" },
        },
        sinkSpeed: "Занурення: м/с",
        riseSpeed: "Підйом: м/с",
        currentCompensation: "Компенсація:",
      },
      gameplayStats: {
        mode: 1,
        waterFriction: 0.15,
        sinkSpeed: 3.0,
        riseSpeed: 2.5,
        quality: 7.0,
        currentCompensation: [0.1, 0.9],
      },
    },
  },

  floats: {
    float_day: {
      id: "float_day",
      name: "Денний поплавок",
      itemType: "float",
      variant: "day",
      icon: "🥢",
      iconUrl: "assets/items/floats/float-day.webp",
      // Поплавок на воді (spec 127): тіло з асету, верхня частка waterline (червона антена з чорним пояском) над
      // водою в спокої. glow — адитивне зелене світіння лише кінчика (нічний поплавок), pad — поле розмиття в px арту.
      skin: {
        id: "float-v1",
        scene: {
          src: "assets/items/floats-scene/float-day.webp",
          waterline: 0.3,
        },
      },
      rarityProfile: {
        mode: "authored",
        tier: 4,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "float.day" },
      requiresTag: "float",
      displayStats: {
        variant: {
          key: "variant",
          label: "Тип",
          map: { day: "Денний", night: "Нічний" },
        },
        windCompensation: "Компенсація:",
        mount: {
          label: "Кріплення",
          map: { fixed: "Глухий", sliding: "Ковзний" },
        },
        ballastWeight: {
          label: "Огрузка",
          map: { light: "Легка", medium: "Середня", heavy: "Важка" },
        },
        width: "Ширина: мм",
        length: "Довжина: см",
      },

      gameplayStats: {
        // fixed: the selected depth hangs below the float and shortens the cast by that much line.
        mount: "fixed",
        width: 3,
        length: 15,
        quality: 10.0,
        windCompensation: [0.1, 1.0],
        overDepthPenaltyMult: 0.5,
        sinkingDelayMs: 500,
        sinkingDurationMs: 4000,
        sinkingReferenceDepthMeters: 10.0,
        currentCompensation: [0.1, 1.0],
        ballastWeight: "light",
        // restDraft: share of the float under water at rest; heavier ballast sinks it deeper (spec 127).
        ballastProfiles: {
          light: { speedMult: 1.0, restDraft: 0 },
          medium: { speedMult: 1.5, restDraft: 0.15 },
          heavy: { speedMult: 2.0, restDraft: 0.3 },
        },
      },
    },
    float_night: {
      id: "float_night",
      name: "Нічний поплавок",
      itemType: "float",
      variant: "night",
      icon: "🥢",
      iconUrl: "assets/items/floats/float-day.webp",
      // Поплавок на воді (spec 127): тіло з асету, верхня частка waterline (червона антена з чорним пояском) над
      // водою в спокої. glow — адитивне зелене світіння лише кінчика (нічний поплавок), pad — поле розмиття в px арту.
      skin: {
        id: "float-v1",
        scene: {
          src: "assets/items/floats-scene/float-day.webp",
          waterline: 0.3,
          glow: { src: "assets/items/floats-scene/float-day-glow.webp", pad: 8 },
        },
      },
      rarityProfile: {
        mode: "authored",
        tier: 4,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "float.night" },
      requiresTag: "float",
      displayStats: {
        variant: {
          key: "variant",
          label: "Тип",
          map: { day: "Денний", night: "Нічний" },
        },
        windCompensation: "Компенсація:",
        mount: {
          label: "Кріплення",
          map: { fixed: "Глухий", sliding: "Ковзний" },
        },
        ballastWeight: {
          label: "Огрузка",
          map: { light: "Легка", medium: "Середня", heavy: "Важка" },
        },
        width: "Ширина: мм",
        length: "Довжина: см",
      },

      gameplayStats: {
        // fixed: the selected depth hangs below the float and shortens the cast by that much line.
        mount: "fixed",
        width: 3,
        length: 15,
        quality: 10.0,
        windCompensation: [0.1, 1.0],
        overDepthPenaltyMult: 0.5,
        sinkingDelayMs: 500,
        sinkingDurationMs: 4000,
        sinkingReferenceDepthMeters: 10.0,
        currentCompensation: [0.1, 1.0],
        ballastWeight: "light",
        // restDraft: share of the float under water at rest; heavier ballast sinks it deeper (spec 127).
        ballastProfiles: {
          light: { speedMult: 1.0, restDraft: 0 },
          medium: { speedMult: 1.5, restDraft: 0.15 },
          heavy: { speedMult: 2.0, restDraft: 0.3 },
        },
      },
    },
    float_sliding: {
      id: "float_sliding",
      name: "Ковзний поплавок",
      itemType: "float",
      variant: "day",
      icon: "🪶",
      // Поплавок на воді (spec 127): тіло з асету, верхня частка waterline (червона антена з чорним пояском) над
      // водою в спокої. glow — адитивне зелене світіння лише кінчика (нічний поплавок), pad — поле розмиття в px арту.
      skin: {
        id: "float-v1",
        scene: {
          src: "assets/items/floats-scene/float-day.webp",
          waterline: 0.3,
        },
      },
      rarityProfile: {
        mode: "authored",
        tier: 4,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "float.day" },
      requiresTag: "float",
      displayStats: {
        variant: {
          key: "variant",
          label: "Тип",
          map: { day: "Денний", night: "Нічний" },
        },
        mount: {
          label: "Кріплення",
          map: { fixed: "Глухий", sliding: "Ковзний" },
        },
        windCompensation: "Компенсація:",
        ballastWeight: {
          label: "Огрузка",
          map: { light: "Легка", medium: "Середня", heavy: "Важка" },
        },
        width: "Ширина: мм",
        length: "Довжина: см",
      },

      gameplayStats: {
        // sliding: the float slides down to the stopper after the cast, so the depth costs no cast distance.
        mount: "sliding",
        width: 3,
        length: 15,
        quality: 10.0,
        windCompensation: [0.1, 1.0],
        overDepthPenaltyMult: 0.5,
        sinkingDelayMs: 500,
        sinkingDurationMs: 4000,
        sinkingReferenceDepthMeters: 10.0,
        currentCompensation: [0.1, 1.0],
        ballastWeight: "light",
        // restDraft: share of the float under water at rest; heavier ballast sinks it deeper (spec 127).
        ballastProfiles: {
          light: { speedMult: 1.0, restDraft: 0 },
          medium: { speedMult: 1.5, restDraft: 0.15 },
          heavy: { speedMult: 2.0, restDraft: 0.3 },
        },
      },
    },
  },

  nets: {
    net_basic: {
      id: "net_basic",
      name: "Базова підсака",
      itemType: "net",
      icon: "🕸️",
      iconUrl: "assets/items/nets/net--1.webp",
      // Мініатюри показують верхні 40% малюнка по центру; прев'ю редактора — весь малюнок.
      skin: {
        id: "net-v1",
        thumbnail: {
          src: "assets/items/nets/net--1.webp",
          visibleHeight: 0.4,
          focusX: 0.5,
          anchor: "top",
        },
      },
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
      gameplayStats: {
        active: true,
        length: 3.0,
        maxWeight: 3.0,
        quality: 1.0,
        catchType: "all",
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
      itemType: "chum_mix",
      icon: "🍞",
      packSize: 15,
      rarityProfile: {
        mode: "authored",
        tier: 2,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "chum.carp" },
      requiresTag: "chum_mix",
      displayStats: {
        minBonusDurationHours: "Мін. тривалість: год",
        radius: "Радіус: px",
        maxBonus: "Макс. бонус:",
      },
      gameplayStats: {
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
        // Spec 152: each drop adds 1 unit of feed, eaten at eatenPerHour (game hours); above comfortLoad the bonus falls
        // linearly to overfedMultiplier at maxLoad (overfed fish bite worse).
        feed: { eatenPerHour: 0.25, comfortLoad: 1.5, maxLoad: 4, overfedMultiplier: 0.8 },
      },
    },
  },

  deliveryMethods: {
    boat_lvl3: {
      id: "boat_lvl3",
      name: "Кораблик (Рівень 3)",
      icon: "🚤",
      iconUrl: "assets/items/boats/boat-lvl--3_no-bait.webp",
      skin: {
        id: "boat-lvl--3",
        thumbnail: {
          src: "assets/items/boats/boat-lvl--3_no-bait.webp",
          visibleHeight: 1,
          focusX: 0.5,
          anchor: "center",
        },
        equipment: {
          noBait: "assets/items/boats/boat-lvl--3_no-bait.webp",
          bait: "assets/items/boats/boat-lvl--3_bait.webp",
        },
        animation: {
          skeleton: "assets/animations/boats/boat-lvl--3.json",
          atlas: "assets/animations/boats/boat-lvl--3.atlas",
          skin: "skin_boat-lvl--3",
        },
      },
      itemType: "boat",
      rarityProfile: {
        mode: "authored",
        tier: 5,
        maxTier: 5,
        isUnique: false,
      },
      progressionProfile: { groupId: "delivery.boat" },
      capabilities: ["chum_mix"],
      assemblyProfileId: "bait_boat",

      displayStats: {
        upgradeLevel: "Рівень покращення:",
        speedPxPerSec: {
          label: "Швидкість",
          byLevel: "statsByLevel",
          levelKey: "upgradeLevel",
          stat: "speedPxPerSec",
          suffix: "px/с",
        },
        hasSonar: {
          label: "Сонар",
          map: { true: "Встановлено", false: "Немає" },
        },
        sections: "Бункери:",
      },
      gameplayStats: {
        hasSonar: true,
        showSensors: false,
        manualControl: false,
        sections: 3,
        quality: 9,
        upgradeLevel: 3,
        // Spec 143: power from the battery in its slot. Moving: unitsPerSecond × the level's powerFactor; waiting at the
        // spot: idleShare of that. A 3600-unit battery = 5 / 7.5 / 10 min of motion at levels 1 / 2 / 3.
        batteryUse: { unitsPerSecond: 12, idleShare: 1 / 3 },
        statsByLevel: {
          1: { speedPxPerSec: 150, powerFactor: 1 },
          2: { speedPxPerSec: 200, powerFactor: 2 / 3 },
          3: { speedPxPerSec: 250, powerFactor: 0.5 },
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
        // Spec 151 D8: a drained, drifting boat this close to the player's shore (ground metres) is taken back.
        recovery: { mooringMeters: 1 },
        emoji: "🚤",
      },
    },
  },

  // Spec 143: batteries power devices (the bait boat, the radio) from their battery slot.
  batteries: {
    battery_basic: {
      id: "battery_basic",
      name: "Батарейка Volt-1",
      itemType: "battery",
      iconUrl: "assets/items/batteries/battery-volt--1.webp",
      rarityProfile: { mode: "authored", tier: 1, maxTier: 5, isUnique: false },
      progressionProfile: { groupId: "power.battery" },
      displayStats: {
        capacityUnits: "Ємність:",
      },
      gameplayStats: {
        capacityUnits: 3600,
      },
    },

    battery_volt_2: {
      id: "battery_volt_2",
      name: "Батарейка Volt-2",
      itemType: "battery",
      iconUrl: "assets/items/batteries/battery-volt--2.webp",
      rarityProfile: { mode: "authored", tier: 2, maxTier: 5, isUnique: false },
      progressionProfile: { groupId: "power.battery" },
      displayStats: {
        capacityUnits: "Ємність:",
      },
      gameplayStats: {
        capacityUnits: 7200,
      },
    },

    battery_volt_3: {
      id: "battery_volt_3",
      name: "Батарейка Volt-3",
      itemType: "battery",
      iconUrl: "assets/items/batteries/battery-volt--3.webp",
      rarityProfile: { mode: "authored", tier: 3, maxTier: 5, isUnique: false },
      progressionProfile: { groupId: "power.battery" },
      displayStats: {
        capacityUnits: "Ємність:",
      },
      gameplayStats: {
        capacityUnits: 10800,
      },
    },

    battery_volt_4: {
      id: "battery_volt_4",
      name: "Батарейка Volt-4",
      itemType: "battery",
      iconUrl: "assets/items/batteries/battery-volt--4.webp",
      rarityProfile: { mode: "authored", tier: 4, maxTier: 5, isUnique: false },
      progressionProfile: { groupId: "power.battery" },
      displayStats: {
        capacityUnits: "Ємність:",
      },
      gameplayStats: {
        capacityUnits: 24000,
      },
    },
  },

  // Spec 142: devices worn in the auxiliary equipment.
  devices: {
    radio_receiver_basic: {
      id: "radio_receiver_basic",
      name: "Польовий радіоприймач",
      itemType: "radio",
      iconUrl: "assets/items/radio/radio-receiver.webp",
      rarityProfile: { mode: "authored", tier: 2, maxTier: 5, isUnique: false },
      progressionProfile: { groupId: "device.radio" },
      assemblyProfileId: "radio_receiver",
      displayStats: {},
      gameplayStats: {
        // Spec 143 D-P5: 1 unit/s, so the 3600-unit ordinary battery plays for 1 hour.
        batteryUse: { unitsPerSecond: 1 },
      },
    },
  },

  misc: {
    backpack_basic: {
      id: "backpack_basic",
      name: "Похідний рюкзак",
      itemType: "backpack",
      iconUrl: "assets/items/briefcases/briefcase--1--close.webp",
      rarityProfile: { mode: "authored", tier: 1, maxTier: 5, isUnique: false },
      progressionProfile: { groupId: "storage.backpack" },
      displayStats: {},
      gameplayStats: {},
    },
    sys_build_box: {
      id: "sys_build_box",
      name: "Ящик збірки",
      itemType: "build_box",
      icon: "🧰",
      rarityProfile: null,
      progressionProfile: null,
      displayStats: {},
      gameplayStats: {},
    },
  },

  builds: {},
};
