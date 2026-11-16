import { regionsBounds } from "../../../engine/math/rectangle_bounds.js";
import { ZoneRectMask } from "./zone_rect_mask.js";
import { WaterWaveField } from "./water_wave_field.js";

// The displacement map's size (spec 106 D2): about 13 art pixels per texel across the test location's water, enough
// for the shortest far waves; the filter interpolates it. One step: ~0.15 ms of JavaScript and a 36 KB upload.
const MAP_WIDTH = 192;
const MAP_HEIGHT = 48;
// The background's layers copied into the water: base, time-of-day overlay and the emission (spec 179 D4).
const LAYER_SPRITES = 3;

// Ripples on the water (spec 106): a copy of the background's layers inside the water area, drawn over the background
// through Pixi's DisplacementFilter, whose map (WaterWaveField) is refilled and uploaded at the water's own frame rate.
// Between steps nothing changes, so the scene presents a frame only on a step or when the background itself changed
// (spec 105 D3). The water area is the location's castable zones (world.clipRegions): their bounding box, clipped to the
// screen, is the filter area, so only visible water is filtered; with several zones a mask of the zones clips the
// filtered copy and the waves fade at each zone's edges, so the art between zones stays still (TK-066). Spec 180 D9
// (owner): the current flows under the waves and never moves them; the waves travel with the wind (sea.travel).
// lateralContraction: the waves narrow across the screen with the depth's perspective (on) or keep their width (off).
// Settings are read every frame, so DEV edits apply at once.
export class PixiWaterRenderer {
  #textures;
  #getSettings;
  #getWakeSettings;
  #wakeArea = { left: 0, top: 0, right: 0, bottom: 0 };
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
  #getImageSize;
  // TK-358: the zones' mask of the filtered copy (shared ZoneRectMask).
  #mask;
  #shares = [];
  #visible = false;
  #lastStepAt = null;
  #stepMs = 0;
  #driftX = 0;
  #driftY = 0;
  #driftSpeed = 0;
  // Spec 172 D7: how far the crests have travelled (art px at the near edge), integrated from the sea state's speed and
  // direction, so a wind change turns the waves without a jump; the sea state of the last step (DEV status).
  #travelPx = 0;
  #sea = { amplitudeScale: 1, speedScale: 1, wavelengthScale: 1, travel: 1 };
  // TK-290: the waves' height as a share of the map's range (0 with the waves switched off) and the ripples' conversion
  // into that range, so they keep their size whatever the waves and the sea do.
  #waveShare = 1;
  #rippleScale = 1;
  #metric = null;
  #getRainRipples;

  // stage: the scene's root container (the water goes over the background); textures: the scene's SceneTextureCache;
  // documentTarget: makes the map's canvas; getSettings: () => CONFIG.canvas.water; getWakeSettings: () =>
  // CONFIG.ui.boat.wake.water (spec 156: the boat's wake bends the water); getRainRipples: () => the rain's rings as
  // ripple puffs with their settings ({ puffs, settings }) or null (spec 172 D4).
  constructor({ pixi, stage, textures, documentTarget, getSettings, getWakeSettings = () => null, getImageSize = null,
    getRainRipples = () => null }) {
    if (typeof pixi?.DisplacementFilter !== "function") throw new TypeError("PixiWaterRenderer requires the Pixi namespace");
    if (typeof textures?.get !== "function") throw new TypeError("PixiWaterRenderer requires textures");
    if (typeof getSettings !== "function") throw new TypeError("PixiWaterRenderer requires getSettings");
    this.#textures = textures;
    this.#getSettings = getSettings;
    this.#getWakeSettings = getWakeSettings;
    this.#getImageSize = typeof getImageSize === "function" ? getImageSize : null;
    this.#getRainRipples = getRainRipples;
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
    // TK-066: the zones' outline. Pixi applies a container's masks before its filters (effect priority 0 < 1), so the
    // mask clips the filtered result; the mask lives in the scene for its transform and bounds and is not drawn itself.
    this.#mask = new ZoneRectMask({ pixi, target: this.#container });
    this.#mask.mount(stage);
  }

  // For DEV: whether the water animates, the map size, the last step's JavaScript time and the drift speed (art px/s).
  get status() {
    return { active: this.#visible, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT, stepMs: this.#stepMs,
      driftSpeed: this.#driftSpeed, sea: this.#sea };
  }

  // world: the frame's world model, or null when the background is not on the scene; viewWidth / viewHeight: the
  // logical screen; nowMs: the frame's clock. Returns whether the water changed what the scene shows.
  update(world, viewWidth, viewHeight, nowMs) {
    const settings = this.#getSettings();
    const base = world?.visible === true && settings?.enabled === true && world.backgroundLayers.count > 0
      ? world.backgroundLayers.getAt(0) : null;
    const baseTexture = base ? this.#textures.get(base.assetId) : null;
    const area = baseTexture ? regionsBounds(world.clipRegions, this.#area) : null;
    const left = area ? Math.max(0, area.left) : 0;
    const top = area ? Math.max(0, area.top) : 0;
    const width = area ? Math.min(viewWidth, area.right) - left : 0;
    const height = area ? Math.min(viewHeight, area.bottom) - top : 0;
    if (!(width > 0 && height > 0)) return this.#hide();
    const reshaped = this.#clipToZones(world.clipRegions, area, world.waterPlane?.masked === true);
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
    // TK-183: when the background starts from a low-quality copy, the scale uses the registry's full image width so
    // the waves are never stretched.
    const fullWidth = this.#getImageSize?.(base.assetId)?.width || baseTexture.width;
    const artScale = base.width / fullWidth;
    // Spec 172 D7: the sea state (wind, night, storm) scales the waves. TK-290: the filter's range is the base amplitude
    // (times the sea's factor only above 1); the waves take their share of it (none when switched off) and the ripples
    // (boat, rain) keep the base amplitude as their unit, so they stay the same by day, at night and without waves.
    const sea = world.sea;
    const seaAmplitude = Math.max(0, Number(sea?.amplitudeScale ?? 1) || 0);
    const waves = settings.waves !== false;
    const range = waves ? Math.max(1, seaAmplitude) : 1;
    this.#waveShare = waves ? seaAmplitude / range : 0;
    this.#rippleScale = 1 / range;
    this.#filter.scale.x = 2 * Math.max(0, Number(settings.amplitude) || 0) * range * artScale;
    this.#filter.scale.y = this.#filter.scale.x * Math.max(0, Number(settings.verticalShare) || 0);
    const metric = world.waterPlane?.metric ?? null;
    const stepDue = this.#lastStepAt === null || metric !== this.#metric || reshaped ||
      nowMs - this.#lastStepAt >= 1000 / Math.max(1, Number(settings.frameRate) || 1);
    if (stepDue) {
      this.#metric = metric;
      this.#drift(world.current, settings, nowMs, sea);
      this.#step(nowMs, settings, (area.right - area.left) / artScale, (area.bottom - area.top) / artScale, world.waterPlane,
        world.boatWake, area);
    }
    return stepDue || !wasVisible;
  }

  dispose() {
    this.#mapTexture.destroy(true);
  }

  // The waves travel with the wind (sea.travel, integrated so a change of speed or direction never jumps). Spec 180 D9:
  // the current no longer moves the pattern.
  #drift(current, settings, nowMs, sea) {
    void current;
    const elapsedSec = this.#lastStepAt === null ? 0 : Math.max(0, nowMs - this.#lastStepAt) / 1000;
    this.#driftSpeed = 0;
    const speedScale = Math.max(0, Number(sea?.speedScale ?? 1) || 0);
    const travel = Math.max(-1, Math.min(1, Number(sea?.travel ?? 1)));
    this.#travelPx += Math.max(0, Number(settings.speed) || 0) * speedScale * travel * elapsedSec;
    this.#sea.amplitudeScale = Number(sea?.amplitudeScale ?? 1);
    this.#sea.speedScale = speedScale;
    this.#sea.wavelengthScale = Number(sea?.wavelengthScale ?? 1);
    this.#sea.travel = travel;
  }

  #step(nowMs, settings, artWidth, artHeight, plane, wake, area) {
    const started = performance.now();
    this.#lastStepAt = nowMs;
    const variation = settings.variation?.enabled === true ? settings.variation : null;
    let pixels = this.#field.write(nowMs / 1000, { artWidth, artHeight,
      wavelength: (Number(settings.wavelength) || 1) * Math.max(0.1, Number(this.#sea.wavelengthScale) || 1),
      speed: Number(settings.speed) || 0, driftX: this.#driftX, driftY: this.#driftY, plane, travelPx: this.#travelPx,
      variation, amplitude: this.#waveShare, lateralContraction: settings.lateralContraction !== false });
    const wakeArea = this.#wakeArea;
    wakeArea.left = area.left; wakeArea.top = area.top; wakeArea.right = area.right; wakeArea.bottom = area.bottom;
    pixels = this.#field.addRipples(wake, wakeArea, this.#getWakeSettings(), this.#rippleScale);
    const rain = this.#getRainRipples();
    if (rain) pixels = this.#field.addRipples(rain.puffs, wakeArea, rain.settings, this.#rippleScale);
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

  // Several zones: the mask is rebuilt only when their screen rectangles change (a camera move), and the wave field's
  // regions (shares of the bounding box, which a camera move keeps) only when the zones themselves change. One zone is
  // the whole box: no mask, the field's default region. Returns whether the field's regions changed.
  #clipToZones(regions, area, union) {
    const count = regions.count;
    const shares = this.#shares;
    shares.length = count * 4;
    const spanX = area.right - area.left, spanY = area.bottom - area.top;
    for (let index = 0; index < count; index += 1) {
      const region = regions.getAt(index);
      shares[index * 4] = (region.x - area.left) / spanX;
      shares[index * 4 + 1] = (region.y - area.top) / spanY;
      shares[index * 4 + 2] = (region.x + region.width - area.left) / spanX;
      shares[index * 4 + 3] = (region.y + region.height - area.top) / spanY;
    }
    const reshaped = this.#field.setRegions(shares, count, union);
    // Several zones: a mask of them clips the filtered copy; one zone needs none (its box is the filter area).
    if (count < 2) this.#mask.release();
    else this.#mask.clipTo(regions);
    return reshaped;
  }
}
