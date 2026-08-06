/**
 * Single source of truth for rarity colors and visual effects.
 * Domain rarity descriptors intentionally contain no visual values.
 */
const RARITY_VISUAL_CONFIG = {
  colorStops: [
    { id: "common", position: 0, color: [145, 150, 160] },
    { id: "uncommon", position: 0.2, color: [0, 210, 120] },
    { id: "rare", position: 0.4, color: [0, 160, 255] },
    { id: "epic", position: 0.6, color: [170, 100, 255] },
    { id: "legendary", position: 0.8, color: [255, 70, 70] },
    { id: "unique", position: 1, color: [255, 205, 55] },
  ],
  frame: {
    borderWidth: 1.5,
    backgroundAlpha: 0.15,
    panelGlow: 20,
    panelGlowAlpha: 0.35,
    strokeAlpha: 0.75,
  },
  uniqueEffects: {
    itemGlowEnabled: false,
    pulseDurationMs: 1200,
    frameDash: [12, 7],
    frameDashSpeedPxPerSecond: 22.222,
    borderWidthMin: 2.5,
    borderWidthMax: 3.5,
    panelGlowMin: 30,
    panelGlowMax: 52,
    panelGlowAlpha: 0.35,
    imageGlowMin: 14,
    imageGlowMax: 32,
    imageGlowAlpha: 0.95,
    backgroundAlphaMin: 0.18,
    backgroundAlphaMax: 0.3,
    strokeAlpha: 0.75,
  },
};
