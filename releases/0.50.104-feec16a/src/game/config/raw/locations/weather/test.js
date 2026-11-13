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
  }
};
