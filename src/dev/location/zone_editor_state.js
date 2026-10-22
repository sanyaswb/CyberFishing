// Session-owned editor settings (spec 129, Revision 2). Showing never changes the gameplay's zone-enable switches.
// enabled: one switch for the editor — zones shown, edges draggable, the cell grid turned on; selection: the zone the
// drag tool resizes; grid: the perspective (metre) grid; cellGrid*/snapCells: the map's cells; depth*: the depth
// numbers in the cells.
export class ZoneEditorState {
  revision = 0;
  locationId = null;
  enabled = false;
  background = true;
  grid = true;
  cellGrid = true;
  depth = false;
  spacingMeters = 1;
  cellGridOpacity = 0.25;
  depthOpacity = 0.7;
  cellLineStep = 1;
  snapCells = 1;
  categories = { castable: true, collisions: true, snags: true, dynamic: true };
  selection = { category: "castable", index: 0 };
  #zoneListeners = new Set();

  setFlag(key, value) {
    if (!["enabled", "background", "grid", "cellGrid", "depth"].includes(key)) throw new TypeError("Unknown editor flag");
    const next = value === true;
    if (this[key] === next) return;
    this[key] = next;
    // Turning the editor on shows the cell grid the edges snap to (owner, Revision 2).
    if (key === "enabled" && next) this.cellGrid = true;
    this.revision++;
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

  // Opacities are shares 0..1; steps are whole cells 1..10.
  setNumber(key, value) {
    const limits = { cellGridOpacity: [0, 1, false], depthOpacity: [0, 1, false], cellLineStep: [1, 10, true],
      snapCells: [1, 10, true] }[key];
    if (!limits) throw new TypeError("Unknown editor value");
    const [min, max, whole] = limits;
    let next = Math.max(min, Math.min(max, Number(value)));
    if (!Number.isFinite(next)) return;
    if (whole) next = Math.round(next);
    if (next !== this[key]) { this[key] = next; this.revision++; }
  }

  // The drag tool changed a zone in the config: the section rebuilds its rows (spec 129 D6).
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
