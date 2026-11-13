import {
  canonicalHash,
  cleanCanonical,
  collectTemplateIssues,
  diffCanonicalObjects,
  formatExportFileName,
} from "../tools/export/canonical_export_format.js";

// TK-099 / spec 176: the radio's sound settings file (exported by DevTools «📻 РАДІО», applied by `npm run apply:radio`)
// and the data module src/game/config/raw/radio/radio_sound_settings.js.
export const RADIO_SOUND_FILE_FORMAT = "cyber-fishing-radio-sound";
export const RADIO_SOUND_FILE_VERSION = 1;
export const RADIO_SOUND_MODULE = "src/game/config/raw/radio/radio_sound_settings.js";

export function canonicalSettings(value) {
  return cleanCanonical(value, { sortKeys: true });
}

// The settings part of CONFIG.radio that the file carries.
export function pickSettings(radio = {}) {
  return canonicalSettings({ effects: radio.effects || {}, signal: radio.signal || {} });
}

// hashText(text) -> hex SHA-256 (or a promise of it): Web Crypto in the browser, node:crypto in the script.
export async function settingsHash(settings, hashText) {
  return await canonicalHash(canonicalSettings(settings), hashText);
}

export function settingsFileName(version, date) {
  return formatExportFileName("radio-sound", version, date);
}

export function buildSettingsFile({ settings, baseHash, gameVersion, exportedAt }) {
  return {
    format: RADIO_SOUND_FILE_FORMAT,
    formatVersion: RADIO_SOUND_FILE_VERSION,
    gameVersion,
    exportedAt,
    baseHash,
    settings: canonicalSettings(settings),
  };
}

// The problems of a file against the code's settings (same keys, same value types); empty when valid.
export function validateSettingsFile(file, reference) {
  const errors = [];
  if (!file || typeof file !== "object") return ["the file is not an object"];
  if (file.format !== RADIO_SOUND_FILE_FORMAT) errors.push(`format: expected ${RADIO_SOUND_FILE_FORMAT}`);
  if (file.formatVersion !== RADIO_SOUND_FILE_VERSION) errors.push(`formatVersion: expected ${RADIO_SOUND_FILE_VERSION}`);
  if (typeof file.baseHash !== "string" || !file.baseHash) errors.push("baseHash: missing");
  collectTemplateIssues(reference, file.settings, "settings", errors);
  return errors;
}

// [{ path, from, to }] for every leaf that differs.
export function diffSettings(before, after, path = "") {
  return diffCanonicalObjects(before, after, path);
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
