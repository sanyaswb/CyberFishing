const SLOT_CONFIG = {
  rod: {
    type: "single",
    dependencies: ["reel", "float", "sinker", "hooks", "feederChum", "baits"],
    acceptTypes: ["spinning", "float", "feeder", "pole"],
  },
  reel: {
    type: "single",
    dependencies: [],
    acceptTypes: ["spinning_reel"],
  },
  float: {
    type: "single",
    dependencies: [],
    acceptTypes: ["float_tackle", "day", "night"],
  },
  sinker: {
    type: "single",
    dependencies: [],
    acceptTypes: ["sinker", "feeder_rig"],
  },
  hooks: {
    type: "array",
    dependencies: ["baits"],
    acceptTypes: ["hook"],
  },
  feederChum: {
    type: "single",
    dependencies: [],
    acceptTypes: ["chum_mix"],
  },
  net: {
    type: "single",
    dependencies: [],
    acceptTypes: ["net"],
  },
  delivery: {
    type: "single",
    dependencies: ["deliveryChums"], // Змінено на множину
    acceptTypes: ["boat", "chum_delivery"],
  },
  deliveryChums: {
    // Змінено на масив
    type: "array",
    dependencies: [],
    acceptTypes: ["chum_mix"],
  },
  baits: {
    type: "array",
    dependencies: [],
    acceptTypes: ["bait", "lure", "spinner", "wobbler", "jig"],
  },
};

const UI_LAYOUT_CONFIG = [
  {
    groupName: "Основне",
    slots: [{ id: "rod", label: "Вудилище" }],
  },
  {
    groupName: "Оснащення",
    slots: [
      { id: "reel", label: "Котушка" },
      { id: "float", label: "Поплавок" },
      { id: "sinker", label: "Оснастка" },
      { id: "hooks", label: "Гачок", dynamicCount: true },
      { id: "baits", label: "Наживка", dynamicCount: true },
      { id: "feederChum", label: "Прикормка" },
    ],
  },
  {
    groupName: "Додатково",
    slots: [
      { id: "net", label: "Підсака" },
      { id: "delivery", label: "Доставка" },
      { id: "deliveryChum", label: "Вантаж" },
    ],
  },
];

const INVENTORY_CATEGORIES = [
  { id: "all", label: "🗃️ Усе", acceptTypes: "ALL" },
  { id: "builds", label: "📦 Збірки", acceptTypes: ["build_box"] },
  {
    id: "rods",
    label: "🎣 Вудилища",
    acceptTypes: ["spinning", "feeder", "float", "pole"],
  },
  { id: "reels", label: "⚙️ Котушки", acceptTypes: ["spinning_reel"] },
  {
    id: "tackle",
    label: "🪢 Оснастка",
    acceptTypes: [
      "float_tackle",
      "day",
      "night",
      "sinker",
      "feeder_rig",
      "hook",
      "lure",
      "spinner",
      "wobbler",
      "jig",
    ],
  },
  { id: "baits", label: "🪱 Наживки", acceptTypes: ["bait"] },
  { id: "chum", label: "🍞 Прикормки", acceptTypes: ["chum_mix"] },
  { id: "boats", label: "🚤 Кораблики", acceptTypes: ["boat"] },
  { id: "nets", label: "🕸️ Підсаки", acceptTypes: ["net"] },
];

const SUBFILTER_MAPPING = {
  spinning: "Спінінги",
  feeder: "Фідери",
  float: "Поплавкові вудки",
  pole: "Махові",
  spinning_reel: "Котушки",
  float_tackle: "Поплавки",
  day: "Поплавки",
  night: "Поплавки",
  hook: "Гачки",
  sinker: "Грузила",
  feeder_rig: "Фідерні снасті",
  lure: "Спінінгові приманки",
  spinner: "Спінінгові приманки",
  wobbler: "Спінінгові приманки",
  jig: "Спінінгові приманки",
  bait: "Наживки",
  chum_mix: "Прикормки",
  boat: "Кораблики",
  net: "Підсаки",
};

const ITEM_DB = {
  rods: {
    // 1. СПІНІНГ (для блишень, воблерів, джигу)
    rod_test_spin: {
      id: "rod_test_spin",
      name: "Тестовий Спінінг",
      type: "spinning", // Для UI фільтрів
      icon: "🎣",
      displayStats: {
        Рівень: 4,
        Потужність: 1.5,
        Дальність: "600м",
        Тип: "Спінінг",
      },
      engineStats: {
        type: "spinning", // КРИТИЧНО ДЛЯ ФІЗИКИ
        level: 4,
        basePower: 1.5,
        compensation: 0.6,
        maxDistance: 600,
        accuracy: 70,
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
        Рівень: 4,
        Потужність: 1.5,
        Дальність: "600м",
        Тип: "Фідер",
      },
      engineStats: {
        type: "feeder", // КРИТИЧНО ДЛЯ ФІЗИКИ
        level: 4,
        basePower: 1.5,
        compensation: 0.4,
        maxDistance: 600,
        accuracy: 85,
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
        Рівень: 1,
        Потужність: 1.0,
        Дальність: "450м",
        Тип: "Поплавкова",
      },
      engineStats: {
        type: "float",
        level: 1,
        basePower: 1.0,
        compensation: 0.2,
        maxDistance: 450,
        accuracy: 60,
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
      displayStats: { level: 4, power: 1.0, holdCharges: 3 },
      engineStats: {
        basePower: 1.0,
        pumpLevel: 5,
        pumpPowerPerLevel: 10,
        requiresTag: "reel",
        hold: {
          activeLevel: 3,
          swipeThresholdPx: 100,
          manualCooldownMs: 500,
          levels: {
            1: {
              charges: 1,
              restoreTimeMs: 5000,
              holdPower: 1,
              tensionMultiplier: 1.0,
            },
            2: {
              charges: 2,
              restoreTimeMs: 4000,
              holdPower: 2,
              tensionMultiplier: 1.0,
            },
            3: {
              charges: 3,
              restoreTimeMs: 3000,
              holdPower: 3,
              tensionMultiplier: 1.0,
            },
          },
        },
      },
    },
  },

  hooks: {
    hook_basic: {
      id: "hook_basic",
      name: "Базовий гачок",
      type: "hook",
      icon: "🪝",
      displayStats: { level: 5, weight: "4g" },
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
      displayStats: { Гачки: 2, Прикормка: "Є" },
      engineStats: {
        requiresTag: "feeder_rig",
        capabilities: ["hook", "bait", "chum_mix"],
        hooksCount: 2,
        hasChumSlot: true,
      },
    },

    oil_worm: {
      id: "oil_worm",
      name: "Масляний черв'як",
      type: "bait",
      icon: "🪱",
      displayStats: { type: "Наживка" },
      engineStats: { type: "bait", requiresTag: "bait" },
    },

    bread: {
      id: "bread",
      name: "Хліб",
      type: "bait",
      icon: "🍞",
      displayStats: { type: "Наживка" },
      engineStats: { type: "bait", requiresTag: "bait" },
    },

    test_spinner: {
      id: "test_spinner",
      name: "Блешня (Тест)",
      type: "lure",
      icon: "🥄",
      displayStats: { sinkSpeed: 1.5 },
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
        Тип: "воблер",
        Якість: 8,
        Глибина: "2.0 - 4.5м",
        Режим: "Suspend",
        Компенсація: "0.1, 1.0",
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
        Тип: "воблер",
        Якість: 8,
        Глибина: "1.0 - 3.5м",
        Режим: "Sinking",
        Компенсація: "0.1, 1.0",
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
      displayStats: { sinkSpeed: 3.0 },
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
        Рівень: 1,
        Тип: "Денний",
        Якість: 10,
        Компенсація: "0.1, 1.0",
        Ширина: "3мм",
        Довжина: "15см",
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
      displayStats: { weight: "Light", maxDepth: "10.0м" },
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
      displayStats: { maxWeight: "3.0кг" },
      engineStats: {
        active: true,
        length: 15.0,
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
      displayStats: { duration: "24h" },
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

      displayStats: { Швидкість: "Висока", Сонар: "Встановлено", Бункери: 3 },
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

const CONFIG = {
  canvas: {
    id: "gameCanvas",
    backgroundColor: "#0f171e",
  },

  input: {
    pointerThreshold: 10,
    dragRadius: 200,
    swipeResistanceY: 200,
    longPressMs: 950,

    // Можна використовувати e.code (KeyW, Space, ShiftLeft) або e.key (Shift)
    keys: {
      pull: ["Space"], // Кнопка тяги (Пробіл)
      hold: ["ShiftLeft", "ShiftRight", "Shift", "KeyW", "ArrowUp"], // Кнопка утримання / блокування
      pump: ["KeyS", "ArrowDown"], // Кнопка підтяжки (можеш додати сюди W, або залишити тільки S)
      left: ["KeyA", "ArrowLeft"], // Відведення вудки вліво
      right: ["KeyD", "ArrowRight"], // Відведення вудки вправо
    },
  },

  casting: {
    enabled: true,
    powerSwipePx: 200,
    edgeScrollCenterRatio: 0.7,
    edgeScrollMaxPxPerSecond: 900,
    edgeScrollEasePower: 1.6,
    travelDelayMinMs: 180,
    travelDelayMaxMs: 950,
    accuracyAttempts: 12,
    rodAccuracyFallbackPx: 80,
    handChumAccuracyPx: 110,

    aimLine: {
      color: "rgba(0, 220, 255, 0.85)",
      chumColor: "rgba(255, 180, 0, 0.9)",
      width: 2,
      dash: [12, 10],
      dashSpeedPxPerSecond: 42,
      glowBlur: 8,
    },

    powerBar: {
      width: 300,
      height: 12,
      y: 18,
      borderPadding: 2,
      borderWidth: 1,
      backgroundColor: "#1a2b3c",
      borderColor: "#4a5b6c",
      labelFont: "bold 11px monospace",
      labelColor: "#8a9bac",
      labelOffsetX: 56,
      labelOffsetY: 12,
      glowIntensity: 0.45,
    },
  },

  debug: {
    godMode: {
      enabled: true, // Гoловний рубильник (якщо false, інші ігноруються)
      infiniteResources: true, // 1. Нескінченна наживка/снасті
      noEquipmentLoss: true,
      noHookEscape: true, // 2. Риба ніколи не зривається з гачка
      noLineBreak: true, // 3. Ліска не рветься при 100% натягу
      noRodBreak: true, // 4. Вудка ніколи не ламається
      infiniteCasting: true,
    },

    overlay: true,
    initialTime: 17.5, // Початковий час. 17.5 = 17:30. Якщо поставити null, гра візьме реальний час.
    timeScale: 240, // Швидкість часу. 1 = реальний час. 60 = 1 ігрова година минає за 1 реальну хвилину.

    fixedCatch: {
      enabled: false,
      fishId: "crucian_stalker", // Можна вписати 'perch_radioactive'
      level: 6,
      weight: 2.678,
      resistance: 2.5,
    },
  },

  locations: {
    debugVisuals: true, // Головний вимикач (якщо false - взагалі нічого не малюється)
    debugZones: true, // Показувати кольорові квадрати (зелені, червоні)
    debugGrid: true, // Показувати лінії сітки
    debugDepthText: false, // Показувати цифри глибини
    enableCastable: true, // Зони, де можна закидати вудку
    enableCollisions: true, // Колізії з землею (червоні зони) - забороняють закидати.
    enableSnags: true, // Динамічні зони (наприклад, косяк риби)
    enableDynamicZones: false, // Вимикає всі динамічні зони (косяки риби, рухомі перешкоди тощо)
    showChumZones: true,
    showCatchZone: true, // Відображення синьої зони
    showNetZone: true, // Відображення зеленої зони
    showAimingZone: true, // Відображення зони закидання

    debugOpacity: 1.0,
    baseResolution: { width: 2560, height: 1440 },
    designCellSize: 40,
    cellSize: 40,
    catchLineOffsetPx: 5,
    lockZoneXToScreen: true,
    cameraFocusY: 0.7, // Позиція камери для поплавка на екрані (0.5 = центр, 0.7 = нижня третина)

    map: {
      test: {
        id: "test",
        name: "Test Waters",
        bgUrls: {
          day: "assets/locations/test/bg_test--day.webp",
          evening: "assets/locations/test/bg_test--evening.webp",
          night: "assets/locations/test/bg_test--night.webp",
        },
        depthUrl: "assets/locations/test/test-depth.webp",
        // x: 'left', 'center', 'right'
        // y: 'top', 'center', 'bottom', 'safeZone'
        initialAlignment: { x: "center", y: "center" },
        safeZone: { top: 0, bottom: 1440 },
        depthBounds: { min: 0.1, max: 15.0 },

        // НОВА МАТЕМАТИЧНА ПЕРСПЕКТИВА (в градусах)
        perspective: {
          angleTop: 0, // Кут погляду на найдальшу точку води (близько до горизонту)
          angleBottom: 30, // Кут погляду під ноги (на найближчу лінію води)
        },

        chumCastDistance: 300,

        weather: {
          updateIntervalMs: 10000,
          chances: {
            rain: 0.1,
            fog: 0.0,
          },
        },

        environment: {
          current: {
            speedPxPerSec: 5, // Сила течії
            direction: { x: 1, y: 0.1 }, // Вектор (зносить вправо і трохи вниз)
          },
          wind: {
            // Вітер впливає на поплавок і легкі снасті
            changesPerDay: [4, 12],
            breezeAngleRange: [10, 15],
            gustAngleRange: [15, 40],
            gustFluctuationMs: [200, 500],
            gustChancePerSec: 0.4,
            gustDurationMs: [1000, 2500],
            rainMultiplier: [1.5, 2.5],
          },
        },

        zones: {
          castable: [{ x: 0, y: 13, w: 64, h: 17 }],
          collisions: [{ x: 12, y: 22, w: 3, h: 2 }],
          snags: [{ x: 50, y: 13, w: 14, h: 8 }],
          dynamic: [
            {
              id: "fish_school_1",
              type: "buff",
              multiplier: 1.5,
              x: 22,
              y: 15,
              w: 1,
              h: 1,
              moving: true,
              speedX: 1.2,
              speedY: 0.8,
              bounds: [{ x: 0, y: 13, w: 64, h: 17 }],
            },
          ],
        },
      },
    },
  },

  spawns: {
    tickRateMs: 1000,
    antiSpam: {
      baseCooldownMs: 1500,
      penaltyStepMs: 1000,
      resetTimeMs: 8000,
    },
    timePhases: {
      morning: { startHour: 4, endHour: 10 },
      day: { startHour: 10, endHour: 18 },
      evening: { startHour: 18, endHour: 23 },
      night: { startHour: 23, endHour: 4 },
    },
    fishes: [
      {
        id: "crucian_stalker",
        name: "Карась-сталкер",
        baseChance: 0.02,
        maxHookSize: 6,
        trophyWeightKg: 1.0,
        visual: {
          imagePattern:
            "assets/fish/crucian_stalker/crucian_stalker--{level}.webp",
          uniqueLevel: 6,
        },

        weatherMultipliers: {
          rain: 1.5,
          fog: 1.2,
        },

        depthConfig: {
          minDepth: 0.5,
          maxDepth: 11.0,
          minWeightAtMinDepth: 0.5,
          maxWeightAtMinDepth: 0.8,
          minWeightAtMaxDepth: 0.751,
          maxWeightAtMaxDepth: 5.0,
          chanceMultAtMaxDepth: 0.2,
        },

        weightConfig: {
          rarityCurve: 3.5,
          maxLevel: 6,
          baseResistance: 0.8,
          maxResistance: 2.5,
          levelWeightRanges: [
            { level: 1, min: 0.05, max: 0.25 },
            { level: 2, min: 0.251, max: 0.75 },
            { level: 3, min: 0.751, max: 1.5 },
            { level: 4, min: 1.501, max: 2.5 },
            { level: 5, min: 2.501, max: 3.5 },
            { level: 6, min: 3.501, max: 5.0 },
          ],
        },

        baitMultipliers: {
          oil_worm: 2.0,
          bread: 1.0,
        },

        timeMultipliers: { morning: 1.0, day: 1.0, evening: 1.1, night: 0.5 },
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
          agility: 1.0,
          edgePowerMultiplier: 1.0,
          bounceCooldownMs: 2000,
          dirChangeMinMs: 500,
          dirChangeMaxMs: 1500,
          lastDashTrigger: {
            targetState: "lastDash",
            isLocked: false,
            chance: 0.5,
            checkIntervalMs: 1000,
          },

          behaviors: {
            idle: {
              pull: 0.5,
              move: 0.5,
              minTime: 500,
              maxTime: 3000,
              weight: 10,
            },
            rest: {
              pull: 0.2,
              move: 0.1,
              minTime: 500,
              maxTime: 2500,
              weight: 20,
            },
            swim: {
              pull: 1.0,
              move: 1.0,
              minTime: 2000,
              maxTime: 4000,
              weight: 40,
            },
            dash: {
              pull: 1.5,
              move: 1.5,
              minTime: 1000,
              maxTime: 2200,
              weight: 30,
            },
            lastDash: {
              pull: 1.5,
              move: 2.5,
              minTime: 1000,
              maxTime: 3000,
              weight: 0,
              dirChangeMinMs: 500,
              dirChangeMaxMs: 1000,
              agility: 1.5,
              edgePowerMultiplier: 1.2,
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

          // --- Клювання на Спінінгові приманки (Воблер, Блешня, Джиг) ---
          // active: {
          //   chanceGuaranteed: 0.6,
          //   chanceNormal: 0.4,
          //   maxSequences: [1, 2],
          //   sequenceIntervalMs: [200, 400],
          //   intervalMs: [200, 400],
          //   animDurationMs: [100, 200],
          //   movementChance: 1.0,
          //   movementDurationMs: [100, 250],
          //   movementSpeedPx: [40, 80],
          //   guaranteedIters: [1, 1],
          //   normalIters: [1, 2],
          //   animations: {
          //     slide: {}, // Тільки різкі ривки
          //   },
          //   guaranteedModifiers: {
          //     movementSpeedMult: [1.5, 2.5],
          //     movementDurationMult: [1.0, 1.5],
          //   },
          // },
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
          baseResistance: 0.8,
          maxResistance: 1.5,
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
          agility: 1.3,
          edgePowerMultiplier: 1.0,
          bounceCooldownMs: 2000,
          dirChangeMinMs: 500,
          dirChangeMaxMs: 1500,
          lastDashTrigger: {
            targetState: "lastDash",
            isLocked: false,
            chance: 0.5,
            checkIntervalMs: 1000,
          },
          behaviors: {
            idle: {
              pull: 0.8,
              move: 0.8,
              minTime: 500,
              maxTime: 2000,
              weight: 10,
            },
            rest: {
              pull: 0.5,
              move: 0.5,
              minTime: 500,
              maxTime: 2500,
              weight: 5,
            },
            swim: {
              pull: 1.0,
              move: 1.5,
              minTime: 2000,
              maxTime: 4000,
              weight: 55,
            },
            dash: {
              pull: 2.0,
              move: 2.2,
              minTime: 500,
              maxTime: 1200,
              weight: 30,
            },
            lastDash: {
              pull: 1.5,
              move: 2.5,
              minTime: 500,
              maxTime: 1500,
              weight: 0,
              dirChangeMinMs: 500,
              dirChangeMaxMs: 1000,
              agility: 1.5,
              edgePowerMultiplier: 1.2,
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
    ],
  },

  logs: {
    events: false,
    maxEntries: 50,
    endpoint: "http://localhost:3000/api/events", // ОСЬ ЦЕЙ РЯДОК З'ЄДНУЄ ГРУ З БЕКЕНДОМ
  },

  player: {
    equipment: {
      rodId: null,
      reelId: null,
      floatId: null,
      sinkerId: null,
      hooks: [],
      baits: [],
      netId: null,
      feederChumId: null,
      deliveryId: null,
      deliveryChums: [],
    },

    inventory: [
      { instanceId: "uuid-rod-spin", itemId: "rod_test_spin" },
      { instanceId: "uuid-rod-feeder", itemId: "rod_test_feeder" },
      { instanceId: "uuid-rod-float", itemId: "rod_test_float", quantity: 3 },
      { instanceId: "uuid-reel", itemId: "reel_test" },
      { instanceId: "uuid-float", itemId: "float_day" },
      { instanceId: "uuid-sinker", itemId: "sinker_light", quantity: 2 },
      { instanceId: "uuid-spring", itemId: "feeder_spring_basic" },
      { instanceId: "uuid-hook", itemId: "hook_basic", quantity: 2 },
      { instanceId: "uuid-worm", itemId: "oil_worm", quantity: 50 },
      { instanceId: "uuid-bread", itemId: "bread", quantity: 20 },
      { instanceId: "uuid-spinner", itemId: "test_spinner" },
      { instanceId: "uuid-wob-susp", itemId: "test_wobbler_suspend" },
      { instanceId: "uuid-wob-sink", itemId: "test_wobbler_sinking" },
      { instanceId: "uuid-jig", itemId: "test_jig" },
      { instanceId: "uuid-net", itemId: "net_basic" },
      { instanceId: "uuid-chum", itemId: "carp_mix_basic", quantity: 15 },
      { instanceId: "uuid-boat", itemId: "boat_lvl3" },
    ],
  },

  feederConfig: {
    volumeNormal: 0.1,
    volumeGuaranteed: 0.3,
    normalRings: [0.5, 0.5],
    guaranteedRings: [2, 3],
  },

  hookMechanics: {
    safeTensionThreshold: 50,
    safeTensionThresholdWeakFish: 90,
    baseEscapeChance: 0.01,
    chancePer10Tension: 0.01,
    fishDominanceMultiplier: 1.5,
    extremeDominanceBonus: 0.5,
    checkIntervalMs: 1000,
    slackLinePenaltyTimeMs: 10000,
    slackLineEscapeChance: 0.1,
  },

  stamina: {
    fish: {
      baseStaminaMultiplier: 50,
      flatBonus: 500,
    },
    mechanics: {
      // Phase 1: Stamina
      slackThreshold: 25,
      optimalMax: 50, // Player fatigue threshold (0 damage to stamina)
      baseDepletionRate: 45,
      baseRegenRate: 30,
      centerSweetSpot: 0.2,
      edgeRegenRate: 150,

      // Phase 2: Exhaustion (When stamina = 0)
      exhaustionOptimalMax: 85, // Expanded tension limit for second phase
      basePowerDropPerSec: 0.1, // How much fish base power drops per 1 sec of exhaustion (0.1 base = 0.001 final)
      minBasePowerRatio: 0.2, // Fish cannot lose more than 80% of initial strength

      regenMultiplierPhase1: 2.5, // Бонус швидкості відновлення, поки риба не виснажена повністю
      punishmentCap: 0.8, // До якого відсотка (80%) відновлюється Фаза 2, якщо Фаза 1 досягла 100%

      debuffs: {
        swimPullMult: 0.75, // Зменшує тягу на 25%
        dashMaxTimeMult: 0.75, // Скорочує тривалість ривка на 25%
        idleMaxTimeMult: 1.5, // Збільшує час перепочинку на 50%
        dashPullMult: 0.75, // Зменшує силу ривка на 25%
        restWeightAdd: 25, // Збільшує шанс стану rest
        restMaxTimeMult: 1.5, // Збільшує час відпочинку на 50%
      },

      masteryTimeRatio: 0.5, // Час утримання: 50% (0.5) від часу, який був потрібен на повне виснаження
      masteryPowerMultiplier: 0.2, // До якого відсотка ПЛАВНО впаде сила (0.2 = залишиться 80%)
    },
  },

  physics: {
    fishForceMultiplier: 0.01,
    playerForceMultiplier: 0.017,
    playerSteeringMultiplier: 1.5, // Mechanical advantage of rod for X-axis steering
    edgePullPenalty: 0.5, // 0.5 означає, що на краю екрана гравець втратить 50% сили
    distanceXMultiplier: [0.3, 1.0],

    defaultDepthNoSinker: 0.1,
    guaranteedBiteCooldownMs: [2000, 15000],

    lureRetrieveMultiplier: 50,
    passiveRetrievePower: 1.0,
    passiveRetrieveMultiplier: 35,
    passiveRetrieveWaterFriction: 0.35,
    passiveRetrieveDepthRiseSpeed: 0.15,
    idleSpinningBiteChance: 0.005,
    floatMotion: {
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
    },

    // --- ДОДАНО: Шанси втрати наживки під час клювання ---
    baitLossChance: {
      normal: 0.0, // 1% для жовтої (негарантованої) ітерації
      guaranteed: 0.0, // 10% для червоної (гарантованої) ітерації
    },
  },

  tension: {
    powerRatioExponent: 2.0,
    sensitivityMultiplier: 1.5, // How much player input affects tension
    smoothApproach: 0.15,
    reelRecoveryMultiplier: 0.2,

    // Pulse effect
    pulseSpeedBaseMultiplier: 0.05,
    pulseSpeedMax: 10,
    pulseTensionDivisor: 10,
    pulseMagnitude: 0.5, // 0.5 + sin() * 0.5 = 0 to 1

    // Line breaking mechanic
    // breakThreshold: 100, // Tension % at which timer starts
    // breakTimeout: 1500, // Milliseconds in red zone before line breaks

    breakThreshold: 100,
    baseBreakTime: 1000,
    timePerEquipmentLevel: 100,

    // Bar Display
    barWidth: 300,
    barHeight: 20,
    barYOffset: 40, // From bottom
    barBorderWidth: 1,
    borderPadding: 2,
    backgroundColor: "#1a2b3c",
    borderColor: "#4a5b6c",
    glowIntensity: 0.6,

    // Label
    labelFont: "bold 12px monospace",
    labelColor: "#8a9bac",
    labelOffsetX: 60,
    labelOffsetY: 16,

    // Status Thresholds and Colors
    statuses: [
      { threshold: 0, label: "Idle", color: "#4a5b6c" },
      { threshold: 1, label: "LOW", color: "#00ccff" },
      { threshold: 30, label: "MEDIUM", color: "#ffff00" },
      { threshold: 60, label: "HIGH", color: "#ffaa00" },
      { threshold: 80, label: "CRITICAL", color: "#ff4444" },
    ],

    // Color Gradient (Low to High Tension)
    colorGradient: {
      // 0-33%: Blue to Yellow
      low: { start: [0, 0, 255], end: [255, 255, 0] },
      // 33-66%: Yellow to Orange
      mid: { start: [255, 255, 0], end: [255, 128, 0] },
      // 66-100%: Orange to Red
      high: { start: [255, 128, 0], end: [255, 0, 0] },
      breakpoints: { low: 33, mid: 66 },
    },
  },

  ui: {
    draggableButtons: true,
    dragHoldTimeMs: 1000,

    audio: {
      feederBite: "assets/audio/bell_ring.mp3",
    },

    rod: {
      x: "center",
      yOffset: 0,
    },

    indicators: {
      x: "center",
      y: 40,
      spacing: 40,
    },

    catchZone: {
      color: "rgba(0, 150, 255, 0.5)",
    },

    victory: {
      panelWidth: 540,
      panelMinHeight: 560,
      viewportMargin: 24,
      panelPadding: 24,
      panelRadius: 8,
      imageBoxSize: 260,
      imageBorderWidth: 3,
      statPillHeight: 42,
      buttonWidth: 150,
      buttonHeight: 42,
      buttonGap: 14,
      blurPx: 3,
      uniqueGlowPulseMs: 1200,
      levelColors: {
        1: [145, 150, 160],
        2: [0, 210, 120],
        3: [0, 160, 255],
        4: [170, 100, 255],
        preUnique: [255, 70, 70],
        unique: [255, 205, 55],
      },
    },

    line: {
      visible: true,
      color: "rgba(255, 255, 255, 0.3)",
      width: 1,
      straightenTension: 1, // Відсоток натягу (0-100), при якому ліска стає ідеально рівною
      sagOffset: 60, // Наскільки сильно провисає ліска у пікселях
      shrinkPercent: 70, // На скільки відсотків зменшити довжину лінії
      shrinkEasePower: 4, // Чим вище, тим крутіше крива зменшення довжини (1 = лінійно, >1 = більш різко ближче до 100% натягу)
      sinkDropPx: 110, // На скільки пікселів опускається ліска при повному зануренні поплавця (для візуального ефекту)
      snapDurationMs: 300,
      snapDepthMaxMultiplier: 2.0,
      distanceDelayMinMs: 1500,
      distanceDelayMaxMs: 5000,
      passivePullBiteChanceMultiplier: 0.005,
      pullExtendSpeed: 12,
      pullReleaseSpeed: 4,
      pullStraightenSpeed: 14,
      pullSlackSpeed: 5,
    },
  },

  colors: {
    background: "#0f171e",
    bodyBackground: "#1a1a1a",
  },

  wind: {
    active: true,
    speedPxPerSec: 15,
    direction: { x: 1, y: 0.2 },
  },
};
