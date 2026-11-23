export class LiveBaitBaitCandidatePort {
  #service;
  #fishDb;
  #candidate = { itemId: "", instanceId: "", itemType: "bait", effectiveStats: {} };
  constructor(service, fishDb = []) { this.#service = service; this.#fishDb = new Map(fishDb.map((fish) => [fish.id, fish])); }
  appendIfHooked(equipment, candidates) {
    const live = this.#service.getSelectedBait();
    if (!live || live.disposition !== "hook") return;
    if ((equipment?.hooks || []).filter(Boolean).length !== 1 || (equipment?.baits || []).some(Boolean)) return;
    this.#candidate.itemId = live.baitId;
    this.#candidate.instanceId = live.fishId;
    candidates.push(this.#candidate);
  }
  fishIdForBite(fish) {
    const live = this.#service.getSelectedBait();
    if (!live || live.disposition !== "hook") return null;
    const species = this.#fishDb.get(fish?.id);
    return Number(species?.baitMultipliers?.[live.baitId]) > 0 ? live.fishId : null;
  }
}
