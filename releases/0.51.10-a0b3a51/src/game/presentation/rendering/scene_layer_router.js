import { RenderComponent } from "../../../engine/rendering/render_component.js";

export const SCENE_MODES = Object.freeze(["canvas", "webgl"]);

// World object kinds in depth order, bottom first (spec 104 D4, docs/rendering.md rule 14). HUD overlays (casting
// guides, the invalid-cast marker, HUD bars, outcome screens) are not kinds: they stay on the 2D canvas. Optional
// scene annotations are composed above world kinds by the active scene renderer and use 2D only on fallback.
export const SCENE_KINDS = Object.freeze(["background", "world-entities", "fight-areas", "line", "rod", "float"]);

// Which layer draws each world kind (spec 104 D3): the WebGL scene or the 2D canvas. update() decides once per frame,
// before either layer draws. A kind is on the scene only when the mode is "webgl", the scene layer is active (WebGL
// running, context not lost), the scene has a renderer for the kind, and every kind under it is on the scene too:
// everything in the scene is under everything on the 2D canvas. Otherwise the kind stays on the 2D canvas, whose path
// stays complete, so losing WebGL falls back to it at the next frame.
export class SceneLayerRouter {
  #kinds;
  #sceneKinds;
  #isSceneActive;
  #mode;
  #rendersScene = false;
  #onScene = new Set();
  #canvasVisibility = new Map();

  // sceneKinds: the kinds the scene layer can draw; isSceneActive(): the scene layer's isActive.
  constructor({ kinds, sceneKinds, isSceneActive, mode }) {
    if (!Array.isArray(kinds) || kinds.length === 0 || new Set(kinds).size !== kinds.length) {
      throw new TypeError("SceneLayerRouter requires unique kinds in depth order");
    }
    if (!Array.isArray(sceneKinds) || sceneKinds.some((kind) => !kinds.includes(kind))) {
      throw new TypeError("SceneLayerRouter requires scene kinds from its kinds");
    }
    if (typeof isSceneActive !== "function") throw new TypeError("SceneLayerRouter requires isSceneActive");
    this.#kinds = Object.freeze(kinds.slice());
    this.#sceneKinds = new Set(sceneKinds);
    this.#isSceneActive = isSceneActive;
    this.setMode(mode);
  }

  get mode() {
    return this.#mode;
  }

  // The DEV runtime switch (spec 104 D5); it applies from the next update().
  setMode(mode) {
    if (!SCENE_MODES.includes(mode)) throw new TypeError(`SceneLayerRouter mode must be one of ${SCENE_MODES.join(", ")}`);
    this.#mode = mode;
  }

  update() {
    this.#onScene.clear();
    if (this.#mode === "webgl" && this.#isSceneActive() === true) {
      for (const kind of this.#kinds) {
        if (!this.#sceneKinds.has(kind)) break;
        this.#onScene.add(kind);
      }
    }
    this.#rendersScene = this.#onScene.size > 0;
  }

  // Whether the scene layer draws this frame: only while a kind is on it. A scene with nothing to draw keeps its last
  // (warm-up) frame instead of presenting an unchanged WebGL frame every frame (docs/rendering.md rule 22).
  rendersScene() {
    return this.#rendersScene;
  }

  drawsOnScene(kind) {
    return this.#onScene.has(kind);
  }

  // The 2D canvas starts each frame cleared only when its bottom kind no longer paints it (spec 104 D6).
  clearsCanvas() {
    return this.#onScene.has(this.#kinds[0]);
  }

  // RenderComponent visibility for a kind's 2D component: its own visibility, while the kind is on the 2D canvas.
  canvasVisibility(kind) {
    if (!this.#kinds.includes(kind)) throw new TypeError(`SceneLayerRouter has no kind ${kind}`);
    let visibility = this.#canvasVisibility.get(kind);
    if (!visibility) {
      visibility = (model) => !this.#onScene.has(kind) && RenderComponent.defaultIsVisible(model);
      this.#canvasVisibility.set(kind, visibility);
    }
    return visibility;
  }

  // DEV view of the current decision, bottom first.
  getRouting() {
    return this.#kinds.map((kind) => ({ kind, layer: this.#onScene.has(kind) ? "scene" : "canvas",
      sceneRenderer: this.#sceneKinds.has(kind) }));
  }
}
