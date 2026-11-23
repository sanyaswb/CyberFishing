export class AquariumState {
  #state;
  #capacities;
  constructor(state, capacities) {
    this.#state = state;
    this.#capacities = capacities;
  }
  get owned() { return this.#state.owned; }
  get level() { return this.#state.level; }
  get capacity() { return this.owned ? this.#capacities[this.level - 1] : 0; }
  install() { if (this.owned) return false; this.#state.owned = true; this.#state.level = 1; return true; }
  upgrade() { if (!this.owned || this.level >= this.#capacities.length) return false; this.#state.level++; return true; }
}
