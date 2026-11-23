// Limits of the general weather settings (spec 180 D3/D7, TK-332): CONFIG.weather.storm / wind and CONFIG.canvas.ash.
// The config schema (`ConfigSchemaValidator`) and the weather files of DevTools «ПОГОДА» / `npm run apply:weather` read
// the same tables, so a file accepted for the code always passes the schema. Rows: [key, min, max]; pairs are
// [key, min, max, ordered] — `ordered` pairs are [min, max] with min <= max, the others [at 0, at 100] / [start, peak].
export const STORM_SETTINGS_RANGES = Object.freeze({
  numbers: Object.freeze([["rainChanceMult", 1, 100], ["rainStrengthMult", 1, 10], ["rainDropsShare", 0, 3],
    ["rainSlantDeg", 0, 60], ["windMinStrength", 0, 1], ["gustChanceMult", 0, 20]]),
});

export const WIND_SETTINGS_RANGES = Object.freeze({
  numbers: Object.freeze([["rainSlantDeg", 0, 60], ["slantFollowPerSec", 0, 60], ["gustSlantShare", 0, 10],
    ["gustFollowPerSec", 0, 60], ["ashDriftPx", -500, 500]]),
  gust: Object.freeze({
    numbers: Object.freeze([["attackShare", 0.05, 0.8]]),
    pairs: Object.freeze([["deltaRange", 0, 1, true], ["durationSec", 0.1, 60, true]]),
  }),
  rain: Object.freeze({
    numbers: Object.freeze([["minStrength", 0, 1], ["bonus", 0, 1], ["gustChanceMult", 0, 20]]),
  }),
});

export const ASH_SETTINGS_RANGES = Object.freeze({
  numbers: Object.freeze([["flicker", 0, 1], ["fadeShare", 0, 0.5], ["windFollowPerSec", 0, 60]]),
  pairs: Object.freeze([["sizePx", 0, 200, true], ["lifeSec", 0.1, 60, true]]),
  strength: Object.freeze([["maxParticles", 0, 2000], ["opacity", 0, 1], ["riseSpeedPx", -500, 500], ["wanderPx", 0, 500]]),
  colors: Object.freeze(["hotColor", "coolColor"]),
});

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function numberIssues(record, rows, path, issues) {
  for (const [key, min, max] of rows) {
    const value = record?.[key];
    if (!finite(value)) issues.push(`${path}.${key}: expected finite number`);
    else if (value < min || value > max) issues.push(`${path}.${key}: must be within [${min}, ${max}]`);
  }
}

function pairIssues(record, rows, path, issues) {
  for (const [key, min, max, ordered = false] of rows) {
    const pair = record?.[key];
    if (!Array.isArray(pair) || pair.length !== 2) { issues.push(`${path}.${key}: expected [a, b]`); continue; }
    for (let index = 0; index < 2; index++) {
      if (!finite(pair[index])) issues.push(`${path}.${key}[${index}]: expected finite number`);
      else if (pair[index] < min || pair[index] > max) issues.push(`${path}.${key}[${index}]: must be within [${min}, ${max}]`);
    }
    if (ordered && finite(pair[0]) && finite(pair[1]) && pair[0] > pair[1]) {
      issues.push(`${path}.${key}: min (${pair[0]}) must not exceed max (${pair[1]})`);
    }
  }
}

function tableIssues(record, table, path, issues) {
  if (!isRecord(record)) { issues.push(`${path}: expected object`); return; }
  if (table.numbers) numberIssues(record, table.numbers, path, issues);
  if (table.pairs) pairIssues(record, table.pairs, path, issues);
  if (table.strength) pairIssues(record.strength, table.strength, `${path}.strength`, issues);
  for (const key of table.colors ?? []) {
    if (typeof record[key] !== "string" || !HEX_COLOR.test(record[key])) issues.push(`${path}.${key}: must be #rrggbb`);
  }
  for (const [key, nested] of Object.entries(table)) {
    if (isRecord(nested) && !Array.isArray(nested)) tableIssues(record[key], nested, `${path}.${key}`, issues);
  }
}

// Range problems of one general part ("storm" | "wind" | "ash") as "path: message" lines; [] when it is within limits.
export function generalWeatherRangeIssues(part, value, path = part) {
  const table = { storm: STORM_SETTINGS_RANGES, wind: WIND_SETTINGS_RANGES, ash: ASH_SETTINGS_RANGES }[part];
  if (!table) return [`${path}: unknown general weather part`];
  const issues = [];
  tableIssues(value, table, path, issues);
  return issues;
}
