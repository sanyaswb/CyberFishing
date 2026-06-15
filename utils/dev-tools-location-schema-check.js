const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILE = "src/debug/services/location_dev_tools_schema.js";
const DEV_TOOLS_FILE = "src/debug/dev_tools.js";
const context = vm.createContext({ Object });

vm.runInContext(
  fs.readFileSync(path.join(ROOT, FILE), "utf8"),
  context,
  { filename: FILE },
);

const groups = vm.runInContext(
  "new LocationDevToolsSchema().getGroups()",
  context,
);
const keys = groups.flatMap((group) => Array.from(group.keys));
const required = [
  "debugVisuals",
  "debugZones",
  "debugGrid",
  "debugDepthText",
  "enableCastable",
  "enableCollisions",
  "enableSnags",
  "enableDynamicZones",
  "showChumZones",
  "showCatchZone",
  "showLastDashZone",
  "showNetZone",
  "showAimingZone",
  "showPoleFightSector",
  "showFightLineRadius",
];

for (const key of required) {
  if (!keys.includes(key)) {
    throw new Error(`Missing CONFIG.locations DevTools toggle: ${key}`);
  }
}
if (keys.includes("map")) {
  throw new Error("Location DevTools shortcut must not duplicate CONFIG.locations.map");
}
if (new Set(keys).size !== keys.length) {
  throw new Error("Location DevTools schema contains duplicate toggle keys");
}

const devToolsSource = fs.readFileSync(
  path.join(ROOT, DEV_TOOLS_FILE),
  "utf8",
);
if (!devToolsSource.includes("this.#renderLocationDebugSection(debugContent);")) {
  throw new Error("Location controls must be nested inside the Debug section");
}

console.log(
  `dev-tools-location-schema-check passed: ${keys.length} location toggles`,
);
