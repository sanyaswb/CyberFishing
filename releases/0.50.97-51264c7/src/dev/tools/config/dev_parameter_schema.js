// What DevTools knows about a parameter beyond its type (spec 174 A3, TK-283): the control that edits it and where its
// options come from. One place instead of path checks in the tree renderer; stage B2 adds steps and limits here.
//
// A rule matches a whole path ("CONFIG.debug.fixedCatch.fishId") or, with `key`, the last path segment anywhere.
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
]);

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
    const rule = RULES.find((entry) => (entry.path ? entry.path === text : entry.key === key) &&
      (!entry.type || typeof value === entry.type));
    if (!rule) return null;
    if (rule.values) {
      return { control: rule.control, options: rule.values.map((option) => ({ value: option, label: String(option) })) };
    }
    const options = this.#sources[rule.source]?.() || [];
    return options.length > 0 ? { control: rule.control, options } : null;
  }
}
