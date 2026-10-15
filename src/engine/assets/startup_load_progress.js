// Startup progress over a fixed set of required resources (spec 083, FR-019 of spec 047). The denominator is captured
// once, so optional work never moves the bar backwards; readiness and failure are counted separately and byte totals
// are not invented. A loading screen (static poster or Spine animation) subscribes to the snapshot.
export class StartupLoadProgress {
  #required;
  #ready = new Set();
  #failed = new Set();
  #listeners = new Set();
  #snapshot;

  constructor(requiredIds) {
    this.#required = new Set([...requiredIds].map(String));
    this.#snapshot = this.#createSnapshot();
  }

  markReady(id) { this.#mark(String(id), this.#ready, this.#failed); }

  markFailed(id) { this.#mark(String(id), this.#failed, this.#ready); }

  getSnapshot() { return this.#snapshot; }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #mark(id, target, other) {
    // Unknown IDs (optional work) and repeated marks change nothing; a retried failure may still become ready.
    if (!this.#required.has(id) || target.has(id) || (target === this.#failed && this.#ready.has(id))) return;
    other.delete(id);
    target.add(id);
    this.#snapshot = this.#createSnapshot();
    for (const listener of [...this.#listeners]) listener(this.#snapshot);
  }

  #createSnapshot() {
    const total = this.#required.size;
    const ready = this.#ready.size;
    return Object.freeze({ total, ready, failed: this.#failed.size, fraction: total === 0 ? 1 : ready / total,
      complete: ready === total, blocked: this.#failed.size > 0 });
  }
}
