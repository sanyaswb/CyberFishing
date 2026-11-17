// TK-324.3 (spec 179 D6): the emission's blur of the world alone (CONFIG.emission.screen.includeHud off) — one Pixi
// BlurFilter on the scene's stage instead of the DOM veil's backdrop-filter, which blurs every frame at the screen's full
// device resolution. Cost (docs/rendering.md rule 23): the stage renders into a texture at settings.resolution logical
// pixels per pixel (0.5 — a quarter of the logical pixels, 1/16 of a 2× phone's backing store), then 2 × quality blur
// passes at that size, then one draw to the screen.
// - filterArea is the screen (a rectangle rewritten only on resize), so Pixi never walks the stage's bounds; the edges
//   repeat (no padding, no transparent rim).
// - Strength in logical px (Pixi's blur reads the input's logical size), written only when it moves by a quarter pixel;
//   resolution and passes only on change. Below a quarter pixel the filter is taken off the stage: no pass at all.
// - The filter is made once; attaching and detaching happen only when the blur starts or ends (Pixi copies the list).
// - warm(): the layer's warm-up frame renders with the filter on, so its shaders compile under the loading screen.
const BLUR_EPSILON = 0.25;
const DEFAULT_RESOLUTION = 0.5;
const DEFAULT_QUALITY = 2;

export class PixiSceneBlur {
  #stage;
  #filter;
  #area;
  #attached = false;
  #strength = -1;
  #resolution = -1;
  #quality = -1;
  #width = -1;
  #height = -1;

  constructor({ pixi, stage }) {
    if (typeof pixi?.BlurFilter !== "function" || typeof pixi?.Rectangle !== "function") {
      throw new TypeError("PixiSceneBlur requires pixi.BlurFilter and pixi.Rectangle");
    }
    if (!stage) throw new TypeError("PixiSceneBlur requires the stage");
    this.#stage = stage;
    this.#filter = new pixi.BlurFilter({ strength: 0, quality: DEFAULT_QUALITY, resolution: DEFAULT_RESOLUTION });
    this.#filter.repeatEdgePixels = true;
    this.#area = new pixi.Rectangle(0, 0, 0, 0);
  }

  get status() {
    return { on: this.#attached, strength: this.#attached ? this.#strength : 0, resolution: this.#resolution,
      quality: this.#quality };
  }

  // blurPx: the blur now, logical px (0 — none); settings: CONFIG.emission.screen.blur.scene ({ resolution, quality });
  // width, height: the scene's logical size. Returns whether the scene must present a new frame.
  update(blurPx, settings, width, height) {
    const strength = Number(blurPx);
    if (!(strength >= BLUR_EPSILON)) {
      if (!this.#attached) return false;
      this.#detach();
      return true;
    }
    let changed = false;
    if (!this.#attached) {
      this.#attach();
      changed = true;
    }
    if (width !== this.#width || height !== this.#height) {
      this.#width = width;
      this.#height = height;
      this.#area.width = width;
      this.#area.height = height;
      changed = true;
    }
    const resolution = Math.min(1, Math.max(0.1, Number(settings?.resolution) || DEFAULT_RESOLUTION));
    if (resolution !== this.#resolution) {
      this.#resolution = resolution;
      this.#filter.resolution = resolution;
      changed = true;
    }
    const quality = Math.min(8, Math.max(1, Math.round(Number(settings?.quality) || DEFAULT_QUALITY)));
    if (quality !== this.#quality) {
      this.#quality = quality;
      this.#filter.quality = quality;
      changed = true;
    }
    if (Math.abs(strength - this.#strength) >= BLUR_EPSILON) {
      this.#strength = strength;
      this.#filter.strength = strength;
      changed = true;
    }
    return changed;
  }

  // The warm-up frame (PixiSceneLayer #init): on with a small strength; reset() takes it off after that render.
  warm(width, height) {
    this.update(1, null, width, height);
  }

  reset() {
    if (this.#attached) this.#detach();
  }

  dispose() {
    this.reset();
    this.#filter.destroy?.();
  }

  #attach() {
    this.#attached = true;
    this.#stage.filterArea = this.#area;
    this.#stage.filters = this.#filter;
  }

  #detach() {
    this.#attached = false;
    this.#strength = -1;
    this.#stage.filters = null;
  }
}
