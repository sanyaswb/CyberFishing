import { AssetLoadQueue } from "../../engine/assets/asset_load_queue.js";
import { BrowserAssetTransport } from "../../platform/browser/assets/browser_asset_transport.js";
import { RodAnimationController } from "../../game/presentation/fishing/rod_animation_controller.js";
import { RodAnimationStateResolver } from "../../game/presentation/fishing/rod_animation_state_resolver.js";
import { SpineBundleLoader } from "../../platform/browser/animation/spine_bundle_loader.js";
import { SpineRuntimeProvider } from "../../platform/browser/animation/spine_runtime_provider.js";
import { SpineSetupPoseReader } from "../../platform/browser/animation/spine_setup_pose_reader.js";
import { SceneSkeletalSurface } from "../../platform/browser/scene/scene_skeletal_surface.js";

// The Spine rod (spec 099): one load queue, bundle loader, lazily imported runtime and surface for the session, and the
// controller the rod renderers, the line builder and the DEV Spine section share. scene: { layer, router } from the scene
// composition. Spine plays only inside the WebGL scene (spec 107; spec 170: the 2D canvas is the reserve and draws the
// rod's static picture): spine-pixi-v8 from the scene's own bundle, imported once the scene is ready, over a surface
// that is only a coordinate space. Without a ready scene (no WebGL, the "canvas" mode) the probe fails and the static
// picture stays. Spec 166: the controller asks probeSpine() before anything of the export loads; with Spine it loads the
// export on its half-size pages and then the full pages, without Spine only the full start picture through
// preload.request(). Returns probeSpine too, for the lazy layer's Spine warm-up.
export function composeRodAnimation({ windowTarget, config, scene, assets, images, preload }) {
  const queue = new AssetLoadQueue({
    scheduler: {
      setTimeout: (callback, delayMs) => windowTarget.setTimeout(callback, delayMs),
      clearTimeout: (id) => windowTarget.clearTimeout(id),
    },
  });
  const loader = new SpineBundleLoader({ queue, transport: new BrowserAssetTransport(), assets });
  const runtimeProvider = new SpineRuntimeProvider({
    importModule: () => sceneReady(scene).then(() => import("../../platform/browser/scene/pixi_runtime_module.js")),
  });
  const glSurface = new SceneSkeletalSurface({ drawsRod: () => scene?.router?.drawsOnScene("rod") === true,
    getWebGLVersion: () => scene?.layer?.getStatus().webglVersion ?? null });
  const reducedMotion = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  let spineAvailable = null;
  const probeSpine = () => (spineAvailable ??= runtimeProvider.probe()
    .then((available) => available && glSurface.ensureContext(), () => false));
  const controller = new RodAnimationController({
    loadBundle: (descriptor) => loader.load(descriptor, { priority: "interactive", pages: "low" }),
    probeSpine,
    requestStatic: (assetId) => { void preload.request([assetId]); },
    loadRuntime: (exportVersion) => runtimeProvider.load(exportVersion),
    glSurface,
    resolver: new RodAnimationStateResolver(),
    getConfig: () => config.ui.rod.spine,
    isReducedMotion: () => reducedMotion?.matches === true,
    readSetupPose: (skeletonJson, atlas, descriptor) => SpineSetupPoseReader.read(skeletonJson, atlas, descriptor),
    // TK-181: the picture the plan's first layer loaded, drawn until the export arrives.
    getStartImage: (assetId) => images.tryGet(assetId),
  });
  return {
    controller,
    probeSpine,
    dispose() {
      controller.dispose();
      queue.dispose();
      glSurface.dispose();
    },
  };
}

// Resolves once the WebGL scene is ready; rejects without one (the 2D reserve: Spine is unavailable, spec 170).
export function sceneReady(scene) {
  if (scene?.webgl !== true || typeof scene.layer?.whenReady !== "function") {
    return Promise.reject(new Error("no WebGL scene: Spine plays only inside it"));
  }
  return scene.layer.whenReady().then((ready) => {
    if (!ready) throw new Error("the WebGL scene is unavailable");
  });
}