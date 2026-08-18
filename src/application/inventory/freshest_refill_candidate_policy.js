class FreshestRefillCandidatePolicy {
  #freshnessStatePolicy;

  constructor({
    freshnessStatePolicy = new ItemFreshnessStatePolicy(),
  } = {}) {
    this.#freshnessStatePolicy = freshnessStatePolicy;
  }

  select(candidates = []) {
    let selected = null;
    let selectedFreshness = -Infinity;
    for (const candidate of candidates || []) {
      const freshness = this.#freshnessStatePolicy.resolvePercent(
        candidate?.freshnessState,
      );
      if (!selected || freshness > selectedFreshness) {
        selected = candidate;
        selectedFreshness = freshness;
      }
    }
    return selected;
  }
}

globalThis.FreshestRefillCandidatePolicy = FreshestRefillCandidatePolicy;
