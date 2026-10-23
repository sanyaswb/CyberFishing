import { ZONE_CATEGORY_COLORS } from "./zone_category_colors.js";

// The one canonical form of a location's zones (spec 130): the DevTools export, the browser import and
// `npm run apply:zones` read and write it through this module, so a hash or a written module never depends on key order.
export const ZONE_FILE_FORMAT = "cyber-fishing/zones";
export const ZONE_FILE_VERSION = 1;
export const ZONE_CATEGORIES = Object.freeze(Object.keys(ZONE_CATEGORY_COLORS));
const ZONE_KEYS = Object.freeze(["id", "type", "multiplier", "shape", "x", "y", "w", "h", "adaptiveX", "moving", "speedX", "speedY",
  "bounds"]);
const RECT_KEYS = Object.freeze(["x", "y", "w", "h"]);
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u;

function ordered(record, first) {
  const keys = first.filter(key => Object.hasOwn(record, key));
  for (const key of Object.keys(record).sort()) if (!first.includes(key)) keys.push(key);
  return keys;
}

function canonicalRect(rect) {
  return Object.fromEntries(ordered(rect, RECT_KEYS).map(key => [key, rect[key]]));
}

function canonicalZone(zone) {
  const result = {};
  for (const key of ordered(zone, ZONE_KEYS)) {
    const value = zone[key];
    result[key] = key !== "bounds" ? value : Array.isArray(value) ? value.map(canonicalRect) : canonicalRect(value);
  }
  return result;
}

// Every category in a fixed order (a missing one is empty), every zone with its keys in the canonical order.
export function canonicalZones(zones = {}) {
  return Object.fromEntries(ZONE_CATEGORIES.map(category => [category, (zones[category] || []).map(canonicalZone)]));
}

export function canonicalZonesJson(zones) {
  return JSON.stringify(canonicalZones(zones));
}

// hashText(text) -> hex SHA-256 (or a promise of it): Web Crypto in the browser, node:crypto in the script.
export async function zoneHash(zones, hashText) {
  return await hashText(canonicalZonesJson(zones));
}

export function zoneFileName(locationId, version, date) {
  const pad = value => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `zones-${locationId}-v${version}-${stamp}.json`;
}

export function buildZoneFile({ locationId, zones, baseHash, gameVersion, locations, exportedAt }) {
  return {
    format: ZONE_FILE_FORMAT,
    formatVersion: ZONE_FILE_VERSION,
    gameVersion,
    locationId,
    designCellSize: designCellSize(locations),
    baseResolution: { width: locations.baseResolution.width, height: locations.baseResolution.height },
    exportedAt,
    baseHash,
    zones: canonicalZones(zones),
  };
}

function designCellSize(locations) {
  return locations.designCellSize || locations.cellSize;
}

const finite = value => typeof value === "number" && Number.isFinite(value);
const positive = value => finite(value) && value > 0;

function rectErrors(rect, path, errors) {
  if (!rect || typeof rect !== "object" || Array.isArray(rect)) { errors.push(`${path}: a rectangle {x, y, w, h}`); return; }
  if (!finite(rect.x) || !finite(rect.y)) errors.push(`${path}: x and y must be finite numbers`);
  if (!positive(rect.w) || !positive(rect.h)) errors.push(`${path}: w and h must be greater than 0`);
}

// The problems of a zone file for these locations ("<field path>: <reason>"); empty when the file is valid.
export function validateZoneFile(file, locations) {
  const errors = [];
  if (!file || typeof file !== "object" || Array.isArray(file)) return ["file: a JSON object"];
  if (file.format !== ZONE_FILE_FORMAT) errors.push(`format: "${ZONE_FILE_FORMAT}" expected`);
  if (file.formatVersion !== ZONE_FILE_VERSION) errors.push(`formatVersion: ${ZONE_FILE_VERSION} expected`);
  if (typeof file.locationId !== "string" || !Object.hasOwn(locations.map || {}, file.locationId)) {
    errors.push(`locationId: unknown location "${file.locationId}"`);
  }
  if (file.designCellSize !== designCellSize(locations)) {
    errors.push(`designCellSize: ${file.designCellSize} differs from the code's ${designCellSize(locations)}`);
  }
  const resolution = locations.baseResolution;
  if (file.baseResolution?.width !== resolution.width || file.baseResolution?.height !== resolution.height) {
    errors.push(`baseResolution: differs from the code's ${resolution.width} x ${resolution.height}`);
  }
  errors.push(...validateZones(file.zones));
  return errors;
}

export function validateZones(zones) {
  const errors = [];
  if (!zones || typeof zones !== "object" || Array.isArray(zones)) return ["zones: an object of categories"];
  for (const category of Object.keys(zones)) {
    if (!ZONE_CATEGORIES.includes(category)) errors.push(`zones.${category}: unknown category`);
  }
  const ids = new Set();
  for (const category of ZONE_CATEGORIES) {
    const list = zones[category];
    if (list === undefined) continue;
    if (!Array.isArray(list)) { errors.push(`zones.${category}: a list`); continue; }
    list.forEach((zone, index) => {
      const path = `zones.${category}.${index}`;
      rectErrors(zone, path, errors);
      if (!zone || typeof zone !== "object") return;
      if (zone.adaptiveX !== undefined && typeof zone.adaptiveX !== "boolean") errors.push(`${path}.adaptiveX: true or false`);
      for (const key of ["multiplier", "speedX", "speedY"]) {
        if (zone[key] !== undefined && !finite(zone[key])) errors.push(`${path}.${key}: a finite number`);
      }
      if (category === "dynamic") {
        if (zone.shape !== undefined && zone.shape !== "circle" && zone.shape !== "square") errors.push(`${path}.shape: circle or square`);
        if (zone.shape !== undefined && zone.w !== zone.h) errors.push(`${path}: shaped bodies require equal w and h`);
        if (typeof zone.id !== "string" || !zone.id) errors.push(`${path}.id: a non-empty name`);
        else if (ids.has(zone.id)) errors.push(`${path}.id: "${zone.id}" is used twice`);
        else ids.add(zone.id);
      }
      if (zone.bounds !== undefined) {
        const bounds = Array.isArray(zone.bounds) ? zone.bounds : [zone.bounds];
        bounds.forEach((rect, number) => rectErrors(rect, `${path}.bounds${Array.isArray(zone.bounds) ? `.${number}` : ""}`, errors));
      }
    });
  }
  return errors;
}

// Zones added, removed and changed (per field, compared in canonical JSON) by category and index.
export function diffZones(before, after) {
  const from = canonicalZones(before), to = canonicalZones(after), changes = [];
  for (const category of ZONE_CATEGORIES) {
    const length = Math.max(from[category].length, to[category].length);
    for (let index = 0; index < length; index++) {
      const a = from[category][index], b = to[category][index];
      if (!a) { changes.push({ category, index, kind: "added", fields: [] }); continue; }
      if (!b) { changes.push({ category, index, kind: "removed", fields: [] }); continue; }
      const fields = [];
      for (const key of ordered({ ...a, ...b }, ZONE_KEYS)) {
        if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) fields.push({ key, from: a[key], to: b[key] });
      }
      if (fields.length) changes.push({ category, index, kind: "changed", fields });
    }
  }
  return changes;
}

// The categories whose zones differ (canonical JSON), for a status line.
export function changedCategories(before, after) {
  const from = canonicalZones(before), to = canonicalZones(after);
  return ZONE_CATEGORIES.filter(category => JSON.stringify(from[category]) !== JSON.stringify(to[category]));
}

function literal(value) {
  if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, item]) => `${IDENTIFIER.test(key) ? key : JSON.stringify(key)}: ${literal(item)}`);
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  }
  return JSON.stringify(value);
}

// The data-only module of a location's zones (spec 130 D4): one zone per line, LF, canonical key order.
export function zoneModuleSource(locationId, zones) {
  const canonical = canonicalZones(zones);
  const lines = [
    `// Zones of the location "${locationId}" (spec 130): x/y/w/h and dynamic bounds in design cells`,
    "// (CONFIG.locations.designCellSize). `npm run apply:zones` rewrites this whole file in this form; hand edits are fine.",
    "export const ZONES = {",
  ];
  for (const category of ZONE_CATEGORIES) {
    const list = canonical[category];
    if (!list.length) { lines.push(`  ${category}: [],`); continue; }
    lines.push(`  ${category}: [`);
    for (const zone of list) lines.push(`    ${literal(zone)},`);
    lines.push("  ],");
  }
  lines.push("};", "");
  return lines.join("\n");
}
