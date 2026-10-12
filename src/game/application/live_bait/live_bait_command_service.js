import { AquariumState } from "../../domain/live_bait/aquarium_state.js";
import { FeedSlotPriorityPolicy } from "../../domain/live_bait/feed_slot_priority_policy.js";
import { FeedSupplyState } from "../../domain/live_bait/feed_supply_state.js";
import { AquariumCareCalculator } from "../../domain/live_bait/aquarium_care_calculator.js";
import { CatchDispositionService } from "./catch_disposition_service.js";
import { CaughtFishRarity } from "../../domain/live_bait/caught_fish_rarity.js";

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
  #priority = new FeedSlotPriorityPolicy();
  constructor({ config, fishDb, store, clock, rng, care }) {
    this.#config = config;
    this.#fishDb = new Map(fishDb.map((fish) => [fish.id, fish]));
    this.#store = store;
    this.#clock = clock;
    this.#rng = rng;
    this.#care = care;
    this.#catchDisposition = new CatchDispositionService({ config, fishDb, rng });
    const loaded = store.load(clock.nowMs(), fishDb, config);
    if (!loaded.ok) this.#error = loaded.reason;
    else {
      this.#state = loaded.state;
      this.advance();
    }
  }
  get error() { return this.#error; }
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
    fish.disposition = "released";
    if (state.selectedFishId === id) state.selectedFishId = null;
    this.#pruneSlots(state); return null;
  }); }
  convertStoredCatch(id) { return this.#commit((state) => this.#catchDisposition.convertStored(state, id)); }
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
    const rule = this.#config.eligibility[fish.speciesId];
    if (!rule || (fish.disposition !== "aquarium" &&
      fish.remainingLifetimeMs <= Math.max(0, this.#clock.nowMs() - this.#state.lastAppliedAtMs))) return null;
    return { fishId: fish.id, baitId: rule.baitId, sourceSpeciesId: fish.speciesId, weightKg: fish.weightKg, disposition: fish.disposition };
  }
  beginLiveBaitCast(id, hookContext = {}) { return this.#commit((state) => {
    const fish = state.fish.find((entry) => entry.id === id);
    if (!fish || state.selectedFishId !== id || fish.purpose !== "live_bait" || !["keepnet", "aquarium"].includes(fish.disposition)) return "bait_unavailable";
    if (hookContext.compatible !== true || hookContext.free !== true || hookContext.hookCount !== 1) return "incompatible_hook";
    if (state.fish.some((entry) => entry.disposition === "hook")) return "hook_busy";
    if (fish.disposition === "aquarium" && state.fish.filter((entry) => entry.disposition === "keepnet").length >= this.#config.keepnetCapacity) return "keepnet_full";
    fish.disposition = "hook"; this.#pruneSlots(state); return null;
  }); }
  settleBaitLoss(id) { return this.#commit((state) => {
    const fish = state.fish.find((entry) => entry.id === id);
    if (!fish || fish.disposition === "consumed") return "already_consumed";
    if (fish.disposition !== "hook") return "bait_unavailable";
    fish.disposition = "consumed"; if (state.selectedFishId === id) state.selectedFishId = null; return null;
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
  buyFeed() { return this.#commit((state) => { new FeedSupplyState(state.feedSupply).acquire(this.#config.freeFeedPortions); return null; }); }
  getFeed() { return this.buyFeed(); }
  feedAquarium() { return this.#commit((state) => {
    if (!state.aquarium.owned) return "aquarium_required";
    if (state.feedSupply.portions <= 0) return "no_feed";
    const slot = this.#priority.choose(this.#slots(state));
    if (!slot) return "nothing_to_feed";
    state.aquarium.feedBySpecies[slot.speciesId] = 1;
    state.feedSupply.portions--; return null;
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
    fish.disposition = "aquarium"; aquarium.ensureSlot(fish.speciesId); return null;
  }); }
  advance() {
    if (this.#error) return { ok: false, reason: this.#error };
    const synced = this.#syncLatest();
    if (!synced.ok) return synced;
    const next = JSON.parse(JSON.stringify(this.#state));
    if (!this.#care.settle(next)) return { ok: true, revision: this.#state.revision };
    const saved = this.#store.save(next);
    if (saved.ok) this.#state = next;
    else this.#handleSaveFailure(saved);
    return saved;
  }
  getView() {
    if (this.#error) return { error: this.#error, feedStock: 0, selectedBaitId: null, liveBaits: [], keepnet: [],
      keepnetCapacity: this.#config.keepnetCapacity, keepnetReservedCount: 0,
      aquarium: { owned: false, level: 0, capacity: 0, count: 0, slots: [], autoFeeder: { owned: false, enabled: false } }, deadCount: 0 };
    // Read-only event-time projection: the display must agree with the next care settlement,
    // including deaths and automatic refills, without writing on every display tick.
    const state = JSON.parse(JSON.stringify(this.#state));
    this.#care.settle(state);
    const aquarium = new AquariumState(state.aquarium, this.#config.capacities);
    const calculator = new AquariumCareCalculator(this.#config);
    const slotsNow = this.#slots(state).map((slot) => ({ ...slot,
      protectionMs: calculator.timeToEmpty(slot.foodFraction, slot.count),
    }));
    const liveBaits = state.fish.filter((fish) => fish.purpose === "live_bait" && ["keepnet", "aquarium", "hook"].includes(fish.disposition))
      .map((fish) => ({ id: fish.id, sourceSpeciesId: fish.speciesId, name: fish.name, weightKg: fish.weightKg,
        level: fish.level, imagePath: fish.imagePath, rarity: CaughtFishRarity.capture(fish.rarity), location: fish.disposition,
        remainingMs: fish.disposition === "aquarium" && state.aquarium.feedBySpecies[fish.speciesId] > 0
          ? null : fish.remainingLifetimeMs,
        selected: fish.id === state.selectedFishId }));
    const slots = slotsNow.map((slot) => ({ sourceSpeciesId: slot.speciesId,
      name: this.#fishDb.get(slot.speciesId)?.name || slot.speciesId, count: slot.count,
      foodPercent: slot.foodFraction * 100, remainingFeedMs: slot.foodFraction * this.#config.oneFishFeedMs /
        (1 + (slot.count - 1) * this.#config.extraFishDrainFactor),
      starving: slot.foodFraction <= 0, nextDeathAt: slot.foodFraction <= 0 ?
        Math.min(...state.fish.filter((fish) => fish.disposition === "aquarium" && fish.speciesId === slot.speciesId)
          .map((fish) => state.lastAppliedAtMs + slot.protectionMs + fish.remainingLifetimeMs)) : null }));
    const nextFeed = this.#priority.choose(slotsNow);
    return { error: null, feedStock: state.feedSupply.portions, selectedBaitId: state.selectedFishId, liveBaits,
      keepnet: state.fish.filter((fish) => fish.purpose === "catch" && fish.disposition === "keepnet")
        .map((fish) => ({ id: fish.id, sourceSpeciesId: fish.speciesId, name: fish.name, weightKg: fish.weightKg, level: fish.level,
          imagePath: fish.imagePath, rarity: CaughtFishRarity.capture(fish.rarity), canConvert: this.canConvert(fish) })),
      keepnetCapacity: this.#config.keepnetCapacity,
      keepnetReservedCount: state.fish.filter((fish) => fish.disposition === "hook").length,
      aquarium: { owned: aquarium.owned, level: aquarium.level, capacity: aquarium.capacity,
        count: state.fish.filter((fish) => fish.disposition === "aquarium").length,
        nextUpgradeCapacity: aquarium.level < this.#config.capacities.length ? this.#config.capacities[aquarium.level] : null,
        maxLevel: this.#config.capacities.length,
        autoFeeder: { owned: state.feedSupply.autoFeederOwned, enabled: state.feedSupply.autoFeederEnabled }, slots },
      nextFeedSpeciesId: nextFeed?.speciesId ?? null, prices: this.#config.prices,
      deadCount: state.fish.filter((fish) => fish.disposition === "dead").length };
  }
  #commit(mutate) {
    if (this.#error) return { ok: false, reason: this.#error };
    const synced = this.#syncLatest();
    if (!synced.ok) return synced;
    const next = JSON.parse(JSON.stringify(this.#state));
    const settled = this.#care.settle(next);
    const reason = mutate(next);
    if (reason && !settled) return { ok: false, reason };
    const saved = this.#store.save(next);
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
  #slots(state) {
    const counts = new Map();
    for (const fish of state.fish) if (fish.disposition === "aquarium") counts.set(fish.speciesId, (counts.get(fish.speciesId) || 0) + 1);
    return [...counts].map(([speciesId, count]) => ({ speciesId, count, foodFraction: state.aquarium.feedBySpecies[speciesId] || 0 }));
  }
  #pruneSlots(state) {
    const occupied = new Set(state.fish.filter((fish) => fish.disposition === "aquarium").map((fish) => fish.speciesId));
    for (const id of Object.keys(state.aquarium.feedBySpecies)) if (!occupied.has(id)) delete state.aquarium.feedBySpecies[id];
  }
}
