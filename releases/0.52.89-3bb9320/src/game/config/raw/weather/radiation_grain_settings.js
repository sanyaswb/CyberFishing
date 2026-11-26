// The radiation's hiss over the scene (spec 179 stage D, TK-338): CONFIG.canvas.radiationGrain. DevTools «ПОГОДА» →
// «РАДІАЦІЯ» → «Шипіння».
// `npm run apply:weather` rewrites this whole file in this form (spec 189); names and descriptions of the keys:
// src/dev/metadata/parameter_labels.json. Hand edits are fine.
export const RADIATION_GRAIN_SETTINGS = {
  "edges": {
    "centerShare": 0.25,
    "clearRadius": 0.3,
    "feather": 0.6
  },
  "enabled": true,
  "fps": 24,
  "fromRadiation": 0.05,
  "grainPx": 2,
  "maxOpacity": 0.3
};
