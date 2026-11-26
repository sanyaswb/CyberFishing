// The procedural lightning's look (spec 188): CONFIG.canvas.lightning. DevTools «ПОГОДА» → «ШТОРМ» → «Блискавка — вигляд».
// `npm run apply:weather` rewrites this whole file in this form (spec 189); names and descriptions of the keys:
// src/dev/metadata/parameter_labels.json. Hand edits are fine.
export const LIGHTNING_SETTINGS = {
  "afterglow": 0.15,
  "branchAngleDeg": [
    18,
    63
  ],
  "branchFadeSec": 0.18,
  "branchLengthShare": [
    0.2,
    0.45
  ],
  "branchWidthShare": 0.55,
  "branches": [
    2,
    5
  ],
  "cloudGlowOpacity": 0.35,
  "cloudGlowPx": 140,
  "coreColor": "#ffffff",
  "coreOpacity": 1,
  "coreWidthPx": 2.2,
  "driftShare": [
    0.08,
    0.3
  ],
  "durationSec": [
    0.9,
    2.1
  ],
  "enabled": true,
  "far": {
    "lengthShare": 0.45,
    "opacityShare": 0.45,
    "widthShare": 0.5
  },
  "generations": 6,
  "glowColor": "#a9b8ff",
  "glowOpacity": 0.45,
  "glowWidthPx": 14,
  "roughness": 0.28,
  "strokeDecaySec": 0.06,
  "strokeLevel": [
    0.55,
    1
  ],
  "strokes": [
    2,
    4
  ],
  "strokesShare": 0.6
};
