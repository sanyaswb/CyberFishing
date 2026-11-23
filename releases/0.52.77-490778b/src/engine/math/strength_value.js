import { clampUnit, finiteOr } from "./number_normalization.js";

// Spec 187 D15 (owner: «Погоджую»): a value set by its two ends — «від» at the least visible strength (VISIBLE_STRENGTH)
// and «до» at full strength — mixed linearly between them.
export const VISIBLE_STRENGTH = 0.05;

// A look's value (it has no «no effect» value): «від» from the visible strength down, «до» at 1.
export function strengthValue(from, to, strength) {
  const level = clampUnit(finiteOr(strength, 0));
  if (level <= VISIBLE_STRENGTH) return from;
  return from + (to - from) * (level - VISIBLE_STRENGTH) / (1 - VISIBLE_STRENGTH);
}

// Spec 187 D7: an effect of an element on others (a storm's raise of the rain's chance, the wind's slant): `neutral` with
// the element off (strength 0), rising linearly to «від» at the visible strength, then to «до» at 1 — so a pair made
// from an old multiplier (від = its value at the visible strength) acts exactly as the multiplier did. A level above 1
// (the wind's strength plus its gust) goes on along the same line, as the multiplier did.
export function effectValue(neutral, from, to, strength) {
  const level = Math.max(0, finiteOr(strength, 0));
  if (level <= 0) return neutral;
  if (level < VISIBLE_STRENGTH) return neutral + (from - neutral) * level / VISIBLE_STRENGTH;
  return from + (to - from) * (level - VISIBLE_STRENGTH) / (1 - VISIBLE_STRENGTH);
}

// An effect read from its config pair [від, до] (or neutral when it is missing or not a pair).
export function effectOfPair(pair, neutral, strength) {
  if (!Array.isArray(pair) || pair.length !== 2) return neutral;
  const from = finiteOr(pair[0], neutral);
  return effectValue(neutral, from, finiteOr(pair[1], from), strength);
}
