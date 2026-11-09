const MAX_TEXTURE_SIZE = 4096;

// The skeleton's surface inside the WebGL scene (spec 107 D6): a coordinate space, not a canvas. The rod and boat
// controllers size it to the skeleton's bounds in device pixels and place the skeleton in it, and the scene's renderers
// map it onto the screen at the anchor's destination. It is "lost" while the scene does not draw the kind (no WebGL, a
// lost context, the "canvas" mode): the controller then shows the static picture, which the 2D reserve draws (spec
// 170). Pixi restores its own GPU resources after a context loss, so there is nothing to restore here.
export class SceneSkeletalSurface {
  #drawsRod;
  #getWebGLVersion;
  #width = 1;
  #height = 1;

  // drawsRod: () => whether the scene draws the rod kind; getWebGLVersion: () => 1 | 2 | null.
  constructor({ drawsRod, getWebGLVersion }) {
    if (typeof drawsRod !== "function") throw new TypeError("SceneSkeletalSurface requires drawsRod");
    if (typeof getWebGLVersion !== "function") throw new TypeError("SceneSkeletalSurface requires getWebGLVersion");
    this.#drawsRod = drawsRod;
    this.#getWebGLVersion = getWebGLVersion;
  }

  get width() {
    return this.#width;
  }

  get height() {
    return this.#height;
  }

  get maxTextureSize() {
    return MAX_TEXTURE_SIZE;
  }

  get isWebGl2() {
    return this.#getWebGLVersion() === 2;
  }

  ensureContext() {
    return this.#getWebGLVersion() !== null;
  }

  isContextLost() {
    return this.#drawsRod() !== true;
  }

  // WebGL 1 mipmaps only power-of-two textures.
  canMipmap(width, height) {
    const powerOfTwo = (value) => value > 0 && (value & (value - 1)) === 0;
    return this.isWebGl2 || (powerOfTwo(width) && powerOfTwo(height));
  }

  resize(width, height) {
    this.#width = Math.max(1, Math.ceil(Number(width) || 1));
    this.#height = Math.max(1, Math.ceil(Number(height) || 1));
  }

  dispose() {}
}
