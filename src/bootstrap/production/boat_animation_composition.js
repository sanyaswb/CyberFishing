import { AssetLoadQueue } from "../../engine/assets/asset_load_queue.js";
import { BrowserAssetTransport } from "../../platform/browser/assets/browser_asset_transport.js";
import { BoatAnimationController } from "../../game/presentation/world/boat_animation_controller.js";
import { SpineBundleLoader } from "../../platform/browser/animation/spine_bundle_loader.js";
import { SpineGlSurface } from "../../platform/browser/animation/spine_gl_surface.js";
import { SpineRuntimeProvider } from "../../platform/browser/animation/spine_runtime_provider.js";
import { SceneSkeletalSurface } from "../../platform/browser/scene/scene_skeletal_surface.js";

// Composition of the Spine bait boat animation (spec 150).
export function composeBoatAnimation({ windowTarget, documentTarget, scene }) {
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
  const glSurface = onScene ? new SceneSkeletalSurface({
    drawsRod: () => scene.router ? scene.router.drawsOnScene("world-entities") : true,
    getWebGLVersion: () => scene.layer.getStatus().webglVersion ?? null,
  }) : new SpineGlSurface({ createCanvas: () => documentTarget.createElement("canvas") });
  const controller = new BoatAnimationController({
    loadBundle: (descriptor) => loader.load(descriptor, { priority: "interactive" }),
    loadRuntime: (exportVersion) => runtimeProvider.load(exportVersion),
    glSurface,
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
