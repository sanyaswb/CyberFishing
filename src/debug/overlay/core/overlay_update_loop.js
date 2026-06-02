class OverlayUpdateLoop {
  #intervalId = null;
  #callback;
  #intervalMs;
  #timer;

  constructor({ callback, intervalMs = 150, timer = window } = {}) {
    this.#callback = callback;
    this.#intervalMs = Number.isFinite(Number(intervalMs)) && Number(intervalMs) > 0
      ? Number(intervalMs)
      : 150;
    this.#timer = timer;
  }

  start() {
    if (this.#intervalId || typeof this.#callback !== "function") return;
    this.#intervalId = this.#timer.setInterval(() => this.#callback(), this.#intervalMs);
  }

  stop() {
    if (!this.#intervalId) return;
    this.#timer.clearInterval(this.#intervalId);
    this.#intervalId = null;
  }
}

window.OverlayUpdateLoop = OverlayUpdateLoop;
