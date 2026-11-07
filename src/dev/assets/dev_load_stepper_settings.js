const STORAGE_KEY = "cyber-fishing:dev-load-stepper";

// Whether dev.html starts in the step-by-step loading mode (spec 167): kept in local storage, read once at the start.
export class DevLoadStepperSettings {
  #cache;

  // cache: LocalStorageCache.
  constructor({ cache }) {
    this.#cache = cache;
  }

  isEnabled() {
    return this.#cache.get(STORAGE_KEY, false) === true;
  }

  setEnabled(enabled) {
    if (enabled) this.#cache.set(STORAGE_KEY, true);
    else this.#cache.remove(STORAGE_KEY);
  }
}
