// Session-owned editor settings (spec 129, Revision 2). Showing never changes the gameplay's zone-enable switches.
// enabled: one switch for the editor — zones shown, edges draggable, the cell grid turned on; selection: the zone whose
// parameter tree the lists show; editable: the zones the drag tool may take, keys "<category>:<index>" (Revision 3);
// hovered: the editable zones under the pointer, filled while it stays; grid: the perspective (metre) grid, off until
// switched on (TK-050); cellGrid*/snapCells: the map's cells; depth*: the depth numbers in the cells.
// The middle share of a zone (of its width and height) that moves the whole zone (Revision 3, R3-3).
export const MOVE_SHARE = 0.3;

export class ZoneEditorState {
  revision = 0;
  locationId = null;
  enabled = false;
  background = true;
  grid = false;
  cellGrid = true;
  depth = false;
  spacingMeters = 1;
  cellGridOpacity = 0.25;
  depthOpacity = 0.7;
  cellLineStep = 1;
  snapCells = 1;
  categories = { castable: false, collisions: false, snags: false, dynamic: false };
  selection = { category: "castable", index: 0 };
  editable = new Set();
  hovered = new Set();
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

  static zoneKey(category, index) {
    return `${category}:${index}`;
  }

  isEditable(category, index) {
    return this.editable.has(ZoneEditorState.zoneKey(category, index));
  }

  isHovered(category, index) {
    return this.hovered.has(ZoneEditorState.zoneKey(category, index));
  }

  setEditable(category, index, value) {
    if (!Object.hasOwn(this.categories, category)) throw new TypeError("Unknown zone category");
    const key = ZoneEditorState.zoneKey(category, index);
    if (this.editable.has(key) === (value === true)) return;
    if (value === true) this.editable.add(key); else { this.editable.delete(key); this.hovered.delete(key); }
    this.revision++;
  }

  // A deleted zone takes its check with it; the later zones of its category keep theirs at their new indices.
  zoneRemoved(category, index) {
    for (const keys of [this.editable, this.hovered]) {
      const shifted = [];
      for (const key of [...keys]) {
        const [owner, number] = key.split(":");
        if (owner !== category || Number(number) < index) continue;
        keys.delete(key);
        if (Number(number) > index) shifted.push(ZoneEditorState.zoneKey(category, Number(number) - 1));
      }
      for (const key of shifted) keys.add(key);
    }
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
