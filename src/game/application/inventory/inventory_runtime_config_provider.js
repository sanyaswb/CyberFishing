import { FightPhysicsConfigAdapter } from "../../config/physics/fight_physics_config_adapter.js";

export class InventoryRuntimeConfigProvider {
  #config;
  #physicsConfig;

  constructor(
    config = null,
    physicsConfig = null,
  ) {
    this.#config = config || null;
    this.#physicsConfig =
      physicsConfig ||
      this.#config?.fightPhysicsConfig ||
      this.#createPhysicsConfig(this.#config);
  }

  getReelConfig() {
    return this.#physicsConfig?.getReelConfig?.() || {};
  }

  #createPhysicsConfig(config) {
    if (!config) {
      return null;
    }
    return new FightPhysicsConfigAdapter(config);
  }
}
