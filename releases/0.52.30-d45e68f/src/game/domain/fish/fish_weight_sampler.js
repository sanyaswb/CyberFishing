import { FishRadiationBiteModifier } from "./fish_radiation_bite_modifier.js";

// A caught fish's weight (BiteSystem; spec 179 TK-369 moved it here so DevTools «РАНДОМАЙЗЕР» samples the same way):
// the species' weight bounds at the hook's depth (linear between its min and max depth) and min + (max − min) ×
// roll^curve, the curve leaning to the top with the radiation (spec 179 D7). The arithmetic is the one BiteSystem used.
export class FishWeightSampler {
  #radiation;

  constructor({ radiation = new FishRadiationBiteModifier() } = {}) {
    this.#radiation = radiation;
  }

  // roll: a random number 0…1 (the bite's stream); radiation: the location's 0…1.
  sample(fish, depth, roll, radiation = 0) {
    const dc = fish.depthConfig;
    const t = Math.max(0, Math.min(1, (depth - dc.minDepth) / (dc.maxDepth - dc.minDepth)));
    const min = dc.minWeightAtMinDepth * (1 - t) + dc.minWeightAtMaxDepth * t;
    const max = dc.maxWeightAtMinDepth * (1 - t) + dc.maxWeightAtMaxDepth * t;
    return min + (max - min) * Math.pow(roll, this.#radiation.weightCurve(fish, radiation));
  }
}
