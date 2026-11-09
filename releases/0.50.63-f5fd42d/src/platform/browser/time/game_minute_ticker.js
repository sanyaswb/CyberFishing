// Calls onTick when the displayed game minute changes (spec 081): each timeout lands just after the clock's next
// minute boundary. The delay is capped, so a clock changed elsewhere (DEV jump, another tab's anchor) shows within
// maxDelayMs, and floored, so a very fast clock does not schedule faster than about one frame.
export class GameMinuteTicker {
  #window;
  #clock;
  #onTick;
  #minDelayMs;
  #maxDelayMs;
  #timer = null;

  constructor({ windowTarget, clock, onTick, maxDelayMs, minDelayMs = 16 }) {
    this.#window = windowTarget;
    this.#clock = clock;
    this.#onTick = onTick;
    this.#minDelayMs = minDelayMs;
    this.#maxDelayMs = Math.max(minDelayMs, maxDelayMs);
  }

  start() {
    if (this.#timer === null) this.#schedule();
  }

  // After an external clock change (focus sync): reschedule from the current reading.
  restart() {
    this.#cancel();
    this.#schedule();
  }

  dispose() {
    this.#cancel();
  }

  #schedule() {
    const untilMinute = this.#clock.msUntilNextMinute();
    const delay = Number.isFinite(untilMinute) ? Math.ceil(untilMinute) + 1 : this.#maxDelayMs;
    this.#timer = this.#window.setTimeout(this.#fire, Math.min(this.#maxDelayMs, Math.max(this.#minDelayMs, delay)));
  }

  #cancel() {
    if (this.#timer === null) return;
    this.#window.clearTimeout(this.#timer);
    this.#timer = null;
  }

  #fire = () => {
    this.#timer = null;
    this.#onTick();
    this.#schedule();
  };
}
