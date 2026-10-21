import { SceneChangeFingerprint } from "./scene_change_fingerprint.js";

const GLOW_TEXTURE_PX = 64;
// Canvas 2D's shadowBlur is a Gaussian of standard deviation blur / 2, fading out at about three of them on each side.
const GLOW_REACH = 1.5;

// The float kind on the scene (spec 107): the tackle at the line's end in FloatRenderer's shapes (hooked marker,
// lure dot, feeder ellipse, float body turned by its tilt) and colour. Canvas 2D's glow (shadowBlur in the tackle's
// colour) becomes a soft radial halo sprite tinted that colour and sized to the shape plus the blur's reach (spec 107
// D5), drawn under the shape: no filter pass.
//
// An image float (spec 127) is one sprite whose own texture frame shows the top visibleShare of the art (the part
// above the water), anchored at its bottom centre on the waterline point and turned by the roll: it sinks without
// stretching, without a mask or filter. A night float adds its tip glow (art pre-blurred and green) as a second
// cropped sprite with additive blending.
export class PixiFloatRenderer {
  #pixi;
  #textures;
  #container;
  #glow;
  #shape;
  #body;
  #tipGlow;
  #bodyFrame = null;
  #tipGlowFrame = null;
  #glowTexture;
  #fingerprint = new SceneChangeFingerprint();
  #visible = false;

  // textures: the scene's SceneTextureCache (image floats); without it every float is a bar.
  constructor({ pixi, stage, documentTarget, textures = null }) {
    if (typeof pixi?.Graphics !== "function") throw new TypeError("PixiFloatRenderer requires the Pixi namespace");
    if (typeof documentTarget?.createElement !== "function") throw new TypeError("PixiFloatRenderer requires documentTarget");
    this.#pixi = pixi;
    this.#textures = textures;
    this.#container = new pixi.Container();
    this.#glowTexture = PixiFloatRenderer.#createGlowTexture(pixi, documentTarget);
    this.#glow = new pixi.Sprite(this.#glowTexture);
    this.#glow.anchor.set(0.5, 0.5);
    this.#shape = new pixi.Graphics();
    this.#body = new pixi.Sprite();
    this.#body.anchor.set(0.5, 1);
    this.#body.visible = false;
    this.#tipGlow = new pixi.Sprite();
    this.#tipGlow.anchor.set(0.5, 1);
    this.#tipGlow.blendMode = "add";
    this.#tipGlow.visible = false;
    this.#container.addChild(this.#glow, this.#shape, this.#body, this.#tipGlow);
    this.#container.visible = false;
    stage.addChild(this.#container);
  }

  // model: the frame's fishing.float, or null when the kind is not on the scene. Returns whether it changed.
  update(model) {
    if (!model?.visible || !model.kind) return this.#hide();
    const image = model.kind === "float" && model.imageId ? this.#textures?.get(model.imageId) ?? null : null;
    const tipGlow = image && model.tipGlowId ? this.#textures.get(model.tipGlowId) ?? null : null;
    if (!this.#fingerprintOf(model, image, tipGlow) && this.#visible) return false;
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
    this.#body.visible = false;
    this.#tipGlow.visible = false;
    if (image) {
      width = this.#placeImageFloat(model, image, tipGlow);
      height = model.height;
      centerY = -height / 2;
    } else if (model.kind === "hooked" || model.kind === "float") {
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
    if (!image) shape.fill(model.color);
    const glow = this.#glow;
    glow.visible = model.glow === true && model.glowBlur > 0 && height > 0;
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
    this.#bodyFrame?.texture.destroy(false);
    this.#tipGlowFrame?.texture.destroy(false);
    this.#glowTexture.destroy(true);
  }

  // Shows the top visibleShare of the art and, at night, the tip glow; returns the drawn width.
  #placeImageFloat(model, image, tipGlow) {
    const share = Math.max(0, Math.min(1, model.visibleShare));
    const artWidth = image.source.width;
    const artHeight = image.source.height;
    const height = model.bodyHeight;
    const width = height * artWidth / artHeight;
    if (!(share > 0) || !(height > 0)) return width;
    this.#bodyFrame = this.#cropTo(this.#bodyFrame, image, artHeight * share);
    const body = this.#body;
    body.texture = this.#bodyFrame.texture;
    body.visible = true;
    body.rotation = model.rotationRad;
    body.width = width;
    body.height = height * share;
    if (tipGlow) {
      // The glow art is the float art padded by tipGlowPad art pixels on the sides and the top.
      const pad = model.tipGlowPad;
      const ratio = tipGlow.source.height / (artHeight + pad);
      const toScreen = height / artHeight;
      this.#tipGlowFrame = this.#cropTo(this.#tipGlowFrame, tipGlow, (pad + artHeight * share) * ratio);
      const sprite = this.#tipGlow;
      sprite.texture = this.#tipGlowFrame.texture;
      sprite.visible = true;
      sprite.rotation = model.rotationRad;
      sprite.width = width + 2 * pad * toScreen;
      sprite.height = height * share + pad * toScreen;
    }
    return width;
  }

  // A texture over the source's top `frameHeight` pixels, reused while the source stays the same.
  #cropTo(current, source, frameHeight) {
    let crop = current;
    if (!crop || crop.source !== source) {
      crop?.texture.destroy(false);
      const frame = new this.#pixi.Rectangle(0, 0, source.source.width, source.source.height);
      crop = { source, texture: new this.#pixi.Texture({ source: source.source, frame }) };
    }
    const height = Math.max(1, Math.min(source.source.height, frameHeight));
    if (crop.texture.frame.height !== height) {
      crop.texture.frame.height = height;
      crop.texture.update();
    }
    return crop;
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#container.visible = false;
    this.#fingerprint.invalidate();
    return true;
  }

  #fingerprintOf(model, image, tipGlow) {
    const print = this.#fingerprint;
    print.begin();
    print.text(model.kind); print.text(model.color); print.flag(model.glow); print.length(model.glowBlur);
    print.length(model.x); print.length(model.y); print.length(model.width); print.length(model.height);
    print.length(model.radius); print.length(model.radiusX); print.length(model.radiusY);
    print.length(model.rotationRad * 100);
    print.flag(image !== null); print.flag(tipGlow !== null);
    if (image) { print.length(model.bodyHeight); print.alpha(model.visibleShare); }
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
