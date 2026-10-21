import { WaterWaveField } from "./water_wave_field.js";

// The displacement map's size (spec 106 D2): about 13 art pixels per texel across the test location's water, enough
// for the shortest far waves; the filter interpolates it. One step: ~0.15 ms of JavaScript and a 36 KB upload.
const MAP_WIDTH = 192;
const MAP_HEIGHT = 48;
const LAYER_SPRITES = 2;

// Ripples on the water (spec 106): a copy of the background's layers inside the water area, drawn over the background
// through Pixi's DisplacementFilter, whose map (WaterWaveField) is refilled and uploaded at the water's own frame rate.
// Between steps nothing changes, so the scene presents a frame only on a step or when the background itself changed
// (spec 105 D3). The water area is the location's castable zones (world.clipRegions), clipped to the screen as the
// filter area so only visible water is filtered. The pattern drifts with the location's current (world.current, times
// currentScale, D9). Settings are read every frame, so DEV edits apply at once.
export class PixiWaterRenderer {
  #textures;
  #getSettings;
  #container;
  #sprites = [];
  #field;
  #mapCanvas;
  #mapContext;
  #mapImage;
  #mapTexture;
  #mapSprite;
  #filter;
  #filterArea = { x: 0, y: 0, width: 0, height: 0 };
  #area = { left: 0, top: 0, right: 0, bottom: 0 };
  #visible = false;
  #lastStepAt = null;
  #stepMs = 0;
  #driftX = 0;
  #driftY = 0;
  #driftSpeed = 0;
  #metric = null;

  // stage: the scene's root container (the water goes over the background); textures: the scene's SceneTextureCache;
  // documentTarget: makes the map's canvas; getSettings: () => CONFIG.canvas.water.
  constructor({ pixi, stage, textures, documentTarget, getSettings }) {
    if (typeof pixi?.DisplacementFilter !== "function") throw new TypeError("PixiWaterRenderer requires the Pixi namespace");
    if (typeof textures?.get !== "function") throw new TypeError("PixiWaterRenderer requires textures");
    if (typeof getSettings !== "function") throw new TypeError("PixiWaterRenderer requires getSettings");
    this.#textures = textures;
    this.#getSettings = getSettings;
    this.#field = new WaterWaveField({ width: MAP_WIDTH, height: MAP_HEIGHT });
    this.#mapCanvas = documentTarget.createElement("canvas");
    this.#mapCanvas.width = MAP_WIDTH;
    this.#mapCanvas.height = MAP_HEIGHT;
    this.#mapContext = this.#mapCanvas.getContext("2d");
    this.#mapImage = this.#mapContext.createImageData(MAP_WIDTH, MAP_HEIGHT);
    this.#mapTexture = pixi.Texture.from(this.#mapCanvas, true);
    this.#mapSprite = new pixi.Sprite(this.#mapTexture);
    this.#filter = new pixi.DisplacementFilter({ sprite: this.#mapSprite, scale: 0 });
    this.#container = new pixi.Container();
    for (let index = 0; index < LAYER_SPRITES; index += 1) {
      const sprite = new pixi.Sprite();
      sprite.visible = false;
      this.#container.addChild(sprite);
      this.#sprites.push(sprite);
    }
    this.#container.filters = [this.#filter];
    this.#container.filterArea = this.#filterArea;
    this.#container.visible = false;
    stage.addChild(this.#container);
    // The filter reads the map sprite's world transform, so the sprite lives in the scene (the filter makes it
    // non-renderable).
    stage.addChild(this.#mapSprite);
  }

  // For DEV: whether the water animates, the map size, the last step's JavaScript time and the drift speed (art px/s).
  get status() {
    return { active: this.#visible, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT, stepMs: this.#stepMs,
      driftSpeed: this.#driftSpeed };
  }

  // world: the frame's world model, or null when the background is not on the scene; viewWidth / viewHeight: the
  // logical screen; nowMs: the frame's clock. Returns whether the water changed what the scene shows.
  update(world, viewWidth, viewHeight, nowMs) {
    const settings = this.#getSettings();
    const base = world?.visible === true && settings?.enabled === true && world.backgroundLayers.count > 0
      ? world.backgroundLayers.getAt(0) : null;
    const baseTexture = base ? this.#textures.get(base.assetId) : null;
    const area = baseTexture ? this.#waterArea(world.clipRegions) : null;
    const left = area ? Math.max(0, area.left) : 0;
    const top = area ? Math.max(0, area.top) : 0;
    const width = area ? Math.min(viewWidth, area.right) - left : 0;
    const height = area ? Math.min(viewHeight, area.bottom) - top : 0;
    if (!(width > 0 && height > 0)) return this.#hide();
    const wasVisible = this.#visible;
    this.#visible = true;
    this.#container.visible = true;
    for (let index = 0; index < LAYER_SPRITES; index += 1) {
      const layer = index < world.backgroundLayers.count ? world.backgroundLayers.getAt(index) : null;
      this.#applyLayer(this.#sprites[index], layer, index === 0 ? baseTexture : layer && this.#textures.get(layer.assetId));
    }
    this.#filterArea.x = left;
    this.#filterArea.y = top;
    this.#filterArea.width = width;
    this.#filterArea.height = height;
    this.#mapSprite.x = area.left;
    this.#mapSprite.y = area.top;
    this.#mapSprite.width = area.right - area.left;
    this.#mapSprite.height = area.bottom - area.top;
    // Settings are in art pixels; the art is drawn at base.width / its own width logical pixels per art pixel. The
    // filter shifts by half its scale at full map values.
    const artScale = base.width / baseTexture.width;
    this.#filter.scale.x = 2 * Math.max(0, Number(settings.amplitude) || 0) * artScale;
    this.#filter.scale.y = this.#filter.scale.x * Math.max(0, Number(settings.verticalShare) || 0);
    const metric = world.waterPlane?.metric ?? null;
    const stepDue = this.#lastStepAt === null || metric !== this.#metric ||
      nowMs - this.#lastStepAt >= 1000 / Math.max(1, Number(settings.frameRate) || 1);
    if (stepDue) {
      this.#metric = metric;
      this.#drift(world.current, settings, nowMs);
      this.#step(nowMs, settings, (area.right - area.left) / artScale, (area.bottom - area.top) / artScale, world.waterPlane);
    }
    return stepDue || !wasVisible;
  }

  dispose() {
    this.#mapTexture.destroy(true);
  }

  // The current carries the pattern by its velocity over the time since the last step, so a changed current or scale
  // changes the speed from now on without a jump.
  #drift(current, settings, nowMs) {
    const scale = Math.max(0, Number(settings.currentScale) || 0);
    const velocityX = (Number(current?.x) || 0) * scale;
    const velocityY = (Number(current?.y) || 0) * scale;
    const elapsedSec = this.#lastStepAt === null ? 0 : Math.max(0, nowMs - this.#lastStepAt) / 1000;
    this.#driftX += velocityX * elapsedSec;
    this.#driftY += velocityY * elapsedSec;
    this.#driftSpeed = Math.hypot(velocityX, velocityY);
  }

  #step(nowMs, settings, artWidth, artHeight, plane) {
    const started = performance.now();
    this.#lastStepAt = nowMs;
    const pixels = this.#field.write(nowMs / 1000, { artWidth, artHeight, wavelength: Number(settings.wavelength) || 1,
      speed: Number(settings.speed) || 0, driftX: this.#driftX, driftY: this.#driftY, plane });
    this.#mapImage.data.set(pixels);
    this.#mapContext.putImageData(this.#mapImage, 0, 0);
    this.#mapTexture.source.update();
    this.#stepMs = performance.now() - started;
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#container.visible = false;
    this.#lastStepAt = null;
    return true;
  }

  #applyLayer(sprite, layer, texture) {
    if (!layer || !texture) {
      sprite.visible = false;
      return;
    }
    sprite.texture = texture;
    sprite.x = layer.x;
    sprite.y = layer.y;
    sprite.width = layer.width;
    sprite.height = layer.height;
    sprite.alpha = layer.alpha;
    sprite.visible = true;
  }

  // The bounding box of the castable zones (reused), or null when there are none.
  #waterArea(regions) {
    if (!regions || regions.count === 0) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let index = 0; index < regions.count; index += 1) {
      const region = regions.getAt(index);
      left = Math.min(left, region.x);
      top = Math.min(top, region.y);
      right = Math.max(right, region.x + region.width);
      bottom = Math.max(bottom, region.y + region.height);
    }
    if (!(right > left && bottom > top)) return null;
    const area = this.#area;
    area.left = left;
    area.top = top;
    area.right = right;
    area.bottom = bottom;
    return area;
  }
}
