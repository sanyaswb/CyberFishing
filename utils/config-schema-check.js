"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { SourceRuntime } = require("./testing/core/source_runtime");

const ROOT = path.resolve(__dirname, "..");
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
  const itemDb = development
    ? runtime.importModule("src/dev/data/dev_item_catalog.js").createDevItemCatalog(ITEM_DB) : ITEM_DB;
  const options = { config: context.runtimeConfig, fishDb: FISH_DB, itemDb, mapDb: context.runtimeConfig.locations.map,
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
  assert.equal(validate().errors.length, 0, "resetting the override restores a valid config");
  assert(has(validate({ projectVersion: { version: "invalid" } }), /PROJECT_VERSION_CONFIG\.version/u),
    "an invalid project version is reported");
  assert.equal(config, context.runtimeConfig);
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

checkComposedConfigs();
checkNegativeFixtures();
checkDevelopmentReporter().then(() => {
  console.log("Config schema passed: production and DEV configs validate with 0 errors/warnings and stay unchanged; " +
    "labels, frozen base, override store, fish data, live overrides and version are rejected when invalid; " +
    "the DEV reporter is quiet for valid edits, warns on problems and survives unavailable labels.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
