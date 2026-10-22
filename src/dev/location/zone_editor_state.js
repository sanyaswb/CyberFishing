// Session-owned diagnostic settings. Visibility never changes the gameplay's zone-enable switches.
// selection: the zone the editor shows and the drag tool resizes (spec 129 D4); cellGrid: the map's cell lines the
// drag snaps to (D5); dragEdit: pointer editing of the selected zone's edges (D6).
export class ZoneEditorState {
  revision = 0;
  locationId = null;
  enabled = false;
  background = true;
  grid = true;
  cellGrid = true;
  dragEdit = false;
  spacingMeters = 1;
  categories = { castable: true, collisions: true, snags: true, dynamic: true };
  selection = { category: "castable", index: 0 };
  #zoneListeners = new Set();

  setFlag(key, value) {
    if (!["enabled", "background", "grid", "cellGrid", "dragEdit"].includes(key)) throw new TypeError("Unknown editor flag");
    const next = value === true;
    if (this[key] !== next) { this[key] = next; this.revision++; }
  }

  setCategory(key, value) {
    if (!Object.hasOwn(this.categories, key)) throw new TypeError("Unknown zone category");
    const next = value === true;
    if (this.categories[key] !== next) { this.categories[key] = next; this.revision++; }
  }

  select(category, index) {
    if (!Object.hasOwn(this.categories, category)) throw new TypeError("Unknown zone category");
    const next = Math.max(0, Math.floor(Number(index) || 0));
    if (this.selection.category === category && this.selection.index === next) return;
    this.selection.category = category;
    this.selection.index = next;
    this.revision++;
  }

  // The drag tool changed a zone in the config: the section rebuilds its geometry rows (spec 129 D6).
  subscribeZonesEdited(listener) {
    this.#zoneListeners.add(listener);
    return () => this.#zoneListeners.delete(listener);
  }

  zonesEdited() {
    for (const listener of this.#zoneListeners) listener();
  }

  setSpacing(value) {
    const next = Math.max(.25, Math.min(100, Number(value) || 1));
    if (next !== this.spacingMeters) { this.spacingMeters = next; this.revision++; }
  }
}
