import { gridMaskBounds } from "../../engine/geometry/grid_mask.js";
import { clipZoneToAreas } from "./zone_castable_clip.js";

// Spec 173 TK-280: zones that run past the map (the location's picture, baseResolution in design cells) and their fix.
// The limit is the map, not the browser window: the window changes with its size, the map does not. Coordinates are
// design cells; a masked zone is measured by the cells its enabled mask occupies. Moving zones: the body and each of
// its movement areas. Pure functions over plain zone data; nothing given is changed.
const EPSILON = 1e-6;
const ROUND = 1e6;
const round = (value) => Math.round(value * ROUND) / ROUND;

// Every part past the map: { category, index, part: "zone" | "body" | "area", areaIndex, sides: [{ side, value, limit }] }
// with side "left" (x), "top" (y), "right" (x + w), "bottom" (y + h).
export function findZonesBeyondMap(zones, { mapWidth, mapHeight }) {
  const found = [];
  for (const [category, list] of Object.entries(zones || {})) {
    if (!Array.isArray(list)) continue;
    list.forEach((zone, index) => {
      if (category === "dynamic") {
        push(found, category, index, "body", -1, sidesBeyond(zone, mapWidth, mapHeight));
        areasOf(zone).forEach((area, areaIndex) =>
          push(found, category, index, "area", areaIndex, sidesBeyond(area, mapWidth, mapHeight)));
        return;
      }
      const occupied = zone.mask?.enabled ? gridMaskBounds(zone.mask, zone.x, zone.y, zone.w, zone.h, {}) : zone;
      push(found, category, index, "zone", -1, sidesBeyond(zone.adaptiveX ? { ...occupied, x: 0, w: mapWidth } : occupied,
        mapWidth, mapHeight));
    });
  }
  return found;
}

// The zones with every part inside the map: a plain zone is cut to the map; a masked one is cut on its own mask's grid
// (pieces it falls into become zones in its place, like «Обрізати по ігровій зоні»); a zone wholly outside is removed;
// a moving zone's areas are cut to the map and its body is moved inside the map and its first area. Returns
// { zones, removed: [{ category, index }] }.
export function fitZonesToMap(zones, { mapWidth, mapHeight }) {
  const result = JSON.parse(JSON.stringify(zones || {}));
  const removed = [];
  const map = { x: 0, y: 0, w: mapWidth, h: mapHeight };
  for (const [category, list] of Object.entries(result)) {
    if (!Array.isArray(list)) continue;
    const next = [];
    list.forEach((zone, index) => {
      if (category === "dynamic") { next.push(fitMovingZone(zone, map)); return; }
      const outside = findZonesBeyondMap({ [category]: [zone] }, { mapWidth, mapHeight }).length > 0;
      if (!outside) { next.push(zone); return; }
      const fitted = zone.mask?.enabled ? fitMaskedZone(zone, map, mapWidth) : fitPlainZone(zone, map);
      if (fitted.length === 0) removed.push({ category, index });
      next.push(...fitted);
    });
    result[category] = next;
  }
  return { zones: result, removed };
}

function push(found, category, index, part, areaIndex, sides) {
  if (sides.length) found.push({ category, index, part, areaIndex, sides });
}

function sidesBeyond(rect, mapWidth, mapHeight) {
  const sides = [];
  if (rect.x < -EPSILON) sides.push({ side: "left", value: round(rect.x), limit: 0 });
  if (rect.y < -EPSILON) sides.push({ side: "top", value: round(rect.y), limit: 0 });
  if (rect.x + rect.w > mapWidth + EPSILON) sides.push({ side: "right", value: round(rect.x + rect.w), limit: mapWidth });
  if (rect.y + rect.h > mapHeight + EPSILON) sides.push({ side: "bottom", value: round(rect.y + rect.h), limit: mapHeight });
  return sides;
}

function areasOf(zone) {
  return zone.bounds ? (Array.isArray(zone.bounds) ? zone.bounds : [zone.bounds]) : [];
}

function intersect(rect, map) {
  const x = Math.max(map.x, rect.x), y = Math.max(map.y, rect.y);
  const w = Math.min(map.x + map.w, rect.x + rect.w) - x, h = Math.min(map.y + map.h, rect.y + rect.h) - y;
  return w > EPSILON && h > EPSILON ? { x: round(x), y: round(y), w: round(w), h: round(h) } : null;
}

// A plain (or disabled-mask) zone: its rectangle cut to the map. A disabled mask belongs to the old rectangle, so it goes.
function fitPlainZone(zone, map) {
  const cut = intersect(zone.adaptiveX ? { x: 0, y: zone.y, w: map.w, h: zone.h } : zone, map);
  if (!cut) return [];
  const fitted = { ...zone, y: cut.y, h: cut.h };
  if (!zone.adaptiveX) { fitted.x = cut.x; fitted.w = cut.w; }
  delete fitted.mask;
  return [fitted];
}

// A masked zone: the map as the only area, on the zone's own mask grid, so every kept cell is one it already had.
function fitMaskedZone(zone, map, mapWidth) {
  const width = zone.adaptiveX ? mapWidth : zone.w;
  const grid = { stepX: zone.mask.cell[0] * width, stepY: zone.mask.cell[1] * zone.h, originX: zone.adaptiveX ? 0 : zone.x,
    originY: zone.y };
  const result = clipZoneToAreas(zone, [map], grid, mapWidth);
  return result.zones ?? [];
}

// A moving zone: areas cut to the map (an area wholly outside goes; none left: the map is its area); the body inside
// the map and inside its first area.
function fitMovingZone(zone, map) {
  const fitted = { ...zone };
  const areas = areasOf(zone).map((area) => intersect(area, map) && { ...area, ...intersect(area, map) }).filter(Boolean);
  if (zone.bounds) fitted.bounds = Array.isArray(zone.bounds) ? (areas.length ? areas : [{ ...map }]) : (areas[0] ?? { ...map });
  const holder = areas[0] ?? map;
  const inside = areas.some((area) => zone.x >= area.x && zone.y >= area.y && zone.x + zone.w <= area.x + area.w &&
    zone.y + zone.h <= area.y + area.h);
  const box = inside ? map : intersect(holder, map) ?? map;
  fitted.x = round(Math.max(box.x, Math.min(zone.x, box.x + box.w - zone.w)));
  fitted.y = round(Math.max(box.y, Math.min(zone.y, box.y + box.h - zone.h)));
  return fitted;
}
