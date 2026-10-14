export class UiCatalogKeepnetFixture {
  #state;
  #mode = "normal";
  #remainingMs = 180000;
  constructor() { this.reset("normal"); }
  getView() { return this.#state; }
  advance() { /* Preview time is explicitly controlled; no clock is advanced. */ }
  reset(mode) {
    this.#mode = mode;
    const fish = (id, species, name, weightKg, imagePath) => ({ id, sourceSpeciesId: species, name, weightKg, imagePath,
      level: 1, rarity: { halfSteps: 3, maxHalfSteps: 12, unitsPerStar: 2 }, hasAnomaly: false, isUnique: false, canConvert: true });
    const crucianImage = "assets/fish/crucian_stalker/unique/crucian_stalker--1-uniq.webp";
    const keepnet = mode === "empty" ? [] : [fish("catalog-catch-1", "crucian_stalker", "Карась", .1, mode === "missing" ? "assets/catalog-missing.webp" : crucianImage),
      fish("catalog-catch-2", "crucian_stalker", "Карась", .08, crucianImage), fish("catalog-catch-3", "pike", "Щука", .7, "")];
    const liveBaits = mode === "empty" ? [] : [{ ...fish("catalog-live", "crucian_stalker", "Карась", .05, crucianImage), location: "keepnet", selected: true, remainingMs: this.#remainingMs }];
    this.#state = { keepnet, liveBaits, keepnetCapacity: mode === "zero" ? 0 : mode === "over" ? 2 : 100,
      keepnetReservedCount: mode === "reserved" ? 1 : 0, aquarium: { owned: true, count: 0, capacity: 5 }, error: mode === "error" ? "stale_revision" : null };
  }
  setValue(seconds) { this.#remainingMs = Math.max(0, Number(seconds) || 0) * 1000; for (const fish of this.#state.liveBaits) fish.remainingMs = this.#remainingMs; }
  releaseCatch(id) { return this.#remove("keepnet", id); }
  releaseBait(id) { return this.#remove("liveBaits", id); }
  selectBait(id) {
    if (this.#mode === "error") return { ok: false, reason: "stale_revision" };
    for (const fish of this.#state.liveBaits) fish.selected = fish.id === id;
    return { ok: true };
  }
  transferToAquarium(id) {
    const fish = this.#state.liveBaits.find((entry) => entry.id === id);
    if (!fish) return { ok: false, reason: "not_found" };
    fish.location = "aquarium"; fish.remainingMs = null; this.#state.aquarium.count++;
    return { ok: true };
  }
  convertStoredCatch(id) {
    const index = this.#state.keepnet.findIndex((entry) => entry.id === id);
    if (index < 0) return { ok: false, reason: "not_found" };
    const [fish] = this.#state.keepnet.splice(index, 1);
    this.#state.liveBaits.push({ ...fish, location: "keepnet", remainingMs: this.#remainingMs, selected: false });
    return { ok: true };
  }
  #remove(collection, id) {
    if (this.#mode === "error") return { ok: false, reason: "stale_revision" };
    const index = this.#state[collection].findIndex((entry) => entry.id === id);
    if (index < 0) return { ok: false, reason: "not_found" };
    this.#state[collection].splice(index, 1);
    return { ok: true };
  }
}
