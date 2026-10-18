import { AssetLoadQueue } from "../../engine/assets/asset_load_queue.js";
import { BrowserAssetTransport } from "../../platform/browser/assets/browser_asset_transport.js";
import { RodAnimationController } from "../../game/presentation/fishing/rod_animation_controller.js";
import { RodAnimationStateResolver } from "../../game/presentation/fishing/rod_animation_state_resolver.js";
import { SpineBundleLoader } from "../../platform/browser/animation/spine_bundle_loader.js";
import { SpineGlSurface } from "../../platform/browser/animation/spine_gl_surface.js";
import { SpineRuntimeProvider } from "../../platform/browser/animation/spine_runtime_provider.js";
import { SpineSetupPoseReader } from "../../platform/browser/animation/spine_setup_pose_reader.js";
import { SceneSkeletalSurface } from "../../platform/browser/scene/scene_skeletal_surface.js";

// The Spine rod (spec 099): one load queue, bundle loader, lazily imported runtime and surface for the session, and the
// controller the rod renderers, the line builder and the DEV Spine section share. scene: { layer, router, webgl } from
// the scene composition. With the WebGL scene (spec 107), the rod's skeleton is drawn inside it by spine-pixi-v8 (the
// scene's own bundle, imported once the scene is ready) over a surface that is only a coordinate space; without it,
// spine-webgl draws into an offscreen GL surface that the 2D canvas copies (spec 099).
export function composeRodAnimation({ windowTarget, documentTarget, config, scene }) {
  const queue = new AssetLoadQueue({
    scheduler: {
      setTimeout: (callback, delayMs) => windowTarget.setTimeout(callback, delayMs),
      clearTimeout: (id) => windowTarget.clearTimeout(id),
    },
  });
  const loader = new SpineBundleLoader({ queue, transport: new BrowserAssetTransport() });
  const onScene = scene?.webgl === true;
  const runtimeProvider = onScene ? new SpineRuntimeProvider({
    importModule: () => scene.layer.whenReady().then((ready) => {
      if (!ready) throw new Error("the WebGL scene is unavailable");
      return import("../../platform/browser/scene/pixi_runtime_module.js");
    }),
  }) : new SpineRuntimeProvider();
  const glSurface = onScene ? new SceneSkeletalSurface({ drawsRod: () => scene.router.drawsOnScene("rod"),
    getWebGLVersion: () => scene.layer.getStatus().webglVersion ?? null })
    : new SpineGlSurface({ createCanvas: () => documentTarget.createElement("canvas") });
  const reducedMotion = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  const controller = new RodAnimationController({
    loadBundle: (descriptor) => loader.load(descriptor, { priority: "interactive" }),
    loadRuntime: (exportVersion) => runtimeProvider.load(exportVersion),
    glSurface,
    resolver: new RodAnimationStateResolver(),
    getConfig: () => config.ui.rod.spine,
    isReducedMotion: () => reducedMotion?.matches === true,
    readSetupPose: (skeletonJson, atlas, descriptor) => SpineSetupPoseReader.read(skeletonJson, atlas, descriptor),
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
