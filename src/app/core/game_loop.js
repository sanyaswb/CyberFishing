class GameLoop {
  #clock;
  #onUpdate;
  #onDraw;
  #isRunning = false;
  #rafId = 0;

  constructor(clock, onUpdate, onDraw) {
    this.#clock = clock;
    this.#onUpdate = onUpdate;
    this.#onDraw = onDraw;
  }

  start() {
    if (this.#isRunning) return;
    this.#isRunning = true;
    this.#clock.reset();

    const loop = (frameTime) => {
      if (!this.#isRunning) return;
      const dt = this.#clock.tick(frameTime);
      this.#onUpdate(dt);
      this.#onDraw();
      this.#rafId = requestAnimationFrame(loop);
    };

    this.#rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (!this.#isRunning) return;
    this.#isRunning = false;
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }
  }

  get isRunning() {
    return this.#isRunning;
  }
}
