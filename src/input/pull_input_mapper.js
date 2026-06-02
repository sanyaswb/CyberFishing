class PullInputMapper {
  #wasHeld = false;
  #state = {
    pullHeld: false,
    pullStartedThisFrame: false,
    pullReleasedThisFrame: false,
  };

  update(input) {
    const held = !!input?.isPulling;
    this.#state.pullHeld = held;
    this.#state.pullStartedThisFrame = held && !this.#wasHeld;
    this.#state.pullReleasedThisFrame = !held && this.#wasHeld;
    this.#wasHeld = held;
    return this.#state;
  }

  reset() {
    this.#wasHeld = false;
    this.#state.pullHeld = false;
    this.#state.pullStartedThisFrame = false;
    this.#state.pullReleasedThisFrame = false;
  }
}
