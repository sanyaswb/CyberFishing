// GPU textures of the WebGL scene (spec 105 D2). Images that ImageAssetProvider already loaded become Pixi textures
// with mipmaps (art drawn smaller than its size, docs/rendering.md rules 5 and 20) and are uploaded at once, so no
// texture uploads in the middle of play. The cache owns them: dispose() releases every texture with the scene
// (rule 19). bytes estimates their GPU memory: RGBA, plus a third with mipmaps.
export class SceneTextureCache {
  #pixi;
  #images;
  #renderer;
  #entries = new Map();
  #bytes = 0;

  // images: { tryGet(assetId) } (ImageAssetProvider); renderer: the Pixi renderer that uploads the textures.
  constructor({ pixi, images, renderer }) {
    if (typeof pixi?.Texture?.from !== "function") throw new TypeError("SceneTextureCache requires the Pixi namespace");
    if (typeof images?.tryGet !== "function") throw new TypeError("SceneTextureCache requires images");
    if (typeof renderer?.texture?.initSource !== "function") throw new TypeError("SceneTextureCache requires a renderer");
    this.#pixi = pixi;
    this.#images = images;
    this.#renderer = renderer;
  }

  get size() {
    return this.#entries.size;
  }

  get bytes() {
    return this.#bytes;
  }

  // The texture for a loaded image, or null while the image is not ready. A reloaded image replaces its texture.
  get(assetId) {
    const image = this.#images.tryGet(assetId);
    if (!image) return null;
    let entry = this.#entries.get(assetId);
    if (entry && entry.image !== image) {
      this.#release(entry);
      entry = null;
    }
    if (!entry) {
      entry = this.#create(image);
      this.#entries.set(assetId, entry);
    }
    return entry.texture;
  }

  prepare(assetIds) {
    for (let index = 0; index < assetIds.length; index += 1) this.get(assetIds[index]);
  }

  dispose() {
    for (const entry of this.#entries.values()) this.#release(entry);
    this.#entries.clear();
  }

  #create(image) {
    const texture = this.#pixi.Texture.from({ resource: image, autoGenerateMipmaps: true }, true);
    this.#renderer.texture.initSource(texture.source);
    const bytes = texture.source.pixelWidth * texture.source.pixelHeight * 4 * (texture.source.autoGenerateMipmaps ? 4 / 3 : 1);
    this.#bytes += bytes;
    return { image, texture, bytes };
  }

  #release(entry) {
    this.#bytes -= entry.bytes;
    entry.texture.destroy(true);
  }
}
