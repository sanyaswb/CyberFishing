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
      this.#config?.fightPhysicsConfig;
  }

  getReelConfig() {
    return this.#physicsConfig?.getReelConfig?.() || {};
  }
}
