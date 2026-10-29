// The radio's sound settings (spec 142, TK-097..099): the effects chain and the signal's interference. CONFIG.radio
// reads them; DevTools «📻 РАДІО» edits them live and exports a file; `npm run apply:radio` rewrites this whole file
// in this form. Hand edits are fine.
export const RADIO_SOUND_SETTINGS = {
  "effects": {
    "rampSeconds": 0.03,
    "retro": {
      "drive": 2,
      "enabled": false,
      "highpassHz": 80,
      "lowpassHz": 6000,
      "mix": 1,
      "outputGain": 1,
      "presenceGainDb": 2,
      "presenceHz": 2000,
      "warmthGainDb": 3.5,
      "warmthHz": 220
    },
    "vinyl": {
      "crackleLevel": 0.12,
      "dryGramophone": 5,
      "enabled": false,
      "noiseLevel": 0.15,
      "oldSpeaker": 0,
      "popLevel": 0.35,
      "sfx": {
        "vinyl-1": {
          "enabled": false,
          "volume": 0.5
        },
        "vinyl-2": {
          "enabled": false,
          "volume": 0.5
        },
        "vinyl-3": {
          "enabled": false,
          "volume": 0.5
        },
        "vinyl-4": {
          "enabled": false,
          "volume": 0.5
        },
        "vinyl-5": {
          "enabled": false,
          "volume": 0.5
        },
        "vinyl-6": {
          "enabled": false,
          "volume": 0.5
        }
      },
      "softVinyl": 0
    },
    "walkieTalkie": {
      "drive": 18,
      "enabled": true,
      "highpassHz": 500,
      "lowpassHz": 3000,
      "mix": 1,
      "outputGain": 1,
      "oversample": "4x",
      "peakGainDb": 8,
      "peakHz": 1800,
      "peakQ": 2.5
    }
  },
  "signal": {
    "baseNoise": 0.01,
    "dropoutMax": 0.5,
    "dropoutMs": [
      500,
      2500
    ],
    "enabled": true,
    "lowChargePercent": 25,
    "maxCrackle": 6,
    "maxNoise": 0.3,
    "maxVolumeSag": 0.35,
    "weather": {
      "enabled": true,
      "rainCrackle": 2,
      "rainMultMax": 2.5,
      "rainNoise": 0.12
    }
  }
};
