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

    // Zones: zones/test.js (spec 130), joined by game/config/databases/location_catalog.js.
  },
};
