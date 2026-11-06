const NUMBER_RANGES = Object.freeze([["fishSizePx", 1, 200], ["sizeSpread", 0, .95],
  ["speedMinPxPerSecond", 0, 100], ["speedMaxPxPerSecond", 0, 100],
  ["directionMinMs", 1, Infinity], ["directionMaxMs", 1, Infinity], ["gridSizePx", 1, 100]]);

// The one rule set for CONFIG.liveBait.visual: the schema reports it, the aquarium motion rejects live edits by it.
// Returns [relativePath, message] pairs; an empty list means the settings are usable.
export function aquariumVisualIssues(visual) {
  const issues = [];
  const settings = visual && typeof visual === "object" ? visual : {};
  const requireNumber = (path, value, min, max) => {
    if (typeof value !== "number" || !Number.isFinite(value)) issues.push([path, `expected finite number, got ${value}`]);
    else if (value < min) issues.push([path, `expected >= ${min}, got ${value}`]);
    else if (value > max) issues.push([path, `expected <= ${max}, got ${value}`]);
  };
  for (const [key, min, max] of NUMBER_RANGES) requireNumber(key, settings[key], min, max);
  if (typeof settings.showZone !== "boolean") issues.push(["showZone", "expected boolean"]);
  const zone = settings.zone && typeof settings.zone === "object" ? settings.zone : {};
  for (const key of ["x", "y", "width", "height"]) requireNumber(`zone.${key}`, zone[key], 0, 1);
  if (!(zone.width > 0 && zone.height > 0) || zone.x + zone.width > 1 || zone.y + zone.height > 1)
    issues.push(["zone", "expected positive bounded zone"]);
  if (settings.speedMinPxPerSecond > settings.speedMaxPxPerSecond || settings.directionMinMs > settings.directionMaxMs)
    issues.push(["", "minimum exceeds maximum"]);
  return issues;
}

export function isUsableAquariumVisual(visual) {
  return aquariumVisualIssues(visual).length === 0;
}
