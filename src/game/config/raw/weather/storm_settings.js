// What a storm does, the same on every location (spec 180 D3, TK-326): CONFIG.weather.storm. Every effect is scaled by
// the storm's strength (0…1), so a weak storm changes little. A location sets only how often and how long its storms
// are (MAP_DB.<id>.weather.storm). DevTools «ПОГОДА» → «ШТОРМ» edits them live.
export const STORM_SETTINGS = {
  "gustChanceMult": 2.5,
  "rainChanceMult": 6,
  "rainDropsShare": 0.6,
  "rainSlantDeg": 48,
  "rainStrengthMult": 1.3,
  "windMinStrength": 0.7
};
