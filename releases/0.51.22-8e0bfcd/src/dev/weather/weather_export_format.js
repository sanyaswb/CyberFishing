import {
  canonicalHash,
  cleanCanonical,
  collectTemplateIssues,
  diffCanonicalObjects,
  formatExportFileName,
} from "../tools/export/canonical_export_format.js";

// Canonical form of weather settings (spec 175, spec 176): DevTools «🌧 ПОГОДА» export/import and
// `npm run apply:weather` read and write through this module so hashes and written modules never depend on key order.
export const WEATHER_FILE_FORMAT = "cyber-fishing/weather";
export const WEATHER_FILE_VERSION = 1;
export const RAIN_SETTINGS_MODULE = "src/game/config/raw/weather/rain_settings.js";

const LOCATION_ID = /^[A-Za-z0-9_-]+$/u;
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;
const HEX_HASH = /^[0-9a-f]{64}$/iu;
const VALID_PHASES = new Set(["morning", "day", "evening", "night"]);

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

export function canonicalRain(rain = {}) {
  return cleanCanonical(rain, { sortKeys: true });
}

export function canonicalLocationWeather(weather = {}) {
  return cleanCanonical(weather, { sortKeys: true });
}

export async function rainHash(rain, hashText) {
  return await canonicalHash(canonicalRain(rain), hashText);
}

export async function locationWeatherHash(weather, hashText) {
  return await canonicalHash(canonicalLocationWeather(weather), hashText);
}

export function weatherFileName(locationId, version, date) {
  return formatExportFileName(`weather-${locationId}`, version, date);
}

export function buildWeatherFile({ locationId, rain, locationWeather, rainBaseHash, locationWeatherBaseHash, gameVersion, exportedAt }) {
  return {
    format: WEATHER_FILE_FORMAT,
    formatVersion: WEATHER_FILE_VERSION,
    gameVersion,
    locationId,
    exportedAt,
    baseHashes: {
      rain: rainBaseHash,
      locationWeather: locationWeatherBaseHash,
    },
    rain: canonicalRain(rain),
    locationWeather: canonicalLocationWeather(locationWeather),
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

function validateRainDomain(rain, errors) {
  for (const [dotPath, min, max] of RAIN_RANGES) checkRange(readPath(rain, dotPath), `rain.${dotPath}`, min, max, errors);
  for (const [key, min, max] of RAIN_STRENGTH_RANGES) checkPair(rain.strength?.[key], `rain.strength.${key}`, min, max, false, errors);
  for (const dotPath of ["color", "rings.color", "emissionColor", "rings.emissionColor"]) {
    const color = readPath(rain, dotPath);
    if (typeof color === "string" && !HEX_COLOR.test(color)) errors.push(`rain.${dotPath}: must be #rrggbb`);
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
  if (isRecord(fog) && Array.isArray(fog.phases)) {
    if (!fog.phases.length) errors.push("locationWeather.fog.phases: must not be empty");
    for (const phase of fog.phases) {
      if (!VALID_PHASES.has(phase)) errors.push(`locationWeather.fog.phases: unknown phase ${phase}`);
    }
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
    if (isRecord(wind.weatherBoost)) {
      for (const key of ["rainMinStrength", "rainBonus", "stormMinStrength"]) {
        checkRange(wind.weatherBoost[key], `locationWeather.wind.weatherBoost.${key}`, 0, 1, errors);
      }
    }
    if (isRecord(wind.gust)) {
      for (const key of ["chancePerSec", "rainChanceMult", "stormChanceMult"]) {
        checkRange(wind.gust[key], `locationWeather.wind.gust.${key}`, 0, Infinity, errors);
      }
      checkRange(wind.gust.attackShare, "locationWeather.wind.gust.attackShare", 0.05, 0.95, errors);
      checkPair(wind.gust.durationSec, "locationWeather.wind.gust.durationSec", 0.1, Infinity, true, errors);
      checkPair(wind.gust.deltaRange, "locationWeather.wind.gust.deltaRange", 0, 1, true, errors);
    }
    if (isRecord(wind.float)) {
      checkRange(wind.float.maxAngleDeg, "locationWeather.wind.float.maxAngleDeg", 0, 90, errors);
      checkPair(wind.float.returnPctRange, "locationWeather.wind.float.returnPctRange", 0, 1, true, errors);
      checkPair(wind.float.cycleDurationSec, "locationWeather.wind.float.cycleDurationSec", 0.05, Infinity, true, errors);
      checkPair(wind.float.amplitudeJitter, "locationWeather.wind.float.amplitudeJitter", 0, 5, true, errors);
    }
  }
}

export function validateWeatherFile(file, { rainTemplate, locationWeatherTemplate, locations = null } = {}) {
  const errors = [];
  if (!isRecord(file)) return ["file: expected JSON object"];
  if (file.format !== WEATHER_FILE_FORMAT) errors.push(`format: expected "${WEATHER_FILE_FORMAT}"`);
  if (file.formatVersion !== WEATHER_FILE_VERSION) errors.push(`formatVersion: expected ${WEATHER_FILE_VERSION}`);
  if (typeof file.locationId !== "string" || !LOCATION_ID.test(file.locationId)) {
    errors.push("locationId: expected valid location id");
  } else if (locations?.map && !Object.hasOwn(locations.map, file.locationId)) {
    errors.push(`locationId: unknown location "${file.locationId}"`);
  }
  if (!isRecord(file.baseHashes) || !HEX_HASH.test(String(file.baseHashes.rain || ""))
    || !HEX_HASH.test(String(file.baseHashes.locationWeather || ""))) {
    errors.push("baseHashes: expected SHA-256 hex hashes for rain and locationWeather");
  }
  if (!isRecord(file.rain)) errors.push("rain: expected object");
  else {
    if (rainTemplate) collectTemplateIssues(rainTemplate, file.rain, "rain", errors);
    validateRainDomain(file.rain, errors);
  }
  if (!isRecord(file.locationWeather)) errors.push("locationWeather: expected object");
  else {
    if (locationWeatherTemplate) collectTemplateIssues(locationWeatherTemplate, file.locationWeather, "locationWeather", errors);
    validateLocationWeatherDomain(file.locationWeather, errors);
  }
  return errors;
}

export function diffWeatherParts(baseRain, nextRain, baseLocationWeather, nextLocationWeather) {
  return {
    rain: diffCanonicalObjects(canonicalRain(baseRain), canonicalRain(nextRain)),
    locationWeather: diffCanonicalObjects(canonicalLocationWeather(baseLocationWeather), canonicalLocationWeather(nextLocationWeather)),
  };
}

export function changedWeatherParts(baseRain, nextRain, baseLocationWeather, nextLocationWeather) {
  const diff = diffWeatherParts(baseRain, nextRain, baseLocationWeather, nextLocationWeather);
  const changed = [];
  if (diff.rain.length) changed.push("rain");
  if (diff.locationWeather.length) changed.push("locationWeather");
  return changed;
}

export function rainModuleSource(rain) {
  return "// Procedural rain and water-ring settings (spec 172 D4, spec 175): CONFIG.canvas.rain reads them; DevTools\n"
    + "// «🌧 ПОГОДА» edits them live and exports a file; `npm run apply:weather` rewrites this whole file in this form.\n"
    + "// Hand edits are fine.\n"
    + `export const RAIN_SETTINGS = ${JSON.stringify(canonicalRain(rain), null, 2)};\n`;
}

export function locationWeatherModuleSource(locationId, weather) {
  return `// Weather of the location "${locationId}" (spec 172, 175, 180): independent events rain, storm (with its lightning) and fog,\n`
    + "// each a check + chance and a timeline rolled at its start. `npm run apply:weather` rewrites this whole file in this form.\n"
    + `export const WEATHER = ${JSON.stringify(canonicalLocationWeather(weather), null, 2)};\n`;
}
