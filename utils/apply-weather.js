"use strict";

// npm run apply:weather -- <file.json> [--yes] [--force]  (spec 175 TK-286, spec 176, spec 180 stage D TK-332)
// Moves a weather file exported by DevTools «ПОГОДА» into the changed data modules via the shared runModuleApply
// pipeline: the general settings (`weather/rain_settings.js`, `ash_settings.js`, `storm_settings.js`,
// `wind_settings.js`) and/or one location's `locations/weather/<id>.js` — whatever the file holds (format v2; v1 = rain
// and a location).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const {
  gitDirectory, askYes, isDirty, runChecks, resolveExportedFile, describeLeafChanges, runModuleApply,
} = require("./apply-module-helpers.js");

const FORMAT_MODULE = "src/dev/weather/weather_export_format.js";
const CONFIG_MODULE = "src/game/config/runtime/game_config.js";
const sha256 = (text) => crypto.createHash("sha256").update(text, "utf8").digest("hex");
const PART_NAMES = Object.freeze({ rain: "дощу", ash: "попелу", storm: "шторму", wind: "вітру" });

class WeatherFileApplier {
  #format; #locations; #generalModulePath; #locationModulePath; #readGeneral; #readLocationWeather;
  #isDirty; #confirm; #backupDir; #runChecks; #log; #now;

  // generalModulePath(part) / readGeneral(target, part): the general data module of "rain" | "ash" | "storm" | "wind";
  // locationModulePath(id) / readLocationWeather(target): a location's weather module.
  constructor({
    format, locations, generalModulePath, locationModulePath, readGeneral, readLocationWeather,
    isDirty, confirm, backupDir, runChecks, log, now,
  }) {
    this.#format = format; this.#locations = locations; this.#generalModulePath = generalModulePath;
    this.#locationModulePath = locationModulePath; this.#readGeneral = readGeneral; this.#readLocationWeather = readLocationWeather;
    this.#isDirty = isDirty; this.#confirm = confirm; this.#backupDir = backupDir; this.#runChecks = runChecks;
    this.#log = log; this.#now = now;
  }

  async apply(fileText, options = {}) {
    return runModuleApply({
      fileText,
      ...options,
      isDirty: this.#isDirty,
      confirm: this.#confirm,
      backupDir: this.#backupDir,
      runChecks: this.#runChecks,
      log: this.#log,
      now: this.#now,
      prepare: (file, refuse) => this.#prepare(file, refuse),
    });
  }

  async #prepare(file, refuse) {
    const format = this.#format;
    if (!file || typeof file !== "object" || Array.isArray(file)) { refuse("файл має бути JSON-об'єктом"); return null; }
    if (file.format !== format.WEATHER_FILE_FORMAT) {
      refuse(`непідтримуваний формат: очікується ${format.WEATHER_FILE_FORMAT} v${format.WEATHER_FILE_VERSION}`);
      return null;
    }
    const read = format.readWeatherFile(file);
    if (!read || (read.version !== format.WEATHER_FILE_VERSION && read.version !== 1)) {
      refuse(`непідтримувана версія: очікується ${format.WEATHER_FILE_FORMAT} v${format.WEATHER_FILE_VERSION} (або v1)`);
      return null;
    }
    const generalParts = read.general && typeof read.general === "object"
      ? Object.keys(read.general).filter((part) => format.GENERAL_WEATHER_PART_IDS.includes(part)) : [];
    const currentGeneral = {};
    for (const part of generalParts) {
      const target = this.#generalModulePath(part);
      if (!fs.existsSync(target)) { refuse(`немає модуля ${PART_NAMES[part]} ${target}`); return null; }
      currentGeneral[part] = await this.#readGeneral(target, part);
    }
    let locationTarget = null, currentLocationWeather = null;
    if (typeof read.locationId === "string" && read.locationId) {
      locationTarget = this.#locationModulePath(read.locationId);
      if (!fs.existsSync(locationTarget)) { refuse(`немає модуля погоди локації ${locationTarget}`); return null; }
      currentLocationWeather = await this.#readLocationWeather(locationTarget);
    }
    const errors = format.validateWeatherFile(file, {
      generalTemplates: currentGeneral,
      locationWeatherTemplate: currentLocationWeather,
      locations: this.#locations,
    });
    if (errors.length) { refuse(`файл не пройшов перевірку:\n  ${errors.join("\n  ")}`); return null; }

    const parts = [];
    for (const part of generalParts) {
      const target = this.#generalModulePath(part);
      const next = read.general[part];
      parts.push({
        target,
        conflictMessage: `Конфлікт: налаштування ${PART_NAMES[part]} у коді змінилися після експорту.`,
        currentHash: await format.generalPartHash(currentGeneral[part], sha256),
        baseHash: read.generalBaseHashes[part],
        changes: format.diffGeneralPart(currentGeneral[part], next),
        describe: describeLeafChanges,
        backupFile: (prefix) => `${prefix}-${path.basename(target)}`,
        source: () => format.generalModuleSource(part, next),
      });
    }
    if (locationTarget) {
      parts.push({
        target: locationTarget,
        conflictMessage: `Конфлікт: погода локації ${read.locationId} у коді змінилася після експорту.`,
        currentHash: await format.locationWeatherHash(currentLocationWeather, sha256),
        baseHash: read.locationWeatherBaseHash,
        changes: format.diffLocationWeather(currentLocationWeather, read.locationWeather),
        describe: describeLeafChanges,
        backupFile: (prefix) => `${prefix}-weather-${read.locationId}.js`,
        source: () => format.locationWeatherModuleSource(read.locationId, read.locationWeather),
      });
    }
    const levels = [generalParts.length ? "загальні налаштування погоди" : null,
      locationTarget ? `погода ${read.locationId}` : null].filter(Boolean).join(" і ");
    return {
      unchangedMessage: `${levels[0].toUpperCase()}${levels.slice(1)} у коді вже такі, як у файлі. Нічого не змінено.`,
      forceMessage: "застосуйте з --force, щоб замінити налаштування в коді даними з файлу",
      reloadHint: "Перезавантажте DEV-сторінку або натисніть «Скинути зміни погоди до коду», щоб побачити зміни з коду. Закомітьте зміну самі.",
      parts,
    };
  }
}

async function main(argv) {
  const root = path.resolve(__dirname, "..");
  const fileArgument = argv.find((argument) => !argument.startsWith("--"));
  if (!fileArgument) throw new Error("Usage: npm run apply:weather -- <weather file.json> [--yes] [--force]");
  const format = await import(pathToFileURL(path.join(root, FORMAT_MODULE)).href);
  const { CONFIG } = await import(pathToFileURL(path.join(root, CONFIG_MODULE)).href);
  const readExport = async (target, name) => (await import(`${pathToFileURL(path.join(root, target)).href}?read=${Date.now()}`))[name];
  const applier = new WeatherFileApplier({
    format,
    locations: CONFIG.locations,
    generalModulePath: (part) => format.GENERAL_WEATHER_PARTS[part].module,
    locationModulePath: (id) => format.locationWeatherModulePath(id),
    readGeneral: (target, part) => readExport(target, format.GENERAL_WEATHER_PARTS[part].exportName),
    readLocationWeather: (target) => readExport(target, "WEATHER"),
    isDirty: (target) => isDirty(root, target),
    confirm: askYes,
    backupDir: path.join(gitDirectory(root, "apply-weather"), "cyber-fishing-backups", "weather"),
    runChecks: () => runChecks(root, ["config-schema", "weather", "game-cycle"]),
    log: (message) => console.log(message),
    now: () => new Date(),
  });
  process.chdir(root);
  const outcome = await applier.apply(fs.readFileSync(resolveExportedFile(process.env.INIT_CWD || root, fileArgument), "utf8"), {
    yes: argv.includes("--yes"),
    force: argv.includes("--force"),
  });
  if (outcome === "refused") process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { WeatherFileApplier, sha256 };
