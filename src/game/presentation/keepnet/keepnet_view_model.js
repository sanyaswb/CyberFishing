export class KeepnetViewModel {
  build(state, { kind = "all", speciesId = "all" } = {}) {
    const catches = state.keepnet.map((fish) => ({ ...fish, kind: "catch", remainingMs: null }));
    const live = state.liveBaits.filter((fish) => fish.location === "keepnet")
      .map((fish) => ({ ...fish, kind: "live_bait" }));
    const all = [...catches, ...live];
    const species = [...new Map(all.map((fish) => [fish.sourceSpeciesId, fish.name])).entries()]
      .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    const filtered = all.filter((fish) => (kind === "all" || kind === fish.kind) &&
      (speciesId === "all" || speciesId === fish.sourceSpeciesId));
    return { count: all.length, capacity: state.keepnetCapacity, liveCount: live.length,
      species, filtered, kind, speciesId, error: state.error };
  }
}
