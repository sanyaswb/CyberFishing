export class AquariumState {
  #state;
  #capacities;
  constructor(state = { owned: false, level: 0, feedBySpecies: {} }, capacities = []) {
    this.#state = state;
    this.#capacities = capacities;
  }
  get owned() { return this.#state.owned; }
  get level() { return this.#state.level; }
  get feedBySpecies() { return this.#state.feedBySpecies; }
  get capacity() { return this.owned ? this.#capacities[this.level - 1] : 0; }
  install() { if (this.owned) return false; this.#state.owned = true; this.#state.level = 1; return true; }
  upgrade() { if (!this.owned || this.level >= this.#capacities.length) return false; this.#state.level++; return true; }
  ensureSlot(speciesId) { if (!Object.hasOwn(this.feedBySpecies, speciesId)) this.feedBySpecies[speciesId] = 0; }
  removeEmptySlots(speciesIds) { for (const id of Object.keys(this.feedBySpecies)) if (!speciesIds.has(id)) delete this.feedBySpecies[id]; }
}
