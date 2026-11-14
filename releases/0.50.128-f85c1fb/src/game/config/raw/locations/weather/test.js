// Weather of the location "test" (spec 172, spec 175): precipitation clear -> rain -> storm (storm only after rain),
// fog and lightning. `npm run apply:weather` rewrites this whole file in this form; hand edits are fine.
export const WEATHER = {
  "fog": {
    "chance": 0.15,
    "durationSec": [
      120,
      600
    ],
    "fadeInSec": 30,
    "fadeOutSec": 45,
    "idleSec": [
      120,
      600
    ],
    "intensity": [
      0.4,
      1
    ],
    "phases": [
      "morning",
      "night"
    ]
  },
  "lightning": {
    "distance": [
      0.2,
      1
    ],
    "intervalSec": [
      25,
      6
    ]
  },
  "precipitation": {
    "clear": {
      "durationSec": [
        180,
        900
      ],
      "weight": 0.7
    },
    "fadeInSec": 20,
    "fadeOutSec": 30,
    "rain": {
      "durationSec": [
        60,
        600
      ],
      "intensity": [
        0.3,
        0.8
      ],
      "weight": 0.25
    },
    "storm": {
      "durationSec": [
        60,
        240
      ],
      "intensity": [
        0.6,
        1
      ],
      "weight": 0.3
    }
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
      "attackShare": 0.25,
      "chancePerSec": 0.14,
      "deltaRange": [
        0.12,
        0.3
      ],
      "durationSec": [
        1.5,
        4.5
      ],
      "rainChanceMult": 1.5,
      "stormChanceMult": 2.5
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
    },
    "weatherBoost": {
      "rainBonus": 0.2,
      "rainMinStrength": 0.25,
      "stormMinStrength": 0.7
    }
  }
};
