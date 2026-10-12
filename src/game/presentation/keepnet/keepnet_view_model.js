export class KeepnetViewModel {
  build(state, { kind = "all", speciesId = "all" } = {}) {
    const catches = state.keepnet.map((fish) => ({ ...fish, kind: "catch", remainingMs: null }));
    const live = state.liveBaits.filter((fish) => fish.location === "keepnet")
      .map((fish) => ({ ...fish, kind: "live_bait" }));
    const all = [...catches, ...live];
    const species = [...new Map(all.map((fish) => [fish.sourceSpeciesId, fish.name])).entries()]
      .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "uk"));
    if (!species.some((item) => item.id === speciesId)) speciesId = "all";
    const filtered = all.filter((fish) => (kind === "all" || kind === fish.kind) &&
      (speciesId === "all" || speciesId === fish.sourceSpeciesId))
      .sort((a, b) => b.weightKg - a.weightKg || a.id.localeCompare(b.id));
    const bySpecies = new Map();
    const rarityScore = (fish) => typeof fish.rarity === "object" && fish.rarity !== null ? fish.rarity.halfSteps / fish.rarity.maxHalfSteps : -1;
    for (const fish of filtered) {
      const separate = fish.hasAnomaly !== false || fish.isUnique !== false;
      const key = separate ? `fish:${fish.id}` : fish.sourceSpeciesId;
      let group = bySpecies.get(key);
      if (!group) {
        group = { id: key, name: fish.name, imagePath: fish.imagePath,
          count: 0, totalWeightKg: 0, fish: [] };
        bySpecies.set(group.id, group);
      }
      const current = group.fish.find((entry) => entry.id === group.representativeId);
      if (!current || rarityScore(fish) > rarityScore(current) ||
        (rarityScore(fish) === rarityScore(current) && fish.weightKg > current.weightKg)) {
        group.imagePath = fish.imagePath;
        group.representativeId = fish.id;
      }
      group.fish.push(fish);
      group.count++;
      group.totalWeightKg += fish.weightKg;
    }
    const groups = [...bySpecies.values()].sort((a, b) => a.name.localeCompare(b.name, "uk"));
    return { count: all.length, capacity: state.keepnetCapacity, liveCount: live.length,
      reservedCount: state.keepnetReservedCount || 0, aquarium: state.aquarium,
      species, groups, filtered, kind, speciesId, error: state.error };
  }
}
