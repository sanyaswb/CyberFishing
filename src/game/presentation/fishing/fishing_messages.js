// Player-facing casting and chum messages, injected into the fishing application services by composition.
export const FISHING_MESSAGES = Object.freeze({
  castRodRequired: "Спочатку спорядіть вудилище.",
  castReelRequired: "Для цієї вудки потрібна котушка.",
  castLineRequired: "Для закидання потрібна ліска.",
  equipRodToCast: "Спочатку споряди вудку для закидання.",
  rodNeedsReelToCast: (rodName) => `${rodName}: потрібна котушка для закидання.`,
  unnamedRod: "Ця",
  equipLineToCast: "Спочатку споряди ліску для закидання.",
  // Spec 179 stage E: no cast during an emission without a gas mask.
  gasMaskRequiredToCast: "У вас немає протигазу",
  // Spec 185 D8 (owner Q4): a gas mask that does not protect does not allow a cast either.
  gasMaskBrokenToCast: "Протигаз тріснув — він більше не захищає",
  gasMaskFilterRequiredToCast: "Протигаз без фільтра не захищає: вставте фільтр із запасом часу",
  // Spec 179 D12 (owner Q20): the house only with the tackle put away.
  stowTackleForHouse: "Спершу складіть снасті в інвентар",
  noChumInInventory: "У вас немає прикормки в інвентарі!",
  loadChumIntoBoat: "Завантажте прикормку в бункери кораблика через інвентар!",
  boatNeedsBattery: "Вставте батарейку в кораблик через інвентар!",
  boatBatteryEmpty: "Батарейка кораблика розряджена. Замініть її в інвентарі.",
  boatDrifting: "Кораблик розрядився і дрейфує. Заберіть його підсакою, коли він підпливе, або дочекайтеся, поки його приб'є до берега.",
  selectedChumUnavailable: "Обрана прикормка більше недоступна.",
  tooFarForHandCast: "Занадто далеко для ручного закидання!",
});
