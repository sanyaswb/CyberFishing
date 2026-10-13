export class FightPhysicsPipelineFrame {
  #steps;
  #nextIndex = 0;
  #completed = [];
  #now;

  constructor(steps, now = null) {
    this.#steps = Array.isArray(steps) ? steps.slice() : [];
    this.#now = now;
  }

  run(stepName, operation) {
    this.#assertKnownStep(stepName);
    this.#assertOrder(stepName);
    const startedAt =
      this.#now ? this.#now() : Date.now();
    const result = typeof operation === "function" ? operation() : undefined;
    const finishedAt =
      this.#now ? this.#now() : Date.now();
    this.#completed.push({
      step: stepName,
      durationMs: Math.max(0, finishedAt - startedAt),
    });
    this.#nextIndex += 1;
    return result;
  }

  toDebugData() {
    return this.#completed.map((entry) => ({ ...entry }));
  }

  #assertKnownStep(stepName) {
    if (!this.#steps.includes(stepName)) {
      throw new Error(`Unknown fight physics pipeline step: ${stepName}`);
    }
  }

  #assertOrder(stepName) {
    const expected = this.#steps[this.#nextIndex];
    if (expected !== stepName) {
      throw new Error(
        `Fight physics pipeline order mismatch: expected ${expected}, got ${stepName}`,
      );
    }
  }
}
