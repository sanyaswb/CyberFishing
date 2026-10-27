// The time-of-day background has an opaque base phase and at most one translucent phase (timeOfDayLayers).
const LAYER_SPRITES = 2;
// Changes too small to see are not a reason to present a frame (spec 105 D3): a tenth of a backing pixel at ratio 2,
// and half an 8-bit step of opacity. The camera's easing ends in such steps for many frames.
const POSITION_EPSILON = 0.05;
const ALPHA_EPSILON = 1 / 510;

// The background kind on the WebGL scene (spec 105 D1): the world model's background layers as pooled sprites over the
// clear colour, in one render pass. update(world) reports whether anything visible changed, so the scene presents a
// frame only then (D3). The visible phases upload on the first frame; the location's other phases follow one per
// frame that uploads nothing else (D2). artDensity is the base texture's pixels per drawn logical pixel, which sets the
// scene's resolution (D4); null while nothing is drawn.
export class PixiBackgroundRenderer {
  #textures;
  #renderer;
  #sprites = [];
  #applied = [];
  #color = null;
  #artDensity = null;

  // stage: the scene's root container; textures: SceneTextureCache; renderer: the Pixi renderer (its clear colour).
  constructor({ pixi, stage, textures, renderer }) {
    if (typeof pixi?.Sprite !== "function" || typeof pixi.Container !== "function") {
      throw new TypeError("PixiBackgroundRenderer requires the Pixi namespace");
    }
    if (typeof textures?.get !== "function") throw new TypeError("PixiBackgroundRenderer requires textures");
    this.#textures = textures;
    this.#renderer = renderer;
    const container = new pixi.Container();
    for (let index = 0; index < LAYER_SPRITES; index += 1) {
      const sprite = new pixi.Sprite();
      sprite.visible = false;
      container.addChild(sprite);
      this.#sprites.push(sprite);
      this.#applied.push({ texture: null, x: 0, y: 0, width: 0, height: 0, alpha: 0 });
    }
    stage.addChild(container);
  }

  get artDensity() {
    return this.#artDensity;
  }

  // world: the frame's world model, or null when the background is not on the scene.
  update(world) {
    const visible = world?.visible === true;
    const texturesBefore = this.#textures.size;
    let changed = false;
    if (visible) {
      if (world.backgroundColor !== this.#color) {
        this.#renderer.background.color = world.backgroundColor;
        this.#color = world.backgroundColor;
        changed = true;
      }
    }
    this.#artDensity = null;
    for (let index = 0; index < LAYER_SPRITES; index += 1) {
      const layer = visible && index < world.backgroundLayers.count ? world.backgroundLayers.getAt(index) : null;
      const texture = layer ? this.#textures.get(layer.assetId) : null;
      if (this.#apply(index, texture ? layer : null, texture)) changed = true;
      if (index === 0 && texture && layer.height > 0) this.#artDensity = texture.height / layer.height;
    }
    if (visible && this.#textures.size === texturesBefore) this.#textures.prepareNext(world.backgroundAssetIds);
    return changed;
  }

  #apply(index, layer, texture) {
    const sprite = this.#sprites[index];
    const applied = this.#applied[index];
    if (!layer) {
      if (!sprite.visible) return false;
      sprite.visible = false;
      applied.texture = null;
      return true;
    }
    if (sprite.visible && applied.texture === texture && Math.abs(applied.x - layer.x) < POSITION_EPSILON &&
      Math.abs(applied.y - layer.y) < POSITION_EPSILON && Math.abs(applied.width - layer.width) < POSITION_EPSILON &&
      Math.abs(applied.height - layer.height) < POSITION_EPSILON && Math.abs(applied.alpha - layer.alpha) < ALPHA_EPSILON) {
      return false;
    }
    sprite.texture = texture;
    sprite.x = layer.x;
    sprite.y = layer.y;
    sprite.width = layer.width;
    sprite.height = layer.height;
    sprite.alpha = layer.alpha;
    sprite.visible = true;
    applied.texture = texture;
    applied.x = layer.x;
    applied.y = layer.y;
    applied.width = layer.width;
    applied.height = layer.height;
    applied.alpha = layer.alpha;
    return true;
  }
}
