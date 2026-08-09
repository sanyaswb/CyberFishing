const ITEM_ASSEMBLY_PROFILE_IDS = Object.freeze({
  REEL: "reel_standard",
  FEEDER_RIG: "feeder_spring_basic",
  HOOK: "hook_standard",
  BAIT_BOAT: "bait_boat",
});

const ITEM_ASSEMBLY_PROFILE_CONFIG = Object.freeze({
  [ITEM_ASSEMBLY_PROFILE_IDS.REEL]: Object.freeze({
    id: ITEM_ASSEMBLY_PROFILE_IDS.REEL,
    fallbackTypes: Object.freeze(["spinning_reel", "reel"]),
    slots: Object.freeze([
      Object.freeze({
        id: "line",
        acceptedTypes: Object.freeze(["fishing_line", "line"]),
        capacity: 1,
        refillable: false,
      }),
    ]),
  }),

  [ITEM_ASSEMBLY_PROFILE_IDS.FEEDER_RIG]: Object.freeze({
    id: ITEM_ASSEMBLY_PROFILE_IDS.FEEDER_RIG,
    fallbackTypes: Object.freeze([
      "feeder_rig",
      "spring_rig",
      "feeder_tackle",
    ]),
    slots: Object.freeze([
      Object.freeze({
        id: "hook",
        acceptedTypes: Object.freeze(["hook", "fishing_hook"]),
        capacity: 1,
        capacityProperty: "hooksCount",
        refillable: false,
      }),
      Object.freeze({
        id: "chum",
        acceptedTypes: Object.freeze(["chum_mix", "groundbait"]),
        capacity: 1,
        enabledProperty: "hasChumSlot",
        refillable: true,
      }),
    ]),
  }),

  [ITEM_ASSEMBLY_PROFILE_IDS.HOOK]: Object.freeze({
    id: ITEM_ASSEMBLY_PROFILE_IDS.HOOK,
    fallbackTypes: Object.freeze(["hook", "fishing_hook"]),
    slots: Object.freeze([
      Object.freeze({
        id: "bait",
        acceptedTypes: Object.freeze(["bait", "fishing_bait"]),
        capacity: 1,
        refillable: true,
      }),
    ]),
  }),

  [ITEM_ASSEMBLY_PROFILE_IDS.BAIT_BOAT]: Object.freeze({
    id: ITEM_ASSEMBLY_PROFILE_IDS.BAIT_BOAT,
    fallbackTypes: Object.freeze(["boat", "bait_boat", "chum_delivery"]),
    slots: Object.freeze([
      Object.freeze({
        id: "cargo",
        acceptedTypes: Object.freeze(["chum_mix", "groundbait"]),
        capacity: 1,
        capacityProperty: "sections",
        refillable: true,
      }),
    ]),
  }),
});
