// Fiery ash during an emission (spec 179 stage C, TK-323): CONFIG.canvas.ash reads these; DevTools «ПОГОДА» → «ПОПІЛ»
// edits them live. Sizes and speeds are logical pixels; the count is one screen. Spec 180 D16 (TK-326): `strength` holds
// the values that change with the emission's strength — [at 0, at 100]; a location may override the end at 100
// (MAP_DB.<id>.weather.look.ash). The wind's drift is the wind's (CONFIG.weather.wind.ashDriftPx).
// `npm run apply:weather` rewrites this whole file in this form (spec 180 stage D).
export const ASH_SETTINGS = {
  "coolColor": "#ff4a1c",
  "enabled": true,
  "fadeShare": 0.25,
  "flicker": 0.35,
  "followsWind": true,
  "hotColor": "#ffd27a",
  "lifeSec": [
    3,
    8
  ],
  "sizePx": [
    2,
    10
  ],
  "strength": {
    "maxParticles": [
      20,
      160
    ],
    "opacity": [
      0.5,
      0.85
    ],
    "riseSpeedPx": [
      8,
      16
    ],
    "wanderPx": [
      12,
      24
    ]
  },
  "windFollowPerSec": 1.5
};
