// Spec 184 D2 (TK-375): items spent one piece at a time and kept as one stack in the backpack. A new piece of such an
// item (a grant, a purchase) joins an identical stack instead of starting its own; identical loose stacks from an older
// save join on load. Packs (worms, chum mixes) are not here: each pack is its own card (spec 164), however many there
// are; tackle and devices keep their own condition and stay apart.
const STACKED_TYPES = Object.freeze(new Set(["drink", "aquarium_feed"]));

// definition: the item's catalog definition ({ itemType, packSize }) or null.
export function stacksAsOne(definition) {
  if (!definition || !STACKED_TYPES.has(definition.itemType)) return false;
  return Math.max(1, Math.floor(Number(definition.packSize) || 1)) === 1;
}
