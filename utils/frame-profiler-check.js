"use strict";

// Spec 101: the frame probe port (inactive in production), the DEV FrameProfiler statistics and the overlay's
// performance module, with the scene layer section and pixels of spec 103.
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT_DIR = path.resolve(__dirname, "..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT_DIR, file)).href);
const near = (actual, expected, tolerance, label) =>
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

async function checkInactiveProbe() {
  const { InactiveFrameProbe, FRAME_PROBE_METHODS, FRAME_SECTIONS } =
    await importSource("src/engine/diagnostics/inactive_frame_probe.js");
  const probe = new InactiveFrameProbe();
  for (const method of FRAME_PROBE_METHODS) assert.equal(typeof probe[method], "function", `inactive probe has ${method}`);
  assert.equal(probe.beginFrame(1), undefined);
  assert.deepEqual(Object.values(FRAME_SECTIONS), ["update", "draw", "scene", "rod-spine"]);
}

async function checkProfiler() {
  const { FrameProfiler } = await importSource("src/dev/diagnostics/frame_profiler.js");
  let clock = 0;
  const profiler = new FrameProfiler({ now: () => clock, observeLongTasks: false });
  const frame = (timestamp, updateMs, drawMs, spineMs = 0) => {
    clock = timestamp;
    profiler.beginFrame(timestamp);
    profiler.begin("update"); clock += updateMs; profiler.end("update");
    profiler.begin("draw");
    if (spineMs) { profiler.begin("rod-spine"); clock += spineMs; profiler.end("rod-spine"); }
    clock += drawMs - spineMs; profiler.end("draw");
    profiler.endFrame();
  };
  let timestamp = 0;
  for (let index = 0; index < 60; index += 1) frame(timestamp += 16, 2, 4, 1);
  let snapshot = profiler.getSnapshot();
  assert.equal(snapshot.frames, 60);
  near(snapshot.fps, 62.5, 1e-9, "fps from the mean frame interval");
  near(snapshot.work.mean, 6, 1e-9, "game-loop work = update + draw");
  near(snapshot.sections.update.mean, 2, 1e-9, "update section");
  near(snapshot.sections["rod-spine"].mean, 1, 1e-9, "nested Spine section inside draw");
  near(snapshot.budgetShare, 6 / 16, 1e-9, "share of the frame interval");
  near(snapshot.unexplainedMs, 10, 1e-9, "interval not spent in the game loop");
  assert.deepEqual([snapshot.janks, snapshot.freezes], [0, 0]);

  frame(timestamp += 30, 2, 4);
  frame(timestamp += 80, 2, 4);
  frame(timestamp += 5000, 2, 4);
  snapshot = profiler.getSnapshot();
  assert.deepEqual([snapshot.janks, snapshot.freezes], [1, 1], "30 ms is a jank, 80 ms a freeze, a hidden-tab gap neither");
  assert.equal(snapshot.interval.max, 80);
  assert.equal(snapshot.recent.at(-1), 80, "the freeze bar ends with the latest counted interval");

  for (let index = 0; index < 300; index += 1) frame(timestamp += 20, 1, 1);
  snapshot = profiler.getSnapshot({ recentFrames: 50 });
  assert.equal(snapshot.frames, 240, "a ring of 240 frames");
  near(snapshot.interval.mean, 20, 1e-9, "old frames leave the ring");
  assert.equal(snapshot.recent.length, 50);

  profiler.gauge("gl-pixels", 1234);
  profiler.recordLongTask(120);
  profiler.recordLongTask(60);
  assert.equal(profiler.measure("overlay", () => { clock += 3; return "html"; }), "html");
  frame(timestamp += 20, 1, 1);
  snapshot = profiler.getSnapshot();
  assert.equal(snapshot.gauges["gl-pixels"], 1234);
  assert.deepEqual(snapshot.longTasks, { count: 2, totalMs: 180, maxMs: 120, observed: false });
  assert.equal(snapshot.sections.overlay.max, 3, "DEV overlay work is its own section");
  profiler.reset();
  assert.equal(profiler.getSnapshot().frames, 0);
  profiler.dispose();
  return FrameProfiler;
}

async function checkOverlayModule(FrameProfiler) {
  const { PerformanceOverlayModule } = await importSource("src/dev/overlay/modules/performance_overlay_module.js");
  const { OverlayHtmlBuilder } = await importSource("src/dev/overlay/services/overlay_html_builder.js");
  const htmlBuilder = new OverlayHtmlBuilder();
  assert.throws(() => new PerformanceOverlayModule({ htmlBuilder }), /requires profiler/u);
  let clock = 0;
  const profiler = new FrameProfiler({ now: () => clock, observeLongTasks: false });
  const module = new PerformanceOverlayModule({ htmlBuilder, profiler, settingsStore: { isEnabled: () => true },
    readRenderInfo: () => ({ backingWidth: 1688, backingHeight: 780, pixelRatio: 2, memoryMb: 42 }) });
  profiler.gauge("scene-pixels", 1688 * 780);
  assert.match(module.render(), /Немає кадрів гри/u);
  let timestamp = 0;
  for (const interval of [16, 16, 30, 90, 16]) {
    clock = timestamp += interval;
    profiler.beginFrame(timestamp);
    profiler.begin("draw");
    profiler.begin("scene"); clock += 1; profiler.end("scene");
    clock += 4; profiler.end("draw");
    profiler.endFrame();
  }
  const html = module.render();
  assert.match(html, /ПРОДУКТИВНІСТЬ/u);
  assert.match(html, /<svg[^>]+aria-label="Інтервали кадрів"/u, "the freeze bar");
  assert.equal((html.match(/<rect /gu) || []).length, 4, "one bar per counted interval");
  assert.match(html, /fill="#ff4444"/u, "a freeze bar is red");
  assert.match(html, /fill="#ffaa00"/u, "a jank bar is orange");
  assert.match(html, /1688×780 @ 2×/u, "the backing store and pixel ratio");
  assert.match(html, /сцена WebGL \(Pixi\)[\s\S]*1\.0 мс/u, "the scene layer section (spec 103)");
  assert.match(html, /сцена WebGL \(backing\)[\s\S]*1\.32 Мпікс/u, "the scene backing pixels");
  assert.equal(module.isActive({}), true);
}

async function main() {
  await checkInactiveProbe();
  const FrameProfiler = await checkProfiler();
  await checkOverlayModule(FrameProfiler);
  console.log("Frame profiler passed: inactive production probe, interval/work/section statistics, jank and freeze "
    + "counts without hidden-tab gaps, 240-frame ring, gauges, long tasks and the DEV overlay section, and the "
    + "performance overlay's metrics and freeze bar.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
