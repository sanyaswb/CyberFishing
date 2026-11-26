// What an emission does to the player's screen (spec 179 stages E, J; TK-324): darkening, blur, shake —
// CONFIG.emission.screen. DevTools «ПОГОДА» → «ВИКИД».
// `npm run apply:weather` rewrites this whole file in this form (spec 189); names and descriptions of the keys:
// src/dev/metadata/parameter_labels.json. Hand edits are fine.
export const EMISSION_SCREEN_SETTINGS = {
  "blur": {
    "enabled": true,
    "floor": 0.15,
    "irregularity": 0.6,
    "pulsesPerSec": [
      0.42,
      2.85
    ],
    "scene": {
      "quality": 2,
      "resolution": 0.5
    },
    "sharpness": 0.88,
    "strengthPx": 6
  },
  "enabled": true,
  "includeHud": false,
  "shake": {
    "enabled": true,
    "frequencyHz": 14,
    "irregularity": 0.45,
    "joltIntervalSec": [
      5.5,
      1.2
    ],
    "joltPx": [
      3,
      8
    ],
    "joltSec": 0.45,
    "peakBlendSec": 1.5,
    "peakPx": [
      4,
      12
    ],
    "wanderSec": 1.2
  },
  "vignette": {
    "clearRadius": [
      0.95,
      0.15
    ],
    "enabled": true,
    "feather": 0.5,
    "maxDarkness": 0.85,
    "swayAmplitude": 0.06,
    "swayOutShare": 0.55,
    "swayPeriodSec": [
      7,
      3.5
    ]
  }
};
