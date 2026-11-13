"use strict";
// Spec 175 (TK-286): weather export/import/reset in DevTools «🌧 ПОГОДА» and `npm run apply:weather` moving changed
// modules (global rain_settings.js and/or locations/weather/<id>.js) safely into the code. Every file write runs in a
// scratch directory; production modules are only read.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { WeatherFileApplier, sha256 } = require("../../apply-weather.js");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const { TestDocument } = require("../../testing/keepnet/test_document");

const root = path.resolve(__dirname, "../../..");
const load = (file) => import(pathToFileURL(path.join(root, file)).href);

(async () => {
  const format = await load("src/dev/weather/weather_export_format.js");
  const { RAIN_SETTINGS } = await load(format.RAIN_SETTINGS_MODULE);
  const { WEATHER } = await load(format.locationWeatherModulePath("test"));
  const { CONFIG } = await load("src/game/config/runtime/game_config.js");
  const { MAP_DB } = await load("src/game/config/databases/location_catalog.js");

  assert.equal(CONFIG.canvas.rain, RAIN_SETTINGS, "CONFIG.canvas.rain reads the rain data module");
  assert.equal(MAP_DB.test.weather, WEATHER, "location catalog joins the location weather data module");
  const realRain = fs.readFileSync(path.join(root, format.RAIN_SETTINGS_MODULE), "utf8");
  const realLocation = fs.readFileSync(path.join(root, format.locationWeatherModulePath("test")), "utf8");
  assert.equal(format.rainModuleSource(RAIN_SETTINGS), realRain, "committed rain_settings.js is canonical");
  assert.equal(format.locationWeatherModuleSource("test", WEATHER), realLocation, "committed test.js weather is canonical");

  // Hash & noise stability.
  const baseRainHash = await format.rainHash(RAIN_SETTINGS, sha256);
  const baseWeatherHash = await format.locationWeatherHash(WEATHER, sha256);
  const shuffledRain = Object.fromEntries(Object.entries(RAIN_SETTINGS).reverse());
  const shuffledWeather = Object.fromEntries(Object.entries(WEATHER).reverse());
  assert.equal(await format.rainHash(shuffledRain, sha256), baseRainHash, "rain hash ignores key order");
  assert.equal(await format.locationWeatherHash(shuffledWeather, sha256), baseWeatherHash, "location weather hash ignores key order");
  const cleanedRain = format.canonicalRain({ ...RAIN_SETTINGS, widthPx: 0.1 + 0.2, opacity: 11.700000000000001 });
  assert.equal(cleanedRain.widthPx, 0.3);
  assert.equal(cleanedRain.opacity, 11.7);

  // 1. CLI applier in scratch dir: partial updates (rain-only, location-only, both), unchanged, cancel, conflicts, validation.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-apply-weather-"));
  try {
    const rainTarget = path.join(scratch, "rain_settings.js");
    const locTarget = path.join(scratch, "test.js");
    const backups = path.join(scratch, "backups");
    const dirtySet = new Set();
    let answer = true, asked = 0, checks = 0, reads = 0;
    const logs = [];
    const applier = new WeatherFileApplier({
      format,
      locations: { map: { test: {}, pond: {} } },
      rainModulePath: rainTarget,
      locationModulePath: (id) => path.join(scratch, `${id}.js`),
      readRain: async (file) => { reads++; return (await import(`${pathToFileURL(file).href}?r=${reads}`)).RAIN_SETTINGS; },
      readLocationWeather: async (file) => { reads++; return (await import(`${pathToFileURL(file).href}?w=${reads}`)).WEATHER; },
      isDirty: (target) => dirtySet.has(target),
      confirm: async () => { asked++; return answer; },
      backupDir: backups,
      runChecks: () => { checks++; },
      log: (msg) => logs.push(msg),
      now: () => new Date("2026-11-13T10:15:30Z"),
    });
    const resetTargets = () => {
      fs.writeFileSync(rainTarget, realRain);
      fs.writeFileSync(locTarget, realLocation);
    };
    const exported = (rain, locationWeather, extra = {}) => JSON.stringify({
      ...format.buildWeatherFile({
        locationId: "test",
        rain,
        locationWeather,
        rainBaseHash: baseRainHash,
        locationWeatherBaseHash: baseWeatherHash,
        gameVersion: "0.50.93",
        exportedAt: "2026-11-13T10:15:00.000Z",
      }),
      ...extra,
    });

    const rainOnly = JSON.parse(JSON.stringify(RAIN_SETTINGS));
    rainOnly.maxDrops = 850;
    rainOnly.rings.ripple.strength = 0.4;

    const locOnly = JSON.parse(JSON.stringify(WEATHER));
    locOnly.fog.chance = 0.25;
    locOnly.precipitation.rain.weight = 0.4;

    // Rain-only update leaves location weather untouched (even if location target has uncommitted edits).
    resetTargets();
    dirtySet.add(locTarget);
    assert.equal(await applier.apply(exported(rainOnly, WEATHER)), "applied");
    assert.equal(asked, 1);
    assert.equal(checks, 1);
    assert.equal(fs.readFileSync(locTarget, "utf8"), realLocation, "unchanged location weather is not touched");
    assert.equal(fs.readdirSync(backups).length, 1, "only changed module is backed up");
    const writtenRain = (await import(`${pathToFileURL(rainTarget).href}?after=rain`)).RAIN_SETTINGS;
    assert.equal(writtenRain.maxDrops, 850);
    assert.equal(writtenRain.rings.ripple.strength, 0.4);
    assert(logs.some((line) => line.includes("maxDrops: 700 -> 850")), "diff logs the changed field");
    dirtySet.clear();

    // Location-only update leaves rain_settings.js untouched.
    resetTargets();
    assert.equal(await applier.apply(exported(RAIN_SETTINGS, locOnly), { yes: true }), "applied");
    assert.equal(asked, 1, "--yes skips prompt");
    assert.equal(fs.readFileSync(rainTarget, "utf8"), realRain, "unchanged rain module is not touched");
    const writtenLoc = (await import(`${pathToFileURL(locTarget).href}?after=loc`)).WEATHER;
    assert.equal(writtenLoc.fog.chance, 0.25);
    assert.equal(writtenLoc.precipitation.rain.weight, 0.4);

    // Combined update rewrites both and backs up both.
    resetTargets();
    fs.rmSync(backups, { recursive: true, force: true });
    assert.equal(await applier.apply(exported(rainOnly, locOnly), { yes: true }), "applied");
    assert.equal(fs.readdirSync(backups).length, 2, "both changed modules are backed up");

    // Unchanged & cancelled.
    resetTargets();
    assert.equal(await applier.apply(exported(RAIN_SETTINGS, WEATHER)), "unchanged");
    answer = false;
    assert.equal(await applier.apply(exported(rainOnly, locOnly)), "cancelled");
    assert.equal(fs.readFileSync(rainTarget, "utf8"), realRain);
    assert.equal(fs.readFileSync(locTarget, "utf8"), realLocation);
    answer = true;

    // Dirty target refused.
    dirtySet.add(rainTarget);
    assert.equal(await applier.apply(exported(rainOnly, WEATHER), { yes: true }), "refused", "dirty rain module refused");
    dirtySet.clear();

    // Conflict without/with --force.
    const conflict = exported(rainOnly, WEATHER, { baseHashes: { rain: "0".repeat(64), locationWeather: baseWeatherHash } });
    assert.equal(await applier.apply(conflict, { yes: true }), "refused", "hash mismatch refused without --force");
    assert.equal(await applier.apply(conflict, { yes: true, force: true }), "applied", "--force applies over conflict");

    // Validation failures keep files untouched.
    resetTargets();
    const untouched = () => {
      assert.equal(fs.readFileSync(rainTarget, "utf8"), realRain);
      assert.equal(fs.readFileSync(locTarget, "utf8"), realLocation);
    };
    const badColor = JSON.parse(JSON.stringify(RAIN_SETTINGS)); badColor.color = "blue";
    const badRange = JSON.parse(JSON.stringify(RAIN_SETTINGS)); badRange.widthPx = 99;
    const unknownRainKey = JSON.parse(JSON.stringify(RAIN_SETTINGS)); unknownRainKey.secret = 1;
    const badDuration = JSON.parse(JSON.stringify(WEATHER)); badDuration.precipitation.rain.durationSec = [500, 10];
    const badPhases = JSON.parse(JSON.stringify(WEATHER)); badPhases.fog.phases = ["noon"];
    const badLocationUnknownKey = JSON.parse(JSON.stringify(WEATHER)); badLocationUnknownKey.extra = true;

    for (const [text, reason] of [
      ["{bad json", "invalid json"],
      [exported(RAIN_SETTINGS, WEATHER, { format: "cyber-fishing/zones" }), "wrong format"],
      [exported(RAIN_SETTINGS, WEATHER, { locationId: "lake" }), "unknown location"],
      [exported(RAIN_SETTINGS, WEATHER, { locationId: "pond" }), "missing location weather module"],
      [exported(badColor, WEATHER), "invalid color"],
      [exported(badRange, WEATHER), "out-of-range rain widthPx"],
      [exported(unknownRainKey, WEATHER), "unknown rain key"],
      [exported(RAIN_SETTINGS, badDuration), "reversed duration interval"],
      [exported(RAIN_SETTINGS, badPhases), "unknown fog phase"],
      [exported(RAIN_SETTINGS, badLocationUnknownKey), "unknown location weather key"],
    ]) {
      assert.equal(await applier.apply(text, { yes: true }), "refused", reason);
      untouched();
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  // 2. WeatherDevSection UI saving workflow (status vs code, export + ExportCommandNotice, import, reset to code).
  {
    const doc = new TestDocument();
    const runtime = new SourceRuntime({ globals: { document: doc } });
    const { WeatherDevSection } = runtime.importModule("src/dev/tools/weather_dev_section.js");

    const baseRain = JSON.parse(JSON.stringify(RAIN_SETTINGS));
    const baseWeather = JSON.parse(JSON.stringify(WEATHER));
    let liveRain = JSON.parse(JSON.stringify(RAIN_SETTINGS));
    let liveWeather = JSON.parse(JSON.stringify(WEATHER));

    const sections = new Map();
    const textRows = new Map();
    const buttons = new Map();
    const exportNotices = [];
    let pickedText = null;
    const downloads = [];
    let resetCalls = 0;

    const fakeUi = {
      releaseValueBindings() {},
      createSection(label, parent, path) {
        const key = (path || [label]).join(".");
        const node = doc.createElement("div");
        parent.appendChild(node);
        sections.set(key, node);
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
      createInputRow() {},
      createButtonRow(label, parent, onClick) {
        buttons.set(label, onClick);
      },
      showExportCommand(host, options) {
        exportNotices.push({ host, ...options });
      },
    };
    const fakeFiles = {
      download: (name, text) => downloads.push({ name, text }),
      pickFile: async () => pickedText,
      hashText: (text) => sha256(text),
    };
    const model = {
      snapshot: {
        precipitation: "clear", precipitationLeftSec: 100, rain: 0, rainTarget: 0,
        storm: 0, stormTarget: 0, fogState: "none", fog: 0, fogTarget: 0,
        strikeSerial: 0, strikeVariant: 0, strikeDistance: 0.5, frozen: false,
      },
    };
    const updates = [];
    const section = new WeatherDevSection({
      ui: fakeUi,
      weather: { locationId: "test", getModel: () => model, getWind: () => null },
      config: () => liveWeather,
      rainConfig: () => liveRain,
      createSection: (label, parent, path) => fakeUi.createSection(label, parent, path),
      renderConfigTree() {},
      updateConfig: (pathArg, value) => {
        updates.push([pathArg.join("."), JSON.parse(JSON.stringify(value))]);
        const key = pathArg.join(".");
        if (key === "CONFIG.canvas.rain") liveRain = JSON.parse(JSON.stringify(value));
        if (key === "CONFIG.locations.map.test.weather") liveWeather = JSON.parse(JSON.stringify(value));
      },
      files: fakeFiles,
      getBaseRain: () => baseRain,
      getBaseLocationWeather: () => baseWeather,
      resetWeather: () => {
        resetCalls++;
        liveRain = JSON.parse(JSON.stringify(baseRain));
        liveWeather = JSON.parse(JSON.stringify(baseWeather));
      },
      gameVersion: "0.50.93",
      now: () => new Date(2026, 10, 13, 12, 34, 0),
    });

    const host = doc.createElement("div");
    section.render(host);
    assert.equal(textRows.get("Стан погоди").innerText, "Погода збігається з кодом.");

    // Live edit triggers saving status refresh via config-updated.
    liveRain.maxDrops = 900;
    doc.fire("config-updated", { detail: { path: ["CONFIG", "canvas", "rain", "maxDrops"] } });
    assert.equal(textRows.get("Стан погоди").innerText, "Змінено (ще не в коді): Вигляд дощу.");

    // Export writes valid canonical JSON + shows ExportCommandNotice.
    await buttons.get("Експорт погоди")();
    // Wait a microtask turn for async #exportWeather.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, "weather-test-v0.50.93-20261113-1234.json");
    const exportedObj = JSON.parse(downloads[0].text);
    assert.deepEqual(format.validateWeatherFile(exportedObj, { rainTemplate: baseRain, locationWeatherTemplate: baseWeather }), []);
    assert.equal(exportedObj.rain.maxDrops, 900);
    assert.equal(exportNotices.length, 1);
    assert.equal(exportNotices[0].command, "npm run apply:weather -- weather-test-v0.50.93-20261113-1234.json");

    // Import wrong location refused without mutating config.
    pickedText = JSON.stringify({ ...exportedObj, locationId: "pond" });
    await buttons.get("Імпорт погоди")();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert(textRows.get("Стан погоди").innerText.includes("pond"), "wrong location rejected");

    // Reset restores code state.
    buttons.get("Скинути зміни погоди до коду")();
    assert.equal(resetCalls, 1);
    assert.equal(liveRain.maxDrops, 700);
    assert.equal(textRows.get("Стан погоди").innerText, "Погода збігається з кодом.");

    // Import valid tuned file updates live config and status.
    const importObj = JSON.parse(JSON.stringify(exportedObj));
    importObj.rain.maxDrops = 1100;
    importObj.locationWeather.fog.chance = 0.5;
    pickedText = JSON.stringify(importObj);
    await buttons.get("Імпорт погоди")();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(liveRain.maxDrops, 1100);
    assert.equal(liveWeather.fog.chance, 0.5);
    assert.equal(textRows.get("Стан погоди").innerText, "Змінено (ще не в коді): Вигляд дощу, Параметри локації.");

    section.dispose();
  }

  console.log("apply:weather passed: canonical data modules, selective rain/location apply with backup/conflict/validation, and WeatherDevSection saving UI.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
