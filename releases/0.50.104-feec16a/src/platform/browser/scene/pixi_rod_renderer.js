import { SceneChangeFingerprint } from "./scene_change_fingerprint.js";

// The rod kind on the scene (spec 107): in "spine" mode the skeleton's own Pixi display object (spine-pixi-v8, owned
// by the rod's SpineScene), placed where RodSpineRenderer used to copy the offscreen GL surface: the surface's top left
// at the anchor's destination, surface pixels scaled to logical ones; in "static" mode the skin's atlas region as a
// sprite over the setup bounds (a region stored rotated 90 degrees is turned back, as RodStaticRenderer does). The
// "rectangle" bar is the line kind's. A Spine pose changes every frame (the idle wind), so it always presents;
// the static picture presents only when it moved.
export class PixiRodRenderer {
  #pixi;
  #container;
  #sprite;
  #view = null;
  #pages = new Map();
  #regions = new Map();
  #fingerprint = new SceneChangeFingerprint();
  #visible = false;

  constructor({ pixi, stage }) {
    if (typeof pixi?.Sprite !== "function" || typeof pixi?.Rectangle !== "function") {
      throw new TypeError("PixiRodRenderer requires the Pixi namespace");
    }
    this.#pixi = pixi;
    this.#container = new pixi.Container();
    this.#sprite = new pixi.Sprite();
    this.#sprite.visible = false;
    this.#container.addChild(this.#sprite);
    this.#container.visible = false;
    stage.addChild(this.#container);
  }

  // model: the frame's fishing.rodLine, or null when the kind is not on the scene. Returns whether it changed.
  update(model) {
    const mode = model?.visible ? model.rodMode : "";
    const view = mode === "spine" ? model.rodView ?? null : null;
    this.#attach(view);
    if (view) return this.#placeView(model, view);
    if (mode === "static" && model.rodImage && model.rodRegion && model.rodBounds) return this.#drawStatic(model);
    return this.#hide();
  }

  dispose() {
    this.#attach(null);
    for (const byImage of this.#regions.values()) for (const texture of byImage.values()) texture.destroy(false);
    for (const texture of this.#pages.values()) texture.destroy(true);
    this.#regions.clear();
    this.#pages.clear();
  }

  // The view belongs to the rod's scene, which destroys it with the scene; the renderer only parents it.
  #attach(view) {
    if (view === this.#view) return;
    if (this.#view && this.#view.parent === this.#container) this.#container.removeChild(this.#view);
    this.#view = view;
    if (view) this.#container.addChild(view);
  }

  #placeView(model, view) {
    this.#show();
    this.#sprite.visible = false;
    view.visible = true;
    view.x = model.rodDestX;
    view.y = model.rodDestY;
    view.scale.set(model.rodViewScale, model.rodViewScale);
    this.#fingerprint.invalidate();
    return true;
  }

  #drawStatic(model) {
    const print = this.#fingerprint;
    print.begin();
    print.length(model.rodBaseX); print.length(model.rodBaseY); print.length(model.rodScale * 1000);
    const region = model.rodRegion;
    const bounds = model.rodBounds;
    print.length(region.x); print.length(region.y); print.length(region.width); print.length(region.height);
    print.length(region.rotate); print.length(bounds.x); print.length(bounds.y); print.length(bounds.width);
    print.length(bounds.height);
    const changed = print.finish() || !this.#visible || this.#sprite.texture !== this.#regionTexture(model.rodImage, region);
    if (!changed) return false;
    this.#show();
    const sprite = this.#sprite;
    const scale = model.rodScale;
    const left = model.rodBaseX + bounds.x * scale;
    const top = model.rodBaseY - (bounds.y + bounds.height) * scale;
    const width = bounds.width * scale;
    const height = bounds.height * scale;
    sprite.texture = this.#regionTexture(model.rodImage, region);
    sprite.visible = true;
    if (region.rotate === 90) {
      sprite.x = left + width;
      sprite.y = top;
      sprite.rotation = Math.PI / 2;
      sprite.width = height;
      sprite.height = width;
    } else {
      sprite.x = left;
      sprite.y = top;
      sprite.rotation = 0;
      sprite.width = width;
      sprite.height = height;
    }
    return true;
  }

  // A rotated region is stored in the page with its width and height swapped.
  #regionTexture(image, region) {
    const key = `${region.x},${region.y},${region.width},${region.height},${region.rotate}`;
    let byImage = this.#regions.get(image);
    if (!byImage) {
      byImage = new Map();
      this.#regions.set(image, byImage);
    }
    let texture = byImage.get(key);
    if (!texture) {
      let page = this.#pages.get(image);
      if (!page) {
        page = this.#pixi.Texture.from({ resource: image, autoGenerateMipmaps: true }, true);
        this.#pages.set(image, page);
      }
      const rotated = region.rotate === 90;
      const frame = new this.#pixi.Rectangle(region.x, region.y, rotated ? region.height : region.width,
        rotated ? region.width : region.height);
      texture = new this.#pixi.Texture({ source: page.source, frame });
      byImage.set(key, texture);
    }
    return texture;
  }

  #show() {
    this.#visible = true;
    this.#container.visible = true;
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#container.visible = false;
    this.#sprite.visible = false;
    this.#fingerprint.invalidate();
    return true;
  }
}
