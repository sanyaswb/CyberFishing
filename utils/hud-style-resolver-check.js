const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/config/runtime/config_override_store.js",
  "src/config/runtime/resolved_config_provider.js",
  "src/config/runtime/immutable_config.js",
  "src/config/config.js",
  "src/ui/styles/hud_style_resolver.js",
];

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

vm.runInContext(`
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

const resolver = new HudStyleResolver({
  hudStylesProvider: () => ({
    bars: {
      shared: {
        backgroundColor: "#111111",
        labelColor: "#aaaaaa",
        padding: 2,
      },
      tension: {
        height: 18,
        labelColor: "#bbbbbb",
      },
    },
  }),
});

const style = resolver.resolveBarStyle("tension", {
  overrides: {
    width: 300,
    glowIntensity: 0.5,
  },
});

assert(style.backgroundColor === "#111111", "component style inherits shared defaults");
assert(style.width === 300, "per-call width override is applied");
assert(style.height === 18, "component style provides its own height");
assert(style.labelColor === "#bbbbbb", "component label color overrides shared label color");
assert(style.glowIntensity === 0.5, "per-call overrides have highest priority");

console.log("HUD style resolver check passed:");
for (const message of checks) console.log("- " + message);
`, context);
