// What a storm does, the same on every location (spec 180 D3, TK-326): CONFIG.weather.storm. Spec 187 D7: every effect
// is a pair [від, до] — its value at the storm's least visible strength (5 %) and at full strength, linear between, and
// no effect with no storm (engine/math/strength_value.js effectOfPair). gustChanceMult and the rain's multipliers are
// the whole multiplier (×1 — no change); rainDropsShare, rainSlantDeg and windMinStrength add from 0. A location sets
// only how often and how long its storms are (MAP_DB.<id>.weather.storm). DevTools «ПОГОДА» → «ШТОРМ» edits them live.
// `npm run apply:weather` rewrites this whole file in this form (spec 180 stage D).
export const STORM_SETTINGS = {
  "gustChanceMult": [
    1.125,
    3.5
  ],
  "rainChanceMult": [
    1.45,
    10
  ],
  "rainDropsShare": [
    0.03,
    0.6
  ],
  "rainSlantDeg": [
    2.4,
    48
  ],
  "rainStrengthMult": [
    1.015,
    1.3
  ],
  "windMinStrength": [
    0.035,
    0.7
  ]
};
