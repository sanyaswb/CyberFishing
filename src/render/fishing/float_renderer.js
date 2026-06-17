class FloatRenderer {
  #surface;

  constructor({ surface }) {
    if (!surface || typeof surface.translate !== "function") {
      throw new TypeError("FloatRenderer requires surface");
    }
    this.#surface = surface;
  }

  render(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    surface.save();
    surface.translate(model.x, model.y);
    surface.fillStyle = model.color;
    if (model.glow) {
      surface.shadowColor = model.color;
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
      surface.fillRect(
        -model.width / 2,
        -model.height,
        model.width,
        model.height,
      );
    }
    surface.restore();
  }
}
