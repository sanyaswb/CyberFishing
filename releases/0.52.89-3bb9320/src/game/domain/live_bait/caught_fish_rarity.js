export class CaughtFishRarity {
  static isValid(value) {
    return value === null || typeof value === "string" ||
      (!!value && !Array.isArray(value) && Number.isSafeInteger(value.halfSteps) &&
        Number.isSafeInteger(value.maxHalfSteps) && Number.isSafeInteger(value.unitsPerStar) &&
        value.halfSteps > 0 && value.halfSteps <= value.maxHalfSteps &&
        value.unitsPerStar > 0 && value.unitsPerStar <= value.maxHalfSteps);
  }

  static capture(value) {
    if (!this.isValid(value) || value?.isResolved === false || value === "") return null;
    if (value === null || typeof value === "string") return value;
    return { halfSteps: value.halfSteps, maxHalfSteps: value.maxHalfSteps, unitsPerStar: value.unitsPerStar };
  }
}
