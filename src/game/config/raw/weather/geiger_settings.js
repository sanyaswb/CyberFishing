// The Geiger counter's clicks (spec 179 stage D, TK-339): CONFIG.ui.audio.geiger. DevTools «ПОГОДА» → «РАДІАЦІЯ» →
// «Звук лічильника».
// `npm run apply:weather` rewrites this whole file in this form (spec 189); names and descriptions of the keys:
// src/dev/metadata/parameter_labels.json. Hand edits are fine.
export const GEIGER_SETTINGS = {
  "clickMs": 4,
  "clicksPerSec": [
    1,
    40
  ],
  "enabled": true,
  "fromRadiation": 0.05,
  "toneHz": 3500,
  "volume": 0.4
};
