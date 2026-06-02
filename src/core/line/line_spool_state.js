class LineSpoolState {
  #totalLineMeters = 0;
  #releasedLineMeters = 0;

  constructor({ totalLineMeters = 0, releasedLineMeters = 0 } = {}) {
    this.#totalLineMeters = this.#positive(totalLineMeters);
    this.#releasedLineMeters = this.#clamp(
      releasedLineMeters,
      0,
      this.#totalLineMeters,
    );
  }

  get totalLineMeters() {
    return this.#totalLineMeters;
  }

  get releasedLineMeters() {
    return this.#releasedLineMeters;
  }

  get remainingLineMeters() {
    return Math.max(0, this.#totalLineMeters - this.#releasedLineMeters);
  }

  get lineHasReserve() {
    return this.remainingLineMeters > 0.0001;
  }

  get spoolEmpty() {
    return !this.lineHasReserve;
  }

  setTotalLineMeters(totalLineMeters) {
    this.#totalLineMeters = this.#positive(totalLineMeters);
    this.#releasedLineMeters = Math.min(
      this.#releasedLineMeters,
      this.#totalLineMeters,
    );
  }

  setReleasedLineMeters(releasedLineMeters) {
    this.#releasedLineMeters = this.#clamp(
      releasedLineMeters,
      0,
      this.#totalLineMeters,
    );
  }

  release(meters) {
    const released = this.#clamp(meters, 0, this.remainingLineMeters);
    this.#releasedLineMeters += released;
    return released;
  }

  recover(meters, minReleasedMeters = 0) {
    const minimum = this.#clamp(minReleasedMeters, 0, this.#totalLineMeters);
    const maxRecover = Math.max(0, this.#releasedLineMeters - minimum);
    const recovered = this.#clamp(meters, 0, maxRecover);
    this.#releasedLineMeters -= recovered;
    return recovered;
  }

  #positive(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  #clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }
}
