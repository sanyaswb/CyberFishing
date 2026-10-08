export class ConfigProvider {
  #config;

  constructor(config) {
    this.#config = config;
  }

  get physics() {
    return this.#config.physics || {};
  }
  get fightPhysicsConfig() {
    return this.#config?.fightPhysicsConfig || null;
  }
  get tension() {
    return this.#config.tension || {};
  }
  get stamina() {
    return this.#config.stamina || {};
  }
  get locations() {
    return this.#config.locations || {};
  }
  get ui() {
    return this.#config.ui || {};
  }
  get spawns() {
    return this.#config.spawns || {};
  }
  get debug() {
    return this.#config.debug || {};
  }
  get casting() {
    return this.#config.casting || {};
  }
  get hookMechanics() {
    return this.#config.hookMechanics || {};
  }
  get feederConfig() {
    return this.#config.feederConfig || {};
  }
  get raw() {
    return this.#config;
  }
}
