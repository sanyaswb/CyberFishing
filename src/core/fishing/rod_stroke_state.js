class RodStrokeState {
  #capacityMeters = 0;
  #usedMeters = 0;
  #unrecoveredMeters = 0;
  #snapshot = {
    rodStrokeCapacityMeters: 0,
    rodStrokeUsedMeters: 0,
    rodStrokeUnrecoveredMeters: 0,
    rodStrokeRatio: 0,
  };

  startCycle(capacityMeters) {
    this.#capacityMeters = Math.max(0, Number(capacityMeters) || 0);
    this.#usedMeters = 0;
    this.#syncSnapshot();
  }

  addPullDistance(meters) {
    const safeMeters = Math.max(0, Number(meters) || 0);
    if (safeMeters <= 0 || this.#capacityMeters <= 0) return 0;

    const nextUsed = Math.min(this.#capacityMeters, this.#usedMeters + safeMeters);
    const added = nextUsed - this.#usedMeters;
    this.#usedMeters = nextUsed;
    this.#unrecoveredMeters = Math.min(
      this.#capacityMeters,
      this.#unrecoveredMeters + added,
    );
    this.#syncSnapshot();
    return added;
  }

  recover(meters) {
    const safeMeters = Math.max(0, Number(meters) || 0);
    if (safeMeters <= 0) return 0;

    const previous = this.#unrecoveredMeters;
    this.#unrecoveredMeters = Math.max(0, this.#unrecoveredMeters - safeMeters);
    this.#usedMeters = Math.min(this.#usedMeters, this.#unrecoveredMeters);
    this.#syncSnapshot();
    return previous - this.#unrecoveredMeters;
  }

  clampToPumpCredit(pumpCreditMeters) {
    const safePumpCredit = Math.max(0, Number(pumpCreditMeters) || 0);
    const previous = this.#unrecoveredMeters;
    this.#unrecoveredMeters = Math.min(this.#unrecoveredMeters, safePumpCredit);
    this.#usedMeters = Math.min(this.#usedMeters, this.#unrecoveredMeters);
    this.#syncSnapshot();
    return previous - this.#unrecoveredMeters;
  }

  // Deprecated compatibility alias. This is pump credit, not physical loose line.
  clampToSlack(slackMeters) {
    return this.clampToPumpCredit(slackMeters);
  }

  reset() {
    this.#capacityMeters = 0;
    this.#usedMeters = 0;
    this.#unrecoveredMeters = 0;
    this.#syncSnapshot();
  }

  getRatio() {
    if (this.#capacityMeters <= 0) return 0;
    return Math.max(0, Math.min(1, this.#unrecoveredMeters / this.#capacityMeters));
  }

  writeSnapshot(target) {
    this.#syncSnapshot();
    const out = target || {};
    out.rodStrokeCapacityMeters = this.#snapshot.rodStrokeCapacityMeters;
    out.rodStrokeUsedMeters = this.#snapshot.rodStrokeUsedMeters;
    out.rodStrokeUnrecoveredMeters = this.#snapshot.rodStrokeUnrecoveredMeters;
    out.rodStrokeRatio = this.#snapshot.rodStrokeRatio;
    return out;
  }

  getSnapshot() {
    return this.writeSnapshot({});
  }

  #syncSnapshot() {
    this.#snapshot.rodStrokeCapacityMeters = this.#capacityMeters;
    this.#snapshot.rodStrokeUsedMeters = this.#usedMeters;
    this.#snapshot.rodStrokeUnrecoveredMeters = this.#unrecoveredMeters;
    this.#snapshot.rodStrokeRatio = this.getRatio();
  }
}
