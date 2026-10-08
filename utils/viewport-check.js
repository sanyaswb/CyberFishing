const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

const runtime = new SourceRuntime();
const { WorldPerspective } = runtime.importModule("src/game/domain/locations/world_perspective.js");
const { ViewportProjector } = runtime.importModule("src/game/application/viewport/viewport_projector.js");
const { Vector2 } = runtime.importModule("src/engine/math/vector2.js");
const config = {
  baseResolution: { width: 1000, height: 800 },
  cameraFocusY: 0.7,
  map: { lake: { safeZone: { top: 100, bottom: 500 }, perspective: { angleTop: 0, angleBottom: 45 } } },
};
const perspective = new WorldPerspective(config, "lake");
let calls = 0;
const query = (y) => { calls++; return perspective.getPerspective(y); };
const projector = new ViewportProjector(config, "lake", query);
assert.equal(projector.getPerspective, query, "the injected query is used without a wrapper");
assert.equal(projector.getPerspective(0).scale, 0, "positions above the horizon clamp to the horizon");
assert.equal(projector.getPerspective(600).scale, 1, "positions below the shore clamp to shore scale");
assert(Math.abs(projector.getPerspective(300).scale - 0.414213562373095) < 1e-12,
  "the midpoint has the calibrated perspective scale");
const screen = new Vector2();
const virtual = new Vector2();
const expected = JSON.stringify(projector.getPerspective(300));
calls = 0;
for (let frame = 0; frame < 120; frame++) {
  projector.update(640 + frame % 7, 360 + frame % 11);
  projector.pan(frame % 3 - 1, frame % 5 - 2);
  projector.focusOnVirtualPos(100 + frame, [0, 8, 16.66, 33, 100][frame % 5]);
  assert.equal(projector.virtualToScreen(300, 250, screen), screen);
  assert.equal(projector.screenToVirtual(screen.x, screen.y, virtual), virtual);
  assert(Math.abs(virtual.x - 300) < 1e-10 && Math.abs(virtual.y - 250) < 1e-10,
    "camera transforms remain inverses using reusable output vectors");
  assert.equal(JSON.stringify(projector.getPerspective(300)), expected,
    "camera movement and viewport size do not own world perspective");
}
assert.equal(calls, 120, "one perspective query per frame; camera operations do not query perspective");
config.map.lake = { safeZone: { top: 300, bottom: 700 }, perspective: { angleTop: 0, angleBottom: 30 } };
assert.equal(projector.getPerspective(300).scale, 0, "live location replacement reaches the existing perspective owner");
assert.equal(projector.getPerspective(700).scale, 1);
delete config.map.lake.perspective;
assert(projector.getPerspective(300).squashY > 0, "missing perspective uses the original default angles");
console.log("Viewport passed: perspective boundaries/live config, 120 camera frames, one query per frame and reused function/vector identities.");
