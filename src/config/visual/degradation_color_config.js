/**
 * Universal color scale for remaining-resource and condition degradation.
 * It is intentionally independent from item rarity and Power colors.
 * The warning colors mirror the fight HUD, while the direction is reversed:
 * low remaining value is dangerous, high remaining value is safe.
 */
const DEGRADATION_COLOR_CONFIG = (() => {
  const deepFreeze = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    for (const child of Object.values(value)) deepFreeze(child, seen);
    return Object.freeze(value);
  };

  return deepFreeze({
    revision: 1,
    range: { minimum: 0, maximum: 100 },
    colorStops: [
      { id: "empty", position: 0, color: [255, 0, 0] },
      { id: "critical", position: 1, color: [255, 0, 0] },
      { id: "danger", position: 34, color: [255, 128, 0] },
      { id: "warning", position: 67, color: [255, 255, 0] },
      { id: "safe", position: 100, color: [0, 255, 128] },
    ],
  });
})();
