// Frame-rate independent exponential approach: after timeConstantSec the value has covered 63 % of the gap, whatever
// the frame rate. A non-positive time constant follows the target at once. No allocation per step.
export class ScalarSmoother {
  #timeConstantSec;
  #value;

  constructor({ timeConstantSec = 0, initialValue = 0 } = {}) {
    this.#timeConstantSec = Math.max(0, Number(timeConstantSec) || 0);
    this.#value = Number.isFinite(initialValue) ? initialValue : 0;
  }

  get value() {
    return this.#value;
  }

  setTimeConstant(timeConstantSec) {
    this.#timeConstantSec = Math.max(0, Number(timeConstantSec) || 0);
  }

  reset(value = 0) {
    this.#value = Number.isFinite(value) ? value : 0;
  }

  step(target, dtSec) {
    if (!Number.isFinite(target)) return this.#value;
    const dt = Math.max(0, Number(dtSec) || 0);
    if (this.#timeConstantSec <= 0) {
      this.#value = target;
      return this.#value;
    }
    this.#value += (target - this.#value) * (1 - Math.exp(-dt / this.#timeConstantSec));
    return this.#value;
  }
}
