export class RodLineRenderer {
  #surface;

  constructor({ surface }) {
    if (!surface || typeof surface.quadraticCurveTo !== "function") {
      throw new TypeError("RodLineRenderer requires surface");
    }
    this.#surface = surface;
  }

  // The rectangle is the rod only without an animated skin (spec 099); the line always starts at the rod tip.
  render(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    if (model.rodMode === "rectangle") {
      surface.fillStyle = "#000000";
      surface.fillRect(
        model.rodBaseX - model.rodWidth / 2,
        model.rodTopY,
        model.rodWidth,
        model.rodHeight,
      );
    }
    if (!model.lineVisible) return;
    surface.save();
    surface.beginPath();
    surface.moveTo(model.lineStartX, model.lineStartY);
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
