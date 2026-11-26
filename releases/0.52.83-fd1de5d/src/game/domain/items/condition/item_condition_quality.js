// Spec 179 D10 (TK-370, owner Q15): an item's condition (effectiveStats.durability 0…100) and what it does.
// - The worse the condition, the lower the quality the item works with: 1 + (quality − 1) × (condition / 100)^curve —
//   the authored quality at 100, 1 at 0. The quality's consumers (hook, rig, floats, lures, net) read it as usual.
// - At 0 the item is broken: no casting with it, a gas mask stops protecting.
// An item without a condition (no durability stat) is never worn or broken.
export function itemCondition(item) {
  const value = Number(item?.effectiveStats?.durability);
  return Number.isFinite(value) ? value : null;
}

export function isItemBroken(item) {
  const condition = itemCondition(item);
  return condition !== null && condition <= 0;
}

export function wornQuality(quality, condition, curve = 1) {
  const share = Math.max(0, Math.min(100, condition)) / 100;
  const exponent = Number.isFinite(curve) && curve > 0 ? curve : 1;
  return 1 + (quality - 1) * Math.pow(share, exponent);
}
