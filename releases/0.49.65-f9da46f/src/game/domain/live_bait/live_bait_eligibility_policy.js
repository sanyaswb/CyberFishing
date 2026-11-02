export class LiveBaitEligibilityPolicy {
  #config;
  constructor(config) { this.#config = config; }
  resolve(fish) {
    const speciesId = fish?.speciesId ?? fish?.sourceSpeciesId ?? fish?.id;
    const weightKg = Number(fish?.weightKg ?? fish?.weight);
    if (!speciesId || !Number.isFinite(weightKg) || weightKg <= 0 || weightKg > this.#config.maxWeightKg) return null;
    return { speciesId, weightKg, baitId: this.#config.baitId };
  }
}
