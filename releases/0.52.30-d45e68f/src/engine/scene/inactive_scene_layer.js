// Scene layer port (specs 103, 104): the WebGL scene drawn under the 2D game canvas. GameRenderCoordinator calls
// render(frame) once per frame while the router lets the scene draw, after the frame is built and before the 2D
// passes; isActive() tells the router whether WebGL is running (otherwise every kind stays on the 2D canvas);
// whenReady() resolves once the layer has rendered its first (warm-up) frame, or will never render (false); prepare
// (assetIds) creates the GPU resources of those loaded images at once, so startup can do it during loading instead of in
// the first frames of play (spec 105 D2); the session disposes it. getStatus, loseContext and restoreContext serve DevTools "СЦЕНА WebGL" (fallback tests).
// setViewMotion(x, y, marginX, marginY) (spec 179 stages J, L): the view's offset in logical px — the emission's shake,
// the vodka's sway — and the margins it may reach; the 2D-only game does not move.
// Production's "canvas" mode composes this inactive layer: no canvas, no work.
export const SCENE_LAYER_METHODS = Object.freeze(["render", "isActive", "whenReady", "prepare", "getStatus",
  "loseContext", "restoreContext", "setViewMotion", "dispose"]);

export class InactiveSceneLayer {
  render() {}

  isActive() {
    return false;
  }

  whenReady() {
    return Promise.resolve(false);
  }

  prepare() {}

  getStatus() {
    return { state: "inactive" };
  }

  loseContext() {}

  restoreContext() {}

  setViewMotion() {}

  dispose() {}
}
