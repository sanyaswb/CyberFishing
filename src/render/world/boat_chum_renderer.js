class BoatChumRenderer {
  #surface;
  #primitives;

  constructor({ surface, primitives }) {
    if (!surface || typeof surface.ellipse !== "function") {
      throw new TypeError("BoatChumRenderer requires surface");
    }
    if (!primitives || typeof primitives.withClip !== "function") {
      throw new TypeError("BoatChumRenderer requires primitives");
    }
    this.#surface = surface;
    this.#primitives = primitives;
  }

  render(model) {
    if (!model.visible) return;
    this.#renderChumZones(model);
    this.#renderWaypoints(model);
    this.#renderBoats(model);
    this.#renderSensors(model);
  }

  #renderChumZones(model) {
    this.#primitives.withClip(model.clipRegions, () => {
      model.chumZones.forEach((zone) => {
        const surface = this.#surface;
        surface.save();
        surface.beginPath();
        surface.ellipse(
          zone.x,
          zone.y,
          zone.radiusX,
          zone.radiusY,
          0,
          0,
          Math.PI * 2,
        );
        surface.fillStyle = `rgba(200, 255, 100, ${zone.opacity * 0.2})`;
        surface.fill();
        surface.strokeStyle = `rgba(200, 255, 100, ${zone.opacity * 0.5})`;
        surface.lineWidth = 2;
        surface.stroke();
        surface.restore();
      });
    });
  }

  #renderWaypoints(model) {
    model.waypoints.forEach((waypoint) => {
      const surface = this.#surface;
      surface.save();
      surface.beginPath();
      surface.arc(
        waypoint.x,
        waypoint.y,
        8 * waypoint.scale,
        0,
        Math.PI * 2,
      );
      surface.strokeStyle = "rgba(255, 170, 0, 0.6)";
      surface.lineWidth = Math.max(1, 2 * waypoint.scale);
      surface.stroke();
      surface.beginPath();
      surface.arc(
        waypoint.x,
        waypoint.y,
        3 * waypoint.scale,
        0,
        Math.PI * 2,
      );
      surface.fillStyle = "#ffaa00";
      surface.fill();
      if (waypoint.showIndex) {
        surface.fillStyle = "#ffffff";
        surface.font = `bold ${Math.max(6, 10 * waypoint.scale)}px Arial`;
        surface.fillText(
          String(waypoint.index),
          waypoint.x + 10 * waypoint.scale,
          waypoint.y + 4 * waypoint.scale,
        );
      }
      surface.restore();
    });
  }

  #renderBoats(model) {
    const surface = this.#surface;
    surface.save();
    surface.textAlign = "center";
    surface.textBaseline = "middle";
    model.boats.forEach((boat) => {
      surface.save();
      surface.translate(boat.x, boat.y);
      surface.rotate(boat.angle + Math.PI);
      surface.font = `${boat.fontSize}px sans-serif`;
      surface.fillText(boat.emoji, 0, 0);
      surface.restore();
      surface.fillStyle = "rgba(0, 0, 0, 0.7)";
      surface.fillRect(
        boat.x - boat.barWidth / 2,
        boat.y + boat.barY,
        boat.barWidth,
        boat.barHeight,
      );
      surface.fillStyle = boat.energyColor;
      surface.fillRect(
        boat.x - boat.barWidth / 2,
        boat.y + boat.barY,
        boat.barWidth * boat.energyRatio,
        boat.barHeight,
      );
    });
    surface.restore();
  }

  #renderSensors(model) {
    const surface = this.#surface;
    surface.save();
    surface.lineWidth = 2;
    model.sensorRays.forEach((ray) => {
      surface.strokeStyle = ray.blocked
        ? "rgba(255, 0, 0, 0.6)"
        : "rgba(0, 255, 0, 0.6)";
      surface.beginPath();
      surface.moveTo(ray.startX, ray.startY);
      surface.lineTo(ray.endX, ray.endY);
      surface.stroke();
    });
    surface.restore();
  }
}
