"use strict";

// npm run apply:zones -- <file.json> [--yes] [--force]  (spec 130 D6, spec 176)
// Moves a zone file exported by the DevTools location editor into src/game/config/raw/locations/zones/<locationId>.js
// via the shared runModuleApply pipeline.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { gitDirectory, askYes, isDirty, runChecks, resolveExportedFile, runModuleApply } = require("./apply-module-helpers.js");

const ZONES_DIR = "src/game/config/raw/locations/zones";
const FORMAT_MODULE = "src/dev/location/zone_export_format.js";
const CONFIG_MODULE = "src/game/config/runtime/game_config.js";
const sha256 = (text) => crypto.createHash("sha256").update(text, "utf8").digest("hex");

function describeZoneChanges(changes, direction) {
  const lines = [];
  for (const change of changes) {
    const name = `${change.category} ${change.index + 1}`;
    if (change.kind !== "changed") { lines.push(`  ${name}: ${change.kind === "added" ? "додано" : "видалено"}`); continue; }
    // A field the zone does not have yet (or no longer has) reads "немає", not "undefined" (TK-077).
    const value = (item) => (item === undefined ? "немає" : JSON.stringify(item));
    const fields = change.fields.map((field) => `${field.key} ${value(field.from)} -> ${value(field.to)}`);
    lines.push(`  ${name}: ${fields.join(", ")}`);
  }
  return `  (${direction})\n${lines.join("\n")}`;
}

class ZoneFileApplier {
  #format; #locations; #modulePath; #readZones; #isDirty; #confirm; #backupDir; #runChecks; #log; #now;

  constructor({ format, locations, modulePath, readZones, isDirty, confirm, backupDir, runChecks, log, now }) {
    this.#format = format; this.#locations = locations; this.#modulePath = modulePath; this.#readZones = readZones;
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
        const errors = format.validateZoneFile(file, this.#locations);
        if (errors.length) { refuse(`файл не пройшов перевірку:\n  ${errors.join("\n  ")}`); return null; }
        const target = this.#modulePath(file.locationId);
        if (!fs.existsSync(target)) { refuse(`немає модуля зон ${target}`); return null; }
        const current = await this.#readZones(target);
        return {
          unchangedMessage: `Зони ${file.locationId} у коді вже такі, як у файлі. Нічого не змінено.`,
          forceMessage: "застосуйте з --force, щоб замінити зони в коді зонами з файлу",
          reloadHint: "Перезавантажте DEV-сторінку або натисніть «Скинути зміни зон до коду», щоб побачити зони з коду. Закомітьте зміну самі.",
          parts: [{
            target,
            conflictMessage: `Конфлікт: зони ${file.locationId} у коді змінилися після експорту.`,
            currentHash: await format.zoneHash(current, sha256),
            baseHash: file.baseHash,
            changes: format.diffZones(current, file.zones),
            describe: describeZoneChanges,
            backupFile: (prefix) => `${prefix}-${file.locationId}.js`,
            source: () => format.zoneModuleSource(file.locationId, file.zones),
          }],
        };
      },
    });
  }
}

async function main(argv) {
  const root = path.resolve(__dirname, "..");
  const fileArgument = argv.find((argument) => !argument.startsWith("--"));
  if (!fileArgument) throw new Error("Usage: npm run apply:zones -- <zones file.json> [--yes] [--force]");
  const format = await import(pathToFileURL(path.join(root, FORMAT_MODULE)).href);
  const { CONFIG } = await import(pathToFileURL(path.join(root, CONFIG_MODULE)).href);
  const applier = new ZoneFileApplier({
    format,
    locations: CONFIG.locations,
    modulePath: (id) => path.join(ZONES_DIR, `${id}.js`),
    readZones: async (target) => (await import(`${pathToFileURL(path.join(root, target)).href}?read=${Date.now()}`)).ZONES,
    isDirty: (target) => isDirty(root, target),
    confirm: askYes,
    backupDir: path.join(gitDirectory(root, "apply-zones"), "cyber-fishing-backups", "zones"),
    runChecks: () => runChecks(root, ["config-schema", "game-cycle"]),
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

module.exports = { ZoneFileApplier, sha256 };
