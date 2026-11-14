// Procedural rain and water-ring settings (spec 172 D4, spec 175): CONFIG.canvas.rain reads them; DevTools
// «🌧 ПОГОДА» edits them live and exports a file; `npm run apply:weather` rewrites this whole file in this form.
// Hand edits are fine.
export const RAIN_SETTINGS = {
  "color": "#c9d6e3",
  "enabled": true,
  "fallPx": 520,
  "lengthPx": 103,
  "maxDrops": 700,
  "minScale": 0.4,
  "opacity": 0.4,
  "rings": {
    "color": "#dfe9f2",
    "enabled": true,
    "flatten": 0.35,
    "lifeSec": 0.7,
    "maxRings": 300,
    "opacity": 0.4,
    "ripple": {
      "enabled": true,
      "radiusScale": 1.2,
      "strength": 0.25
    },
    "sizePx": 65
  },
  "speedJitter": 0.15,
  "speedPx": 1500,
  "stormDropsShare": 0.6,
  "stormSlantDeg": 48,
  "widthPx": 6.3,
  "windSlantDeg": 34
};
