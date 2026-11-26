export class InventoryRefillMemoryTransactionParticipant {
  #memory;

  constructor(memory) {
    this.#memory = memory;
  }

  snapshot() {
    return this.#memory.snapshot();
  }

  restore(snapshot = {}) {
    const current = this.#memory.snapshot();
    for (const key of Object.keys(current)) this.#memory.forget(key);
    for (const [key, signature] of Object.entries(snapshot || {})) {
      this.#memory.remember(key, signature);
    }
  }
}
