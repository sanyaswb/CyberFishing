// Session-owned diagnostic settings. Visibility never changes the gameplay's zone-enable switches.
export class ZoneEditorState {
  revision = 0;
  locationId = null;
  enabled = false;
  background = true;
  grid = true;
  spacingMeters = 1;
  categories = { castable: true, collisions: true, snags: true, dynamic: true };

  setFlag(key, value) {
    if (!["enabled", "background", "grid"].includes(key)) throw new TypeError("Unknown editor flag");
    const next = value === true;
    if (this[key] !== next) { this[key] = next; this.revision++; }
  }

  setCategory(key, value) {
    if (!Object.hasOwn(this.categories, key)) throw new TypeError("Unknown zone category");
    const next = value === true;
    if (this.categories[key] !== next) { this.categories[key] = next; this.revision++; }
  }

  setSpacing(value) {
    const next = Math.max(.25, Math.min(100, Number(value) || 1));
    if (next !== this.spacingMeters) { this.spacingMeters = next; this.revision++; }
  }
}
