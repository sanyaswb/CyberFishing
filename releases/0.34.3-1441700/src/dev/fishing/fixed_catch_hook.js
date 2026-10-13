// DEV balance tool: while Fixed Catch is enabled, a natural bite becomes the configured test fish when that fish
// has a bite sequence for the current baits. Composed only by Development startup.
export class FixedCatchHook {
  #config;
  #biteRules;
  #devFlags;
  #fishFactory;

  constructor({ config, biteRules, devFlags, fishFactory }) {
    this.#config = config;
    this.#biteRules = biteRules;
    this.#devFlags = devFlags;
    this.#fishFactory = fishFactory;
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
        hooked = this.#fishFactory.create({
          template,
          weightKg: fixed.weight,
          biteSequence: chosenSequence,
          anomalyChanceOverride: this.#devFlags.isEnabled(
            "forceAnomalyChance",
          )
            ? 1
            : null,
          locationId: biteEnv?.locationId || "",
        });
      }
    }
    return hooked;
  }
}
