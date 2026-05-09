class GameClock {
  #lastFrameTime = 0;
  #realTimeOffset = Date.now() - performance.now();
  #maxDeltaMs;

  constructor(maxDeltaMs = 100) {
    this.#maxDeltaMs = maxDeltaMs;
    this.now = 0;
    this.delta = 0;
    this.total = 0;
    this.realNow = Date.now();
  }

  tick(frameTime) {
    if (!this.#lastFrameTime) {
      this.#lastFrameTime = frameTime;
      this.now = frameTime;
      this.realNow = this.#realTimeOffset + frameTime;
      return 0;
    }

    this.delta = Math.min(this.#maxDeltaMs, frameTime - this.#lastFrameTime);
    this.#lastFrameTime = frameTime;
    this.now = frameTime;
    this.total += this.delta;
    this.realNow = this.#realTimeOffset + frameTime;
    return this.delta;
  }

  reset(frameTime = performance.now()) {
    this.#lastFrameTime = frameTime;
    this.now = frameTime;
    this.delta = 0;
    this.total = 0;
    this.realNow = this.#realTimeOffset + frameTime;
  }
}
