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
];

const context = vm.createContext({ console, Math, Number, Object, window: {} });
for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`- ${message}`);
}

const result = vm.runInContext(`(function () {
  const path = "physics.water.motionResistance";
  const base = RESOLVED_CONFIG_PROVIDER.getBase(path);
  CONFIG_RUNTIME_CONTEXT.set(path, 3.25);
  const afterSet = CONFIG.physics.water.motionResistance;
  const exported = CONFIG_RUNTIME_CONTEXT.exportOverrides();
  CONFIG_RUNTIME_CONTEXT.reset(path);
  const afterReset = CONFIG.physics.water.motionResistance;
  CONFIG_RUNTIME_CONTEXT.importOverrides(exported);
  const afterImport = CONFIG.physics.water.motionResistance;
  CONFIG_RUNTIME_CONTEXT.resetAll();
  const afterResetAll = CONFIG.physics.water.motionResistance;
  return {
    base,
    afterSet,
    afterReset,
    afterImport,
    afterResetAll,
    baseFrozen: Object.isFrozen(BASE_CONFIG),
    physicsFrozen: Object.isFrozen(BASE_CONFIG.physics),
    hasStore: !!CONFIG_OVERRIDE_STORE,
  };
})()`, context);

assert(result.baseFrozen, "BASE_CONFIG is frozen");
assert(result.physicsFrozen, "BASE_CONFIG is deeply frozen at physics root");
assert(result.hasStore, "CONFIG_OVERRIDE_STORE exists");
assert(result.afterSet === 3.25, "runtime override updates resolved CONFIG value");
assert(result.afterReset === result.base, "reset restores base config value");
assert(result.afterImport === 3.25, "import restores exported override value");
assert(result.afterResetAll === result.base, "resetAll restores base config value");
console.log("config-overrides-check passed.");
