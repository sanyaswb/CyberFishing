export class FeedSlotPriorityPolicy {
  choose(slots) {
    let chosen = null;
    for (const slot of slots) {
      if (slot.foodFraction >= 1) continue;
      if (!chosen || slot.foodFraction < chosen.foodFraction ||
        (slot.foodFraction === chosen.foodFraction && slot.count > chosen.count) ||
        (slot.foodFraction === chosen.foodFraction && slot.count === chosen.count && slot.speciesId < chosen.speciesId)) chosen = slot;
    }
    return chosen;
  }
}
