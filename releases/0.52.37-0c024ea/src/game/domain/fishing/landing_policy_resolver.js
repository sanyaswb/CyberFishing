import { PoleLandingPolicy } from "./pole_landing_policy.js";
import { ReelLandingPolicy } from "./reel_landing_policy.js";

export class LandingPolicyResolver {
  constructor({ reelPolicy = null, polePolicy = null } = {}) {
    this.reelPolicy = reelPolicy || new ReelLandingPolicy();
    this.polePolicy = polePolicy || new PoleLandingPolicy();
  }

  resolve({ rod, reel } = {}) {
    return this.#hasUsableReel({ rod, reel })
      ? this.reelPolicy
      : this.polePolicy;
  }

  #hasUsableReel({ rod, reel } = {}) {
    if (!rod) return true;
    const rodHasReel =
      (typeof rod?.hasReel === "function" ? rod.hasReel() : undefined) ??
      rod?.effectiveStats?.hasReel;
    if (rodHasReel === false) return false;
    if (!reel) return false;
    if (typeof reel.hasReel === "function") return reel.hasReel();

    const capacity = Number(reel.effectiveStats?.lineCapacityMeters ?? 0);
    const power = Number(reel.effectiveStats?.basePower ?? 0);
    return capacity > 0 || power > 0;
  }
}
