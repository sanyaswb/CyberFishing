const MAX_TEXTURE_SIZE = 4096;

// The rod's surface while the WebGL scene draws it (spec 107 D6): a coordinate space, not a canvas. RodAnimationController
// sizes it to the skeleton's bounds in device pixels and places the skeleton in it exactly as in the offscreen GL
// surface of spec 099 (SpineGlSurface's interface), and the scene's rod renderer maps it onto the screen at the
// anchor's destination. It is "lost" while the scene does not draw the rod (no WebGL, a lost context, the DEV switch
// to the 2D canvas): the controller then shows the static picture, which the 2D canvas draws. Pixi restores its own
// GPU resources after a context loss, so there is nothing to restore here.
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

  // There is no canvas to copy: the scene draws the skeleton itself.
  get canvas() {
    return null;
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

  // WebGL 1 mipmaps only power-of-two textures, as SpineGlSurface decides.
  canMipmap(width, height) {
    const powerOfTwo = (value) => value > 0 && (value & (value - 1)) === 0;
    return this.isWebGl2 || (powerOfTwo(width) && powerOfTwo(height));
  }

  resize(width, height) {
    this.#width = Math.max(1, Math.ceil(Number(width) || 1));
    this.#height = Math.max(1, Math.ceil(Number(height) || 1));
  }

  onContextChange() {
    return () => {};
  }

  dispose() {}
}
