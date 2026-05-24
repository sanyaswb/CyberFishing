const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/config/project_version.js",
  "src/config/databases/item_db.js",
  "src/config/databases/fish/presets/fish_profile_factory.js",
  "src/config/databases/fish/presets/fish_profile_presets.js",
  "src/config/databases/fish/species/peaceful_fish.js",
  "src/config/databases/fish/species/predator_fish.js",
  "src/config/databases/fish/species/rare_fish.js",
  "src/config/databases/fish/species/event_fish.js",
  "src/config/databases/fish/fish_categories.js",
  "src/config/databases/fish_db.js",
  "src/config/databases/map_db.js",
  "src/config/physics/environment_physics_config.js",
  "src/config/physics/retrieve_physics_config.js",
  "src/config/physics/fight_physics_config.js",
  "src/config/physics/tackle_physics_config.js",
  "src/config/physics/tension_physics_config.js",
  "src/config/physics/physics_formula_map.js",
  "src/config/physics/physics_units_and_naming.js",
  "src/config/physics/physics_config_adapter.js",
  "src/config/physics/physics_config.js",
  "src/config/runtime/config_override_store.js",
  "src/config/runtime/resolved_config_provider.js",
  "src/config/runtime/immutable_config.js",
  "src/config/config.js",
  "src/config/validation/config_schema_validator.js",
];

function loadContext() {
  const context = vm.createContext({
    console,
    Math,
    Number,
    Object,
    window: {},
  });

  for (const file of FILES) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }

  return context;
}

function main() {
  const context = loadContext();
  const labelsPath = path.join(ROOT, "src/config/metadata/parameter_labels.json");
  const parameterLabels = JSON.parse(fs.readFileSync(labelsPath, "utf8"));

  context.__PARAMETER_LABELS__ = parameterLabels;

  const result = vm.runInContext(
    `new ConfigSchemaValidator({
      config: CONFIG,
      fishDb: FISH_DB,
      itemDb: ITEM_DB,
      mapDb: MAP_DB,
      parameterLabels: __PARAMETER_LABELS__,
      namingConvention: typeof PHYSICS_UNITS_AND_NAMING !== "undefined"
        ? PHYSICS_UNITS_AND_NAMING
        : null,
    }).validate()`,
    context,
  );

  if (result.errors.length > 0) {
    console.error(`Config validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) {
      console.error(`- ${error.path}: ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.warn(`Config validation warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.warn(`- ${warning.path}: ${warning.message}`);
    }
  }

  if (result.ok && result.warnings.length === 0) {
    console.log("Config validation passed with 0 errors and 0 warnings.");
    console.log(
      `Summary: ${result.summary.fishCount} fish, ${result.summary.itemCount} items, ` +
        `${result.summary.mapCount} maps, ${result.summary.physicsLeaves} physics leaves.`,
    );
    return;
  }

  process.exitCode = 1;
}

main();
