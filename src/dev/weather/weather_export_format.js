import {
  canonicalHash,
  cleanCanonical,
  collectTemplateIssues,
  diffCanonicalObjects,
  formatExportFileName,
} from "../tools/export/canonical_export_format.js";
import { generalWeatherRangeIssues } from "../../game/config/validation/weather_settings_ranges.js";

// Canonical form of weather settings (spec 175, spec 176, spec 180 D7): DevTools «ПОГОДА» export/import and
// `npm run apply:weather` read and write through this module so hashes and written modules never depend on key order.
// Format v2 (spec 180 stage D, TK-332): a file holds the level the selector shows — `general` (the rain, ash, storm and
// wind settings, the same on every location) and/or one location's weather. Format v1 (rain + location) still reads.
export const WEATHER_FILE_FORMAT = "cyber-fishing/weather";
export const WEATHER_FILE_VERSION = 2;
const LEGACY_FILE_VERSION = 1;

// The general weather data modules: where each lives, its export name, the CONFIG path it feeds and its file header.
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
    header: "// What a storm does, the same on every location (spec 180 D3, TK-326): CONFIG.weather.storm. Every effect is scaled by\n"
      + "// the storm's strength (0…1), so a weak storm changes little. A location sets only how often and how long its storms\n"
      + "// are (MAP_DB.<id>.weather.storm). DevTools «ПОГОДА» → «ШТОРМ» edits them live.\n"
      + "// `npm run apply:weather` rewrites this whole file in this form (spec 180 stage D).\n",
  }),
  wind: Object.freeze({
    module: "src/game/config/raw/weather/wind_settings.js",
    exportName: "WIND_SETTINGS",
    configPath: Object.freeze(["weather", "wind"]),
    header: "// How the wind acts, the same on every location (spec 180 D3, TK-326): CONFIG.weather.wind. The drops' slant and the\n"
      + "// ash's drift come from the wind (owner: the wind moves the drops); a gust's shape is here, how often gusts come is the\n"
      + "// location's (MAP_DB.<id>.weather.wind.gust.chancePerSec); the rain's effect on the wind is under `rain`. DevTools\n"
      + "// «ПОГОДА» → «ВІТЕР» edits them live. `npm run apply:weather` rewrites this whole file in this form (spec 180 stage D).\n",
  }),
});
export const GENERAL_WEATHER_PART_IDS = Object.freeze(Object.keys(GENERAL_WEATHER_PARTS));

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

// general: { rain, ash, storm, wind } (every part) or null; generalBaseHashes: the same keys → the code's hashes at
// export time; locationId + locationWeather + locationWeatherBaseHash, or a null locationId for a general-only file.
export function buildWeatherFile({
  general = null, generalBaseHashes = null, locationId = null, locationWeather = null, locationWeatherBaseHash = null,
  gameVersion, exportedAt,
}) {
  const file = { format: WEATHER_FILE_FORMAT, formatVersion: WEATHER_FILE_VERSION, gameVersion, exportedAt, baseHashes: {} };
  if (general) {
    file.general = {};
    file.baseHashes.general = {};
    for (const part of GENERAL_WEATHER_PART_IDS) {
      file.general[part] = canonicalGeneralPart(general[part]);
      file.baseHashes.general[part] = generalBaseHashes?.[part];
    }
  }
  if (locationId) {
    file.locationId = locationId;
    file.locationWeather = canonicalLocationWeather(locationWeather);
    file.baseHashes.locationWeather = locationWeatherBaseHash;
  }
  return file;
}

// One shape for both versions: { version, general: { part: value } | null, generalBaseHashes, locationId | null,
// locationWeather | null, locationWeatherBaseHash | null }. A v1 file is the rain part plus its location.
export function readWeatherFile(file) {
  if (!isRecord(file)) return null;
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
    general: "general" in file ? file.general : null,
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
      checkRange(storm.rain, "locationWeather.emission.storm.rain", 0, 1, errors);
      checkRange(storm.storm, "locationWeather.emission.storm.storm", 0, 1, errors);
    }
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

// generalTemplates: { rain, ash, storm, wind } as in the code (unknown and missing keys are refused);
// locations: CONFIG.locations (a location must exist in it).
export function validateWeatherFile(file, { generalTemplates = null, locationWeatherTemplate = null, locations = null } = {}) {
  if (!isRecord(file)) return ["file: expected JSON object"];
  const errors = [];
  if (file.format !== WEATHER_FILE_FORMAT) errors.push(`format: expected "${WEATHER_FILE_FORMAT}"`);
  if (file.formatVersion !== WEATHER_FILE_VERSION && file.formatVersion !== LEGACY_FILE_VERSION) {
    errors.push(`formatVersion: expected ${WEATHER_FILE_VERSION} (or ${LEGACY_FILE_VERSION})`);
    return errors;
  }
  const read = readWeatherFile(file);
  const legacy = read.version === LEGACY_FILE_VERSION;
  if (!read.general && read.locationId === null) errors.push("file: expected general settings and/or a location's weather");
  if (read.general !== null) {
    if (!isRecord(read.general)) errors.push("general: expected object");
    else {
      for (const part of Object.keys(read.general)) {
        if (!Object.hasOwn(GENERAL_WEATHER_PARTS, part)) { errors.push(`general.${part}: unknown general weather part`); continue; }
        const hash = read.generalBaseHashes?.[part];
        if (!HEX_HASH.test(String(hash || ""))) errors.push(`baseHashes.${legacy ? "" : "general."}${part}: expected SHA-256 hex hash`);
        validateGeneralPart(part, read.general[part], generalTemplates?.[part], legacy ? part : `general.${part}`, errors);
      }
      if (!legacy) {
        for (const part of GENERAL_WEATHER_PART_IDS) {
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
      if (locationWeatherTemplate) collectTemplateIssues(locationWeatherTemplate, read.locationWeather, "locationWeather", errors);
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

// The parts that differ from the code: general part ids ("rain", "ash", "storm", "wind") and "locationWeather".
// baseGeneral / liveGeneral: { part: value } (parts missing in either are skipped); location pair: null to skip.
export function changedWeatherParts({ baseGeneral = null, liveGeneral = null, baseLocationWeather = null, liveLocationWeather = null }) {
  const changed = [];
  for (const part of GENERAL_WEATHER_PART_IDS) {
    const base = baseGeneral?.[part], live = liveGeneral?.[part];
    if (base && live && diffGeneralPart(base, live).length) changed.push(part);
  }
  if (baseLocationWeather && liveLocationWeather && diffLocationWeather(baseLocationWeather, liveLocationWeather).length) {
    changed.push("locationWeather");
  }
  return changed;
}

export function generalModuleSource(part, value) {
  const spec = GENERAL_WEATHER_PARTS[part];
  if (!spec) throw new Error(`unknown general weather part ${part}`);
  return `${spec.header}export const ${spec.exportName} = ${JSON.stringify(canonicalGeneralPart(value), null, 2)};\n`;
}

export function locationWeatherModuleSource(locationId, weather) {
  return `// Weather of the location "${locationId}" (spec 172, 175, 180): independent events rain, storm (with its lightning) and fog,\n`
    + "// each a check + chance and a timeline rolled at its start. `npm run apply:weather` rewrites this whole file in this form.\n"
    + `export const WEATHER = ${JSON.stringify(canonicalLocationWeather(weather), null, 2)};\n`;
}
