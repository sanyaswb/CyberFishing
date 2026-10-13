import { PassiveLureRetrievePolicy } from "./passive_lure_retrieve_policy.js";
import { PoleIdleRetrievePolicy } from "./pole_idle_retrieve_policy.js";

export class IdleRetrievePolicyResolver {
  constructor({
    polePolicy = null,
    defaultPolicy = null,
  } = {}) {
    this.polePolicy = polePolicy || new PoleIdleRetrievePolicy();
    this.defaultPolicy = defaultPolicy || new PassiveLureRetrievePolicy();
  }

  resolve({ rod, reel } = {}) {
    return this.#hasUsableReel({ rod, reel })
      ? this.defaultPolicy
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

    const capacity = Number(
      reel.effectiveStats?.lineCapacityMeters ?? 0,
    );
    const power = Number(reel.effectiveStats?.basePower ?? 0);
    return capacity > 0 || power > 0;
  }
}
