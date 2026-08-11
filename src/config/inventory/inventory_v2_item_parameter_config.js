const INVENTORY_V2_ITEM_PARAMETER_CONFIG = Object.freeze({
  level: Object.freeze({
    label: "Рівень",
    description:
      "Рівень предмета. Більш високий рівень відкриває доступ до кращих характеристик.",
  }),
  rarity: Object.freeze({
    label: "Рідкість",
    description:
      "Рідкість предмета. Впливає на базові показники та кількість можливих покращень.",
  }),
  quality: Object.freeze({
    label: "Якість",
    description:
      "Якість предмета показує заповнення доступних секцій покращення.",
  }),
  power: Object.freeze({
    label: "Сила",
    description:
      "Поточна потужність або ефективність предмета відносно його максимального потенціалу.",
  }),
  condition: Object.freeze({
    label: "Стан",
    description:
      "Технічний стан предмета. Якщо стан падає до нуля, предмет може зламатися або втратити ефективність.",
  }),
  "resource:energy": Object.freeze({
    label: "Заряд",
    description: "Поточний запас енергії предмета.",
  }),
  "resource:capacity": Object.freeze({
    label: "Залишок",
    description: "Поточний залишок витратного ресурсу предмета.",
  }),
  "stat:bearingCount": Object.freeze({
    description:
      "Кількість підшипників. Забезпечують плавнішу роботу котушки та додають бонус до швидкості підмотки.",
  }),
  "stat:lineCapacityMeters": Object.freeze({
    description: "Максимальна довжина ліски, яку може вмістити котушка.",
  }),
  "stat:maxLoadKg": Object.freeze({
    description:
      "Максимальна вага, яку витримує снасть перед обривом або поломкою.",
  }),
  "stat:diameterMm": Object.freeze({
    description:
      "Діаметр ліски. Товща ліска міцніша, але може відлякувати обережну рибу.",
  }),
  "stat:lengthMeters": Object.freeze({
    description: "Фізична довжина вудилища. Впливає на дальність закидання.",
  }),
  "stat:weight": Object.freeze({
    description: "Маса предмета. Впливає на швидкість втоми рибака.",
  }),
  "stat:retrieveSpeedMetersPerSec": Object.freeze({
    description: "Швидкість, з якою котушка намотує ліску.",
  }),
  "stat:durability": Object.freeze({ aliasOf: "condition" }),
});

const INVENTORY_V2_ITEM_PARAMETER_ALIASES = Object.freeze({
  power: "power",
  "сила": "power",
  condition: "condition",
  "стан": "condition",
  level: "level",
  "рівень": "level",
  rarity: "rarity",
  "рідкість": "rarity",
  quality: "quality",
  "якість": "quality",
});

const INVENTORY_V2_BALANCE_TOOLTIP_CONFIG = Object.freeze({
  referenceCastDistanceMeters: 12,
  ignoredEnginePaths: Object.freeze([
    "assemblyProfileId",
    "capabilities",
    "emoji",
    "equipmentCapabilities",
    "requiresTag",
    "type",
  ]),
  stats: Object.freeze({
    level: Object.freeze({
      label: "Рівень",
      baseline: 1,
      precision: 0,
      direction: "higher_is_better",
    }),
    quality: Object.freeze({
      label: "Якість",
      baseline: 1,
      precision: 0,
      direction: "higher_is_better",
    }),
    basePower: Object.freeze({
      label: "Базова сила",
      direction: "higher_is_better",
    }),
    maxLoadKg: Object.freeze({
      label: "Макс. навантаження",
      unit: "кг",
      direction: "higher_is_better",
    }),
    lengthMeters: Object.freeze({
      label: "Довжина",
      unit: "м",
      direction: "higher_is_better",
    }),
    castPowerCoefficient: Object.freeze({
      label: "Сила закидання",
      baseline: 1,
      direction: "higher_is_better",
    }),
    accuracy: Object.freeze({
      label: "Точність",
      unit: "%",
      direction: "higher_is_better",
    }),
    compensation: Object.freeze({
      label: "Компенсація",
      direction: "higher_is_better",
    }),
    currentCompensation: Object.freeze({
      label: "Поточна компенсація",
      direction: "higher_is_better",
    }),
    holdTensionRatio: Object.freeze({
      label: "Передача натягу",
      direction: "higher_is_better",
    }),
    lineCapacityMeters: Object.freeze({
      label: "Ємність ліски",
      unit: "м",
      direction: "higher_is_better",
    }),
    bearingCount: Object.freeze({
      label: "Підшипники",
      baseline: 0,
      precision: 0,
      direction: "higher_is_better",
    }),
    retrieveSpeedMetersPerSec: Object.freeze({
      label: "Базова швидкість підмотки",
      unit: "м/с",
      direction: "higher_is_better",
    }),
    dragMinKg: Object.freeze({
      label: "Мін. фрикціон",
      unit: "кг",
      direction: "neutral",
    }),
    dragMaxKg: Object.freeze({
      label: "Макс. фрикціон",
      unit: "кг",
      direction: "higher_is_better",
    }),
    dragChangeSpeedPerSec: Object.freeze({
      label: "Швидкість зміни фрикціону",
      unit: "/с",
      direction: "higher_is_better",
    }),
    diameterMm: Object.freeze({
      label: "Діаметр",
      unit: "мм",
      direction: "neutral",
    }),
    weight: Object.freeze({
      label: "Вага",
      unit: "кг",
      direction: "lower_is_better",
    }),
    durability: Object.freeze({
      label: "Міцність",
      baseline: 100,
      unit: "%",
      direction: "higher_is_better",
    }),
    durabilityMaxLoadLossPerPercent: Object.freeze({
      label: "Втрата навантаження за 1% зносу",
      direction: "lower_is_better",
    }),
    rigPower: Object.freeze({
      label: "Сила оснастки",
      direction: "higher_is_better",
    }),
    attractionPower: Object.freeze({
      label: "Привабливість",
      direction: "higher_is_better",
    }),
    jigPower: Object.freeze({
      label: "Контроль джигу",
      direction: "higher_is_better",
    }),
    sensitivity: Object.freeze({
      label: "Чутливість",
      direction: "higher_is_better",
    }),
    maxWeight: Object.freeze({
      label: "Макс. вага",
      unit: "кг",
      direction: "higher_is_better",
    }),
    minBonus: Object.freeze({
      label: "Мін. бонус",
      direction: "higher_is_better",
    }),
    maxBonus: Object.freeze({
      label: "Макс. бонус",
      direction: "higher_is_better",
    }),
    maxDepth: Object.freeze({
      label: "Макс. глибина",
      unit: "м",
      direction: "higher_is_better",
    }),
    targetMinDepth: Object.freeze({
      label: "Мін. цільова глибина",
      unit: "м",
      direction: "neutral",
    }),
    targetMaxDepth: Object.freeze({
      label: "Макс. цільова глибина",
      unit: "м",
      direction: "neutral",
    }),
    sinkSpeed: Object.freeze({
      label: "Швидкість занурення",
      direction: "neutral",
    }),
    riseSpeed: Object.freeze({
      label: "Швидкість підйому",
      direction: "neutral",
    }),
    acceleration: Object.freeze({
      label: "Прискорення",
      direction: "higher_is_better",
    }),
    turnSpeedRad: Object.freeze({
      label: "Швидкість повороту",
      unit: "рад/с",
      direction: "higher_is_better",
    }),
    waterFriction: Object.freeze({
      label: "Опір води",
      direction: "neutral",
    }),
    brakeForce: Object.freeze({
      label: "Гальмівна сила",
      direction: "higher_is_better",
    }),
    radius: Object.freeze({ label: "Радіус", unit: "px" }),
    length: Object.freeze({ label: "Довжина", unit: "px" }),
    width: Object.freeze({ label: "Ширина", unit: "px" }),
    sections: Object.freeze({
      label: "Секції",
      precision: 0,
      direction: "higher_is_better",
    }),
    hooksCount: Object.freeze({
      label: "Кількість гачків",
      precision: 0,
      direction: "higher_is_better",
    }),
    hasReel: Object.freeze({ label: "Підтримка котушки" }),
    hasDrag: Object.freeze({ label: "Наявність фрикціону" }),
    hasChumSlot: Object.freeze({ label: "Комірка прикормки" }),
    hasSonar: Object.freeze({ label: "Сонар" }),
    showSensors: Object.freeze({ label: "Відображення сенсорів" }),
    manualControl: Object.freeze({ label: "Ручне керування" }),
    windCompensation: Object.freeze({ label: "Компенсація вітру" }),
    overDepthPenaltyMult: Object.freeze({
      label: "Штраф за перевищення глибини",
      direction: "lower_is_better",
    }),
    sinkingDelayMs: Object.freeze({
      label: "Затримка занурення",
      unit: "мс",
      direction: "lower_is_better",
    }),
    sinkingDurationMs: Object.freeze({
      label: "Тривалість занурення",
      unit: "мс",
      direction: "lower_is_better",
    }),
    sinkingReferenceDepthMeters: Object.freeze({
      label: "Еталонна глибина занурення",
      unit: "м",
    }),
    ballastWeight: Object.freeze({ label: "Баласт" }),
    speedMult: Object.freeze({ label: "Множник швидкості" }),
    heightScale: Object.freeze({ label: "Масштаб висоти" }),
    targetFishes: Object.freeze({ label: "Цільові види риб" }),
    minBonusDurationHours: Object.freeze({
      label: "Мін. тривалість бонусу",
      unit: "год",
      direction: "higher_is_better",
    }),
    rampUpTimeMs: Object.freeze({
      label: "Час наростання бонусу",
      unit: "мс",
      direction: "lower_is_better",
    }),
    peakDurationMs: Object.freeze({
      label: "Тривалість пікового бонусу",
      unit: "мс",
      direction: "higher_is_better",
    }),
    totalBonusTimeMs: Object.freeze({
      label: "Загальна тривалість бонусу",
      unit: "мс",
      direction: "higher_is_better",
    }),
    safeRecastWindowMs: Object.freeze({
      label: "Безпечне вікно перезакидання",
      unit: "мс",
      direction: "higher_is_better",
    }),
    speedPxPerSec: Object.freeze({
      label: "Швидкість",
      unit: "px/с",
      direction: "higher_is_better",
    }),
    maxEnergy: Object.freeze({
      label: "Макс. заряд",
      direction: "higher_is_better",
    }),
    energyDrainPerSec: Object.freeze({
      label: "Витрата заряду",
      unit: "/с",
      direction: "lower_is_better",
    }),
    reverseTimeSec: Object.freeze({
      label: "Час реверсу",
      unit: "с",
      direction: "lower_is_better",
    }),
    reverseThrustMult: Object.freeze({ label: "Тяга реверсу" }),
    maneuverTimeSec: Object.freeze({
      label: "Час маневру",
      unit: "с",
      direction: "lower_is_better",
    }),
    maneuverThrustMult: Object.freeze({ label: "Тяга маневру" }),
    maneuverSpeedMult: Object.freeze({ label: "Швидкість маневру" }),
    sensorRangeFactor: Object.freeze({
      label: "Радіус сенсорів",
      direction: "higher_is_better",
    }),
    avoidancePersistenceMs: Object.freeze({
      label: "Тривалість уникнення перешкод",
      unit: "мс",
    }),
    avoidanceThrustMultiplier: Object.freeze({
      label: "Тяга уникнення перешкод",
    }),
    slowRadius: Object.freeze({ label: "Радіус сповільнення", unit: "px" }),
    finishRadiusTarget: Object.freeze({
      label: "Радіус завершення доставки",
      unit: "px",
    }),
    finishRadiusReturning: Object.freeze({
      label: "Радіус завершення повернення",
      unit: "px",
    }),
  }),
});

globalThis.INVENTORY_V2_ITEM_PARAMETER_CONFIG =
  INVENTORY_V2_ITEM_PARAMETER_CONFIG;
globalThis.INVENTORY_V2_ITEM_PARAMETER_ALIASES =
  INVENTORY_V2_ITEM_PARAMETER_ALIASES;
globalThis.INVENTORY_V2_BALANCE_TOOLTIP_CONFIG =
  INVENTORY_V2_BALANCE_TOOLTIP_CONFIG;
