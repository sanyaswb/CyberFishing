import { clampFiniteOrMin, nonNegativeFinite } from "../../../engine/math/number_normalization.js";

export class LineSpoolState {
  #totalLineMeters = 0;
  #releasedLineMeters = 0;

  constructor({ totalLineMeters = 0, releasedLineMeters = 0 } = {}) {
    this.#totalLineMeters = nonNegativeFinite(totalLineMeters);
    this.#releasedLineMeters = clampFiniteOrMin(
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

  setReleasedLineMeters(releasedLineMeters) {
    this.#releasedLineMeters = clampFiniteOrMin(
      releasedLineMeters,
      0,
      this.#totalLineMeters,
    );
  }

  release(meters) {
    const released = clampFiniteOrMin(meters, 0, this.remainingLineMeters);
    this.#releasedLineMeters += released;
    return released;
  }

  recover(meters, minReleasedMeters = 0) {
    const minimum = clampFiniteOrMin(minReleasedMeters, 0, this.#totalLineMeters);
    const maxRecover = Math.max(0, this.#releasedLineMeters - minimum);
    const recovered = clampFiniteOrMin(meters, 0, maxRecover);
    this.#releasedLineMeters -= recovered;
    return recovered;
  }
}
