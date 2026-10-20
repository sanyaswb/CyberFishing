const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const { TestDocument } = require("../../testing/keepnet/test_document");

const runtime = new SourceRuntime();
const { HorizontalScrollController } = runtime.importModule("src/platform/browser/dom/horizontal_scroll_controller.js");
const documentRef = new TestDocument();
const scene = documentRef.createElement("div");
scene.clientWidth = 320; scene.scrollWidth = 1000; scene.scrollLeft = 340;
scene.setPointerCapture = id => scene.captured = id;
scene.hasPointerCapture = id => scene.captured === id;
scene.releasePointerCapture = () => scene.captured = null;
const config = { inverted: true, sensitivity: 1, maxDistancePx: 0, wheelStepPx: 40 };
let scale = 1;
const controller = new HorizontalScrollController({ dragThresholdPx: 10, manualTouch: true,
  getPanConfig: () => config, uiSurface: { physicalToLogicalDelta: ({ x }) => ({ x: x / scale }) } });
const detach = controller.attach(scene);
assert.equal(scene.fire("dragstart").prevented, true, "native image dragging must not steal a scene gesture");
const pointer = (type, fields = {}) => scene.fire(type, { type, pointerId: 1, pointerType: "touch", button: 0, clientX: 200, clientY: 100, ...fields });
pointer("pointerdown");
pointer("pointermove", { clientX: 100 });
assert.equal(scene.scrollLeft, 440, "a finger drag must reveal the cropped room interior");
pointer("pointerup", { clientX: 80 });
assert.equal(scene.scrollLeft, 460, "the final pointer position is included");
assert.equal(scene.captured, null);
assert.equal(scene.fire("click").prevented, true, "a drag is not an interior click");

pointer("pointerdown"); pointer("pointermove", { clientX: 205 }); pointer("pointerup", { clientX: 205 });
assert.equal(scene.fire("click").prevented, false, "stationary clicks remain available");
const before = scene.scrollLeft;
pointer("pointerdown"); pointer("pointermove", { clientX: 20, pointerId: 2 }); pointer("pointerup", { pointerId: 2 });
assert.equal(scene.scrollLeft, before, "another finger cannot move the active gesture");
pointer("pointercancel");

for (scale of [1, .875, .75]) {
  scene.scrollLeft = 340;
  pointer("pointerdown", { pointerType: "mouse" });
  pointer("pointermove", { pointerType: "mouse", clientX: 200 - 60 * scale });
  assert.equal(scene.scrollLeft, 400, "scene pointer deltas are converted from physical to logical units once");
  pointer("pointerup", { pointerType: "mouse", clientX: 200 - 60 * scale });
}
scale = 1;
config.inverted = false; config.sensitivity = 2; config.maxDistancePx = 50;
scene.scrollLeft = 340;
pointer("pointerdown"); pointer("pointermove", { clientX: 100 });
assert.equal(scene.scrollLeft, 290, "house navigation uses the shared inversion, sensitivity and distance settings");
pointer("pointerup", { clientX: 100 });
scene.fire("wheel", { deltaX: 0, deltaY: 2, deltaMode: 1 });
assert.equal(scene.scrollLeft, 130, "wheel line distance matches the map configuration");
assert.equal(scene.fire("wheel", { deltaY: 100, ctrlKey: true }).prevented, false, "browser zoom is preserved");
pointer("pointerdown"); pointer("pointermove", { clientX: 100 });
detach();
assert.equal(scene.captured, null, "disposing an active drag releases capture");
assert.equal([...scene.listeners.values()].reduce((count, entries) => count + entries.size, 0), 0);

const directions = [];
let wheelTime = 1000;
scene.clientWidth = scene.scrollWidth = 1000; scene.scrollLeft = 0;
const zoneController = new HorizontalScrollController({ manualTouch: true, dragThresholdPx: 10,
  getPanConfig: () => config, onVerticalGesture: direction => directions.push(direction),
  nowMs: () => wheelTime, wheelGestureGapMs: 180 });
const detachZones = zoneController.attach(scene);
scene.fire("wheel", { deltaY: 40, deltaX: 0 });
scene.fire("wheel", { deltaY: -40, deltaX: 0 });
assert.deepEqual(directions, [40, -40], "vertical wheel gestures route to zones even when the entire room fits");
for (let event = 0; event < 12; event++) { wheelTime += 15; scene.fire("wheel", { deltaY: -30, deltaX: 0 }); }
assert.deepEqual(directions, [40, -40], "one wheel burst cannot close one zone and open another");
wheelTime += 181; scene.fire("wheel", { deltaY: -1, deltaX: 0, deltaMode: 1 });
assert.deepEqual(directions, [40, -40, -1], "a fresh wheel gesture also works with line-mode mice");
scene.clientWidth = 320; scene.scrollWidth = 1000; scene.scrollLeft = 340;
scene.fire("wheel", { deltaX: 100, deltaY: 0 });
assert.equal(scene.scrollLeft, 340, "House wheel gestures never pan horizontally");
pointer("pointerdown"); pointer("pointermove", { clientY: 150 }); pointer("pointermove", { clientY: 180 });
pointer("pointerup", { clientY: 180 });
assert.deepEqual(directions, [40, -40, -1, 50], "a vertical drag opens one zone once and never pans the interior");
assert.equal(scene.scrollLeft, 340);
assert.equal(scene.fire("click", { detail: 0 }).prevented, false, "keyboard activation of miniature controls remains available after a swipe");
assert.equal(scene.fire("click", { detail: 1 }).prevented, true);
detachZones();

const { SheetDismissController } = runtime.importModule("src/platform/browser/dom/sheet_dismiss_controller.js");
const handle = documentRef.createElement("button");
handle.setPointerCapture = id => handle.captured = id;
handle.hasPointerCapture = id => handle.captured === id;
handle.releasePointerCapture = () => handle.captured = null;
let dismissals = 0;
const progress = [];
const dismissController = new SheetDismissController({ uiSurface: { physicalToLogicalDelta: ({ y }) => ({ y: y / .75 }) } });
const detachHandle = dismissController.attach(handle, { onDismiss: () => dismissals++, onDrag: distance => progress.push(distance) });
const sheetPointer = (type, fields = {}) => handle.fire(type, { type, pointerId: 4, clientX: 40, clientY: 100, button: 0, ...fields });
sheetPointer("pointerdown"); sheetPointer("pointermove", { clientY: 118 }); sheetPointer("pointerup", { clientY: 118 });
assert.equal(dismissals, 1, "a scaled downward swipe meets the logical dismissal distance");
assert(progress.includes(24) && progress.at(-1) === 0);
handle.fire("click", { detail: 1 }); assert.equal(dismissals, 1, "the swipe's following click does not dismiss twice");
handle.fire("click", { detail: 0 }); assert.equal(dismissals, 2, "keyboard activation remains available");
sheetPointer("pointerdown"); sheetPointer("pointermove", { clientY: 150, pointerId: 5 });
sheetPointer("pointercancel"); assert.equal(dismissals, 2);
sheetPointer("pointerdown"); sheetPointer("pointerup"); handle.fire("click", { detail: 1 });
assert.equal(dismissals, 3, "a tap on the trigger closes the sheet");
sheetPointer("pointerdown"); detachHandle();
assert.equal(handle.captured, null);
assert.equal([...handle.listeners.values()].reduce((count, entries) => count + entries.size, 0), 0);

let expansions = 0, taps = 0, collapses = 0;
const detachMenuHandle = dismissController.attach(handle, { onExpand: () => expansions++, onTap: () => taps++, onDismiss: () => collapses++ });
sheetPointer("pointerdown"); sheetPointer("pointerup", { clientY: 82 });
assert.equal(expansions, 1, "an upward swipe on the shared menu handle reveals all button names at the same logical distance");
handle.fire("click", { detail: 1 }); assert.equal(taps, 0, "a swipe's click cannot toggle the menu again");
handle.fire("click", { detail: 0 }); assert.equal(taps, 1, "keyboard activation follows the menu's tap action");
sheetPointer("pointerdown"); sheetPointer("pointermove", { clientY: 40 }); sheetPointer("pointercancel");
assert.equal(expansions, 1, "a cancelled upward drag never expands the menu");
sheetPointer("pointerdown"); sheetPointer("pointerup", { clientY: 118 }); assert.equal(collapses, 1);
detachMenuHandle();
assert.equal([...handle.listeners.values()].reduce((count, entries) => count + entries.size, 0), 0);

const { SheetHeightController } = runtime.importModule("src/platform/browser/dom/sheet_height_controller.js");
const heightPanel = documentRef.createElement("section"), heightContent = documentRef.createElement("div");
heightContent.scrollHeight = 480; heightPanel.appendChild(heightContent);
const heightFrames = new Map(), heightTimers = new Map(); let heightSequence = 0, heightWrites = 0, heightReads = 0, disconnects = 0;
let heightResize, heightSurfaceResize, heightUnsubscribed = 0, physicalScale = .75;
const heightSet = heightPanel.style.setProperty;
heightPanel.style.setProperty = (...args) => { heightWrites++; heightSet(...args); };
heightPanel.getBoundingClientRect = () => ({ height: (Number.parseFloat(heightPanel.style.getPropertyValue("--house-sheet-height")) || 481) * physicalScale });
const heightWindow = {
  requestAnimationFrame(callback) { heightFrames.set(++heightSequence, callback); return heightSequence; },
  cancelAnimationFrame(id) { heightFrames.delete(id); },
  setTimeout(callback) { heightTimers.set(++heightSequence, callback); return heightSequence; }, clearTimeout(id) { heightTimers.delete(id); },
  getComputedStyle() { heightReads++; return { maxHeight: "690px", borderTopWidth: "1px",
    getPropertyValue: name => ["--ui-sheet-handle-size", "--house-dock-collapsed-height"].includes(name) ? "44px" : "0px" }; },
  ResizeObserver: class { constructor(callback) { heightResize = callback; } observe() {} unobserve() {} disconnect() { disconnects++; } },
};
const heightController = new SheetHeightController({ windowTarget: heightWindow, durationMs: 280,
  uiSurface: { physicalToLogicalDelta: ({ y }) => ({ y: y / physicalScale }), subscribe(callback) { heightSurfaceResize = callback; return () => heightUnsubscribed++; } } });
const flushHeights = () => { const pending = [...heightFrames.values()]; heightFrames.clear(); for (const callback of pending) callback(); };
heightController.attach(heightPanel, heightContent); heightController.open(heightPanel);
assert.equal(heightPanel.style.getPropertyValue("--house-sheet-height"), "89px", "opening starts at the existing footer height");
flushHeights(); assert.equal(heightPanel.style.getPropertyValue("--house-sheet-height"), "481px");
for (let resize = 0; resize < 100; resize++) heightResize([{ target: heightContent }]);
assert.equal(heightFrames.size, 1, "sheet content resize is coalesced"); flushHeights();
const unchangedWrites = heightWrites;
for (let frame = 0; frame < 120; frame++) { heightSurfaceResize(); flushHeights(); }
assert.equal(heightWrites, unchangedWrites, "unchanged sheet sizes never rewrite height");
heightController.startDrag(heightPanel);
const cachedReads = heightReads;
for (let distance = 1; distance <= 60; distance++) heightController.drag(heightPanel, distance);
assert.equal(heightReads, cachedReads, "pointer moves use cached geometry rather than layout reads");
assert.equal(heightPanel.style.getPropertyValue("--house-sheet-height"), "421px");
let heightCompleted = 0;
heightController.close(heightPanel, () => heightCompleted++); heightController.settle(heightPanel);
assert.equal(heightPanel.style.getPropertyValue("--house-sheet-height"), "421px", "release never restores the full height before closing");
flushHeights(); assert.equal(heightPanel.style.getPropertyValue("--house-sheet-height"), "89px", "collapse ends at the compact footer rather than outside the viewport");
for (const callback of [...heightTimers.values()]) callback(); heightTimers.clear(); assert.equal(heightCompleted, 1);
heightController.open(heightPanel); flushHeights(); heightController.startDrag(heightPanel); heightController.settle(heightPanel);
assert.equal(heightPanel.style.getPropertyValue("--house-sheet-height"), "481px", "an upward drag settles without restarting an entrance animation");
heightContent.scrollHeight = 900; heightResize([{ target: heightContent }]); flushHeights();
assert.equal(heightPanel.style.getPropertyValue("--house-sheet-height"), "690px", "growing content respects the sheet viewport limit");
heightController.close(heightPanel, () => heightCompleted++); heightController.dispose(); heightController.dispose();
assert.equal(heightFrames.size, 0); assert.equal(heightTimers.size, 0); assert.equal(disconnects, 1); assert.equal(heightUnsubscribed, 1);

const { HudRowSizer } = runtime.importModule("src/platform/browser/dom/hud_row_sizer.js");
const row = documentRef.createElement("div"); row.clientWidth = 296;
const tokens = { "--ui-clock-width": "116px", "--house-play-width": "90px", "--ui-hud-control-size": "44px",
  "--house-leading-width": "44px", "--ui-toolbar-gap": "8px" };
let observerCallback, surfaceCallback, disconnected = 0, unsubscribed = 0, writes = 0;
const callbacks = new Map(); let frameId = 0;
const sizingWindow = {
  requestAnimationFrame(callback) { callbacks.set(++frameId, callback); return frameId; },
  cancelAnimationFrame(id) { callbacks.delete(id); },
  getComputedStyle: () => ({ getPropertyValue: name => tokens[name] }),
  MutationObserver: class { constructor(callback) { observerCallback = callback; } observe() {} disconnect() { disconnected++; } },
};
const setProperty = row.style.setProperty;
row.style.setProperty = (...args) => { writes++; setProperty(...args); };
const sizer = new HudRowSizer({ row, windowTarget: sizingWindow, uiSurface: { mountRoot: { parentNode: {} },
  subscribe(callback) { surfaceCallback = callback; return () => unsubscribed++; } } });
const flushSize = () => { const pending = [...callbacks.values()]; callbacks.clear(); for (const callback of pending) callback(); };
for (let event = 0; event < 100; event++) surfaceCallback();
assert.equal(callbacks.size, 1, "resize work is coalesced into one pending measurement");
flushSize();
assert.equal(Number(row.style.getPropertyValue("--ui-hud-scale")), 296 / 318);
tokens["--ui-clock-width"] = "196px"; observerCallback(); flushSize();
assert.equal(Number(row.style.getPropertyValue("--ui-hud-scale")), 296 / 398, "all controls fit one row with accelerated DEV time");
const previousWrites = writes;
for (let event = 0; event < 120; event++) { observerCallback(); flushSize(); }
assert.equal(writes, previousWrites, "unchanged readings do not rewrite layout");
surfaceCallback(); sizer.dispose(); sizer.dispose();
assert.equal(callbacks.size, 0); assert.equal(disconnected, 1); assert.equal(unsubscribed, 1);

const { FullscreenControl } = runtime.importModule("src/platform/browser/ui/fullscreen_control.js");
let requests = 0;
documentRef.documentElement = { requestFullscreen: async () => requests++ };
const mount = documentRef.createElement("header"); documentRef.body.append(mount);
const fullscreen = new FullscreenControl({ documentRef, mountNode: mount, label: "Fullscreen" });
assert.equal(fullscreen.button.className, "hud-control hud-control--square game-control game-control--fullscreen");
fullscreen.button.click();
assert.equal(requests, 1);
assert.equal(fullscreen.button.fire("pointerdown").stopped, true);
documentRef.fullscreenElement = {};
documentRef.fire("fullscreenchange");
assert.equal(fullscreen.button.disabled, true, "house and game share fullscreen lifecycle behavior");
assert.equal(fullscreen.button.classList.contains("game-control--fullscreen-hidden"), true);
documentRef.fullscreenElement = null; documentRef.fire("fullscreenchange");
assert.equal(fullscreen.button.disabled, false);
fullscreen.dispose(); fullscreen.dispose();
assert.equal(documentRef.listeners.get("fullscreenchange").size, 0);

const { GameToolbar } = runtime.importModule("src/platform/browser/ui/game_toolbar.js");
const { GameControls } = runtime.importModule("src/platform/browser/ui/game_controls.js");
const badge = documentRef.createElement("div"); badge.className = "game-version-badge";
badge.textContent = "v0.34.4 prototype"; documentRef.body.appendChild(badge);
const toolbar = new GameToolbar({ documentRef, mountNode: mount, versionBadge: badge });
const gameControls = new GameControls({}, null, { documentRef, mountNode: mount, toolbarMountNode: toolbar.element,
  labels: { landingNet: "Net", continueAfterOutcome: "Continue" } });
assert.equal(badge.parentNode, toolbar.depthMountNode, "badge shares the free left slot without moving actions on float expansion");
assert.equal(documentRef.byClass("game-control--net")[0].parentNode, toolbar.element, "toolbar actions use the shared row");
assert.equal(documentRef.byClass("game-control--continue")[0].parentNode, mount, "outcome controls keep their separate screen placement");
gameControls.dispose(); toolbar.dispose(); toolbar.dispose();
assert.equal(badge.parentNode, documentRef.body, "disposal restores the version badge and removes the toolbar");
assert.equal(documentRef.byClass("game-toolbar").length, 0);

console.log("House navigation passed: scene/zones, touch/mouse/wheel, inversion/distance, scaled tap/swipe handles, HUD lifecycle and bounded resize/disposal.");
