export class BrowserTimeoutScheduler {
  #host;

  constructor(timerHost = globalThis) {
    this.#host = timerHost;
  }

  setTimeout(callback, delayMs) {
    return this.#host.setTimeout(callback, delayMs);
  }

  clearTimeout(handle) {
    return this.#host.clearTimeout(handle);
  }
}
