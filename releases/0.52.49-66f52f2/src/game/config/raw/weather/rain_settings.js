// Procedural rain and water-ring settings (spec 172 D4, spec 175): CONFIG.canvas.rain reads them; DevTools
// «🌧 ПОГОДА» edits them live and exports a file; `npm run apply:weather` rewrites this whole file in this form.
// Hand edits are fine.
export const RAIN_SETTINGS = {
  "color": "#c9d6e3",
  "emissionColor": "#c23a2a",
  "enabled": true,
  "fallPx": 520,
  "opacity": 0.4,
  "rings": {
    "color": "#dfe9f2",
    "emissionColor": "#d8573f",
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
  "speedStretch": 0.5,
  "strength": {
    "lengthJitter": [
      0.08,
      0.2
    ],
    "lengthPx": [
      70,
      103
    ],
    "maxDrops": [
      80,
      700
    ],
    "minScale": [
      0.4,
      0.4
    ],
    "slantJitterDeg": [
      0.5,
      2.5
    ],
    "speedPx": [
      1200,
      1500
    ],
    "widthPx": [
      4.5,
      6.3
    ]
  }
};
