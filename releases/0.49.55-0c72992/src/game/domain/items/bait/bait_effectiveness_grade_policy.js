import { positiveFinite } from "../../../../engine/math/number_normalization.js";

export class BaitEffectivenessGradePolicy {
  static DEFAULT_MAXIMUM_STARS = 5;

  #maximumStars;

  constructor({
    maximumStars = BaitEffectivenessGradePolicy.DEFAULT_MAXIMUM_STARS,
  } = {}) {
    const parsedMaximum = Math.floor(Number(maximumStars));
    this.#maximumStars = Number.isFinite(parsedMaximum) && parsedMaximum > 0
      ? parsedMaximum
      : BaitEffectivenessGradePolicy.DEFAULT_MAXIMUM_STARS;
  }

  resolve({ multiplier, referenceMultiplier } = {}) {
    const value = positiveFinite(multiplier);
    const reference = positiveFinite(referenceMultiplier);
    if (value === 0 || reference === 0) {
      return Object.freeze({
        relativeEffectiveness: 0,
        stars: 0,
        maximumStars: this.#maximumStars,
        gradeId: "incompatible",
      });
    }

    const relativeEffectiveness = Math.max(0, Math.min(1, value / reference));
    const stars = Math.max(
      1,
      Math.min(
        this.#maximumStars,
        Math.ceil(relativeEffectiveness * this.#maximumStars),
      ),
    );
    return Object.freeze({
      relativeEffectiveness,
      stars,
      maximumStars: this.#maximumStars,
      gradeId: this.#gradeId(stars),
    });
  }

  #gradeId(stars) {
    if (stars >= this.#maximumStars) return "best";
    if (stars >= Math.ceil(this.#maximumStars * 0.6)) return "effective";
    return "weak";
  }
}
