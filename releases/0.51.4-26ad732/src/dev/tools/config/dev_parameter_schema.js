// What DevTools knows about a parameter beyond its type (spec 174 A3, TK-283): the control that edits it and where its
// options come from. One place instead of path checks in the tree renderer; stage B2 adds steps and limits here.
//
// A rule matches a whole path ("CONFIG.debug.fixedCatch.fishId"), a `pattern` over the path (one rule for every location
// or radio effect) or, with `key`, the last path segment anywhere.
// - segments: a short list, every option visible;
// - choice: a list picker; `source` names a list the composition supplies (fish: the species of FISH_DB).
const RULES = Object.freeze([
  { path: "CONFIG.ui.inventorySelector.size", control: "segments", values: [1, 2, 3] },
  { path: "CONFIG.ui.inventorySelector.openSize", control: "segments", values: [1, 2, 3] },
  { path: "CONFIG.ui.inventorySelector.compactShape", control: "segments", values: ["half", "arc"] },
  { path: "CONFIG.ui.inventorySelector.compactPlacement", control: "segments", values: ["center", "right", "left"] },
  { path: "CONFIG.ui.inventorySelector.compactActionsSide", control: "segments", values: ["right", "left"] },
  { key: "currentMethod", type: "string", control: "segments", values: ["hand", "boat"] },
  { key: "defaultSide", type: "string", control: "segments", values: ["right", "left"] },
  { path: "CONFIG.debug.fixedCatch.fishId", control: "choice", source: "fish" },
  // TK-320: text parameters with a fixed set of modes, each set as the code that reads it accepts it.
  // GameplayOverrideReader.biteSequenceMode / BiteSystem: anything else is "default".
  { path: "CONFIG.debug.godMode.biteSequenceMode", control: "segments", values: ["default", "normal", "guaranteed"] },
  // scene_layer_composition: the WebGL scene or the 2D canvas only.
  { path: "CONFIG.canvas.scene", control: "segments", values: ["webgl", "canvas"] },
  // ConfigSchemaValidator: "rod" or "tackle".
  { path: "CONFIG.locations.cameraFollowPriority", control: "segments", values: ["rod", "tackle"] },
  // FightPhysicsConfigAdapter: "split", anything else is "independent".
  { path: "CONFIG.physics.fight.playerForceBudget.allocationMode", control: "segments", values: ["independent", "split"] },
  // ConfigSchemaValidator: "reel_hold" or "reel_hold_session".
  { path: "CONFIG.physics.fight.playerPressureFatigue.source.mode", control: "segments",
    values: ["reel_hold", "reel_hold_session"] },
  // FightPhysicsOrchestrator: "cast_base", anything else follows the current base.
  { path: "CONFIG.physics.fight.rodControl.alignment.targetAnchorMode", control: "segments",
    values: ["cast_base", "current_base"] },
  // ConfigSchemaValidator: "tension" or "rodStress".
  { path: "CONFIG.ui.rod.spine.bendSource", control: "segments", values: ["tension", "rodStress"] },
  // ViewportProjector: the camera's first position on a location.
  { pattern: /^(?:CONFIG\.locations\.map|MAP_DB)\.[^.]+\.initialAlignment\.x$/u, control: "segments",
    values: ["left", "center", "right"] },
  { pattern: /^(?:CONFIG\.locations\.map|MAP_DB)\.[^.]+\.initialAlignment\.y$/u, control: "segments",
    values: ["top", "center", "bottom"] },
  // A WaveShaperNode's oversample (Web Audio): "none", "2x" or "4x".
  { pattern: /^CONFIG\.radio\.effects\.[^.]+\.oversample$/u, control: "segments", values: ["none", "2x", "4x"] },
  { path: "CONFIG.liveBait.motionSourceSpeciesId", control: "choice", source: "fish" },
]);

// TK-292 (spec 174 A6): master switches that are not named `enabled`, each with the parameters that do nothing while
// it is off (verified in the code that reads them).
const SWITCH_RULES = Object.freeze([
  // FightAreaRenderFrameBuilder draws none of the fight-area overlays without it (DEPENDENT_ZONES: overlay).
  { switch: "CONFIG.locations.debugVisuals", dependents: ["CONFIG.locations.showNetZone", "CONFIG.locations.showLastDashZone",
    "CONFIG.locations.showCatchZone", "CONFIG.locations.showPoleFightSector", "CONFIG.locations.showFightLineRadius"] },
  { switch: "CONFIG.debug.overlay", dependents: ["CONFIG.debug.overlayUpdateMs"] },
]);
// Parameters that keep working while their group's `enabled` is off: listed here when one is found.
const INDEPENDENT = Object.freeze([]);
const ENABLED_SUFFIX = "Enabled";

export class DevParameterSchema {
  #sources;

  // sources: { [name]: () => [{ value, label, hint, imageUrl }] }
  constructor({ sources = {} } = {}) {
    this.#sources = sources;
  }

  // { control: "segments" | "choice", options: [{ value, label, hint?, imageUrl? }] } or null for a plain field.
  describe(path, value) {
    const text = path.map(String).join(".");
    const key = String(path[path.length - 1]);
    const rule = RULES.find((entry) => (entry.path ? entry.path === text : entry.pattern ? entry.pattern.test(text)
      : entry.key === key) &&
      (!entry.type || typeof value === entry.type));
    if (!rule) return null;
    if (rule.values) {
      return { control: rule.control, options: rule.values.map((option) => ({ value: option, label: String(option) })) };
    }
    const options = this.#sources[rule.source]?.() || [];
    return options.length > 0 ? { control: rule.control, options } : null;
  }

  // TK-292: the switches a CONFIG parameter depends on, outermost first — a parameter is inactive in DevTools while
  // any of them is off. read(path) returns the live value at a path.
  // 1. A group with its own boolean `enabled` gates every other parameter of the group and of the groups inside it.
  // 2. `<name>Enabled` gates its siblings named `<name>…` (fixedBiteChanceEnabled -> fixedBiteChancePercent).
  // 3. SWITCH_RULES: master switches with another name.
  prerequisitesOf(path, read) {
    if (path[0] !== "CONFIG") return [];
    const text = path.map(String).join(".");
    if (INDEPENDENT.includes(text)) return [];
    const found = [];
    for (let depth = 2; depth < path.length; depth++) {
      const candidate = [...path.slice(0, depth), "enabled"];
      if (candidate.join(".") !== text && typeof read(candidate) === "boolean") found.push(candidate);
    }
    const parentPath = path.slice(0, -1), key = String(path[path.length - 1]);
    const parent = read(parentPath);
    if (parent && typeof parent === "object") {
      for (const sibling of Object.keys(parent)) {
        if (sibling === key || !sibling.endsWith(ENABLED_SUFFIX) || typeof parent[sibling] !== "boolean") continue;
        const name = sibling.slice(0, -ENABLED_SUFFIX.length);
        if (name && key.startsWith(name)) found.push([...parentPath, sibling]);
      }
    }
    for (const rule of SWITCH_RULES) if (rule.dependents.includes(text)) found.push(rule.switch.split("."));
    return found;
  }
}
