"use strict";

// npm run apply:weather -- <file.json> [--yes] [--force]  (spec 175 TK-286, spec 176, spec 180 stage D TK-332, spec 189)
// Moves a weather file exported by DevTools «ПОГОДА» into the data modules via the shared runModuleApply pipeline.
// - Format v3 (spec 189 D2): only the parameters the file changed are applied, one at a time, to each part's module as
//   it is in the code now (applyLeafChanges): a parameter changed in the code since the export is a conflict of that
//   parameter only (--force writes the file's value), a parameter the code no longer has is skipped and named, keys the
//   file does not name are left alone. Every part of WEATHER_EXPORT_PARTS: the general ones (weather/*_settings.js) and
//   a location's weather and current (locations/weather/<id>.js, locations/current/<id>.js).
// - Format v2 / v1 (spec 180 stage D): whole parts with the code's hashes, as before.
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
const PART_NAMES = Object.freeze({
  "general.rain": "дощу", "general.ash": "попелу", "general.storm": "шторму", "general.wind": "вітру",
  "general.lightning": "блискавки", "general.starfall": "зорепаду", "general.water": "води",
  "general.emissionScreen": "екрана викиду", "general.radiationGrain": "шипіння радіації", "general.geiger": "лічильника Гейгера",
  "location.weather": "погоди локації", "location.current": "течії локації",
});
const value = (item) => (item === undefined ? "немає" : JSON.stringify(item));

class WeatherFileApplier {
  #format; #locations; #modulePath; #readPart; #isDirty; #confirm; #backupDir; #runChecks; #log; #now;

  // modulePath(partKey, locationId) → the data module of a part ("general.<id>" / "location.<id>");
  // readPart(target, partKey) → its exported value.
  constructor({ format, locations, modulePath, readPart, isDirty, confirm, backupDir, runChecks, log, now }) {
    this.#format = format; this.#locations = locations; this.#modulePath = modulePath; this.#readPart = readPart;
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
    if (!read || ![format.WEATHER_FILE_VERSION, 2, 1].includes(read.version)) {
      refuse(`непідтримувана версія: очікується ${format.WEATHER_FILE_FORMAT} v${format.WEATHER_FILE_VERSION} (або v2, v1)`);
      return null;
    }
    return read.version === format.WEATHER_FILE_VERSION ? this.#prepareChanges(file, read, refuse) : this.#prepareWhole(file, read, refuse);
  }

  // The part's module, or null (refused) when it is missing.
  #target(partKey, locationId, refuse) {
    const target = this.#modulePath(partKey, locationId);
    if (!fs.existsSync(target)) { refuse(`немає модуля ${PART_NAMES[partKey] ?? partKey} ${target}`); return null; }
    return target;
  }

  #source(partKey, locationId, next) {
    const part = this.#format.weatherPartSpec(partKey);
    return part.level === "general" ? this.#format.generalModuleSource(part.id, next)
      : this.#format.locationPartModuleSource(part.id, locationId, next);
  }

  // Spec 189 D2: v3 — each part the changes name, merged parameter by parameter into its module as it is now.
  async #prepareChanges(file, read, refuse) {
    const format = this.#format;
    // TK-408.1: the file's structure first (parts, the location), so a broken file is refused for what it is, before
    // any module is looked for.
    const structure = format.validateWeatherFile(file, { locations: this.#locations });
    if (structure.length) { refuse(`файл не пройшов перевірку:\n  ${structure.join("\n  ")}`); return null; }
    const keys = [...new Set(read.changes.map((change) => change?.part).filter((key) => format.weatherPartSpec(key)))];
    const current = new Map(), targets = new Map();
    for (const key of keys) {
      const target = this.#target(key, read.locationId, refuse);
      if (!target) return null;
      targets.set(key, target);
      current.set(key, await this.#readPart(target, key));
    }
    const errors = format.validateWeatherFile(file, { locations: this.#locations, currentValue: (key) => current.get(key) });
    if (errors.length) { refuse(`файл не пройшов перевірку:\n  ${errors.join("\n  ")}`); return null; }
    const parts = [];
    for (const key of keys) {
      const target = targets.get(key);
      const merge = format.applyLeafChanges(key, current.get(key), read.changes);
      const issues = format.weatherPartIssues(key, merge.next);
      if (issues.length) { refuse(`після змін ${PART_NAMES[key]} не пройшли перевірку:\n  ${issues.join("\n  ")}`); return null; }
      for (const missing of merge.missing) {
        this.#log(`Пропущено (${PART_NAMES[key]}): ${missing.path} — такого параметра в коді немає (прибрали або перейменували).`);
      }
      const conflictLines = merge.conflicts.map((item) =>
        `  ${item.path}: у коді ${value(item.code)}, при експорті було ${value(item.from)}, у файлі ${value(item.to)}`);
      parts.push({
        target,
        // A conflict is a parameter changed in the code since the export (runModuleApply compares the two marks).
        currentHash: merge.conflicts.length ? "changed-in-code" : "as-exported",
        baseHash: "as-exported",
        conflictMessage: `Конфлікт: ці параметри ${PART_NAMES[key]} у коді змінилися після експорту:\n${conflictLines.join("\n")}`,
        changes: format.diffGeneralPart(current.get(key), merge.next),
        describe: describeLeafChanges,
        backupFile: (prefix) => `${prefix}-${key.replace(".", "-")}-${path.basename(target)}`,
        source: () => this.#source(key, read.locationId, merge.next),
      });
    }
    return {
      unchangedMessage: keys.length ? "У коді вже ті самі значення, що у файлі. Нічого не змінено." : "У файлі немає змін. Нічого не змінено.",
      forceMessage: "застосуйте з --force, щоб записати значення з файлу поверх змінених у коді",
      reloadHint: "Перезавантажте DEV-сторінку або натисніть «Скинути зміни погоди до коду», щоб побачити зміни з коду. Закомітьте зміну самі.",
      parts,
    };
  }

  // v2 / v1: whole parts with the code's hashes (spec 180 stage D).
  async #prepareWhole(file, read, refuse) {
    const format = this.#format;
    const generalParts = read.general && typeof read.general === "object"
      ? Object.keys(read.general).filter((part) => format.GENERAL_WEATHER_PART_IDS.includes(part)) : [];
    const currentGeneral = {};
    for (const part of generalParts) {
      const target = this.#target(`general.${part}`, null, refuse);
      if (!target) return null;
      currentGeneral[part] = await this.#readPart(target, `general.${part}`);
    }
    let locationTarget = null, currentLocationWeather = null;
    if (typeof read.locationId === "string" && read.locationId) {
      locationTarget = this.#target("location.weather", read.locationId, refuse);
      if (!locationTarget) return null;
      currentLocationWeather = await this.#readPart(locationTarget, "location.weather");
    }
    const errors = format.validateWeatherFile(file, {
      generalTemplates: currentGeneral,
      locationWeatherTemplate: currentLocationWeather,
      locations: this.#locations,
    });
    if (errors.length) { refuse(`файл не пройшов перевірку:\n  ${errors.join("\n  ")}`); return null; }

    const parts = [];
    for (const part of generalParts) {
      const target = this.#modulePath(`general.${part}`, null);
      const next = read.general[part];
      parts.push({
        target,
        conflictMessage: `Конфлікт: налаштування ${PART_NAMES[`general.${part}`]} у коді змінилися після експорту.`,
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
    modulePath: (partKey, locationId) => {
      const part = format.weatherPartSpec(partKey);
      return part.level === "general" ? part.spec.module : part.spec.module(locationId);
    },
    readPart: (target, partKey) => readExport(target, format.weatherPartSpec(partKey).spec.exportName),
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
