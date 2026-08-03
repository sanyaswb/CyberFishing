class FishAnomalyVariantResolver {
  #noneAnomalyId;
  #noneResult;

  constructor({ noneAnomalyId = "none" } = {}) {
    this.#noneAnomalyId = String(noneAnomalyId || "none")
      .trim()
      .toLowerCase() || "none";
    this.#noneResult = Object.freeze({
      anomalyId: this.#noneAnomalyId,
      hasAnomaly: false,
    });
  }

  resolve({ config = null, locationId = "", roll = 1 } = {}) {
    if (!config || config.enabled === false) return this.#none();

    const allowedLocations = Array.isArray(config.locationIds)
      ? config.locationIds
      : [];
    const normalizedLocationId = String(locationId || "").trim();
    if (
      allowedLocations.length > 0 &&
      !allowedLocations.includes(normalizedLocationId)
    ) {
      return this.#none();
    }

    const chance = Math.max(0, Math.min(1, Number(config.chance) || 0));
    const parsedRoll = Number(roll);
    const normalizedRoll = Number.isFinite(parsedRoll)
      ? Math.max(0, Math.min(1, parsedRoll))
      : 1;
    if (chance <= 0 || normalizedRoll >= chance) return this.#none();

    const anomalyId = String(config.anomalyId || "")
      .trim()
      .toLowerCase();
    if (!anomalyId || anomalyId === this.#noneAnomalyId) return this.#none();

    return Object.freeze({
      anomalyId,
      hasAnomaly: true,
    });
  }

  #none() {
    return this.#noneResult;
  }
}
