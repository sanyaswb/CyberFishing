// Player-facing casting and chum messages, injected into the fishing application services by composition.
export const FISHING_MESSAGES = Object.freeze({
  castRodRequired: "Спочатку спорядіть вудилище.",
  castReelRequired: "Для цієї вудки потрібна котушка.",
  castLineRequired: "Для закидання потрібна ліска.",
  equipRodToCast: "Спочатку споряди вудку для закидання.",
  rodNeedsReelToCast: (rodName) => `${rodName}: потрібна котушка для закидання.`,
  unnamedRod: "Ця",
  equipLineToCast: "Спочатку споряди ліску для закидання.",
  noChumInInventory: "У вас немає прикормки в інвентарі!",
  loadChumIntoBoat: "Завантажте прикормку в бункери кораблика через інвентар!",
  selectedChumUnavailable: "Обрана прикормка більше недоступна.",
  tooFarForHandCast: "Занадто далеко для ручного закидання!",
});
