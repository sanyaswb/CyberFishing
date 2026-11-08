export class GameTimeLocalStore {
  #storage;
  #key;

  constructor(storage, key = "cyber_fishing_game_time_v1") {
    this.#storage = storage;
    this.#key = key;
  }

  load() {
    try {
      const value = JSON.parse(this.#storage.getItem(this.#key));
      if (value?.version !== 1 || !Number.isFinite(value.anchorMs) ||
        !Number.isFinite(value.anchorHours) || value.anchorHours < 0 || value.anchorHours >= 24 ||
        !Number.isFinite(value.timeScale) || value.timeScale <= 0) return null;
      // Spec 152: monotonic game time; saves without it derive it from the hour (GameTimeClock).
      if (value.anchorGameMs !== undefined && !(Number.isFinite(value.anchorGameMs) && value.anchorGameMs >= 0)) {
        delete value.anchorGameMs;
      }
      return value;
    } catch { return null; }
  }

  save(value) {
    try { this.#storage.setItem(this.#key, JSON.stringify({ version: 1, ...value })); }
    catch { /* The current page can still use an in-memory clock. */ }
  }
}
