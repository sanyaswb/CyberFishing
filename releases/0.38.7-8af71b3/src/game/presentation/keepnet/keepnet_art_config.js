export const KEEPNET_ART_STAGES = Object.freeze(
  [0, 20, 40, 60, 80, 100].map((maxPercent) => Object.freeze({
    maxPercent,
    imagePath: `assets/items/keepnet/keepnet--${maxPercent}.webp`,
  })),
);
