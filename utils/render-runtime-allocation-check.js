const path = require("node:path");
const { RenderTestHarness } = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const harness = new RenderTestHarness(ROOT);
const context = harness.createContext({
  console,
  Math,
  Number,
  Object,
  Map,
  Promise,
  Set,
  String,
  TypeError,
  Error,
});

harness.load(context, [
  "src/render/core/render_allocation_diagnostics.js",
  "src/render/core/render_frame_buffer.js",
  "src/render/core/render_order.js",
  "src/render/pipeline/game_render_pipeline.js",
  "src/render/screens/victory_layout_resolver.js",
  "src/render/core/image_asset_provider.js",
  "src/assets/asset_manifest.js",
  "src/assets/asset_load_result.js",
  "src/assets/asset_preload_coordinator.js",
]);

Promise.resolve(harness.run(context, `
(async () => {
  const checks = [];
  function assert(condition, message) {
    if (!condition) throw new Error(message);
    checks.push(message);
  }
  function snapshot() {
    return RenderAllocationDiagnostics.snapshot({});
  }
  function fillFrame(frame) {
    for (let index = 0; index < 64; index += 1) {
      frame.fishing.fightAreas.sectorPoints.acquire().x = index;
      frame.fishing.fightAreas.lineRadiusPoints.acquire().x = index;
      frame.world.backgroundLayers.acquire().assetId = "background";
      frame.outcome.victory.stats.acquire().label = "stat";
    }
  }

  RenderAllocationDiagnostics.disable();
  RenderAllocationDiagnostics.reset();
  new RenderFrameBuffer();
  assert(snapshot().frameCreations === 0, "diagnostics are disabled by default");

  RenderAllocationDiagnostics.enable();
  RenderAllocationDiagnostics.reset();
  const buffer = new RenderFrameBuffer();
  const warmFrame = buffer.acquire();
  fillFrame(warmFrame);
  const afterWarmup = snapshot();
  assert(afterWarmup.frameCreations === 1, "GameRenderFrame creation is counted once");
  assert(afterWarmup.sectorPointBufferGrowth === 64, "sector point buffer growth is counted");
  assert(afterWarmup.lineRadiusPointBufferGrowth === 64, "line radius point buffer growth is counted");

  for (let frameIndex = 0; frameIndex < 800; frameIndex += 1) {
    fillFrame(buffer.acquire(frameIndex + 2, 1 / 60, "playing"));
  }
  const afterStableFrames = snapshot();
  assert(afterStableFrames.frameCreations === afterWarmup.frameCreations, "render frame is reused for 800 frames");
  assert(afterStableFrames.sectorPointBufferGrowth === afterWarmup.sectorPointBufferGrowth, "sector point buffer does not grow after warmup");
  assert(afterStableFrames.lineRadiusPointBufferGrowth === afterWarmup.lineRadiusPointBufferGrowth, "line radius point buffer does not grow after warmup");

  const pipeline = new GameRenderPipeline({
    passes: [{ id: "world", render() {} }, { id: "hud", render() {} }],
  });
  const afterPipelineCreate = snapshot();
  for (let index = 0; index < 500; index += 1) pipeline.render(buffer.current);
  assert(snapshot().renderPassCreations === afterPipelineCreate.renderPassCreations, "render pass creation counter is stable during render");

  const resolver = new VictoryLayoutResolver();
  const afterResolverCreate = snapshot();
  for (let index = 0; index < 500; index += 1) {
    resolver.resolve({ width: 1280, height: 720, config: {}, statCount: 3 });
  }
  assert(snapshot().victoryLayoutCreations === afterResolverCreate.victoryLayoutCreations, "victory layout object is reused");

  let loadCount = 0;
  const fakeImageAssets = {
    ready: new Set(),
    isReady(id) {
      return this.ready.has(id);
    },
    preload(manifest) {
      loadCount += 1;
      const ids = Object.keys(manifest);
      return Promise.resolve().then(() => {
        for (let index = 0; index < ids.length; index += 1) this.ready.add(ids[index]);
      });
    },
  };
  const coordinator = new AssetPreloadCoordinator({
    imageAssets: fakeImageAssets,
    locationsConfig: { map: { pond: { bgUrl: "pond.webp", depthUrl: "pond-depth.png" } } },
  });
  await coordinator.preloadLocation("pond");
  const afterFirstAssetLoad = snapshot();
  await coordinator.preloadLocation("pond");
  assert(snapshot().assetRequestCreations === afterFirstAssetLoad.assetRequestCreations, "ready asset preload does not create a new request");
  assert(loadCount === 2, "only the initial location background and depth requests were created");

  RenderAllocationDiagnostics.disable();
  console.log("render-runtime-allocation-check passed:");
  for (const message of checks) console.log("- " + message);
})()
`, "utils/render-runtime-allocation-check.js")).catch((error) => {
  console.error(error);
  process.exit(1);
});
