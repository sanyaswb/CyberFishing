class HookQualityModifier {
  #gradePolicy;

  constructor({ gradePolicy = new ItemQualityGradePolicy() } = {}) {
    this.#gradePolicy = gradePolicy;
  }

  getPowerBonus(quality) {
    return this.#gradePolicy.normalize(quality) * 0.01;
  }
}

globalThis.HookQualityModifier = HookQualityModifier;
