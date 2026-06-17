class WorldSceneRenderer {
  #surface;
  #assets;

  constructor({ surface, assets }) {
    if (!surface || typeof surface.clear !== "function") {
      throw new TypeError("WorldSceneRenderer requires surface");
    }
    if (!assets || typeof assets.tryGet !== "function") {
      throw new TypeError("WorldSceneRenderer requires assets");
    }
    this.#surface = surface;
    this.#assets = assets;
  }

  render(model) {
    if (!model.visible) return;
    this.#surface.clear(model.backgroundColor);
    model.backgroundLayers.forEach((layer) => {
      const image = this.#assets.tryGet(layer.assetId);
      if (!image) return;
      const previousAlpha = this.#surface.globalAlpha;
      this.#surface.globalAlpha = layer.alpha;
      this.#surface.drawImage(
        image,
        layer.x,
        layer.y,
        layer.width,
        layer.height,
      );
      this.#surface.globalAlpha = previousAlpha;
    });
  }

  renderInvalidCastMarker(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    surface.strokeStyle = "rgba(255, 0, 0, 0.8)";
    surface.lineWidth = 3;
    surface.beginPath();
    surface.arc(model.x, model.y, 15, 0, Math.PI * 2);
    surface.stroke();
    surface.fillStyle = "rgba(255, 0, 0, 0.3)";
    surface.fill();
    surface.beginPath();
    surface.moveTo(model.x - 8, model.y - 8);
    surface.lineTo(model.x + 8, model.y + 8);
    surface.moveTo(model.x + 8, model.y - 8);
    surface.lineTo(model.x - 8, model.y + 8);
    surface.stroke();
  }
}
