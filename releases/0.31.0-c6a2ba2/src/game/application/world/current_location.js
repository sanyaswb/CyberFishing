export class CurrentLocation {
  #locationsConfig;
  #currentId;

  constructor(locationsConfig, initialId = null) {
    this.#locationsConfig = locationsConfig;
    this.#currentId =
      initialId ||
      locationsConfig.currentLocationId ||
      Object.keys(locationsConfig.map || {})[0];
  }

  get id() {
    return this.#currentId;
  }

  get config() {
    return this.#locationsConfig.map[this.#currentId];
  }

  get currentEnvironment() {
    return this.config?.environment || null;
  }

  get chumCastDistance() {
    return this.config?.chumCastDistance || 300;
  }
}
