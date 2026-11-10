// DEV balance tool: while Fixed Catch is enabled, a natural bite becomes the configured test fish when that fish
// has a bite sequence for the current baits. Composed only by Development startup.
export class FixedCatchHook {
  #config;
  #biteRules;
  #devFlags;
  #fishFactory;
  #logger;
  #warnedNoAnomaly = new Set();

  constructor({ config, biteRules, devFlags, fishFactory, logger = null }) {
    this.#config = config;
    this.#biteRules = biteRules;
    this.#devFlags = devFlags;
    this.#fishFactory = fishFactory;
    this.#logger = logger;
  }

  apply({ hooked, baitCandidates, biteEnv }) {
    if (hooked && this.#config.debug?.fixedCatch?.enabled) {
      const fixed = this.#config.debug.fixedCatch;
      const template =
        this.#config.spawns.fishes.find((f) => f.id === fixed.fishId) ||
        this.#config.spawns.fishes[0];

      const chosenSequence = this.#biteRules.selectBiteSequence(
        template,
        baitCandidates.map((bait) => bait.variant || bait.itemType),
      );
      if (chosenSequence != null) {
        // TK-252 (owner): hasAnomaly on = the Fixed Catch fish is always anomalous.
        const forceAnomaly = this.#devFlags.isEnabled("forceAnomalyChance");
        hooked = this.#fishFactory.create({
          template,
          weightKg: fixed.weight,
          biteSequence: chosenSequence,
          forceAnomaly,
        });
        if (forceAnomaly && !hooked.hasAnomaly) this.#warnNoAnomaly(template.id);
      }
    }
    return hooked;
  }

  // TK-252: a species with no anomaly id at all (no anomalyVariant.anomalyId) cannot be anomalous; say so once.
  #warnNoAnomaly(fishId) {
    if (this.#warnedNoAnomaly.has(fishId)) return;
    this.#warnedNoAnomaly.add(fishId);
    this.#logger?.warn?.(`[Fixed Catch] hasAnomaly is on, but "${fishId}" has no anomaly id (anomalyVariant.anomalyId).`);
  }
}
