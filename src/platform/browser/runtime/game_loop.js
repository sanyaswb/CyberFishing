export class GameLoop {
  #clock;
  #onUpdate;
  #onDraw;
  #activeLoopGuard;
  #isRunning = false;
  #rafId = 0;

  constructor(clock, onUpdate, onDraw, activeLoopGuard) {
    this.#clock = clock;
    this.#onUpdate = onUpdate;
    this.#onDraw = onDraw;
    this.#activeLoopGuard = activeLoopGuard;
  }

  start() {
    if (this.#isRunning) return true;
    if (!this.#activeLoopGuard.acquire(this)) return false;

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
    return true;
  }

  stop() {
    if (!this.#isRunning) return;
    this.#isRunning = false;
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }
    this.#activeLoopGuard.release(this);
  }

  get isRunning() {
    return this.#isRunning;
  }
}
