// Canonical form of weather settings (spec 175): DevTools «🌧 ПОГОДА» export/import and `npm run apply:weather`
// read and write through this module so hashes and written data modules never depend on key order.
export const WEATHER_FILE_FORMAT = "cyber-fishing/weather";
export const WEATHER_FILE_VERSION = 1;
export const RAIN_SETTINGS_MODULE = "src/game/config/raw/weather/rain_settings.js";

const LOCATION_ID = /^[A-Za-z0-9_-]+$/u;
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;
const HEX_HASH = /^[0-9a-f]{64}$/iu;
const VALID_PHASES = new Set(["morning", "day", "evening", "night"]);

const RAIN_RANGES = Object.freeze([
  ["maxDrops", 0, 5000],
  ["stormDropsShare", 0, 3],
  ["fallPx", 1, 4000],
  ["speedPx", 1, 10000],
  ["speedJitter", 0, 1],
  ["lengthPx", 0, 400],
  ["widthPx", 0, 20],
  ["opacity", 0, 1],
  ["minScale", 0, 1],
  ["windSlantDeg", 0, 60],
  ["stormSlantDeg", 0, 60],
  ["rings.maxRings", 0, 5000],
  ["rings.sizePx", 0, 400],
  ["rings.lifeSec", 0.05, 10],
  ["rings.opacity", 0, 1],
  ["rings.flatten", 0, 1],
  ["rings.ripple.strength", 0, 2],
  ["rings.ripple.radiusScale", 0, 10],
]);

export function locationWeatherModulePath(locationId) {
  return `src/game/config/raw/locations/weather/${locationId}.js`;
}

// Binary-fraction noise (TK-077) collapses onto the exact short decimal within 1e-12 while genuine decimals keep precision.
function clean(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isInteger(value)) return value;
    const short = Number(value.toPrecision(12));
    return Math.abs(short - value) <= Math.abs(value) * 1e-12 ? short : value;
  }
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, clean(value[key])]));
  }
  return value;
}

export function canonicalRain(rain = {}) {
  return clean(rain);
}

export function canonicalLocationWeather(weather = {}) {
  return clean(weather);
}

export async function rainHash(rain, hashText) {
  return await hashText(JSON.stringify(canonicalRain(rain)));
}

export async function locationWeatherHash(weather, hashText) {
  return await hashText(JSON.stringify(canonicalLocationWeather(weather)));
}

export function weatherFileName(locationId, version, date) {
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `weather-${locationId}-v${version}-${stamp}.json`;
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

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);

function readPath(object, dotPath) {
  let current = object;
  for (const key of dotPath.split(".")) current = current?.[key];
  return current;
}

function collectTemplateIssues(template, candidate, path, errors) {
  if (!isRecord(template)) {
    if (Array.isArray(template)) {
      if (!Array.isArray(candidate)) { errors.push(`${path}: expected array`); return; }
      const itemType = typeof template[0];
      if (itemType === "number" && candidate.length !== template.length) {
        errors.push(`${path}: expected ${template.length} items`);
      }
      for (let i = 0; i < candidate.length; i++) {
        if (itemType === "number" && !finite(candidate[i])) errors.push(`${path}[${i}]: expected finite number`);
        else if (itemType !== "number" && typeof candidate[i] !== itemType) errors.push(`${path}[${i}]: expected ${itemType}`);
      }
      return;
    }
    if (typeof template === "number") {
      if (!finite(candidate)) errors.push(`${path}: expected finite number`);
      return;
    }
    if (typeof candidate !== typeof template) errors.push(`${path}: expected ${typeof template}`);
    return;
  }
  if (!isRecord(candidate)) { errors.push(`${path}: expected object`); return; }
  for (const key of Object.keys(candidate)) {
    if (!Object.hasOwn(template, key)) errors.push(`${path}.${key}: unknown setting`);
  }
  for (const key of Object.keys(template)) {
    if (!Object.hasOwn(candidate, key)) { errors.push(`${path}.${key}: missing setting`); continue; }
    collectTemplateIssues(template[key], candidate[key], `${path}.${key}`, errors);
  }
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

function validateRainDomain(rain, errors) {
  for (const [dotPath, min, max] of RAIN_RANGES) checkRange(readPath(rain, dotPath), `rain.${dotPath}`, min, max, errors);
  for (const dotPath of ["color", "rings.color"]) {
    const color = readPath(rain, dotPath);
    if (typeof color === "string" && !HEX_COLOR.test(color)) errors.push(`rain.${dotPath}: must be #rrggbb`);
  }
}

function validateLocationWeatherDomain(weather, errors) {
  const p = weather.precipitation;
  if (isRecord(p)) {
    for (const key of ["fadeInSec", "fadeOutSec"]) checkRange(p[key], `locationWeather.precipitation.${key}`, 0, Infinity, errors);
    for (const state of ["clear", "rain", "storm"]) {
      const entry = p[state];
      if (!isRecord(entry)) continue;
      checkRange(entry.weight, `locationWeather.precipitation.${state}.weight`, 0, Infinity, errors);
      checkPair(entry.durationSec, `locationWeather.precipitation.${state}.durationSec`, 0, Infinity, true, errors);
      if (state !== "clear") {
        checkPair(entry.intensity, `locationWeather.precipitation.${state}.intensity`, 0, 1, true, errors);
      }
    }
  }
  const fog = weather.fog;
  if (isRecord(fog)) {
    checkRange(fog.chance, "locationWeather.fog.chance", 0, 1, errors);
    for (const key of ["fadeInSec", "fadeOutSec"]) checkRange(fog[key], `locationWeather.fog.${key}`, 0, Infinity, errors);
    checkPair(fog.idleSec, "locationWeather.fog.idleSec", 0, Infinity, true, errors);
    checkPair(fog.durationSec, "locationWeather.fog.durationSec", 0, Infinity, true, errors);
    checkPair(fog.intensity, "locationWeather.fog.intensity", 0, 1, true, errors);
    if (Array.isArray(fog.phases)) {
      if (!fog.phases.length) errors.push("locationWeather.fog.phases: must not be empty");
      for (const phase of fog.phases) {
        if (!VALID_PHASES.has(phase)) errors.push(`locationWeather.fog.phases: unknown phase ${phase}`);
      }
    }
  }
  const lightning = weather.lightning;
  if (isRecord(lightning)) {
    checkPair(lightning.intervalSec, "locationWeather.lightning.intervalSec", 0.05, Infinity, false, errors);
    checkPair(lightning.distance, "locationWeather.lightning.distance", 0, 1, true, errors);
  }
  const thresholds = weather.thresholds;
  if (isRecord(thresholds)) {
    checkRange(thresholds.rain, "locationWeather.thresholds.rain", 0, 1, errors);
    checkRange(thresholds.fog, "locationWeather.thresholds.fog", 0, 1, errors);
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

export function diffCanonicalObjects(current, next, prefix = "") {
  if (!isRecord(current) || !isRecord(next)) {
    return JSON.stringify(current) === JSON.stringify(next) ? [] : [{ path: prefix, from: current, to: next }];
  }
  const changes = [];
  for (const key of Object.keys(current).sort()) {
    const path = prefix ? `${prefix}.${key}` : key;
    changes.push(...diffCanonicalObjects(current[key], next[key], path));
  }
  return changes;
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
  return `// Weather of the location "${locationId}" (spec 172, spec 175): precipitation clear -> rain -> storm (storm only after rain),\n`
    + "// fog and lightning. `npm run apply:weather` rewrites this whole file in this form; hand edits are fine.\n"
    + `export const WEATHER = ${JSON.stringify(canonicalLocationWeather(weather), null, 2)};\n`;
}
