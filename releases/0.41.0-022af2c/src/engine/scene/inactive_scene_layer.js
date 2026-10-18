// Scene layer port (spec 103): the WebGL scene drawn under the 2D game canvas. GameRenderCoordinator calls
// render(frame) once per frame, after the frame is built and before the 2D passes; the session disposes it.
// Production composes this inactive layer (no canvas, no work); DEV composes the Pixi layer for dev.html?scene=webgl.
export const SCENE_LAYER_METHODS = Object.freeze(["render", "dispose"]);

export class InactiveSceneLayer {
  render() {}

  dispose() {}
}
