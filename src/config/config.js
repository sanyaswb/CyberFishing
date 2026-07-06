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
    dependencies: ["leader"],
    acceptTypes: ["fishing_line"],
  },
  leader: {
    type: "single",
    dependencies: ["hooks", "baits"],
    acceptTypes: ["leader_line"],
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
    dependencies: ["deliveryChums"],
    acceptTypes: ["boat", "chum_delivery"],
  },
  deliveryChums: {
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
      { id: "leader", label: "Поводок" },
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
  {
    id: "lines",
    label: "🧵 Ліски",
    acceptTypes: ["fishing_line", "leader_line"],
  },
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
  leader_line: "Поводки",
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

      dragIncrease: ["KeyS", "ArrowDown"],
      dragDecrease: ["KeyW", "ArrowUp"],
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

    // Canvas HUD bar styling lives in CONFIG.ui.hudStyles.bars.castPower.
  },

  debug: {
    overlay: true,
    overlayUpdateMs: 150,
    initialTime: null, // Початковий час. 17.5 = 17:30. Якщо поставити null, гра візьме реальний час.
    timeScale: 240, // Швидкість часу. 1 = реальний час. 60 = 1 ігрова година минає за 1 реальну хвилину.

    godMode: {
      enabled: true, // Гoловний рубильник (якщо false, інші ігноруються)
      infiniteResources: false, // 1. Нескінченна наживка/снасті
      noEquipmentLoss: true,
      noHookEscape: false, // 2. Риба ніколи не зривається з гачка
      noLineBreak: false, // 3. Ліска не рветься при 100% натягу
      noRodBreak: false, // 4. Вудка ніколи не ламається
      noFishStaminaLoss: false, // 5. Стаміна риби не витрачається і завжди тримається на 100%
      infiniteCasting: false,

      // Bite debug controls. Працюють тільки коли enabled: true.
      // fixedBiteChancePercent обрізається до діапазону 0..100.
      fixedBiteChanceEnabled: true, // Якщо true, шанс клювання буде завжди fixedBiteChancePercent, ігноруючи інші механіки.
      fixedBiteChancePercent: 100,

      // "default" — брати biteMechanics риби;
      // "guaranteed" — тільки гарантовані;
      // "normal" — тільки не гарантовані.
      biteSequenceMode: "guaranteed",
    },

    consoleModules: {
      biteTicks: false,
      location: false,
      forces: false,
      deviations: false,
      tension: false,
      rodStroke: false,
      reelHoldGate: false,
      stamina: false,
      exhaustion: false,
      catchTime: false,
      catchResolution: false,
      prediction: false,
      net: false,
      map: false,
    },

    memoryWatchdog: {
      enabled: false,
      intervalMs: 5000,
      maxSamples: 12,
      minTrendSamples: 6,
      thresholds: {
        heapGrowthBytes: 16777216,
        domNodeGrowth: 50,
        listenerGrowth: 10,
      },
    },

    casting: {
      showChumDistanceLine: true,
      showAccuracyArea: true,
      accuracyAreaFill: "rgba(255, 255, 255, 0.08)",
      accuracyAreaStroke: "rgba(255, 255, 255, 0.55)",
    },

    fixedCatch: {
      enabled: true,
      fishId: "crucian_stalker", // Можна вписати 'perch_radioactive'
      weight: 0.8,
    },
  },

  locations: {
    debugVisuals: true, // Головний вимикач (якщо false - взагалі нічого не малюється)
    debugZones: false, // Показувати кольорові квадрати (зелені, червоні)
    debugGrid: false, // Показувати лінії сітки
    debugDepthText: false, // Показувати цифри глибини
    enableCastable: true, // Зони, де можна закидати вудку
    enableCollisions: false, // Колізії з землею (червоні зони) - забороняють закидати.
    enableSnags: false, // Динамічні зони (наприклад, косяк риби)
    enableDynamicZones: false, // Вимикає всі динамічні зони (косяки риби, рухомі перешкоди тощо)
    showChumZones: false,
    showCatchZone: false, // Відображення синьої зони
    showLastDashZone: false, // Відображення фіолетової lastDash trigger zone
    showNetZone: false, // Відображення зеленої зони
    showAimingZone: false, // Відображення зони закидання
    showPoleFightSector: false, // Відображення допустимого сектора руху риби
    showFightLineRadius: false, // Відображення повної радіальної межі випущеної ліски

    debugOpacity: 1.0,
    baseResolution: { width: 2560, height: 1440 },
    designCellSize: 40,
    cellSize: 40,
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
      { instanceId: "uuid-reel-nodrag", itemId: "reel_bolognese_nodrag" },
      { instanceId: "uuid-line", itemId: "line_test_1" },
      { instanceId: "uuid-line-short", itemId: "line_test_1" },
      { instanceId: "uuid-leader", itemId: "leader_test_025" },
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
      baseStamina: 500,
      baseStaminaMultiplier: 50,
      flatBonus: 500,
      staminaRatioFromEndurance: 0.1,
      staminaBossMultiplier: 1.5,
    },
    mechanics: {
      simplifiedModel: {
        enabled: true,
      },
      pressure: {
        thresholdKg: 0.01,
        inputWeights: {
          rodHold: 1.0,
          reelHold: 1.0,
          control: 1.0,
        },
        lateralPositionWeights: {
          enabled: true,
          centerHoldMultiplier: 1.0,
          edgeHoldMultiplier: 0.1,
          centerControlMultiplier: 0.1,
          edgeControlMultiplier: 1.0,
          curvePower: 1.0,
        },
        controlDirection: {
          enabled: true,
          centeringMultiplier: 1.0,
          wrongDirectionMultiplier: 0.15,
          neutralMultiplier: 0.5,
          centerDeadZoneRatio: 0.05,
        },
      },
      drain: {
        enabled: true,
        baseDrainPerSecond: 100,
        advantageDrain: {
          enabled: true,
          minAdvantageRatio: 0.1,
          maxAdvantageRatio: 0.9,
          minDrainMultiplier: 0.25,
          maxDrainMultiplier: 1.0,
          curvePower: 1.0,
        },
      },
      regen: {
        enabled: true,
        baseRegenPerSecond: 20,
        beforeExhaustion: {
          immediateOnNoPressure: true,
          allowWhenPlayerFatigueFull: true,
        },
        afterExhaustion: {
          allowOnlyWhenPlayerFatigueFull: true,
          phaseReturnThresholdRatio: 0.001,
          inactivityRecovery: {
            enabled: true,
            noInputTimeoutMs: 5000,
          },
        },
        angleMultiplier: {
          enabled: true,
          centerAngleDeg: 15,
          centerMultiplier: 1.0,
          sideAngleDeg: 75,
          sideMultiplier: 1.5,
          edgeAngleDeg: 90,
          edgeMultiplier: 2.0,
        },
        fatigueMultiplier: {
          enabled: true,
          maxBonusMultiplier: 1.0,
        },
      },
      baseStaminaMultiplier: 50,
      flatBonus: 500,
      enduranceDrain: {
        active: {
          enabled: true,
          drainPerSecond: 80,
          curvePower: 1.0,
        },
        passive: {
          enabled: true,
          drainPerSecond: 15,
          curvePower: 1.0,
          defaultBehaviorMultiplier: 0.5,
          behaviorMultipliers: {
            dash: 1.0,
            swim: 0.5,
            idle: 0.1,
            rest: 0.0,
          },
        },
      },
      enduranceMovementDebuff: {
        enabled: true,
        curvePower: 1.0,
        direction: {
          enabled: true,
          exhaustedRadialRange: [-0.35, 0.45],
        },
        behaviorWeights: {
          enabled: true,
          multipliersAtZeroEndurance: {
            dash: 0.4,
            lastDash: 0.6,
            swim: 0.8,
            idle: 1.3,
            rest: 1.5,
          },
        },
      },
      enduranceRecovery: {
        enabled: true,
        requiresFullStamina: true,
        recoveryPerSecond: 30,
        maxRecoveryRatio: 0.8,
      },

      powerDebuff: {
        enabled: true,
        minBasePowerRatio: 0.2,
        curvePower: 1.0,
      },
      masteryTimeRatio: 0.5,
      masteryPowerMultiplier: 0.2,

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

  physics: typeof PHYSICS_CONFIG !== "undefined" ? PHYSICS_CONFIG : {},

  tension: {
    kgSmoothPerSecond: 2.5,
    // 100% tension is the deterministic failure threshold.
    overloadGraceMs: 0,
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

    // Canvas HUD bar styling lives in CONFIG.ui.hudStyles.
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

    hudStyles: {
      bars: {
        layout: {
          x: "center",
          y: 40,
          spacing: 90,
          tensionGapFromStroke: 34,
        },

        shared: {
          backgroundColor: "#1a2b3c",
          borderColor: "#4a5b6c",
          borderWidth: 1,
          padding: 2,
          labelFont: "bold 16px monospace",
          labelColor: "#ffffff",
          labelGap: 6,
          valueGap: 6,
          valuePlacement: "center",
          valueFont: "bold 12px monospace",
          valueColor: "#ffffff",
        },

        tension: {
          width: 300,
          height: 20,
          glowIntensity: 0.6,
          gradient: {
            low: { start: [0, 0, 255], end: [255, 255, 0] },
            mid: { start: [255, 255, 0], end: [255, 128, 0] },
            high: { start: [255, 128, 0], end: [255, 0, 0] },
            breakpoints: { low: 33, mid: 66 },
          },
          statuses: [
            { threshold: 0, label: "Idle", color: "#4a5b6c" },
            { threshold: 1, label: "LOW", color: "#00ccff" },
            { threshold: 30, label: "MEDIUM", color: "#ffff00" },
            { threshold: 60, label: "HIGH", color: "#ffaa00" },
            { threshold: 80, label: "CRITICAL", color: "#ffffff" },
          ],
          dragMarkerColor: "#73c2fb",
        },

        tackleStress: {
          height: 8,
          yOffset: 40,
          fillColor: "rgba(255, 0, 0, 0.3)",
          strokeColor: "#ff0000",
          borderWidth: 1,
          labelColor: "#ff0000",
          labelFont: "bold 10px monospace",
          valueFont: "bold 10px monospace",
          labelPrefix: "STRESS",
        },

        fishCondition: {
          width: 220,
          height: 10,
          gap: 34,
          padding: 1,
          backgroundColor: "#0b1520",
          borderColor: "#333",
          activeBorderWidth: 2,
          inactiveBorderWidth: 1,
          labelFont: "11px monospace",
          // labelColor: "#8a9bac",
          valueFont: "11px monospace",
          activeLabelColor: "#ffffff",
          stamina: {
            fillColor: "#ffcc00",
          },
          exhaustion: {
            fillColor: "#ff4444",
          },
        },

        drag: {
          heightRatio: 0.65,
          minHeight: 8,
          yOffset: 14,
          fillColor: "#73c2fb",
        },

        rodStroke: {
          valuePlacement: "right",
          height: 3,
          labelFont: "bold 11px monospace",
          valueFont: "bold 11px monospace",
          backgroundColor: "rgba(58, 126, 210, 0.26)",
          fillColor: "#4aa3ff",
        },

        rodControl: {
          valuePlacement: "right",
          height: 3,
          yOffset: -20,
          labelFont: "bold 11px monospace",
          valueFont: "bold 11px monospace",
          activeColor: "#00d4ff",
          inactiveColor: "#5c7d99",
          backgroundColor: "rgba(0, 212, 255, 0.18)",
        },

        castPower: {
          width: 300,
          height: 12,
          x: "center",
          y: 42,
          padding: 2,
          borderWidth: 1,
          backgroundColor: "#1a2b3c",
          borderColor: "#4a5b6c",
          labelFont: "bold 11px monospace",
          labelColor: "#8a9bac",
          valueFont: "bold 11px monospace",
          glowIntensity: 0.45,
        },
      },
    },

    catchZone: {
      color: "rgba(0, 150, 255, 0.5)",
      strokeColor: "rgba(0, 200, 255, 0.85)",
      lastDashFillColor: "rgba(170, 80, 255, 0.12)",
      lastDashStrokeColor: "rgba(190, 90, 255, 0.9)",
      lastDashDash: [9, 7],
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

if (typeof FightPhysicsConfigAdapter !== "undefined") {
  Object.defineProperty(CONFIG, "fightPhysicsConfig", {
    value: new FightPhysicsConfigAdapter(CONFIG),
    enumerable: false,
    configurable: true,
  });
}

const CONFIG_RUNTIME_CONTEXT =
  typeof createRuntimeConfigContext !== "undefined"
    ? createRuntimeConfigContext(CONFIG)
    : null;

const BASE_CONFIG = CONFIG_RUNTIME_CONTEXT?.baseConfig || CONFIG;
const CONFIG_OVERRIDE_STORE = CONFIG_RUNTIME_CONTEXT?.overrideStore || null;
const RESOLVED_CONFIG_PROVIDER =
  CONFIG_RUNTIME_CONTEXT?.resolvedProvider || null;

if (typeof window !== "undefined") {
  window.CYBER_FISHING_CONFIG_RUNTIME = CONFIG_RUNTIME_CONTEXT;
}
