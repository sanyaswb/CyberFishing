// Spec 179 D12 (TK-371, owner Q20): the player goes into the house only with the tackle put away — nothing in the rod,
// reel, terminal line, rig, float or delivery slots. The gas mask, the landing net, the radio and the hand chum may stay
// (the statuses — buffs — go along anyway).
const TACKLE_SLOTS = Object.freeze(["rod", "reel", "terminalLine", "tackle", "float", "delivery"]);

export class HouseEntryPolicy {
  // equipped: the equipment read model ({ rod, reel, terminalLine, tackle, float, delivery, … }).
  canEnter(equipped) {
    return !TACKLE_SLOTS.some((slot) => Boolean(equipped?.[slot]));
  }
}
