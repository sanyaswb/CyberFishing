class EnvironmentalCompensationModifier {
  #gradePolicy;

  constructor({ gradePolicy = new ItemQualityGradePolicy() } = {}) {
    this.#gradePolicy = gradePolicy;
  }

  getCoefficient(quality, compensationRange = [0.1, 0.99]) {
    const minimum = Number(compensationRange?.[0]);
    const maximum = Number(compensationRange?.[1]);
    const from = Number.isFinite(minimum) ? minimum : 0.1;
    const to = Number.isFinite(maximum) ? maximum : 0.99;
    const normalizedQuality = this.#gradePolicy.normalizeToUnit(quality);
    return from + (to - from) * normalizedQuality;
  }
}

globalThis.EnvironmentalCompensationModifier = EnvironmentalCompensationModifier;
