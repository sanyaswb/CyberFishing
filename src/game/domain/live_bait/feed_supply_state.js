export class FeedSupplyState {
  #state;
  constructor(state = { portions: 0, autoFeederOwned: false, autoFeederEnabled: false }) {
    this.#state = state;
  }
  get portions() { return this.#state.portions; }
  get autoFeederOwned() { return this.#state.autoFeederOwned; }
  get autoFeederEnabled() { return this.#state.autoFeederEnabled; }
  acquire(quantity) { this.#state.portions += quantity; }
  consume() { if (this.portions <= 0) return false; this.#state.portions--; return true; }
  installFeeder() { if (this.autoFeederOwned) return false; this.#state.autoFeederOwned = true; this.#state.autoFeederEnabled = true; return true; }
  setFeeder(enabled) { if (!this.autoFeederOwned) return false; this.#state.autoFeederEnabled = !!enabled; return true; }
}
