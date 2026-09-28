/**
 * Inventory-v2 rule messages shown to the player. Domain rules never hold these
 * texts: composition injects this catalog, so every result keeps its exact text.
 * Context-dependent entries are functions returning the exact strings.
 */
const INVENTORY_RULE_MESSAGES = Object.freeze({
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
  // Equipment transitions.
  inventoryCapacityExceeded: "Недостатньо місця в інвентарі.",
});
