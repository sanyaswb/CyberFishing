// The DEV overlay's refresh cadence: callback every intervalMs on the page's timer (TK-395: the composition passes the
// window; no global default).
export class OverlayUpdateLoop {
  #intervalId = null;
  #callback;
  #intervalMs;
  #timer;

  constructor({ callback, intervalMs = 150, timer }) {
    if (typeof callback !== "function") throw new TypeError("OverlayUpdateLoop requires callback");
    if (typeof timer?.setInterval !== "function") throw new TypeError("OverlayUpdateLoop requires timer");
    this.#callback = callback;
    this.#intervalMs = Number.isFinite(Number(intervalMs)) && Number(intervalMs) > 0
      ? Number(intervalMs)
      : 150;
    this.#timer = timer;
  }

  start() {
    if (this.#intervalId) return;
    this.#intervalId = this.#timer.setInterval(() => this.#callback(), this.#intervalMs);
  }

  stop() {
    if (!this.#intervalId) return;
    this.#timer.clearInterval(this.#intervalId);
    this.#intervalId = null;
  }
}
