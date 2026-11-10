/**
 * Location database.
 *
 * Тримає тільки конкретні локації: backgrounds, depth map, weather,
 * environment та зони. Загальні налаштування всіх карт лишаються
 * в CONFIG.locations.
 */
export const MAP_DB = {
  test: {
    id: "test",
    name: "Test Waters",
    // Фони фаз доби й карта глибин — id реєстру асетів (spec 157 R16), не шляхи.
    backgroundAssets: {
      day: "locations.test.bg_test--day",
      evening: "locations.test.bg_test--evening",
      night: "locations.test.bg_test--night",
    },
    depthAsset: "locations.test.test-depth",
    // x: 'left', 'center', 'right'
    // y: 'top', 'center', 'bottom', 'safeZone'
    initialAlignment: { x: "center", y: "center" },
    safeZone: { top: 0, bottom: 1440 },
    depthBounds: { min: 0.1, max: 15.0 },

    chumCastDistance: 680,

    // Проста 2D-перспектива води (spec 126). 30 м завжди означає 30 м між межами зеленої зони.
    // Без цієї гілки вода рівномірна: physics.simulation.pixelsPerMeter по всій зоні, кола без сплющення.
    waterProjection: {
      maxMeters: 30, // точна відстань від нижнього до верхнього краю зеленої зони
      tiltDegrees: 30, // художнє сплющення поверхневих зон: 90° — коло, 30° — половина висоти
      farScale: 0.3, // на дальньому краї розмір і переміщення вглиб становлять 30% від ближнього краю
      lateralContraction: false, // додаткове звуження координат X; розміри поверхневих маркерів зменшуються завжди
    },

    // Погода (spec 172): опади ясно → дощ → гроза (гроза лише після дощу), туман окремо. Усі часи — реальні секунди.
    // weight — вага вибору наступного стану; intensity — діапазон сили 0…1; fadeInSec/fadeOutSec — повне наростання 0 → 1
    // і згасання 1 → 0. Стартові значення (власник 2026-11-09: дощ 1–10 хв реального часу), баланс — у DevTools «ПОГОДА».
    weather: {
      precipitation: {
        clear: { weight: 0.7, durationSec: [180, 900] },
        rain: { weight: 0.25, durationSec: [60, 600], intensity: [0.3, 0.8] },
        storm: { weight: 0.3, durationSec: [60, 240], intensity: [0.6, 1.0] }, // ~1 з 4 дощів переходить у грозу
        fadeInSec: 20,
        fadeOutSec: 30,
      },
      fog: {
        chance: 0.15, // шанс туману при кожній перевірці у дозволених фазах
        phases: ["morning", "night"],
        idleSec: [120, 600], // скільки чекати до наступної перевірки без туману
        durationSec: [120, 600],
        intensity: [0.4, 1.0],
        fadeInSec: 30,
        fadeOutSec: 45,
      },
      lightning: {
        intervalSec: [25, 6], // інтервал між ударами при силі грози 0 → 1 (±50%)
        distance: [0.2, 1.0], // 0 — поруч, 1 — далеко (затримка грому, сила спалаху)
      },
      thresholds: { rain: 0.15, fog: 0.3 }, // з якої сили діють множники кльову rain/fog
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
        rainMultiplier: 2.5, // множник вітру й шуму радіо при повній силі дощу (spec 172: 1 + дощ × (2,5 − 1))
      },
    },

    // Zones: zones/test.js (spec 130), joined by game/config/databases/location_catalog.js.
  },
};
