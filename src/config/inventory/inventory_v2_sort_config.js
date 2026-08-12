const INVENTORY_V2_SORT_CONFIG = Object.freeze({
  defaults: Object.freeze({
    criterionIds: Object.freeze(["rarity"]),
    directionId: "descending",
  }),
  directions: Object.freeze([
    Object.freeze({
      id: "ascending",
      icon: "↑",
      label: "Від меншого до більшого",
    }),
    Object.freeze({
      id: "descending",
      icon: "↓",
      label: "Від більшого до меншого",
    }),
  ]),
  criteria: Object.freeze([
    Object.freeze({ id: "type", label: "За типом" }),
    Object.freeze({ id: "rarity", label: "За рідкістю" }),
    Object.freeze({
      id: "progressionLevel",
      label: "За рівнем прогресії",
    }),
    Object.freeze({ id: "rating", label: "За рейтингом" }),
  ]),
  typeOrder: Object.freeze([
    "spinning",
    "feeder",
    "float",
    "pole",
    "match",
    "bolognese",
    "spinning_reel",
    "fishing_line",
    "leader_line",
    "hook",
    "spinner",
    "wobbler",
    "jig",
    "lure",
    "feeder_rig",
    "spring",
    "feeder_tackle",
    "float_tackle",
    "day",
    "night",
    "bait",
    "fishing_bait",
    "chum_mix",
    "groundbait",
    "boat",
    "chum_delivery",
    "net",
    "gas_mask",
    "equipment_loadout",
  ]),
  rarityLabels: Object.freeze({
    common: "Звичайні",
    uncommon: "Незвичайні",
    rare: "Рідкі",
    epic: "Епічні",
    legendary: "Легендарні",
    unique: "Унікальні",
  }),
  numericPaths: Object.freeze({
    progressionLevel: Object.freeze([
      "progression.progressionLevel.current",
    ]),
    rating: Object.freeze(["progression.rating.rawValue"]),
  }),
});

globalThis.INVENTORY_V2_SORT_CONFIG = INVENTORY_V2_SORT_CONFIG;
