"use strict";

// npm run apply:radio -- <file.json> [--yes] [--force]  (TK-099)
// Moves a radio sound settings file exported by DevTools «📻 РАДІО» into the data module
// src/game/config/raw/radio/radio_sound_settings.js, like apply:zones: validates the file against the code's settings
// (same keys and value types), refuses a module with uncommitted changes, stops on a conflict (the code changed after
// the export) unless --force, shows the change, asks for confirmation (--yes skips it), backs the module up under the
// Git directory, writes it in canonical form and runs the config and radio checks. It never commits or pushes.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { stamp, gitDirectory, askYes, isDirty, runChecks } = require("./apply-module-helpers.js");

const FORMAT_MODULE = "src/dev/radio/radio_sound_settings_format.js";
const sha256 = text => crypto.createHash("sha256").update(text, "utf8").digest("hex");

// The steps with every outside effect injected, so the tooling check runs them in a scratch directory.
class RadioSoundApplier {
  #format; #target; #readSettings; #isDirty; #confirm; #backupDir; #runChecks; #log; #now;

  constructor({ format, target, readSettings, isDirty, confirm, backupDir, runChecks, log, now }) {
    this.#format = format; this.#target = target; this.#readSettings = readSettings; this.#isDirty = isDirty;
    this.#confirm = confirm; this.#backupDir = backupDir; this.#runChecks = runChecks; this.#log = log; this.#now = now;
  }

  // Returns "applied", "unchanged", "cancelled" or "refused" (with the reason logged).
  async apply(fileText, { yes = false, force = false } = {}) {
    const format = this.#format;
    let file;
    try { file = JSON.parse(fileText); } catch (error) { return this.#refuse(`файл не є JSON (${error.message})`); }
    if (!fs.existsSync(this.#target)) return this.#refuse(`немає модуля ${this.#target}`);
    const current = await this.#readSettings(this.#target);
    const errors = format.validateSettingsFile(file, current);
    if (errors.length) return this.#refuse(`файл не пройшов перевірку:\n  ${errors.join("\n  ")}`);
    if (this.#isDirty(this.#target)) {
      return this.#refuse(`${this.#target} має незакомічені зміни; закомітьте або відкиньте їх, щоб не затерти ручні правки`);
    }
    const currentHash = await format.settingsHash(current, sha256);
    if (currentHash !== file.baseHash) {
      this.#log("Конфлікт: налаштування звуку в коді змінилися після експорту.");
      this.#log(this.#describe(format.diffSettings(format.canonicalSettings(current), file.settings), "код -> файл"));
      if (!force) return this.#refuse("застосуйте з --force, щоб замінити налаштування в коді налаштуваннями з файлу");
    }
    const changes = format.diffSettings(format.canonicalSettings(current), file.settings);
    if (!changes.length) { this.#log("Налаштування звуку в коді вже такі, як у файлі. Нічого не змінено."); return "unchanged"; }
    this.#log(`Зміни для ${this.#target}:`);
    this.#log(this.#describe(changes, "зараз -> буде"));
    if (!yes && !(await this.#confirm(`Застосувати до ${this.#target}? (y/N) `))) {
      this.#log("Скасовано. Нічого не змінено.");
      return "cancelled";
    }
    fs.mkdirSync(this.#backupDir, { recursive: true });
    const backup = path.join(this.#backupDir, `${stamp(this.#now())}-radio_sound_settings.js`);
    fs.copyFileSync(this.#target, backup);
    fs.writeFileSync(this.#target, format.settingsModuleSource(file.settings));
    this.#log(`Записано ${this.#target}. Бекап: ${backup}`);
    this.#log(`Відкат: copy "${backup}" "${this.#target}"`);
    this.#runChecks();
    this.#log("Перезавантажте DEV-сторінку (або скиньте зміни CONFIG у DevTools), щоб почути налаштування з коду. Закомітьте зміну самі.");
    return "applied";
  }

  #refuse(reason) {
    this.#log(`Не застосовано: ${reason}`);
    return "refused";
  }

  #describe(changes, direction) {
    const value = item => item === undefined ? "немає" : JSON.stringify(item);
    return `  (${direction})\n${changes.map(change => `  ${change.path}: ${value(change.from)} -> ${value(change.to)}`).join("\n")}`;
  }
}

async function main(argv) {
  const root = path.resolve(__dirname, "..");
  const fileArgument = argv.find(argument => !argument.startsWith("--"));
  if (!fileArgument) throw new Error("Usage: npm run apply:radio -- <radio sound file.json> [--yes] [--force]");
  const format = await import(pathToFileURL(path.join(root, FORMAT_MODULE)).href);
  const applier = new RadioSoundApplier({
    format,
    target: format.RADIO_SOUND_MODULE,
    // A fresh import each time: the module may have been rewritten in this process.
    readSettings: async target => (await import(`${pathToFileURL(path.join(root, target)).href}?read=${Date.now()}`))
      .RADIO_SOUND_SETTINGS,
    isDirty: target => isDirty(root, target),
    confirm: askYes,
    backupDir: path.join(gitDirectory(root, "apply-radio"), "cyber-fishing-backups", "radio"),
    runChecks: () => runChecks(root, ["config-schema", "radio-receiver"]),
    log: message => console.log(message),
    now: () => new Date(),
  });
  process.chdir(root);
  const outcome = await applier.apply(fs.readFileSync(path.resolve(process.env.INIT_CWD || root, fileArgument), "utf8"), {
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
