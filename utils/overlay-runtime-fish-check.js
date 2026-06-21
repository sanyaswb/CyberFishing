const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  CONFIG: {},
  window: {},
});

for (const relativePath of [
  "src/debug/overlay/services/overlay_html_builder.js",
  "src/debug/overlay/core/overlay_module_base.js",
  "src/debug/overlay/modules/fish_states_overlay_module.js",
  "src/debug/overlay/services/worst_case_force_debug_selector.js",
]) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

const data = {
  gameState: "playing",
  fishPassiveKg: 0.01,
  hookedFish: {
    physics: {
      behaviorProfile: {
        behaviors: {
          stale: {
            forceMultiplier: 9,
            speedMultiplier: 9,
          },
        },
      },
    },
  },
  fishRuntimeBehaviorStates: {
    idle: {
      forceMultiplier: 0,
      speedMultiplier: 0,
    },
    swim: {
      forceMultiplier: 1.5,
      speedMultiplier: 0.75,
    },
  },
};

const fishStatesModule = new context.window.FishStatesModule();
const html = fishStatesModule.render(data);

assertIncludes(html, "0.025 кг", "runtime total force");
assertExcludes(html, "активна:", "state module hides active force detail");
assertExcludes(html, "0.015 кг", "state module hides active force value");
assertIncludes(html, "x1.50", "runtime force multiplier");
assertIncludes(html, "x0.00", "zero multiplier");
assertExcludes(html, "x9.00", "stale hooked-fish multiplier");

const selector = new context.window.WorstCaseForceDebugSelector({
  configSource: () => ({}),
});
const selected = selector.select(data);

assertNear(selected.maxPossibleForceY, 0.015, "runtime worst-case force");

console.log("Overlay runtime fish checks passed.");

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label}: expected output to include "${expected}"`);
  }
}

function assertExcludes(value, expected, label) {
  if (value.includes(expected)) {
    throw new Error(`${label}: output unexpectedly includes "${expected}"`);
  }
}

function assertNear(actual, expected, label, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}
