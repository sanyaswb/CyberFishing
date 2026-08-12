class ItemQualityGradePolicy {
  static MINIMUM = 1;
  static MAXIMUM = 10;

  normalize(value, { fallback = ItemQualityGradePolicy.MINIMUM } = {}) {
    const parsed = Number(value);
    const fallbackValue = Number(fallback);
    const grade = Number.isFinite(parsed)
      ? parsed
      : Number.isFinite(fallbackValue)
        ? fallbackValue
        : ItemQualityGradePolicy.MINIMUM;
    return Math.max(
      ItemQualityGradePolicy.MINIMUM,
      Math.min(ItemQualityGradePolicy.MAXIMUM, grade),
    );
  }

  normalizeToUnit(value) {
    const grade = this.normalize(value);
    return (
      (grade - ItemQualityGradePolicy.MINIMUM) /
      (ItemQualityGradePolicy.MAXIMUM - ItemQualityGradePolicy.MINIMUM)
    );
  }
}

globalThis.ItemQualityGradePolicy = ItemQualityGradePolicy;
