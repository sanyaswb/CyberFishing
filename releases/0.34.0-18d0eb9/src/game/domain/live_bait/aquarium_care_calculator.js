export class AquariumCareCalculator {
  #config;
  constructor(config) { this.#config = config; }
  duration(itemId, count) {
    const item = this.#config.aquariumFeeds[itemId];
    return Math.max(this.#config.minimumFeedMs,
      item.durationMs - item.extraFishPenaltyMs * Math.max(0, count - 1));
  }
}
