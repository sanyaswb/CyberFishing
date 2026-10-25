// TK-099: the radio's sound settings file (exported by DevTools «📻 РАДІО», applied by `npm run apply:radio`) and the
// data module src/game/config/raw/radio/radio_sound_settings.js. One canonical form (keys sorted, binary-fraction noise
// removed) feeds the hash, the file and the module, so the browser and the script agree on the text.
export const RADIO_SOUND_FILE_FORMAT = "cyber-fishing-radio-sound";
export const RADIO_SOUND_FILE_VERSION = 1;
export const RADIO_SOUND_MODULE = "src/game/config/raw/radio/radio_sound_settings.js";

const clean = (value) => Number.isFinite(value) ? Number(value.toPrecision(12)) : value;

export function canonicalSettings(value) {
  if (Array.isArray(value)) return value.map(canonicalSettings);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalSettings(value[key])]));
  }
  return typeof value === "number" ? clean(value) : value;
}

// The settings part of CONFIG.radio that the file carries.
export function pickSettings(radio = {}) {
  return canonicalSettings({ effects: radio.effects || {}, signal: radio.signal || {} });
}

// hashText(text) -> hex SHA-256 (or a promise of it): Web Crypto in the browser, node:crypto in the script.
export async function settingsHash(settings, hashText) {
  return await hashText(JSON.stringify(canonicalSettings(settings)));
}

export function settingsFileName(version, date) {
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `radio-sound-v${version}-${stamp}.json`;
}

export function buildSettingsFile({ settings, baseHash, gameVersion, exportedAt }) {
  return { format: RADIO_SOUND_FILE_FORMAT, formatVersion: RADIO_SOUND_FILE_VERSION, gameVersion, exportedAt, baseHash,
    settings: canonicalSettings(settings) };
}

// The problems of a file against the code's settings (same keys, same value types); empty when valid.
export function validateSettingsFile(file, reference) {
  const errors = [];
  if (!file || typeof file !== "object") return ["the file is not an object"];
  if (file.format !== RADIO_SOUND_FILE_FORMAT) errors.push(`format: expected ${RADIO_SOUND_FILE_FORMAT}`);
  if (file.formatVersion !== RADIO_SOUND_FILE_VERSION) errors.push(`formatVersion: expected ${RADIO_SOUND_FILE_VERSION}`);
  if (typeof file.baseHash !== "string" || !file.baseHash) errors.push("baseHash: missing");
  compare(file.settings, reference, "settings", errors);
  return errors;
}

function compare(value, reference, path, errors) {
  if (Array.isArray(reference)) {
    if (!Array.isArray(value) || value.length !== reference.length || !value.every((entry) => Number.isFinite(entry))) {
      errors.push(`${path}: ${reference.length} finite numbers`);
    }
    return;
  }
  if (reference && typeof reference === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${path}: an object`); return; }
    for (const key of Object.keys(value)) if (!(key in reference)) errors.push(`${path}.${key}: unknown setting`);
    for (const key of Object.keys(reference)) {
      if (!(key in value)) errors.push(`${path}.${key}: missing`);
      else compare(value[key], reference[key], `${path}.${key}`, errors);
    }
    return;
  }
  if (typeof reference === "number" && !Number.isFinite(value)) errors.push(`${path}: a finite number`);
  else if (typeof reference !== "number" && typeof value !== typeof reference) errors.push(`${path}: a ${typeof reference}`);
}

// [{ path, from, to }] for every leaf that differs.
export function diffSettings(before, after, path = "") {
  const changes = [];
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      changes.push(...diffSettings(before[key], after[key], path ? `${path}.${key}` : key));
    }
    return changes;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ path, from: before, to: after });
  return changes;
}

export function settingsModuleSource(settings) {
  return [
    "// The radio's sound settings (spec 142, TK-097..099): the effects chain and the signal's interference. CONFIG.radio",
    "// reads them; DevTools «📻 РАДІО» edits them live and exports a file; `npm run apply:radio` rewrites this whole file",
    "// in this form. Hand edits are fine.",
    `export const RADIO_SOUND_SETTINGS = ${JSON.stringify(canonicalSettings(settings), null, 2)};`,
    "",
  ].join("\n");
}
