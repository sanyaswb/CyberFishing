export class CaughtFishCollection {
  constructor(fish = [], resolvedCatchIds = {}) {
    this.fish = fish;
    this.resolvedCatchIds = resolvedCatchIds;
  }
  get(id) { return this.fish.find((fish) => fish.id === id) ?? null; }
  resolve(id, outcome, fish = null) {
    if (Object.hasOwn(this.resolvedCatchIds, id)) return false;
    if (fish && this.get(id)) return false;
    this.resolvedCatchIds[id] = outcome;
    if (fish) this.fish.push(fish);
    return true;
  }
  countAt(location) { return this.fish.filter((fish) => fish.disposition === location).length; }
  livingBait() { return this.fish.filter((fish) => fish.purpose === "live_bait" && ["keepnet", "aquarium", "hook"].includes(fish.disposition)); }
}
