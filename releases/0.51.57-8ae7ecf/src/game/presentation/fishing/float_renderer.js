// The tackle at the line's end on the 2D canvas (the scene's fallback, spec 107): hooked marker, lure dot, feeder
// ellipse and the float. An image float (spec 127) draws only the top visibleShare of its art, from the waterline
// point up and turned by its roll, so it sinks without stretching; a night float adds its tip glow additively.
export class FloatRenderer {
  #surface;
  #images;

  // images: { tryGet(assetId) } (ImageAssetProvider) for image floats; without it every float is a bar.
  constructor({ surface, images = null }) {
    if (!surface || typeof surface.translate !== "function") {
      throw new TypeError("FloatRenderer requires surface");
    }
    this.#surface = surface;
    this.#images = images;
  }

  render(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    surface.save();
    surface.translate(model.x, model.y);
    surface.fillStyle = model.color;
    if (model.glow) {
      surface.shadowColor = model.glowColor || model.color;
      surface.shadowBlur = model.glowBlur;
    }
    if (model.kind === "hooked") {
      surface.fillRect(
        -model.width / 2,
        -model.height,
        model.width,
        model.height,
      );
    } else if (model.kind === "lure") {
      surface.beginPath();
      surface.arc(0, 0, model.radius, 0, Math.PI * 2);
      surface.fill();
    } else if (model.kind === "feeder") {
      surface.beginPath();
      surface.ellipse(
        0,
        0,
        model.radiusX,
        model.radiusY,
        0,
        0,
        Math.PI * 2,
      );
      surface.fill();
    } else if (model.kind === "float") {
      surface.rotate(model.rotationRad);
      const image = model.imageId ? this.#images?.tryGet(model.imageId) : null;
      if (image) this.#drawImageFloat(model, image);
      else surface.fillRect(-model.width / 2, -model.height, model.width, model.height);
    }
    surface.restore();
  }

  #drawImageFloat(model, image) {
    const share = model.visibleShare;
    if (!(share > 0) || !(model.bodyHeight > 0)) return;
    const surface = this.#surface;
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const height = model.bodyHeight;
    const width = height * imageWidth / imageHeight;
    surface.drawImage(image, 0, 0, imageWidth, imageHeight * share, -width / 2, -height * share, width, height * share);
    const glow = model.tipGlowId ? this.#images.tryGet(model.tipGlowId) : null;
    if (!glow) return;
    // The glow art is the float art padded by tipGlowPad art pixels on the sides and the top.
    const pad = model.tipGlowPad;
    const glowRatio = (glow.naturalHeight || glow.height) / (imageHeight + pad);
    const toScreen = height / imageHeight;
    surface.shadowBlur = 0;
    surface.setState({ globalCompositeOperation: "lighter" });
    surface.drawImage(glow, 0, 0, glow.naturalWidth || glow.width, (pad + imageHeight * share) * glowRatio,
      -width / 2 - pad * toScreen, -height * share - pad * toScreen, width + 2 * pad * toScreen,
      height * share + pad * toScreen);
  }
}
