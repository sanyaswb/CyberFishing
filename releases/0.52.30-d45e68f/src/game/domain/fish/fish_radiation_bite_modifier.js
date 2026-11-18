// Spec 179 D7 (TK-369): how the location's radiation (0…1) changes a species' bite, from its radiationMultipliers
// { unique, big, species }. At radiation 0 (or a multiplier 0) every value is exactly the one without radiation, so the
// bite's numbers do not move and no random number is drawn here.
function clampRadiation(radiation) {
  const value = Number(radiation);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function multiplier(fish, key) {
  const value = Number(fish?.radiationMultipliers?.[key]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export class FishRadiationBiteModifier {
  // The species' bite chance × (1 + r × species).
  chanceMultiplier(fish, radiation) {
    const r = clampRadiation(radiation);
    const k = multiplier(fish, "species");
    return r > 0 && k > 0 ? 1 + r * k : 1;
  }

  // The weight curve's exponent ÷ (1 + r × big): the weight leans to the top of the species' range, its bounds stay.
  weightCurve(fish, radiation) {
    const curve = fish.weightConfig.rarityCurve;
    const r = clampRadiation(radiation);
    const k = multiplier(fish, "big");
    return r > 0 && k > 0 ? curve / (1 + r * k) : curve;
  }

  // The scale of the species' anomaly chance: 1 + r × unique (the resolver caps the chance at 1).
  anomalyChanceScale(fish, radiation) {
    const r = clampRadiation(radiation);
    const k = multiplier(fish, "unique");
    return r > 0 && k > 0 ? 1 + r * k : 1;
  }
}
