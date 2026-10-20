export class InventorySelectorConfigValidator {
  static issues(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return ["expected selector settings object"];
    const errors = [];
    if (typeof value.radialEnabled !== "boolean") errors.push("radialEnabled: expected boolean");
    if (![1, 2, 3].includes(value.size)) errors.push("size: expected 1, 2 or 3");
    if (![1, 2, 3].includes(value.openSize)) errors.push("openSize: expected 1, 2 or 3");
    for (const key of Object.keys(value)) if (!["radialEnabled", "size", "openSize"].includes(key)) errors.push(`${key}: unknown selector setting`);
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
        selector = { radialEnabled: true, size: 1, openSize: 3, [key]: value };
      } else if (path === "ui" && Object.prototype.hasOwnProperty.call(value || {}, "inventorySelector")) selector = value.inventorySelector;
      else continue;
      const issues = InventorySelectorConfigValidator.issues(selector);
      if (issues.length) throw new TypeError(`${prefix}: ${issues.join("; ")}`);
    }
  }
}
