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
    for (const fish of filtered) {
      let group = bySpecies.get(fish.sourceSpeciesId);
      if (!group) {
        group = { id: fish.sourceSpeciesId, name: fish.name, imagePath: fish.imagePath,
          count: 0, totalWeightKg: 0, fish: [] };
        bySpecies.set(group.id, group);
      }
      if (!group.imagePath) group.imagePath = fish.imagePath;
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
