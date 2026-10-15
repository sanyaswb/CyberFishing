/**
 * Stable inventory equipment identifiers.
 *
 * Slot numbers and labels belong to the UI. Domain state stores only these ids,
 * so a conditional slot never changes identity when the selected rod changes.
 */
export const EquipmentSlotId = Object.freeze({
  ROD: "rod",
  REEL: "reel",
  TERMINAL_LINE: "terminalLine",
  TACKLE: "tackle",
  FLOAT: "float",
  HAND_CHUM: "handChum",
  NET: "net",
  DELIVERY: "delivery",
  GAS_MASK: "gasMask",
});

export const EQUIPMENT_MAIN_SLOT_IDS = Object.freeze([
  EquipmentSlotId.ROD,
  EquipmentSlotId.REEL,
  EquipmentSlotId.TERMINAL_LINE,
  EquipmentSlotId.TACKLE,
  EquipmentSlotId.FLOAT,
]);

export const EQUIPMENT_AUXILIARY_SLOT_IDS = Object.freeze([
  EquipmentSlotId.HAND_CHUM,
  EquipmentSlotId.NET,
  EquipmentSlotId.DELIVERY,
  EquipmentSlotId.GAS_MASK,
]);

export const EQUIPMENT_ALL_SLOT_IDS = Object.freeze([
  ...EQUIPMENT_MAIN_SLOT_IDS,
  ...EQUIPMENT_AUXILIARY_SLOT_IDS,
]);

export const EQUIPMENT_SLOT_CONFIG = Object.freeze({
  [EquipmentSlotId.ROD]: Object.freeze({
    id: EquipmentSlotId.ROD,
    group: "main",
    visibility: "always",
    acceptTypes: Object.freeze(["rod"]),
  }),
  [EquipmentSlotId.REEL]: Object.freeze({
    id: EquipmentSlotId.REEL,
    group: "main",
    visibility: "supportsReel",
    acceptTypes: Object.freeze(["reel"]),
  }),
  [EquipmentSlotId.TERMINAL_LINE]: Object.freeze({
    id: EquipmentSlotId.TERMINAL_LINE,
    group: "main",
    visibility: "rodSelected",
    acceptTypes: Object.freeze(["fishing_line", "leader_line"]),
  }),
  [EquipmentSlotId.TACKLE]: Object.freeze({
    id: EquipmentSlotId.TACKLE,
    group: "main",
    visibility: "rodSelected",
    acceptTypes: Object.freeze([
      "hook",
      "feeder_rig",
      "lure",
    ]),
  }),
  [EquipmentSlotId.FLOAT]: Object.freeze({
    id: EquipmentSlotId.FLOAT,
    group: "main",
    visibility: "supportsFloat",
    acceptTypes: Object.freeze(["float"]),
  }),
  [EquipmentSlotId.HAND_CHUM]: Object.freeze({
    id: EquipmentSlotId.HAND_CHUM,
    group: "auxiliary",
    visibility: "always",
    acceptTypes: Object.freeze(["chum_mix"]),
  }),
  [EquipmentSlotId.NET]: Object.freeze({
    id: EquipmentSlotId.NET,
    group: "auxiliary",
    visibility: "always",
    acceptTypes: Object.freeze(["net"]),
  }),
  [EquipmentSlotId.DELIVERY]: Object.freeze({
    id: EquipmentSlotId.DELIVERY,
    group: "auxiliary",
    visibility: "always",
    acceptTypes: Object.freeze(["boat", "chum_delivery"]),
  }),
  [EquipmentSlotId.GAS_MASK]: Object.freeze({
    id: EquipmentSlotId.GAS_MASK,
    group: "auxiliary",
    visibility: "always",
    acceptTypes: Object.freeze(["gas_mask"]),
    locked: true,
  }),
});
