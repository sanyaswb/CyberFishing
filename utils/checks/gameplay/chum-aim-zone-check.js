"use strict";

// G-095: selecting hand chum immediately displays the reachable cast area (dashed line)
// on the water, before any pointer drag starts, and keeps it visible during aim.
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const runtime = new SourceRuntime();
const { CastingRenderFrameBuilder } = runtime.importModule(
  "src/game/presentation/rendering/casting_render_frame_builder.js",
);
const { GameRenderFrame } = runtime.importModule(
  "src/game/presentation/rendering/game_render_frame.js",
);
const { WaterMetric } = runtime.importModule(
  "src/game/domain/locations/water_metric.js",
);

const bounds = { left: 0, right: 320, top: 0, bottom: 600 };
const waterMetric = new WaterMetric({
  pixelsPerMeter: 50,
  shoreY: bounds.bottom,
  topY: bounds.top,
});
const projector = {
  virtualToScreen: (x, y, out) => {
    out.x = x;
    out.y = y;
    return out;
  },
  screenToVirtual: (x, y, out) => {
    out.x = x;
    out.y = y;
    return out;
  },
};
const canvasMetrics = { width: 320, height: 600 };
const config = {
  casting: { enabled: true, aimLine: {} },
  debug: { casting: { showChumDistanceLine: true, showAccuracyArea: false } },
  locations: { showAimingZone: false },
};

let aiming = false;
let equipped = { handChum: { id: "bread", quantity: 5 } };
let powerAimVisual = null;

const chumSource = {
  isAiming: () => aiming,
  getEquipment: () => equipped,
  getGameStateName: () => "scouting",
  getCastDistance: () => 300,
  getPowerAimVisual: () => powerAimVisual,
  getAccuracyPreview: () => null,
  getBounds: () => bounds,
  getNow: () => 1000,
};

const builder = new CastingRenderFrameBuilder({
  projector,
  getWaterMetric: () => waterMetric,
  config,
  canvasMetrics,
  hudStyleResolver: { resolveBarStyle: () => ({}) },
  chumSource,
  labels: { castLimit: (m) => `${m} m` },
});

const frame = new GameRenderFrame();
const emptyIntent = {
  casting: {
    visible: false,
    zoneVisible: false,
    powerVisible: false,
    depthLimit: { visible: false },
  },
};

// 1. Not aiming chum: aimingZone is not visible
aiming = false;
frame.reset();
builder.buildInto({ target: frame.casting, intent: emptyIntent, clipRegions: [] });
assert.equal(
  frame.casting.aimingZone.visible,
  false,
  "aiming zone is hidden when not aiming chum",
);

// 2. Aiming hand chum before pointer drag (visual === null):
// G-095: dashed line and area of accessible throw length MUST be visible immediately
aiming = true;
powerAimVisual = null;
frame.reset();
builder.buildInto({ target: frame.casting, intent: emptyIntent, clipRegions: [] });
assert.equal(
  frame.casting.aimingZone.visible,
  true,
  "G-095: selecting hand chum immediately shows the reachable cast area",
);
assert.equal(frame.casting.aimingZone.mode, "chum", "aiming zone mode is chum");
const expectedLineVirtualY = waterMetric.yAtBasePixels(300);
assert.equal(
  frame.casting.aimingZone.lineY,
  expectedLineVirtualY,
  "aiming zone line matches the reachable cast distance",
);
assert(
  frame.casting.aimingZone.fillHeight > 0,
  "aiming zone fill covers reachable water to the shore",
);

// 3. Aiming hand chum during active pointer drag (visual !== null):
// Aiming zone remains visible alongside power aim
powerAimVisual = { active: true, mode: "chum", screenX: 160, power: 0.7 };
frame.reset();
builder.buildInto({ target: frame.casting, intent: emptyIntent, clipRegions: [] });
assert.equal(
  frame.casting.aimingZone.visible,
  true,
  "aiming zone stays visible during active power aiming",
);
assert.equal(
  frame.casting.powerAim.visible,
  true,
  "power aim line is shown during active drag",
);

// 4. Boat chum equipped (not hand chum):
// Selecting boat chum does not show hand chum throw zone
equipped = { delivery: { id: "boat-basic" } };
powerAimVisual = null;
frame.reset();
builder.buildInto({ target: frame.casting, intent: emptyIntent, clipRegions: [] });
assert.equal(
  frame.casting.aimingZone.visible,
  false,
  "boat chum does not show hand throw aiming zone",
);

console.log(
  "Hand chum aim zone passed (G-095): selecting hand chum immediately displays the reachable cast area (dashed line) before and during aim, and hides it for boat chum or when not aiming.",
);
