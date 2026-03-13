const CONFIG = {
  canvas: {
    id: "gameCanvas",
    backgroundColor: "#0f171e", // Цей колір потрібен класу Renderer
  },

  ui: {
    draggableButtons: true,
    dragHoldTimeMs: 1000,

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

    line: {
      visible: true,
      color: "rgba(255, 255, 255, 0.3)",
      width: 1,
      straightenTension: 30, // Відсоток натягу (0-100), при якому ліска стає ідеально рівною
      sagOffset: 60, // Наскільки сильно провисає ліска у пікселях
      shrinkPercent: 70, // На скільки відсотків зменшити довжину лінії
      shrinkEasePower: 4, // Чим вище, тим крутіше крива зменшення довжини (1 = лінійно, >1 = більш різко ближче до 100% натягу)
      sinkDropPx: 120, // На скільки пікселів опускається ліска при повному зануренні поплавця (для візуального ефекту)
      snapDurationMs: 300,
      snapDepthMaxMultiplier: 2.0,
      distanceDelayMinMs: 1500,
      distanceDelayMaxMs: 5000,
    },
  },

  locations: {
    debugVisuals: false, // Головний вимикач (якщо false - взагалі нічого не малюється)
    debugZones: true, // Показувати кольорові квадрати (зелені, червоні)
    debugGrid: true, // Показувати лінії сітки
    debugDepthText: true, // Показувати цифри глибини
    enableCastable: true, // Зони, де можна закидати вудку
    enableCollisions: true, // Колізії з землею (червоні зони) - забороняють закидати.
    enableSnags: true, // Динамічні зони (наприклад, косяк риби)
    showChumZones: true,
    showCatchZone: true, // Відображення синьої зони
    showNetZone: true, // Відображення зеленої зони

    debugOpacity: 1.0,
    baseResolution: { width: 2560, height: 1440 },
    designCellSize: 40,
    cellSize: 40,
    catchLineOffsetPx: 5,
    lockZoneXToScreen: true,

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

        perspectiveSquash: { top: 0.15, bottom: 0.75 },
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
          castable: [
            { x: 9, y: 12, w: 39, h: 1 },
            { x: 9, y: 13, w: 55, h: 1 },
            { x: 0, y: 14, w: 64, h: 15 },
          ],
          collisions: [{ x: 12, y: 22, w: 3, h: 2 }],
          snags: [{ x: 50, y: 13, w: 14, h: 8 }],
          dynamic: [
            {
              id: "fish_school_1",
              type: "buff",
              multiplier: 1.5,
              x: 10,
              y: 15,
              w: 1,
              h: 1,
              moving: true,
              speedX: 1.2,
              speedY: 0.8,
              bounds: [
                { x: 9, y: 12, w: 39, h: 1 },
                { x: 9, y: 13, w: 55, h: 1 },
                { x: 0, y: 14, w: 64, h: 15 },
              ],
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

        weatherMultipliers: {
          rain: 1.5,
          fog: 1.2,
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
          maxResistance: 2.5,
        },

        baitMultipliers: { oil_worm: 2.0, bread: 0.5 },
        timeMultipliers: { morning: 1.5, day: 0.8, evening: 1.2, night: 0.2 },
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
              weight: 20,
            },
            rest: {
              pull: 0.2,
              move: 0.1,
              minTime: 500,
              maxTime: 2500,
              weight: 10,
            },
            swim: {
              pull: 1.0,
              move: 1.0,
              minTime: 2000,
              maxTime: 4000,
              weight: 50,
            },
            dash: {
              pull: 1.5,
              move: 1.5,
              minTime: 1000,
              maxTime: 2200,
              weight: 20,
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
      },
      {
        id: "perch_radioactive",
        name: "Окунь-радіоактивний",
        baseChance: 0.05,
        maxHookSize: 9,

        weatherMultipliers: {
          rain: 1.1,
          fog: 1.0,
        },

        depthConfig: {
          minDepth: 1.0,
          maxDepth: 10.0,
          minWeightAtMinDepth: 0.125,
          maxWeightAtMinDepth: 0.8,
          minWeightAtMaxDepth: 1.123,
          maxWeightAtMaxDepth: 1.678,
          chanceMultAtMaxDepth: 0.4,
        },

        weightConfig: {
          rarityCurve: 3.5,
          maxLevel: 5,
          baseResistance: 0.8,
          maxResistance: 1.5,
        },

        baitMultipliers: { oil_worm: 2.0, bread: 0.5 },
        timeMultipliers: { morning: 1.5, day: 0.8, evening: 1.2, night: 0.2 },
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
      },
    ],
  },

  debug: {
    overlay: true,
    initialTime: 17.5, // Початковий час. 17.5 = 17:30. Якщо поставити null, гра візьме реальний час.
    timeScale: 240, // Швидкість часу. 1 = реальний час. 60 = 1 ігрова година минає за 1 реальну хвилину.

    fixedCatch: {
      enabled: true,
      fishId: "crucian_stalker", // Можна вписати 'perch_radioactive'
      level: 5,
      weight: 2.678,
      resistance: 2.5,
    },
  },

  logs: {
    events: false,
    maxEntries: 50,
    endpoint: "http://localhost:3000/api/events", // ОСЬ ЦЕЙ РЯДОК З'ЄДНУЄ ГРУ З БЕКЕНДОМ
  },

  input: {
    pointerThreshold: 10, // Dead zone (so that random micro-movements don't jerk the rod)
    dragRadius: 200, // Swipe distance in pixels for maximum steering
  },

  float: {
    width: 3,
    length: 15,
    type: "day",
    level: 1,
    quality: 10.0,
    overDepthPenaltyMult: 0.5,

    sinkingDelayMs: 500,
    sinkingDurationMs: 4000,
    perspectiveScaleRange: [1.3, 0.7],

    biteSequence: {
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
  },

  sinker: {
    level: 1,
    quality: 10.0,
    maxDepth: 10.0,
    weight: "light",
    weights: {
      light: { speedMult: 1.0, heightScale: 1.0 },
      medium: { speedMult: 1.5, heightScale: 0.85 },
      heavy: { speedMult: 2.0, heightScale: 0.7 },
    },
  },

  wind: {
    active: true,
    speedPxPerSec: 15,
    direction: { x: 1, y: 0.2 },
  },

  rod: {
    level: 5,
    basePower: 1.0,
    compensation: 0.8,
  },

  reel: {
    level: 4, // СТАРИЙ ПАРАМЕТР (залишається для старої логіки)
    basePower: 1.0, // СТАРИЙ ПАРАМЕТР (залишається для старої логіки)
    pumpLevel: 5,
    pumpPowerPerLevel: 10, // Скільки відсотків натягу знімає 1 рівень підтяжки

    // НОВИЙ ПАРАМЕТР: Механіка утримання
    hold: {
      activeLevel: 3, // Поточний рівень утримання (0 - якщо механіка ще не куплена/вимкнена)
      swipeThresholdPx: 100, // Відстань свайпу по Y для активації (універсальна)
      manualCooldownMs: 500, // Кулдаун після ручної деактивації (універсальний)

      // Характеристики кожного рівня утримання
      levels: {
        1: {
          charges: 1, // Кількість блокувань (кружечків)
          restoreTimeMs: 5000, // Час відновлення одного розбитого блоку
          holdPower: 1, // Додаткова сила утримання для розрахунку шансу пробиття рибою
          tensionMultiplier: 1.0, // Пропускає 100% сили риби в ліску
        },
        2: {
          charges: 2,
          restoreTimeMs: 4000,
          holdPower: 2,
          tensionMultiplier: 1.0, // Пропускає 80% сили риби в ліску
        },
        3: {
          charges: 3,
          restoreTimeMs: 3000,
          holdPower: 3,
          tensionMultiplier: 1.0, // Пропускає 60% сили риби в ліску
        },
        // Можеш додавати скільки завгодно рівнів...
      },
    },
  },

  net: {
    active: true,
    length: 15.0, // Це "виліт" підсаки у віртуальних одиницях (буде 150px)
    maxWeight: 3.0,
    quality: 1.0,
    type: "all",
    chances: [
      { min: 0, max: 39, chance: 80 },
      { min: 40, max: 79, chance: 70 },
      { min: 80, max: 99, chance: 60 },
      { min: 100, max: Infinity, chance: 50 },
    ],
  },

  chum: {
    currentMethod: "hand", // Перемикач: 'hand' (руками) або 'boat' (кораблик)

    deliveryMethods: {
      hand: {
        type: "hand",
        flightTimeMs: 3000,
      },
      boat: {
        type: "boat",
        manualControl: true,
        level: 1, // Поточний рівень кораблика
        statsByLevel: {
          1: { speedPxPerSec: 150, maxEnergy: 60, energyDrainPerSec: 1 }, // Енергії вистачить на 60 сек плавання
          2: { speedPxPerSec: 200, maxEnergy: 90, energyDrainPerSec: 1 },
          3: { speedPxPerSec: 250, maxEnergy: 120, energyDrainPerSec: 1 },
        },
        turnSpeedRad: 3.0,
        lookAheadCells: 3, // На скільки клітин дивиться вперед для вибору напрямку
        perspectiveScaleRange: [0.5, 1.0],
        emoji: "🚤",
      },
    },

    baits: {
      carp_mix_basic: {
        id: "carp_mix_basic",
        name: "Базова коропова суміш",
        targetFishes: ["crucian_stalker"],

        radius: 150,

        maxBonus: 2.0,
        minBonus: 1.2,
        rampUpTimeMs: 3600000,
        peakDurationMs: 7200000,
        totalBonusTimeMs: 14400000,
        minBonusDurationHours: 24,
      },
    },
  },

  hook: {
    level: 5,
    weight: 4, // Affects how much tension increases per unit of player input
    quality: 1, // Аналог resistance у риби
  },

  hookMechanics: {
    safeTensionThreshold: 50, // Поріг для сильної риби
    safeTensionThresholdWeakFish: 90, // Поріг для слабкої риби (НОВЕ)
    baseEscapeChance: 0.01,
    chancePer10Tension: 0.01,
    fishDominanceMultiplier: 1.5,
    extremeDominanceBonus: 0.5,
    checkIntervalMs: 1000,
    slackLinePenaltyTimeMs: 10000, // Час провисання до штрафу (10 сек) (НОВЕ)
    slackLineEscapeChance: 0.1, // Шанс сходу при провисанні (1%) (НОВЕ)
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
      masteryPowerMultiplier: 0.2, // До якого відсотка ПЛАВНО впаде сила (0.2 = залишиться 20%)
    },
  },

  physics: {
    fishForceMultiplier: 0.01,
    playerForceMultiplier: 0.017,
    playerSteeringMultiplier: 1.5, // Mechanical advantage of rod for X-axis steering
    edgePullPenalty: 0.5, // 0.5 означає, що на краю екрана гравець втратить 50% сили
  },

  tension: {
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

  colors: {
    background: "#0f171e",
    bodyBackground: "#1a1a1a",
  },
};
