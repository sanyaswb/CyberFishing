"use strict";

// npm run apply:radio -- <file.json> [--yes] [--force]  (TK-099, spec 176)
// Moves a radio sound settings file exported by DevTools «📻 РАДІО» into src/game/config/raw/radio/radio_sound_settings.js
// via the shared runModuleApply pipeline.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const {
  gitDirectory, askYes, isDirty, runChecks, resolveExportedFile, describeLeafChanges, runModuleApply,
} = require("./apply-module-helpers.js");

const FORMAT_MODULE = "src/dev/radio/radio_sound_settings_format.js";
const sha256 = (text) => crypto.createHash("sha256").update(text, "utf8").digest("hex");

class RadioSoundApplier {
  #format; #target; #readSettings; #isDirty; #confirm; #backupDir; #runChecks; #log; #now;

  constructor({ format, target, readSettings, isDirty, confirm, backupDir, runChecks, log, now }) {
    this.#format = format; this.#target = target; this.#readSettings = readSettings; this.#isDirty = isDirty;
    this.#confirm = confirm; this.#backupDir = backupDir; this.#runChecks = runChecks; this.#log = log; this.#now = now;
  }

  async apply(fileText, options = {}) {
    const format = this.#format;
    return runModuleApply({
      fileText,
      ...options,
      isDirty: this.#isDirty,
      confirm: this.#confirm,
      backupDir: this.#backupDir,
      runChecks: this.#runChecks,
      log: this.#log,
      now: this.#now,
      prepare: async (file, refuse) => {
        if (!fs.existsSync(this.#target)) { refuse(`немає модуля ${this.#target}`); return null; }
        const current = await this.#readSettings(this.#target);
        const errors = format.validateSettingsFile(file, current);
        if (errors.length) { refuse(`файл не пройшов перевірку:\n  ${errors.join("\n  ")}`); return null; }
        return {
          unchangedMessage: "Налаштування звуку в коді вже такі, як у файлі. Нічого не змінено.",
          forceMessage: "застосуйте з --force, щоб замінити налаштування в коді налаштуваннями з файлу",
          reloadHint: "Перезавантажте DEV-сторінку (або скиньте зміни CONFIG у DevTools), щоб почути налаштування з коду. Закомітьте зміну самі.",
          parts: [{
            target: this.#target,
            conflictMessage: "Конфлікт: налаштування звуку в коді змінилися після експорту.",
            currentHash: await format.settingsHash(current, sha256),
            baseHash: file.baseHash,
            changes: format.diffSettings(format.canonicalSettings(current), file.settings),
            describe: describeLeafChanges,
            backupFile: (prefix) => `${prefix}-radio_sound_settings.js`,
            source: () => format.settingsModuleSource(file.settings),
          }],
        };
      },
    });
  }
}

async function main(argv) {
  const root = path.resolve(__dirname, "..");
  const fileArgument = argv.find((argument) => !argument.startsWith("--"));
  if (!fileArgument) throw new Error("Usage: npm run apply:radio -- <radio sound file.json> [--yes] [--force]");
  const format = await import(pathToFileURL(path.join(root, FORMAT_MODULE)).href);
  const applier = new RadioSoundApplier({
    format,
    target: format.RADIO_SOUND_MODULE,
    readSettings: async (target) => (await import(`${pathToFileURL(path.join(root, target)).href}?read=${Date.now()}`))
      .RADIO_SOUND_SETTINGS,
    isDirty: (target) => isDirty(root, target),
    confirm: askYes,
    backupDir: path.join(gitDirectory(root, "apply-radio"), "cyber-fishing-backups", "radio"),
    runChecks: () => runChecks(root, ["config-schema", "radio-receiver"]),
    log: (message) => console.log(message),
    now: () => new Date(),
  });
  process.chdir(root);
  const outcome = await applier.apply(fs.readFileSync(resolveExportedFile(process.env.INIT_CWD || root, fileArgument), "utf8"), {
    yes: argv.includes("--yes"), force: argv.includes("--force") });
  if (outcome === "refused") process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { RadioSoundApplier, sha256 };
