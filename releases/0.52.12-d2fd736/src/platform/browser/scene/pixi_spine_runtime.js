import { SpineScene } from "../animation/spine_scene.js";

// spine-pixi-v8's version in the vendored scene bundle (vendor/manifest.json): exports of the 4.3 editor line.
const RUNTIME_VERSION = "4.3.13";

// Spec 166: the full page into the texture of its half-size copy (a SpineTexture). The same TextureSource takes the
// image; update() resizes it to the image, which re-uploads it at the new size (Pixi's texture system listens to
// "resize"), every Texture over the source follows the resize, and the mipmaps are rebuilt from the full image.
export function replacePixiPageTexture(texture, image) {
  const source = texture.texture.source;
  source.resource = image;
  source.update();
  source.updateMipmaps();
}

// The Spine runtime of the WebGL scene (spec 107 D6; the only one since spec 170), the capability SpineRuntimeProvider loads:
// { version, createScene(bundle, surface) } → { scene, reason, error }. SpineScene drives the skeleton with
// spine-pixi-v8's copy of spine-core (y down); a Pixi Spine display object draws it inside the scene, with atlas pages
// as Pixi textures (mipmaps where the GPU builds them). The scene updates the skeleton itself (bones from the setup pose
// each frame, additive tracks once), so the display object never runs its own update: after each update the scene
// marks it changed, which is what spine-pixi-v8 4.3.13 does at the end of its own update.
export function createPixiSpineRuntime(pixi) {
  for (const name of ["Spine", "SpineTexture", "Skeleton", "AnimationState", "TextureAtlas", "Texture"]) {
    if (typeof pixi?.[name] !== "function" && typeof pixi?.[name] !== "object") {
      throw new TypeError(`createPixiSpineRuntime requires pixi.${name}`);
    }
  }
  return Object.freeze({
    version: RUNTIME_VERSION,
    createScene(bundle, surface) {
      if (!surface.ensureContext()) return { scene: null, reason: "context-unavailable", error: null };
      return SpineScene.create({
        spine: pixi,
        bundle,
        surface,
        runtimeVersion: RUNTIME_VERSION,
        graphics: {
          createTexture: (image, pma) => pixi.SpineTexture.from(pixi.Texture.from({ resource: image,
            alphaMode: pma ? "premultiplied-alpha" : "premultiply-alpha-on-upload" }, true).source),
          canMipmap: (width, height) => surface.canMipmap(width, height),
          replaceTexture: replacePixiPageTexture,
          createView: (data) => {
            const view = new pixi.Spine({ skeletonData: data, autoUpdate: false });
            return { view, skeleton: view.skeleton, state: view.state };
          },
          viewUpdated: (view) => {
            view._stateChanged = true;
            view.onViewUpdate();
          },
          disposeView: (view) => view.destroy(),
          dispose: () => {},
        },
      });
    },
  });
}
