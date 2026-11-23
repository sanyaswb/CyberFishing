"use strict";
// Spec 175 (TK-286), spec 180 stage D (TK-332): weather export/import/reset in DevTools «ПОГОДА» and
// `npm run apply:weather` moving changed modules safely into the code — the general settings (rain, ash, storm, wind)
// and/or a location's weather (format v2; v1 = rain + a location still applies). Every file write runs in a scratch
// directory; production modules are only read.
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

(async () => {
  const format = await load("src/dev/weather/weather_export_format.js");
  const { CONFIG } = await load("src/game/config/runtime/game_config.js");
  const { MAP_DB } = await load("src/game/config/databases/location_catalog.js");
  const { WEATHER } = await load(format.locationWeatherModulePath("test"));
  const PARTS = format.GENERAL_WEATHER_PART_IDS;
  assert.deepEqual([...PARTS], ["rain", "ash", "storm", "wind"], "the general parts are rain, ash, storm and wind");

  // 0. Every general part is its data module, fed into CONFIG; committed modules are canonical.
  const real = {}, realText = {};
  for (const part of PARTS) {
    const spec = format.GENERAL_WEATHER_PARTS[part];
    real[part] = (await load(spec.module))[spec.exportName];
    realText[part] = fs.readFileSync(path.join(root, spec.module), "utf8");
    assert.equal(spec.configPath.reduce((value, key) => value?.[key], CONFIG), real[part], `CONFIG.${spec.configPath.join(".")} reads ${spec.module}`);
    assert.equal(format.generalModuleSource(part, real[part]), realText[part], `committed ${spec.module} is canonical`);
  }
  assert.equal(MAP_DB.test.weather, WEATHER, "location catalog joins the location weather data module");
  const realLocation = fs.readFileSync(path.join(root, format.locationWeatherModulePath("test")), "utf8");
  assert.equal(format.locationWeatherModuleSource("test", WEATHER), realLocation, "committed test.js weather is canonical");

  // Hash & noise stability.
  const baseHashes = {};
  for (const part of PARTS) baseHashes[part] = await format.generalPartHash(real[part], sha256);
  const baseWeatherHash = await format.locationWeatherHash(WEATHER, sha256);
  const shuffledStorm = Object.fromEntries(Object.entries(real.storm).reverse());
  assert.equal(await format.generalPartHash(shuffledStorm, sha256), baseHashes.storm, "general hash ignores key order");
  assert.equal(await format.locationWeatherHash(Object.fromEntries(Object.entries(WEATHER).reverse()), sha256), baseWeatherHash,
    "location weather hash ignores key order");
  const cleanedRain = format.canonicalGeneralPart({ ...real.rain, opacity: 0.1 + 0.2 });
  assert.equal(cleanedRain.opacity, 0.3);

  // File builders: v2 by levels, v1 for the legacy reader.
  const v2 = (general, locationWeather, extra = {}) => JSON.stringify({
    ...format.buildWeatherFile({
      general,
      generalBaseHashes: general ? baseHashes : null,
      locationId: locationWeather ? "test" : null,
      locationWeather,
      locationWeatherBaseHash: locationWeather ? baseWeatherHash : null,
      gameVersion: "0.51.23",
      exportedAt: "2026-11-16T10:15:00.000Z",
    }),
    ...extra,
  });
  const v1 = (rain, locationWeather, extra = {}) => JSON.stringify({
    format: format.WEATHER_FILE_FORMAT, formatVersion: 1, gameVersion: "0.50.93", locationId: "test",
    exportedAt: "2026-11-13T10:15:00.000Z", baseHashes: { rain: baseHashes.rain, locationWeather: baseWeatherHash },
    rain, locationWeather, ...extra,
  });
  const generalOnly = JSON.parse(v2(real, null));
  assert.equal(generalOnly.locationId, undefined, "a general-only file has no location");
  assert.deepEqual(Object.keys(generalOnly.general), [...PARTS]);
  assert.deepEqual(format.validateWeatherFile(generalOnly, { generalTemplates: real }), []);
  assert.deepEqual(format.validateWeatherFile(JSON.parse(v1(real.rain, WEATHER)), { generalTemplates: real, locationWeatherTemplate: WEATHER }), [],
    "a v1 file (rain + location) is still valid");
  // Spec 187 D8: a location's look holds its own [від, до] (the code's look is empty — such a file used to be refused
  // as «unknown setting», so a location's override could never reach the code).
  const lookWeather = JSON.parse(JSON.stringify(WEATHER));
  lookWeather.look.rain.maxDrops = [120, 900];
  lookWeather.look.ash.opacity = 0.5;
  assert.deepEqual(format.validateWeatherFile(JSON.parse(v1(real.rain, lookWeather)), { generalTemplates: real, locationWeatherTemplate: WEATHER }),
    [], "a location's [від, до] and an old plain override pass");
  lookWeather.look.rain.color = [1, 2];
  assert.ok(format.validateWeatherFile(JSON.parse(v1(real.rain, lookWeather)), { generalTemplates: real, locationWeatherTemplate: WEATHER })
    .some((error) => /look\.rain\.color: not a strength value/u.test(error)), "a key that is no strength value is refused");

  // 1. CLI applier in a scratch dir.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-apply-weather-"));
  try {
    const target = (part) => path.join(scratch, path.basename(format.GENERAL_WEATHER_PARTS[part].module));
    const locTarget = path.join(scratch, "test.js");
    const backups = path.join(scratch, "backups");
    const dirtySet = new Set();
    let answer = true, asked = 0, checks = 0, reads = 0;
    const logs = [];
    const applier = new WeatherFileApplier({
      format,
      locations: { map: { test: {}, pond: {} } },
      generalModulePath: target,
      locationModulePath: (id) => path.join(scratch, `${id}.js`),
      readGeneral: async (file, part) => { reads++; return (await import(`${pathToFileURL(file).href}?r=${reads}`))[format.GENERAL_WEATHER_PARTS[part].exportName]; },
      readLocationWeather: async (file) => { reads++; return (await import(`${pathToFileURL(file).href}?w=${reads}`)).WEATHER; },
      isDirty: (file) => dirtySet.has(file),
      confirm: async () => { asked++; return answer; },
      backupDir: backups,
      runChecks: () => { checks++; },
      log: (msg) => logs.push(msg),
      now: () => new Date("2026-11-16T10:15:30Z"),
    });
    const resetTargets = () => {
      for (const part of PARTS) fs.writeFileSync(target(part), realText[part]);
      fs.writeFileSync(locTarget, realLocation);
      fs.rmSync(backups, { recursive: true, force: true });
    };
    const text = (part) => fs.readFileSync(target(part), "utf8");
    const written = async (file, name, tag) => (await import(`${pathToFileURL(file).href}?after=${tag}`))[name];

    // Defect of format v1 (TK-332): the storm, wind and ash settings could not reach the code. A general file now
    // writes only the changed module — here the storm — and leaves the others and the location alone.
    const storm = { ...clone(real), storm: { ...clone(real.storm), windMinStrength: [0.035, 0.55] } };
    resetTargets();
    dirtySet.add(locTarget); // the location is not in the file: its uncommitted edits do not matter
    assert.equal(await applier.apply(v2(storm, null)), "applied");
    assert.equal(asked, 1);
    assert.equal(checks, 1);
    dirtySet.clear();
    assert.equal(JSON.stringify((await written(target("storm"), "STORM_SETTINGS", "storm")).windMinStrength), "[0.035,0.55]");
    for (const part of ["rain", "ash", "wind"]) assert.equal(text(part), realText[part], `unchanged ${part} module is not touched`);
    assert.equal(fs.readFileSync(locTarget, "utf8"), realLocation, "a general file never touches the location");
    assert.equal(fs.readdirSync(backups).length, 1, "only the changed module is backed up");
    assert(fs.readdirSync(backups)[0].endsWith("-storm_settings.js"));
    assert(logs.some((line) => line.includes("windMinStrength: [0.035,0.7] -> [0.035,0.55]")), "diff logs the changed field");

    // Wind and ash together; the location-only file; both levels in one file.
    const windAsh = clone(real);
    windAsh.wind.gust.attackShare = 0.3;
    windAsh.ash.hotColor = "#ffcc00";
    resetTargets();
    assert.equal(await applier.apply(v2(windAsh, null), { yes: true }), "applied");
    assert.equal(asked, 1, "--yes skips prompt");
    assert.equal((await written(target("wind"), "WIND_SETTINGS", "wind")).gust.attackShare, 0.3);
    assert.equal((await written(target("ash"), "ASH_SETTINGS", "ash")).hotColor, "#ffcc00");
    assert.equal(fs.readdirSync(backups).length, 2);

    const locOnly = clone(WEATHER);
    locOnly.fog.chancePerCheck = 0.25;
    resetTargets();
    assert.equal(await applier.apply(v2(null, locOnly), { yes: true }), "applied");
    for (const part of PARTS) assert.equal(text(part), realText[part], "a location file never touches the general modules");
    assert.equal((await written(locTarget, "WEATHER", "loc")).fog.chancePerCheck, 0.25);

    resetTargets();
    assert.equal(await applier.apply(v2(storm, locOnly), { yes: true }), "applied");
    assert.equal(fs.readdirSync(backups).length, 2, "storm and location backed up");

    // Format v1 still applies: rain + location.
    const rainV1 = clone(real.rain);
    rainV1.opacity = 0.55;
    resetTargets();
    assert.equal(await applier.apply(v1(rainV1, WEATHER), { yes: true }), "applied");
    assert.equal((await written(target("rain"), "RAIN_SETTINGS", "rain")).opacity, 0.55);
    assert.equal(fs.readFileSync(locTarget, "utf8"), realLocation);
    for (const part of ["ash", "storm", "wind"]) assert.equal(text(part), realText[part]);

    // Unchanged & cancelled.
    resetTargets();
    assert.equal(await applier.apply(v2(real, WEATHER)), "unchanged");
    answer = false;
    assert.equal(await applier.apply(v2(storm, locOnly)), "cancelled");
    assert.equal(text("storm"), realText.storm);
    answer = true;

    // Dirty target refused.
    dirtySet.add(target("storm"));
    assert.equal(await applier.apply(v2(storm, null), { yes: true }), "refused", "dirty storm module refused");
    dirtySet.clear();

    // Conflict without/with --force.
    const stale = JSON.parse(v2(storm, null));
    stale.baseHashes.general.storm = "0".repeat(64);
    assert.equal(await applier.apply(JSON.stringify(stale), { yes: true }), "refused", "hash mismatch refused without --force");
    assert.equal(await applier.apply(JSON.stringify(stale), { yes: true, force: true }), "applied", "--force applies over conflict");

    // Validation failures keep files untouched; general ranges are the config schema's (weather_settings_ranges.js).
    resetTargets();
    const untouched = () => {
      for (const part of PARTS) assert.equal(text(part), realText[part]);
      assert.equal(fs.readFileSync(locTarget, "utf8"), realLocation);
    };
    const change = (edit) => { const general = clone(real); edit(general); return general; };
    const missingPart = JSON.parse(v2(real, null));
    delete missingPart.general.wind;
    const unknownPart = JSON.parse(v2(real, null));
    unknownPart.general.water = {};
    const badDuration = clone(WEATHER); badDuration.rain.durationSec = [500, 10];
    const badPhases = clone(WEATHER); badPhases.fog.phases = ["noon"];
    const movedKey = clone(WEATHER); movedKey.wind.weatherBoost = { rainBonus: 0.2 };
    for (const [fileText, reason] of [
      ["{bad json", "invalid json"],
      [v2(real, null, { format: "cyber-fishing/zones" }), "wrong format"],
      [v2(real, null, { formatVersion: 3 }), "unknown version"],
      [JSON.stringify({ format: format.WEATHER_FILE_FORMAT, formatVersion: 2, baseHashes: {} }), "empty file"],
      [JSON.stringify(missingPart), "v2 general without a part"],
      [JSON.stringify(unknownPart), "unknown general part"],
      [v2(change((g) => { g.storm.windMinStrength = [0.035, 2]; }), null), "storm windMinStrength > 1"],
      [v2(change((g) => { g.wind.gust.deltaRange = [0.3, 0.1]; }), null), "reversed wind gust deltaRange"],
      [v2(change((g) => { g.wind.secret = 1; }), null), "unknown wind key"],
      [v2(change((g) => { g.ash.coolColor = "red"; }), null), "invalid ash color"],
      [v2(change((g) => { g.ash.strength.opacity = [0.5, 1.5]; }), null), "ash opacity > 1"],
      [v2(change((g) => { g.rain.color = "blue"; }), null), "invalid rain color"],
      [v2(change((g) => { g.rain.widthPx = 99; }), null), "out-of-range rain widthPx"],
      [v1({ ...clone(real.rain), secret: 1 }, WEATHER), "v1 unknown rain key"],
      [v2(null, WEATHER, { locationId: "lake" }), "unknown location"],
      [v2(null, WEATHER, { locationId: "pond" }), "missing location weather module"],
      [v2(null, badDuration), "reversed duration interval"],
      [v2(null, badPhases), "unknown fog phase"],
      [v2(null, movedKey), "a key that moved to the general wind"],
    ]) {
      assert.equal(await applier.apply(fileText, { yes: true }), "refused", reason);
      untouched();
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  // 2. WeatherDevSection «Збереження»: status of both levels, export by the selector, import, reset.
  {
    const doc = new TestDocument();
    const runtime = new SourceRuntime({ globals: { document: doc } });
    const { WeatherDevSection } = runtime.importModule("src/dev/tools/weather_dev_section.js");

    const base = clone(real);
    const baseWeather = clone(WEATHER);
    let live = clone(real);
    let liveWeather = clone(WEATHER);

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
    const configPaths = Object.fromEntries(PARTS.map((part) => [`CONFIG.${format.GENERAL_WEATHER_PARTS[part].configPath.join(".")}`, part]));
    const section = new WeatherDevSection({
      view: { selected: "test" }, // the saving workflow starts from the location view
      ui: fakeUi,
      weather: { locationId: "test", getModel: () => model, getWind: () => null },
      config: () => liveWeather,
      locationConfig: () => liveWeather,
      locationsMap: () => ({ test: { weather: liveWeather } }),
      rainConfig: () => live.rain,
      ashConfig: () => live.ash,
      general: () => ({ ...live, water: null, screen: null, debug: null }),
      createSection: (label, parent, sectionPath) => fakeUi.createSection(label, parent, sectionPath),
      renderConfigTree() {},
      updateConfig: (pathArg, value) => {
        const key = pathArg.join(".");
        if (configPaths[key]) live[configPaths[key]] = clone(value);
        if (key === "CONFIG.locations.map.test.weather") liveWeather = clone(value);
      },
      files: { download: (name, body) => downloads.push({ name, body }), pickFile: async () => pickedText, hashText: (t) => sha256(t) },
      getBaseGeneral: () => base,
      getBaseLocationWeather: () => baseWeather,
      resetWeather: (request) => {
        resets.push(request);
        if (request.general) live = clone(base);
        if (request.locationId) liveWeather = clone(baseWeather);
      },
      gameVersion: "0.51.23",
      now: () => new Date(2026, 10, 16, 12, 34, 0),
    });
    const status = () => textRows.get("Стан погоди").innerText;
    const select = (value) => parameters.get("WEATHER.location.id").onCommit(value);
    const exportNow = async () => { await buttons.get("Експорт погоди")(); await tick(); return JSON.parse(downloads.at(-1).body); };

    section.render(doc.createElement("div"));
    assert.equal(status(), "Погода збігається з кодом.");

    // The defect (TK-332): a storm edit is a change not in the code — the old status said «збігається з кодом».
    live.storm.windMinStrength = [0.035, 0.5];
    doc.fire("config-updated", { detail: { path: ["CONFIG", "weather", "storm", "windMinStrength"] } });
    assert.equal(status(), "Змінено (ще не в коді): Шторм. Загальні не ввійдуть в експорт: оберіть «Загальні» або «Всі».",
      "a storm edit shows, and the location view says the export leaves it out");

    // Location view: the file holds the location only.
    let file = await exportNow();
    assert.equal(downloads.at(-1).name, "weather-test-v0.51.23-20261116-1234.json");
    assert.equal(file.general, undefined);
    assert.equal(file.locationId, "test");
    assert.deepEqual(format.validateWeatherFile(file, { generalTemplates: base, locationWeatherTemplate: baseWeather }), []);
    assert.equal(exportNotices.at(-1).command, "npm run apply:weather -- weather-test-v0.51.23-20261116-1234.json");

    // «Загальні»: the general parts only, with the storm edit.
    select("Загальні");
    assert.equal(status(), "Змінено (ще не в коді): Шторм.");
    file = await exportNow();
    assert.equal(downloads.at(-1).name, "weather-general-v0.51.23-20261116-1234.json");
    assert.equal(file.locationId, undefined);
    assert.equal(JSON.stringify(file.general.storm.windMinStrength), "[0.035,0.5]");
    assert.equal(file.baseHashes.general.storm, baseHashes.storm, "base hash is the code's, not the edit's");
    assert.deepEqual(format.validateWeatherFile(file, { generalTemplates: base }), []);

    // TK-333: «Всі» — both levels in one file.
    select("Всі");
    liveWeather.fog.chancePerCheck = 0.5;
    doc.fire("config-updated", { detail: { path: ["CONFIG", "locations", "map", "test", "weather", "fog", "chancePerCheck"] } });
    assert.equal(status(), "Змінено (ще не в коді): Шторм, Параметри локації test.");
    file = await exportNow();
    assert.equal(downloads.at(-1).name, "weather-general-test-v0.51.23-20261116-1234.json");
    assert.equal(JSON.stringify(file.general.storm.windMinStrength), "[0.035,0.5]");
    assert.equal(file.locationWeather.fog.chancePerCheck, 0.5);
    const both = file;

    // Reset drops what the export holds (here both levels).
    buttons.get("Скинути зміни погоди до коду")();
    assert.equal(JSON.stringify(resets.at(-1)), JSON.stringify({ general: true, locationId: "test" }), "sandboxed realm: compare by value");
    assert.equal(status(), "Погода збігається з кодом.");

    // Import of a wrong location is refused; a valid v2 file restores both levels; a v1 file brings rain + location.
    pickedText = JSON.stringify({ ...both, locationId: "pond" });
    await buttons.get("Імпорт погоди")();
    await tick();
    assert(status().includes("pond"), "wrong location rejected");
    pickedText = JSON.stringify(both);
    await buttons.get("Імпорт погоди")();
    await tick();
    assert.equal(JSON.stringify(live.storm.windMinStrength), "[0.035,0.5]");
    assert.equal(liveWeather.fog.chancePerCheck, 0.5);
    assert.equal(status(), "Змінено (ще не в коді): Шторм, Параметри локації test.");
    const legacy = JSON.parse(v1({ ...clone(real.rain), opacity: 0.7 }, WEATHER));
    pickedText = JSON.stringify(legacy);
    await buttons.get("Імпорт погоди")();
    await tick();
    assert.equal(live.rain.opacity, 0.7);
    assert.equal(liveWeather.fog.chancePerCheck, WEATHER.fog.chancePerCheck);

    section.dispose();
  }

  console.log("apply:weather passed: canonical general and location modules, format v2 by level (general rain/ash/storm/wind, location, both) and v1, backup/conflict/validation, and WeatherDevSection saving of both levels.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
