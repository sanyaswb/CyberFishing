/**
 * Helpers for composing fish physics profiles from presets + per-species overrides.
 * The factory never mutates the preset or override inputs.
 */
function cloneFishProfileValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneFishProfileValue(item));
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = cloneFishProfileValue(child);
    }
    return output;
  }
  return value;
}

function mergeFishProfileValues(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return cloneFishProfileValue(override !== undefined ? override : base);
  }
  if (!base || typeof base !== "object") {
    return cloneFishProfileValue(override !== undefined ? override : base);
  }
  if (!override || typeof override !== "object") {
    return cloneFishProfileValue(override !== undefined ? override : base);
  }

  const output = cloneFishProfileValue(base);
  for (const [key, value] of Object.entries(override)) {
    output[key] = mergeFishProfileValues(output[key], value);
  }
  return output;
}

function createFishPhysicsProfile(preset = {}, overrides = {}) {
  return mergeFishProfileValues(preset || {}, overrides || {});
}

function createFishFromPreset(baseFishConfig = {}, preset = {}, physicsOverrides = {}) {
  return {
    ...cloneFishProfileValue(baseFishConfig),
    physics: createFishPhysicsProfile(preset, physicsOverrides),
  };
}
