// Weather of the location "test" (spec 172, 175, 180): independent events rain, storm (with its lightning) and fog,
// each a check + chance and a timeline rolled at its start. `npm run apply:weather` rewrites this whole file in this form.
export const WEATHER = {
  "emission": {
    "chanceGrowthPerCheck": 0.003,
    "chancePerCheck": 0.002,
    "checkIntervalSec": 60,
    "cooldownSec": 1200,
    "durationSec": [
      240,
      480
    ],
    "enabled": true,
    "peakAtShare": [
      0.2,
      0.35
    ],
    "peakShare": [
      0.35,
      0.5
    ],
    "peakStrength": [
      1,
      1
    ],
    "storm": {
      "storm": 0.9
    }
  },
  "fog": {
    "chanceGrowthPerCheck": 0,
    "chancePerCheck": 0.004,
    "checkIntervalSec": 600,
    "cooldownSec": 3600,
    "durationSec": [
      3600,
      10800
    ],
    "enabled": true,
    "hours": [
      {
        "chanceMult": 4,
        "fromHour": 4,
        "toHour": 7
      },
      {
        "chanceMult": 3,
        "fromHour": 19,
        "toHour": 24
      }
    ],
    "peakAtShare": [
      0.15,
      0.35
    ],
    "peakShare": [
      0.3,
      0.6
    ],
    "peakStrength": [
      0.4,
      1
    ],
    "rainBoost": {
      "max": 4,
      "perRain": 0.5
    },
    "smoothSec": 10
  },
  "initial": {
    "fog": 0,
    "rain": 0,
    "storm": 0
  },
  "look": {
    "ash": {},
    "rain": {}
  },
  "radiation": {
    "base": 0,
    "emissionPeak": 1
  },
  "rain": {
    "chanceGrowthPerCheck": 0.001,
    "chancePerCheck": 0.02,
    "checkIntervalSec": 60,
    "cooldownSec": 300,
    "durationSec": [
      180,
      900
    ],
    "enabled": true,
    "peakAtShare": [
      0.15,
      0.45
    ],
    "peakShare": [
      0.15,
      0.45
    ],
    "peakStrength": [
      0.3,
      0.85
    ],
    "smoothSec": 6
  },
  "starfall": {
    "blendShare": 0.35,
    "bolideChance": 0.03,
    "enabled": true,
    "fromHour": 21,
    "maxStrength": 1,
    "nightChance": 0.35,
    "periods": [
      3,
      6
    ],
    "quietChance": 0.25,
    "toHour": 5
  },
  "storm": {
    "chanceGrowthPerCheck": 0.00005,
    "chancePerCheck": 0.0015,
    "checkIntervalSec": 60,
    "cooldownSec": 1800,
    "durationSec": [
      480,
      1500
    ],
    "enabled": true,
    "lightning": {
      "chance": 0.7,
      "distance": [
        0.2,
        1
      ],
      "endShare": [
        0.5,
        0.95
      ],
      "intervalSec": [
        25,
        6
      ],
      "jitter": 0.5,
      "startShare": [
        0,
        0.3
      ]
    },
    "peakAtShare": [
      0.2,
      0.5
    ],
    "peakShare": [
      0.1,
      0.35
    ],
    "peakStrength": [
      0.4,
      1
    ],
    "smoothSec": 6
  },
  "thresholds": {
    "fog": 0.3,
    "rain": 0.15
  },
  "wind": {
    "fadeSec": 14,
    "float": {
      "amplitudeJitter": [
        0.8,
        1.15
      ],
      "cycleDurationSec": [
        0.45,
        1.35
      ],
      "maxAngleDeg": 38,
      "returnPctRange": [
        0.15,
        0.45
      ]
    },
    "gust": {
      "chancePerSec": 0.14
    },
    "states": {
      "calm": {
        "durationSec": [
          90,
          300
        ],
        "strength": [
          0,
          0
        ],
        "weight": 0.2
      },
      "light": {
        "durationSec": [
          60,
          240
        ],
        "strength": [
          0.15,
          0.35
        ],
        "weight": 0.4
      },
      "moderate": {
        "durationSec": [
          60,
          200
        ],
        "strength": [
          0.4,
          0.65
        ],
        "weight": 0.28
      },
      "strong": {
        "durationSec": [
          45,
          150
        ],
        "strength": [
          0.7,
          0.9
        ],
        "weight": 0.12
      }
    }
  }
};
