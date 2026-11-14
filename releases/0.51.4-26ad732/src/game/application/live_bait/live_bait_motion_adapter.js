import { FishBehavior } from "../../domain/fish/fish_behavior.js";
import { Vector2 } from "../../../engine/math/vector2.js";

export class LiveBaitMotionAdapter {
  #behavior;
  #speed;
  #multiplier;
  #sample = { name: "", speedMultiplier: 0, radial: 0, lateral: 0 };
  #force = new Vector2(0, 0);
  constructor({ physics, multiplier, rng }) {
    this.#behavior = new FishBehavior(physics, rng);
    this.#speed = physics.movementProfile.baseSpeed;
    this.#multiplier = multiplier;
  }
  update(dt, tackle) {
    this.#behavior.update(dt);
    const motion = this.#behavior.writeMotionInto(this.#sample);
    const amount = this.#speed * motion.speedMultiplier * this.#multiplier * Math.max(0, dt) / 1000;
    this.#force.set(amount * motion.lateral, amount * motion.radial);
    tackle.applyForce(this.#force);
    return motion;
  }
}
