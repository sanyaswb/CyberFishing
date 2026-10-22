export class WorldDebugRenderer {
  #surface;
  #sceneRouter;

  constructor({ surface, sceneRouter = null }) {
    if (!surface || typeof surface.drawImage !== "function") {
      throw new TypeError("WorldDebugRenderer requires surface");
    }
    this.#surface = surface;
    this.#sceneRouter = sceneRouter;
  }

  render(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    const annotations = model.annotations;
    if (annotations && !this.#sceneRouter?.drawsOnScene("background")) {
      this.#renderAnnotations(annotations);
    }
    if (model.debugImage.visible && model.debugImage.image) {
      const previousAlpha = surface.globalAlpha;
      surface.globalAlpha = model.debugImage.alpha;
      surface.drawImage(
        model.debugImage.image,
        model.debugImage.x,
        model.debugImage.y,
        model.debugImage.width,
        model.debugImage.height,
      );
      surface.globalAlpha = previousAlpha;
    }

    for (let zoneIndex = 0; zoneIndex < model.dynamicZones.count; zoneIndex += 1) {
      const zone = model.dynamicZones.getAt(zoneIndex);
      if (zone.hasBounds) {
        surface.fillStyle = "rgba(255, 100, 255, 0.1)";
        surface.strokeStyle = "rgba(255, 100, 255, 0.4)";
        surface.lineWidth = 1;
        for (let index = 0; index < zone.boundCount; index += 1) {
          const rect = zone.bounds[index];
          surface.fillRect(rect.x, rect.y, rect.width, rect.height);
          surface.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
      }
      surface.fillStyle = "rgba(0, 150, 255, 0.5)";
      surface.fillRect(zone.x, zone.y, zone.width, zone.height);
      surface.strokeStyle = "#00ffff";
      surface.lineWidth = 2;
      surface.strokeRect(zone.x, zone.y, zone.width, zone.height);
    }
  }

  #renderAnnotations(model) {
    const surface = this.#surface;
    if (model.cellLineCount) {
      surface.strokeStyle = `rgba(255, 255, 255, ${model.cellLineAlpha ?? 0.2})`;
      surface.lineWidth = 1; surface.beginPath();
      for (let i = 0; i < model.cellLineCount; i++) {
        const l = model.cellLines[i];
        surface.moveTo(l.x1, l.y1); surface.lineTo(l.x2, l.y2);
      }
      surface.stroke();
    }
    for (let i = 0; i < model.rectCount; i++) {
      const r = model.rects[i];
      surface.strokeStyle = `#${r.color.toString(16).padStart(6, "0")}`;
      surface.lineWidth = r.lineWidth ?? 1;
      const alpha = surface.globalAlpha;
      surface.globalAlpha = alpha * (r.fillAlpha ?? .12);
      surface.fillStyle = surface.strokeStyle;
      surface.fillRect(r.x, r.y, r.width, r.height);
      surface.globalAlpha = alpha * (r.strokeAlpha ?? 1);
      surface.strokeRect(r.x, r.y, r.width, r.height);
      surface.globalAlpha = alpha;
    }
    surface.strokeStyle = "rgba(136, 221, 255, 0.5)";
    surface.lineWidth = 1; surface.beginPath();
    for (let i = 0; i < model.lineCount; i++) {
      const l = model.lines[i];
      surface.moveTo(l.x1, l.y1); surface.lineTo(l.x2, l.y2);
    }
    surface.stroke();
    if (model.overlay) this.#renderAnnotations(model.overlay);
  }
}
