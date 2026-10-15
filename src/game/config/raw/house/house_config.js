const BASE = "assets/house/room-1";

export const HOUSE_CONFIG = Object.freeze({
  ui: Object.freeze({ noticeDurationMs: 4000, sheetCloseDurationMs: 280, sheetDismissDistancePx: 24,
    sceneWheelGestureGapMs: 180 }),
  room: Object.freeze({
    initialLevel: 1,
    maxLevel: 5,
    upgradeDurationMs: Object.freeze({ 2: 2 * 3600000, 3: 8 * 3600000, 4: 16 * 3600000, 5: 48 * 3600000 }),
    backgrounds: Object.freeze({
      1: Object.freeze({ day: `${BASE}/lvl-1/room--1-day-lvl--1.webp`, evening: `${BASE}/lvl-1/room--1-eveningLight--on-lvl--1.webp`, night: `${BASE}/lvl-1/room--1-nightLight--on-lvl--1.webp` }),
      2: Object.freeze({ day: `${BASE}/lvl-2/room--1-day-lvl--2.webp`, evening: `${BASE}/lvl-2/room--1-eveningLight--off-lvl--2.webp`, night: `${BASE}/lvl-2/room--1-nightLight--on-lvl--2.webp` }),
      3: Object.freeze({ day: `${BASE}/lvl-3/room--1-day-lvl--3.webp`, evening: `${BASE}/lvl-3/room--1-eveningLight--on-lvl--3.webp`, night: `${BASE}/lvl-3/room--1-nightLight--on-lvl--3.webp` }),
      4: Object.freeze({ day: `${BASE}/lvl-4/room--1-day-lvl--4.webp`, evening: `${BASE}/lvl-4/room--1-eveningLight--off-lvl--4.webp`, night: `${BASE}/lvl-4/room--1-nightLight--off-lvl--4.webp` }),
      5: Object.freeze({ day: `${BASE}/lvl-5/room--1-day-lvl--5.webp`, evening: `${BASE}/lvl-5/room--1-eveningLight--on-lvl--5.webp`, night: `${BASE}/lvl-5/room--1-nightLight--on-lvl--5.webp` }),
    }),
    aquariumImage: `${BASE}/room--1_aqua.webp`,
    renovationImage: `${BASE}/under-renovation.webp`,
  }),
});
