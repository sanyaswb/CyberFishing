// The water's waves, the sea state and the float's rocking on the WebGL scene (spec 106, 128, 172 D7, 187 C):
// CONFIG.canvas.water. Lengths are art pixels. DevTools «ПОГОДА» → «ВОДА».
// `npm run apply:weather` rewrites this whole file in this form (spec 189); names and descriptions of the keys:
// src/dev/metadata/parameter_labels.json. Hand edits are fine.
export const WATER_SETTINGS = {
  "amplitude": 20,
  "enabled": true,
  "floatRocking": {
    "ballastCalm": 0.5,
    "ballastSlow": 0.3,
    "biteShare": 0.5,
    "bobPx": 8,
    "enabled": true,
    "landingBoost": 3,
    "landingSettleSec": 1.5,
    "lyingTurnDeg": 10,
    "periodSec": 2,
    "rainShare": 0.3,
    "swayPx": 3,
    "waveTempoShare": 1,
    "windShare": 0.5
  },
  "frameRate": 30,
  "lateralContraction": true,
  "seaState": {
    "enabled": true,
    "normal": {
      "calmAmplitude": 0.55,
      "nightAmplitude": 0.5,
      "windAmplitude": [
        0.58,
        1.15
      ],
      "windSpeed": [
        1.0125,
        1.25
      ]
    },
    "smoothingSec": 6,
    "storm": {
      "amplitude": [
        1.05,
        2
      ],
      "speed": [
        1.03,
        1.6
      ],
      "wavelength": [
        1.015,
        1.3
      ]
    }
  },
  "speed": 40,
  "variation": {
    "breath": 0.3,
    "breathSec": 6,
    "dispersion": 1,
    "enabled": true,
    "groupDepth": 0.35,
    "groupScale": 6,
    "groupSpeed": 0.5
  },
  "verticalShare": 1,
  "wavelength": 200,
  "waves": true
};
