export class LiveBaitSnapshotStore {
  #storage;
  #raw = null;
  constructor(storage) { this.#storage = storage; }
  load(nowMs, fishDb, config) {
    const loaded = this.#storage.read();
    if (!loaded.ok) return loaded;
    this.#raw = loaded.raw;
    if (loaded.raw === null) return { ok: true, state: this.#empty(nowMs) };
    let state;
    try { state = JSON.parse(loaded.raw); }
    catch { return { ok: false, reason: "corrupt_snapshot" }; }
    const known = new Set(fishDb.map((fish) => fish.id));
    const locations = new Set(["keepnet", "aquarium", "hook", "dead", "consumed", "released"]);
    const fish = state?.fish;
    if (state?.schemaVersion !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isFinite(state.lastAppliedAtMs) || state.lastAppliedAtMs < 0 ||
      !Array.isArray(fish) || !state.resolvedCatchIds || Array.isArray(state.resolvedCatchIds) ||
      typeof state.resolvedCatchIds !== "object" || !state.aquarium || !state.feedSupply ||
      !Number.isSafeInteger(state.feedSupply.portions) || state.feedSupply.portions < 0 ||
      typeof state.feedSupply.autoFeederOwned !== "boolean" ||
      typeof state.feedSupply.autoFeederEnabled !== "boolean" ||
      (state.feedSupply.autoFeederEnabled && !state.feedSupply.autoFeederOwned) ||
      typeof state.aquarium.owned !== "boolean" || !Number.isSafeInteger(state.aquarium.level) ||
      state.aquarium.level < 0 || state.aquarium.level > config.capacities.length ||
      state.aquarium.owned !== (state.aquarium.level > 0) ||
      !state.aquarium.feedBySpecies || Array.isArray(state.aquarium.feedBySpecies) ||
      typeof state.aquarium.feedBySpecies !== "object" ||
      Object.keys(state.aquarium.feedBySpecies).some((speciesId) => !known.has(speciesId)) ||
      Object.values(state.resolvedCatchIds).some((outcome) => !["claim", "release", "live_bait"].includes(outcome)) ||
      Object.values(state.aquarium.feedBySpecies).some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
      return { ok: false, reason: "invalid_snapshot" };
    }
    const ids = new Set();
    for (const entry of fish) {
      if (typeof entry.id !== "string" || !entry.id || ids.has(entry.id) || !known.has(entry.speciesId) ||
        !Object.hasOwn(state.resolvedCatchIds, entry.id) ||
        typeof entry.name !== "string" || typeof entry.imagePath !== "string" ||
        typeof entry.rarity !== "string" || !Number.isFinite(entry.level) ||
        !Number.isFinite(entry.weightKg) || entry.weightKg <= 0 || !locations.has(entry.disposition) ||
        !["catch", "live_bait"].includes(entry.purpose) || !Number.isFinite(entry.caughtAtMs) ||
        entry.caughtAtMs < 0 ||
        (entry.purpose === "catch" && !["keepnet", "released"].includes(entry.disposition)) ||
        (entry.purpose === "live_bait" && (!Number.isFinite(entry.deathOrder) ||
          entry.deathOrder < 0 || entry.deathOrder >= 1)) ||
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
    return { ok: true, state };
  }
  save(state) {
    const next = { ...state, revision: state.revision + 1 };
    const raw = JSON.stringify(next);
    const result = this.#storage.write(raw, this.#raw);
    if (!result.ok) return result;
    this.#raw = raw;
    state.revision = next.revision;
    return { ok: true, revision: next.revision };
  }
  #empty(nowMs) {
    return { schemaVersion: 1, revision: 0, lastAppliedAtMs: nowMs, fish: [], resolvedCatchIds: {},
      aquarium: { owned: false, level: 0, feedBySpecies: {} },
      feedSupply: { portions: 0, autoFeederOwned: false, autoFeederEnabled: false }, selectedFishId: null };
  }
}
