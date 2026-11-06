// The keepnet's fill stages (upper percent) and each stage's art by asset id (spec 157 R16).
export const KEEPNET_ART_STAGES = Object.freeze([
  [0, "items.keepnet.keepnet--0"], [20, "items.keepnet.keepnet--20"], [40, "items.keepnet.keepnet--40"],
  [60, "items.keepnet.keepnet--60"], [80, "items.keepnet.keepnet--80"], [100, "items.keepnet.keepnet--100"],
].map(([maxPercent, imageAsset]) => Object.freeze({ maxPercent, imageAsset })));
