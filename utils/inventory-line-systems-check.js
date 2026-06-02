const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/core/casting_distance.js",
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
  "src/config/physics/physics_config_adapter.js",
  "src/config/physics/physics_config.js",
  "src/config/runtime/config_override_store.js",
  "src/config/runtime/resolved_config_provider.js",
  "src/config/runtime/immutable_config.js",
  "src/config/config.js",
  "src/core/line/line_allocation_policy.js",
  "src/core/line/line_inventory_controller.js",
  "src/systems/inventory_system.js",
];

const storage = {};
const context = vm.createContext({
  console,
  Math,
  Number,
  Date,
  crypto: {
    randomUUID: () => `test_${Math.random().toString(16).slice(2)}`,
  },
  localStorage: {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => {
      storage[key] = value;
    },
    removeItem: (key) => {
      delete storage[key];
    },
  },
  document: {
    dispatchEvent() {},
    addEventListener() {},
  },
  CustomEvent: function CustomEvent(type, init) {
    this.type = type;
    this.detail = init?.detail;
  },
});

for (const file of FILES) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

vm.runInContext(`
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

const lineRulesConfig = CONFIG.fightPhysicsConfig.getLineConfig();
const inventory = new InventoryManager(
  ITEM_DB,
  CONFIG.player,
  new InventoryEventBridge(null),
  new CastDistanceCalculator(CONFIG),
  new LineCompatibilityRules(lineRulesConfig),
);

assert(inventory.equipItem("rod", "uuid-rod-float"), "float rod equips");
assert(inventory.equipItem("line", "uuid-line"), "long spool equips to pole rod through split");

let equipment = inventory.getEquipped();
const segmentId = equipment.line.instanceId;
assert(equipment.line.lengthMeters === 6, "pole rod equips only rod length + 1m line segment");
assert(equipment.line.detachedLineSegment, "equipped pole line is marked as a detachable segment");

const sourceSpool = inventory.hydrateInstance("uuid-line");
assert(Math.abs(sourceSpool.lengthMeters - 19) < 0.001, "source spool loses equipped segment length");

inventory.unequipItem("line");
equipment = inventory.getEquipped();
assert(!equipment.line, "line unequips from pole rod");
assert(!inventory.hydrateInstance(segmentId), "temporary line segment is removed after merge");
assert(Math.abs(inventory.hydrateInstance("uuid-line").lengthMeters - 25) < 0.001, "line segment merges back into matching spool");

assert(!inventory.equipItem("leader", "uuid-leader"), "leader cannot equip without main line");
assert(inventory.equipItem("line", "uuid-line-short"), "matching pole line equips through max-length split");
assert(inventory.equipItem("leader", "uuid-leader"), "leader equips after main line");

inventory.breakEquippedLine(1.25);
equipment = inventory.getEquipped();
assert(!equipment.line, "damaged pole line below required length is unequipped by compatibility rules");

CacheManager.remove("player_inventory");
CacheManager.remove("equipped_items");

const reelInventory = new InventoryManager(
  ITEM_DB,
  {
    ...CONFIG.player,
    inventory: [
      { instanceId: "rod-spin", itemId: "rod_test_spin" },
      { instanceId: "reel-20", itemId: "reel_test" },
      { instanceId: "line-25", itemId: "line_test_1" },
    ],
  },
  new InventoryEventBridge(null),
  new CastDistanceCalculator(CONFIG),
  new LineCompatibilityRules(lineRulesConfig),
);

assert(reelInventory.equipItem("rod", "rod-spin"), "reel rod equips for capacity check");
assert(reelInventory.equipItem("reel", "reel-20"), "20m reel equips for capacity check");
assert(reelInventory.equipItem("line", "line-25"), "25m spool can equip on 20m reel through split");

equipment = reelInventory.getEquipped();
assert(Math.abs(equipment.line.lengthMeters - 20) < 0.001, "reel equips line segment capped by reel capacity");
assert(equipment.line.detachedLineSegment, "reel line segment is marked as detachable");
assert(Math.abs(reelInventory.hydrateInstance("line-25").lengthMeters - 5) < 0.001, "reel source spool keeps leftover length");

CacheManager.remove("player_inventory");
CacheManager.remove("equipped_items");

const buildInventory = new InventoryManager(
  ITEM_DB,
  {
    ...CONFIG.player,
    inventory: [
      {
        instanceId: "build-box",
        itemId: "sys_build_box",
        buildId: "build-box",
        buildName: "Saved reel build",
        quantity: 1,
      },
      { instanceId: "build-rod", itemId: "rod_test_spin", buildId: "build-box" },
      { instanceId: "build-reel", itemId: "reel_test", buildId: "build-box" },
      { instanceId: "build-line", itemId: "line_test_1", buildId: "build-box" },
    ],
  },
  new InventoryEventBridge(null),
  new CastDistanceCalculator(CONFIG),
  new LineCompatibilityRules(lineRulesConfig),
);

buildInventory.equipBuild("build-box");
equipment = buildInventory.getEquipped();
assert(Math.abs(equipment.line.lengthMeters - 20) < 0.001, "saved build equips line capped by reel capacity");
assert(equipment.line.buildId === "build-box", "saved build equipped line segment stays associated with the build");
assert(Math.abs(buildInventory.hydrateInstance("build-line").lengthMeters - 5) < 0.001, "saved build source spool keeps leftover length");

console.log("Inventory line systems check passed:");
for (const message of checks) console.log("- " + message);
`, context);
