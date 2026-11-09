import { ItemQualityGradePolicy } from "./item_quality_grade_policy.js";

export class NetQualityModifier {
  #gradePolicy;

  constructor({ gradePolicy = new ItemQualityGradePolicy() } = {}) {
    this.#gradePolicy = gradePolicy;
  }

  getCatchChanceBonusPercent(quality) {
    const grade = this.#gradePolicy.normalize(quality);
    return Math.round((grade - ItemQualityGradePolicy.MINIMUM) * 10);
  }
}
