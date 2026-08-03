class FishVisualVariantResolver {
  #noneAnomalyIds;

  constructor({ noneAnomalyIds = ["", "none"] } = {}) {
    this.#noneAnomalyIds = new Set(
      noneAnomalyIds.map((value) =>
        String(value || "").trim().toLowerCase(),
      ),
    );
  }

  resolveImagePath({
    visual = null,
    fishId = "unknown",
    level = 1,
    isUnique = false,
    anomaly = "none",
  } = {}) {
    const config = visual || {};
    const normalizedLevel = Math.max(1, Math.round(Number(level) || 1));
    const anomalyId = String(anomaly || "none").trim().toLowerCase();
    const uniqueImagePattern = String(config.uniqueImagePattern || "").trim();
    if (
      isUnique === true &&
      !this.#noneAnomalyIds.has(anomalyId) &&
      uniqueImagePattern
    ) {
      return uniqueImagePattern.replace("{level}", normalizedLevel);
    }

    const pattern = String(
      config.imagePattern ||
        `assets/fish/${fishId}/${fishId}--{level}.webp`,
    );
    return pattern.replace("{level}", normalizedLevel);
  }
}
