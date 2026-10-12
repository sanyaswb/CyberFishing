export class AquariumCareCalculator {
  #config;
  constructor(config) { this.#config = config; }
  drainPerMs(count) { return (1 + this.#config.extraFishDrainFactor * Math.max(0, count - 1)) / this.#config.oneFishFeedMs; }
  timeToEmpty(fraction, count) { return fraction / this.drainPerMs(count); }
  after(fraction, count, elapsedMs) { return Math.max(0, fraction - elapsedMs * this.drainPerMs(count)); }
}
