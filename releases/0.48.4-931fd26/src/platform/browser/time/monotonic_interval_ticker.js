// Calls onTick(seconds) about every intervalMs with the time measured by a monotonic clock (performance.now), never
// the wall clock: changing the system time changes nothing (spec 143). It keeps running in a hidden page, where the
// browser throttles it (about once a minute in Chrome); the real elapsed time is still reported.
export class MonotonicIntervalTicker {
  #windowRef;
  #now;
  #id = null;
  #last = 0;

  constructor({ windowRef, intervalMs = 1000, now, onTick }) {
    if (typeof onTick !== "function" || typeof now !== "function") {
      throw new TypeError("MonotonicIntervalTicker requires now and onTick");
    }
    this.#windowRef = windowRef;
    this.#now = now;
    this.#last = now();
    this.#id = windowRef.setInterval(() => {
      const current = this.#now();
      const seconds = Math.max(0, (current - this.#last) / 1000);
      this.#last = current;
      onTick(seconds);
    }, Math.max(50, Number(intervalMs) || 1000));
  }

  dispose() {
    if (this.#id !== null) this.#windowRef.clearInterval(this.#id);
    this.#id = null;
  }
}
