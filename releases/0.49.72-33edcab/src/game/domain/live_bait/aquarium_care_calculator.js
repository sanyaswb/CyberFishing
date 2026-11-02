export class AquariumCareCalculator {
  #config;
  constructor(config) { this.#config = config; }
  duration(itemId, count, quantity = 1) {
    const item = this.#config.aquariumFeeds[itemId];
    return Math.max(this.#config.minimumFeedMs,
      item.durationMs * quantity - item.extraFishPenaltyMs * Math.max(0, count - 1));
  }
  cycleDuration(feed, count) {
    return feed.carriedMs + this.duration(feed.itemId, count, feed.quantity);
  }
  canLoad(feed) {
    return !feed || feed.remainingMs <= feed.durationMs * this.#config.feedReloadRemainingFraction;
  }
  autoFillThreshold(feed) {
    return feed.durationMs * Math.min(this.#config.autoFeedTriggerFraction, this.#config.feedReloadRemainingFraction);
  }
  load(previous, itemId, count, quantity, seed) {
    // Preserve the settled remainder without recalculating its former quality/population budget.
    const carriedMs = previous?.remainingMs || 0;
    const durationMs = carriedMs + this.duration(itemId, count, quantity);
    return { itemId, quantity, carriedMs, durationMs, remainingMs: durationMs, seed };
  }
}
