// The starfall's stars and bolide (spec 182): CONFIG.canvas.starfall; how often a starfall night comes is the
// location's (MAP_DB.<id>.weather.starfall). DevTools «ПОГОДА» → «ЗОРЕПАД».
// `npm run apply:weather` rewrites this whole file in this form (spec 189); names and descriptions of the keys:
// src/dev/metadata/parameter_labels.json. Hand edits are fine.
export const STARFALL_SETTINGS = {
  "angleDeg": 35,
  "angleJitterDeg": 12,
  "bolide": {
    "angleDeg": 22,
    "burst": {
      "atShare": [
        0.2,
        0.9
      ],
      "chance": 0.75,
      "color": "#ffffff",
      "flashPx": 90,
      "flashSec": 0.35,
      "particleLifeSec": [
        0.4,
        1.1
      ],
      "particleSizePx": [
        2,
        5
      ],
      "particleSpeedPx": [
        60,
        220
      ],
      "particles": [
        10,
        18
      ],
      "tailFadeSec": 1.4
    },
    "color": "#fff2d6",
    "glowPx": 28,
    "lengthPx": [
      300,
      520
    ],
    "lifeSec": [
      2.2,
      3.4
    ],
    "opacity": 1,
    "speedPx": [
      220,
      380
    ],
    "widthPx": 5
  },
  "color": "#dfe9ff",
  "enabled": true,
  "fadeShare": 0.4,
  "lengthPx": [
    60,
    140
  ],
  "lifeSec": [
    0.4,
    0.9
  ],
  "opacity": 0.9,
  "perMinute": [
    0,
    40
  ],
  "speedPx": [
    500,
    900
  ],
  "widthPx": 2
};
