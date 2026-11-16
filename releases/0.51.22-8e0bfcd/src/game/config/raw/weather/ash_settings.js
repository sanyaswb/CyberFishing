// Fiery ash during an emission (spec 179 stage C, TK-323): CONFIG.canvas.ash reads these; DevTools «ПОГОДА» → «ПОПІЛ»
// edits them live. Sizes and speeds are logical pixels; the count is one screen. Spec 180 D16 (TK-326): `strength` holds
// the values that change with the emission's strength — [at 0, at 100]; a location may override the end at 100
// (MAP_DB.<id>.weather.look.ash). The wind's drift is the wind's (CONFIG.weather.wind.ashDriftPx).
export const ASH_SETTINGS = {
  "enabled": true,
  "sizePx": [2, 10],
  "lifeSec": [3, 8],
  "flicker": 0.35,
  "fadeShare": 0.25,
  "hotColor": "#ffd27a",
  "coolColor": "#ff4a1c",
  "strength": {
    "maxParticles": [20, 160],
    "opacity": [0.5, 0.85],
    "riseSpeedPx": [8, 16],
    "wanderPx": [12, 24]
  }
};
