import { CONFIG } from "../../game/config/runtime/game_config.js";
import { FightPhysicsConfigAdapter } from "../../game/config/physics/fight_physics_config_adapter.js";
import { RARITY_VISUAL_CONFIG } from "../../game/presentation/rarity/rarity_visual_config.js";
import { DEGRADATION_COLOR_CONFIG } from "../../game/presentation/visual/degradation_color_config.js";
import { createRuntimeConfigContext } from "./config_context.js";
import { InventorySelectorConfigValidator } from "../../game/config/validation/inventory_selector_config_validator.js";

let configRuntime;

export function createProductionConfigContext(initializeBase = null) {
  if (configRuntime) return configRuntime;
  initializeBase?.(CONFIG);
  CONFIG.rarity.visual = RARITY_VISUAL_CONFIG;
  CONFIG.degradationColors = DEGRADATION_COLOR_CONFIG;
  Object.defineProperty(CONFIG, "fightPhysicsConfig", {
    // Normalized physics settings are recomputed only when a runtime override changes the config.
    value: new FightPhysicsConfigAdapter(CONFIG, { revision: () => configRuntime?.overrideStore.revision ?? -1 }),
    enumerable: false,
    configurable: true,
  });
  configRuntime = createRuntimeConfigContext(CONFIG, {
    catalogs: {"locations.map": CONFIG.locations.map, "rarity.visual": CONFIG.rarity.visual, "degradationColors": CONFIG.degradationColors, "spawns.fishes": CONFIG.spawns.fishes},
    validateOverrides: InventorySelectorConfigValidator.validateOverrides,
    resetOnImport: ["ui.inventorySelector.radialEnabled", "ui.inventorySelector.size", "ui.inventorySelector.openSize"],
  });
  return configRuntime;
}
