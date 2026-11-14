const MAX_SUBSTEP_SEC = 1 / 240;
const MAX_SUBSTEPS = 12;

// A value pulled toward a target by a damped spring: acceleration = omega² (target - value) - 2 zeta omega velocity.
// Semi-implicit Euler in fixed substeps of at most 1/240 s, so 30, 60 and 144 FPS move the same way; a frame longer
// than 12 substeps (50 ms) is shortened. zeta < 1 overshoots a little, 1 settles without overshoot. No allocation.
export class DampedSpring {
  #value = 0;
  #velocity = 0;

  get value() {
    return this.#value;
  }

  get velocity() {
    return this.#velocity;
  }

  reset(value = 0) {
    this.#value = Number.isFinite(value) ? value : 0;
    this.#velocity = 0;
  }

  // omega: natural angular frequency in rad/s; zeta: damping ratio; min/max: hard stops (the velocity stops there).
  step(target, omega, zeta, dtSec, min = -Infinity, max = Infinity) {
    const dt = Math.min(Math.max(0, Number(dtSec) || 0), MAX_SUBSTEP_SEC * MAX_SUBSTEPS);
    if (!(dt > 0) || !Number.isFinite(target)) return this.#value;
    const stiffness = omega * omega;
    const damping = 2 * Math.max(0, zeta) * omega;
    const substeps = Math.ceil(dt / MAX_SUBSTEP_SEC);
    const h = dt / substeps;
    let value = this.#value;
    let velocity = this.#velocity;
    for (let index = 0; index < substeps; index += 1) {
      velocity += (stiffness * (target - value) - damping * velocity) * h;
      value += velocity * h;
      if (value < min) {
        value = min;
        velocity = Math.max(0, velocity);
      } else if (value > max) {
        value = max;
        velocity = Math.min(0, velocity);
      }
    }
    this.#value = value;
    this.#velocity = velocity;
    return value;
  }
}
