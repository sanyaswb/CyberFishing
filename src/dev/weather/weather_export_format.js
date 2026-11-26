import {
  canonicalHash,
  cleanCanonical,
  collectTemplateIssues,
  diffCanonicalObjects,
  formatExportFileName,
} from "../tools/export/canonical_export_format.js";
import { generalWeatherRangeIssues } from "../../game/config/validation/weather_settings_ranges.js";
import { VISIBLE_STRENGTH } from "../../engine/math/strength_value.js";

// Canonical form of weather settings (spec 175, spec 176, spec 180 D7): DevTools «ПОГОДА» export/import and
// `npm run apply:weather` read and write through this module so hashes and written modules never depend on key order.
// Format v3 (spec 189 D2, TK-408): a file holds the levels the selector shows (`general` parts and / or one location's
// parts, in full, for reading and for the DevTools import) and `changes` — every parameter that differs from the code,
// as { part, path, from, to }. apply:weather and the import apply only those changes (applyLeafChanges), so a file
// survives later changes of the code: new keys, other values, new parts. Format v2 (spec 180 stage D: whole parts with
// the code's hashes) and v1 (rain + location) still read and apply as before.
//
// !!! Spec 189 D4 (owner: «погода буде ще змінюватись … додай помітку щоб ураховувати це при написанні в логіці
// експорту») — when the weather changes:
// - a new parameter of DevTools «ПОГОДА» goes into the data module of its part (WEATHER_EXPORT_PARTS) — never inline in
//   game_config.js or a location's database; a new kind of weather is a new part: its own data module (the form
//   generalModuleSource writes), an entry in GENERAL_WEATHER_PARTS or LOCATION_WEATHER_PARTS and CONFIG reading the module;
//   the devtools-controls check fails while «ПОГОДА» shows a parameter no part exports;
// - renaming or moving a key: an entry in KEY_RENAMES ("<part>:<old path>" → "<new path>"), so older files still apply;
// - a changed meaning of a value (a multiplier became a pair): a reader upgrade like upgradeLegacyEffects;
// - never make a file depend on a part's whole content again (no whole-part hashes, no «missing key» refusals).
export const WEATHER_FILE_FORMAT = "cyber-fishing/weather";
export const WEATHER_FILE_VERSION = 3;
const V2_FILE_VERSION = 2;
const LEGACY_FILE_VERSION = 1;
// The general parts a v2 file holds (v2 predates the others).
const V2_GENERAL_PARTS = Object.freeze(["rain", "ash", "storm", "wind"]);
const SPEC_189_TAIL = "// `npm run apply:weather` rewrites this whole file in this form (spec 189); names and descriptions of the keys:\n"
  + "// src/dev/metadata/parameter_labels.json. Hand edits are fine.\n";

// The general weather data modules: where each lives, its export name, the CONFIG path it feeds, its file header and
// its name in the «Збереження» status.
export const GENERAL_WEATHER_PARTS = Object.freeze({
  rain: Object.freeze({
    module: "src/game/config/raw/weather/rain_settings.js",
    exportName: "RAIN_SETTINGS",
    configPath: Object.freeze(["canvas", "rain"]),
    header: "// Procedural rain and water-ring settings (spec 172 D4, spec 175): CONFIG.canvas.rain reads them; DevTools\n"
      + "// «🌧 ПОГОДА» edits them live and exports a file; `npm run apply:weather` rewrites this whole file in this form.\n"
      + "// Hand edits are fine.\n",
  }),
  ash: Object.freeze({
    module: "src/game/config/raw/weather/ash_settings.js",
    exportName: "ASH_SETTINGS",
    configPath: Object.freeze(["canvas", "ash"]),
    header: "// Fiery ash during an emission (spec 179 stage C, TK-323): CONFIG.canvas.ash reads these; DevTools «ПОГОДА» → «ПОПІЛ»\n"
      + "// edits them live. Sizes and speeds are logical pixels; the count is one screen. Spec 180 D16 (TK-326): `strength` holds\n"
      + "// the values that change with the emission's strength — [at 0, at 100]; a location may override the end at 100\n"
      + "// (MAP_DB.<id>.weather.look.ash). The wind's drift is the wind's (CONFIG.weather.wind.ashDriftPx).\n"
      + "// `npm run apply:weather` rewrites this whole file in this form (spec 180 stage D).\n",
  }),
  storm: Object.freeze({
    module: "src/game/config/raw/weather/storm_settings.js",
    exportName: "STORM_SETTINGS",
    configPath: Object.freeze(["weather", "storm"]),
    header: "// What a storm does, the same on every location (spec 180 D3, TK-326): CONFIG.weather.storm. Spec 187 D7: every effect\n"
      + "// is a pair [від, до] — its value at the storm's least visible strength (5 %) and at full strength, linear between, and\n"
      + "// no effect with no storm (engine/math/strength_value.js effectOfPair). gustChanceMult and the rain's multipliers are\n"
      + "// the whole multiplier (×1 — no change); rainDropsShare, rainSlantDeg and windMinStrength add from 0. A location sets\n"
      + "// only how often and how long its storms are (MAP_DB.<id>.weather.storm). DevTools «ПОГОДА» → «ШТОРМ» edits them live.\n"
      + "// `npm run apply:weather` rewrites this whole file in this form (spec 180 stage D).\n",
  }),
  wind: Object.freeze({
    module: "src/game/config/raw/weather/wind_settings.js",
    exportName: "WIND_SETTINGS",
    configPath: Object.freeze(["weather", "wind"]),
    header: "// How the wind acts, the same on every location (spec 180 D3, TK-326): CONFIG.weather.wind. The drops' slant and the\n"
      + "// ash's drift come from the wind (owner: the wind moves the drops); a gust's shape is here, how often gusts come is the\n"
      + "// location's (MAP_DB.<id>.weather.wind.gust.chancePerSec); the rain's effect on the wind is under `rain`. DevTools\n"
      + "// «ПОГОДА» → «ВІТЕР» edits them live, `rain` in «ДОЩ» (spec 187 D16). Spec 187 D7: the effects are [від, до] pairs —\n"
      + "// at 5 % and at 100 % of the wind's strength (rainSlantDeg, ashDriftPx: strength + gust × gustSlantShare) or of the\n"
      + "// rain's (rain.*), none without them.\n"
      + "// `npm run apply:weather` rewrites this whole file in this form (spec 180 stage D).\n",
  }),
  // Spec 189 D1 (TK-407, TK-408): everything else DevTools «ПОГОДА» edits.
  lightning: Object.freeze({
    module: "src/game/config/raw/weather/lightning_settings.js",
    exportName: "LIGHTNING_SETTINGS",
    configPath: Object.freeze(["canvas", "lightning"]),
    header: "// The procedural lightning's look (spec 188): CONFIG.canvas.lightning. DevTools «ПОГОДА» → «ШТОРМ» → «Блискавка — вигляд».\n"
      + SPEC_189_TAIL,
  }),
  starfall: Object.freeze({
    module: "src/game/config/raw/weather/starfall_settings.js",
    exportName: "STARFALL_SETTINGS",
    configPath: Object.freeze(["canvas", "starfall"]),
    header: "// The starfall's stars and bolide (spec 182): CONFIG.canvas.starfall; how often a starfall night comes is the\n"
      + "// location's (MAP_DB.<id>.weather.starfall). DevTools «ПОГОДА» → «ЗОРЕПАД».\n" + SPEC_189_TAIL,
  }),
  water: Object.freeze({
    module: "src/game/config/raw/weather/water_settings.js",
    exportName: "WATER_SETTINGS",
    configPath: Object.freeze(["canvas", "water"]),
    header: "// The water's waves, the sea state and the float's rocking on the WebGL scene (spec 106, 128, 172 D7, 187 C):\n"
      + "// CONFIG.canvas.water. Lengths are art pixels. DevTools «ПОГОДА» → «ВОДА».\n" + SPEC_189_TAIL,
  }),
  emissionScreen: Object.freeze({
    module: "src/game/config/raw/weather/emission_screen_settings.js",
    exportName: "EMISSION_SCREEN_SETTINGS",
    configPath: Object.freeze(["emission", "screen"]),
    header: "// What an emission does to the player's screen (spec 179 stages E, J; TK-324): darkening, blur, shake —\n"
      + "// CONFIG.emission.screen. DevTools «ПОГОДА» → «ВИКИД».\n" + SPEC_189_TAIL,
  }),
  radiationGrain: Object.freeze({
    module: "src/game/config/raw/weather/radiation_grain_settings.js",
    exportName: "RADIATION_GRAIN_SETTINGS",
    configPath: Object.freeze(["canvas", "radiationGrain"]),
    header: "// The radiation's hiss over the scene (spec 179 stage D, TK-338): CONFIG.canvas.radiationGrain. DevTools «ПОГОДА» →\n"
      + "// «РАДІАЦІЯ» → «Шипіння».\n" + SPEC_189_TAIL,
  }),
  geiger: Object.freeze({
    module: "src/game/config/raw/weather/geiger_settings.js",
    exportName: "GEIGER_SETTINGS",
    configPath: Object.freeze(["ui", "audio", "geiger"]),
    header: "// The Geiger counter's clicks (spec 179 stage D, TK-339): CONFIG.ui.audio.geiger. DevTools «ПОГОДА» → «РАДІАЦІЯ» →\n"
      + "// «Звук лічильника».\n" + SPEC_189_TAIL,
  }),
});
export const GENERAL_WEATHER_PART_IDS = Object.freeze(Object.keys(GENERAL_WEATHER_PARTS));

// Spec 189 D1: a location's parts — its weather and its water's current; module, CONFIG path and header by location id.
export const LOCATION_WEATHER_PARTS = Object.freeze({
  weather: Object.freeze({
    module: (id) => locationWeatherModulePath(id),
    exportName: "WEATHER",
    configPath: (id) => ["locations", "map", id, "weather"],
    header: (id) => `// Weather of the location "${id}" (spec 172, 175, 180): independent events rain, storm (with its lightning) and fog,\n`
      + "// each a check + chance and a timeline rolled at its start. `npm run apply:weather` rewrites this whole file in this form.\n",
  }),
  current: Object.freeze({
    module: (id) => `src/game/config/raw/locations/current/${id}.js`,
    exportName: "CURRENT",
    configPath: (id) => ["locations", "map", id, "environment", "current"],
    header: (id) => `// The water's current of the location "${id}" (MAP_DB.${id}.environment.current): speed (px/s) and direction. DevTools\n`
      + "// «ПОГОДА» → «ВОДА» → «Течія (локація)». `npm run apply:weather` rewrites this whole file in this form (spec 189).\n",
  }),
});
export const LOCATION_WEATHER_PART_IDS = Object.freeze(Object.keys(LOCATION_WEATHER_PARTS));

// Spec 189 D4: "<part>:<old path>" → "<new path>" for keys renamed or moved since a file could have been exported
// (part: general.<id> | location.<id>). Empty until the first rename.
export const KEY_RENAMES = Object.freeze({});

// Spec 189: every part of the file as "general.<id>" / "location.<id>", with its spec.
export function weatherPartSpec(partKey) {
  const [level, id] = String(partKey).split(".");
  if (level === "general" && Object.hasOwn(GENERAL_WEATHER_PARTS, id)) return { level, id, spec: GENERAL_WEATHER_PARTS[id] };
  if (level === "location" && Object.hasOwn(LOCATION_WEATHER_PARTS, id)) return { level, id, spec: LOCATION_WEATHER_PARTS[id] };
  return null;
}

const LOCATION_ID = /^[A-Za-z0-9_-]+$/u;
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;
const HEX_HASH = /^[0-9a-f]{64}$/iu;

// Spec 180 D16: the strength block holds [at 0, at 100] pairs (checked by RAIN_STRENGTH_RANGES).
const RAIN_RANGES = Object.freeze([
  ["fallPx", 1, 4000],
  ["speedJitter", 0, 1],
  ["speedStretch", 0, 3],
  ["opacity", 0, 1],
  ["rings.maxRings", 0, 5000],
  ["rings.sizePx", 0, 400],
  ["rings.lifeSec", 0.05, 10],
  ["rings.opacity", 0, 1],
  ["rings.flatten", 0, 1],
  ["rings.ripple.strength", 0, 2],
  ["rings.ripple.radiusScale", 0, 10],
]);

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);

export function locationWeatherModulePath(locationId) {
  return `src/game/config/raw/locations/weather/${locationId}.js`;
}

export function canonicalGeneralPart(value = {}) {
  return cleanCanonical(value, { sortKeys: true });
}

export function canonicalLocationWeather(weather = {}) {
  return cleanCanonical(weather, { sortKeys: true });
}

export async function generalPartHash(value, hashText) {
  return await canonicalHash(canonicalGeneralPart(value), hashText);
}

export async function locationWeatherHash(weather, hashText) {
  return await canonicalHash(canonicalLocationWeather(weather), hashText);
}

// weather-general-…, weather-<id>-… or weather-general-<id>-… by the levels the file holds.
export function weatherFileName({ general = false, locationId = null }, version, date) {
  const name = ["weather", general ? "general" : null, locationId].filter(Boolean).join("-");
  return formatExportFileName(name, version, date);
}

// The changes of one part against the code: [{ part, path, from, to }] (path — dotted inside the part).
function partChanges(partKey, base, live) {
  if (!isRecord(base) || !isRecord(live)) return [];
  return diffCanonicalObjects(canonicalGeneralPart(base), canonicalGeneralPart(live))
    .map(({ path, from, to }) => ({ part: partKey, path, from, to }));
}

// Format v3 (spec 189 D2). general: { <part id>: live value } (the parts the file holds) or null, generalBase: the same
// parts as in the code; locationId with location: { weather, current } (live) and locationBase (the code's), or a null
// locationId for a general-only file.
export function buildWeatherFile({
  general = null, generalBase = null, locationId = null, location = null, locationBase = null, gameVersion, exportedAt,
}) {
  const file = { format: WEATHER_FILE_FORMAT, formatVersion: WEATHER_FILE_VERSION, gameVersion, exportedAt };
  const changes = [];
  if (general) {
    file.general = {};
    for (const id of GENERAL_WEATHER_PART_IDS) {
      if (!isRecord(general[id])) continue;
      file.general[id] = canonicalGeneralPart(general[id]);
      changes.push(...partChanges(`general.${id}`, generalBase?.[id], general[id]));
    }
  }
  if (locationId) {
    file.locationId = locationId;
    file.location = {};
    for (const id of LOCATION_WEATHER_PART_IDS) {
      if (!isRecord(location?.[id])) continue;
      file.location[id] = canonicalGeneralPart(location[id]);
      changes.push(...partChanges(`location.${id}`, locationBase?.[id], location[id]));
    }
  }
  file.changes = changes;
  return file;
}

// Spec 189 D2: a part's changes applied to its value in the code, one parameter at a time. The code's value is `from`
// → it becomes `to` (applied); it is already `to` → nothing (already); it is something else — changed in the code since
// the export → conflicts (with the code's value; `next` holds `to`, written only with --force); the parameter is not in
// the code (removed; a renamed one is found through KEY_RENAMES) → missing, skipped. Keys the file does not name are
// left as they are. Returns { next, applied, already, conflicts, missing }; `current` is not changed.
export function applyLeafChanges(partKey, current, changes) {
  const next = canonicalGeneralPart(isRecord(current) ? current : {});
  const result = { next, applied: [], already: [], conflicts: [], missing: [] };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const change of changes) {
    if (change?.part !== partKey) continue;
    const path = KEY_RENAMES[`${partKey}:${change.path}`] ?? change.path;
    const keys = String(path).split(".");
    let parent = next;
    for (const key of keys.slice(0, -1)) parent = isRecord(parent) ? parent[key] : undefined;
    const last = keys.at(-1);
    const entry = { ...change, path };
    if (!isRecord(parent) || !Object.hasOwn(parent, last)) { result.missing.push(entry); continue; }
    const now = parent[last];
    if (same(now, change.to)) { result.already.push(entry); continue; }
    if (same(now, change.from)) result.applied.push(entry);
    else result.conflicts.push({ ...entry, code: now });
    parent[last] = JSON.parse(JSON.stringify(change.to));
  }
  return result;
}

// The domain checks a part's value must pass (its ranges, colours, pairs); the config schema check runs after a write.
export function weatherPartIssues(partKey, value) {
  const part = weatherPartSpec(partKey);
  if (!part || !isRecord(value)) return [`${partKey}: expected object`];
  const errors = [];
  if (part.level === "general" && part.id === "rain") validateRainDomain(value, partKey, errors);
  else if (part.level === "general" && ["storm", "wind", "ash"].includes(part.id)) {
    errors.push(...generalWeatherRangeIssues(part.id, value, partKey));
  } else if (part.level === "location" && part.id === "weather") {
    validateLocationLook(value.look, null, errors);
    validateLocationWeatherDomain(value, errors);
  }
  return errors;
}

// One shape for both versions: { version, general: { part: value } | null, generalBaseHashes, locationId | null,
// locationWeather | null, locationWeatherBaseHash | null }. A v1 file is the rain part plus its location.
// Spec 187 D18 (owner: «apply:weather переводить старі множники … підтримую»): a file exported before the storm's and
// the wind's effects became [від, до] holds plain multipliers; each becomes the pair that acts exactly as it did (від =
// its value at the visible strength). `whole` — the old number was the whole multiplier (1 + (m − 1) × s), `plus1` —
// 1 + m × s, otherwise m × s. A pair stays as it is; the file is not changed (a copy is returned).
const LEGACY_EFFECTS = Object.freeze({
  storm: Object.freeze({ rainChanceMult: "whole", rainStrengthMult: "whole", gustChanceMult: "plus1", rainDropsShare: "times",
    rainSlantDeg: "times", windMinStrength: "times" }),
  wind: Object.freeze({ rainSlantDeg: "times", ashDriftPx: "times" }),
  windRain: Object.freeze({ minStrength: "times", bonus: "times", gustChanceMult: "plus1" }),
});

function legacyPair(value, kind) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  const at = (share) => (kind === "whole" ? 1 + (value - 1) * share : kind === "plus1" ? 1 + value * share : value * share);
  return [Number(at(VISIBLE_STRENGTH).toFixed(6)), Number(at(1).toFixed(6))];
}

function upgradeTable(record, table) {
  if (!isRecord(record)) return record;
  const next = { ...record };
  for (const [key, kind] of Object.entries(table)) if (key in next) next[key] = legacyPair(next[key], kind);
  return next;
}

export function upgradeLegacyEffects(general) {
  if (!isRecord(general)) return general;
  const next = { ...general };
  if (isRecord(next.storm)) next.storm = upgradeTable(next.storm, LEGACY_EFFECTS.storm);
  if (isRecord(next.wind)) {
    next.wind = upgradeTable(next.wind, LEGACY_EFFECTS.wind);
    if (isRecord(next.wind.rain)) next.wind.rain = upgradeTable(next.wind.rain, LEGACY_EFFECTS.windRain);
  }
  return next;
}

// v3: { version: 3, general, locationId, location, changes }; v2 / v1: { version, general, generalBaseHashes,
// locationId, locationWeather, locationWeatherBaseHash } (whole parts, applied as before).
export function readWeatherFile(file) {
  if (!isRecord(file)) return null;
  if (file.formatVersion === WEATHER_FILE_VERSION) {
    return {
      version: WEATHER_FILE_VERSION,
      general: isRecord(file.general) ? file.general : null,
      locationId: "locationId" in file ? file.locationId : null,
      location: isRecord(file.location) ? file.location : null,
      changes: Array.isArray(file.changes) ? file.changes : [],
    };
  }
  const hashes = isRecord(file.baseHashes) ? file.baseHashes : {};
  if (file.formatVersion === LEGACY_FILE_VERSION) {
    return {
      version: LEGACY_FILE_VERSION,
      general: "rain" in file ? { rain: file.rain } : null,
      generalBaseHashes: { rain: hashes.rain },
      locationId: file.locationId ?? null,
      locationWeather: file.locationWeather ?? null,
      locationWeatherBaseHash: hashes.locationWeather ?? null,
    };
  }
  return {
    version: file.formatVersion,
    general: "general" in file ? upgradeLegacyEffects(file.general) : null,
    generalBaseHashes: isRecord(hashes.general) ? hashes.general : {},
    locationId: "locationId" in file ? file.locationId : null,
    locationWeather: "locationWeather" in file ? file.locationWeather : null,
    locationWeatherBaseHash: hashes.locationWeather ?? null,
  };
}

function readPath(object, dotPath) {
  let current = object;
  for (const key of dotPath.split(".")) current = current?.[key];
  return current;
}

function checkRange(value, path, min, max, errors) {
  if (!finite(value)) return;
  if (value < min || value > max) errors.push(`${path}: must be within [${min}, ${max}]`);
}

function checkPair(pair, path, min, max, ordered, errors) {
  if (!Array.isArray(pair) || pair.length !== 2) return;
  checkRange(pair[0], `${path}[0]`, min, max, errors);
  checkRange(pair[1], `${path}[1]`, min, max, errors);
  if (ordered && finite(pair[0]) && finite(pair[1]) && pair[0] > pair[1]) {
    errors.push(`${path}: min (${pair[0]}) must not exceed max (${pair[1]})`);
  }
}

const RAIN_STRENGTH_RANGES = Object.freeze([["maxDrops", 0, 5000], ["lengthPx", 0, 400], ["widthPx", 0, 20],
  ["speedPx", 1, 10000], ["minScale", 0, 1], ["lengthJitter", 0, 1], ["slantJitterDeg", 0, 45]]);

function validateRainDomain(rain, path, errors) {
  for (const [dotPath, min, max] of RAIN_RANGES) checkRange(readPath(rain, dotPath), `${path}.${dotPath}`, min, max, errors);
  for (const [key, min, max] of RAIN_STRENGTH_RANGES) checkPair(rain.strength?.[key], `${path}.strength.${key}`, min, max, false, errors);
  for (const dotPath of ["color", "rings.color", "emissionColor", "rings.emissionColor"]) {
    const color = readPath(rain, dotPath);
    if (typeof color === "string" && !HEX_COLOR.test(color)) errors.push(`${path}.${dotPath}: must be #rrggbb`);
  }
}

// Spec 180 D2/D13: an event's check, chance, cooldown and the ranges of its timeline.
function checkEvent(event, path, errors) {
  if (!isRecord(event)) return;
  if ("enabled" in event && typeof event.enabled !== "boolean") errors.push(`${path}.enabled: expected boolean`);
  checkRange(event.checkIntervalSec, `${path}.checkIntervalSec`, 1, Infinity, errors);
  checkRange(event.chancePerCheck, `${path}.chancePerCheck`, 0, 1, errors);
  checkRange(event.chanceGrowthPerCheck, `${path}.chanceGrowthPerCheck`, 0, 1, errors);
  checkRange(event.cooldownSec, `${path}.cooldownSec`, 0, Infinity, errors);
  checkRange(event.smoothSec, `${path}.smoothSec`, 0, Infinity, errors);
  checkPair(event.durationSec, `${path}.durationSec`, 1, Infinity, true, errors);
  checkPair(event.peakAtShare, `${path}.peakAtShare`, 0, 1, true, errors);
  checkPair(event.peakShare, `${path}.peakShare`, 0, 1, true, errors);
  checkPair(event.peakStrength, `${path}.peakStrength`, 0, 1, true, errors);
}

function validateLocationWeatherDomain(weather, errors) {
  const initial = weather.initial;
  if (isRecord(initial)) {
    for (const kind of ["rain", "storm", "fog"]) checkRange(initial[kind], `locationWeather.initial.${kind}`, 0, 1, errors);
  }
  checkEvent(weather.rain, "locationWeather.rain", errors);
  const storm = weather.storm;
  checkEvent(storm, "locationWeather.storm", errors);
  if (isRecord(storm)) {
    const lightning = storm.lightning;
    if (isRecord(lightning)) {
      checkRange(lightning.chance, "locationWeather.storm.lightning.chance", 0, 1, errors);
      checkPair(lightning.startShare, "locationWeather.storm.lightning.startShare", 0, 1, true, errors);
      checkPair(lightning.endShare, "locationWeather.storm.lightning.endShare", 0, 1, true, errors);
      checkPair(lightning.intervalSec, "locationWeather.storm.lightning.intervalSec", 0.05, Infinity, false, errors);
      checkRange(lightning.jitter, "locationWeather.storm.lightning.jitter", 0, 1, errors);
      checkPair(lightning.distance, "locationWeather.storm.lightning.distance", 0, 1, true, errors);
    }
  }
  const fog = weather.fog;
  checkEvent(fog, "locationWeather.fog", errors);
  // TK-336: the fog's hour windows (game hours 0…24, a window may pass midnight) and the rain's boost.
  if (isRecord(fog) && "hours" in fog) {
    if (!Array.isArray(fog.hours)) errors.push("locationWeather.fog.hours: expected array");
    else fog.hours.forEach((window, index) => {
      const path = `locationWeather.fog.hours[${index}]`;
      if (!isRecord(window)) { errors.push(`${path}: expected object`); return; }
      for (const key of ["fromHour", "toHour"]) {
        if (!finite(window[key])) errors.push(`${path}.${key}: expected finite number`);
        else checkRange(window[key], `${path}.${key}`, 0, 24, errors);
      }
      if (!finite(window.chanceMult)) errors.push(`${path}.chanceMult: expected finite number`);
      else checkRange(window.chanceMult, `${path}.chanceMult`, 0, 100, errors);
    });
  }
  if (isRecord(fog?.rainBoost)) {
    checkRange(fog.rainBoost.perRain, "locationWeather.fog.rainBoost.perRain", 0, 10, errors);
    checkRange(fog.rainBoost.max, "locationWeather.fog.rainBoost.max", 1, 100, errors);
  }
  const emission = weather.emission;
  if (isRecord(emission)) {
    if ("enabled" in emission && typeof emission.enabled !== "boolean") errors.push("locationWeather.emission.enabled: expected boolean");
    checkPair(emission.durationSec, "locationWeather.emission.durationSec", 1, Infinity, true, errors);
    checkPair(emission.peakAtShare, "locationWeather.emission.peakAtShare", 0, 1, true, errors);
    checkPair(emission.peakShare, "locationWeather.emission.peakShare", 0, 1, true, errors);
    checkPair(emission.peakStrength, "locationWeather.emission.peakStrength", 0, 1, true, errors);
    checkRange(emission.checkIntervalSec, "locationWeather.emission.checkIntervalSec", 1, Infinity, errors);
    checkRange(emission.chancePerCheck, "locationWeather.emission.chancePerCheck", 0, 1, errors);
    checkRange(emission.chanceGrowthPerCheck, "locationWeather.emission.chanceGrowthPerCheck", 0, 1, errors);
    checkRange(emission.cooldownSec, "locationWeather.emission.cooldownSec", 0, Infinity, errors);
    const storm = emission.storm;
    if (isRecord(storm)) {
      checkRange(storm.storm, "locationWeather.emission.storm.storm", 0, 1, errors);
    }
  }
  // Spec 182 D2 (TK-351): the starfall's night.
  const starfall = weather.starfall;
  if (isRecord(starfall)) {
    if ("enabled" in starfall && typeof starfall.enabled !== "boolean") errors.push("locationWeather.starfall.enabled: expected boolean");
    checkRange(starfall.fromHour, "locationWeather.starfall.fromHour", 0, 24, errors);
    checkRange(starfall.toHour, "locationWeather.starfall.toHour", 0, 24, errors);
    checkRange(starfall.nightChance, "locationWeather.starfall.nightChance", 0, 1, errors);
    checkPair(starfall.periods, "locationWeather.starfall.periods", 1, 24, true, errors);
    checkRange(starfall.maxStrength, "locationWeather.starfall.maxStrength", 0, 1, errors);
    checkRange(starfall.quietChance, "locationWeather.starfall.quietChance", 0, 1, errors);
    checkRange(starfall.blendShare, "locationWeather.starfall.blendShare", 0, 1, errors);
    checkRange(starfall.bolideChance, "locationWeather.starfall.bolideChance", 0, 1, errors);
  }
  const radiation = weather.radiation;
  if (isRecord(radiation)) {
    checkRange(radiation.base, "locationWeather.radiation.base", 0, 1, errors);
    checkRange(radiation.emissionPeak, "locationWeather.radiation.emissionPeak", 0, 1, errors);
  }
  const thresholds = weather.thresholds;
  if (isRecord(thresholds)) {
    checkRange(thresholds.rain, "locationWeather.thresholds.rain", 0, 1, errors);
    checkRange(thresholds.fog, "locationWeather.thresholds.fog", 0, 1, errors);
  }
  const wind = weather.wind;
  if (isRecord(wind)) {
    checkRange(wind.fadeSec, "locationWeather.wind.fadeSec", 0, Infinity, errors);
    if (isRecord(wind.states)) {
      for (const state of ["calm", "light", "moderate", "strong"]) {
        const entry = wind.states[state];
        if (!isRecord(entry)) continue;
        checkRange(entry.weight, `locationWeather.wind.states.${state}.weight`, 0, Infinity, errors);
        checkPair(entry.durationSec, `locationWeather.wind.states.${state}.durationSec`, 0, Infinity, true, errors);
        checkPair(entry.strength, `locationWeather.wind.states.${state}.strength`, 0, 1, true, errors);
      }
    }
    if (isRecord(wind.gust)) checkRange(wind.gust.chancePerSec, "locationWeather.wind.gust.chancePerSec", 0, Infinity, errors);
    if (isRecord(wind.float)) {
      checkRange(wind.float.maxAngleDeg, "locationWeather.wind.float.maxAngleDeg", 0, 90, errors);
      checkPair(wind.float.returnPctRange, "locationWeather.wind.float.returnPctRange", 0, 1, true, errors);
      checkPair(wind.float.cycleDurationSec, "locationWeather.wind.float.cycleDurationSec", 0.05, Infinity, true, errors);
      checkPair(wind.float.amplitudeJitter, "locationWeather.wind.float.amplitudeJitter", 0, 5, true, errors);
    }
  }
}

function validateGeneralPart(part, value, template, path, errors) {
  if (!isRecord(value)) { errors.push(`${path}: expected object`); return; }
  if (template) collectTemplateIssues(template, value, path, errors);
  if (part === "rain") validateRainDomain(value, path, errors);
  else errors.push(...generalWeatherRangeIssues(part, value, path));
}

const LOOK_KINDS = Object.freeze(["rain", "ash"]);

function withoutLook(weather) {
  if (!isRecord(weather)) return weather;
  const { look: _look, ...rest } = weather;
  return rest;
}

// Spec 187 D8: MAP_DB.<id>.weather.look.<rain|ash>.<key> — [від, до] (a number or null each; null — the general end) or
// a plain number (the old override of «до»); a key must be a strength value of the general look when that is known.
function validateLocationLook(look, generalTemplates, errors) {
  if (look === undefined) return;
  if (!isRecord(look)) { errors.push("locationWeather.look: expected object"); return; }
  for (const kind of Object.keys(look)) {
    const path = `locationWeather.look.${kind}`;
    if (!LOOK_KINDS.includes(kind)) { errors.push(`${path}: unknown look`); continue; }
    if (!isRecord(look[kind])) { errors.push(`${path}: expected object`); continue; }
    const strengthKeys = generalTemplates?.[kind]?.strength ?? null;
    for (const [key, value] of Object.entries(look[kind])) {
      if (strengthKeys && !Object.hasOwn(strengthKeys, key)) { errors.push(`${path}.${key}: not a strength value of the look`); continue; }
      const ends = Array.isArray(value) ? value : [null, value];
      if (ends.length !== 2 || ends.some((end) => end !== null && !Number.isFinite(end)) || ends.every((end) => end === null)) {
        errors.push(`${path}.${key}: expected [від, до] (numbers, a null end — the general one) or a number`);
      }
    }
  }
}

// The kind of a value a change may write over the code's value: the same kind (a number, a pair of numbers, a colour, a
// switch, an object), never a whole other shape.
function changeKindIssue(code, next, path) {
  if (code === undefined) return null;
  if (typeof code === "number") return finite(next) ? null : `${path}: expected finite number`;
  if (typeof code === "boolean") return typeof next === "boolean" ? null : `${path}: expected boolean`;
  if (typeof code === "string") {
    if (typeof next !== "string") return `${path}: expected string`;
    return HEX_COLOR.test(code) && !HEX_COLOR.test(next) ? `${path}: must be #rrggbb` : null;
  }
  if (Array.isArray(code)) {
    if (!Array.isArray(next)) return `${path}: expected array`;
    if (code.length && typeof code[0] === "number") {
      if (next.length !== code.length) return `${path}: expected ${code.length} items`;
      if (!next.every(finite)) return `${path}: expected finite numbers`;
    }
    return null;
  }
  if (isRecord(code)) return isRecord(next) ? null : `${path}: expected object`;
  return null;
}

// Spec 189 D2: a v3 file — its levels and every change: a known part (a location part needs the file's location), a
// path, a value of the kind the code holds there (currentValue(partKey) → the part as in the code; a parameter the code
// no longer has is not an error — apply skips it and says so).
function validateChangesFile(file, { locations = null, currentValue = null }) {
  const errors = [];
  const read = readWeatherFile(file);
  if ("general" in file && !isRecord(file.general)) errors.push("general: expected object");
  if ("location" in file && !isRecord(file.location)) errors.push("location: expected object");
  for (const id of Object.keys(read.general ?? {})) {
    if (!Object.hasOwn(GENERAL_WEATHER_PARTS, id)) errors.push(`general.${id}: unknown general weather part`);
  }
  for (const id of Object.keys(read.location ?? {})) {
    if (!Object.hasOwn(LOCATION_WEATHER_PARTS, id)) errors.push(`location.${id}: unknown location weather part`);
  }
  const hasLocation = read.locationId !== null || read.location !== null;
  if (hasLocation) {
    if (typeof read.locationId !== "string" || !LOCATION_ID.test(read.locationId)) errors.push("locationId: expected valid location id");
    else if (locations?.map && !Object.hasOwn(locations.map, read.locationId)) errors.push(`locationId: unknown location "${read.locationId}"`);
  }
  if (!Array.isArray(file.changes)) { errors.push("changes: expected array"); return errors; }
  if (!read.general && !hasLocation) errors.push("file: expected general settings and/or a location's weather");
  const values = new Map();
  file.changes.forEach((change, index) => {
    const at = `changes[${index}]`;
    if (!isRecord(change)) { errors.push(`${at}: expected object`); return; }
    const part = weatherPartSpec(change.part);
    if (!part) { errors.push(`${at}.part: unknown weather part "${change.part}"`); return; }
    if (part.level === "location" && !hasLocation) { errors.push(`${at}.part: a location part needs the file's location`); return; }
    if (typeof change.path !== "string" || !change.path) { errors.push(`${at}.path: expected dotted path`); return; }
    if (!("to" in change)) { errors.push(`${at}.to: missing value`); return; }
    if (!currentValue) return;
    if (!values.has(change.part)) values.set(change.part, currentValue(change.part));
    const path = KEY_RENAMES[`${change.part}:${change.path}`] ?? change.path;
    const code = path.split(".").reduce((node, key) => (isRecord(node) ? node[key] : undefined), values.get(change.part));
    const issue = changeKindIssue(code, change.to, `${change.part}.${path}`);
    if (issue) errors.push(issue);
  });
  return errors;
}

// v3: locations (a location must exist in it) and currentValue(partKey) → the part as in the code (the kind of every
// change is checked against it). v2 / v1: generalTemplates { rain, ash, storm, wind } and locationWeatherTemplate as in
// the code (unknown and missing keys are refused, as before).
export function validateWeatherFile(file, {
  generalTemplates = null, locationWeatherTemplate = null, locations = null, currentValue = null,
} = {}) {
  if (!isRecord(file)) return ["file: expected JSON object"];
  const errors = [];
  if (file.format !== WEATHER_FILE_FORMAT) errors.push(`format: expected "${WEATHER_FILE_FORMAT}"`);
  if (![WEATHER_FILE_VERSION, V2_FILE_VERSION, LEGACY_FILE_VERSION].includes(file.formatVersion)) {
    errors.push(`formatVersion: expected ${WEATHER_FILE_VERSION} (or ${V2_FILE_VERSION}, ${LEGACY_FILE_VERSION})`);
    return errors;
  }
  if (file.formatVersion === WEATHER_FILE_VERSION) return [...errors, ...validateChangesFile(file, { locations, currentValue })];
  const read = readWeatherFile(file);
  const legacy = read.version === LEGACY_FILE_VERSION;
  if (!read.general && read.locationId === null) errors.push("file: expected general settings and/or a location's weather");
  if (read.general !== null) {
    if (!isRecord(read.general)) errors.push("general: expected object");
    else {
      for (const part of Object.keys(read.general)) {
        if (!V2_GENERAL_PARTS.includes(part)) { errors.push(`general.${part}: unknown general weather part`); continue; }
        const hash = read.generalBaseHashes?.[part];
        if (!HEX_HASH.test(String(hash || ""))) errors.push(`baseHashes.${legacy ? "" : "general."}${part}: expected SHA-256 hex hash`);
        validateGeneralPart(part, read.general[part], generalTemplates?.[part], legacy ? part : `general.${part}`, errors);
      }
      if (!legacy) {
        for (const part of V2_GENERAL_PARTS) {
          if (!Object.hasOwn(read.general, part)) errors.push(`general.${part}: missing general weather part`);
        }
      }
    }
  }
  if (read.locationId !== null || read.locationWeather !== null) {
    if (typeof read.locationId !== "string" || !LOCATION_ID.test(read.locationId)) {
      errors.push("locationId: expected valid location id");
    } else if (locations?.map && !Object.hasOwn(locations.map, read.locationId)) {
      errors.push(`locationId: unknown location "${read.locationId}"`);
    }
    if (!HEX_HASH.test(String(read.locationWeatherBaseHash || ""))) errors.push("baseHashes.locationWeather: expected SHA-256 hex hash");
    if (!isRecord(read.locationWeather)) errors.push("locationWeather: expected object");
    else {
      // Spec 187 D8: the location's look holds only what it overrides, so it is checked on its own (against the general
      // looks' strength values), not against the code's (usually empty) look.
      if (locationWeatherTemplate) {
        collectTemplateIssues(withoutLook(locationWeatherTemplate), withoutLook(read.locationWeather), "locationWeather", errors);
      }
      validateLocationLook(read.locationWeather.look, generalTemplates, errors);
      validateLocationWeatherDomain(read.locationWeather, errors);
    }
  }
  return errors;
}

export function diffGeneralPart(base, next) {
  return diffCanonicalObjects(canonicalGeneralPart(base), canonicalGeneralPart(next));
}

export function diffLocationWeather(base, next) {
  return diffCanonicalObjects(canonicalLocationWeather(base), canonicalLocationWeather(next));
}

// The parts that differ from the code, as "general.<id>" / "location.<id>". baseGeneral / liveGeneral: { id: value },
// baseLocation / liveLocation: { weather, current } (parts missing in either are skipped).
export function changedWeatherParts({ baseGeneral = null, liveGeneral = null, baseLocation = null, liveLocation = null }) {
  const changed = [];
  for (const id of GENERAL_WEATHER_PART_IDS) {
    const base = baseGeneral?.[id], live = liveGeneral?.[id];
    if (base && live && diffGeneralPart(base, live).length) changed.push(`general.${id}`);
  }
  for (const id of LOCATION_WEATHER_PART_IDS) {
    const base = baseLocation?.[id], live = liveLocation?.[id];
    if (base && live && diffGeneralPart(base, live).length) changed.push(`location.${id}`);
  }
  return changed;
}

export function generalModuleSource(part, value) {
  const spec = GENERAL_WEATHER_PARTS[part];
  if (!spec) throw new Error(`unknown general weather part ${part}`);
  return `${spec.header}export const ${spec.exportName} = ${JSON.stringify(canonicalGeneralPart(value), null, 2)};\n`;
}

// Spec 189: a location part's data module (its weather, its current).
export function locationPartModuleSource(part, locationId, value) {
  const spec = LOCATION_WEATHER_PARTS[part];
  if (!spec) throw new Error(`unknown location weather part ${part}`);
  return `${spec.header(locationId)}export const ${spec.exportName} = ${JSON.stringify(canonicalGeneralPart(value), null, 2)};\n`;
}

export function locationWeatherModuleSource(locationId, weather) {
  return locationPartModuleSource("weather", locationId, weather);
}
