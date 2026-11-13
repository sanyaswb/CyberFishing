"use strict";

// npm run apply:weather -- <file.json> [--yes] [--force]  (spec 175 TK-286, spec 176)
// Moves a weather file exported by DevTools «🌧 ПОГОДА» into changed data modules (`rain_settings.js` and/or
// `locations/weather/<id>.js`) via the shared runModuleApply pipeline.
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

class WeatherFileApplier {
  #format; #locations; #rainModulePath; #locationModulePath; #readRain; #readLocationWeather;
  #isDirty; #confirm; #backupDir; #runChecks; #log; #now;

  constructor({
    format, locations, rainModulePath, locationModulePath, readRain, readLocationWeather,
    isDirty, confirm, backupDir, runChecks, log, now,
  }) {
    this.#format = format; this.#locations = locations; this.#rainModulePath = rainModulePath;
    this.#locationModulePath = locationModulePath; this.#readRain = readRain; this.#readLocationWeather = readLocationWeather;
    this.#isDirty = isDirty; this.#confirm = confirm; this.#backupDir = backupDir; this.#runChecks = runChecks;
    this.#log = log; this.#now = now;
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
        if (!file || typeof file !== "object" || Array.isArray(file)) { refuse("файл має бути JSON-об'єктом"); return null; }
        if (file.format !== format.WEATHER_FILE_FORMAT || file.formatVersion !== format.WEATHER_FILE_VERSION) {
          refuse(`непідтримуваний формат: очікується ${format.WEATHER_FILE_FORMAT} v${format.WEATHER_FILE_VERSION}`);
          return null;
        }
        if (typeof file.locationId !== "string" || !file.locationId) { refuse("у файлі не вказано locationId"); return null; }
        const rainTarget = this.#rainModulePath;
        const locationTarget = this.#locationModulePath(file.locationId);
        if (!fs.existsSync(rainTarget)) { refuse(`немає модуля вигляду дощу ${rainTarget}`); return null; }
        if (!fs.existsSync(locationTarget)) { refuse(`немає модуля погоди локації ${locationTarget}`); return null; }

        const currentRain = await this.#readRain(rainTarget);
        const currentLocationWeather = await this.#readLocationWeather(locationTarget);
        const errors = format.validateWeatherFile(file, {
          rainTemplate: currentRain,
          locationWeatherTemplate: currentLocationWeather,
          locations: this.#locations,
        });
        if (errors.length) { refuse(`файл не пройшов перевірку:\n  ${errors.join("\n  ")}`); return null; }

        const diff = format.diffWeatherParts(currentRain, file.rain, currentLocationWeather, file.locationWeather);
        return {
          unchangedMessage: `Параметри дощу та погоди ${file.locationId} у коді вже такі, як у файлі. Нічого не змінено.`,
          forceMessage: "застосуйте з --force, щоб замінити налаштування в коді даними з файлу",
          reloadHint: "Перезавантажте DEV-сторінку або натисніть «Скинути зміни погоди до коду», щоб побачити зміни з коду. Закомітьте зміну самі.",
          parts: [
            {
              target: rainTarget,
              conflictMessage: "Конфлікт: вигляд дощу у коді змінився після експорту.",
              currentHash: await format.rainHash(currentRain, sha256),
              baseHash: file.baseHashes.rain,
              changes: diff.rain,
              describe: describeLeafChanges,
              backupFile: (prefix) => `${prefix}-rain_settings.js`,
              source: () => format.rainModuleSource(file.rain),
            },
            {
              target: locationTarget,
              conflictMessage: `Конфлікт: погода локації ${file.locationId} у коді змінилася після експорту.`,
              currentHash: await format.locationWeatherHash(currentLocationWeather, sha256),
              baseHash: file.baseHashes.locationWeather,
              changes: diff.locationWeather,
              describe: describeLeafChanges,
              backupFile: (prefix) => `${prefix}-weather-${file.locationId}.js`,
              source: () => format.locationWeatherModuleSource(file.locationId, file.locationWeather),
            },
          ],
        };
      },
    });
  }
}

async function main(argv) {
  const root = path.resolve(__dirname, "..");
  const fileArgument = argv.find((argument) => !argument.startsWith("--"));
  if (!fileArgument) throw new Error("Usage: npm run apply:weather -- <weather file.json> [--yes] [--force]");
  const format = await import(pathToFileURL(path.join(root, FORMAT_MODULE)).href);
  const { CONFIG } = await import(pathToFileURL(path.join(root, CONFIG_MODULE)).href);
  const applier = new WeatherFileApplier({
    format,
    locations: CONFIG.locations,
    rainModulePath: format.RAIN_SETTINGS_MODULE,
    locationModulePath: (id) => format.locationWeatherModulePath(id),
    readRain: async (target) => (await import(`${pathToFileURL(path.join(root, target)).href}?read=${Date.now()}`)).RAIN_SETTINGS,
    readLocationWeather: async (target) => (await import(`${pathToFileURL(path.join(root, target)).href}?read=${Date.now()}`)).WEATHER,
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
