// How the wind acts, the same on every location (spec 180 D3, TK-326): CONFIG.weather.wind. The drops' slant and the
// ash's drift come from the wind (owner: the wind moves the drops); a gust's shape is here, how often gusts come is the
// location's (MAP_DB.<id>.weather.wind.gust.chancePerSec); the rain's effect on the wind is under `rain`. DevTools
// «ПОГОДА» → «ВІТЕР» edits them live. `npm run apply:weather` rewrites this whole file in this form (spec 180 stage D).
export const WIND_SETTINGS = {
  "ashDriftPx": 90,
  "gust": {
    "attackShare": 0.25,
    "deltaRange": [
      0.12,
      0.3
    ],
    "durationSec": [
      1.5,
      4.5
    ]
  },
  "gustFollowPerSec": 6,
  "gustSlantShare": 1.2,
  "rain": {
    "bonus": 0.2,
    "gustChanceMult": 1.5,
    "minStrength": 0.25
  },
  "rainSlantDeg": 34,
  "slantFollowPerSec": 2
};
