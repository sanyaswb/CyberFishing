/**
 * Location database.
 *
 * Тримає тільки конкретні локації: backgrounds, depth map, weather,
 * environment та зони. Загальні налаштування всіх карт лишаються
 * в CONFIG.locations.
 */
const MAP_DB = {
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

    chumCastDistance: 680,

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
      castable: [{ x: 0, y: 13, w: 64, h: 16 }],
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
};
