"use strict";
// Spec 175 (TK-286), spec 180 stage D (TK-332), spec 189 (TK-408): weather export/import/reset in DevTools «ПОГОДА» and
// `npm run apply:weather` moving changes safely into the code. Format v3: every part the section edits (general:
// rain, ash, storm, wind, lightning, starfall, water, emission screen, radiation hiss, Geiger; a location's weather and
// current) and only the changed parameters, applied one at a time onto the code as it is — so a file survives later
// changes of the code. Formats v2 (whole parts with hashes) and v1 (rain + location) still apply. Every file write runs
// in a scratch directory; production modules are only read.
const assert = require("node:assert/strict");
const { devToolsRedraw } = require("../../testing/doubles/dev_tools_redraw");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { WeatherFileApplier, sha256 } = require("../../apply-weather.js");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const { TestDocument } = require("../../testing/keepnet/test_document");

const root = path.resolve(__dirname, "../../..");
const load = (file) => import(pathToFileURL(path.join(root, file)).href);
const clone = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const readPath = (object, parts) => parts.reduce((value, key) => value?.[key], object);
const writePath = (object, parts, value) => { readPath(object, parts.slice(0, -1))[parts.at(-1)] = value; };

(async () => {
  const format = await load("src/dev/weather/weather_export_format.js");
  const { CONFIG } = await load("src/game/config/runtime/game_config.js");
  const { MAP_DB } = await load("src/game/config/databases/location_catalog.js");
  const PARTS = format.GENERAL_WEATHER_PART_IDS;
  const V2_PARTS = ["rain", "ash", "storm", "wind"];
  assert.deepEqual([...PARTS], ["rain", "ash", "storm", "wind", "lightning", "starfall", "water", "emissionScreen",
    "radiationGrain", "geiger"], "spec 189 D1: every general part DevTools «ПОГОДА» edits");
  assert.deepEqual([...format.LOCATION_WEATHER_PART_IDS], ["weather", "current"], "a location's weather and its current");

  // 0. Every part is its data module, fed into CONFIG; committed modules are canonical (the form apply writes).
  const real = {}, realText = {};
  for (const part of PARTS) {
    const spec = format.GENERAL_WEATHER_PARTS[part];
    real[part] = (await load(spec.module))[spec.exportName];
    realText[part] = fs.readFileSync(path.join(root, spec.module), "utf8");
    assert.equal(readPath(CONFIG, spec.configPath), real[part], `CONFIG.${spec.configPath.join(".")} reads ${spec.module}`);
    assert.equal(format.generalModuleSource(part, real[part]), realText[part], `committed ${spec.module} is canonical`);
  }
  const realLocation = {}, realLocationText = {};
  for (const part of format.LOCATION_WEATHER_PART_IDS) {
    const spec = format.LOCATION_WEATHER_PARTS[part];
    realLocation[part] = (await load(spec.module("test")))[spec.exportName];
    realLocationText[part] = fs.readFileSync(path.join(root, spec.module("test")), "utf8");
    assert.equal(readPath(MAP_DB, spec.configPath("test").slice(2)), realLocation[part], `the catalog joins ${spec.module("test")}`);
    assert.equal(format.locationPartModuleSource(part, "test", realLocation[part]), realLocationText[part],
      `committed ${spec.module("test")} is canonical`);
  }
  const WEATHER = realLocation.weather;

  // Hash & noise stability (v2).
  const baseHashes = {};
  for (const part of V2_PARTS) baseHashes[part] = await format.generalPartHash(real[part], sha256);
  const baseWeatherHash = await format.locationWeatherHash(WEATHER, sha256);
  const shuffledStorm = Object.fromEntries(Object.entries(real.storm).reverse());
  assert.equal(await format.generalPartHash(shuffledStorm, sha256), baseHashes.storm, "general hash ignores key order");
  assert.equal(format.canonicalGeneralPart({ ...real.rain, opacity: 0.1 + 0.2 }).opacity, 0.3);

  // Old files: v2 (the four parts, whole, with the code's hashes) and v1 (rain + location), as DevTools wrote them.
  const v2 = (general, locationWeather, extra = {}) => {
    const file = { format: format.WEATHER_FILE_FORMAT, formatVersion: 2, gameVersion: "0.51.23",
      exportedAt: "2026-11-16T10:15:00.000Z", baseHashes: {} };
    if (general) {
      file.general = Object.fromEntries(V2_PARTS.map((part) => [part, format.canonicalGeneralPart(general[part])]));
      file.baseHashes.general = { ...baseHashes };
    }
    if (locationWeather) {
      file.locationId = "test";
      file.locationWeather = format.canonicalLocationWeather(locationWeather);
      file.baseHashes.locationWeather = baseWeatherHash;
    }
    return JSON.stringify({ ...file, ...extra });
  };
  const v1 = (rain, locationWeather, extra = {}) => JSON.stringify({
    format: format.WEATHER_FILE_FORMAT, formatVersion: 1, gameVersion: "0.50.93", locationId: "test",
    exportedAt: "2026-11-13T10:15:00.000Z", baseHashes: { rain: baseHashes.rain, locationWeather: baseWeatherHash },
    rain, locationWeather, ...extra,
  });
  // v3: the levels and the changes against the code (base).
  const v3 = ({ general = null, generalBase = real, location = null, locationBase = realLocation } = {}) => JSON.stringify(
    format.buildWeatherFile({ general, generalBase, locationId: location ? "test" : null, location, locationBase,
      gameVersion: "0.52.87", exportedAt: "2026-11-26T18:00:00.000Z" }));
  const v2Templates = Object.fromEntries(V2_PARTS.map((part) => [part, real[part]]));
  assert.deepEqual(format.validateWeatherFile(JSON.parse(v2(real, null)), { generalTemplates: v2Templates }), [],
    "an old v2 file (the four parts) is still valid");
  assert.deepEqual(format.validateWeatherFile(JSON.parse(v1(real.rain, WEATHER)), { generalTemplates: v2Templates, locationWeatherTemplate: WEATHER }), [],
    "a v1 file (rain + location) is still valid");
  // Spec 187 D18: a v2 file with plain multipliers reads as the pairs that act the same — here the code's pairs.
  const legacy = clone(real);
  Object.assign(legacy.storm, { rainChanceMult: 10, rainStrengthMult: 1.3, gustChanceMult: 2.5, rainDropsShare: 0.6,
    rainSlantDeg: 48, windMinStrength: 0.7 });
  Object.assign(legacy.wind, { rainSlantDeg: 34, ashDriftPx: 90 });
  Object.assign(legacy.wind.rain, { minStrength: 0.25, bonus: 0.2, gustChanceMult: 1.5 });
  const legacyFile = JSON.parse(v2(legacy, null));
  assert.deepEqual(format.validateWeatherFile(legacyFile, { generalTemplates: v2Templates }), [], "an old file with multipliers is valid");
  const upgraded = format.readWeatherFile(legacyFile).general;
  assert.equal(JSON.stringify([upgraded.storm, upgraded.wind]), JSON.stringify([real.storm, real.wind]),
    "its multipliers read as the code's [від, до] pairs");
  // Spec 187 D8: a location's look holds its own [від, до].
  const lookWeather = clone(WEATHER);
  lookWeather.look.rain.maxDrops = [120, 900];
  assert.deepEqual(format.validateWeatherFile(JSON.parse(v1(real.rain, lookWeather)), { generalTemplates: v2Templates, locationWeatherTemplate: WEATHER }),
    [], "a location's [від, до] passes");

  // v3 file: only what changed, with the code's value at the export.
  const edited = clone(real);
  edited.lightning.durationSec = [1, 2.5];
  edited.water.seaState.normal.calmAmplitude = 0.4;
  const v3File = JSON.parse(v3({ general: edited }));
  assert.equal(v3File.formatVersion, 3);
  assert.equal(JSON.stringify(v3File.changes), JSON.stringify([
    { part: "general.lightning", path: "durationSec", from: real.lightning.durationSec, to: [1, 2.5] },
    { part: "general.water", path: "seaState.normal.calmAmplitude", from: real.water.seaState.normal.calmAmplitude, to: 0.4 },
  ]), "a v3 file names only the changed parameters, with their values in the code and in the file");
  assert.deepEqual(Object.keys(v3File.general), [...PARTS], "and holds every general part in full (to read, to import)");
  const merge = format.applyLeafChanges("general.water", real.water, v3File.changes);
  assert.equal(merge.next.seaState.normal.calmAmplitude, 0.4);
  assert.equal(real.water.seaState.normal.calmAmplitude !== 0.4, true, "applyLeafChanges never changes the code's value");

  // 1. CLI applier in a scratch dir.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-apply-weather-"));
  try {
    const target = (part) => path.join(scratch, path.basename(format.GENERAL_WEATHER_PARTS[part].module));
    const locTarget = path.join(scratch, "test.js");
    const currentTarget = path.join(scratch, "current-test.js");
    const backups = path.join(scratch, "backups");
    const dirtySet = new Set();
    let answer = true, asked = 0, checks = 0, reads = 0;
    const logs = [];
    const applier = new WeatherFileApplier({
      format,
      locations: { map: { test: {}, pond: {} } },
      modulePath: (partKey, locationId) => {
        const part = format.weatherPartSpec(partKey);
        if (part.level === "general") return target(part.id);
        return part.id === "weather" ? path.join(scratch, `${locationId}.js`) : path.join(scratch, `current-${locationId}.js`);
      },
      readPart: async (file, partKey) => {
        reads++;
        return (await import(`${pathToFileURL(file).href}?r=${reads}`))[format.weatherPartSpec(partKey).spec.exportName];
      },
      isDirty: (file) => dirtySet.has(file),
      confirm: async () => { asked++; return answer; },
      backupDir: backups,
      runChecks: () => { checks++; },
      log: (msg) => logs.push(msg),
      now: () => new Date("2026-11-16T10:15:30Z"),
    });
    const resetTargets = () => {
      for (const part of PARTS) fs.writeFileSync(target(part), realText[part]);
      fs.writeFileSync(locTarget, realLocationText.weather);
      fs.writeFileSync(currentTarget, realLocationText.current);
      fs.rmSync(backups, { recursive: true, force: true });
    };
    const text = (part) => fs.readFileSync(target(part), "utf8");
    const written = async (file, name, tag) => (await import(`${pathToFileURL(file).href}?after=${tag}`))[name];
    // The code changes a part after the export (as a later version of the game would).
    const codeChange = (part, edit) => {
      const next = clone(real[part]);
      edit(next);
      fs.writeFileSync(target(part), format.generalModuleSource(part, next));
    };

    // v2: a general file writes only the changed module — here the storm — and leaves the others and the location.
    const storm = { ...clone(real), storm: { ...clone(real.storm), windMinStrength: [0.035, 0.55] } };
    resetTargets();
    dirtySet.add(locTarget); // the location is not in the file: its uncommitted edits do not matter
    assert.equal(await applier.apply(v2(storm, null)), "applied");
    assert.equal(asked, 1);
    assert.equal(checks, 1);
    dirtySet.clear();
    assert.equal(JSON.stringify((await written(target("storm"), "STORM_SETTINGS", "storm")).windMinStrength), "[0.035,0.55]");
    for (const part of ["rain", "ash", "wind"]) assert.equal(text(part), realText[part], `unchanged ${part} module is not touched`);
    assert.equal(fs.readFileSync(locTarget, "utf8"), realLocationText.weather, "a general file never touches the location");
    assert.equal(fs.readdirSync(backups).length, 1, "only the changed module is backed up");

    // v2 location-only, v1, unchanged, cancelled, dirty, conflict (hash).
    const locOnly = clone(WEATHER);
    locOnly.fog.chancePerCheck = 0.25;
    resetTargets();
    assert.equal(await applier.apply(v2(null, locOnly), { yes: true }), "applied");
    assert.equal((await written(locTarget, "WEATHER", "loc")).fog.chancePerCheck, 0.25);
    resetTargets();
    assert.equal(await applier.apply(v1({ ...clone(real.rain), opacity: 0.55 }, WEATHER), { yes: true }), "applied");
    assert.equal((await written(target("rain"), "RAIN_SETTINGS", "rain")).opacity, 0.55);
    resetTargets();
    assert.equal(await applier.apply(v2(real, WEATHER)), "unchanged");
    answer = false;
    assert.equal(await applier.apply(v2(storm, locOnly)), "cancelled");
    assert.equal(text("storm"), realText.storm);
    answer = true;
    dirtySet.add(target("storm"));
    assert.equal(await applier.apply(v2(storm, null), { yes: true }), "refused", "dirty storm module refused");
    dirtySet.clear();
    const stale = JSON.parse(v2(storm, null));
    stale.baseHashes.general.storm = "0".repeat(64);
    assert.equal(await applier.apply(JSON.stringify(stale), { yes: true }), "refused", "v2 hash mismatch refused without --force");
    assert.equal(await applier.apply(JSON.stringify(stale), { yes: true, force: true }), "applied", "--force applies over it");

    // v3 (spec 189 D2): the lightning's and the water's changes go to their modules; nothing else is touched.
    resetTargets();
    logs.length = 0;
    assert.equal(await applier.apply(v3({ general: edited }), { yes: true }), "applied");
    assert.equal(JSON.stringify((await written(target("lightning"), "LIGHTNING_SETTINGS", "l1")).durationSec), "[1,2.5]");
    assert.equal((await written(target("water"), "WATER_SETTINGS", "w1")).seaState.normal.calmAmplitude, 0.4);
    for (const part of PARTS.filter((part) => !["lightning", "water"].includes(part))) {
      assert.equal(text(part), realText[part], `v3: unchanged ${part} module is not touched`);
    }
    // The code changed after the export — another value of the same part and a new key: the file still applies, no
    // --force, and the code's own changes stay.
    resetTargets();
    codeChange("lightning", (next) => { next.coreWidthPx = 3; next.newSetting = 7; });
    assert.equal(await applier.apply(v3({ general: edited }), { yes: true }), "applied", "a later code change elsewhere is no conflict");
    const evolved = await written(target("lightning"), "LIGHTNING_SETTINGS", "l2");
    assert.equal(JSON.stringify([evolved.durationSec, evolved.coreWidthPx, evolved.newSetting]), JSON.stringify([[1, 2.5], 3, 7]),
      "the file's change is in, the code's own change and new key stay");
    // The same parameter changed in the code: a conflict of that parameter only; --force writes the file's value.
    resetTargets();
    codeChange("lightning", (next) => { next.durationSec = [0.7, 1.2]; });
    logs.length = 0;
    assert.equal(await applier.apply(v3({ general: edited }), { yes: true }), "refused", "the same parameter changed in the code: conflict");
    assert.ok(logs.some((line) => line.includes("durationSec: у коді [0.7,1.2], при експорті було") && !line.includes("calmAmplitude")),
      "the conflict names only that parameter");
    assert.equal((await written(target("water"), "WATER_SETTINGS", "w2")).seaState.normal.calmAmplitude, real.water.seaState.normal.calmAmplitude,
      "a refused file writes nothing");
    assert.equal(await applier.apply(v3({ general: edited }), { yes: true, force: true }), "applied");
    assert.equal(JSON.stringify((await written(target("lightning"), "LIGHTNING_SETTINGS", "l3")).durationSec), "[1,2.5]", "--force: the file's value");
    // A parameter removed from the code is skipped and named; the others apply.
    resetTargets();
    codeChange("water", (next) => { delete next.seaState.normal.calmAmplitude; });
    logs.length = 0;
    assert.equal(await applier.apply(v3({ general: edited }), { yes: true }), "applied");
    assert.ok(logs.some((line) => line.includes("Пропущено") && line.includes("seaState.normal.calmAmplitude")), "the removed parameter is named");
    assert.equal(JSON.stringify((await written(target("lightning"), "LIGHTNING_SETTINGS", "l4")).durationSec), "[1,2.5]");
    // A location's current goes to its own module.
    resetTargets();
    const location = clone(realLocation);
    location.current.speedPxPerSec = 9;
    location.weather.fog.chancePerCheck = 0.3;
    assert.equal(await applier.apply(v3({ location }), { yes: true }), "applied");
    assert.equal((await written(currentTarget, "CURRENT", "c1")).speedPxPerSec, 9);
    assert.equal((await written(locTarget, "WEATHER", "loc3")).fog.chancePerCheck, 0.3);
    for (const part of PARTS) assert.equal(text(part), realText[part], "a location file never touches the general modules");
    // A file with no changes; a file already in the code.
    resetTargets();
    assert.equal(await applier.apply(v3({ general: clone(real) }), { yes: true }), "unchanged");
    assert.equal(await applier.apply(v3({ general: edited }), { yes: true }), "applied");
    assert.equal(await applier.apply(v3({ general: edited }), { yes: true }), "unchanged", "applied twice: the second time nothing");

    // Validation failures keep files untouched.
    resetTargets();
    const untouched = () => {
      for (const part of PARTS) assert.equal(text(part), realText[part]);
      assert.equal(fs.readFileSync(locTarget, "utf8"), realLocationText.weather);
      assert.equal(fs.readFileSync(currentTarget, "utf8"), realLocationText.current);
    };
    const change = (edit) => { const general = clone(real); edit(general); return general; };
    const missingPart = JSON.parse(v2(real, null));
    delete missingPart.general.wind;
    const unknownPart = JSON.parse(v2(real, null));
    unknownPart.general.water = {};
    const badDuration = clone(WEATHER); badDuration.rain.durationSec = [500, 10];
    const movedKey = clone(WEATHER); movedKey.wind.weatherBoost = { rainBonus: 0.2 };
    const v3With = (changes, extra = {}) => JSON.stringify({ ...JSON.parse(v3({ general: real })), changes, ...extra });
    for (const [fileText, reason] of [
      ["{bad json", "invalid json"],
      [v2(real, null, { format: "cyber-fishing/zones" }), "wrong format"],
      [v2(real, null, { formatVersion: 4 }), "unknown version"],
      [JSON.stringify({ format: format.WEATHER_FILE_FORMAT, formatVersion: 2, baseHashes: {} }), "empty v2 file"],
      [JSON.stringify(missingPart), "v2 general without a part"],
      [JSON.stringify(unknownPart), "a part v2 never had"],
      [v2(change((g) => { g.storm.windMinStrength = [0.035, 2]; }), null), "storm windMinStrength > 1"],
      [v2(change((g) => { g.wind.secret = 1; }), null), "unknown wind key in v2"],
      [v2(change((g) => { g.ash.coolColor = "red"; }), null), "invalid ash color"],
      [v2(null, WEATHER, { locationId: "lake" }), "unknown location"],
      [v2(null, WEATHER, { locationId: "pond" }), "missing location weather module"],
      [v2(null, badDuration), "reversed duration interval"],
      [v2(null, movedKey), "a key that moved to the general wind"],
      [v3With(undefined), "v3 without changes"],
      [v3With([{ part: "general.snow", path: "x", from: 1, to: 2 }]), "v3 unknown part"],
      [v3With([{ part: "general.lightning", path: "durationSec", from: [0.9, 2.1], to: "long" }]), "v3 value of another kind"],
      [v3With([{ part: "general.lightning", path: "glowColor", from: "#a9b8ff", to: "blue" }]), "v3 colour not #rrggbb"],
      [v3With([{ part: "general.lightning", path: "branches", from: [2, 5], to: [2, 5, 7] }]), "v3 pair of another length"],
      [v3With([{ part: "location.current", path: "speedPxPerSec", from: 5, to: 9 }]), "v3 location part without its location"],
      [v3With([{ part: "general.storm", path: "windMinStrength", from: [0.035, 0.7], to: [0.035, 2] }]), "v3 result out of range"],
    ]) {
      assert.equal(await applier.apply(fileText, { yes: true }), "refused", reason);
      untouched();
    }
    // TK-408.1: a broken file is refused for what it is, before any module is looked for.
    logs.length = 0;
    await applier.apply(v3With([{ part: "location.current", path: "speedPxPerSec", from: 5, to: 9 }]), { yes: true });
    assert.ok(logs.some((line) => line.includes("a location part needs the file's location")) && !logs.some((line) => line.includes("немає модуля")),
      "a location part without its location: the file's own reason");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  // 2. WeatherDevSection «Збереження»: status of both levels, export by the selector (v3), import (v3, v1), reset.
  {
    const doc = new TestDocument();
    const runtime = new SourceRuntime({ globals: { document: doc } });
    const { WeatherDevSection } = runtime.importModule("src/dev/tools/weather_dev_section.js");
    // A CONFIG as the game holds it: every part of the export at its CONFIG path (live and as in the code).
    const configOf = () => {
      const config = {};
      for (const part of PARTS) {
        const parts = format.GENERAL_WEATHER_PARTS[part].configPath;
        let node = config;
        for (const key of parts.slice(0, -1)) node = node[key] ??= {};
        node[parts.at(-1)] = clone(real[part]);
      }
      config.locations = { map: { test: { weather: clone(WEATHER), environment: { current: clone(realLocation.current) } } } };
      return config;
    };
    const base = configOf();
    let live = configOf();

    const textRows = new Map();
    const buttons = new Map();
    const parameters = new Map();
    const exportNotices = [];
    let pickedText = null;
    const downloads = [];
    const resets = [];
    const fakeUi = {
      redraw: devToolsRedraw, releaseValueBindings() {}, showLiveValue() {},
      createSection(label, parent) {
        const node = doc.createElement("div");
        parent.appendChild(node);
        return node;
      },
      createTextRow(label, value, parent) {
        const el = doc.createElement("div");
        el.innerText = value;
        parent.appendChild(el);
        textRows.set(label, el);
        return el;
      },
      createInfoRow(label, value, parent) {
        const el = doc.createElement("div");
        el.innerText = value;
        parent.appendChild(el);
        return el;
      },
      // DevToolsUI's contract (TK-403): a link row returns its value element.
      createLinkRow(value, parent) {
        const el = doc.createElement("div");
        el.innerText = value;
        parent.appendChild(el);
        return el;
      },
      createSwitcherRow() {},
      createRangeRow() {},
      createSelectRow() {},
      addParameter(parent, options) { if (options?.path) parameters.set(options.path.join("."), options); },
      createInputRow() {},
      createButtonRow(label, parent, onClick) { buttons.set(label, onClick); },
      createButtonGrid: (parent) => parent,
      showExportCommand(host, options) { exportNotices.push({ host, ...options }); },
    };
    const model = {
      snapshot: {
        precipitation: "clear", rain: 0, storm: 0, fogState: "none", fog: 0, cloud: 0, lightningActive: false,
        strikeSerial: 0, strikeVariant: 0, strikeDistance: 0.5, frozen: false, events: null,
      },
    };
    const section = new WeatherDevSection({
      view: { selected: "test" }, // the saving workflow starts from the location view
      ui: fakeUi,
      weather: { locationId: "test", getModel: () => model, getWind: () => null },
      config: () => live.locations.map.test.weather,
      locationConfig: () => live.locations.map.test.weather,
      locationsMap: () => live.locations.map,
      rainConfig: () => live.canvas.rain,
      ashConfig: () => live.canvas.ash,
      general: () => ({ rain: live.canvas.rain, ash: live.canvas.ash, storm: live.weather.storm, wind: live.weather.wind,
        water: null, screen: null, debug: null }),
      createSection: (label, parent, sectionPath) => fakeUi.createSection(label, parent, sectionPath),
      renderConfigTree() {},
      updateConfig: (pathArg, value) => writePath(live, pathArg.slice(1), clone(value)),
      files: { download: (name, body) => downloads.push({ name, body }), pickFile: async () => pickedText, hashText: (t) => sha256(t) },
      readConfig: (parts) => readPath(live, parts) ?? null,
      readBaseConfig: (parts) => readPath(base, parts) ?? null,
      resetWeather: (request) => {
        resets.push(request);
        const fresh = configOf();
        if (request.general) for (const part of PARTS) {
          const parts = format.GENERAL_WEATHER_PARTS[part].configPath;
          writePath(live, parts, readPath(fresh, parts));
        }
        if (request.locationId) live.locations = fresh.locations;
      },
      gameVersion: "0.52.87",
      now: () => new Date(2026, 10, 26, 19, 19, 0),
    });
    const status = () => textRows.get("Стан погоди").innerText;
    const select = (value) => parameters.get("WEATHER.location.id").onCommit(value);
    const exportNow = async () => { await buttons.get("Експорт погоди")(); await tick(); return JSON.parse(downloads.at(-1).body); };
    const changed = (pathArg) => doc.fire("config-updated", { detail: { path: ["CONFIG", ...pathArg] } });

    section.render(doc.createElement("div"));
    assert.equal(status(), "Погода збігається з кодом.");

    // A storm edit and (spec 189) a lightning edit — the export used to drop the lightning.
    live.weather.storm.windMinStrength = [0.035, 0.5];
    live.canvas.lightning.branchAngleDeg = [10, 30];
    changed(["canvas", "lightning", "branchAngleDeg"]);
    assert.equal(status(), "Змінено (ще не в коді): Шторм, Блискавка. Загальні не ввійдуть в експорт: оберіть «Загальні» або «Всі».",
      "every general part shows, and the location view says the export leaves them out");

    // Location view: the location's parts only (and their changes).
    live.locations.map.test.environment.current.speedPxPerSec = 8;
    changed(["locations", "map", "test", "environment", "current", "speedPxPerSec"]);
    let file = await exportNow();
    assert.equal(downloads.at(-1).name, "weather-test-v0.52.87-20261126-1919.json");
    assert.equal(file.general, undefined);
    assert.equal(file.locationId, "test");
    assert.equal(JSON.stringify(file.changes), JSON.stringify([{ part: "location.current", path: "speedPxPerSec",
      from: realLocation.current.speedPxPerSec, to: 8 }]), "the location's current is in the file");
    assert.equal(exportNotices.at(-1).command, "npm run apply:weather -- weather-test-v0.52.87-20261126-1919.json");

    // «Загальні»: every general part, the storm's and the lightning's changes.
    select("Загальні");
    file = await exportNow();
    assert.equal(downloads.at(-1).name, "weather-general-v0.52.87-20261126-1919.json");
    assert.equal(file.locationId, undefined);
    assert.equal(JSON.stringify(file.changes.map((item) => `${item.part}:${item.path}`)),
      JSON.stringify(["general.storm:windMinStrength", "general.lightning:branchAngleDeg"]), "the lightning's change is in the file now");
    const currentValue = (key) => { const part = format.weatherPartSpec(key); return part.level === "general" ? real[part.id] : realLocation[part.id]; };
    assert.deepEqual(format.validateWeatherFile(file, { currentValue }), []);

    // «Всі» — both levels in one file.
    select("Всі");
    live.locations.map.test.weather.fog.chancePerCheck = 0.5;
    changed(["locations", "map", "test", "weather", "fog", "chancePerCheck"]);
    assert.equal(status(), "Змінено (ще не в коді): Шторм, Блискавка, Параметри локації test, Течія локації test.");
    file = await exportNow();
    assert.equal(downloads.at(-1).name, "weather-general-test-v0.52.87-20261126-1919.json");
    assert.equal(file.changes.length, 4);
    const both = file;

    // Reset drops what the export holds (here both levels).
    buttons.get("Скинути зміни погоди до коду")();
    assert.equal(JSON.stringify(resets.at(-1)), JSON.stringify({ general: true, locationId: "test" }), "sandboxed realm: compare by value");
    assert.equal(status(), "Погода збігається з кодом.");

    // Import: a wrong location is refused; a v3 file puts its changes back; a v1 file brings rain + location.
    pickedText = JSON.stringify({ ...both, locationId: "pond" });
    await buttons.get("Імпорт погоди")();
    await tick();
    assert(status().includes("pond"), "wrong location rejected");
    pickedText = JSON.stringify(both);
    await buttons.get("Імпорт погоди")();
    await tick();
    assert.equal(JSON.stringify([live.weather.storm.windMinStrength, live.canvas.lightning.branchAngleDeg,
      live.locations.map.test.weather.fog.chancePerCheck, live.locations.map.test.environment.current.speedPxPerSec]),
    JSON.stringify([[0.035, 0.5], [10, 30], 0.5, 8]), "a v3 import puts every change back");
    assert.equal(status(), "Змінено (ще не в коді): Шторм, Блискавка, Параметри локації test, Течія локації test.");
    pickedText = v1({ ...clone(real.rain), opacity: 0.7 }, WEATHER);
    await buttons.get("Імпорт погоди")();
    await tick();
    assert.equal(live.canvas.rain.opacity, 0.7);
    assert.equal(live.locations.map.test.weather.fog.chancePerCheck, WEATHER.fog.chancePerCheck);

    section.dispose();
  }

  console.log("apply:weather passed: every part canonical in its module (general and location), format v3 by parameter (only changes, later code changes, conflict of a parameter, removed parameter, location current), v2 and v1 as before, validation, and WeatherDevSection saving of every part.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
