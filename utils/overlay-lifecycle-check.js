const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  window: {},
});

for (const relativePath of [
  "src/debug/overlay/core/overlay_update_loop.js",
  "src/debug/overlay/core/overlay_controller.js",
]) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

const listeners = {};
const documentTarget = {
  addEventListener(type, handler) {
    listeners[type] = handler;
  },
  removeEventListener(type) {
    delete listeners[type];
  },
  dispatch(type, detail = {}) {
    listeners[type]?.({ detail });
  },
};

let renderedHtml = "";
const calls = [];
const registry = {
  renderActive() {
    return renderedHtml;
  },
};
const domAdapter = {
  init() {
    calls.push("init");
  },
  show() {
    calls.push("show");
  },
  hide() {
    calls.push("hide");
  },
  updateHtml(html) {
    calls.push(`updateHtml:${html}`);
  },
  applyScale() {
    calls.push("applyScale");
  },
};
const updateLoop = {
  start() {
    calls.push("loopStart");
  },
  stop() {
    calls.push("loopStop");
  },
};

const controller = new context.window.OverlayController({
  registry,
  domAdapter,
  documentTarget,
  configSource: () => ({ debug: { overlay: true } }),
  updateLoop,
});

controller.start();
documentTarget.dispatch("debug-live-update", { gameState: "scouting" });
assertExcludes(calls, "show", "debug-live-update must not show an empty overlay window");

controller.update();
assertIncludes(calls, "hide", "empty render hides overlay");

renderedHtml = "<section>ready</section>";
controller.update();
assertIncludes(calls, "updateHtml:<section>ready</section>", "non-empty render updates html");
assertIncludes(calls, "show", "non-empty render shows overlay");
assertExcludes(calls, "applyScale", "overlay controller must not apply scale every update");

const controllerSource = read("src/debug/overlay/core/overlay_controller.js");
const liveUpdateHandler = controllerSource.match(/#onDebugLiveUpdate\s*=\s*\(event\)\s*=>\s*\{[\s\S]*?\n  \};/u)?.[0] || "";
assert(
  !liveUpdateHandler.includes("#domAdapter.show()"),
  "OverlayController debug-live-update handler must not call show()",
);
const updateMethod = controllerSource.match(/\n  update\(\) \{[\s\S]*?\n  \}/u)?.[0] || "";
assert(
  !updateMethod.includes("#domAdapter.applyScale()"),
  "OverlayController.update must not call applyScale() every tick",
);

const domAdapterSource = read("src/debug/overlay/dom/overlay_dom_adapter.js");
assertIncludesText(domAdapterSource, "#clampWhenStable()", "OverlayDomAdapter has stable clamp helper");
assertIncludesText(
  domAdapterSource,
  "#dragController?.isDragging?.()",
  "OverlayDomAdapter skips clamp while dragging",
);
assertIncludesText(
  domAdapterSource,
  'if (this.#container.style.display === "block") return;',
  "OverlayDomAdapter.show clamps only on hidden-to-visible transition",
);

const dragSource = read("src/debug/overlay/dom/overlay_window_drag_controller.js");
assertIncludesText(dragSource, "isDragging()", "OverlayWindowDragController exposes isDragging() contract");
assertIncludesText(dragSource, "if (this.#isDragging) return;", "OverlayWindowDragController refuses viewport clamp during active drag");

const echoSource = read("src/debug/overlay/modules/echo_overlay_module.js");
assertIncludesText(echoSource, "if (!this.shouldRender(d)) return \"\";", "EchoModule render is self-guarded before cast");
assert(
  !echoSource.includes("Закиньте вудку для аналізу"),
  "EchoModule no longer emits a pre-cast placeholder that can create an empty window",
);

console.log("Overlay lifecycle checks passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, label) {
  if (!condition) throw new Error(label);
}

function assertIncludes(array, expected, label) {
  if (!array.includes(expected)) {
    throw new Error(`${label}: expected ${expected}; calls: ${array.join(", ")}`);
  }
}

function assertExcludes(array, expected, label) {
  if (array.includes(expected)) {
    throw new Error(`${label}: unexpected ${expected}; calls: ${array.join(", ")}`);
  }
}

function assertIncludesText(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected source to include ${expected}`);
  }
}
