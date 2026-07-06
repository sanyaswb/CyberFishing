class PlayerReelFatigueSession {
  #active = false;
  #startedThisFrame = false;
  #endedThisFrame = false;

  update({
    playerHoldActive = false,
    reelHoldEngagedThisFrame = false,
    fightActive = true,
  } = {}) {
    this.#startedThisFrame = false;
    this.#endedThisFrame = false;

    if (fightActive !== true || playerHoldActive !== true) {
      if (this.#active) this.#endedThisFrame = true;
      this.#active = false;
      return this.getState();
    }

    if (!this.#active && reelHoldEngagedThisFrame === true) {
      this.#active = true;
      this.#startedThisFrame = true;
    }

    return this.getState();
  }

  getState() {
    return Object.freeze({
      active: this.#active,
      startedThisFrame: this.#startedThisFrame,
      endedThisFrame: this.#endedThisFrame,
    });
  }

  reset() {
    this.#active = false;
    this.#startedThisFrame = false;
    this.#endedThisFrame = false;
  }
}

if (typeof window !== "undefined") {
  window.PlayerReelFatigueSession = PlayerReelFatigueSession;
}
