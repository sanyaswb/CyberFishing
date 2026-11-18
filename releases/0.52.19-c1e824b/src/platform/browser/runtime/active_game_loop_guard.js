// One active game loop per page: bootstrap creates one guard per page and shares it with every loop it composes.
// A second loop is refused, logged and announced as a critical memory warning.
export class ActiveGameLoopGuard {
  #activeLoop = null;
  #duplicateStartAttempts = 0;
  #logger;
  #warningTarget;

  constructor({ logger, warningTarget }) {
    this.#logger = logger;
    this.#warningTarget = warningTarget;
  }

  acquire(loop) {
    if (this.#activeLoop && this.#activeLoop !== loop) {
      this.#duplicateStartAttempts += 1;
      const error = new Error(
        "[GameLoop] Refused to start a second active game loop.",
      );
      this.#logger.error(error);
      if (this.#warningTarget?.dispatchEvent && typeof CustomEvent !== "undefined") {
        this.#warningTarget.dispatchEvent(
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
    this.#activeLoop = loop;
    return true;
  }

  release(loop) {
    if (this.#activeLoop === loop) {
      this.#activeLoop = null;
    }
  }

  getDiagnostics() {
    return Object.freeze({
      activeCount: this.#activeLoop ? 1 : 0,
      duplicateStartAttempts: this.#duplicateStartAttempts,
    });
  }
}
