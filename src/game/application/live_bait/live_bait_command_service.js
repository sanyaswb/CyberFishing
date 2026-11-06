import { AquariumState } from "../../domain/live_bait/aquarium_state.js";
import { FeedSupplyState } from "../../domain/live_bait/feed_supply_state.js";
import { CatchDispositionService } from "./catch_disposition_service.js";
import { CaughtFishRarity } from "../../domain/live_bait/caught_fish_rarity.js";
import { LiveBaitSuccession } from "../../domain/live_bait/live_bait_succession.js";

export class LiveBaitCommandService {
  #config;
  #fishDb;
  #store;
  #clock;
  #rng;
  #care;
  #state;
  #error = null;
  #catchDisposition;
  #inventoryPort;
  constructor({ config, fishDb, store, clock, rng, care, inventoryPort }) {
    this.#config = config;
    this.#fishDb = new Map(fishDb.map((fish) => [fish.id, fish]));
    this.#store = store;
    this.#clock = clock;
    this.#rng = rng;
    this.#care = care;
    this.#inventoryPort = inventoryPort;
    this.#catchDisposition = new CatchDispositionService({ config, fishDb, rng });
    const loaded = store.load(clock.nowMs(), fishDb, config);
    if (!loaded.ok) this.#error = loaded.reason;
    else {
      this.#state = loaded.state;
      this.advance();
      // Spec 162: catches kept before auto live bait that suit live bait become live baits once.
      if (this.#state.fish.some((fish) => fish.purpose === "catch" && fish.disposition === "keepnet" && this.canConvert(fish))) {
        this.#commit((state) => (this.#catchDisposition.convertEligibleStored(state) ? null : "nothing_to_convert"));
      }
    }
  }
  get error() { return this.#error; }
  synchronizeInventory() { this.#inventoryPort.synchronize(); }
  canConvert(fish) { return this.#catchDisposition.canConvert(fish); }
  createCatchId() { return `catch-${this.#clock.nowMs()}-${this.#state?.revision ?? 0}-${Math.floor(this.#rng.next() * 0x100000000).toString(36)}`; }
  resolveCatch(catchId, fish, action) {
    const result = this.#commit((state) => this.#catchDisposition.resolve(state, catchId, fish, action));
    if (!result.ok || action !== "live_bait") return result;
    const retained = this.#state.fish.find((entry) => entry.id === catchId);
    return { ...result, fishId: catchId, disposition: retained.disposition,
      notice: retained.disposition === "keepnet" && this.#state.aquarium.owned ? "aquarium_full" : null };
  }
  keepCatch(fish, catchId = this.createCatchId()) { return this.resolveCatch(catchId, fish, "claim"); }
  convertCatch(fish, catchId = this.createCatchId()) { return this.resolveCatch(catchId, fish, "live_bait"); }
  releaseCatch(id) { return this.#commit((state) => {
    const fish = state.fish.find((item) => item.id === id);
    if (!fish || fish.disposition !== "keepnet" || fish.purpose !== "catch") return "not_found";
    fish.disposition = "released"; return null;
  }); }
  releaseBait(id) { return this.#commit((state) => {
    const fish = state.fish.find((item) => item.id === id);
    if (!fish || fish.purpose !== "live_bait" || !["aquarium", "keepnet"].includes(fish.disposition)) return "bait_unavailable";
    // Spec 163 D1: the chosen live bait cannot be released.
    if (state.selectedFishId === id) return "bait_selected";
    fish.disposition = "released";
    LiveBaitSuccession.replace(state, fish);
    return null;
  }); }
  selectBait(id) { return this.#commit((state) => {
    if (state.fish.some((fish) => fish.disposition === "hook")) return "hook_busy";
    if (id === null) { state.selectedFishId = null; return null; }
    const fish = state.fish.find((item) => item.id === id);
    if (!fish || fish.purpose !== "live_bait" || !["aquarium", "keepnet"].includes(fish.disposition)) return "bait_unavailable";
    state.selectedFishId = id; return null;
  }); }
  selectLiveBait(id) { return this.selectBait(id); }
  getSelectedBait() {
    if (this.#error) return null;
    const fish = this.#state?.fish.find((entry) => entry.id === this.#state.selectedFishId);
    if (!fish || fish.purpose !== "live_bait" || !["aquarium", "keepnet", "hook"].includes(fish.disposition)) return null;
    const elapsed = Math.max(0, this.#clock.nowMs() - this.#state.lastAppliedAtMs);
    if (fish.disposition !== "aquarium" && fish.remainingLifetimeMs <= elapsed) return null;
    if (fish.disposition === "aquarium" && fish.starvationDeadlineMs !== null &&
      fish.starvationDeadlineMs <= this.#state.lastAppliedAtMs + elapsed) return null;
    return { fishId: fish.id, baitId: this.#config.baitId, sourceSpeciesId: fish.speciesId, weightKg: fish.weightKg, disposition: fish.disposition,
      name: fish.name, imagePath: fish.imagePath };
  }
  // TK-234: live baits of the chosen one's species that can still follow it onto the hook (not counting the chosen one).
  countSelectedReserve() {
    const selected = this.getSelectedBait();
    return selected ? LiveBaitSuccession.count(this.#state, selected.sourceSpeciesId, selected.fishId) : 0;
  }
  // Spec 163 D2/D6: the backpack shows (or stops showing) a stack of a species' live baits; the fish stay where they are.
  showSpeciesInInventory(speciesId) { return this.#commit((state) => {
    if (!LiveBaitSuccession.members(state, speciesId).length) return "bait_unavailable";
    if (state.inventorySpeciesIds.includes(speciesId)) return "already_shown";
    state.inventorySpeciesIds.push(speciesId); return null;
  }); }
  hideSpeciesFromInventory(speciesId) { return this.#commit((state) => {
    const index = state.inventorySpeciesIds.indexOf(speciesId);
    if (index < 0) return "not_shown";
    state.inventorySpeciesIds.splice(index, 1); return null;
  }); }
  // Spec 163 D2/D4: the backpack's stacks, one per shown species with live baits left: its fish (least life first, as
  // the successor is picked) with their life share (remaining / sampled lifetime; an aquarium fish without a starvation
  // deadline is full). Reads the current state without a care settlement, like getSelectedBait().
  getInventoryStacks() {
    if (this.#error || !this.#state) return [];
    const now = this.#clock.nowMs();
    const elapsed = Math.max(0, now - this.#state.lastAppliedAtMs);
    const stacks = [];
    for (const speciesId of this.#state.inventorySpeciesIds) {
      const fish = [];
      for (const entry of LiveBaitSuccession.members(this.#state, speciesId)) {
        const remainingMs = entry.disposition === "aquarium"
          ? entry.starvationDeadlineMs === null ? entry.sampledLifetimeMs : entry.starvationDeadlineMs - now
          : entry.remainingLifetimeMs - elapsed;
        if (remainingMs <= 0) continue;
        fish.push({ id: entry.id, name: entry.name, imagePath: entry.imagePath, weightKg: entry.weightKg, level: entry.level,
          location: entry.disposition, lifeShare: Math.min(1, remainingMs / entry.sampledLifetimeMs), remainingMs });
      }
      if (!fish.length) continue;
      fish.sort((left, right) => (left.location === "aquarium") - (right.location === "aquarium") ||
        left.remainingMs - right.remainingMs || left.weightKg - right.weightKg || (left.id < right.id ? -1 : 1));
      stacks.push({ speciesId, name: fish[0].name, imagePath: fish[0].imagePath, count: fish.length, fish });
    }
    return stacks;
  }
  beginLiveBaitCast(id, hookContext = {}) { return this.#commit((state) => {
    const fish = state.fish.find((entry) => entry.id === id);
    if (!fish || state.selectedFishId !== id || fish.purpose !== "live_bait" || !["keepnet", "aquarium"].includes(fish.disposition)) return "bait_unavailable";
    if (hookContext.compatible !== true || hookContext.free !== true || hookContext.hookCount !== 1) return "incompatible_hook";
    if (state.fish.some((entry) => entry.disposition === "hook")) return "hook_busy";
    if (fish.disposition === "aquarium" && state.fish.filter((entry) => entry.disposition === "keepnet").length >= this.#config.keepnetCapacity) return "keepnet_full";
    this.#leaveAquarium(state, fish); fish.disposition = "hook"; return null;
  }); }
  settleBaitLoss(id) { return this.#commit((state) => {
    const fish = state.fish.find((entry) => entry.id === id);
    if (!fish || fish.disposition === "consumed") return "already_consumed";
    if (fish.disposition !== "hook") return "bait_unavailable";
    fish.disposition = "consumed"; LiveBaitSuccession.replace(state, fish); return null;
  }); }
  endLiveBaitCast(id) { return this.#commit((state) => {
    const fish = state.fish.find((entry) => entry.id === id);
    if (!fish || fish.disposition !== "hook") return "bait_unavailable";
    fish.disposition = "keepnet"; return null;
  }); }
  recoverInterruptedCast() {
    if (this.#error) return { ok: false, reason: this.#error };
    if (!this.#state.fish.some((fish) => fish.disposition === "hook")) return { ok: true };
    return this.#commit((state) => {
      for (const fish of state.fish) if (fish.disposition === "hook") fish.disposition = "keepnet";
      return null;
    });
  }
  consumeSelectedBait() { const selected = this.getSelectedBait(); return selected ? this.settleBaitLoss(selected.fishId) : { ok: false, reason: "bait_unavailable" }; }
  buyAquarium() { return this.#commit((state) => new AquariumState(state.aquarium, this.#config.capacities).install() ? null : "already_owned"); }
  installAquarium() { return this.buyAquarium(); }
  upgradeAquarium() { return this.#commit((state) => new AquariumState(state.aquarium, this.#config.capacities).upgrade() ? null : "max_level"); }
  buyFeed(itemId = this.#config.defaultFeedId) { return this.#commit((state) => {
    if (!Object.hasOwn(this.#config.aquariumFeeds, itemId)) return "invalid_feed";
    new FeedSupplyState(state.feedSupply).acquire(itemId, this.#config.freeFeedPortions); return null;
  }); }
  getFeed(itemId) { return this.buyFeed(itemId); }
  selectAquariumFeed(itemId) { return this.#commit((state) => {
    if (!Object.hasOwn(this.#config.aquariumFeeds, itemId)) return "invalid_feed";
    if (!this.#care.canLoadFeed(state)) return "feed_locked";
    state.feedSupply.selectedFeedId = itemId; return null;
  }); }
  feedAquarium(itemId = null, quantity = 1) { return this.#commit((state) => {
    if (!state.aquarium.owned) return "aquarium_required";
    itemId ??= state.feedSupply.selectedFeedId;
    if (!Object.hasOwn(this.#config.aquariumFeeds, itemId)) return "invalid_feed";
    if (!Number.isSafeInteger(quantity) || quantity < 1) return "invalid_quantity";
    if (!state.fish.some((fish) => fish.disposition === "aquarium")) return "nothing_to_feed";
    if (!this.#care.canLoadFeed(state)) return "feed_locked";
    if (!new FeedSupplyState(state.feedSupply).consume(itemId, quantity)) return "no_feed";
    state.feedSupply.selectedFeedId = itemId;
    this.#care.feed(state, itemId, Math.floor(this.#rng.next() * 4294967296), quantity); return null;
  }); }
  buyAutoFeeder() { return this.#commit((state) => new FeedSupplyState(state.feedSupply).installFeeder() ? null : "already_owned"); }
  installAutoFeeder() { return this.buyAutoFeeder(); }
  setAutoFeeder(enabled) { return this.#commit((state) => new FeedSupplyState(state.feedSupply).setFeeder(enabled) ? null : "auto_feeder_required"); }
  transferToAquarium(id) { return this.#commit((state) => {
    const fish = state.fish.find((entry) => entry.id === id);
    if (!fish || fish.purpose !== "live_bait" || fish.disposition !== "keepnet") return "bait_unavailable";
    const aquarium = new AquariumState(state.aquarium, this.#config.capacities);
    if (!aquarium.owned) return "aquarium_required";
    if (state.fish.filter((item) => item.disposition === "aquarium").length >= aquarium.capacity) return "aquarium_full";
    fish.disposition = "aquarium"; return null;
  }); }
  advance() {
    if (this.#error) return { ok: false, reason: this.#error };
    const synced = this.#syncLatest();
    if (!synced.ok) return synced;
    const next = JSON.parse(JSON.stringify(this.#state));
    const stock = this.#loadStock(next);
    if (!stock.ok) return stock;
    const changed = this.#care.settle(next);
    const pruned = this.#pruneInventorySpecies(next);
    if (!changed && !pruned && !next.pendingLegacyStock) return { ok: true, revision: this.#state.revision };
    const saved = this.#save(next, stock);
    if (saved.ok) this.#state = next;
    else this.#handleSaveFailure(saved);
    return saved;
  }
  getView() {
    if (this.#error) return { error: this.#error, feedStock: 0, selectedBaitId: null, liveBaits: [], keepnet: [],
      keepnetCapacity: this.#config.keepnetCapacity, keepnetReservedCount: 0,
      feedItems: [], selectedFeedId: this.#config.defaultFeedId,
      aquarium: { owned: false, level: 0, capacity: 0, count: 0, canLoadFeed: false, feed: null, starvation: null, autoFeeder: { owned: false, enabled: false } }, deadCount: 0 };
    // Read-only event-time projection: the display must agree with the next care settlement,
    // including deaths and automatic refills, without writing on every display tick.
    const state = JSON.parse(JSON.stringify(this.#state));
    const stock = this.#loadStock(state);
    if (!stock.ok) { this.#error = stock.reason; return this.getView(); }
    this.#care.settle(state);
    const aquarium = new AquariumState(state.aquarium, this.#config.capacities);
    const feed = state.aquarium.feed;
    const now = state.lastAppliedAtMs;
    const liveBaits = state.fish.filter((fish) => fish.purpose === "live_bait" && ["keepnet", "aquarium", "hook"].includes(fish.disposition))
      .map((fish) => ({ ...this.#fishView(fish), location: fish.disposition,
        inInventory: state.inventorySpeciesIds.includes(fish.speciesId),
        remainingMs: fish.disposition === "aquarium" ? fish.starvationDeadlineMs === null ? null : Math.max(0, fish.starvationDeadlineMs - now)
          : fish.remainingLifetimeMs, selected: fish.id === state.selectedFishId }));
    const inhabitants = liveBaits.filter((fish) => fish.location === "aquarium");
    const starvation = state.aquarium.starvation;
    const feedView = feed ? { ...this.#config.aquariumFeeds[feed.itemId],
      quantity: feed.quantity, remainingMs: feed.remainingMs, durationMs: feed.durationMs,
      percentage: feed.durationMs > 0 ? feed.remainingMs / feed.durationMs * 100 : 0 } : null;
    return { error: null, feedStock: Object.values(state.feedSupply.stock).reduce((sum, count) => sum + count, 0),
      feedItems: Object.values(this.#config.aquariumFeeds).map((item) => ({ ...item, count: state.feedSupply.stock[item.id] || 0 })),
      selectedFeedId: state.feedSupply.selectedFeedId, selectedBaitId: state.selectedFishId, liveBaits,
      keepnet: state.fish.filter((fish) => fish.purpose === "catch" && fish.disposition === "keepnet")
        .map((fish) => ({ ...this.#fishView(fish), canConvert: this.canConvert(fish) })),
      keepnetCapacity: this.#config.keepnetCapacity,
      keepnetReservedCount: state.fish.filter((fish) => fish.disposition === "hook").length,
      aquarium: { owned: aquarium.owned, level: aquarium.level, capacity: aquarium.capacity,
        canLoadFeed: this.#care.canLoadFeed(state),
        count: state.fish.filter((fish) => fish.disposition === "aquarium").length,
        nextUpgradeCapacity: aquarium.level < this.#config.capacities.length ? this.#config.capacities[aquarium.level] : null,
        maxLevel: this.#config.capacities.length,
        autoFeeder: { owned: state.feedSupply.autoFeederOwned, enabled: state.feedSupply.autoFeederEnabled }, feed: feedView,
        starvation: starvation ? { remainingMs: Math.max(0, starvation.startedAtMs + starvation.windowMs - now),
          nextDeathMs: inhabitants.length ? Math.min(...inhabitants.map((fish) => fish.remainingMs)) : null } : null },
      prices: this.#config.prices,
      deadCount: state.fish.filter((fish) => fish.disposition === "dead").length };
  }
  #commit(mutate) {
    if (this.#error) return { ok: false, reason: this.#error };
    const synced = this.#syncLatest();
    if (!synced.ok) return synced;
    const next = JSON.parse(JSON.stringify(this.#state));
    const stock = this.#loadStock(next);
    if (!stock.ok) return stock;
    const settled = this.#care.settle(next);
    const reason = mutate(next);
    if (!reason) this.#care.synchronize(next);
    const pruned = this.#pruneInventorySpecies(next);
    if (reason && !settled && !pruned) return { ok: false, reason };
    const saved = this.#save(next, stock);
    if (saved.ok) this.#state = next;
    else this.#handleSaveFailure(saved);
    return saved.ok && reason ? { ok: false, reason } : saved;
  }
  #syncLatest() {
    const loaded = this.#store.load(this.#clock.nowMs(), [...this.#fishDb.values()], this.#config);
    if (!loaded.ok) { this.#error = loaded.reason; return loaded; }
    if (loaded.state.revision !== this.#state.revision) this.#state = loaded.state;
    return { ok: true };
  }
  #handleSaveFailure(result) {
    if (result.reason === "stale_revision") this.#syncLatest();
    else this.#error = result.reason;
  }
  #fishView(fish) {
    return { id: fish.id, sourceSpeciesId: fish.speciesId, name: fish.name, weightKg: fish.weightKg,
      level: fish.level, imagePath: fish.imagePath, rarity: CaughtFishRarity.capture(fish.rarity),
      anomaly: fish.anomaly, hasAnomaly: fish.hasAnomaly, isUnique: fish.isUnique };
  }
  #loadStock(state) {
    const plan = this.#inventoryPort.read();
    if (!plan.ok) return plan;
    state.feedSupply.stock = { ...plan.stock };
    for (const [id, quantity] of Object.entries(state.pendingLegacyStock || {}))
      state.feedSupply.stock[id] = (state.feedSupply.stock[id] || 0) + quantity;
    return plan;
  }
  #save(state, plan) {
    const prepared = this.#inventoryPort.prepare(plan, state.feedSupply.stock);
    if (!prepared.ok) return prepared;
    const saved = this.#store.save(state, prepared.changes);
    if (saved.ok) {
      delete state.pendingLegacyStock;
      if (prepared.changes.length) this.#inventoryPort.synchronize(prepared.snapshot);
      delete state.feedSupply.stock;
    }
    return saved;
  }
  // Spec 163 D5: a species whose last live bait is used up, dead or released leaves the backpack.
  #pruneInventorySpecies(state) {
    const kept = state.inventorySpeciesIds.filter((id) => LiveBaitSuccession.members(state, id).length > 0);
    if (kept.length === state.inventorySpeciesIds.length) return false;
    state.inventorySpeciesIds = kept;
    return true;
  }
  #leaveAquarium(state, fish) {
    if (fish.disposition === "aquarium" && fish.starvationDeadlineMs !== null)
      fish.remainingLifetimeMs = Math.min(fish.remainingLifetimeMs, Math.max(0, fish.starvationDeadlineMs - state.lastAppliedAtMs));
    fish.starvationDeadlineMs = null;
  }
}
