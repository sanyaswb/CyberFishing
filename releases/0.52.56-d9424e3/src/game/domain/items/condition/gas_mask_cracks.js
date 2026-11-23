// Spec 185 D6 (TK-384, owner: «тріщини будуть з'являтися по мірі погіршення стану 80% 60% 40% 20% і 0%»): the crack stage
// of a gas mask by its condition — 0 (whole, above the first threshold) … crackAtPercent.length (at the last: cracked
// through). crackAtPercent: falling percents (CONFIG.emission.gasMask.crackAtPercent).
export function gasMaskCrackStage(condition, crackAtPercent) {
  const value = Number(condition);
  if (!Number.isFinite(value) || !Array.isArray(crackAtPercent)) return 0;
  let stage = 0;
  for (const at of crackAtPercent) if (value <= at) stage += 1;
  return stage;
}
