export class AutoRefillSettings {
  #autoBait;
  #autoChum;

  constructor({ autoBait = false, autoChum = false } = {}) {
    this.#autoBait = autoBait === true;
    this.#autoChum = autoChum === true;
  }

  get autoBait() {
    return this.#autoBait;
  }

  get autoChum() {
    return this.#autoChum;
  }

  setAutoBait(enabled) {
    this.#autoBait = enabled === true;
    return this;
  }

  setAutoChum(enabled) {
    this.#autoChum = enabled === true;
    return this;
  }

  snapshot() {
    return Object.freeze({ autoBait: this.#autoBait, autoChum: this.#autoChum });
  }
}
