class BoatChumRenderFrameBuilder {
  #chum;
  #projector;
  #config;
  #screenA = new Vector2(0, 0);
  #screenB = new Vector2(0, 0);

  constructor({ chum, projector, config }) {
    if (!chum || typeof chum.getBoats !== "function") {
      throw new TypeError(
        "BoatChumRenderFrameBuilder requires chum",
      );
    }
    if (!projector || typeof projector.virtualToScreen !== "function") {
      throw new TypeError(
        "BoatChumRenderFrameBuilder requires projector",
      );
    }
    this.#chum = chum;
    this.#projector = projector;
    this.#config = config;
  }

  buildInto(target) {
    this.#buildChumZones(target);
    this.#buildBoats(target);
  }

  #buildChumZones(target) {
    if (this.#config.locations?.showChumZones === false) return;
    const zones = this.#chum.getZones();
    for (let index = 0; index < zones.length; index += 1) {
      const source = zones[index];
      if (!source.isDelivered || source.isExpired) continue;
      const bait = source.baitConfig;
      let opacity = 1;
      if (source.currentBonus < bait.maxBonus) {
        opacity =
          0.3 +
          (0.7 * (source.currentBonus - bait.minBonus)) /
            Math.max(0.01, bait.maxBonus - bait.minBonus);
      }
      const perspective = this.#projector.getPerspective(source.y);
      const position = this.#projector.virtualToScreen(
        source.x,
        source.y,
        this.#screenA,
      );
      const radius =
        source.baseRadius *
        perspective.scale *
        this.#projector.getScale();
      const record = target.chumZones.acquire();
      record.x = position.x;
      record.y = position.y;
      record.radiusX = radius;
      record.radiusY = radius * perspective.squashY;
      record.opacity = opacity;
    }
  }

  #buildBoats(target) {
    const boats = this.#chum.getBoats();
    for (let boatIndex = 0; boatIndex < boats.length; boatIndex += 1) {
      const boat = boats[boatIndex];
      this.#buildWaypoints(target, boat);
      const position = this.#projector.virtualToScreen(
        boat.pos.x,
        boat.pos.y,
        this.#screenA,
      );
      const scale = this.#projector.getPerspective(boat.pos.y).scale;
      const fontSize = 40 * this.#projector.getScale() * scale;
      const energyRatio = RenderMath.clamp(
        boat.energy / Math.max(0.001, boat.stats.maxEnergy),
      );
      const record = target.boats.acquire();
      record.x = position.x;
      record.y = position.y;
      record.angle = boat.angle;
      record.emoji = boat.config.emoji;
      record.fontSize = fontSize;
      record.energyRatio = energyRatio;
      record.energyColor =
        energyRatio > 0.5
          ? "#00ff80"
          : energyRatio > 0.2
            ? "#ffaa00"
            : "#ff4444";
      record.barWidth = 40 * scale;
      record.barHeight = 4 * scale;
      record.barY = -fontSize / 1.5;
      this.#buildSensors(target, boat);
    }
  }

  #buildWaypoints(target, boat) {
    let displayIndex = 1;
    if (boat.state === "deploying" && boat.target) {
      this.#addWaypoint(target, boat.target, boat, displayIndex++);
    }
    for (let index = 0; index < boat.waypoints.length; index += 1) {
      this.#addWaypoint(
        target,
        boat.waypoints[index],
        boat,
        displayIndex++,
      );
    }
  }

  #addWaypoint(target, point, boat, index) {
    const position = this.#projector.virtualToScreen(
      point.x,
      point.y,
      this.#screenA,
    );
    const record = target.waypoints.acquire();
    record.x = position.x;
    record.y = position.y;
    record.scale = this.#projector.getPerspective(point.y).scale;
    record.index = index;
    record.showIndex = boat.config.manualControl !== true;
  }

  #buildSensors(target, boat) {
    const rays = boat.sensorRays;
    for (let index = 0; index < rays.length; index += 1) {
      const ray = rays[index];
      const start = this.#projector.virtualToScreen(
        ray.startX,
        ray.startY,
        this.#screenA,
      );
      const startX = start.x;
      const startY = start.y;
      const end = this.#projector.virtualToScreen(
        ray.endX,
        ray.endY,
        this.#screenB,
      );
      const record = target.sensorRays.acquire();
      record.startX = startX;
      record.startY = startY;
      record.endX = end.x;
      record.endY = end.y;
      record.blocked = ray.isBlocked === true;
    }
  }
}
