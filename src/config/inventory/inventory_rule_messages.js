/**
 * Inventory-v2 rule messages shown to the player. Domain rules never hold these
 * texts: composition injects this catalog, so every result keeps its exact text.
 * Context-dependent entries are functions returning the exact strings.
 */
const INVENTORY_RULE_MESSAGES = (() => {
  // Metres as the rules report them: integers as is, other values with one decimal.
  const meters = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  };
  return Object.freeze({
    // Equipment compatibility.
    itemOrSlotMissing: "Предмет або слот не знайдено.",
    equipmentSlotLocked: Object.freeze(
      (slotId) =>
        EQUIPMENT_SLOT_PRESENTATION[slotId]?.lockedWarning ||
        "Цей слот ще не розблоковано.",
    ),
    slotUnsupportedByRod: "Цей слот не підтримується обраним вудилищем.",
    itemNotAcceptedBySlot: "Предмет не підходить до цієї комірки.",
    tackleIncompatibleWithRod: "Ця снасть не сумісна з обраним вудилищем.",
    // Fishing readiness.
    leaderRequiresReelLine:
      "Поводок можна спорядити лише після котушки з установленою ліскою.",
    rodRequired: "Спочатку спорядіть вудилище.",
    reelRequired: "Для цієї вудки потрібна котушка.",
    reelLineRequired: "У котушку потрібно встановити ліску.",
    terminalLineRequired: "Для закидання потрібно спорядити ліску.",
    feederHookMissing: "Снасть споряджена без гачків, тому клювання не буде.",
    chumBonusMissing: "Прикормка відсутня: бонус прикормки не діє.",
    // Equipment transitions and inventory capacity.
    inventoryCapacityExceeded: "Недостатньо місця в інвентарі.",
    // Line allocation.
    lineRodRequired: "Спочатку екіпіруйте вудку для ліски.",
    lineReelRequired: "Для цієї вудки спочатку екіпіруйте котушку.",
    lineTooShortForRod: Object.freeze(
      (minimum) =>
        `Ліска закоротка: потрібно мінімум ${meters(minimum)}м для цієї вудки.`,
    ),
    reelTooSmallForLine: Object.freeze(
      (minimum, maximum) =>
        `Котушка замала: потрібно мінімум ${meters(minimum)}м, а вміщує ${meters(maximum)}м.`,
    ),
    lineWillBeCut: Object.freeze(
      (length) => `Буде відрізано ${meters(length)}м ліски.`,
    ),
    windingReelMissing: "Котушку для намотування ліски не знайдено.",
    lineLengthUnavailable: "У вибраній лісці немає доступної довжини.",
    reelCapacityUnavailable: "Котушка не має доступної місткості для ліски.",
    lineWillBeWound: Object.freeze(
      (length) => `Буде намотано ${meters(length)}м ліски.`,
    ),
  });
})();
