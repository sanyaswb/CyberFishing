const STORAGE_KEY = "cyber-fishing:dev-weather-manual";

// Spec 187 D21 (owner: «запам'ятовувати (тільки в dev)»): whether dev.html starts with «Автоматична погода» off — kept in
// local storage; DevFlagsProvider tells the composition («frozenWeather»), the DevTools switch writes it.
export class DevWeatherSettings {
  #cache;

  // cache: LocalStorageCache.
  constructor({ cache }) {
    this.#cache = cache;
  }

  // true — the automatic weather off (the weather frozen, set by hand).
  isManual() {
    return this.#cache.get(STORAGE_KEY, false) === true;
  }

  setAutomatic(on) {
    if (on === false) this.#cache.set(STORAGE_KEY, true);
    else this.#cache.remove(STORAGE_KEY);
  }
}
