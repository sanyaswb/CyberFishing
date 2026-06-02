const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/config/databases/fish/presets/fish_profile_factory.js",
  "src/config/databases/fish/presets/fish_profile_presets.js",
  "src/config/databases/fish/species/peaceful_fish.js",
  "src/config/databases/fish/species/predator_fish.js",
  "src/config/databases/fish/species/rare_fish.js",
  "src/config/databases/fish/species/event_fish.js",
  "src/config/databases/fish/fish_categories.js",
  "src/config/databases/fish_db.js",
];

const context = vm.createContext({ console, Object, Array });
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
  const ids = FISH_DB.map((fish) => fish.id);
  const categoryIds = Object.values(FISH_CATEGORIES).flat().map((fish) => fish.id);
  const preset = FISH_PROFILE_PRESETS.smallPeaceful;
  const before = JSON.stringify(preset);
  const composed = createFishPhysicsProfile(preset, {
    forceProfile: { basePower: 9 },
  });
  return {
    ids,
    categoryIds,
    uniqueCount: new Set(ids).size,
    fishCount: FISH_DB.length,
    categoryCount: Object.keys(FISH_CATEGORIES).length,
    composedBasePower: composed.forceProfile.basePower,
    presetMutated: JSON.stringify(preset) !== before,
  };
})()`, context);

assert(result.fishCount === result.categoryIds.length, "FISH_DB aggregates every category fish");
assert(result.uniqueCount === result.ids.length, "fish ids are unique across categories");
assert(result.categoryCount >= 4, "fish category registry includes scaling placeholders");
assert(result.composedBasePower === 9, "fish profile factory applies overrides");
assert(result.presetMutated === false, "fish profile presets are immutable inputs");
console.log("fish-db-structure-check passed.");
