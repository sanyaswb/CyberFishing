const fs = require("node:fs");
const path = require("node:path");
const { RenderTestHarness } = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const checks = [];

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function filesUnder(relativeDirectory) {
  const directory = path.join(ROOT, relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return filesUnder(relative);
    return entry.name.endsWith(".js") ? [relative] : [];
  });
}

function sourceOf(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function assertStatic(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

const harness = new RenderTestHarness(ROOT);
const context = harness.createContext({
  console,
  Promise,
  Object,
  Map,
  Set,
  String,
  Number,
  Error,
  TypeError,
});

harness.load(context, [
  "src/render/core/render_allocation_diagnostics.js",
  "src/render/core/image_asset_provider.js",
  "src/assets/asset_manifest.js",
  "src/assets/asset_load_result.js",
  "src/assets/asset_preload_coordinator.js",
]);

async function main() {
  await harness.run(context, `
(async () => {
  const checks = [];
  function assert(condition, message) {
    if (!condition) throw new Error(message);
    checks.push(message);
  }
  class FakeImageAssets {
    constructor({ failIds = [], async = false } = {}) {
      this.failIds = new Set(failIds);
      this.async = async;
      this.calls = 0;
      this.ready = new Set();
      this.requestIds = [];
    }
    preload(manifest) {
      this.calls += 1;
      const ids = Object.keys(manifest);
      this.requestIds.push(ids.join("|"));
      const load = () => {
        for (let index = 0; index < ids.length; index += 1) {
          const id = ids[index];
          if (this.failIds.has(id)) return Promise.reject(new Error("asset failed: " + id));
          this.ready.add(id);
        }
        return Promise.resolve(this);
      };
      return this.async ? Promise.resolve().then(load) : load();
    }
    isReady(id) {
      return this.ready.has(id);
    }
  }

  const locationsConfig = {
    map: {
      lake: {
        bgUrl: "assets/location/lake.webp",
        depthUrl: "assets/location/lake-depth.webp",
      },
    },
  };
  const locationAssets = new FakeImageAssets();
  const locationCoordinator = new AssetPreloadCoordinator({
    imageAssets: locationAssets,
    locationsConfig,
  });
  const locationResult = await locationCoordinator.preloadLocation("lake");
  assert(locationResult.ok, "location lifecycle preload resolves only after critical assets are ready");
  assert(locationAssets.isReady(ImageAssetProvider.assetIdForSource("assets/location/lake.webp", "location:lake:default")), "location background is ready before activation");
  assert(locationAssets.isReady(ImageAssetProvider.assetIdForSource("assets/location/lake-depth.webp", "location:lake:depth")), "location depth map is ready before activation");

  const fish = { id: "testfish", level: 1, imagePath: "assets/fish/testfish.webp" };
  const fishingAssets = new FakeImageAssets({ async: true });
  const fishingCoordinator = new AssetPreloadCoordinator({
    imageAssets: fishingAssets,
    locationsConfig: {},
  });
  await fishingCoordinator.preloadFishingAssets(null, fish);
  assert(fishingAssets.isReady(ImageAssetProvider.assetIdForSource(fish.imagePath, "fish")), "fish sprite preload completes before hook presentation");

  const firstVictory = fishingCoordinator.preloadVictoryAssets(fish);
  const secondVictory = fishingCoordinator.preloadVictoryAssets(fish);
  await Promise.all([firstVictory, secondVictory]);
  assert(fishingAssets.calls === 1, "ready fish sprite is reused by Victory preload");

  const dedupeAssets = new FakeImageAssets({ async: true });
  const dedupeCoordinator = new AssetPreloadCoordinator({
    imageAssets: dedupeAssets,
    locationsConfig,
  });
  await Promise.all([
    dedupeCoordinator.preloadLocation("lake"),
    dedupeCoordinator.preloadLocation("lake"),
  ]);
  assert(dedupeAssets.calls === 2, "parallel location preload dedupes each critical asset request");

  const criticalId = ImageAssetProvider.assetIdForSource(fish.imagePath, "fish");
  let criticalFailure = null;
  try {
    await new AssetPreloadCoordinator({
      imageAssets: new FakeImageAssets({ failIds: [criticalId] }),
      locationsConfig: {},
    }).preloadVictoryAssets(fish);
  } catch (error) {
    criticalFailure = error;
  }
  assert(criticalFailure && criticalFailure.critical === true, "critical asset failure prevents state activation with structured error");
  assert(criticalFailure.scope === "victory", "critical asset error includes scope");
  assert(criticalFailure.result && criticalFailure.result.ok === false, "critical asset error includes load result");

  const optionalAssets = new FakeImageAssets({ failIds: [criticalId] });
  const optionalResult = await new AssetPreloadCoordinator({
    imageAssets: optionalAssets,
    locationsConfig: {},
  }).preloadFishingAssets(null, fish);
  assert(optionalResult.ok, "optional asset failure does not block gameplay state");
  assert(optionalResult.getAt(0).fallbackUsed === true, "optional asset failure records fallback usage");

  console.log("render-asset-lifecycle-check runtime passed:");
  for (const message of checks) console.log("- " + message);
})()
`, "utils/render-asset-lifecycle-check.js#runtime");

  const appSource = sourceOf("src/app/application.js");
  assertStatic(
    appSource.includes("#transitionToVictoryWhenAssetsReady") &&
      appSource.includes("preloadVictoryAssets"),
    "Victory transition is gated by awaitable asset preload",
  );
  const bootstrapSource = sourceOf("src/app/bootstrap.js");
  assertStatic(
    bootstrapSource.includes("await assetPreloadCoordinator.preloadLocation") &&
      bootstrapSource.includes("await locationAssetLoader.load") &&
      bootstrapSource.indexOf("await assetPreloadCoordinator.preloadLocation") <
        bootstrapSource.indexOf("new LocationMap("),
    "location activation waits for preload and loaded ready resources",
  );

  const renderSources = filesUnder("src/render")
    .map((file) => ({ file, source: sourceOf(file) }));
  const preloadUsers = renderSources.filter(({ source }) =>
    /\.preload\s*\(/.test(source),
  );
  assertStatic(preloadUsers.length === 0, "renderer layer never triggers asset preload");

  const imageUsers = filesUnder("src")
    .filter((file) => /\bnew\s+Image\s*\(/.test(sourceOf(file)))
    .map(normalizePath);
  assertStatic(
    imageUsers.join("|") === "src/render/core/image_asset_provider.js",
    "new Image is owned only by asset infrastructure",
  );

  console.log("render-asset-lifecycle-check static passed:");
  for (const message of checks) console.log("- " + message);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
