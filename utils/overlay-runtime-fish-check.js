const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  CONFIG: {
    physics: {
      fight: {
        directionForce: {
          towardPlayerMultiplier: 0,
          sideMultiplier: 1,
          awayMultiplier: 2.5,
        },
      },
    },
  },
  window: {},
});

for (const relativePath of [
  "src/debug/overlay/services/overlay_view_state_store.js",
  "src/debug/overlay/services/overlay_html_builder.js",
  "src/debug/overlay/services/overlay_value_formatter.js",
  "src/debug/overlay/dom/overlay_interaction_bridge.js",
  "src/debug/overlay/core/overlay_module_base.js",
  "src/debug/overlay/modules/fish_balance/fish_live_force_summary_section.js",
  "src/debug/overlay/modules/fish_balance/fish_state_force_preview_section.js",
  "src/debug/overlay/modules/fish_balance_overlay_module.js",
  "src/debug/overlay/services/worst_case_force_debug_selector.js",
]) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

const data = {
  gameState: "playing",
  fishPassiveKg: 0.01,
  fishActiveKg: 0.038,
  fishOppositionKg: 0.048,
  fishBaseForceCurrentKg: 0.01,
  fishBaseForceWithoutPowerDebuffKg: 0.012,
  fishBaseForcePowerLossKg: 0.002,
  fishCurrentStateMaxForceKg: 0.048,
  fishStateMaxForceWithoutPowerDebuffKg: 0.06,
  fishStateMaxForcePowerLossKg: 0.012,
  fishRuntimeForceMultiplier: 1.1,
  fishStateTargetForceMultiplier: 1.9,
  fishPowerRatio: 0.833333,
  fishOppositionWithoutExhaustionKg: 0.06,
  fishOppositionExhaustionLossKg: 0.012,
  directionResistanceMultiplier: 2,
  fishDirectionState: "toward_player",
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
      weight: 25,
    },
    swim: {
      forceMultiplier: 1.5,
      speedMultiplier: 0.75,
      weight: 25,
    },
  },
};

const viewStateStore = new context.window.OverlayViewStateStore();
const fishBalanceModule = new context.window.FishBalanceModule({
  viewStateStore,
  configSource: () => context.CONFIG,
});

assertEquals(
  viewStateStore.get("fishStatesDirectionMode"),
  "away",
  "FishStates direction mode defaults to away preview",
);

let html = fishBalanceModule.render(data);
assertIncludes(html, "FISH BALANCE", "FishBalance module renders title");
assertIncludes(html, "ПОТОЧНА СИЛА", "FishBalance renders live force summary");
assertIncludes(html, "(-0.002 кг)", "FishBalance renders base force loss inline");
assertIncludes(html, "(-0.012 кг)", "FishBalance renders multiplied force loss inline");
assertExcludes(html, "Виснаження", "FishBalance no longer renders separate exhaustion row");
assertIncludes(html, "STATE FORCE PREVIEW", "FishBalance renders state force preview");
assertExcludes(html, "Current", "state force preview does not render current direction button");
assertIncludes(html, 'data-overlay-control="fish-state-direction"', 'tab controls are rendered');
assertExcludes(html, 'data-overlay-value="actual"', 'actual tab value is not rendered');
assertIncludes(html, "debug-overlay-tab--active", "active tab class is rendered");
assertIncludes(html, "0.048 кг", "default away mode uses away direction multiplier");
assertExcludes(html, "active <span", "active force detail is hidden by default");
assertExcludes(html, "force <span", "force multiplier detail is hidden by default");
assertExcludes(html, "weight <span", "weight detail is hidden by default");
viewStateStore.set("fishStateForceDetails", { active: true, force: true, speed: true, weight: true });
html = fishBalanceModule.render(data);
assertIncludes(html, "active <span", "FishBalance shows active force detail when enabled");
assertIncludes(html, "x1.50", "runtime force multiplier is rendered when enabled");
assertIncludes(html, "weight <span", "runtime behavior weight is rendered when enabled");
assertExcludes(html, "x9.00", "stale hooked-fish multiplier is ignored");

viewStateStore.set("fishStatesDirectionMode", "away");
html = fishBalanceModule.render(data);
assertIncludes(html, "Away", "away mode label");
assertIncludes(html, "x2.50", "away mode uses away multiplier");
assertIncludes(html, "0.048 кг", "away mode force preview");

viewStateStore.set("fishStatesDirectionMode", "side");
html = fishBalanceModule.render(data);
assertIncludes(html, "Side", "side mode label");
assertIncludes(html, "x1.00", "side mode uses side multiplier");
assertIncludes(html, "0.025 кг", "side mode force preview");

viewStateStore.set("fishStatesDirectionMode", "toward");
html = fishBalanceModule.render(data);
assertIncludes(html, "Toward", "toward mode label");
assertIncludes(html, "x0.00", "toward mode uses toward multiplier");
assertIncludes(html, "0.010 кг", "toward mode leaves passive force only");
assertExcludes(html, "0.025 кг", "toward mode does not include side active force");

viewStateStore.set("fishStatesDirectionMode", "invalid");
assertEquals(
  viewStateStore.get("fishStatesDirectionMode"),
  "away",
  "invalid tab value normalizes to away",
);

const fakeRoot = createFakeRoot();
const interactionStore = new context.window.OverlayViewStateStore();
const interactionBridge = new context.window.OverlayInteractionBridge({
  rootElement: fakeRoot,
  viewStateStore: interactionStore,
});
interactionBridge.attach();
fakeRoot.dispatch({
  type: "pointerdown",
  target: createFakeControl(fakeRoot, "fish-state-direction", "side"),
});
assertEquals(
  interactionStore.get("fishStatesDirectionMode"),
  "side",
  "direction button activates on pointerdown",
);

const selector = new context.window.WorstCaseForceDebugSelector({
  configSource: () => ({}),
});
const selected = selector.select(data);
assertNear(selected.maxPossibleForceY, 0.015, "runtime worst-case force");

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assertScriptOrder(
  indexHtml,
  "src/debug/overlay/dom/overlay_window_drag_controller.js",
  "src/debug/overlay/dom/overlay_dom_adapter.js",
  "overlay window drag controller loads before overlay dom adapter",
);
assertScriptOrder(
  indexHtml,
  "src/debug/overlay/modules/fish_balance/fish_live_force_summary_section.js",
  "src/debug/overlay/modules/fish_balance_overlay_module.js",
  "live force summary section loads before fish balance module",
);
assertScriptOrder(
  indexHtml,
  "src/debug/overlay/services/overlay_view_state_store.js",
  "src/debug/overlay/overlay_bootstrap.js",
  "view state store loads before overlay bootstrap",
);
assertScriptOrder(
  indexHtml,
  "src/debug/overlay/dom/overlay_interaction_bridge.js",
  "src/debug/overlay/overlay_bootstrap.js",
  "interaction bridge loads before overlay bootstrap",
);

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

function assertEquals(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertNear(actual, expected, label, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertScriptOrder(html, first, second, label) {
  const firstIndex = html.indexOf(first);
  const secondIndex = html.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1 || firstIndex >= secondIndex) {
    throw new Error(`${label}: expected ${first} before ${second}`);
  }
}

function createFakeControl(root, control, value) {
  return {
    getAttribute(name) {
      if (name === "data-overlay-control") return control;
      if (name === "data-overlay-value") return value;
      return null;
    },
    closest(selector) {
      return selector === "[data-overlay-control]" ? this : null;
    },
    root,
  };
}

function createFakeRoot() {
  const listeners = {};
  return {
    isConnected: true,
    contains(node) {
      return node?.root === this;
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    removeEventListener(type) {
      delete listeners[type];
    },
    dispatch(event) {
      listeners[event.type]?.({
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
        ...event,
      });
    },
  };
}
