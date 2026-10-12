import { FishEndurancePointsCalculator } from "./fish_endurance_points_calculator.js";
import { FishStaminaPointsCalculator } from "./fish_stamina_points_calculator.js";

export class FishCondition {
  #maxStamina;
  #maxEndurance;
  #currentStamina;
  #currentExhaustion;
  #phase;

  constructor(level, weight, staminaFishConfig, fishPhysics = null, options = {}) {
    this.#maxEndurance = new FishEndurancePointsCalculator().calculate({
      level,
      weightKg: weight,
      staminaFishConfig,
      fishPhysics,
      maxLevel: options.maxLevel,
      levelAverageWeightKg: options.levelAverageWeightKg,
    });
    this.#maxStamina = new FishStaminaPointsCalculator().calculate({
      endurancePoints: this.#maxEndurance,
      staminaFishConfig,
      fishPhysics,
    });
    this.#currentStamina = this.#maxStamina;
    this.#currentExhaustion = this.#maxEndurance;
    this.#phase = "stamina";
  }

  get phase() {
    return this.#phase;
  }
  get maxPoints() {
    return this.#maxStamina;
  }
  get maxStamina() {
    return this.#maxStamina;
  }
  get maxEndurance() {
    return this.#maxEndurance;
  }
  get currentStamina() {
    return this.#currentStamina;
  }
  get currentExhaustion() {
    return this.#currentExhaustion;
  }

  restoreFull() {
    this.#currentStamina = this.#maxStamina;
    this.#currentExhaustion = this.#maxEndurance;
    this.#phase = "stamina";
  }

  breakExhaustion() {
    if (this.#phase === "exhaustion") {
      this.#phase = "stamina";
    }
  }

  applyStaminaDamage(amount) {
    if (this.#phase !== "stamina") return;
    this.#currentStamina = Math.max(0, this.#currentStamina - amount);
    if (this.#currentStamina === 0) {
      this.#phase = "exhaustion";
    }
  }

  applyStaminaRegen(amount) {
    if (this.#phase !== "stamina") return;
    this.#currentStamina = Math.min(
      this.#maxStamina,
      this.#currentStamina + amount,
    );
  }

  applyExhaustionStaminaRegen(amount) {
    if (this.#phase !== "exhaustion") return;
    this.#currentStamina = Math.min(
      this.#maxStamina,
      this.#currentStamina + Math.max(0, Number(amount) || 0),
    );
  }

  applyExhaustionDamage(amount) {
    if (this.#phase !== "exhaustion") return;
    this.#currentExhaustion = Math.max(0, this.#currentExhaustion - amount);
  }

  applyExhaustionRegen(amount, cap = this.#maxEndurance) {
    const recovery = Math.max(0, Number(amount) || 0);
    const limit = Math.max(
      0,
      Math.min(this.#maxEndurance, Number(cap) || this.#maxEndurance),
    );
    this.#currentExhaustion = Math.min(
      limit,
      this.#currentExhaustion + recovery,
    );
  }
}
