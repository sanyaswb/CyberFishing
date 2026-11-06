// Live bait by species (spec 162): once the chosen live bait is used up, dies or is released, the next live bait of the
// same species takes its place: the one with the least life left (keepnet and hook timers), aquarium fish (no timer)
// last, then the lighter one and the id for a stable order. No such fish clears the choice.
export class LiveBaitSuccession {
  // The id of the next live bait of speciesId in state, other than excludedId, or null.
  static next(state, speciesId, excludedId = null) {
    let best = null;
    let bestKey = null;
    for (const fish of state.fish) {
      if (fish.id === excludedId || fish.speciesId !== speciesId || fish.purpose !== "live_bait") continue;
      if (fish.disposition !== "keepnet" && fish.disposition !== "aquarium") continue;
      if (fish.disposition === "keepnet" && !(fish.remainingLifetimeMs > 0)) continue;
      const key = [fish.disposition === "aquarium" ? Infinity : fish.remainingLifetimeMs, fish.weightKg, fish.id];
      if (!bestKey || LiveBaitSuccession.#before(key, bestKey)) { best = fish; bestKey = key; }
    }
    return best ? best.id : null;
  }

  // Moves the choice from the fish that left (used up, dead, released) to the next of its species.
  static replace(state, leaving) {
    if (state.selectedFishId !== leaving.id) return;
    state.selectedFishId = LiveBaitSuccession.next(state, leaving.speciesId, leaving.id);
  }

  static #before(left, right) {
    for (let index = 0; index < left.length; index++) {
      if (left[index] < right[index]) return true;
      if (left[index] > right[index]) return false;
    }
    return false;
  }
}
