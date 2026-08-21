export class FixtureAccumulator {
  #value;

  constructor(initialValue = 0) {
    this.#value = initialValue;
  }

  add(value) {
    this.#value += value;
    return this.#value;
  }
}

export function doubleFixtureValue(value) {
  return value * 2;
}
