class RodStrokeState {
  #capacityMeters = 0;
  #wonMeters = 0;
  #snapshot = {
    rodStrokeCapacityMeters: 0,
    rodStrokeWonMeters: 0,
    rodStrokeUsedMeters: 0,
    rodStrokeUnrecoveredMeters: 0,
    rodStrokeRatio: 0,
  };

  setCapacity(capacityMeters) {
    this.#capacityMeters = Math.max(0, Number(capacityMeters) || 0);
    this.#wonMeters = Math.min(this.#wonMeters, this.#capacityMeters);
    this.#syncSnapshot();
  }

  startCycle(capacityMeters) {
    // Compatibility name: a new hold cycle must not erase unrecovered stroke.
    this.setCapacity(capacityMeters);
  }

  addWonDistance(meters) {
    const added = Math.min(
      Math.max(0, Number(meters) || 0),
      this.remainingCapacityMeters,
    );
    if (added <= 0) return 0;
    this.#wonMeters += added;
    this.#syncSnapshot();
    return added;
  }

  loseWonDistance(meters) {
    const lost = Math.min(
      Math.max(0, Number(meters) || 0),
      this.#wonMeters,
    );
    if (lost <= 0) return 0;
    this.#wonMeters -= lost;
    this.#syncSnapshot();
    return lost;
  }

  recoverWonDistance(meters) {
    return this.loseWonDistance(meters);
  }

  addPullDistance(meters) {
    return this.addWonDistance(meters);
  }

  recover(meters) {
    return this.recoverWonDistance(meters);
  }

  reset() {
    this.#capacityMeters = 0;
    this.#wonMeters = 0;
    this.#syncSnapshot();
  }

  get wonMeters() {
    return this.#wonMeters;
  }

  get capacityMeters() {
    return this.#capacityMeters;
  }

  get remainingCapacityMeters() {
    return Math.max(0, this.#capacityMeters - this.#wonMeters);
  }

  getRatio() {
    if (this.#capacityMeters <= 0) return 0;
    return Math.max(0, Math.min(1, this.#wonMeters / this.#capacityMeters));
  }

  writeSnapshot(target) {
    this.#syncSnapshot();
    const out = target || {};
    out.rodStrokeCapacityMeters = this.#snapshot.rodStrokeCapacityMeters;
    out.rodStrokeWonMeters = this.#snapshot.rodStrokeWonMeters;
    out.rodStrokeUsedMeters = this.#snapshot.rodStrokeUsedMeters;
    out.rodStrokeUnrecoveredMeters =
      this.#snapshot.rodStrokeUnrecoveredMeters;
    out.rodStrokeRatio = this.#snapshot.rodStrokeRatio;
    return out;
  }

  getSnapshot() {
    return this.writeSnapshot({});
  }

  #syncSnapshot() {
    this.#snapshot.rodStrokeCapacityMeters = this.#capacityMeters;
    this.#snapshot.rodStrokeWonMeters = this.#wonMeters;
    // Compatibility aliases for existing overlay/tests.
    this.#snapshot.rodStrokeUsedMeters = this.#wonMeters;
    this.#snapshot.rodStrokeUnrecoveredMeters = this.#wonMeters;
    this.#snapshot.rodStrokeRatio = this.getRatio();
  }
}
