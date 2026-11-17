"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const ROOT = path.resolve(__dirname, "../../..");
const LABELS = JSON.parse(fs.readFileSync(path.join(ROOT, "src/dev/metadata/parameter_labels.json"), "utf8"));

// Composes the configuration exactly as a page does (each composition gets its own VM realm, because the
// production config context is a per-page singleton) and returns a validator factory over it.
function compose({ development }) {
  const runtime = new SourceRuntime();
  const { createProductionConfigContext } = runtime.importModule("src/bootstrap/production/game_config_composition.js");
  const { ConfigSchemaValidator } = ({ ...runtime.importModule("src/game/config/validation/config_validation_result.js"), ...runtime.importModule("src/game/config/validation/config_schema_validator.js") });
  const { FISH_DB } = runtime.importModule("src/game/config/databases/fish_database.js");
  const { ITEM_DB } = runtime.importModule("src/game/config/databases/item_catalog.js");
  const { PROJECT_VERSION_CONFIG } = runtime.importModule("src/game/presentation/version/project_version.js");
  const context = createProductionConfigContext(development ? (config) => {
    config.debug.godMode.enabled = true;
    config.debug.fixedCatch.enabled = true;
  } : null);
  const options = { config: context.runtimeConfig, fishDb: FISH_DB, itemDb: ITEM_DB, mapDb: context.runtimeConfig.locations.map,
    parameterLabels: LABELS, baseConfig: context.baseConfig, overrideStore: context.overrideStore,
    projectVersion: PROJECT_VERSION_CONFIG };
  return { context, ConfigSchemaValidator, options, validate: (overrides = {}) =>
    new ConfigSchemaValidator({ ...options, ...overrides }).validate() };
}

const describe = (issues) => issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");

function checkComposedConfigs() {
  for (const development of [false, true]) {
    const name = development ? "DEV" : "production";
    const { context, validate } = compose({ development });
    const before = JSON.stringify(context.runtimeConfig);
    const result = validate();
    assert.equal(result.errors.length, 0, `${name} config has no validation errors: ${describe(result.errors)}`);
    assert.equal(result.warnings.length, 0, `${name} config has no validation warnings: ${describe(result.warnings)}`);
    assert(result.summary.physicsLeaves > 100 && result.summary.fishCount > 0 && result.summary.itemCount > 0 &&
      result.summary.mapCount > 0, `${name} validation covers physics, fish, items and maps`);
    assert.equal(JSON.stringify(context.runtimeConfig), before, `${name} validation leaves the config unchanged`);
    assert.equal(Object.keys(context.exportOverrides()).length, 0,
      `${name} validation writes no overrides`);
  }
}

function checkNegativeFixtures() {
  const { context, validate, options } = compose({ development: false });
  const config = context.runtimeConfig;
  const has = (result, pattern) => result.errors.some((issue) => pattern.test(`${issue.path}: ${issue.message}`));
  for (const selector of [{ radialEnabled: "true", size: 1, openSize: 3 }, { radialEnabled: true, size: 4, openSize: 3 },
    { radialEnabled: true, size: 1, openSize: 4 }, { radialEnabled: true, size: 1, openSize: "3" },
    { radialEnabled: false, size: 2, openSize: 3, typo: true }]) {
    assert(has(validate({ config: { ...config, ui: { ...config.ui, inventorySelector: selector } } }), /inventorySelector/u),
      "selector booleans, size presets and unknown fields are schema validated");
  }
  const labels = { ...LABELS };
  delete labels["physics.fight.rodStroke.capacityByLineLengthRatio"];
  assert(has(validate({ parameterLabels: labels }), /capacityByLineLengthRatio: missing parameter label/u),
    "a physics parameter without a DEV label is reported");
  assert(has(validate({ baseConfig: { physics: {} } }), /BASE_CONFIG: base config must be frozen/u),
    "a mutable base config is reported");
  assert(has(validate({ overrideStore: null }), /CONFIG_OVERRIDE_STORE: missing runtime override store/u),
    "a missing override store is reported");
  assert(has(validate({ fishDb: [] }), /FISH_DB: must be a non-empty array/u), "an empty fish database is reported");
  const fish = JSON.parse(JSON.stringify(options.fishDb[0]));
  delete fish.physics;
  assert(has(validate({ fishDb: [fish] }), /physics: missing fish physics object/u), "a fish without physics is reported");
  context.set("physics.fight.rodStroke.capacityByLineLengthRatio", "wide");
  assert(has(validate(), /capacityByLineLengthRatio: expected number like the base config, got string/u), "an invalid live override is reported");
  context.reset("physics.fight.rodStroke.capacityByLineLengthRatio");
  for (const [key, value] of [["range.leftRatio", 1.1], ["range.rightRatio", -0.1],
    ["speedPxPerSecond", -1], ["movingFloatBite.chance", 2], ["biteReaction.enabled", "yes"],
    ["lineTension.enabled", "yes"], ["floatTilt.enabled", 1],
    ["speedMultipliers.stationaryFloat", -1], ["speedMultipliers.movingFloat", -1],
    ["speedMultipliers.stationaryFloat", "3"], ["speedMultipliers.movingFloat", Infinity]]) {
    const path = "physics.castRodControl." + key;
    context.set(path, value);
    assert(validate().errors.some(issue => issue.path === path), "invalid cast control setting is rejected: " + key);
    context.reset(path);
  }
  for (const [key, value] of [["enabled", 1], ["ratePerSecond", -1], ["loadCurvePower", -1], ["movementEpsilonPx", -1]]) {
    const path = "physics.fight.rodControl.tension.towardFishCompensation." + key;
    context.set(path, value);
    assert(validate().errors.some(issue => issue.path === path), "invalid side compensation setting is rejected: " + key);
    context.reset(path);
  }
  // TK-368.1 (spec 183): the touch cast gesture and the touch aim are typed, bounded and labelled.
  for (const [path, value] of [["input.touchCast.swipeAimPx", -1], ["input.touchCast.tapMaxMs", "300"],
    ["input.touchCast.doubleTapMs", 5000], ["casting.touchAim.startAtFullPower", "yes"],
    ["casting.touchAim.panDeadZoneRatio", 1], ["casting.touchAim.panMaxPxPerSecond", -5],
    ["casting.touchAim.panEasePower", 0], ["casting.touchAim.panAccelerationPxPerSecond2", "fast"],
    ["casting.touchAim.powerZonePx", -1]]) {
    context.set(path, value);
    assert(validate().errors.some((issue) => issue.path === path), `an invalid touch setting is rejected: ${path} = ${value}`);
    context.reset(path);
  }
  // A group's label covers its keys (#hasParameterLabel), so both the key's and the group's labels are taken away.
  for (const key of ["input.touchCast.doubleTapMs", "casting.touchAim.powerZonePx"]) {
    const unlabelled = { ...LABELS };
    delete unlabelled[key];
    delete unlabelled[key.slice(0, key.lastIndexOf("."))];
    assert(validate({ parameterLabels: unlabelled }).errors.some((issue) => issue.path === key &&
      /missing parameter label/u.test(issue.message)), `a touch setting without a DEV label is reported: ${key}`);
  }
  // Spec 104 D1: the scene mode is "canvas" or "webgl".
  context.set("canvas.scene", "gl");
  assert(has(validate(), /CONFIG\.canvas\.scene: must be "canvas" or "webgl"/u), "an unknown scene mode is rejected");
  context.reset("canvas.scene");
  // Spec 106: the scene's water settings are bounded.
  for (const [key, value, issuePath] of [["enabled", 1, "canvas.water.enabled"], ["frameRate", 0, "CONFIG.canvas.water.frameRate"],
    ["amplitude", -1, "CONFIG.canvas.water.amplitude"], ["wavelength", 2, "CONFIG.canvas.water.wavelength"]]) {
    context.set("canvas.water." + key, value);
    assert(validate().errors.some(issue => issue.path === issuePath), "invalid water setting is rejected: " + key);
    context.reset("canvas.water." + key);
  }
  assert.equal(validate().errors.length, 0, "resetting the override restores a valid config");
  for (const value of [0, -1, 91, Infinity]) {
    const tiltedMapDb = JSON.parse(JSON.stringify(options.mapDb));
    tiltedMapDb.test.waterProjection.tiltDegrees = value;
    assert(has(validate({ mapDb: tiltedMapDb }), /waterProjection\.tiltDegrees/u), "an invalid location tilt is reported");
  }
  for (const value of [0, .01, 1.1, NaN]) {
    const farMapDb = JSON.parse(JSON.stringify(options.mapDb));
    farMapDb.test.waterProjection.farScale = value;
    assert(has(validate({ mapDb: farMapDb }), /waterProjection\.farScale/u), "invalid far size is reported");
  }
  assert(has(validate({ projectVersion: { version: "invalid" } }), /PROJECT_VERSION_CONFIG\.version/u),
    "an invalid project version is reported");
  // R1 (spec 126): a projection without its length, unknown fields and the retired branches are reported.
  const mapDb = JSON.parse(JSON.stringify(options.mapDb));
  mapDb.test.waterProjection = { tiltDegrees: 30, lateralContraction: "yes", linearShare: .5 };
  mapDb.test.perspective = { tiltDegrees: 30 };
  mapDb.test.distanceProfile = { enabled: true, maxMeters: 30 };
  const profileResult = validate({ mapDb });
  assert(has(profileResult, /waterProjection\.maxMeters: expected finite number/u) &&
    has(profileResult, /waterProjection\.lateralContraction: expected boolean/u) &&
    has(profileResult, /waterProjection\.linearShare: unknown field/u) &&
    has(profileResult, /test\.perspective: retired by spec 126/u) &&
    has(profileResult, /test\.distanceProfile: retired by spec 126/u), "an invalid location water projection is reported");
  const uniformMapDb = JSON.parse(JSON.stringify(options.mapDb));
  delete uniformMapDb.test.waterProjection;
  assert(!has(validate({ mapDb: uniformMapDb }), /waterProjection/u), "a location without a projection is valid uniform water");
  uniformMapDb.test.waterProjection = null;
  assert(!has(validate({ mapDb: uniformMapDb }), /waterProjection/u), "null (the zone editor's projection physics off) is uniform water");
  assert.equal(config, context.runtimeConfig);
}

function checkReporterReadsLiveLocationProfiles() {
  const runtime = new SourceRuntime({ moduleStubs: {
    "src/dev/diagnostics/config_validation_reporter.js": { ConfigValidationReporter: class {
      constructor({ createValidator }) { this.createValidator = createValidator; }
    } },
    "src/game/config/validation/config_schema_validator.js": { ConfigSchemaValidator: class {
      constructor(options) { this.options = options; }
    } },
  } });
  const { composeDevConfigValidation } = runtime.importModule("src/bootstrap/development/dev_config_validation_composition.js");
  const configRuntime = { runtimeConfig: { locations: { map: { lake: { waterProjection: { maxMeters: 30, tiltDegrees: 90 } } } } } };
  const reporter = composeDevConfigValidation({ configRuntime, itemCatalog: {} });
  const first = reporter.createValidator(LABELS).options.mapDb;
  configRuntime.runtimeConfig.locations.map = { lake: { waterProjection: { maxMeters: 30, tiltDegrees: 0 } } };
  const next = reporter.createValidator(LABELS).options.mapDb;
  assert.notEqual(first, next, "validation follows a replaced runtime map after an override");
  assert.equal(next.lake.waterProjection.tiltDegrees, 0, "the validator sees the current invalid angle, not the startup catalog");
}

async function checkDevelopmentReporter() {
  const { ConfigValidationReporter } = require(path.join(ROOT, "src/dev/diagnostics/config_validation_reporter.js"));
  const { validate, ConfigSchemaValidator, options } = compose({ development: true });
  const logs = [];
  const fetches = [];
  const originals = { fetch: globalThis.fetch, info: console.info, warn: console.warn };
  globalThis.fetch = async (url) => { fetches.push(url); return { ok: true, json: async () => LABELS }; };
  console.info = (...args) => logs.push(["info", ...args]);
  console.warn = (...args) => logs.push(["warn", ...args]);
  try {
    let labelsOverride = null;
    const reporter = new ConfigValidationReporter({ createValidator: (parameterLabels) =>
      new ConfigSchemaValidator({ ...options, parameterLabels: labelsOverride || parameterLabels }) });
    assert.equal((await reporter.report("edit physics.x", { quietWhenValid: true })).errors.length, 0);
    assert.equal(logs.length, 0, "a valid edit stays quiet");
    await reporter.report("manual check");
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], "info");
    assert.match(logs[0][1], /\[ConfigValidation\] manual check: 0 errors, 0 warnings/u);
    labelsOverride = {};
    await reporter.report("import overrides");
    assert.equal(logs[1][0], "warn", "problems are reported as warnings");
    assert.match(logs[1][1], /import overrides: [1-9]\d* errors/u);
    assert.equal(fetches.length, 1, "parameter labels are fetched once");
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    const failing = new ConfigValidationReporter({ createValidator: () => { throw new Error("unreachable"); } });
    assert.equal(await failing.report("manual check"), null, "missing labels make validation unavailable, not fatal");
    assert.match(logs[2][1], /validation unavailable/u);
    assert.equal(validate().errors.length, 0);
  } finally {
    globalThis.fetch = originals.fetch;
    console.info = originals.info;
    console.warn = originals.warn;
  }
}

// TK-318: the DevTools names and descriptions stay true to the code. Every label path resolves (database rows by the
// tooltip provider's normalisation, alias rows through the alias registry); a description by key is kept only for a key
// some row still shows without a path label; every overlay metric's CONFIG path exists; a "типово/за замовчуванням"
// value or on/off claim equals the code's.
function checkParameterDescriptions() {
  const runtime = new SourceRuntime();
  const { createProductionConfigContext } = runtime.importModule("src/bootstrap/production/game_config_composition.js");
  const { FISH_DB } = runtime.importModule("src/game/config/databases/fish_database.js");
  const { DevToolsParameterAliasRegistry } = runtime.importModule("src/dev/services/dev_tools_parameter_alias_registry.js");
  const config = createProductionConfigContext(null).baseConfig;
  const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, "src/dev/metadata", name), "utf8"));
  const keyed = read("dev_tool_parameter_descriptions.json");
  const metrics = read("overlay_metric_descriptions.json");
  const aliases = new DevToolsParameterAliasRegistry();
  const step = (node, segment) => {
    if (segment === "*") return node && typeof node === "object" ? Object.values(node).find((value) => value && typeof value === "object" && "direction" in value) ?? Object.values(node)[0] : undefined;
    return node && typeof node === "object" && segment in node ? node[segment] : undefined;
  };
  const valueAt = (labelPath) => {
    const segments = labelPath.replace(/^CONFIG./u, "").split(".");
    const [rootNode, rest] = segments[0] === "fish" ? [FISH_DB, null] : segments[0] === "MAP_DB" ? [config.locations.map, null] : [config, segments];
    if (rest) return rest.reduce(step, rootNode);
    // A database field: any record that has it.
    for (const record of Object.values(rootNode)) {
      const value = segments.slice(1).reduce(step, record);
      if (value !== undefined) return value;
    }
    return undefined;
  };
  const orphans = Object.keys(LABELS).filter((labelPath) => valueAt(labelPath) === undefined &&
    aliases.resolveCanonicalPath(["CONFIG", ...labelPath.split(".")]).join(".") === ["CONFIG", ...labelPath.split(".")].join("."));
  assert.deepEqual(orphans, [], "every parameter label names a parameter that exists");
  const claims = [];
  for (const [labelPath, entry] of Object.entries(LABELS)) {
    const value = valueAt(labelPath);
    const text = String(entry.description || "");
    if (typeof value === "boolean") {
      if (/типово увімкнен|за замовчуванням увімкнен/iu.test(text) && value !== true) claims.push(`${labelPath}: says on`);
      if (/типово вимкнен|за замовчуванням вимкнен/iu.test(text) && value !== false) claims.push(`${labelPath}: says off`);
    }
    const number = text.match(/(?:типово|за замовчуванням)[s:—-]*(-?d+(?:[.,]d+)?)/iu)
      || text.match(/((-?d+(?:[.,]d+)?)s+S+s+за замовчуванням)/iu);
    if (number && typeof value === "number" && Math.abs(Number(number[1].replace(",", ".")) - value) > 1e-9) {
      claims.push(`${labelPath}: says ${number[1]}, code ${value}`);
    }
  }
  assert.deepEqual(claims, [], "a default stated in a description is the code's default");
  // TK-320: a name never states on/off — the switch shows the state, and a stale "увімкнено" over a switched-off value
  // misleads.
  const stateWords = /(?:^|s)(?:увімкнено|вимкнено)(?:s|$)/iu;
  assert.deepEqual([...Object.entries(LABELS).filter(([, entry]) => stateWords.test(entry.label)).map(([key]) => key),
    ...keyed.filter((entry) => stateWords.test(String(entry.ua || "").replace(/_/gu, " "))).map((entry) => entry.key)], [],
    "no parameter name says «увімкнено» or «вимкнено»");
  const rowKeys = new Map();
  const collect = (node, trail) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      const labelPath = [...trail, key].join(".").replace(/^fish.d+./u, "fish.").replace(/^MAP_DB.[^.]+./u, "MAP_DB.")
        .replace(/.behaviors.[^.*]+./u, ".behaviors.*.");
      if (!LABELS[labelPath]) rowKeys.set(key, true);
      collect(value, [...trail, key]);
    }
  };
  collect(config, []);
  collect(Object.fromEntries(FISH_DB.map((fish, index) => [index, fish])), ["fish"]);
  collect(config.locations.map, ["MAP_DB"]);
  assert.deepEqual(keyed.filter((entry) => !rowKeys.has(entry.key)).map((entry) => entry.key), [],
    "a description by key serves a row that has no path label (no dead or duplicate entries)");
  const missing = [];
  for (const [name, entry] of Object.entries(metrics)) {
    for (const metricPath of entry.paths || []) {
      if (!metricPath.startsWith("CONFIG.") || metricPath.includes("<")) continue;
      if (metricPath.slice(7).split(".").reduce(step, config) === undefined) missing.push(`${name}: ${metricPath}`);
    }
  }
  assert.deepEqual(missing, [], "every overlay metric's CONFIG path exists");
}

// TK-318: database rows find their one description (FISH_DB.<index>. → fish., a behaviour state → behaviors.*.,
// a location → MAP_DB.), exactly the paths the labels and the validator use.
async function checkTooltipProviderPaths() {
  const fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, url), "utf8")) });
  const runtime = new SourceRuntime({ globals: { fetch, AbortController } });
  const { DevToolsParameterTooltipProvider } = runtime.importModule("src/dev/tools/dev_tools_parameter_tooltip_provider.js");
  {
    const provider = new DevToolsParameterTooltipProvider();
    await provider.ready;
    const name = (rowPath, key) => provider.describe(rowPath, key)?.name ?? null;
    assert.equal(name("FISH_DB.1.physics.forceProfile.basePower", "basePower"), LABELS["fish.physics.forceProfile.basePower"].label,
      "a fish database row has its field's label");
    assert.equal(name("FISH_DB.0.physics.behaviorProfile.behaviors.lastDash.direction.radialRange", "radialRange"),
      LABELS["fish.physics.behaviorProfile.behaviors.*.direction.radialRange"].label, "every behaviour state shares one label");
    assert.equal(name("CONFIG.locations.map.test.waterProjection.maxMeters", "maxMeters"),
      LABELS["MAP_DB.waterProjection.maxMeters"].label, "the zone editor's projection rows have their labels");
    assert.equal(name("MAP_DB.test.waterProjection.farScale", "farScale"), LABELS["MAP_DB.waterProjection.farScale"].label);
    assert.equal(name("FISH_DB.0.physics.behaviorProfile.behaviors.idle.agility", "agility"), "спритність риби",
      "a field without a path label falls back to its key's description");
    assert.equal(name("CONFIG.nothing.here", "nothing"), null);
    provider.dispose();
  }
}

checkComposedConfigs();
checkParameterDescriptions();
checkNegativeFixtures();
checkReporterReadsLiveLocationProfiles();
checkTooltipProviderPaths().then(checkDevelopmentReporter).then(() => {
  console.log("Config schema passed: production and DEV configs validate with 0 errors/warnings and stay unchanged; " +
    "labels (paths exist, stated defaults match, no dead keyed entries), frozen base, override store, fish data, live overrides and version are rejected when invalid; " +
    "the DEV reporter is quiet for valid edits, warns on problems and survives unavailable labels.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
