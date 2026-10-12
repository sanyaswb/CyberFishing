export class LiveBaitEligibilityPolicy {
  #eligibility;
  constructor(eligibility) { this.#eligibility = eligibility; }
  resolve(fish) {
    const speciesId = fish?.speciesId ?? fish?.sourceSpeciesId ?? fish?.id;
    const weightKg = Number(fish?.weightKg ?? fish?.weight);
    const rule = this.#eligibility?.[speciesId];
    if (!rule || !Number.isFinite(weightKg) || weightKg <= 0 || weightKg > rule.maxWeightKg) return null;
    return { speciesId, weightKg, baitId: rule.baitId };
  }
}
