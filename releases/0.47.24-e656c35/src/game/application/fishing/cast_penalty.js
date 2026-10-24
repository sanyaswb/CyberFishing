export class CastPenalty {
  #penaltyLevel;
  #timer;
  #lastCastTime;
  #penaltyStepMs = 2000;
  #maxPenaltyMs = 5000;

  constructor() {
    this.#penaltyLevel = 0;
    this.#timer = 0;
    this.#lastCastTime = 0;
  }

  update(dt) {
    if (this.#timer <= 0) return;

    this.#timer -= dt;
    if (this.#timer <= 0 && this.#penaltyLevel > 0) {
      this.#penaltyLevel--;
      if (this.#penaltyLevel > 0) this.#timer = this.#penaltyStepMs;
    }
  }

  canCast() {
    return true;
  }

  registerCast(currentTimeMs) {
    const timeSinceLast = currentTimeMs - this.#lastCastTime;
    this.#lastCastTime = currentTimeMs;

    if (timeSinceLast <= Math.max(this.#penaltyStepMs, this.#timer)) {
      this.#penaltyLevel = Math.min(4, this.#penaltyLevel + 1);
      this.#timer =
        this.#penaltyLevel === 4 ? this.#maxPenaltyMs : this.#penaltyStepMs;
    }
  }

  getBiteChanceMultiplier() {
    return Math.max(0, 1.0 - this.#penaltyLevel * 0.25);
  }
}
