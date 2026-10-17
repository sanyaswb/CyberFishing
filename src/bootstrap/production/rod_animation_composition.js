import { AssetLoadQueue } from "../../engine/assets/asset_load_queue.js";
import { BrowserAssetTransport } from "../../platform/browser/assets/browser_asset_transport.js";
import { RodAnimationController } from "../../game/presentation/fishing/rod_animation_controller.js";
import { RodAnimationStateResolver } from "../../game/presentation/fishing/rod_animation_state_resolver.js";
import { SpineBundleLoader } from "../../platform/browser/animation/spine_bundle_loader.js";
import { SpineGlSurface } from "../../platform/browser/animation/spine_gl_surface.js";
import { SpineRuntimeProvider } from "../../platform/browser/animation/spine_runtime_provider.js";

// The Spine rod (spec 099): one load queue, bundle loader, lazily imported runtime and offscreen GL surface for the
// session, and the controller the rod renderers and the line builder share. forceStatic is the DEV "?spine=off" switch.
export function composeRodAnimation({ windowTarget, documentTarget, config, forceStatic = () => false }) {
  const queue = new AssetLoadQueue({
    scheduler: {
      setTimeout: (callback, delayMs) => windowTarget.setTimeout(callback, delayMs),
      clearTimeout: (id) => windowTarget.clearTimeout(id),
    },
  });
  const loader = new SpineBundleLoader({ queue, transport: new BrowserAssetTransport() });
  const runtimeProvider = new SpineRuntimeProvider();
  const glSurface = new SpineGlSurface({ createCanvas: () => documentTarget.createElement("canvas") });
  const reducedMotion = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  const controller = new RodAnimationController({
    loadBundle: (descriptor) => loader.load(descriptor, { priority: "interactive" }),
    loadRuntime: (exportVersion) => runtimeProvider.load(exportVersion),
    glSurface,
    resolver: new RodAnimationStateResolver(),
    getConfig: () => config.ui.rod.spine,
    isReducedMotion: () => reducedMotion?.matches === true,
    forceStatic,
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
