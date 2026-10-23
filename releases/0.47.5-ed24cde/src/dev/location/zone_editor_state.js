// Session-owned editor settings (spec 129, Revision 2). Showing never changes the gameplay's zone-enable switches.
// locationId: the location the editor works on (spec 130 D1); loadedLocationId: the one on screen, the only one the
// editor draws and drags (D2). enabled: the editor input mode, with the cell grid turned on; selection: the zone whose
// parameter tree last focused; selectedIndex(category) owns each dropdown's number and hit-test eligibility;
// editing: the categories the drag tool may take (spec 132);
// hovered: the editable zones under the pointer, filled while it stays; grid: the perspective (metre) grid, off until
// switched on (TK-050); cellGrid*: the map's cells; depth*: the depth numbers in the cells.
// The middle share of a zone (of its width and height) that moves the whole zone (Revision 3, R3-3).
export const MOVE_SHARE = 0.3;

export class ZoneEditorState {
  revision = 0;
  locationId = null;
  loadedLocationId = null;
  enabled = false;
  background = true;
  grid = false;
  cellGrid = false;
  depth = false;
  spacingMeters = 1;
  cellGridOpacity = 0.25;
  depthOpacity = 0.7;
  categories = { castable: false, collisions: false, snags: false, dynamic: false };
  #selectedIndices = { castable: 0, collisions: 0, snags: 0, dynamic: 0 };
  selection;
  editing = { castable: false, collisions: false, snags: false, dynamic: false };
  hovered = new Set();
  boundsEditing = false;
  hoveredBound = -1;
  #zoneListeners = new Set();

  constructor() {
    const indices = this.#selectedIndices;
    // A stable read model: the active category's index is derived from the same owner as each dropdown.
    this.selection = { category: "castable", get index() { return indices[this.category]; } };
  }

  selectedIndex(category) {
    return this.#selectedIndices[category];
  }

  setFlag(key, value) {
    if (!["enabled", "background", "grid", "cellGrid", "depth"].includes(key)) throw new TypeError("Unknown editor flag");
    const next = value === true;
    if (this[key] === next) return;
    this[key] = next;
    if (key === "enabled" && !next) { this.boundsEditing = false; this.hoveredBound = -1; }
    // Editor transitions own the automatic grid: on = map cells, off = no grid.
    if (key === "enabled") { this.cellGrid = next; this.grid = false; }
    if (key === "cellGrid" && next) this.grid = false;
    if (key === "grid" && next) this.cellGrid = false;
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
    this.#selectedIndices[category] = next;
    this.hovered.clear();
    this.boundsEditing = false;
    this.hoveredBound = -1;
    this.revision++;
  }

  // Choosing another location starts it clean: no editing categories or hovered zones, the first zone selected.
  setLocation(id) {
    if (typeof id !== "string" || !id) throw new TypeError("Unknown location");
    if (this.locationId === id) return;
    this.locationId = id;
    this.clearZoneMarks();
  }

  get editsLoadedLocation() {
    return this.locationId === this.loadedLocationId;
  }

  // Import/reset/location changes clear category editing, hover and selection.
  clearZoneMarks() {
    for (const category of Object.keys(this.editing)) this.editing[category] = false;
    this.hovered.clear();
    this.boundsEditing = false;
    this.hoveredBound = -1;
    this.selection.category = "castable";
    for (const category of Object.keys(this.#selectedIndices)) this.#selectedIndices[category] = 0;
    this.revision++;
  }

  static zoneKey(category, index) {
    return `${category}:${index}`;
  }

  isEditable(category) {
    return this.editing[category] === true;
  }

  isHovered(category, index) {
    return this.hovered.has(ZoneEditorState.zoneKey(category, index));
  }

  setEditing(category, value) {
    if (!Object.hasOwn(this.editing, category)) throw new TypeError("Unknown zone category");
    const next = value === true;
    if (this.editing[category] === next) return;
    this.editing[category] = next;
    if (category === "dynamic" && !next) { this.boundsEditing = false; this.hoveredBound = -1; }
    if (!next) for (const key of this.hovered) if (key.startsWith(category + ":")) this.hovered.delete(key);
    this.revision++;
  }

  selectBounds(index) {
    this.select("dynamic", index);
    if (!this.boundsEditing) { this.boundsEditing = true; this.revision++; }
  }

  setHoveredBound(index) {
    if (this.hoveredBound === index) return;
    this.hoveredBound = index;
    this.revision++;
  }

  // keys: the editable zones under the pointer; an unchanged set changes nothing (no rebuild).
  setHovered(keys) {
    const hovered = this.hovered;
    if (keys.length === hovered.size && keys.every(key => hovered.has(key))) return;
    hovered.clear();
    for (const key of keys) hovered.add(key);
    this.revision++;
  }

  // Opacities are shares 0..1.
  setNumber(key, value) {
    if (!["cellGridOpacity", "depthOpacity"].includes(key)) throw new TypeError("Unknown editor value");
    const next = Math.max(0, Math.min(1, Number(value)));
    if (!Number.isFinite(next)) return;
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
