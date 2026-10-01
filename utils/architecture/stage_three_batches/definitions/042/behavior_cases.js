"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if (item === undefined) return "#undefined";
  return item;
}));
// Only the error type is compared: V8 formats the frozen object differently per realm in messages.
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: error.name }; }
};
// Deep table facts: values, own key order, frozenness at every level and array-ness.
const shape = value => {
  if (value === null || typeof value !== "object") return { type: typeof value, value };
  return { array: Array.isArray(value), frozen: Object.isFrozen(value), extensible: Object.isExtensible(value),
    keys: Reflect.ownKeys(value).map(String),
    entries: Object.entries(value).map(([key, item]) => [key, shape(item)]) };
};
// Strict-mode writes to frozen tables throw; every attempt must leave the table unchanged.
const writes = (table, key, sample) => ({
  set: attempt(() => { table[key] = sample; return table[key]; }),
  add: attempt(() => { table.__added = sample; return table.__added; }),
  remove: attempt(() => { delete table[key]; return Object.keys(table).length; }),
  define: attempt(() => Object.defineProperty(table, "__defined", { value: sample }) && null),
  after: snapshot(table),
});
const arrayReads = ids => ({
  length: ids.length,
  indexes: ids.map((id, index) => [index, ids.indexOf(id), ids.includes(id)]),
  missing: [ids.indexOf("missing"), ids.includes(undefined), ids.at(-1), ids.slice(1, 3)],
  joined: ids.join(","),
  push: attempt(() => ids.push("extra")),
  sort: attempt(() => ids.sort()),
  after: snapshot(ids),
});

const EXECUTABLE_CASES = Object.freeze({
  EquipmentSlotId: Object.freeze({
    "persisted-slot-id-values-and-frozen-enum": ids => ({
      shape: shape(ids),
      values: Object.values(ids),
      unique: new Set(Object.values(ids)).size === Object.keys(ids).length,
      reads: [ids.ROD, ids.GAS_MASK, ids.MISSING, ids.rod, ids["TERMINAL_LINE"]],
      writes: writes(ids, "ROD", "boat"),
    }),
  }),
  EQUIPMENT_MAIN_SLOT_IDS: Object.freeze({
    "main-slot-order-and-frozen-array": ids => ({ shape: shape(ids), reads: arrayReads(ids),
      writes: writes(ids, 0, "net") }),
  }),
  EQUIPMENT_AUXILIARY_SLOT_IDS: Object.freeze({
    "auxiliary-slot-order-and-frozen-array": ids => ({ shape: shape(ids), reads: arrayReads(ids),
      writes: writes(ids, 0, "rod") }),
  }),
  EQUIPMENT_ALL_SLOT_IDS: Object.freeze({
    "all-slot-order-main-then-auxiliary": ids => ({ shape: shape(ids), reads: arrayReads(ids),
      writes: writes(ids, 8, "rod"), copies: [[...ids].reverse(), Array.from(ids).length] }),
  }),
  EQUIPMENT_SLOT_CONFIG: Object.freeze({
    "slot-table-groups-visibility-accept-types-and-lock": config => ({
      shape: shape(config),
      slots: Object.keys(config).map(id => [id, config[id].id === id, config[id].group, config[id].visibility,
        Array.from(config[id].acceptTypes), config[id].locked === true, "locked" in config[id]]),
      lookups: [config.rod.acceptTypes.includes("rod"), config.tackle.acceptTypes.indexOf("lure"),
        config.terminalLine.acceptTypes.includes("leader_line"), config.missing, config.delivery.acceptTypes.length],
      groups: ["main", "auxiliary"].map(group => Object.values(config).filter(item => item.group === group)
        .map(item => item.id)),
      writes: writes(config, "rod", null),
      nestedWrites: [writes(config.gasMask, "locked", false), writes(config.tackle.acceptTypes, 0, "net")],
    }),
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    EquipmentSlotId: ["persisted-slot-id-values-and-frozen-enum"],
    EQUIPMENT_MAIN_SLOT_IDS: ["main-slot-order-and-frozen-array"],
    EQUIPMENT_AUXILIARY_SLOT_IDS: ["auxiliary-slot-order-and-frozen-array"],
    EQUIPMENT_ALL_SLOT_IDS: ["all-slot-order-main-then-auxiliary"],
    EQUIPMENT_SLOT_CONFIG: ["slot-table-groups-visibility-accept-types-and-lock"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-five-exact-exports",
    "one-esm-evaluation-with-the-reviewed-frozen-data-tables-only",
    "five-exact-classic-activations-at-their-legacy-positions",
    "fifteen-exact-classic-consumer-relationships",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
