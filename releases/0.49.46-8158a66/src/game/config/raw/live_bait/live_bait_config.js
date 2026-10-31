const minute = 60000;
const qualities = {
  simple: { name: "Проста", imageAsset: "items.aquarium-feed-simple", penalty: 5, window: 60, packs: [[500, 30], [1000, 60], [1500, 90]] },
  good: { name: "Хороша", imageAsset: "items.aquarium-feed-good", penalty: 4, window: 180, packs: [[500, 40], [1000, 80], [1500, 120], [3000, 240]] },
  premium: { name: "Преміум", imageAsset: "items.aquarium-feed-premium", penalty: 3, window: 360, packs: [[500, 60], [1000, 120], [1500, 180], [5000, 600]] },
};

const AQUARIUM_FEED_CATALOG = Object.freeze(Object.fromEntries(
  Object.entries(qualities).flatMap(([quality, data]) => data.packs.map(([grams, minutes]) => {
    const id = `aquarium_feed_${quality}_${grams}`;
    return [id, Object.freeze({ id, itemType: "aquarium_feed", quality, grams,
      name: `${data.name} · ${grams} г`, imageAsset: data.imageAsset,
      durationMs: minutes * minute, extraFishPenaltyMs: data.penalty * minute,
      starvationWindowMs: data.window * minute })];
  })),
));

export const LIVE_BAIT_CONFIG = Object.freeze({
  baitId: "live_crucian", // Existing catalog/save identity, shared by every eligible species.
  maxWeightKg: 0.100,
  motionSourceSpeciesId: "crucian_stalker",
  lifetimeMinMs: 30 * 60 * 1000,
  lifetimeMaxMs: 60 * 60 * 1000,
  motionMultiplier: 0.5,
  aquariumFeeds: AQUARIUM_FEED_CATALOG,
  defaultFeedId: "aquarium_feed_simple_500",
  minimumFeedMs: 60000,
  visual: Object.freeze({
    fishSizePx: 60, sizeSpread: 0.25,
    speedMinPxPerSecond: 2, speedMaxPxPerSecond: 6,
    directionMinMs: 1500, directionMaxMs: 5000,
    zone: Object.freeze({ x: 0.09, y: 0.38, width: 0.80, height: 0.33 }),
    showZone: false, gridSizePx: 10,
  }),
  autoFeedTriggerFraction: 0,
  feedReloadRemainingFraction: 0.5,
  freeFeedPortions: 1,
  careTickMs: 10000,
  displayTickMs: 1000,
  capacities: Object.freeze([5, 6, 7, 8, 16, 18, 20, 22, 24, 48]),
  keepnetCapacity: 100,
  prices: Object.freeze({ aquarium: 0, upgrade: 0, feed: 0, autoFeeder: 0 }),
});
