class HoldChargesRenderer {
  #surface;

  constructor({ surface }) {
    if (!surface || typeof surface.arc !== "function") {
      throw new TypeError("HoldChargesRenderer requires surface");
    }
    this.#surface = surface;
  }

  render(model) {
    if (!model.visible || model.max <= 0) return;
    const surface = this.#surface;
    const radius = 8;
    const gap = 12;
    const totalWidth =
      radius * 2 * model.max + gap * Math.max(0, model.max - 1);
    const startX = (model.viewportWidth - totalWidth) / 2 + radius;
    const startY = model.viewportHeight * 0.75;
    let available = model.current;
    let active = model.active ? 1 : 0;
    let restoring = model.restoringCount;

    surface.save();
    for (let index = 0; index < model.max; index += 1) {
      const x = startX + index * (radius * 2 + gap);
      surface.beginPath();
      surface.arc(x, startY, radius, 0, Math.PI * 2);
      if (active > 0) {
        surface.strokeStyle = "#00ff80";
        surface.lineWidth = 2;
        surface.stroke();
        surface.shadowBlur = 10;
        surface.shadowColor = "#00ff80";
        surface.stroke();
        surface.shadowBlur = 0;
        active -= 1;
      } else if (available > 0) {
        surface.fillStyle = "#00ff80";
        surface.fill();
        surface.strokeStyle = "#00cc66";
        surface.lineWidth = 1;
        surface.stroke();
        available -= 1;
      } else if (restoring > 0) {
        surface.strokeStyle = "#ff0055";
        surface.lineWidth = 2;
        surface.stroke();
        const progress = model.restoreProgress[restoring - 1] || 0;
        if (progress > 0) {
          surface.save();
          surface.beginPath();
          surface.arc(x, startY, radius, 0, Math.PI * 2);
          surface.clip();
          const fillHeight = radius * 2 * progress;
          surface.fillStyle = "rgba(255, 0, 85, 0.5)";
          surface.fillRect(
            x - radius,
            startY + radius - fillHeight,
            radius * 2,
            fillHeight,
          );
          surface.restore();
        }
        restoring -= 1;
      }
    }
    if (model.active) {
      surface.fillStyle = "#00ff80";
      surface.font = "bold 12px Arial";
      surface.textAlign = "center";
      surface.fillText("HOLD", model.viewportWidth / 2, startY - 20);
    }
    surface.restore();
  }
}
