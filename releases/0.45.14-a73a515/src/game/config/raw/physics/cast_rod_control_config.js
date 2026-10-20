export const CAST_ROD_CONTROL_CONFIG = {
  enabled: true,
  range: { leftRatio: 1, rightRatio: 1, edgePaddingPx: 0 },
  speedPxPerSecond: 100,
  speedMultipliers: { stationaryFloat: 3, movingFloat: 1 },
  movementEpsilonPx: 0.001,
  floatDrag: { enabled: true, movementEpsilonMeters: 0.00001 },
  lineTension: { enabled: true },
  floatTilt: { enabled: true },
  biteReaction: { enabled: true, releaseNormalBite: true, hookGuaranteedBite: true },
  movingFloatBite: { enabled: true, chance: 0.001, excludeSpinning: true },
};
