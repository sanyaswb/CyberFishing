const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { UiSurfaceAdapter } = require("../src/platform/browser/dom/ui_surface_adapter.js");
const { HorizontalScrollController } = require("../src/platform/browser/dom/horizontal_scroll_controller.js");
const { DraggableButton } = require("../src/platform/browser/dom/draggable_button.js");
const { DepthSelector } = require("../src/platform/browser/ui/depth_selector.js");
const { OverlayWindowDragController } = require("../src/dev/overlay/dom/overlay_window_drag_controller.js");
const { GameControls } = require("../src/platform/browser/ui/game_controls.js");
const { InventoryTooltipPresenter } = require("../src/game/presentation/inventory/inventory_tooltip_presenter.js");
const { OverlayMetricInfoBridge } = require("../src/dev/overlay/dom/overlay_metric_info_bridge.js");
const { TestDocument } = require("./testing/keepnet/test_document.js");

function environment(width, height = 600, viewport = false, capabilities = null) {
  const document = new TestDocument();
  const originalCreate = document.createElement.bind(document);
  let frameOrigin = { left: 18, top: 24 };
  document.createElement = tag => {
    const node = originalCreate(tag);
    node.isConnected = true;
    node.scrollHeight = 0;
    node.getBoundingClientRect = () => ({ ...frameOrigin, width, height });
    node.classList.toggle = (name, enabled) => enabled ? node.classList.add(name) : node.classList.remove(name);
    node.setPointerCapture = () => {};
    node.releasePointerCapture = () => {};
    return node;
  };
  const callbacks = new Map();
  const listeners = new Map();
  let sequence = 0;
  let observer;
  const window = {
    innerWidth: width, innerHeight: height,
    requestAnimationFrame(callback) { const id = ++sequence; callbacks.set(id, callback); return id; },
    cancelAnimationFrame(id) { callbacks.delete(id); },
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    getComputedStyle: () => ({ paddingTop: "12px", paddingRight: "6px", paddingBottom: "3px", paddingLeft: "9px" }),
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; observer = this; }
      observe(node) { this.targets.push(node); }
      disconnect() { this.disconnected = true; }
    },
  };
  const mediaQueries = new Map();
  if (capabilities) {
    window.navigator = { maxTouchPoints: capabilities.touchPoints || 0 };
    window.matchMedia = query => {
      const changeListeners = new Set();
      const media = {
        get matches() {
          return query === "(any-pointer: coarse)" ? capabilities.coarse === true :
            width >= 1025 && width > height && capabilities.hover === true && capabilities.fine === true;
        },
        addEventListener(type, listener) { assert.equal(type, "change"); changeListeners.add(listener); },
        removeEventListener(type, listener) { assert.equal(type, "change"); changeListeners.delete(listener); },
        fire() { for (const listener of changeListeners) listener(); },
        changeListeners,
      };
      mediaQueries.set(query, media);
      return media;
    };
  }
  const host = document.createElement("section");
  host.clientWidth = width; host.clientHeight = height;
  document.body.appendChild(host);
  const surface = new UiSurfaceAdapter({ hostElement: host, documentRef: document, windowRef: window, viewport });
  return { document, window, host, surface, callbacks, listeners, mediaQueries, get observer() { return observer; },
    setOrigin(left, top) { frameOrigin = { left, top }; },
    resize(nextWidth, nextHeight = height) {
      width = nextWidth; height = nextHeight;
      host.clientWidth = nextWidth; host.clientHeight = nextHeight;
      window.innerWidth = nextWidth; window.innerHeight = nextHeight;
      return surface.measure();
    },
    flush() { for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(); } },
  };
}

const env = environment(320);
const surface = env.surface;
assert.equal(surface.getMetrics().hoverEnabled, false, "Missing capability APIs must leave hover disabled");
for (const [width, height, profile, expected] of [
  ...[240, 280, 319, 320, 740, 1024].map(width => [width, 600, { hover: true, fine: true }, false]),
  [1025, 600, { hover: true, fine: true }, true],
  [1280, 720, { hover: true, fine: true }, true],
  [1280, 1600, { hover: true, fine: true }, false],
  [1280, 720, { hover: true, fine: true, coarse: true, touchPoints: 1 }, false],
  [1280, 720, { hover: true, fine: true, touchPoints: 5 }, false],
  [1280, 720, { hover: true, fine: true, coarse: true }, false],
  [1280, 720, { hover: false, fine: true }, false],
  [1280, 720, { hover: true, fine: false }, false],
]) {
  const device = environment(width, height, true, profile);
  assert.equal(device.surface.getMetrics().hoverEnabled, expected, `Hover policy at ${width}x${height}, ${JSON.stringify(profile)}`);
  assert.equal(device.surface.mountRoot.parentNode.classList.contains("ui-surface--desktop-hover"), expected);
  device.surface.dispose();
  assert.equal([...device.mediaQueries.values()].reduce((count, media) => count + media.changeListeners.size, 0), 0,
    "Surface disposal must release capability listeners");
}

const hoverProfile = { hover: true, fine: true };
const hoverEnv = environment(1280, 720, true, hoverProfile);
delete hoverEnv.window.navigator.maxTouchPoints;
assert.equal(hoverEnv.surface.measure().hoverEnabled, false, "Unknown touch capability must leave hover disabled");
hoverEnv.window.navigator.maxTouchPoints = 0;
assert.equal(hoverEnv.surface.measure().hoverEnabled, true);
const hoverPresenter = new InventoryTooltipPresenter({ documentRef: hoverEnv.document, uiSurface: hoverEnv.surface,
  getView: () => hoverEnv.window, balanceParameterResolver: { resolve: () => [] } });
const hoverTooltip = hoverEnv.document.byClass("inventory-tooltip")[0];
hoverTooltip.offsetWidth = 80; hoverTooltip.offsetHeight = 120;
const hoverAnchor = hoverEnv.document.createElement("button");
hoverAnchor.getBoundingClientRect = () => ({ left: 100, top: 100, right: 140, bottom: 140, width: 40, height: 40 });
hoverPresenter.bind(hoverAnchor, { instanceId: "hover-policy", name: "Fixture" });
hoverAnchor.fire("mouseenter");
assert.equal(hoverTooltip.style.display, "block", "Desktop inventory retains its hover parameters");
hoverEnv.resize(320);
assert.equal(hoverTooltip.style.display, "none", "A mobile resize dismisses an already open hover hint");
hoverAnchor.fire("mouseenter");
assert.equal(hoverTooltip.style.display, "none", "Synthesized mouseenter on mobile must not show a hint");
hoverEnv.resize(1280);
hoverAnchor.fire("mouseenter");
assert.equal(hoverTooltip.style.display, "block");
hoverProfile.coarse = true;
for (let burst = 0; burst < 100; burst++) for (const media of hoverEnv.mediaQueries.values()) media.fire();
assert.equal(hoverEnv.callbacks.size, 1, "Capability changes coalesce with surface measurement");
hoverEnv.flush();
assert.equal(hoverTooltip.style.display, "none", "Connecting touch input dismisses an open hover hint");
hoverAnchor.fire("mouseenter");
assert.equal(hoverTooltip.style.display, "none", "Hybrid devices must not restore mouse hover");
hoverProfile.coarse = false;
for (const media of hoverEnv.mediaQueries.values()) media.fire();
hoverEnv.flush();
hoverEnv.resize(1280, 1600);
hoverAnchor.fire("mouseenter");
assert.equal(hoverTooltip.style.display, "none", "Portrait must not restore mouse hover");
hoverEnv.resize(1280, 720);
hoverAnchor.fire("mouseenter");
assert.equal(hoverTooltip.style.display, "block", "Returning to desktop landscape restores hover");

const metricContent = hoverEnv.document.createElement("div");
const metricLabel = hoverEnv.document.createElement("span");
metricLabel.dataset.metric = "Fixture";
metricLabel.closest = selector => selector === ".debug-overlay__metric-label" ? metricLabel :
  selector === ".ui-surface--desktop-hover" && hoverEnv.surface.getMetrics().hoverEnabled ? hoverEnv.surface.mountRoot.parentNode : null;
hoverEnv.document.querySelector = () => metricContent;
let metricReads = 0;
const bridge = new OverlayMetricInfoBridge({ documentTarget: hoverEnv.document,
  catalog: { getEntry: () => { metricReads++; return { description: "Accessible help" }; } }, inspector: {} });
bridge.start();
metricContent.fire("pointerover", { target: metricLabel, pointerType: "touch" });
assert.equal(metricReads, 0, "Touch pointer events must not build DEV hover help");
metricContent.fire("pointerover", { target: metricLabel, pointerType: "mouse" });
assert.equal(metricReads, 1, "Desktop mouse retains DEV hover help");
hoverEnv.resize(320);
metricContent.fire("pointerover", { target: metricLabel, pointerType: "mouse" });
assert.equal(metricReads, 1, "Mobile layout suppresses DEV hover help even with a mouse");
metricContent.fire("focusin", { target: metricLabel });
assert.equal(metricReads, 2, "Keyboard focus retains accessible help");
assert.match(metricLabel.title, /Accessible help/);
bridge.dispose();
assert.equal([...metricContent.listeners.values()].reduce((count, listeners) => count + listeners.size, 0), 0);
hoverPresenter.dispose();
hoverEnv.surface.requestMeasure();
hoverEnv.surface.dispose();
assert.equal(hoverEnv.callbacks.size, 0, "Disposal cancels the queued capability measurement");
assert.equal([...hoverEnv.mediaQueries.values()].reduce((count, media) => count + media.changeListeners.size, 0), 0);
// ResizeObserver feedback must settle after the resize, without invalidating every card again.
const stationary = environment(320, 600, true);
let styleWrites = 0;
let classWrites = 0;
for (const node of [stationary.host.children[0], stationary.surface.mountRoot.parentNode]) {
  const setProperty = node.style.setProperty;
  node.style.setProperty = (name, value) => { styleWrites++; setProperty(name, value); };
}
const stationaryRoot = stationary.surface.mountRoot.parentNode;
for (const method of ["add", "remove", "toggle"]) {
  const apply = stationaryRoot.classList[method];
  stationaryRoot.classList[method] = (...args) => { classWrites++; return apply(...args); };
}
for (let delivery = 0; delivery < 120; delivery++) {
  stationary.observer.callback();
  stationary.flush();
}
assert.equal(styleWrites, 0, "unchanged surface measurements must not rewrite inherited layout properties");
assert.equal(classWrites, 0, "unchanged surface measurements must not rewrite state classes");
assert.equal(stationary.callbacks.size, 0, "resize feedback must leave no continuously scheduled work");
assert(!stationary.observer.targets.includes(stationary.surface.mountRoot),
  "viewport metrics must not observe the content whose layout they change");
for (let event = 0; event < 100; event++) {
  stationary.observer.callback();
  for (const listener of stationary.listeners.get("resize")) listener();
}
assert.equal(stationary.callbacks.size, 1, "observer and window resize bursts share one queued measurement");
stationary.flush();
assert.equal(styleWrites, 0);
const resizeNotifications = [];
stationary.surface.subscribe(metrics => resizeNotifications.push(metrics));
stationary.resize(280);
assert(styleWrites > 0, "an actual width change still updates the single logical UI surface");
const resizedWrites = styleWrites;
for (let delivery = 0; delivery < 120; delivery++) { stationary.observer.callback(); stationary.flush(); }
assert.equal(styleWrites, resizedWrites, "observer feedback after a real resize performs no further CSS writes");
assert.equal(resizeNotifications.length, 1, "subscribers receive the actual resize once");
stationary.resize(0);
const hiddenClassWrites = classWrites;
const hiddenStyleWrites = styleWrites;
const hiddenNotifications = resizeNotifications.length;
for (let delivery = 0; delivery < 120; delivery++) { stationary.observer.callback(); stationary.flush(); }
assert.equal(classWrites, hiddenClassWrites, "unchanged hidden surfaces must not rewrite their unmeasured class");
assert.equal(styleWrites, hiddenStyleWrites);
assert.equal(resizeNotifications.length, hiddenNotifications);
stationary.surface.dispose();
let notifications = 0;
const unsubscribe = surface.subscribe(() => notifications++);
for (const width of [240, 280, 319, 320, 740, 1280, 320]) {
  const metrics = env.resize(width);
  assert.equal(metrics.logicalWidth, Math.max(320, width));
  assert.equal(metrics.scale, Math.min(1, width / 320));
  assert.equal(metrics.logicalHeight, 600 / metrics.scale);
  assert.equal(metrics.safeArea.top, 12 / metrics.scale);
  const physical = surface.logicalToPhysicalPoint({ x: 96, y: 160 });
  const logical = surface.physicalToLogicalPoint(physical);
  assert.ok(Math.abs(logical.x - 96) < 1e-10 && Math.abs(logical.y - 160) < 1e-10);
  const delta = surface.physicalToLogicalDelta(surface.logicalToPhysicalDelta({ x: 40, y: 80 }));
  assert.ok(Math.abs(delta.x - 40) < 1e-10 && Math.abs(delta.y - 80) < 1e-10);
}
assert.equal(surface.mountRoot.parentNode, surface.portalRoot.parentNode, "Portals share the single logical scale root");
assert.equal(surface.mountRoot.parentNode.style.getPropertyValue("--ui-scale"), "1");
env.resize(240);
const valid = surface.getMetrics();
env.resize(0);
assert.equal(surface.getMetrics().valid, false);
assert.equal(surface.getMetrics().scale, valid.scale);
assert.equal(surface.getMetrics().logicalWidth, valid.logicalWidth);
assert.ok(surface.mountRoot.parentNode.className.includes("ui-surface--unmeasured"));
env.resize(240);
assert.equal(surface.getMetrics().valid, true);
env.setOrigin(18, -126);
surface.measure();
assert.deepEqual(surface.physicalToLogicalPoint({ x: 78, y: -6 }), { x: 80, y: 160 }, "Page scroll is represented once by the measured origin");
assert.deepEqual(surface.physicalToLogicalRect({ left: 78, top: -6, width: 60, height: 120 }),
  { left: 80, top: 160, width: 80, height: 160, right: 160, bottom: 320 });
assert.deepEqual(surface.logicalToPhysicalRect({ left: 80, top: 160, width: 80, height: 160 }),
  { left: 78, top: -6, width: 60, height: 120, right: 138, bottom: 114 });
surface.mountRoot.scrollHeight = 1200;
surface.measure();
assert.equal(env.host.children[0].style.getPropertyValue("--ui-physical-height"), "900px", "Overflowing logical content retains its physical scroll footprint");
surface.requestMeasure(); surface.requestMeasure(); env.observer.callback();
assert.equal(env.callbacks.size, 1, "Resize measurements coalesce");
env.flush();
const priorNotifications = notifications;
unsubscribe();
env.resize(280);
assert.equal(notifications, priorNotifications);

const scroller = env.document.createElement("div");
scroller.clientWidth = 200; scroller.scrollWidth = 1000; scroller.scrollLeft = 200;
const horizontal = new HorizontalScrollController({ uiSurface: surface });
horizontal.attach(scroller);
scroller.fire("pointerdown", { clientX: 100, pointerId: 1, button: 0, pointerType: "mouse" });
scroller.fire("pointermove", { clientX: 135, pointerId: 1 });
assert.equal(scroller.scrollLeft, 160, "35 physical px move 40 logical scroll px at 280px");
scroller.fire("pointerup", { pointerId: 1 });
scroller.fire("wheel", { deltaX: 0, deltaY: 35, deltaMode: 0 });
assert.equal(scroller.scrollLeft, 200);
scroller.fire("wheel", { deltaY: 1, deltaMode: 1 });
assert.equal(scroller.scrollLeft, 216, "Line deltas already use logical line height");
horizontal.detach(scroller);
assert.equal([...scroller.listeners.values()].reduce((sum, entries) => sum + entries.size, 0), 0);

// The existing storage key and edge-string format remain unchanged; layout coordinates are logical.
const dragEnv = environment(240, 600, true);
dragEnv.setOrigin(0, 0); dragEnv.surface.measure();
dragEnv.resize(0);
assert.equal(dragEnv.surface.getMetrics().valid, false, "A hidden viewport surface must not use a still-positive window width");
dragEnv.resize(240);
const button = dragEnv.document.createElement("button");
button.id = "surface-button";
button.getBoundingClientRect = () => ({ left: Number.parseFloat(button.style.left || "40") * .75,
  top: Number.parseFloat(button.style.top || "80") * .75,
  width: 36, height: 36, right: Number.parseFloat(button.style.left || "40") * .75 + 36,
  bottom: Number.parseFloat(button.style.top || "80") * .75 + 36 });
dragEnv.surface.mountRoot.appendChild(button);
const saved = new Map();
const originalTimeout = global.setTimeout;
const originalClear = global.clearTimeout;
let held;
global.setTimeout = callback => { held = callback; return 1; };
global.clearTimeout = () => {};
try {
  const draggable = new DraggableButton(button, () => {}, { ui: { draggableButtons: true } },
    { uiSurface: dragEnv.surface, cache: { get: key => saved.get(key), set: (key, value) => saved.set(key, value) }, noTransform: true });
  button.fire("pointerdown", { clientX: 36, clientY: 66, pointerId: 2, pointerType: "mouse", button: 0 });
  held();
  button.fire("pointermove", { clientX: 66, clientY: 96, pointerId: 2 });
  assert.equal(button.style.left, "80px");
  assert.equal(button.style.top, "120px");
  button.fire("pointerup", { clientX: 66, clientY: 96, pointerId: 2 });
  assert.deepEqual(saved.get("drag_pos_surface-button"), { left: "80px", right: "auto", top: "120px", bottom: "auto" });
  draggable.dispose();
} finally { global.setTimeout = originalTimeout; global.clearTimeout = originalClear; }

// Depth uses the physical pointer / physical rect ratio, so it must not apply an inverse scale again.
const depth = new DepthSelector({ documentRef: dragEnv.document, mountNode: dragEnv.surface.mountRoot,
  labels: { depthToggle: "Depth", depthTrack: "Track", depthValue: value => value } });
let selectedDepth;
depth.show(10.1, 1, value => { selectedDepth = value; });
depth.open();
const track = dragEnv.document.byClass("depth-selector__track")[0];
track.getBoundingClientRect = () => ({ left: 60, width: 150 });
track.fire("pointerdown", { clientX: 135, pointerId: 3, button: 0 });
assert.equal(selectedDepth, 5.1);
depth.dispose();

for (const width of [240, 280, 319, 320, 820, 1025]) {
  const env = environment(width);
  const selector = new DepthSelector({ documentRef: env.document, mountNode: env.surface.mountRoot,
    uiSurface: env.surface, labels: { depthToggle: "Depth", depthTrack: "Track", depthValue: value => value } });
  let value, reads = 0;
  selector.show(10.1, 1, next => { value = next; }); selector.open();
  const rail = env.document.byClass("depth-selector__track")[0];
  const scale = env.surface.getMetrics().scale;
  rail.getBoundingClientRect = () => { reads++; return { left: 60 * scale, width: 150 * scale }; };
  let capture = null;
  rail.setPointerCapture = id => { capture = id; };
  rail.hasPointerCapture = id => capture === id;
  rail.releasePointerCapture = () => { capture = null; };
  rail.fire("pointerdown", { clientX: 135 * scale, pointerId: 3, button: 0 });
  assert.equal(value, 5.1, "horizontal physical ratios apply the surface scale once");
  for (let i = 0; i < 120; i++) rail.fire("pointermove", { clientX: 135 * scale, pointerId: 3 });
  assert.equal(reads, 1, "depth drag caches its physical track bounds");
  rail.fire("pointerdown", { clientX: 60 * scale, pointerId: 4, button: 0 });
  assert.equal(capture, 3, "a second pointer never steals the depth drag");
  selector.close(); assert.equal(capture, null);
  assert.equal(env.document.byClass("depth-selector__panel")[0].hidden, true);
  selector.dispose(); env.surface.dispose();
}

const overlay = dragEnv.document.createElement("div");
overlay.getBoundingClientRect = () => {
  const left = Number.parseFloat(overlay.style.left || "10") * .75;
  const top = Number.parseFloat(overlay.style.top || "80") * .75;
  return { left, top, width: 120, height: 90, right: left + 120, bottom: top + 90 };
};
let overlayHold;
dragEnv.window.setTimeout = callback => { overlayHold = callback; return 1; };
dragEnv.window.clearTimeout = () => {};
const overlayPositions = new Map();
const overlayDrag = new OverlayWindowDragController({ element: overlay, uiSurface: dragEnv.surface,
  windowTarget: dragEnv.window, config: { ui: { draggableButtons: true } },
  cache: { get: key => overlayPositions.get(key), set: (key, value) => overlayPositions.set(key, value) } });
overlayDrag.attach();
const shieldListeners = [...overlay.listeners.values()].reduce((sum, entries) => sum + entries.size, 0) - 1;
overlay.fire("pointerdown", { clientX: 15, clientY: 75, pointerId: 4, pointerType: "mouse", button: 0 });
overlayHold();
overlay.fire("pointermove", { clientX: 45, clientY: 105, pointerId: 4 });
assert.equal(overlay.style.left, "50px", "Overlay drag converts physical deltas once while preserving its independent visual zoom");
assert.equal(overlay.style.top, "120px");
overlay.fire("pointerup", { pointerId: 4 });
assert.deepEqual(overlayPositions.get("drag_pos_debug_overlay"), { left: "50px", top: "120px", right: "auto", bottom: "auto" });
overlayDrag.detach();
assert.equal([...overlay.listeners.values()].reduce((sum, entries) => sum + entries.size, 0), shieldListeners);
const originalDocument = global.document;
global.document = dragEnv.document;
dragEnv.document.documentElement = {};
dragEnv.document.body.classList.toggle = (name, enabled) => enabled ? dragEnv.document.body.classList.add(name) : dragEnv.document.body.classList.remove(name);
try {
  const controls = new GameControls({}, null, { mountNode: dragEnv.surface.mountRoot,
    documentRef: dragEnv.document, frameScheduler: dragEnv.window,
    labels: { fullscreen: "Fullscreen", landingNet: "Net", continueAfterOutcome: "Continue" } });
  controls.setOutcomeOverlayActive(true);
  assert.equal(dragEnv.surface.mountRoot.inert, true);
  assert.ok(dragEnv.document.body.className.includes("game-shell--outcome-active"));
  assert.notEqual(dragEnv.surface.portalRoot.inert, true, "DEV portal branch retains interaction above the outcome Canvas");
  controls.setOutcomeOverlayActive(false);
  assert.equal(dragEnv.surface.mountRoot.inert, false);
  controls.updateNetButtonState(true, true);
  assert.equal(dragEnv.callbacks.size, 1);
  controls.dispose();
  assert.equal(dragEnv.callbacks.size, 0, "Game control disposal cancels the entrance frame");
} finally { global.document = originalDocument; }

const tooltipPresenter = new InventoryTooltipPresenter({ documentRef: dragEnv.document,
  uiSurface: dragEnv.surface, getView: () => dragEnv.window, balanceParameterResolver: { resolve: () => [] } });
const tooltip = dragEnv.document.byClass("inventory-tooltip")[0];
tooltip.offsetWidth = 80; tooltip.offsetHeight = 120; tooltip.clientHeight = 100; tooltip.scrollHeight = 400;
const anchor = dragEnv.document.createElement("button");
anchor.getBoundingClientRect = () => ({ left: 225, right: 245, top: 585, width: 20, height: 20 });
const tooltipItem = { instanceId: "fixture-tooltip", name: "Fixture" };
tooltipPresenter.bind(anchor, tooltipItem);
tooltipPresenter.show(anchor, tooltipItem);
assert.equal(tooltip.parentNode, dragEnv.surface.portalRoot);
assert.equal(tooltip.style.left, "210px");
assert.equal(tooltip.style.top, "668px");
anchor.fire("wheel", { deltaY: 30, deltaMode: 0 });
assert.equal(tooltip.scrollTop, 40, "Tooltip scrolling converts physical pixel deltas exactly once");
tooltipPresenter.dispose();
assert.equal(tooltip.parentNode, null);
dragEnv.surface.dispose();

surface.requestMeasure();
surface.dispose(); surface.dispose();
assert.equal(env.callbacks.size, 0);
assert.equal(env.observer.disconnected, true);
assert.equal([...env.listeners.values()].reduce((sum, entries) => sum + entries.size, 0), 0);
assert.equal(env.host.children.length, 0);
const css = fs.readFileSync(path.join(__dirname, "../src/game/presentation/styles/ui-surface.css"), "utf8");
assert.equal((css.match(/transform:\s*scale\(/g) || []).length, 1);
assert.ok(!/overflow:\s*hidden/.test(css), "The surface must not clip scrollable content");
console.log("UI surface check passed (240/280/319/320/740/1024/1025/1280, portrait/touch/hybrid hover policy, safe area, pointer/rect/delta, portal/scroll, drag-save, depth, lifecycle).");
