/**
 * Inventory equipment slot presentation: UI labels, hints and locked-slot
 * warnings keyed by the stable slot ids of EQUIPMENT_SLOT_CONFIG (EquipmentSlotId).
 */
export const EQUIPMENT_SLOT_PRESENTATION = Object.freeze({
  rod: Object.freeze({ label: "Вудилище" }),
  reel: Object.freeze({ label: "Котушка" }),
  terminalLine: Object.freeze({
    label: "Поводок / ліска",
    presentation: "terminalLine",
  }),
  tackle: Object.freeze({ label: "Снасть" }),
  float: Object.freeze({ label: "Поплавок" }),
  handChum: Object.freeze({ label: "Прикормка" }),
  net: Object.freeze({ label: "Підсака" }),
  delivery: Object.freeze({ label: "Кораблик" }),
  gasMask: Object.freeze({
    label: "Протигаз",
    lockedWarning: "Протигаз ще не розблоковано.",
  }),
});
