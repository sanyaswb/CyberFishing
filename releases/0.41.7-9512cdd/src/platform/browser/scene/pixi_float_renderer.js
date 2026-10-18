import { SceneChangeFingerprint } from "./scene_change_fingerprint.js";

const GLOW_TEXTURE_PX = 64;
// Canvas 2D's shadowBlur is a Gaussian of standard deviation blur / 2, fading out at about three of them on each side.
const GLOW_REACH = 1.5;

// The float kind on the scene (spec 107): the tackle at the line's end in FloatRenderer's shapes (hooked fish marker,
// lure dot, feeder ellipse, float body turned by its tilt) and colour. Canvas 2D's glow (shadowBlur in the tackle's
// colour) becomes a soft radial halo sprite tinted that colour and sized to the shape plus the blur's reach (spec 107
// D5), drawn under the shape: no filter pass.
export class PixiFloatRenderer {
  #container;
  #glow;
  #shape;
  #glowTexture;
  #fingerprint = new SceneChangeFingerprint();
  #visible = false;

  constructor({ pixi, stage, documentTarget }) {
    if (typeof pixi?.Graphics !== "function") throw new TypeError("PixiFloatRenderer requires the Pixi namespace");
    if (typeof documentTarget?.createElement !== "function") throw new TypeError("PixiFloatRenderer requires documentTarget");
    this.#container = new pixi.Container();
    this.#glowTexture = PixiFloatRenderer.#createGlowTexture(pixi, documentTarget);
    this.#glow = new pixi.Sprite(this.#glowTexture);
    this.#glow.anchor.set(0.5, 0.5);
    this.#shape = new pixi.Graphics();
    this.#container.addChild(this.#glow, this.#shape);
    this.#container.visible = false;
    stage.addChild(this.#container);
  }

  // model: the frame's fishing.float, or null when the kind is not on the scene. Returns whether it changed.
  update(model) {
    if (!model?.visible || !model.kind) return this.#hide();
    if (!this.#fingerprintOf(model) && this.#visible) return false;
    this.#visible = true;
    const container = this.#container;
    container.visible = true;
    container.x = model.x;
    container.y = model.y;
    const shape = this.#shape;
    shape.clear();
    shape.rotation = model.kind === "float" ? model.rotationRad : 0;
    let width = 0;
    let height = 0;
    let centerY = 0;
    if (model.kind === "hooked" || model.kind === "float") {
      shape.rect(-model.width / 2, -model.height, model.width, model.height);
      width = model.width;
      height = model.height;
      centerY = -model.height / 2;
    } else if (model.kind === "lure") {
      shape.circle(0, 0, model.radius);
      width = height = model.radius * 2;
    } else if (model.kind === "feeder") {
      shape.ellipse(0, 0, model.radiusX, model.radiusY);
      width = model.radiusX * 2;
      height = model.radiusY * 2;
    }
    shape.fill(model.color);
    const glow = this.#glow;
    glow.visible = model.glow === true && model.glowBlur > 0;
    if (glow.visible) {
      const reach = model.glowBlur * GLOW_REACH * 2;
      glow.tint = model.color;
      glow.rotation = shape.rotation;
      glow.x = -Math.sin(shape.rotation) * centerY;
      glow.y = Math.cos(shape.rotation) * centerY;
      glow.width = width + reach;
      glow.height = height + reach;
    }
    return true;
  }

  dispose() {
    this.#glowTexture.destroy(true);
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#container.visible = false;
    this.#fingerprint.invalidate();
    return true;
  }

  #fingerprintOf(model) {
    const print = this.#fingerprint;
    print.begin();
    print.text(model.kind); print.text(model.color); print.flag(model.glow); print.length(model.glowBlur);
    print.length(model.x); print.length(model.y); print.length(model.width); print.length(model.height);
    print.length(model.radius); print.length(model.radiusX); print.length(model.radiusY);
    print.length(model.rotationRad * 100);
    return print.finish();
  }

  // White in the middle fading to nothing at the edge, shaped like a blurred dot; tinted per float.
  static #createGlowTexture(pixi, documentTarget) {
    const canvas = documentTarget.createElement("canvas");
    canvas.width = GLOW_TEXTURE_PX;
    canvas.height = GLOW_TEXTURE_PX;
    const context = canvas.getContext("2d");
    const half = GLOW_TEXTURE_PX / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.85)");
    gradient.addColorStop(0.45, "rgba(255, 255, 255, 0.45)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, GLOW_TEXTURE_PX, GLOW_TEXTURE_PX);
    return pixi.Texture.from(canvas, true);
  }
}
