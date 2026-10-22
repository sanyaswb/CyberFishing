const COMPACT_SHAPES = ["half", "arc"];
const DEFAULT_SETTINGS = Object.freeze({ radialEnabled: true, size: 1, openSize: 3, compactShape: "half" });

export class InventorySelectorConfigValidator {
  static issues(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return ["expected selector settings object"];
    const errors = [];
    if (typeof value.radialEnabled !== "boolean") errors.push("radialEnabled: expected boolean");
    if (![1, 2, 3].includes(value.size)) errors.push("size: expected 1, 2 or 3");
    if (![1, 2, 3].includes(value.openSize)) errors.push("openSize: expected 1, 2 or 3");
    // Older exported selector objects predate the compact shape; they keep its default.
    if (value.compactShape !== undefined && !COMPACT_SHAPES.includes(value.compactShape)) errors.push("compactShape: expected half or arc");
    for (const key of Object.keys(value)) if (!Object.hasOwn(DEFAULT_SETTINGS, key)) errors.push(`${key}: unknown selector setting`);
    return errors;
  }

  // Validate exact-path and parent-object overrides before changing the store.
  static validateOverrides(data) {
    const prefix = "ui.inventorySelector";
    for (const [path, value] of Object.entries(data)) {
      let selector;
      if (path === prefix) selector = value;
      else if (path.startsWith(prefix + ".")) {
        const key = path.slice(prefix.length + 1);
        selector = { ...DEFAULT_SETTINGS, [key]: value };
      } else if (path === "ui" && Object.prototype.hasOwnProperty.call(value || {}, "inventorySelector")) selector = value.inventorySelector;
      else continue;
      const issues = InventorySelectorConfigValidator.issues(selector);
      if (issues.length) throw new TypeError(`${prefix}: ${issues.join("; ")}`);
    }
  }
}
