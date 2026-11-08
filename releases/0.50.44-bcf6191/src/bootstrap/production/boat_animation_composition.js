import { AssetLoadQueue } from "../../engine/assets/asset_load_queue.js";
import { BrowserAssetTransport } from "../../platform/browser/assets/browser_asset_transport.js";
import { BoatAnimationController } from "../../game/presentation/world/boat_animation_controller.js";
import { SpineBundleLoader } from "../../platform/browser/animation/spine_bundle_loader.js";
import { SpineGlSurface } from "../../platform/browser/animation/spine_gl_surface.js";
import { SpineRuntimeProvider } from "../../platform/browser/animation/spine_runtime_provider.js";
import { SceneSkeletalSurface } from "../../platform/browser/scene/scene_skeletal_surface.js";

// Composition of the Spine bait boat animation (spec 150). Spec 166: Spine is probed before the export loads; on the
// WebGL scene the export starts on its half-size pages; without Spine the boat's static picture comes through
// preload.request() and is read from the game's image store (images).
export function composeBoatAnimation({ windowTarget, documentTarget, scene, assets, preload, images }) {
  const queue = new AssetLoadQueue({
    scheduler: {
      setTimeout: (callback, delayMs) => windowTarget.setTimeout(callback, delayMs),
      clearTimeout: (id) => windowTarget.clearTimeout(id),
    },
  });
  const loader = new SpineBundleLoader({ queue, transport: new BrowserAssetTransport(), assets });
  const onScene = scene?.webgl === true;
  const runtimeProvider = onScene ? new SpineRuntimeProvider({
    importModule: () => scene.layer.whenReady().then((ready) => {
      if (!ready) throw new Error("the WebGL scene is unavailable");
      return import("../../platform/browser/scene/pixi_runtime_module.js");
    }),
  }) : new SpineRuntimeProvider();
  const glSurface = onScene ? new SceneSkeletalSurface({
    drawsRod: () => scene.router ? scene.router.drawsOnScene("world-entities") : true,
    getWebGLVersion: () => scene.layer.getStatus().webglVersion ?? null,
  }) : new SpineGlSurface({ createCanvas: () => documentTarget.createElement("canvas") });
  let spineAvailable = null;
  const controller = new BoatAnimationController({
    loadBundle: (descriptor) => loader.load(descriptor, { priority: "interactive", pages: onScene ? "low" : "full" }),
    loadRuntime: (exportVersion) => runtimeProvider.load(exportVersion),
    glSurface,
    probeSpine: () => (spineAvailable ??= runtimeProvider.probe()
      .then((available) => available && glSurface.ensureContext(), () => false)),
    requestStatic: (assetId) => { void preload.request([assetId]); },
    // A full image only: the store's fallback picture is not the boat.
    getStaticImage: (assetId) => (preload.isReady(assetId) ? images.tryGet(assetId) : null),
  });
  return {
    controller,
    dispose() {
      controller.dispose();
      queue.dispose();
      glSurface.dispose();
    },
  };
}
