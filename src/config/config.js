const SLOT_CONFIG = {
  rod: {
    type: "single",
    dependencies: [
      "reel",
      "line",
      "float",
      "sinker",
      "hooks",
      "feederChum",
      "baits",
    ],
    acceptTypes: ["spinning", "float", "feeder", "pole"],
  },
  reel: {
    type: "single",
    dependencies: ["line"],
    acceptTypes: ["spinning_reel"],
  },
  line: {
    type: "single",
    dependencies: [],
    acceptTypes: ["fishing_line"],
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
      { id: "line", label: "Ліска" },
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
      { id: "deliveryChums", label: "Вантаж" },
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
  { id: "lines", label: "🧵 Ліски", acceptTypes: ["fishing_line"] },
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
  fishing_line: "Ліски",
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

const CONFIG = {
  canvas: {
    id: "gameCanvas",
    backgroundColor: "#0f171e",
  },

  input: {
    pointerThreshold: 10,
    dragRadius: 200,
    swipeResistanceY: 200,
    dragControlActivationPx: 30,
    pullHoldMinMs: 120,
    longPressMs: 950,

    // Можна використовувати e.code (KeyW, Space, ShiftLeft) або e.key (Shift)
    keys: {
      // PULL / ВИВАЖУВАННЯ. Space має бути тільки тягою.
      // Якщо Space одночасно є retrieve, компʼютерне керування конфліктує.
      pull: ["Space"],

      // RECOVER / ПІДМОТКА СЛАБИНИ.
      // У fight-фізиці recover автоматично спрацьовує, коли гравець відпускає pull.
      // Shift залишено як ручний recover без конфлікту з пробілом.
      retrieve: ["ShiftLeft", "ShiftRight"],

      dragIncrease: ["KeyW", "ArrowUp"],
      dragDecrease: ["KeyS", "ArrowDown"],
      left: ["KeyA", "ArrowLeft"], // Відведення вудки вліво
      right: ["KeyD", "ArrowRight"], // Відведення вудки вправо

      // Стара hold/pump механіка вимкнена.
      hold: [],
      pump: [],
    },
  },

  casting: {
    enabled: true,
    powerSwipePx: 90,
    powerDeadzoneRatio: 0.25,
    inventoryPreviewPowerCoefficient: 0.5,
    powerAnchorReturnPxPerSecond: 1200,
    keyboardInitialPower: 0,
    keyboardPowerChangePerSecond: 0.75,
    keyboardAimSpeedPxPerSecond: 420,
    cancelPowerThreshold: 0,
    edgeScrollCenterRatio: 0.3,
    edgeScrollMaxPxPerSecond: 900,
    edgeScrollEasePower: 1.6,
    travelDelayMinMs: 180,
    travelDelayMaxMs: 950,
    accuracyAttempts: 12,
    accuracyDistancePercent: 0.6,
    handChumAccuracyDistancePercent: 0.6,
    accuracyDistanceMultiplier: 2.5,
    handChumAccuracyDistanceMultiplier: 2.5,
    rodAccuracyFallbackPx: 80,
    handChumAccuracyPx: 110,

    aimLine: {
      color: "rgba(0, 220, 255, 0.85)",
      chumColor: "rgba(255, 180, 0, 0.9)",
      fullDistance: true,
      width: 2,
      dash: [12, 10],
      dashSpeedPxPerSecond: 42,
      glowBlur: 8,
    },

    powerBar: {
      width: 300,
      height: 12,
      y: 42,
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
    consoleModules: {
      biteTicks: true,
      location: false,
      forces: false,
      deviations: false,
      tension: false,
      rodStroke: false,
      stamina: false,
      exhaustion: false,
      catchTime: false,
      prediction: false,
      net: false,
      map: false,
    },

    casting: {
      showChumDistanceLine: true,
      showAccuracyArea: true,
      accuracyAreaFill: "rgba(255, 255, 255, 0.08)",
      accuracyAreaStroke: "rgba(255, 255, 255, 0.55)",
    },

    godMode: {
      enabled: true, // Гoловний рубильник (якщо false, інші ігноруються)
      infiniteResources: true, // 1. Нескінченна наживка/снасті
      noEquipmentLoss: true,
      noHookEscape: true, // 2. Риба ніколи не зривається з гачка
      noLineBreak: true, // 3. Ліска не рветься при 100% натягу
      noRodBreak: true, // 4. Вудка ніколи не ламається
      infiniteCasting: true,

      // Bite debug controls. Працюють тільки коли enabled: true.
      // fixedBiteChancePercent обрізається до діапазону 0..100.
      fixedBiteChanceEnabled: true, // Якщо true, шанс клювання буде завжди fixedBiteChancePercent, ігноруючи інші механіки.
      fixedBiteChancePercent: 100,

      // "default" — брати biteMechanics риби;
      // "guaranteed" — тільки гарантовані;
      // "normal" — тільки не гарантовані.
      biteSequenceMode: "guaranteed",
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
    debugZones: false, // Показувати кольорові квадрати (зелені, червоні)
    debugGrid: false, // Показувати лінії сітки
    debugDepthText: false, // Показувати цифри глибини
    enableCastable: true, // Зони, де можна закидати вудку
    enableCollisions: true, // Колізії з землею (червоні зони) - забороняють закидати.
    enableSnags: true, // Динамічні зони (наприклад, косяк риби)
    enableDynamicZones: false, // Вимикає всі динамічні зони (косяки риби, рухомі перешкоди тощо)
    showChumZones: true,
    showCatchZone: false, // Відображення синьої зони
    showNetZone: true, // Відображення зеленої зони
    showAimingZone: true, // Відображення зони закидання

    debugOpacity: 1.0,
    baseResolution: { width: 2560, height: 1440 },
    designCellSize: 40,
    cellSize: 40,
    catchLineOffsetPx: 5,
    lockZoneXToScreen: true,
    cameraFocusY: 0.7, // Позиція камери для поплавка на екрані (0.5 = центр, 0.7 = нижня третина)

    map: typeof MAP_DB !== "undefined" ? MAP_DB : {},
  },

  wind: {
    active: true,
    speedPxPerSec: 15,
    direction: { x: 1, y: 0.2 },
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
    fishes: typeof FISH_DB !== "undefined" ? FISH_DB : [],
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
      lineId: null,
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
      { instanceId: "uuid-line", itemId: "line_test_13m" },
      { instanceId: "uuid-line-short", itemId: "line_test_4m" },
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
      baseStaminaMultiplier: 50,
      flatBonus: 500,

      baseDepletionRate: 45,
      baseRegenRate: 20,
      edgeRegenRate: 30,
      optimalMax: 100,
      exhaustionOptimalMax: 85,

      // НОВЕ:
      // Керує швидкістю падіння червоної шкали EXHAUSTION.
      // 0.5 = у 2 рази повільніше
      // 1.0 = стандартно
      // 2.0 = у 2 рази швидше
      exhaustionDepletionMultiplier: 0.5,

      // Керує тим, як швидко реально падає сила/опір риби в кг під час exhaustion.
      basePowerDropPerSec: 0.01,

      minBasePowerRatio: 0.2,
      masteryTimeRatio: 0.5,
      masteryPowerMultiplier: 0.2,
      regenMultiplierPhase1: 1.5,
      punishmentCap: 0.8,

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
    pixelsPerMeter: 50,
    fixedDtMs: 16.666,
    maxDtMs: 50,
    waterResistanceKgPerKgPerMps: 0.08,
    currentResistanceMultiplier: 1.0,
    forceKgToPxPerSec2: 200,
    rodAnglePenalty: {
      enabled: true,
      noPenaltyAngleDeg: 15,
      maxPenaltyAngleDeg: 75,
      maxPenaltyMultiplier: 0.65,
    },
    line: {
      defaultMaxLoadKg: 12,
      durabilityMaxLoadLossPerPercent: 0.001,
      rodLengthReserveMultiplier: 1.0,
      noReelExtraLengthMeters: 0,
      noReelRodLengthMultiplier: 2.0,
      fullExtensionTensionMultiplier: 1.0,
      slackTensionMultiplier: 0.0,
      constraintTolerancePx: 0.5,
    },
    drag: {
      minRatio: 0,
      maxRatio: 1,
      yEscapeSpeedAtFullDrag: 0.02,
      tensionGrowthPower: 1.6,
      autoRetrieveEnabled: true,

      // Коли фрикціон тримає силу риби, котушка не повинна автоматично здавати ліску.
      // 0 = без мікро-прослизання; 0.02 можна поставити, якщо хочеш легкий creep.
      creepReleaseRatio: 0,

      // Фрикціон тепер змінюється жестом так само, як сила закидання:
      // вертикальне протягування пальця/миші заповнює шкалу плавно, без кроків.
      pointerControlEnabled: true,
      powerSwipePx: 200,
      powerDeadzoneRatio: 0.25,
      powerAnchorReturnPxPerSecond: 1200,

      // Залишається для клавіш W/S або ArrowUp/ArrowDown.
      changeSpeedPerSec: 0.35,
    },
    rodStroke: {
      enabled: true,
      distanceMultiplierByRodLength: 1.0,
      strokeChargePerSecond: 0.65,
      minEffectivePullKg: 0.01,
      freezeWhenDragSlips: true,
      slackReducesNextPullDistance: true,
      minStrokeMeters: 0.001,
      finalLandingDistanceMeters: 0.5,
      minChargeSpeedMultiplier: 0.12,
      loadChargePower: 1.0,
    },
    reel: {
      autoRecoverSlack: true,
    },
    catchZone: {
      landingDistanceMeters: 1.0,
      rollIntervalMs: 1000,
      guaranteedWeightRatio: 0.2,
      maxLoadWeightRatio: 1.0,
      chanceAtGuaranteedRatio: 1.0,
      chanceAtMaxLoadRatio: 0.01,
      overweightChance: 0.0,
    },
    castingPower: {
      fallbackCoefficient: 0.5,
      minCoefficient: 0,
      maxCoefficient: 1,
      rodLengthCoefficientPerMeter: 0.1,
      reelBearingCoefficient: 0.1,
    },
    fightMotion: {
      velocityDampingPerSecond: 4.0,
    },
    directionForce: {
      sameDirectionMultiplier: 0.4,
      sideDirectionMultiplier: 1.0,
      oppositeDirectionMultiplier: 1.8,
    },
    fishForceMultiplier: 0.01,
    playerForceMultiplier: 0.017,
    playerSteeringMultiplier: 1.5, // Mechanical advantage of rod for X-axis steering
    edgePullPenalty: 0.5, // 0.5 означає, що на краю екрана гравець втратить 50% сили
    distanceXMultiplier: [0.3, 1.0],

    defaultDepthNoSinker: 0.1,
    guaranteedBiteCooldownMs: [0, 0], // Мінімальний час між клюваннями однієї риби. 0 = без кулдауну.

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
    kgSmoothPerSecond: 18,
    overloadGraceMs: 120,
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
      spacing: 56,
      conditionWidth: 220,
      conditionHeight: 10,
      conditionGap: 22,
      conditionLabelOffsetY: 9,
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
};
