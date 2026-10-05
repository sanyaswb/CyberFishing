import { CONFIG } from "../../game/config/runtime/game_config.js";
import { FightPhysicsConfigAdapter } from "../../game/config/physics/fight_physics_config_adapter.js";
import { RARITY_VISUAL_CONFIG } from "../../game/presentation/rarity/rarity_visual_config.js";
import { DEGRADATION_COLOR_CONFIG } from "../../game/presentation/visual/degradation_color_config.js";
import { createRuntimeConfigContext } from "./config_context.js";

let configRuntime;

export function createProductionConfigContext() {
  if (configRuntime) return configRuntime;
  CONFIG.rarity.visual = RARITY_VISUAL_CONFIG;
  CONFIG.degradationColors = DEGRADATION_COLOR_CONFIG;
  Object.defineProperty(CONFIG, "fightPhysicsConfig", {
    value: new FightPhysicsConfigAdapter(CONFIG),
    enumerable: false,
    configurable: true,
  });
  configRuntime = createRuntimeConfigContext(CONFIG);
  return configRuntime;
}
