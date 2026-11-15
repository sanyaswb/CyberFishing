// Fiery ash during an emission (spec 179 stage C, TK-323): CONFIG.canvas.ash reads these; DevTools «ПОГОДА» → «Вигляд
// попелу» edits them live. Sizes and speeds are logical pixels; the count is one screen at the emission's full strength.
export const ASH_SETTINGS = {
  "enabled": true,
  "maxParticles": 160,
  "sizePx": [2, 10],
  "lifeSec": [3, 8],
  "riseSpeedPx": 16,
  "wanderPx": 24,
  "windDriftPx": 45,
  "opacity": 0.85,
  "flicker": 0.35,
  "fadeShare": 0.25,
  "hotColor": "#ffd27a",
  "coolColor": "#ff4a1c",
};
