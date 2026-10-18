// Scene layer port (specs 103, 104): the WebGL scene drawn under the 2D game canvas. GameRenderCoordinator calls
// render(frame) once per frame while the router lets the scene draw, after the frame is built and before the 2D
// passes; isActive() tells the router whether WebGL is running (otherwise every kind stays on the 2D canvas);
// whenReady() resolves once the layer has rendered its first (warm-up) frame, or will never render (false); the
// session disposes it. getStatus, loseContext and restoreContext serve DevTools "СЦЕНА WebGL" (fallback tests).
// Production's "canvas" mode composes this inactive layer: no canvas, no work.
export const SCENE_LAYER_METHODS = Object.freeze(["render", "isActive", "whenReady", "getStatus", "loseContext",
  "restoreContext", "dispose"]);

export class InactiveSceneLayer {
  render() {}

  isActive() {
    return false;
  }

  whenReady() {
    return Promise.resolve(false);
  }

  getStatus() {
    return { state: "inactive" };
  }

  loseContext() {}

  restoreContext() {}

  dispose() {}
}
