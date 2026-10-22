import { clampRectanglePosition, containsRectangle, findRectangleContainer } from "../../engine/math/rectangle_bounds.js";

// Projects deliberate DEV edits from live positions into authored design-cell commands.
// Snapshots exist only for a command or a UI refresh; the map remains the live position owner.
export class ZoneEditorConfigEdits {
  #config; #getMap;
  constructor({ config, getMap }) { this.#config = config; this.#getMap = getMap; }

  readDynamicZones(id) {
    const authored = this.#config.locations.map[id]?.zones?.dynamic || [];
    const map = this.#getMap();
    if (!map || map.currentLocationId !== id) return authored;
    const live = map.getDynamicZones();
    const scale = this.#config.locations.cellSize / (this.#config.locations.designCellSize || this.#config.locations.cellSize);
    return authored.map(entry => {
      const current = live.find(zone => zone.id === entry.id);
      return current ? { ...entry, x: current.x * scale, y: current.y * scale, w: current.w * scale, h: current.h * scale } : entry;
    });
  }

  prepare(path, value) {
    if (path[0] !== "CONFIG" || path[1] !== "locations" || path[2] !== "map" || path[4] !== "zones" || path[5] !== "dynamic" ||
      this.#getMap()?.currentLocationId !== path[3]) return { path, value };
    const id = path[3], authored = this.#config.locations.map[id].zones.dynamic;
    const original = this.readDynamicZones(id);
    const current = JSON.parse(JSON.stringify(original));
    if (path.length === 6) {
      return { path, value: value.map(entry => {
        const index = authored.indexOf(entry);
        const candidate = JSON.parse(JSON.stringify(index >= 0 ? current[index] : entry));
        this.#normalizeShape(candidate);
        const previous = original.find(zone => zone.id === candidate.id);
        if (previous) this.#constrain(previous, candidate, JSON.stringify(previous.bounds) !== JSON.stringify(candidate.bounds));
        return candidate;
      }) };
    }
    let target = current;
    for (const key of path.slice(6, -1)) target = target[key];
    target[path.at(-1)] = value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
    const index = Number(path[6]);
    if (current[index]) this.#normalizeShape(current[index], path[7] === "h" ? "h" : "w");
    if (original[index] && current[index]) this.#constrain(original[index], current[index], path[7] === "bounds");
    return { path: path.slice(0, 6), value: current };
  }

  #constrain(original, candidate, boundsEdited) {
    if (!candidate.bounds) return;
    if (boundsEdited) {
      const bounds = Array.isArray(candidate.bounds) ? candidate.bounds : [candidate.bounds];
      const previous = Array.isArray(original.bounds) ? original.bounds : original.bounds ? [original.bounds] : [];
      for (let index = 0; index < bounds.length; index++) {
        const bound = bounds[index], old = previous[index];
        if (!old || !containsRectangle(old, original) || old.x === bound.x && old.y === bound.y && old.w === bound.w && old.h === bound.h) continue;
        // Leave malformed input for the existing validator; only constrain finite, positive geometry.
        if (!(bound.w > 0 && bound.h > 0) || !Number.isFinite(bound.x + bound.y + bound.w + bound.h)) continue;
        bound.w = Math.max(bound.w, candidate.w);
        bound.h = Math.max(bound.h, candidate.h);
        bound.x = Math.max(candidate.x + candidate.w - bound.w, Math.min(bound.x, candidate.x));
        bound.y = Math.max(candidate.y + candidate.h - bound.h, Math.min(bound.y, candidate.y));
      }
      return;
    }
    const region = findRectangleContainer(original, original.bounds) || findRectangleContainer(candidate, candidate.bounds);
    if (!region) {
      for (const key of ["x", "y", "w", "h"]) candidate[key] = original[key];
      return;
    }
    candidate.w = Math.min(candidate.w, region.w);
    candidate.h = Math.min(candidate.h, region.h);
    this.#normalizeShape(candidate);
    clampRectanglePosition(candidate, region);
  }

  #normalizeShape(zone, changedSize = null) {
    if (zone.shape !== "circle" && zone.shape !== "square") return;
    const side = changedSize ? zone[changedSize] : Math.min(zone.w, zone.h);
    zone.w = side; zone.h = side;
  }
}
