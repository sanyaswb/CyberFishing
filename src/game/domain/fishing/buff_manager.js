export class BuffManager {
  #activeBuffs;

  constructor() {
    this.#activeBuffs = [];
  }

  addBuff(multiplier, duration) {
    this.#activeBuffs.push({ multiplier, remainingMs: duration });
  }

  update(dt) {
    for (let i = this.#activeBuffs.length - 1; i >= 0; i--) {
      this.#activeBuffs[i].remainingMs -= dt;
      if (this.#activeBuffs[i].remainingMs <= 0) {
        this.#activeBuffs.splice(i, 1);
      }
    }
  }

  getTotalMultiplier() {
    let multiplier = 1.0;
    for (let i = 0; i < this.#activeBuffs.length; i++) {
      multiplier *= this.#activeBuffs[i].multiplier;
    }
    return multiplier;
  }
}
