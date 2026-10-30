// Spec 155: the bait boat's procedural wake. A boat running its motor leaves puffs behind it on both Kelvin arms,
// as many per second at any frame rate; puffs age out, the pool never grows past its capacity, a drifting or stopped
// boat leaves no new wake, far water gets smaller puffs, and a disabled wake draws nothing.
const assert = require("node:assert/strict");

async function run() {
  const { BoatWakeEmitter } = await import("../../../src/game/presentation/world/boat_wake_emitter.js");
  const { ReusableRenderList } = await import("../../../src/game/presentation/rendering/reusable_render_list.js");
  const { CONFIG } = await import("../../../src/game/config/runtime/game_config.js");
  const base = CONFIG.ui.boat.wake;
  // Like ViewportProjector: the result is written with out.set(x, y), so the caller must pass a Vector2.
  const projector = { getScale: () => 1, virtualToScreen: (x, y, out) => out.set(x, y) };
  const near = () => 1;
  const boatAt = (y, overrides = {}) => ({ pos: { x: 500, y }, angle: -Math.PI / 2, velocity: { x: 0, y: -250 },
    stats: { speedPxPerSec: 250 }, state: "deploying", animationState: "moving", powerRatio: 1, ...overrides });

  // Pairs per second at full speed, independent of the frame rate.
  const counts = [30, 60, 144].map((fps) => {
    const wake = new BoatWakeEmitter({ getSettings: () => ({ ...base, bowFoam: false, lifeSec: 10, capacity: 512 }) });
    const boat = boatAt(1500);
    for (let frame = 0; frame < fps; frame += 1) wake.update([boat], 1 / fps, near);
    return wake.count;
  });
  for (const count of counts) assert(Math.abs(count - base.ratePerSecond * 2) <= 2, `one second: ${counts}`);

  // Both arms point backward and outward by the Kelvin angle; puffs grow and fade, then disappear.
  const wake = new BoatWakeEmitter({ getSettings: () => ({ ...base, bowFoam: false }) });
  const boat = boatAt(1500);
  for (let frame = 0; frame < 6; frame += 1) wake.update([boat], 1 / 60, near);
  const list = new ReusableRenderList("wake");
  wake.buildInto(list, projector);
  const xs = Array.from({ length: list.count }, (_, index) => list.getAt(index).x);
  assert(xs.some((x) => x < 500) && xs.some((x) => x > 500), "puffs spread to both sides of the course");
  for (let index = 0; index < list.count; index += 1) {
    assert(list.getAt(index).y > 1500, "puffs lie behind a boat heading up the screen");
  }
  boat.state = "drifting";
  boat.animationState = "idle";
  for (let frame = 0; frame < 60 * (base.lifeSec + 0.1); frame += 1) wake.update([boat], 1 / 60, near);
  assert.equal(wake.count, 0, "a drifting boat leaves no new wake and the old one fades out");

  // The pool never grows past its capacity.
  const capped = new BoatWakeEmitter({ getSettings: () => ({ ...base, capacity: 10, lifeSec: 10 }) });
  const cappedBoat = boatAt(1500);
  for (let frame = 0; frame < 600; frame += 1) capped.update([cappedBoat], 1 / 60, near);
  assert.equal(capped.count, 10);

  // Far water: smaller puffs (surface scale 0.3).
  const sizeAt = (scale) => {
    const emitter = new BoatWakeEmitter({ getSettings: () => ({ ...base, bowFoam: false }) });
    const sized = boatAt(1500);
    for (let frame = 0; frame < 10; frame += 1) emitter.update([sized], 1 / 60, () => scale);
    const records = new ReusableRenderList("size");
    emitter.buildInto(records, projector);
    return records.getAt(0).size;
  };
  assert(Math.abs(sizeAt(0.3) / sizeAt(1) - 0.3) < 0.01, "puff size follows the water surface scale");

  // Disabled: nothing at all.
  let enabled = true;
  const toggled = new BoatWakeEmitter({ getSettings: () => ({ ...base, enabled }) });
  const toggledBoat = boatAt(1500);
  for (let frame = 0; frame < 30; frame += 1) toggled.update([toggledBoat], 1 / 60, near);
  assert(toggled.count > 0);
  enabled = false;
  toggled.update([toggledBoat], 1 / 60, near);
  assert.equal(toggled.count, 0, "switching the wake off clears it");
}

run().then(() => {
  console.log("boat-wake-check passed: Kelvin arms behind the boat, frame-rate independent emission, fading, capped pool, " +
    "no wake while drifting, perspective size, off switch.");
}).catch((error) => {
  console.error("boat-wake-check failed:", error);
  process.exit(1);
});
