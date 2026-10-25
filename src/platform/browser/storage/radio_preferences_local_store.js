// Spec 142: the radio's preferences (country, last station, volume, switches) in browser storage. Not game save: none
// of them affects the battery. Power is never stored, so a reload never starts sound by itself (autoplay).
export class RadioPreferencesLocalStore {
  static KEY = "radio_preferences";
  #cache;

  constructor({ cache }) {
    this.#cache = cache;
  }

  load() {
    const raw = this.#cache.get(RadioPreferencesLocalStore.KEY, null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const result = {};
    if (/^[A-Z]{2}$/u.test(raw.country || "")) result.country = raw.country;
    if (typeof raw.stationId === "string" && raw.stationId) result.stationId = raw.stationId;
    if (Number.isFinite(Number(raw.volume))) result.volume = Math.max(0, Math.min(1, Number(raw.volume)));
    for (const key of ["retroMode", "ducking", "playInBackground"]) {
      if (typeof raw[key] === "boolean") result[key] = raw[key];
    }
    return result;
  }

  save(preferences) {
    this.#cache.set(RadioPreferencesLocalStore.KEY, { ...this.load(), ...preferences });
  }
}
