class GameLoop {
  static #activeLoop = null;
  static #duplicateStartAttempts = 0;

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
    if (this.#isRunning) return true;
    if (GameLoop.#activeLoop && GameLoop.#activeLoop !== this) {
      GameLoop.#duplicateStartAttempts += 1;
      const error = new Error(
        "[GameLoop] Refused to start a second active game loop.",
      );
      console.error(error);
      if (
        typeof window !== "undefined" &&
        window.dispatchEvent &&
        typeof CustomEvent !== "undefined"
      ) {
        window.dispatchEvent(
          new CustomEvent("cyber-fishing-memory-warning", {
            detail: {
              issue: {
                code: "duplicate_game_loop_start",
                severity: "critical",
                message: error.message,
              },
            },
          }),
        );
      }
      return false;
    }

    GameLoop.#activeLoop = this;
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
    if (GameLoop.#activeLoop === this) {
      GameLoop.#activeLoop = null;
    }
  }

  static getDiagnostics() {
    return Object.freeze({
      activeCount: GameLoop.#activeLoop ? 1 : 0,
      duplicateStartAttempts: GameLoop.#duplicateStartAttempts,
    });
  }

  get isRunning() {
    return this.#isRunning;
  }
}
