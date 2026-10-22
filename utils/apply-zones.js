"use strict";

// npm run apply:zones -- <file.json> [--yes] [--force]  (spec 130 D6)
// Moves a zone file exported by the DevTools location editor into the location's data module
// src/game/config/raw/locations/zones/<locationId>.js: validates the file, refuses a module with uncommitted changes,
// stops on a conflict (the code changed after the export) unless --force, shows the change, asks for confirmation
// (--yes skips it), backs the module up under the Git directory, writes it in canonical form and runs the config and
// game-cycle checks. It never commits or pushes.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const readline = require("node:readline");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const ZONES_DIR = "src/game/config/raw/locations/zones";
const FORMAT_MODULE = "src/dev/location/zone_export_format.js";
const CONFIG_MODULE = "src/game/config/runtime/game_config.js";
const sha256 = text => crypto.createHash("sha256").update(text, "utf8").digest("hex");
const stamp = date => date.toISOString().replace(/[-:]/gu, "").replace("T", "-").slice(0, 15);

// The steps with every outside effect injected, so the tooling check runs them in a scratch directory.
class ZoneFileApplier {
  #format; #locations; #modulePath; #readZones; #isDirty; #confirm; #backupDir; #runChecks; #log; #now;

  constructor({ format, locations, modulePath, readZones, isDirty, confirm, backupDir, runChecks, log, now }) {
    this.#format = format; this.#locations = locations; this.#modulePath = modulePath; this.#readZones = readZones;
    this.#isDirty = isDirty; this.#confirm = confirm; this.#backupDir = backupDir; this.#runChecks = runChecks;
    this.#log = log; this.#now = now;
  }

  // Returns "applied", "unchanged", "cancelled" or "refused" (with the reason logged).
  async apply(fileText, { yes = false, force = false } = {}) {
    const format = this.#format;
    let file;
    try { file = JSON.parse(fileText); } catch (error) { return this.#refuse(`файл не є JSON (${error.message})`); }
    const errors = format.validateZoneFile(file, this.#locations);
    if (errors.length) return this.#refuse(`файл не пройшов перевірку:\n  ${errors.join("\n  ")}`);
    const target = this.#modulePath(file.locationId);
    if (!fs.existsSync(target)) return this.#refuse(`немає модуля зон ${target}`);
    if (this.#isDirty(target)) {
      return this.#refuse(`${target} має незакомічені зміни; закомітьте або відкиньте їх, щоб не затерти ручні правки`);
    }
    const current = await this.#readZones(target);
    const currentHash = await format.zoneHash(current, sha256);
    if (currentHash !== file.baseHash) {
      this.#log(`Конфлікт: зони ${file.locationId} у коді змінилися після експорту.`);
      this.#log(this.#describe(format.diffZones(current, file.zones), "код -> файл"));
      if (!force) return this.#refuse("застосуйте з --force, щоб замінити зони в коді зонами з файлу");
    }
    const changes = format.diffZones(current, file.zones);
    if (!changes.length) { this.#log(`Зони ${file.locationId} у коді вже такі, як у файлі. Нічого не змінено.`); return "unchanged"; }
    this.#log(`Зміни для ${target}:`);
    this.#log(this.#describe(changes, "зараз -> буде"));
    if (!yes && !(await this.#confirm(`Застосувати до ${target}? (y/N) `))) { this.#log("Скасовано. Нічого не змінено."); return "cancelled"; }
    fs.mkdirSync(this.#backupDir, { recursive: true });
    const backup = path.join(this.#backupDir, `${stamp(this.#now())}-${file.locationId}.js`);
    fs.copyFileSync(target, backup);
    fs.writeFileSync(target, format.zoneModuleSource(file.locationId, file.zones));
    this.#log(`Записано ${target}. Бекап: ${backup}`);
    this.#log(`Відкат: copy "${backup}" "${target}"`);
    this.#runChecks();
    this.#log("Перезавантажте DEV-сторінку або натисніть «Скинути зміни зон до коду», щоб побачити зони з коду. Закомітьте зміну самі.");
    return "applied";
  }

  #refuse(reason) {
    this.#log(`Не застосовано: ${reason}`);
    return "refused";
  }

  #describe(changes, direction) {
    const lines = [];
    for (const change of changes) {
      const name = `${change.category} ${change.index + 1}`;
      if (change.kind !== "changed") { lines.push(`  ${name}: ${change.kind === "added" ? "додано" : "видалено"}`); continue; }
      const fields = change.fields.map(field => `${field.key} ${JSON.stringify(field.from)} -> ${JSON.stringify(field.to)}`);
      lines.push(`  ${name}: ${fields.join(", ")}`);
    }
    return `  (${direction})\n${lines.join("\n")}`;
  }
}

function gitDirectory(root) {
  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error("apply-zones needs a Git checkout");
  return path.resolve(root, result.stdout.trim());
}

function askYes(question) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => prompt.question(question, (answer) => {
    prompt.close();
    resolve(/^(y|yes|т|так)$/iu.test(answer.trim()));
  }));
}

async function main(argv) {
  const root = path.resolve(__dirname, "..");
  const fileArgument = argv.find(argument => !argument.startsWith("--"));
  if (!fileArgument) throw new Error("Usage: npm run apply:zones -- <zones file.json> [--yes] [--force]");
  const format = await import(pathToFileURL(path.join(root, FORMAT_MODULE)).href);
  const { CONFIG } = await import(pathToFileURL(path.join(root, CONFIG_MODULE)).href);
  const applier = new ZoneFileApplier({
    format,
    locations: CONFIG.locations,
    modulePath: id => path.join(ZONES_DIR, `${id}.js`),
    // A fresh import each time: the module may have been rewritten in this process.
    readZones: async target => (await import(`${pathToFileURL(path.join(root, target)).href}?read=${Date.now()}`)).ZONES,
    isDirty: target => {
      const status = spawnSync("git", ["status", "--porcelain", "--", target], { cwd: root, encoding: "utf8" });
      return status.status !== 0 || status.stdout.trim() !== "";
    },
    confirm: askYes,
    backupDir: path.join(gitDirectory(root), "cyber-fishing-backups", "zones"),
    runChecks: () => {
      for (const check of ["config-schema", "game-cycle"]) {
        const result = spawnSync(process.execPath, ["utils/run-checks.js", "--check", check], { cwd: root, encoding: "utf8" });
        console.log(`Перевірка ${check}: ${result.status === 0 ? "пройшла" : "НЕ пройшла"}`);
        if (result.status !== 0) console.log(`${result.stdout}${result.stderr}`.trim().split("\n").slice(-15).join("\n"));
      }
    },
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

module.exports = { ZoneFileApplier, sha256 };
