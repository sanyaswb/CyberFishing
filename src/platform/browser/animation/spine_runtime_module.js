// The one Spine runtime entry (spec 083 contract, spec 099): the pinned spine-webgl 4.3.13 bundle from vendor/ (the
// architecture check allows only this module to import it). SpineRuntimeProvider imports this module lazily, so the
// runtime loads only when an animated skin needs it. createScene(bundle, surface) returns { scene, reason, error }.
import * as spine from "../../../../vendor/spine-webgl/4.3.13/spine-webgl.js";
import { SpineScene } from "./spine_scene.js";

const RUNTIME_VERSION = "4.3.13";

export function createSpineRuntime() {
  // One managed WebGL context per surface: GL textures and the renderer register with it for context restore.
  const contexts = new WeakMap();
  const contextFor = (surface) => {
    let context = contexts.get(surface);
    if (!context) {
      context = new spine.ManagedWebGLRenderingContext(surface.gl);
      contexts.set(surface, context);
    }
    return context;
  };
  return Object.freeze({
    version: RUNTIME_VERSION,
    createScene(bundle, surface) {
      if (!surface.ensureContext()) return { scene: null, reason: "context-unavailable", error: null };
      const context = contextFor(surface);
      return SpineScene.create({
        spine,
        bundle,
        surface,
        runtimeVersion: RUNTIME_VERSION,
        graphics: {
          createTexture: (image, pma) => new spine.GLTexture(context, image, pma, false),
          createRenderer: () => new spine.SceneRenderer(surface.canvas, context, true),
          restore: () => context.restore(),
          dispose: () => {},
        },
      });
    },
  });
}
