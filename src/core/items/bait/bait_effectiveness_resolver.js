class BaitEffectivenessResolver {
  #gradePolicy;
  #knowledgePolicy;
  #freshnessResolver;
  #freshnessModifier;

  constructor({
    gradePolicy = new BaitEffectivenessGradePolicy(),
    knowledgePolicy = new AlwaysKnownBaitEffectivenessPolicy(),
    freshnessResolver = null,
    freshnessModifier = new BaitFreshnessModifier(),
  } = {}) {
    if (!gradePolicy || typeof gradePolicy.resolve !== "function") {
      throw new TypeError(
        "BaitEffectivenessResolver requires gradePolicy.resolve",
      );
    }
    if (!knowledgePolicy || typeof knowledgePolicy.isDiscovered !== "function") {
      throw new TypeError(
        "BaitEffectivenessResolver requires knowledgePolicy.isDiscovered",
      );
    }
    this.#gradePolicy = gradePolicy;
    this.#knowledgePolicy = knowledgePolicy;
    this.#freshnessResolver = freshnessResolver;
    this.#freshnessModifier = freshnessModifier;
  }

  resolveMultiplier(fish, baitId) {
    if (!fish || !baitId) return 0;
    const multiplier = Number(fish.baitMultipliers?.[baitId]);
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 0;
  }

  resolveBestMultiplier(fish, baitCandidates, context = {}) {
    return this.resolveBestMatch(fish, baitCandidates, context).effectiveMultiplier;
  }

  resolveBestMatch(fish, baitCandidates, context = {}) {
    const candidates = Array.isArray(baitCandidates)
      ? baitCandidates
      : [baitCandidates];
    let best = new BaitEffectivenessMatch();
    for (let index = 0; index < candidates.length; index += 1) {
      const match = this.#resolveMatch(fish, candidates[index], context);
      if (match.effectiveMultiplier > best.effectiveMultiplier) best = match;
    }
    return best;
  }

  resolve(fish, bait, context = {}) {
    const candidate = this.#candidate(bait);
    const baitId = candidate.baitId;
    const fishId = String(fish?.id || "");
    const normalizedBaitId = String(baitId || "");
    if (!fishId || !normalizedBaitId) {
      return new BaitEffectivenessDescriptor({
        baitId: normalizedBaitId,
        fishId,
        fishName: fish?.name,
        available: false,
        reason: !fishId ? "fish_missing" : "bait_missing",
        discovered: false,
      });
    }

    const discovered = this.#knowledgePolicy.isDiscovered({
      baitId: normalizedBaitId,
      fishId,
      fish,
      ...context,
    }) === true;
    if (!discovered) {
      return new BaitEffectivenessDescriptor({
        baitId: normalizedBaitId,
        fishId,
        fishName: fish.name,
        available: true,
        reason: "undiscovered",
        discovered: false,
      });
    }

    const multiplier = this.resolveMultiplier(fish, normalizedBaitId);
    const match = this.#resolveMatch(fish, bait, context);
    const referenceMultiplier = this.#resolveReferenceMultiplier(fish);
    const grade = this.#gradePolicy.resolve({
      multiplier,
      referenceMultiplier,
    });
    return new BaitEffectivenessDescriptor({
      baitId: normalizedBaitId,
      fishId,
      fishName: fish.name,
      available: true,
      discovered: true,
      compatible: multiplier > 0,
      multiplier,
      referenceMultiplier,
      relativeEffectiveness: grade.relativeEffectiveness,
      stars: grade.stars,
      maximumStars: grade.maximumStars,
      gradeId: grade.gradeId,
      freshnessPercent: match.freshnessPercent,
      freshnessMultiplier: match.freshnessMultiplier,
      effectiveMultiplier: match.effectiveMultiplier,
    });
  }

  #resolveMatch(fish, bait, context) {
    const candidate = this.#candidate(bait);
    const affinityMultiplier = this.resolveMultiplier(fish, candidate.baitId);
    let freshnessPercent = 100;
    let freshnessMultiplier = 1;
    if (candidate.item && this.#freshnessResolver?.resolve) {
      const exposureMs = typeof context?.getExposureMs === "function"
        ? context.getExposureMs(candidate.item)
        : context?.exposureMs ?? context?.freshnessExposureMs;
      const freshness = this.#freshnessResolver.resolve(
        candidate.item,
        undefined,
        { exposureMs },
      );
      if (freshness?.available) {
        freshnessPercent = Number(freshness.percent);
        freshnessMultiplier = this.#freshnessModifier.resolve({
          percent: freshnessPercent,
          minimumMultiplier: freshness.minimumMultiplier,
        });
      }
    }
    return new BaitEffectivenessMatch({
      baitId: candidate.baitId,
      instanceId: candidate.item?.instanceId,
      candidate: candidate.item,
      affinityMultiplier,
      freshnessPercent,
      freshnessMultiplier,
      effectiveMultiplier: affinityMultiplier * freshnessMultiplier,
    });
  }

  #candidate(value) {
    if (!value || typeof value !== "object") {
      return { baitId: String(value || ""), item: null };
    }
    return {
      baitId: String(value.itemId || value.id || ""),
      item: value,
    };
  }

  #resolveReferenceMultiplier(fish) {
    let maximum = 0;
    for (const value of Object.values(fish?.baitMultipliers || {})) {
      const multiplier = Number(value);
      if (Number.isFinite(multiplier) && multiplier > maximum) {
        maximum = multiplier;
      }
    }
    return maximum;
  }
}

globalThis.BaitEffectivenessResolver = BaitEffectivenessResolver;
