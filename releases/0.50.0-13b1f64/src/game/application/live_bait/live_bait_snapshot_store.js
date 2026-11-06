import { CaughtFishRarity } from "../../domain/live_bait/caught_fish_rarity.js";

export class LiveBaitSnapshotStore {
  #storage;
  #raw = null;
  constructor(storage) { this.#storage = storage; }
  load(nowMs, fishDb, config) {
    const loaded = this.#storage.read();
    if (!loaded.ok) return loaded;
    this.#raw = loaded.raw;
    if (loaded.raw === null) return { ok: true, state: this.#empty(nowMs, config) };
    let state;
    try { state = JSON.parse(loaded.raw); }
    catch { return { ok: false, reason: "corrupt_snapshot" }; }
    const known = new Set(fishDb.map((fish) => fish.id));
    const locations = new Set(["keepnet", "aquarium", "hook", "dead", "consumed", "released"]);
    const fish = state?.fish;
    if (![1, 2, 3, 4, 5].includes(state?.schemaVersion) ||
      (state.schemaVersion >= 4 && Object.hasOwn(state, "pendingLegacyStock")) ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isFinite(state.lastAppliedAtMs) || state.lastAppliedAtMs < 0 ||
      !Array.isArray(fish) || !state.resolvedCatchIds || Array.isArray(state.resolvedCatchIds) ||
      typeof state.resolvedCatchIds !== "object" || !state.aquarium || !state.feedSupply ||
      !this.#validCare(state, known, config) ||
      typeof state.feedSupply.autoFeederOwned !== "boolean" ||
      typeof state.feedSupply.autoFeederEnabled !== "boolean" ||
      (state.feedSupply.autoFeederEnabled && !state.feedSupply.autoFeederOwned) ||
      typeof state.aquarium.owned !== "boolean" || !Number.isSafeInteger(state.aquarium.level) ||
      state.aquarium.level < 0 || state.aquarium.level > config.capacities.length ||
      state.aquarium.owned !== (state.aquarium.level > 0) ||
      Object.values(state.resolvedCatchIds).some((outcome) => !["claim", "release", "live_bait"].includes(outcome))) {
      return { ok: false, reason: "invalid_snapshot" };
    }
    const ids = new Set();
    for (const entry of fish) {
      if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id) || !known.has(entry.speciesId) ||
        !Object.hasOwn(state.resolvedCatchIds, entry.id) ||
        typeof entry.name !== "string" || typeof entry.imagePath !== "string" ||
        !(state.schemaVersion === 1 ? typeof entry.rarity === "string" : CaughtFishRarity.isValid(entry.rarity)) || !Number.isFinite(entry.level) ||
        !Number.isFinite(entry.weightKg) || entry.weightKg <= 0 || !locations.has(entry.disposition) ||
        !["catch", "live_bait"].includes(entry.purpose) || !Number.isFinite(entry.caughtAtMs) ||
        entry.caughtAtMs < 0 ||
        (entry.purpose === "catch" && !["keepnet", "released"].includes(entry.disposition)) ||
        (state.schemaVersion < 3 && entry.purpose === "live_bait" && (!Number.isFinite(entry.deathOrder) ||
          entry.deathOrder < 0 || entry.deathOrder >= 1)) ||
        (state.schemaVersion >= 3 && (![true, false, null].includes(entry.hasAnomaly) ||
          ![true, false, null].includes(entry.isUnique) ||
          !(entry.anomaly === null || typeof entry.anomaly === "string") ||
          !(entry.starvationDeadlineMs === null || (Number.isFinite(entry.starvationDeadlineMs) && entry.starvationDeadlineMs >= 0)))) ||
        (entry.purpose === "live_bait" && (!Number.isFinite(entry.remainingLifetimeMs) ||
          !Number.isFinite(entry.sampledLifetimeMs) || entry.sampledLifetimeMs <= 0 ||
          entry.remainingLifetimeMs < 0 ||
          entry.remainingLifetimeMs > entry.sampledLifetimeMs))) return { ok: false, reason: "invalid_snapshot" };
      ids.add(entry.id);
    }
    if (state.selectedFishId !== null && !fish.some((entry) => entry.id === state.selectedFishId &&
      entry.purpose === "live_bait" && ["keepnet", "aquarium", "hook"].includes(entry.disposition))) {
      return { ok: false, reason: "invalid_snapshot" };
    }
    if (fish.filter((item) => item.disposition === "aquarium").length >
      (state.aquarium.owned ? config.capacities[state.aquarium.level - 1] : 0)) return { ok: false, reason: "invalid_snapshot" };
    if (state.schemaVersion >= 3 && (
      (state.aquarium.starvation && state.aquarium.feed?.remainingMs > 0) ||
      fish.some((entry) => entry.starvationDeadlineMs !== null &&
        (entry.disposition !== "aquarium" || !state.aquarium.starvation ||
          entry.starvationDeadlineMs < state.aquarium.starvation.startedAtMs ||
          entry.starvationDeadlineMs > state.aquarium.starvation.startedAtMs + state.aquarium.starvation.windowMs)))) {
      return { ok: false, reason: "invalid_snapshot" };
    }
    // Keep the existing storage key. Validate v1 before migrating; unknown/corrupt bytes are untouched.
    if (state.schemaVersion === 1) {
      for (const entry of fish) entry.rarity = CaughtFishRarity.capture(entry.rarity);
      state.schemaVersion = 2;
    }
    if (state.schemaVersion === 2) this.#migrate(state, config);
    if (state.schemaVersion === 3) {
      state.pendingLegacyStock = state.feedSupply.stock;
      delete state.feedSupply.stock;
      if (state.aquarium.feed) state.aquarium.feed.quantity = 1;
      state.schemaVersion = 4;
    }
    if (state.schemaVersion === 4) {
      if (state.aquarium.feed) state.aquarium.feed.carriedMs = 0;
      state.schemaVersion = 5;
    }
    return { ok: true, state };
  }
  save(state, changes = []) {
    const { pendingLegacyStock, ...facts } = state;
    const { stock, ...feedSupply } = state.feedSupply;
    const next = { ...facts, feedSupply, revision: state.revision + 1 };
    const raw = JSON.stringify(next);
    const result = this.#storage.write(raw, this.#raw, changes);
    if (!result.ok) return result;
    this.#raw = raw;
    state.revision = next.revision;
    return { ok: true, revision: next.revision };
  }
  #empty(nowMs, config) {
    return { schemaVersion: 5, revision: 0, lastAppliedAtMs: nowMs, fish: [], resolvedCatchIds: {},
      aquarium: { owned: false, level: 0, feed: null, starvation: null },
      feedSupply: { selectedFeedId: config.defaultFeedId, autoFeederOwned: false, autoFeederEnabled: false }, selectedFishId: null };
  }
  #validCare(state, known, config) {
    const supply = state.feedSupply, aquarium = state.aquarium;
    if (state.schemaVersion < 3) return Number.isSafeInteger(supply.portions) && supply.portions >= 0 &&
      !!aquarium.feedBySpecies && !Array.isArray(aquarium.feedBySpecies) && typeof aquarium.feedBySpecies === "object" &&
      Object.keys(aquarium.feedBySpecies).every((id) => known.has(id)) &&
      Object.values(aquarium.feedBySpecies).every((value) => Number.isFinite(value) && value >= 0 && value <= 1);
    const feed = aquarium.feed, episode = aquarium.starvation;
    const validStock = state.schemaVersion >= 4 ? !Object.hasOwn(supply, "stock") :
      !!supply.stock && !Array.isArray(supply.stock) && typeof supply.stock === "object" &&
      Object.entries(supply.stock).every(([id, count]) => Object.hasOwn(config.aquariumFeeds, id) && Number.isSafeInteger(count) && count >= 0);
    return validStock && Object.hasOwn(config.aquariumFeeds, supply.selectedFeedId) &&
      (feed === null || (!!feed && Object.hasOwn(config.aquariumFeeds, feed.itemId) &&
        Number.isFinite(feed.durationMs) && feed.durationMs > 0 && Number.isFinite(feed.remainingMs) &&
        feed.remainingMs >= 0 && feed.remainingMs <= feed.durationMs && this.#validSeed(feed.seed))) &&
      (state.schemaVersion < 4 || feed === null || (Number.isSafeInteger(feed.quantity) && feed.quantity > 0)) &&
      (state.schemaVersion < 5 || feed === null || (Number.isFinite(feed.carriedMs) && feed.carriedMs >= 0 && feed.carriedMs < feed.durationMs)) &&
      (episode === null || (!!episode && Number.isFinite(episode.startedAtMs) && episode.startedAtMs >= 0 &&
        Number.isFinite(episode.windowMs) && episode.windowMs > 0 && this.#validSeed(episode.seed)));
  }
  #validSeed(seed) { return Number.isSafeInteger(seed) && seed >= 0 && seed < 4294967296; }
  #migrate(state, config) {
    const inhabitants = state.fish.filter((fish) => fish.disposition === "aquarium");
    const item = config.aquariumFeeds[config.defaultFeedId];
    const fraction = inhabitants.length ? Math.min(...inhabitants.map((fish) => state.aquarium.feedBySpecies[fish.speciesId] || 0)) : 0;
    const durationMs = Math.max(config.minimumFeedMs, item.durationMs - item.extraFishPenaltyMs * Math.max(0, inhabitants.length - 1));
    state.aquarium.feed = fraction > 0 ? { itemId: item.id, durationMs, remainingMs: fraction * durationMs, seed: 0 } : null;
    state.aquarium.starvation = inhabitants.length && fraction === 0 ? { startedAtMs: state.lastAppliedAtMs,
      windowMs: Math.max(1, ...inhabitants.map((fish) => fish.remainingLifetimeMs)), seed: 0 } : null;
    delete state.aquarium.feedBySpecies;
    state.feedSupply.stock = { [item.id]: state.feedSupply.portions };
    state.feedSupply.selectedFeedId = item.id;
    delete state.feedSupply.portions;
    for (const fish of state.fish) {
      fish.anomaly = typeof fish.anomaly === "string" ? fish.anomaly : null;
      fish.hasAnomaly = typeof fish.hasAnomaly === "boolean" ? fish.hasAnomaly : null;
      fish.isUnique = typeof fish.isUnique === "boolean" ? fish.isUnique : null;
      fish.starvationDeadlineMs = fish.disposition === "aquarium" && fraction === 0
        ? state.lastAppliedAtMs + fish.remainingLifetimeMs : null;
      delete fish.deathOrder;
    }
    state.schemaVersion = 3;
  }
}
