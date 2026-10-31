// Room art is named by asset id (spec 157 R16); the House views resolve the files through the asset registry.
export const HOUSE_CONFIG = Object.freeze({
  ui: Object.freeze({ noticeDurationMs: 4000, sheetCloseDurationMs: 280, sheetDismissDistancePx: 24,
    sceneWheelGestureGapMs: 180 }),
  room: Object.freeze({
    initialLevel: 1,
    maxLevel: 5,
    upgradeDurationMs: Object.freeze({ 2: 2 * 3600000, 3: 8 * 3600000, 4: 16 * 3600000, 5: 48 * 3600000 }),
    backgroundAssets: Object.freeze({
      1: Object.freeze({ day: "house.room-1.lvl-1.room--1-day-lvl--1", evening: "house.room-1.lvl-1.room--1-eveningLight--on-lvl--1", night: "house.room-1.lvl-1.room--1-nightLight--on-lvl--1" }),
      2: Object.freeze({ day: "house.room-1.lvl-2.room--1-day-lvl--2", evening: "house.room-1.lvl-2.room--1-eveningLight--off-lvl--2", night: "house.room-1.lvl-2.room--1-nightLight--on-lvl--2" }),
      3: Object.freeze({ day: "house.room-1.lvl-3.room--1-day-lvl--3", evening: "house.room-1.lvl-3.room--1-eveningLight--on-lvl--3", night: "house.room-1.lvl-3.room--1-nightLight--on-lvl--3" }),
      4: Object.freeze({ day: "house.room-1.lvl-4.room--1-day-lvl--4", evening: "house.room-1.lvl-4.room--1-eveningLight--off-lvl--4", night: "house.room-1.lvl-4.room--1-nightLight--off-lvl--4" }),
      5: Object.freeze({ day: "house.room-1.lvl-5.room--1-day-lvl--5", evening: "house.room-1.lvl-5.room--1-eveningLight--on-lvl--5", night: "house.room-1.lvl-5.room--1-nightLight--on-lvl--5" }),
    }),
    aquariumAsset: "house.room-1.room--1_aqua",
    renovationAsset: "house.room-1.under-renovation",
  }),
});
