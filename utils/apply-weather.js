"use strict";

// npm run apply:weather -- <file.json> [--yes] [--force]  (spec 175 TK-286)
// Moves a weather file exported by DevTools «🌧 ПОГОДА» into the game's data modules: global rain look
// src/game/config/raw/weather/rain_settings.js and location weather src/game/config/raw/locations/weather/<id>.js.
// Only changed modules are checked for uncommitted changes/conflicts, backed up and rewritten.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { stamp, gitDirectory, askYes, isDirty, runChecks, resolveExportedFile } = require("./apply-module-helpers.js");

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
    this.#format = format;
    this.#locations = locations;
    this.#rainModulePath = rainModulePath;
    this.#locationModulePath = locationModulePath;
    this.#readRain = readRain;
    this.#readLocationWeather = readLocationWeather;
    this.#isDirty = isDirty;
    this.#confirm = confirm;
    this.#backupDir = backupDir;
    this.#runChecks = runChecks;
    this.#log = log;
    this.#now = now;
  }

  // Returns "applied", "unchanged", "cancelled" or "refused" (with the reason logged).
  async apply(fileText, { yes = false, force = false } = {}) {
    const format = this.#format;
    let file;
    try { file = JSON.parse(fileText); } catch (error) { return this.#refuse(`файл не є JSON (${error.message})`); }
    if (!file || typeof file !== "object" || Array.isArray(file)) return this.#refuse("файл має бути JSON-об'єктом");
    if (file.format !== format.WEATHER_FILE_FORMAT || file.formatVersion !== format.WEATHER_FILE_VERSION) {
      return this.#refuse(`непідтримуваний формат: очікується ${format.WEATHER_FILE_FORMAT} v${format.WEATHER_FILE_VERSION}`);
    }
    if (typeof file.locationId !== "string" || !file.locationId) return this.#refuse("у файлі не вказано locationId");
    const rainTarget = this.#rainModulePath;
    const locationTarget = this.#locationModulePath(file.locationId);
    if (!fs.existsSync(rainTarget)) return this.#refuse(`немає модуля вигляду дощу ${rainTarget}`);
    if (!fs.existsSync(locationTarget)) return this.#refuse(`немає модуля погоди локації ${locationTarget}`);

    const currentRain = await this.#readRain(rainTarget);
    const currentLocationWeather = await this.#readLocationWeather(locationTarget);
    const errors = format.validateWeatherFile(file, {
      rainTemplate: currentRain,
      locationWeatherTemplate: currentLocationWeather,
      locations: this.#locations,
    });
    if (errors.length) return this.#refuse(`файл не пройшов перевірку:\n  ${errors.join("\n  ")}`);

    const diff = format.diffWeatherParts(currentRain, file.rain, currentLocationWeather, file.locationWeather);
    const pending = [];
    if (diff.rain.length) {
      pending.push({
        key: "rain",
        label: "вигляд дощу",
        target: rainTarget,
        backupFile: (prefix) => `${prefix}-rain_settings.js`,
        changes: diff.rain,
        baseHash: file.baseHashes.rain,
        currentHash: await format.rainHash(currentRain, sha256),
        source: () => format.rainModuleSource(file.rain),
      });
    }
    if (diff.locationWeather.length) {
      pending.push({
        key: "locationWeather",
        label: `погода локації ${file.locationId}`,
        target: locationTarget,
        backupFile: (prefix) => `${prefix}-weather-${file.locationId}.js`,
        changes: diff.locationWeather,
        baseHash: file.baseHashes.locationWeather,
        currentHash: await format.locationWeatherHash(currentLocationWeather, sha256),
        source: () => format.locationWeatherModuleSource(file.locationId, file.locationWeather),
      });
    }

    if (!pending.length) {
      this.#log(`Параметри дощу та погоди ${file.locationId} у коді вже такі, як у файлі. Нічого не змінено.`);
      return "unchanged";
    }

    for (const part of pending) {
      if (this.#isDirty(part.target)) {
        return this.#refuse(`${part.target} має незакомічені зміни; закомітьте або відкиньте їх, щоб не затерти ручні правки`);
      }
    }

    const conflicts = pending.filter((part) => part.currentHash !== part.baseHash);
    if (conflicts.length) {
      for (const part of conflicts) {
        this.#log(`Конфлікт: ${part.label} у коді змінився після експорту.`);
        this.#log(this.#describe(part.changes, "код -> файл"));
      }
      if (!force) return this.#refuse("застосуйте з --force, щоб замінити налаштування в коді даними з файлу");
    }

    for (const part of pending) {
      this.#log(`Зміни для ${part.target}:`);
      this.#log(this.#describe(part.changes, "зараз -> буде"));
    }

    const targetsList = pending.map((part) => part.target).join(", ");
    if (!yes && !(await this.#confirm(`Застосувати до ${targetsList}? (y/N) `))) {
      this.#log("Скасовано. Нічого не змінено.");
      return "cancelled";
    }

    fs.mkdirSync(this.#backupDir, { recursive: true });
    const prefix = stamp(this.#now());
    for (const part of pending) {
      const backup = path.join(this.#backupDir, part.backupFile(prefix));
      fs.copyFileSync(part.target, backup);
      fs.writeFileSync(part.target, part.source());
      this.#log(`Записано ${part.target}. Бекап: ${backup}`);
      this.#log(`Відкат: copy "${backup}" "${part.target}"`);
    }
    this.#runChecks();
    this.#log("Перезавантажте DEV-сторінку або натисніть «Скинути зміни погоди до коду», щоб побачити зміни з коду. Закомітьте зміну самі.");
    return "applied";
  }

  #refuse(reason) {
    this.#log(`Не застосовано: ${reason}`);
    return "refused";
  }

  #describe(changes, direction) {
    const lines = changes.map((change) => `  ${change.path}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`);
    return `  (${direction})\n${lines.join("\n")}`;
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
