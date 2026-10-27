// Spec 142: the radio's preferences (country, last station, volume, switches) in browser storage. Not game save: none
// of them affects the battery. Power is never stored, so a reload never starts sound by itself (autoplay).
export class RadioPreferencesLocalStore {
  static KEY = "radio_preferences";
  // TK-100: whether a station played with the effects (its server sends CORS), at most STATION_LIMIT, newest last.
  static STATIONS_KEY = "radio_station_effects";
  static STATION_LIMIT = 500;
  #cache;

  constructor({ cache }) {
    this.#cache = cache;
  }

  load() {
    const raw = this.#cache.get(RadioPreferencesLocalStore.KEY, null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const result = {};
    if (/^[A-Z]{2}$/u.test(raw.country || "")) result.country = raw.country;
    if (typeof raw.channelMode === "string" && ["volia", "world"].includes(raw.channelMode)) {
      result.channelMode = raw.channelMode;
    }
    if (typeof raw.stationId === "string" && raw.stationId) result.stationId = raw.stationId;
    if (Number.isInteger(raw.voliaTrackIndex) && raw.voliaTrackIndex >= 0) result.voliaTrackIndex = raw.voliaTrackIndex;
    if (Number.isInteger(raw.customTrackIndex) && raw.customTrackIndex >= 0) result.customTrackIndex = raw.customTrackIndex;
    if (Number.isFinite(Number(raw.volume))) result.volume = Math.max(0, Math.min(1, Number(raw.volume)));
    for (const key of ["ducking", "playInBackground", "walkieTalkie", "vinyl"]) {
      if (typeof raw[key] === "boolean") result[key] = raw[key];
    }
    return result;
  }

  save(preferences) {
    this.#cache.set(RadioPreferencesLocalStore.KEY, { ...this.load(), ...preferences });
  }

  // { [stationId]: true (effects) | false (native only) }.
  loadStationEffects() {
    const raw = this.#cache.get(RadioPreferencesLocalStore.STATIONS_KEY, null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([id, value]) => id && typeof value === "boolean"));
  }

  saveStationEffect(stationId, effects) {
    if (!stationId) return;
    const stations = this.loadStationEffects();
    delete stations[stationId];
    stations[stationId] = effects === true;
    const ids = Object.keys(stations);
    for (const id of ids.slice(0, Math.max(0, ids.length - RadioPreferencesLocalStore.STATION_LIMIT))) delete stations[id];
    this.#cache.set(RadioPreferencesLocalStore.STATIONS_KEY, stations);
  }
}
