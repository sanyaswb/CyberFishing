// Game data in browser storage under one key prefix; read and write failures are reported and absorbed.
export class LocalStorageCache {
  static PREFIX = "fishing_game_";
  #storage;
  #logger;

  // storage: the browser Storage (window.localStorage); logger: the platform console logger.
  constructor({ storage, logger }) {
    this.#storage = storage;
    this.#logger = logger;
  }

  set(key, value) {
    try {
      this.#storage.setItem(LocalStorageCache.PREFIX + key, JSON.stringify(value));
    } catch (e) {
      this.#logger.warn(
        "[LocalStorageCache] Помилка збереження в кеш. Можливо, перевищено ліміт 5MB:",
        e,
      );
    }
  }

  get(key, defaultValue = null) {
    try {
      const item = this.#storage.getItem(LocalStorageCache.PREFIX + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      this.#logger.warn("[LocalStorageCache] Помилка читання з кешу:", e);
      return defaultValue;
    }
  }

  remove(key) {
    this.#storage.removeItem(LocalStorageCache.PREFIX + key);
  }

  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < this.#storage.length; i++) {
      const key = this.#storage.key(i);
      if (key.startsWith(LocalStorageCache.PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => this.#storage.removeItem(k));
    this.#logger.log("[LocalStorageCache] Весь кеш гри очищено.");
  }

  printStorageUsage() {
    let totalBytes = 0;

    for (let i = 0; i < this.#storage.length; i++) {
      const key = this.#storage.key(i);
      const value = this.#storage.getItem(key);

      totalBytes += (key.length + value.length) * 2;
    }

    const kb = (totalBytes / 1024).toFixed(2);
    const mb = (totalBytes / (1024 * 1024)).toFixed(3);
    const limitMb = 5.0;
    const percentage = ((totalBytes / (limitMb * 1024 * 1024)) * 100).toFixed(
      2,
    );

    let color = "#00ff80";
    if (percentage > 70) color = "#ffaa00";
    if (percentage > 90) color = "#ff4444";

    this.#logger.log(
      `%c💾 [LocalStorageCache] Використано: ${kb} KB (${mb} MB) з ~${limitMb} MB | Заповнено на ${percentage}%`,
      `color: ${color}; font-weight: bold; font-family: monospace;`,
    );
  }
}
