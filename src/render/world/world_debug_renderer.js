class WorldDebugRenderer {
  #surface;

  constructor({ surface }) {
    if (!surface || typeof surface.drawImage !== "function") {
      throw new TypeError("WorldDebugRenderer requires surface");
    }
    this.#surface = surface;
  }

  render(model) {
    if (!model.visible) return;
    const surface = this.#surface;
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
}
