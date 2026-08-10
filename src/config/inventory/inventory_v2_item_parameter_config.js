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

globalThis.INVENTORY_V2_ITEM_PARAMETER_CONFIG =
  INVENTORY_V2_ITEM_PARAMETER_CONFIG;
globalThis.INVENTORY_V2_ITEM_PARAMETER_ALIASES =
  INVENTORY_V2_ITEM_PARAMETER_ALIASES;
