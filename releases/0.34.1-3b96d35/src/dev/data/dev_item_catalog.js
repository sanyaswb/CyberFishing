export const DEV_BUILD_TEMPLATES = {
    debug_float_build: {
      id: "debug_float_build",
      name: "Test Build (Dev)",
      itemType: "build_template",
      rarityProfile: null,
      progressionProfile: null,
      items: [
        { itemId: "rod_test_float", quantity: 1 },
        { itemId: "line_test_1", quantity: 1 },
        { itemId: "float_day", quantity: 1 },
        { itemId: "hook_basic", quantity: 1 },
      ],
    },

    debug_feeder_build: {
      id: "debug_feeder_build",
      name: "Test Build (Dev2)",
      itemType: "build_template",
      rarityProfile: null,
      progressionProfile: null,
      items: [
        { itemId: "rod_test_feeder", quantity: 1 },
        { itemId: "line_test_2", quantity: 1 },
        { itemId: "feeder_spring_basic", quantity: 1 },
        { itemId: "hook_basic", quantity: 1 },
        { itemId: "reel_test", quantity: 1 },
      ],
    },
  };

// Shared production categories retain their catalog owner; only DEV template data is overlaid.
export function createDevItemCatalog(productionCatalog) {
  return {...productionCatalog, builds: {...productionCatalog.builds,...DEV_BUILD_TEMPLATES}};
}
