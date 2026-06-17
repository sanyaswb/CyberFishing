class RodLineRenderer {
  #surface;

  constructor({ surface }) {
    if (!surface || typeof surface.quadraticCurveTo !== "function") {
      throw new TypeError("RodLineRenderer requires surface");
    }
    this.#surface = surface;
  }

  render(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    surface.fillStyle = "#000000";
    surface.fillRect(
      model.rodBaseX - model.rodWidth / 2,
      model.rodTopY,
      model.rodWidth,
      model.rodHeight,
    );
    if (!model.lineVisible) return;
    surface.save();
    surface.beginPath();
    surface.moveTo(model.rodBaseX, model.rodTopY);
    surface.quadraticCurveTo(
      model.controlX,
      model.controlY,
      model.targetX,
      model.targetY,
    );
    surface.strokeStyle = model.lineColor;
    surface.lineWidth = model.lineWidth;
    surface.stroke();
    surface.restore();
  }
}
