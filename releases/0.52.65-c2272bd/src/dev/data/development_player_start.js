// Spec 184 D6 (TK-377, owner Q1, Q2): what a new player starts with on dev.html — every test item (the starting set
// before spec 184) plus 10 vodka bottles (one stack), a gas mask and its filters (spec 185); production starts with
// CONFIG.player's short set.
// oneTimeGrants give the bottles and the mask once to a DEV save made before them (evenIfHeld: also when the save
// already has some); a new DEV player has them in the set, so the grants are only marked. DEV composes it into
// GameCompositionRoot (playerStart); production never reads this module.
export const DEVELOPMENT_PLAYER_START = Object.freeze({
  equipment: {
    rodId: "uuid-rod-float",
    reelId: null,
    terminalLineId: "uuid-line",
    tackleId: "uuid-hook",
    floatId: "uuid-float",
    handChumId: null,
    netId: "uuid-net",
    deliveryId: null,
    gasMaskId: null,
  },

  assemblies: [
    {
      rootInstanceId: "uuid-hook",
      profileId: "hook_standard",
      status: "PREPARED",
      refillSignatures: {},
    },
  ],

  inventory: [
    { instanceId: "uuid-rod-spin", itemId: "rod_test_spin", quantity: 1 },
    { instanceId: "uuid-rod-feeder", itemId: "rod_test_feeder", quantity: 1 },
    { instanceId: "uuid-rod-float", itemId: "rod_test_float", quantity: 1 },
    { instanceId: "uuid-reel", itemId: "reel_test", quantity: 1 },
    { instanceId: "uuid-reel-nodrag", itemId: "reel_bolognese_nodrag", quantity: 1 },
    { instanceId: "uuid-line", itemId: "line_test_1", quantity: 1 },
    { instanceId: "uuid-line-2", itemId: "line_test_2", quantity: 1 },
    { instanceId: "uuid-line-3", itemId: "line_test_3", quantity: 1 },
    { instanceId: "uuid-leader", itemId: "leader_test_025", quantity: 1 },
    { instanceId: "uuid-hook", itemId: "hook_basic", quantity: 1 },
    { instanceId: "uuid-live-crucian", itemId: "live_crucian", quantity: 1 },
    { instanceId: "uuid-spring", itemId: "feeder_spring_basic", quantity: 1 },
    {
      instanceId: "uuid-worm-attached",
      itemId: "oil_worm",
      quantity: 1,
      location: { kind: "ATTACHED", parentInstanceId: "uuid-hook", slotId: "bait", slotIndex: 0 },
    },
    { instanceId: "uuid-worm", itemId: "oil_worm", quantity: 50 },
    { instanceId: "uuid-worm-25", itemId: "oil_worm_25", quantity: 25 },
    { instanceId: "uuid-worm-50", itemId: "oil_worm_50", quantity: 50 },
    { instanceId: "uuid-worm-75", itemId: "oil_worm_75", quantity: 75 },
    { instanceId: "uuid-worm-100", itemId: "oil_worm_100", quantity: 100 },
    { instanceId: "uuid-bread", itemId: "bread", quantity: 25 },
    { instanceId: "uuid-bread-10", itemId: "bread_10", quantity: 10 },
    { instanceId: "uuid-bread-25", itemId: "bread_25", quantity: 25 },
    { instanceId: "uuid-bread-50", itemId: "bread_50", quantity: 50 },
    { instanceId: "uuid-spinner", itemId: "test_spinner", quantity: 1 },
    { instanceId: "uuid-wob-susp", itemId: "test_wobbler_suspend", quantity: 1 },
    { instanceId: "uuid-wob-sink", itemId: "test_wobbler_sinking", quantity: 1 },
    { instanceId: "uuid-jig", itemId: "test_jig", quantity: 1 },
    { instanceId: "uuid-float", itemId: "float_day", quantity: 1 },
    { instanceId: "uuid-float-night", itemId: "float_night", quantity: 1 },
    { instanceId: "uuid-float-sliding", itemId: "float_sliding", quantity: 1 },
    { instanceId: "uuid-net", itemId: "net_basic", quantity: 1 },
    { instanceId: "uuid-chum", itemId: "carp_mix_basic", quantity: 15 },
    { instanceId: "uuid-chum-25", itemId: "carp_mix_basic_25", quantity: 25 },
    { instanceId: "uuid-chum-50", itemId: "carp_mix_basic_50", quantity: 50 },
    { instanceId: "uuid-chum-100", itemId: "carp_mix_basic_100", quantity: 100 },
    { instanceId: "uuid-boat", itemId: "boat_lvl3", quantity: 1 },
    { instanceId: "uuid-battery", itemId: "battery_basic", quantity: 1 },
    { instanceId: "uuid-battery-2", itemId: "battery_volt_2", quantity: 1 },
    { instanceId: "uuid-battery-3", itemId: "battery_volt_3", quantity: 1 },
    { instanceId: "uuid-battery-4", itemId: "battery_volt_4", quantity: 1 },
    { instanceId: "uuid-radio", itemId: "radio_receiver_basic", quantity: 1 },
    { instanceId: "uuid-backpack", itemId: "backpack_basic", quantity: 1 },
    // Spec 184 Q1, Q2 (owner): «тільки в dev режимі 10 горілок, і 1 протигаз».
    { instanceId: "uuid-vodka", itemId: "vodka_bottle", quantity: 10 },
    { instanceId: "uuid-gas-mask", itemId: "gas_mask_basic", quantity: 1 },
    // Spec 185 D10 (TK-381): two of each filter (a filter keeps its own time left once used).
    { instanceId: "uuid-gas-filter-coal", itemId: "gas_filter_coal", quantity: 2 },
    { instanceId: "uuid-gas-filter-ash", itemId: "gas_filter_ash", quantity: 2 },
  ],

  oneTimeGrants: [
    { id: "spec184-dev-vodka", itemId: "vodka_bottle", quantity: 10, evenIfHeld: true },
    { id: "spec184-dev-gas-mask", itemId: "gas_mask_basic", quantity: 1 },
    { id: "spec185-dev-gas-filter-coal", itemId: "gas_filter_coal", quantity: 2 },
    { id: "spec185-dev-gas-filter-ash", itemId: "gas_filter_ash", quantity: 2 },
  ],
});
