export class FeedSupplyState {
  #state;
  constructor(state) {
    this.#state = state;
  }
  get autoFeederOwned() { return this.#state.autoFeederOwned; }
  get autoFeederEnabled() { return this.#state.autoFeederEnabled; }
  acquire(itemId, quantity) { this.#state.stock[itemId] = (this.#state.stock[itemId] || 0) + quantity; }
  consume(itemId) {
    if (!(this.#state.stock[itemId] > 0)) return false;
    this.#state.stock[itemId]--; return true;
  }
  installFeeder() { if (this.autoFeederOwned) return false; this.#state.autoFeederOwned = true; this.#state.autoFeederEnabled = true; return true; }
  setFeeder(enabled) { if (!this.autoFeederOwned) return false; this.#state.autoFeederEnabled = !!enabled; return true; }
}
