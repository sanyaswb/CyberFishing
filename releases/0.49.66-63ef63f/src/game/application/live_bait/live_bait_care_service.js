export class LiveBaitCareService {
  #clock;
  #config;
  #calculator;
  #starvation;
  constructor({ clock, config, calculator, starvation }) {
    this.#clock = clock;
    this.#config = config;
    this.#calculator = calculator;
    this.#starvation = starvation;
  }
  canLoadFeed(state) { return this.#calculator.canLoad(state.aquarium.feed); }
  feed(state, itemId, seed, quantity = 1) {
    const count = state.fish.filter((fish) => fish.disposition === "aquarium").length;
    state.aquarium.feed = this.#calculator.load(state.aquarium.feed, itemId, count, quantity, seed);
    state.aquarium.starvation = null;
    for (const fish of state.fish) fish.starvationDeadlineMs = null;
  }
  synchronize(state) {
    const aquarium = state.aquarium;
    const inhabitants = state.fish.filter((fish) => fish.disposition === "aquarium");
    for (const fish of state.fish) if (fish.disposition !== "aquarium") fish.starvationDeadlineMs = null;
    const feed = aquarium.feed;
    if (feed?.remainingMs > 0) {
      const elapsed = feed.durationMs - feed.remainingMs;
      feed.durationMs = this.#calculator.cycleDuration(feed, inhabitants.length);
      feed.remainingMs = Math.max(0, feed.durationMs - elapsed);
    }
    this.#autoFill(state, inhabitants.length);
    if (!inhabitants.length || aquarium.feed?.remainingMs > 0) {
      aquarium.starvation = null;
      for (const fish of inhabitants) fish.starvationDeadlineMs = null;
      return;
    }
    if (!aquarium.starvation) {
      const item = this.#config.aquariumFeeds[aquarium.feed?.itemId || this.#config.defaultFeedId];
      aquarium.starvation = { startedAtMs: state.lastAppliedAtMs,
        windowMs: item.starvationWindowMs, seed: aquarium.feed?.seed ?? 0 };
    }
    for (const fish of inhabitants) if (fish.starvationDeadlineMs === null) fish.starvationDeadlineMs =
      this.#starvation.deadline(aquarium.starvation, fish.id, state.lastAppliedAtMs);
  }
  settle(state) {
    const now = Math.max(state.lastAppliedAtMs, this.#clock.nowMs());
    const before = JSON.stringify([state.aquarium, state.fish.map((fish) => fish.starvationDeadlineMs)]);
    this.synchronize(state);
    let changed = before !== JSON.stringify([state.aquarium, state.fish.map((fish) => fish.starvationDeadlineMs)]);
    while (state.lastAppliedAtMs < now) {
      let step = now - state.lastAppliedAtMs;
      const feed = state.aquarium.feed;
      const stock = state.feedSupply.stock[state.feedSupply.selectedFeedId] || 0;
      if (feed?.remainingMs > 0) {
        const trigger = state.feedSupply.autoFeederEnabled && stock > 0
          ? this.#calculator.autoFillThreshold(feed) : 0;
        step = Math.min(step, Math.max(1, feed.remainingMs - trigger));
      }
      for (const fish of state.fish) {
        if (fish.purpose !== "live_bait") continue;
        if (["keepnet", "hook"].includes(fish.disposition)) step = Math.min(step, Math.max(1, fish.remainingLifetimeMs));
        else if (fish.disposition === "aquarium" && fish.starvationDeadlineMs !== null)
          step = Math.min(step, Math.max(1, fish.starvationDeadlineMs - state.lastAppliedAtMs));
      }
      if (feed?.remainingMs > 0) feed.remainingMs = Math.max(0, feed.remainingMs - step);
      state.lastAppliedAtMs += step;
      for (const fish of state.fish) {
        if (fish.purpose !== "live_bait") continue;
        if (["keepnet", "hook"].includes(fish.disposition)) {
          fish.remainingLifetimeMs = Math.max(0, fish.remainingLifetimeMs - step);
          if (fish.remainingLifetimeMs === 0) this.#die(state, fish);
        } else if (fish.disposition === "aquarium" && fish.starvationDeadlineMs !== null &&
          fish.starvationDeadlineMs <= state.lastAppliedAtMs) this.#die(state, fish);
      }
      this.synchronize(state);
      changed = true;
    }
    return changed;
  }
  #die(state, fish) {
    fish.disposition = "dead";
    fish.remainingLifetimeMs = 0;
    fish.starvationDeadlineMs = null;
    if (state.selectedFishId === fish.id) state.selectedFishId = null;
  }
  #autoFill(state, count) {
    const supply = state.feedSupply;
    const feed = state.aquarium.feed;
    if (!count || !supply.autoFeederOwned || !supply.autoFeederEnabled ||
      !(supply.stock[supply.selectedFeedId] > 0) ||
      (feed && feed.remainingMs > this.#calculator.autoFillThreshold(feed))) return;
    supply.stock[supply.selectedFeedId]--;
    this.feed(state, supply.selectedFeedId, this.#starvation.nextSeed(feed?.seed ?? 0));
  }
}
