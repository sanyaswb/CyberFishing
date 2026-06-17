class GameOverRenderer {
  #surface;

  constructor({ surface }) {
    if (!surface || typeof surface.fillRect !== "function") {
      throw new TypeError("GameOverRenderer requires surface");
    }
    this.#surface = surface;
  }

  render(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    surface.fillStyle = "rgba(0, 0, 0, 0.8)";
    surface.fillRect(0, 0, model.width, model.height);
    surface.fillStyle = model.titleColor;
    surface.font = "bold 48px monospace";
    surface.textAlign = "center";
    surface.fillText(model.title, model.width / 2, model.height / 2 - 40);
    surface.fillStyle = "#ffaa00";
    surface.font = "bold 20px monospace";
    surface.fillText(
      model.description,
      model.width / 2,
      model.height / 2 + 20,
    );
    surface.fillStyle = "#00ccff";
    surface.font = "bold 16px monospace";
    surface.fillText(
      "Refresh page to try again",
      model.width / 2,
      model.height / 2 + 70,
    );
  }
}
