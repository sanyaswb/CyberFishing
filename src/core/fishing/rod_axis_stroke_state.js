class RodAxisStrokeState {
  #capacityMeters = 0;
  #usedMeters = 0;
  #snapshot = {
    capacityMeters: 0,
    usedMeters: 0,
    remainingMeters: 0,
    ratio: 0,
    depleted: false,
  };

  setCapacity(capacityMeters) {
    this.#capacityMeters = Math.max(0, Number(capacityMeters) || 0);
    this.#usedMeters = Math.min(this.#usedMeters, this.#capacityMeters);
    this.#syncSnapshot();
  }

  use(meters) {
    const used = Math.min(
      Math.max(0, Number(meters) || 0),
      this.remainingMeters,
    );
    if (used <= 0) return 0;
    this.#usedMeters += used;
    this.#syncSnapshot();
    return used;
  }

  recover(meters) {
    const recovered = Math.min(
      Math.max(0, Number(meters) || 0),
      this.#usedMeters,
    );
    if (recovered <= 0) return 0;
    this.#usedMeters -= recovered;
    this.#syncSnapshot();
    return recovered;
  }

  reset() {
    this.#capacityMeters = 0;
    this.#usedMeters = 0;
    this.#syncSnapshot();
  }

  get capacityMeters() {
    return this.#capacityMeters;
  }

  get usedMeters() {
    return this.#usedMeters;
  }

  get remainingMeters() {
    return Math.max(0, this.#capacityMeters - this.#usedMeters);
  }

  getRatio() {
    if (this.#capacityMeters <= 0) return 0;
    return Math.max(0, Math.min(1, this.#usedMeters / this.#capacityMeters));
  }

  writeSnapshot(target = {}) {
    this.#syncSnapshot();
    target.capacityMeters = this.#snapshot.capacityMeters;
    target.usedMeters = this.#snapshot.usedMeters;
    target.remainingMeters = this.#snapshot.remainingMeters;
    target.ratio = this.#snapshot.ratio;
    target.depleted = this.#snapshot.depleted;
    return target;
  }

  getSnapshot() {
    return this.writeSnapshot({});
  }

  #syncSnapshot() {
    const remaining = this.remainingMeters;
    this.#snapshot.capacityMeters = this.#capacityMeters;
    this.#snapshot.usedMeters = this.#usedMeters;
    this.#snapshot.remainingMeters = remaining;
    this.#snapshot.ratio = this.getRatio();
    this.#snapshot.depleted =
      this.#capacityMeters > 0 && remaining <= 0.000001;
  }
}
